/**
 * Seed the organisational structure: departments, sections and employee records.
 * تعبئة الهيكل التنظيمي: الإدارات والأقسام وسجلات الموظفين.
 *
 *   # look first - this changes nothing:
 *   QMS_OPERATOR_EMAIL=admin@example.com QMS_OPERATOR_PASSWORD='...' \
 *     node scripts/seed-org.mjs
 *
 *   # then, only when the printed plan is right:
 *   QMS_OPERATOR_EMAIL=admin@example.com QMS_OPERATOR_PASSWORD='...' \
 *     node scripts/seed-org.mjs --commit
 *
 * DRY RUN IS THE DEFAULT. Without --commit this script signs in, reads, prints
 * exactly what it would write, and exits without touching a single document.
 *
 * WHAT IT WRITES
 *   departments/{CODE}   from src/data/org-structure.json
 *   sections/{CODE}      from the same file
 *   users/{user-<slug>}  one document per person named in that file, plus the
 *                        16 ISO 9001 internal auditors listed in its `auditors`
 *                        roster
 *
 *   Document ids are the org-structure codes for departments and sections, and
 *   a slug of the person's name for users, so a second run finds everything
 *   already there and creates nothing twice.
 *
 * WHAT IT WILL NOT DO
 *   - It never overwrites. A document that already exists is left exactly as it
 *     is and reported as EXISTS; live data is only ever added to. Correcting an
 *     existing record is the Users / Departments pages' job, not this script's.
 *   - It never touches users/system-admin-root, and never creates a second
 *     record for the person that document describes (see PROTECTED_PEOPLE).
 *   - It never creates Firebase Auth accounts and never handles passwords.
 *     An employee record here is a directory entry with no way to sign in.
 *     Onboarding happens on the Users page, which creates the Auth account and
 *     issues the one-time ACCESS CODE handed to the employee in person - there
 *     is no working email service, so nothing can be sent from a script.
 *
 * THE EMAIL ADDRESSES ARE GUESSES - ALL BUT ONE
 *   The company gave us exactly one verified address:
 *       Mohammed A. Bahwairith -> mabahwairith@saudicable.com
 *   which is first-initial + middle-initial + surname @saudicable.com. Every
 *   other address in this script is that rule applied to a transliterated name,
 *   and a transliterated Saudi or Indian name has several defensible spellings.
 *   So:
 *     - every generated address is written with `emailIsGuessed: true` on the
 *       user document, and Bahwairith's is written with `emailIsGuessed: false`;
 *     - the script prints the full list of guesses, with the plausible
 *       alternatives it considered, for the operator to correct on the Users
 *       page before anyone tries to use them.
 *   The generator is checked against the one confirmed address at startup: if
 *   the rule stops reproducing it, the script refuses to run at all.
 *
 * ROLE MAPPING - how a position became a UserRole
 *   quality_manager    Mohammed A. Bahwairith only. He is the QMS Lead Auditor
 *                      and the primary business user of this system.
 *   auditor            the other 15 people on the `auditors` roster, each with
 *                      canBeAuditor: true. This wins over any other hat they
 *                      wear: Lowi A. Bukhsh heads two departments and Tariq H.
 *                      Balubaid, Turki Abu Taleb, Mohammed K. Al-Ashram, Ajmal
 *                      Khan, Adel Rose, Sony Mathews, Mohammad Pacadlack and
 *                      Mohammad Baharthah are all section auditees as well.
 *                      Those overlaps are printed for review.
 *   department_manager anyone the workbook names as a department `head` or a
 *                      section's `departmentHead`, and who is not an auditor.
 *   employee           every remaining section auditee.
 *
 *   `section_head` exists in the UserRole union and is deliberately not used.
 *   The workbook records who is audited for a section, not whether that person
 *   heads it or is standing in for whoever does, and section_head and employee
 *   carry identical DEFAULT_PERMISSIONS - so the accurate-but-unprovable label
 *   would buy nothing. The section document still points its `headId` at the
 *   auditee, which is the fact the workbook actually asserts.
 *
 *   canBeAuditor is true for the 16 auditors and false for everyone else.
 *   auditableDepartmentIds / auditableSectionIds are left empty for everyone:
 *   who may audit what is a per-audit decision for the quality manager, and an
 *   auditor must not be handed their own area by a seeding script.
 *
 * Exit codes:
 *   0  the plan was printed (dry run), or every planned write succeeded
 *   1  the run was refused or is incomplete - a guessed address collided with
 *      another, or one or more writes failed
 *   2  the script could not start (bad config, sign-in refused)
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import {
  ROOT,
  EXIT_NOT_READY,
  loadEnv,
  initFirebase,
  readCredentials,
  signInOperator,
  signOutQuietly,
  parseFlags,
  fail,
  describeReadError,
} from './firebase-cli.mjs';

const EMAIL_DOMAIN = 'saudicable.com';

// The person this system is really for: QMS Lead Auditor, and the only
// quality_manager this script creates.
const QUALITY_MANAGER_NAME = 'Mohammed A. Bahwairith';

// The one address the company actually gave us. It is the EVIDENCE for the
// derivation rule, and the rule is checked against it at startup.
const EMAIL_RULE_EVIDENCE = { name: QUALITY_MANAGER_NAME, email: `mabahwairith@${EMAIL_DOMAIN}` };

// Addresses known to be real. These override the guess and are written with
// emailIsGuessed: false. As the operator confirms real addresses, add them here
// and re-run - a confirmed address does NOT have to match the derivation rule,
// which is exactly why it is worth recording. It is also how an email collision
// between two guesses gets resolved.
const CONFIRMED_EMAILS = {
  [EMAIL_RULE_EVIDENCE.name]: EMAIL_RULE_EVIDENCE.email,
};

// People who must never get a user document from this script, and the existing
// document that already represents them.
//
// Abdulelah Sejini is the owner and the system administrator. He is
// users/system-admin-root, flagged isSystemAccount and deliberately hidden from
// every user list and statistic in the app. He also appears in org-structure as
// the head and the auditee of Governance, Risk & Compliance - seeding that name
// would create a SECOND, visible identity for one person and quietly undo the
// hiding. GRC's managerId and GRC-RISK's headId are therefore left unset rather
// than pointed at the hidden account; the operator can set them from the app if
// that is what they want.
const PROTECTED_PEOPLE = {
  'Abdulelah Sejini': 'system-admin-root',
};

// Never written to, under any flag.
const PROTECTED_USER_IDS = new Set(['system-admin-root']);

// Arabic names for the people who are NOT on the auditors roster - the roster
// carries its own nameAr in org-structure.json. Every user document has to be
// bilingual, and the workbook is English-only, so these are transliterations
// made here. Like the addresses they are best-effort and worth checking, but
// unlike the addresses nothing authenticates against them.
const ARABIC_NAMES = {
  'Khalid Boqasim': 'خالد بوقاسم',
  'Asim Qari': 'عاصم قاري',
  'Moayad Ahmadi': 'مؤيد أحمدي',
  'Khalid Zainulabdeen': 'خالد زين العابدين',
  'Abdulaziz Alfarsi': 'عبدالعزيز الفارسي',
  'Mohamed Salem': 'محمد سالم',
  'Amro Khayat': 'عمرو خياط',
  'Ahmed Saleh': 'أحمد صالح',
  'Sultan Akbar': 'سلطان أكبر',
  'Majed Owaydhi': 'ماجد عويضي',
  'M. Hadouk': 'م. حدوق',
  'Naif Al Asmari': 'نايف العسمري',
  'Hathal Bahha': 'هذال باها',
  'Omar K. Ali': 'عمر ك. علي',
  'M. Shafiuddin': 'م. شفيع الدين',
  'Mohammed Saban': 'محمد سبان',
  'Hossam Al-Malki': 'حسام المالكي',
  'Tala Helmi': 'تالا حلمي',
  'Adel Al-Jedani': 'عادل الجدعاني',
  'Hatim Zuhair': 'حاتم زهير',
  'Bassam Subhi': 'بسام صبحي',
  'Vergel Caba': 'فيرجيل كابا',
  'Moayad Asghar': 'مؤيد أصغر',
  'Abdullah Mahmood Bukhari': 'عبدالله محمود بخاري',
  'Faisal Zagheebi': 'فيصل زغيبي',
  'Samy Alshaabani': 'سامي الشعباني',
  'Huda Al Safi': 'هدى الصافي',
  'Akram Zuhair': 'أكرم زهير',
  'Sudhir V. K.': 'سودهير ف. ك.',
  'Abdul Rahman Mahboob': 'عبدالرحمن محبوب',
  'Mohammad Bagasi': 'محمد باقاسي',
  'Jinto Devassy': 'جينتو ديفاسي',
};

const DEPARTMENT_MANAGER_TITLE = { en: 'Department Manager', ar: 'مدير إدارة' };

// Surname particles. When one of these stands as its own token immediately
// before the last token it belongs to the surname: "Naif Al Asmari" is
// nalasmari, not nasmari.
const SURNAME_PARTICLES = new Set(['al', 'el', 'abu', 'abo', 'bin', 'ibn', 'bu', 'van', 'de', 'da']);
const LEADING_PARTICLE = /^(al|el|abu|abo|bin|ibn)/;

// -------------------------------------------------------------------------
// Name handling
// -------------------------------------------------------------------------

/** Comparison key for a person's name - "M. K. Ashram" and "M K Ashram" are one person. */
const normaliseName = (name) => name.toLowerCase().replace(/[^a-z]+/g, ' ').trim();

const asciiToken = (token) => token.toLowerCase().replace(/[^a-z]/g, '');
const isInitial = (token) => asciiToken(token).length === 1;

const tokenise = (name) =>
  name
    .trim()
    .split(/\s+/)
    .map((t) => t.replace(/[^A-Za-z-]/g, ''))
    .filter(Boolean);

/**
 * Every email local part one spelling of a name could reasonably produce, best
 * guess first. The first entry of the first spelling becomes the address; the
 * rest are printed as alternatives for the operator to pick from.
 */
function localPartVariants(name) {
  const tokens = tokenise(name);
  if (!tokens.length) return [];
  const variants = [];
  const push = (v) => {
    if (v && v.length > 1 && !variants.includes(v)) variants.push(v);
  };

  // Trailing initials, e.g. "Sudhir V. K." - South Indian style, where the
  // initials carry the family name. Nothing about the confirmed address tells
  // us which way this one goes, so all the readings are offered.
  if (tokens.length > 1 && isInitial(tokens[tokens.length - 1])) {
    let i = tokens.length - 1;
    const trailing = [];
    while (i >= 0 && isInitial(tokens[i])) {
      trailing.unshift(asciiToken(tokens[i]));
      i -= 1;
    }
    const given = tokens.slice(0, i + 1).map(asciiToken);
    if (!given.length) return [trailing.join('')];
    const tail = trailing.join('');
    push(given[0][0] + tail);
    push(given.join('') + tail);
    push(tail + given.join(''));
    push(given.join(''));
    return variants;
  }

  let surnameStart = tokens.length - 1;
  while (surnameStart > 1 && SURNAME_PARTICLES.has(asciiToken(tokens[surnameStart - 1]))) {
    surnameStart -= 1;
  }
  const surname = tokens.slice(surnameStart).map(asciiToken).join('');
  const initials = tokens.slice(0, surnameStart).map((t) => asciiToken(t)[0]).join('');

  push(initials + surname);
  // The middle initial may simply not be used.
  if (initials.length > 1) push(initials[0] + surname);
  // "Al-" / "Abu-" may or may not be part of the address. Only ever offered as
  // an ALTERNATIVE, never as the primary guess, and only when enough surname
  // survives the strip to still be a name - otherwise Omar K. Ali would be
  // offered "oi".
  const bare = surname.replace(LEADING_PARTICLE, '');
  if (bare !== surname && bare.length >= 4) {
    push(initials + bare);
    if (initials.length > 1) push(initials[0] + bare);
  }
  return variants;
}

/** Why this particular address is shakier than the rest. Empty means "no reason beyond being a guess". */
function guessCaveats(name, aliases) {
  const tokens = tokenise(name);
  const notes = [];
  if (tokens.length && isInitial(tokens[0])) notes.push('the source only gives an initial for the first name');
  if (tokens.length > 1 && isInitial(tokens[tokens.length - 1])) notes.push('name ends in initials - several readings are possible');
  const last = tokens[tokens.length - 1] || '';
  const hasParticle = last.includes('-') || tokens.some((t, i) => i > 0 && i < tokens.length - 1 && SURNAME_PARTICLES.has(asciiToken(t)));
  if (hasParticle) notes.push('surname particle may or may not be part of the address');
  if (aliases.length) notes.push(`the workbook spells it "${aliases.join('", "')}"`);
  return notes;
}

const slugify = (name) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

// -------------------------------------------------------------------------
// Load the source data
// -------------------------------------------------------------------------

const flags = parseFlags();
const commit = flags.commit === true || flags.commit === 'true';

const orgData = JSON.parse(readFileSync(join(ROOT, 'src/data/org-structure.json'), 'utf8'));
const auditorRoster = Array.isArray(orgData.auditors) ? orgData.auditors : [];
if (!auditorRoster.length) {
  fail('src/data/org-structure.json has no `auditors` roster', 'Nothing can be assigned the auditor role without it.');
}

// Self-check against the evidence only - NOT against the whole of
// CONFIRMED_EMAILS, whose later entries are verified addresses that are under
// no obligation to match a guessing rule.
{
  const derived = `${localPartVariants(EMAIL_RULE_EVIDENCE.name)[0]}@${EMAIL_DOMAIN}`;
  if (derived !== EMAIL_RULE_EVIDENCE.email) {
    fail(
      `The email rule no longer reproduces the one confirmed address: ${EMAIL_RULE_EVIDENCE.name} -> ${derived}, expected ${EMAIL_RULE_EVIDENCE.email}`,
      'Every guessed address in this script is that rule applied to another name, so all of them are now suspect. Fix localPartVariants() before running again.'
    );
  }
}

// -------------------------------------------------------------------------
// Build the roster of people
// -------------------------------------------------------------------------

const qualityManagerKey = normaliseName(QUALITY_MANAGER_NAME);

const people = new Map();      // normalised name -> person
const aliasToKey = new Map();  // normalised spelling -> normalised canonical name
const unresolved = [];         // auditee cells we refuse to turn into a person
const protectedHits = [];      // places where a protected person was named

const protectedKeys = new Map(
  Object.entries(PROTECTED_PEOPLE).map(([name, id]) => [normaliseName(name), { name, id }])
);

function addPerson(nameEn, nameAr, extra) {
  const key = normaliseName(nameEn);
  const existing = people.get(key);
  if (existing) return existing;
  const person = {
    key,
    nameEn,
    nameAr,
    aliases: [],
    isAuditor: false,
    role: 'employee',
    canBeAuditor: false,
    jobTitleEn: '',
    jobTitleAr: '',
    departmentId: '',
    sectionId: '',
    headsDepartments: [],
    auditsSections: [],
    ...extra,
  };
  people.set(key, person);
  return person;
}

for (const auditor of auditorRoster) {
  const person = addPerson(auditor.nameEn, auditor.nameAr, {
    isAuditor: true,
    // Bahwairith is the quality manager; the rest of the roster are auditors.
    role: normaliseName(auditor.nameEn) === qualityManagerKey ? 'quality_manager' : 'auditor',
    canBeAuditor: true,
    jobTitleEn: auditor.positionEn,
    jobTitleAr: auditor.positionAr,
    aliases: [...(auditor.aliases || [])],
  });
  aliasToKey.set(person.key, person.key);
  for (const alias of auditor.aliases || []) aliasToKey.set(normaliseName(alias), person.key);
}

if (!people.has(qualityManagerKey)) {
  fail(
    `${QUALITY_MANAGER_NAME} is not on the auditors roster in src/data/org-structure.json`,
    'He is the QMS Lead Auditor and the only quality_manager this script creates; without him nothing would hold that role.'
  );
}

/**
 * Turn one workbook cell into people. A cell may name two ("Adel Rose / Moayad")
 * and may name somebody we cannot identify.
 */
function resolveCell(raw, where) {
  if (!raw || !raw.trim()) return [];
  const resolved = [];
  for (const part of raw.split('/')) {
    const name = part.trim();
    if (!name) continue;
    const key = normaliseName(name);

    const guarded = protectedKeys.get(key);
    if (guarded) {
      protectedHits.push({ name: guarded.name, id: guarded.id, where });
      continue;
    }

    const canonical = aliasToKey.get(key);
    if (canonical) {
      const person = people.get(canonical);
      if (!person.aliases.includes(name) && normaliseName(person.nameEn) !== key) person.aliases.push(name);
      resolved.push(person);
      continue;
    }

    // A single given name is not a person - "Moayad" could be Moayad Ahmadi or
    // Moayad Asghar, and inventing an employee record for the wrong one is
    // worse than leaving the cell for the operator.
    if (tokenise(name).length < 2) {
      unresolved.push({ raw: name, where, reason: 'only a given name - cannot tell which employee this is' });
      continue;
    }

    if (!ARABIC_NAMES[name]) {
      unresolved.push({ raw: name, where, reason: 'no Arabic spelling on file - add it to ARABIC_NAMES in this script' });
      continue;
    }

    resolved.push(addPerson(name, ARABIC_NAMES[name]));
  }
  return resolved;
}

// Walk the structure: departments, their heads, their sections and auditees.
const departmentPlan = [];
const sectionPlan = [];

for (const dept of orgData.departments) {
  const headNames = new Set();
  if (dept.head) headNames.add(dept.head);
  for (const section of dept.sections) if (section.departmentHead) headNames.add(section.departmentHead);

  const heads = [];
  for (const headName of headNames) {
    for (const person of resolveCell(headName, `${dept.code} (department head)`)) {
      if (!person.headsDepartments.includes(dept.code)) person.headsDepartments.push(dept.code);
      if (!person.isAuditor) {
        person.role = 'department_manager';
        person.jobTitleEn ||= DEPARTMENT_MANAGER_TITLE.en;
        person.jobTitleAr ||= DEPARTMENT_MANAGER_TITLE.ar;
      }
      person.departmentId ||= dept.code;
      heads.push(person);
    }
  }

  departmentPlan.push({
    id: dept.code,
    code: dept.code,
    nameAr: dept.nameAr,
    nameEn: dept.nameEn,
    // Only when the workbook names exactly one head for the whole department.
    // Operations lists a different departmentHead for production and for
    // maintenance, so it gets none rather than an arbitrary one.
    managerKey: heads.length === 1 ? heads[0].key : null,
    headCount: heads.length,
    namedHeadCount: headNames.size,
  });

  for (const section of dept.sections) {
    const auditees = resolveCell(section.auditee, section.code);
    for (const person of auditees) {
      person.departmentId ||= dept.code;
      person.sectionId ||= section.code;
      if (!person.auditsSections.includes(section.code)) person.auditsSections.push(section.code);
    }
    sectionPlan.push({
      id: section.code,
      code: section.code,
      departmentId: dept.code,
      nameAr: section.nameAr,
      nameEn: section.nameEn,
      headKey: auditees.length ? auditees[0].key : null,
      auditeeCount: auditees.length,
    });
  }
}

// Auditors who never appear as an auditee or a head still need a home
// department. These are position-based guesses and are printed as such.
const AUDITOR_DEPARTMENT_GUESS = {
  'Babu Jaseen': 'PS',       // Acting Head of Technology Section
  'Abdul Hameed Abdullah': 'OPS', // Division Head of Maintenance
  'Sultan Qahtani': 'OPS',   // Division Head of Production
  'Mohammed Iqbal': 'SCM',   // Team Leader Shipping Management
  'Ramy A. Yaqoob': 'HR',    // Executive Office Coordinator, under the Chief of Staff
  'Ammar Zamreeq': 'SCM',    // Logistics Specialist
};
const placedByGuess = [];
for (const person of people.values()) {
  if (person.departmentId) continue;
  const guess = AUDITOR_DEPARTMENT_GUESS[person.nameEn];
  if (guess) {
    person.departmentId = guess;
    placedByGuess.push(person);
  }
}

// -------------------------------------------------------------------------
// Addresses
// -------------------------------------------------------------------------

for (const person of people.values()) {
  const spellings = [person.nameEn, ...person.aliases];
  const candidates = [];
  for (const spelling of spellings) {
    for (const variant of localPartVariants(spelling)) {
      if (!candidates.includes(variant)) candidates.push(variant);
    }
  }
  const confirmed = CONFIRMED_EMAILS[person.nameEn];
  person.email = confirmed || `${candidates[0]}@${EMAIL_DOMAIN}`;
  person.emailIsGuessed = !confirmed;
  person.emailAlternatives = confirmed
    ? []
    : candidates.slice(1).map((c) => `${c}@${EMAIL_DOMAIN}`);
  person.emailCaveats = confirmed ? [] : guessCaveats(person.nameEn, person.aliases);
  person.docId = `user-${slugify(person.nameEn)}`;
}

// Two people cannot share an address. Rather than pick a winner, stop: a wrong
// address is a sign-in that lands on somebody else's account.
const byEmail = new Map();
for (const person of people.values()) {
  const list = byEmail.get(person.email) || [];
  list.push(person);
  byEmail.set(person.email, list);
}
const collisions = [...byEmail.entries()].filter(([, list]) => list.length > 1);

// -------------------------------------------------------------------------
// Read what is already there
// -------------------------------------------------------------------------

const env = loadEnv();
const { db, auth } = initFirebase(env);
const credentials = readCredentials(flags);

console.log('Organisation seeding | تعبئة الهيكل التنظيمي');
console.log(`Project: ${env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}`);
console.log(
  commit
    ? 'Mode:    COMMIT - documents that do not exist yet WILL be written.\n'
    : 'Mode:    DRY RUN - nothing will be written. Re-run with --commit to write.\n'
);

await signInOperator(auth, credentials);

async function readCollection(name) {
  try {
    const snapshot = await getDocs(collection(db, name));
    return snapshot.docs;
  } catch (error) {
    fail(describeReadError(name, error), 'The operator account must be an active system_admin to seed users.');
  }
}

const existingUserDocs = await readCollection('users');
const existingDepartmentIds = new Set((await readCollection('departments')).map((d) => d.id));
const existingSectionIds = new Set((await readCollection('sections')).map((d) => d.id));
const existingUserIds = new Set(existingUserDocs.map((d) => d.id));
const existingEmails = new Map();
for (const d of existingUserDocs) {
  const email = (d.data().email || '').toLowerCase();
  if (email) existingEmails.set(email, d.id);
}

// Continue the EMP-#### series rather than restarting it, so a person added by
// a later run never inherits a number somebody already has.
let nextEmployeeSeq = 0;
for (const d of existingUserDocs) {
  const match = /^EMP-(\d+)$/.exec(d.data().employeeNumber || '');
  if (match) nextEmployeeSeq = Math.max(nextEmployeeSeq, Number(match[1]));
}

// -------------------------------------------------------------------------
// Plan
// -------------------------------------------------------------------------

const now = new Date().toISOString();
const roster = [...people.values()].sort((a, b) => a.nameEn.localeCompare(b.nameEn));

const userPlan = [];
for (const person of roster) {
  if (PROTECTED_USER_IDS.has(person.docId)) {
    userPlan.push({ person, action: 'REFUSED', why: 'protected system account' });
    continue;
  }
  if (existingUserIds.has(person.docId)) {
    userPlan.push({ person, action: 'EXISTS', why: person.docId });
    continue;
  }
  const clash = existingEmails.get(person.email.toLowerCase());
  if (clash) {
    userPlan.push({ person, action: 'SKIP', why: `${person.email} already belongs to ${clash}` });
    continue;
  }
  nextEmployeeSeq += 1;
  const employeeNumber = `EMP-${String(nextEmployeeSeq).padStart(4, '0')}`;
  userPlan.push({
    person,
    action: 'CREATE',
    why: '',
    document: {
      id: person.docId,
      employeeNumber,
      email: person.email,
      emailIsGuessed: person.emailIsGuessed,
      fullNameAr: person.nameAr,
      fullNameEn: person.nameEn,
      role: person.role,
      departmentId: person.departmentId,
      sectionId: person.sectionId,
      canBeAuditor: person.canBeAuditor,
      auditableDepartmentIds: [],
      auditableSectionIds: [],
      jobTitleAr: person.jobTitleAr,
      jobTitleEn: person.jobTitleEn,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
  });
}

const createdKeys = new Set(userPlan.filter((p) => p.action === 'CREATE').map((p) => p.person.key));
const knownKeys = new Set(userPlan.filter((p) => p.action !== 'REFUSED').map((p) => p.person.key));

for (const dept of departmentPlan) {
  dept.action = existingDepartmentIds.has(dept.id) ? 'EXISTS' : 'CREATE';
  const manager = dept.managerKey && knownKeys.has(dept.managerKey) ? people.get(dept.managerKey) : null;
  dept.document = {
    id: dept.id,
    code: dept.code,
    nameAr: dept.nameAr,
    nameEn: dept.nameEn,
    ...(manager ? { managerId: manager.docId } : {}),
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
  dept.managerName = manager ? manager.nameEn : '';
}

for (const section of sectionPlan) {
  section.action = existingSectionIds.has(section.id) ? 'EXISTS' : 'CREATE';
  const head = section.headKey && knownKeys.has(section.headKey) ? people.get(section.headKey) : null;
  section.document = {
    id: section.id,
    code: section.code,
    departmentId: section.departmentId,
    nameAr: section.nameAr,
    nameEn: section.nameEn,
    ...(head ? { headId: head.docId } : {}),
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
  section.headName = head ? head.nameEn : '';
}

// -------------------------------------------------------------------------
// Print the plan
// -------------------------------------------------------------------------

const pad = (value, width) => String(value ?? '').padEnd(width);

function printTable(headers, rows) {
  if (!rows.length) return;
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => String(r[i] ?? '').length)));
  console.log(`  ${headers.map((h, i) => pad(h, widths[i])).join('  ')}`);
  console.log(`  ${widths.map((w) => '-'.repeat(w)).join('  ')}`);
  for (const row of rows) console.log(`  ${row.map((c, i) => pad(c, widths[i])).join('  ')}`);
}

console.log(`Departments (${departmentPlan.length})`);
printTable(
  ['', 'CODE', 'NAME', 'MANAGER'],
  departmentPlan.map((d) => [d.action, d.code, d.nameEn, d.managerName || '(none - see review notes)'])
);

console.log(`\nSections (${sectionPlan.length})`);
printTable(
  ['', 'CODE', 'NAME', 'HEAD (from the workbook auditee)'],
  sectionPlan.map((s) => [s.action, s.code, s.nameEn, s.headName || '(none)'])
);

console.log(`\nEmployee records (${userPlan.length})`);
printTable(
  ['', 'NAME', 'ROLE', 'DEPT', 'SECTION', 'NOTE'],
  userPlan.map((p) => [
    p.action,
    p.person.nameEn,
    p.person.role,
    p.person.departmentId || '-',
    p.person.sectionId || '-',
    p.why,
  ])
);

console.log('\n=========================================================================');
console.log('GUESSED EMAIL ADDRESSES - EVERY ONE OF THESE IS A GUESS');
console.log('عناوين بريد مُخمَّنة - كل عنوان هنا تخمين وليس عنواناً مؤكداً');
console.log('=========================================================================');
console.log(`Derived from the one confirmed address (${EMAIL_RULE_EVIDENCE.name} ->`);
console.log(`${EMAIL_RULE_EVIDENCE.email}): first initial + middle initial + surname.`);
console.log('Each is written with emailIsGuessed: true. Correct them on the Users page');
console.log('before anyone is onboarded - nothing verifies these, and there is no email');
console.log('service that would bounce a wrong one.\n');
printTable(
  ['NAME', 'GUESSED ADDRESS', 'ALTERNATIVES CONSIDERED', 'WHY IT IS UNCERTAIN'],
  roster
    .filter((p) => p.emailIsGuessed)
    .map((p) => [p.nameEn, p.email, p.emailAlternatives.join(', ') || '-', p.emailCaveats.join('; ') || 'transliteration only'])
);

const confirmedPeople = roster.filter((p) => !p.emailIsGuessed);
if (confirmedPeople.length) {
  console.log('\nConfirmed, written with emailIsGuessed: false:');
  printTable(['NAME', 'ADDRESS'], confirmedPeople.map((p) => [p.nameEn, p.email]));
}

// ---- review notes -------------------------------------------------------
const notes = [];

for (const hit of protectedHits) {
  notes.push(
    `${hit.name} is named in ${hit.where} but is the hidden system account (users/${hit.id}). ` +
      'No employee record was created and no department or section points at that account.'
  );
}
for (const item of unresolved) {
  notes.push(`${item.where}: auditee "${item.raw}" was NOT turned into an employee - ${item.reason}.`);
}
for (const dept of departmentPlan) {
  if (dept.managerName) continue;
  const reason =
    dept.headCount === 0
      ? dept.namedHeadCount === 0
        ? 'the workbook names no head for it'
        : 'the only head the workbook names is not an employee this script may create'
      : `the workbook names ${dept.headCount} different heads for it`;
  notes.push(`${dept.code}: managerId was left unset because ${reason}. Set it on the Departments page.`);
}
for (const person of placedByGuess) {
  notes.push(
    `${person.nameEn} (${person.jobTitleEn}) is on the auditor roster but appears nowhere in the ` +
      `workbook, so the department ${person.departmentId} is a guess from the position alone.`
  );
}
for (const person of roster) {
  if (person.auditsSections.length > 1) {
    notes.push(`${person.nameEn} is the auditee of ${person.auditsSections.join(', ')} - sectionId was set to the first.`);
  }
  if (person.headsDepartments.length > 1) {
    notes.push(`${person.nameEn} heads ${person.headsDepartments.join(', ')} - departmentId was set to ${person.departmentId}.`);
  }
  // Only worth flagging where the auditor role DEMOTED someone. The quality
  // manager already outranks every other hat, so it is not a trade-off for him.
  if (person.isAuditor && person.role === 'auditor' && (person.auditsSections.length || person.headsDepartments.length)) {
    notes.push(
      `${person.nameEn} is both an internal auditor and ${
        person.headsDepartments.length ? `head of ${person.headsDepartments.join(', ')}` : `the auditee of ${person.auditsSections.join(', ')}`
      } - the auditor role wins, so this account does not get department_manager rights.`
    );
  }
}

if (notes.length) {
  console.log('\n=========================================================================');
  console.log('NEEDS AN OPERATOR DECISION | يحتاج قراراً من المشغّل');
  console.log('=========================================================================');
  for (const note of notes) console.log(`  - ${note}`);
}

// -------------------------------------------------------------------------
// Write, or explain why nothing was written
// -------------------------------------------------------------------------

const toCreate = [
  ...departmentPlan.filter((d) => d.action === 'CREATE').map((d) => ({ path: 'departments', doc: d.document, label: d.code })),
  ...sectionPlan.filter((s) => s.action === 'CREATE').map((s) => ({ path: 'sections', doc: s.document, label: s.code })),
  ...userPlan.filter((p) => p.action === 'CREATE').map((p) => ({ path: 'users', doc: p.document, label: p.person.nameEn })),
];

console.log(
  `\nPlan: ${toCreate.length} document(s) to create, ` +
    `${departmentPlan.filter((d) => d.action === 'EXISTS').length + sectionPlan.filter((s) => s.action === 'EXISTS').length + userPlan.filter((p) => p.action === 'EXISTS').length} already present and left untouched.`
);

if (collisions.length) {
  console.error('\nREFUSING TO WRITE - two people were given the same guessed address:');
  for (const [email, list] of collisions) {
    console.error(`  ${email} <- ${list.map((p) => p.nameEn).join(', ')}`);
  }
  console.error('Set the real addresses in CONFIRMED_EMAILS in this script, or correct the');
  console.error('spellings in src/data/org-structure.json, then run again.');
  await signOutQuietly(auth);
  process.exit(EXIT_NOT_READY);
}

if (!commit) {
  console.log('\nDRY RUN - nothing was written. Nothing in Firestore changed.');
  console.log('تشغيل تجريبي - لم يُكتب أي شيء.');
  console.log('Re-run with --commit once the tables above are right:');
  console.log("  QMS_OPERATOR_EMAIL=... QMS_OPERATOR_PASSWORD='...' node scripts/seed-org.mjs --commit");
  await signOutQuietly(auth);
  process.exit(0);
}

let written = 0;
const failures = [];
for (const item of toCreate) {
  if (item.path === 'users' && PROTECTED_USER_IDS.has(item.doc.id)) {
    // Belt and braces: the roster already excludes it.
    failures.push(`${item.path}/${item.doc.id}: refused - protected system account`);
    continue;
  }
  try {
    const { id, ...data } = item.doc;
    await setDoc(doc(db, item.path, id), { id, ...data });
    written += 1;
    console.log(`  wrote ${item.path}/${id}  ${item.label}`);
  } catch (error) {
    failures.push(`${item.path}/${item.doc.id}: ${error?.code || ''} ${error?.message || error}`.trim());
  }
}

await signOutQuietly(auth);

console.log(`\n${written} document(s) written.`);
if (failures.length) {
  console.error(`${failures.length} write(s) FAILED - the seeding is incomplete:`);
  for (const failure of failures) console.error(`  ${failure}`);
  console.error('Nothing was rolled back; re-running is safe, it will only retry what is missing.');
  process.exit(EXIT_NOT_READY);
}
console.log('No Firebase Auth accounts were created and no passwords were set.');
console.log('Onboard each employee from the Users page, which issues their one-time access code.');
process.exit(0);
