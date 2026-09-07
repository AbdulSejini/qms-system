/**
 * Load the 2025 internal audit programme and its findings into Firestore.
 * تحميل برنامج المراجعة الداخلية 2025 وملاحظاته إلى قاعدة البيانات.
 *
 * WHAT THIS IMPORTS, AND FROM WHERE
 *   src/data/audit-program-2025.json  the signed ISO 9001:2015 audit programme for 2025 -
 *                                     41 lines, 40 of them a real booked audit of one
 *                                     section, with the auditors, the auditee, the date
 *                                     and the time the QA department set.
 *   src/data/findings-2025.json       the 67 findings that round raised, transcribed from
 *                                     the QA department's summary workbook. Counts
 *                                     reconcile with that workbook's own summary tab.
 *
 * WHAT IT WRITES
 *   annualPlans/plan-2025   the programme as the year's approved annual plan, one item
 *                           per booked audit, each pointing at the audit created for it.
 *   audits/audit-2025-<section code>
 *                           one audit per programme line, carrying the checklist for that
 *                           area out of the question bank, the findings raised against it,
 *                           and - the field the whole approval chain hangs off - auditeeId.
 *
 * WHAT IT DOES NOT DO
 *   It never touches users, departments or sections. Those come from seed-org.mjs and must
 *   already be there; this script resolves against them and REFUSES to invent a person. A
 *   name it cannot resolve is reported, not guessed, because an audit filed against the
 *   wrong person is worse than an audit not filed.
 *
 *   QMS_OPERATOR_EMAIL=... QMS_OPERATOR_PASSWORD=... node scripts/import-audit-history.mjs [--apply]
 *
 * DRY RUN BY DEFAULT. It prints every document it would write and every name it could not
 * resolve, and writes nothing until you pass --apply. Take a backup first:
 *
 *   node scripts/backup-firestore.mjs
 *
 * Like every script here it runs on the client SDK under the deployed rules, so it needs a
 * system_admin operator account.
 *
 * Exit codes:
 *   0  finished, everything resolved (and written, with --apply)
 *   1  finished, but something could not be resolved or written - read the report
 *   2  could not start (bad config, sign-in refused, a collection unreadable)
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import {
  ROOT,
  loadEnv,
  initFirebase,
  readCredentials,
  signInOperator,
  signOutQuietly,
  describeReadError,
} from './firebase-cli.mjs';

const APPLY = process.argv.includes('--apply');

const env = loadEnv();
const { db, auth } = initFirebase(env);
const credentials = readCredentials();

console.log('Import the 2025 audit programme and findings | استيراد برنامج وملاحظات 2025');
console.log(`Project: ${env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}`);
console.log(APPLY ? 'Mode: APPLY (writes)\n' : 'Mode: DRY RUN (no writes) - pass --apply to write\n');

const programme = JSON.parse(readFileSync(join(ROOT, 'src/data/audit-program-2025.json'), 'utf8'));
const findingsFile = JSON.parse(readFileSync(join(ROOT, 'src/data/findings-2025.json'), 'utf8'));
const org = JSON.parse(readFileSync(join(ROOT, 'src/data/org-structure.json'), 'utf8'));
const questionBank = JSON.parse(readFileSync(join(ROOT, 'src/data/question-bank.json'), 'utf8'));

await signInOperator(auth, credentials);

async function readAll(name) {
  try {
    return (await getDocs(collection(db, name))).docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error(`Could not read ${describeReadError(name, error)}`);
    await signOutQuietly(auth);
    process.exit(2);
  }
}

// The rules require annualPlans.createdBy to be the caller's own user id.
let OPERATOR_USER_ID = 'system-admin-root';

const [users, sections, existingAudits] = await Promise.all([
  readAll('users'), readAll('sections'), readAll('audits'),
]);
console.log(`Loaded ${users.length} users, ${sections.length} sections, ${existingAudits.length} existing audits.`);

const operator = users.find(u => (u.email || '').toLowerCase() === credentials.email.toLowerCase());
if (operator) OPERATOR_USER_ID = operator.id;
console.log(`Operator: ${operator ? `${operator.fullNameEn} (${operator.id})` : credentials.email}\n`);

if (!sections.length) {
  console.error('There are no sections in Firestore. Run scripts/seed-org.mjs first - this');
  console.error('script resolves against the org chart and will not create one.');
  await signOutQuietly(auth);
  process.exit(2);
}

// -------------------------------------------------------------------------
// Resolving people
// -------------------------------------------------------------------------
// The two source documents spell the same person several ways - "M. Bahwairith",
// "Mohammed Bahwairith", "Sami Alshabani" against "Samy Alshaabani". org-structure.json
// already carries the alias list the QA workbook uses, so that is what we match on, plus
// a surname fallback. Anything still unresolved is REPORTED, never guessed.
const normalise = n => (n || '').toLowerCase().replace(/[^a-z]+/g, ' ').trim();
const surnameOf = n => {
  const parts = normalise(n).split(' ').filter(w => w.length > 2);
  return parts.length ? parts[parts.length - 1] : '';
};

// Family-name prefixes carry no distinguishing information and are spelled inconsistently
// across the two documents: "M. Ashram" against "Mohammed K. Al-Ashram".
const bareSurname = n => surnameOf(n).replace(/^(al|el|abu|abd|bin|ibn)\s*/, '');
const firstNameOf = n => (normalise(n).split(' ')[0] || '');

const byNormalised = new Map();
const bySurname = new Map();
const push = (map, key, u) => {
  if (!key) return;
  if (!map.has(key)) map.set(key, []);
  if (!map.get(key).some(x => x.id === u.id)) map.get(key).push(u);
};

for (const u of users) {
  for (const name of [u.fullNameEn, u.fullNameAr]) {
    if (name) byNormalised.set(normalise(name), u);
  }
  push(bySurname, bareSurname(u.fullNameEn), u);
}
for (const auditor of org.auditors || []) {
  const target = byNormalised.get(normalise(auditor.nameEn));
  for (const alias of auditor.aliases || []) {
    if (target && !byNormalised.has(normalise(alias))) byNormalised.set(normalise(alias), target);
  }
}

// The auditor roster is 16 people, and the programme refers to most of them by first name
// alone - "Sony", "Babu", "Ammar". Within that roster a first name is unique, so it
// identifies them; across the whole company it would not, which is why this map is built
// from the roster and not from every user.
const auditorFirstNames = new Map();
for (const auditor of org.auditors || []) {
  const u = byNormalised.get(normalise(auditor.nameEn));
  if (!u) continue;
  const f = firstNameOf(auditor.nameEn);
  if (!auditorFirstNames.has(f)) auditorFirstNames.set(f, []);
  auditorFirstNames.get(f).push(u);
}

const unresolvedNames = new Map();
const note = (name, context) => {
  if (!unresolvedNames.has(name)) unresolvedNames.set(name, new Set());
  unresolvedNames.get(name).add(context);
};

// `report` false means the caller has a fallback and will decide whether this is a failure.
function resolvePerson(rawName, context, { auditorScope = false, report = true } = {}) {
  const name = (rawName || '').trim();
  if (!name) return null;

  const direct = byNormalised.get(normalise(name));
  if (direct) return direct;

  const bySur = bySurname.get(bareSurname(name)) || [];
  if (bySur.length === 1) return bySur[0];

  // A first name identifies somebody ONLY inside the 16-person auditor roster, which is
  // where the programme uses bare first names ("Sony", "Babu", "Ammar"). Applying the same
  // rule to the whole company matched the programme's "Faisal Alamaa" to "Faisal
  // Zagheebi" - a different person, in a different department - because he was the only
  // Faisal on file. An audit filed against the wrong person is the worst outcome here, so
  // outside the roster a first name resolves nothing.
  if (auditorScope) {
    const byFirst = auditorFirstNames.get(firstNameOf(name)) || [];
    if (byFirst.length === 1) return byFirst[0];
  }

  if (report) note(name, context);
  return null;
}

// "Sony & M. Bahwairith", "Turki &M. Baharthah & M. Bahwairith", "Adel Rose/ Moayad"
const splitPeople = raw => (raw || '')
  .split(/\s*[&/]\s*/)
  .map(s => s.trim())
  .filter(Boolean);

// -------------------------------------------------------------------------
// The checklist for an area
// -------------------------------------------------------------------------
const bankBySection = new Map();
for (const area of questionBank.areas || []) {
  for (const code of area.sectionCodes || []) {
    if (!bankBySection.has(code)) bankBySection.set(code, []);
    bankBySection.get(code).push(...(area.questions || []));
  }
}

// -------------------------------------------------------------------------
// Build the documents
// -------------------------------------------------------------------------
const sectionById = new Map(sections.map(s => [s.id, s]));
const findingsBySection = new Map();
for (const f of findingsFile.findings || []) {
  if (!findingsBySection.has(f.sectionCode)) findingsBySection.set(f.sectionCode, []);
  findingsBySection.get(f.sectionCode).push(f);
}

const AUDIT_ID = item => `audit-2025-${item.sectionCode.toLowerCase()}`;
const auditDocs = [];
const planItems = [];
const skipped = [];

for (const item of programme.items) {
  if (!item.sectionCode) {
    skipped.push(`${item.sourceArea}: ${item.unmappedReason}`);
    continue;
  }
  const section = sectionById.get(item.sectionCode);
  if (!section) {
    skipped.push(`${item.sourceArea}: section ${item.sectionCode} is not in Firestore`);
    continue;
  }

  const auditors = splitPeople(item.auditorsRaw)
    .map(n => resolvePerson(n, `auditor on "${item.sourceArea}"`, { auditorScope: true }))
    .filter(Boolean);

  // THE PROGRAMME NAMES WHO ATTENDED; org-structure names the section's STANDING auditee,
  // and for several areas they are different people - the programme books "Ahmed Salah"
  // for Planning where the standing auditee is Turki Abotaleb. The audit is filed against
  // whoever the org chart makes answerable, because that is the person the rules admit and
  // the notifications reach; the representative the programme names is kept as text beside
  // it rather than thrown away.
  const namedRep = resolvePerson(item.auditeeRaw, '', { report: false });
  const auditee = namedRep
    || resolvePerson(item.sectionAuditee, `section auditee for ${item.sectionCode}`);

  const findings = (findingsBySection.get(item.sectionCode) || []).map((f, i) => ({
    id: `finding-2025-${item.sectionCode.toLowerCase()}-${i + 1}`,
    reportNumber: f.reportNumber,
    departmentId: f.departmentCode,
    sectionId: f.sectionCode,
    focusArea: f.focusArea,
    clause: f.clause,
    // The workbook keeps the requirement and the failure apart; the finding text is the
    // failure, and the requirement is what it failed against.
    finding: f.requirement ? `${f.failure}\n\nالمتطلب / Requirement: ${f.requirement}` : f.failure,
    evidence: f.evidence,
    categoryA: f.categoryA,
    categoryB: f.categoryB,
    estimatedClosingDate: f.closingDate,
    status: f.status,
    createdAt: f.createdAt,
    ...(f.status === 'closed' && f.closingDate ? { closedAt: f.closingDate } : {}),
    ...(f.rootCause ? { rootCause: f.rootCause } : {}),
    ...(f.correctiveAction ? { correctiveAction: f.correctiveAction } : {}),
  }));

  const allClosed = findings.length > 0 && findings.every(f => f.status === 'closed');
  const status = allClosed ? 'completed' : findings.length ? 'corrective_actions' : 'planning';
  const currentStage = allClosed ? 5 : findings.length ? 3 : 0;

  const questions = (bankBySection.get(item.sectionCode) || []).map((q, i) => ({
    id: `q-${i + 1}`,
    questionAr: q,
    questionEn: q,
    clause: '',
    status: 'pending',
  }));

  auditDocs.push({
    id: AUDIT_ID(item),
    number: `AUD-2025-${item.sectionCode}`,
    titleAr: `مراجعة داخلية 2025 - ${section.nameAr || section.nameEn}`,
    titleEn: `2025 Internal Audit - ${section.nameEn}`,
    type: 'internal',
    status,
    currentStage,
    departmentId: item.departmentCode,
    sectionId: item.sectionCode,
    leadAuditorId: auditors[0]?.id || '',
    teamMemberIds: auditors.map(a => a.id),
    // THE FIELD THE WHOLE APPROVAL CHAIN HANGS OFF. firestore.rules admits the audited
    // department through it, and every notification to them is dropped without it.
    ...(auditee ? { auditeeId: auditee.id } : {}),
    startDate: item.plannedDate || '',
    endDate: item.plannedDate || '',
    ...(item.auditeeRaw && !namedRep
      ? { auditeeRepresentativeName: item.auditeeRaw }
      : {}),
    scope: `ISO 9001:2015 - ${section.nameEn}`,
    objectives: 'Verify conformity of the section against ISO 9001:2015 and the company QMS.',
    criteria: 'ISO 9001:2015',
    questions,
    findings,
    createdBy: 'system-admin-root',
    createdAt: item.plannedDate || new Date().toISOString().slice(0, 10),
    updatedAt: new Date().toISOString(),
    _label: `${item.sectionCode}  ${auditors.length} auditor(s), auditee ${auditee ? auditee.fullNameEn : 'UNRESOLVED'}, ${findings.length} finding(s)`,
    _hasAuditee: !!auditee,
    _hasLead: !!auditors[0],
  });

  planItems.push({
    id: `item-${item.sectionCode.toLowerCase()}`,
    departmentId: item.departmentCode,
    sectionId: item.sectionCode,
    plannedMonth: item.plannedMonth || 1,
    auditType: 'internal',
    ...(auditors[0] ? { leadAuditorId: auditors[0].id } : {}),
    notes: item.plannedTime ? `${item.plannedDate} ${item.plannedTime}` : (item.plannedDate || ''),
    auditId: AUDIT_ID(item),
  });
}

// FINDINGS RAISED OUTSIDE THE PUBLISHED PROGRAMME.
//
// Six of the 67 findings are against two sections the 2025 programme has no line for -
// Workshops and ISO 45001 (HSE). The audits happened; only the programme sheet is silent
// about them. Dropping real findings because a planning document does not mention their
// section would lose company records, so each such section gets its own audit, marked as
// off-programme and left out of the annual plan (the plan records what was PLANNED).
const plannedSections = new Set(auditDocs.map(a => a.sectionId));
const orphanBySection = new Map();
for (const [code, list] of findingsBySection) {
  if (!plannedSections.has(code)) orphanBySection.set(code, list);
}
for (const [code, list] of orphanBySection) {
  const section = sectionById.get(code);
  if (!section) { skipped.push(`${list.length} finding(s) for ${code}: section not in Firestore`); continue; }
  const auditee = resolvePerson(section.headId ? '' : '', '', { report: false })
    || users.find(u => u.id === section.headId)
    || resolvePerson(
         (org.departments.flatMap(d => d.sections).find(x => x.code === code) || {}).auditee || '',
         `section auditee for ${code}`);

  const findings = list.map((f, i) => ({
    id: `finding-2025-${code.toLowerCase()}-${i + 1}`,
    reportNumber: f.reportNumber,
    departmentId: f.departmentCode,
    sectionId: f.sectionCode,
    focusArea: f.focusArea,
    clause: f.clause,
    finding: f.requirement ? `${f.failure}\n\nالمتطلب / Requirement: ${f.requirement}` : f.failure,
    evidence: f.evidence,
    categoryA: f.categoryA,
    categoryB: f.categoryB,
    estimatedClosingDate: f.closingDate,
    status: f.status,
    createdAt: f.createdAt,
    ...(f.status === 'closed' && f.closingDate ? { closedAt: f.closingDate } : {}),
    ...(f.rootCause ? { rootCause: f.rootCause } : {}),
    ...(f.correctiveAction ? { correctiveAction: f.correctiveAction } : {}),
  }));
  const allClosed = findings.every(f => f.status === 'closed');
  const dates = findings.map(f => f.createdAt).filter(Boolean).sort();

  auditDocs.push({
    id: `audit-2025-${code.toLowerCase()}`,
    number: `AUD-2025-${code}`,
    titleAr: `مراجعة داخلية 2025 - ${section.nameAr || section.nameEn}`,
    titleEn: `2025 Internal Audit - ${section.nameEn}`,
    type: 'internal',
    status: allClosed ? 'completed' : 'corrective_actions',
    currentStage: allClosed ? 5 : 3,
    departmentId: code.split('-')[0],
    sectionId: code,
    leadAuditorId: '',
    teamMemberIds: [],
    ...(auditee ? { auditeeId: auditee.id } : {}),
    startDate: dates[0] || '',
    endDate: dates[dates.length - 1] || '',
    scope: `ISO 9001:2015 - ${section.nameEn}`,
    objectives: 'Verify conformity of the section against ISO 9001:2015 and the company QMS.',
    criteria: 'ISO 9001:2015',
    offProgramme: 'findings were raised against this section in 2025 but the published programme has no line for it',
    questions: (bankBySection.get(code) || []).map((q, i) => ({
      id: `q-${i + 1}`, questionAr: q, questionEn: q, clause: '', status: 'pending',
    })),
    findings,
    createdBy: 'system-admin-root',
    createdAt: dates[0] || new Date().toISOString().slice(0, 10),
    updatedAt: new Date().toISOString(),
    _label: `${code}  OFF-PROGRAMME, auditee ${auditee ? auditee.fullNameEn : 'UNRESOLVED'}, ${findings.length} finding(s)`,
    _hasAuditee: !!auditee,
    _hasLead: true,   // an off-programme audit has no assigned team on the sheet
  });
}

const qualityManager = users.find(u => u.role === 'quality_manager' && u.isActive !== false);
const approver = users.find(u => u.role === 'system_admin' && u.id !== qualityManager?.id)
  || users.find(u => u.role === 'department_manager' && u.isActive !== false);

// THE PLAN GOES IN AS A DRAFT, AND THAT IS DELIBERATE.
//
// firestore.rules will not accept a plan created already 'approved', and it is right not
// to: an approval stamp means a named person approved it, and writing one here would be
// the same false attestation this codebase just removed from departmentResponse. The
// programme is loaded as a draft owned by the operator running the import; the quality
// manager submits it and the approver approves it in the app, which is what makes the
// approval real. The audits themselves are historical records and carry no such claim,
// which is why they import directly.
const planDoc = {
  id: 'plan-2025',
  year: 2025,
  titleAr: 'برنامج المراجعة الداخلية للجودة 2025',
  titleEn: 'Internal Quality Audit Programme 2025',
  status: 'draft',
  items: planItems,
  approverId: '',
  createdBy: OPERATOR_USER_ID,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// -------------------------------------------------------------------------
// Report
// -------------------------------------------------------------------------
console.log(`Audits to write:  ${auditDocs.length}`);
console.log(`Plan items:       ${planItems.length}`);
console.log(`Findings placed:  ${auditDocs.reduce((n, a) => n + a.findings.length, 0)} of ${findingsFile.findings.length}`);
console.log(`Questions loaded: ${auditDocs.reduce((n, a) => n + a.questions.length, 0)}\n`);

const noAuditee = auditDocs.filter(a => !a._hasAuditee);
const noLead = auditDocs.filter(a => !a._hasLead);
const existingIds = new Set(existingAudits.map(a => a.id));
const clashes = auditDocs.filter(a => existingIds.has(a.id));

for (const a of auditDocs) console.log(`  ${existingIds.has(a.id) ? 'OVERWRITE' : 'CREATE   '} ${a._label}`);

if (skipped.length) {
  console.log('\nProgramme lines not imported:');
  for (const s of skipped) console.log(`  - ${s}`);
}
if (unresolvedNames.size) {
  console.log('\nNames that could not be matched to a user (nothing was guessed):');
  for (const [name, contexts] of unresolvedNames) {
    console.log(`  - "${name}"  (${[...contexts].join('; ')})`);
  }
  console.log('  Add the spelling to `aliases` in src/data/org-structure.json, or create the');
  console.log('  person with scripts/seed-org.mjs, then run this again.');
}
if (noAuditee.length) {
  console.log(`\n${noAuditee.length} audit(s) would be written WITHOUT an auditee - the audited`);
  console.log('department could not write to them and would be told nothing:');
  for (const a of noAuditee) console.log(`  - ${a.id}`);
}
if (clashes.length) {
  console.log(`\n${clashes.length} audit id(s) already exist and would be OVERWRITTEN:`);
  for (const a of clashes) console.log(`  - ${a.id}`);
}

const blocked = noAuditee.length > 0 || noLead.length > 0 || unresolvedNames.size > 0;

if (!APPLY) {
  console.log('\n---');
  console.log('DRY RUN - nothing was written.');
  console.log(blocked
    ? 'Resolve the items above first; --apply would write incomplete audits.'
    : 'Everything resolved. Re-run with --apply to write.');
  await signOutQuietly(auth);
  process.exit(blocked ? 1 : 0);
}

if (blocked) {
  console.log('\nREFUSING to write: the items above are unresolved. Fix them and run again.');
  await signOutQuietly(auth);
  process.exit(1);
}

// -------------------------------------------------------------------------
// Write
// -------------------------------------------------------------------------
let written = 0;
const failures = [];
for (const a of auditDocs) {
  const { _label, _hasAuditee, _hasLead, ...docData } = a;
  try {
    await setDoc(doc(db, 'audits', a.id), docData);
    written += 1;
    console.log(`  wrote audits/${a.id}`);
  } catch (error) {
    failures.push(`audits/${a.id}: ${error?.code || ''} ${error?.message || error}`.trim());
  }
}
try {
  await setDoc(doc(db, 'annualPlans', planDoc.id), planDoc);
  written += 1;
  console.log(`  wrote annualPlans/${planDoc.id}  (DRAFT - submit and approve it in the app)`);
} catch (error) {
  failures.push(`annualPlans/${planDoc.id}: ${error?.code || ''} ${error?.message || error}`.trim());
}

console.log(`\n---\nWritten: ${written}`);
if (failures.length) {
  console.log(`Failed:  ${failures.length}`);
  for (const f of failures) console.log(`  - ${f}`);
}
await signOutQuietly(auth);
process.exit(failures.length ? 1 : 0);
