/**
 * Seed the LOCAL FIREBASE EMULATOR with the real organisational structure plus
 * sign-in accounts, so the full audit lifecycle can be walked end to end.
 * تعبئة محاكي Firebase المحلي بالهيكل التنظيمي الحقيقي وحسابات دخول للاختبار.
 *
 *   npm run emulator          # in another terminal, first
 *   npm run seed:emulator
 *
 * THIS SCRIPT CAN NEVER TOUCH THE LIVE PROJECT.
 * It refuses to start unless FIRESTORE_EMULATOR_HOST is set AND the project id
 * begins with "demo-", which is a project id Google guarantees cannot exist.
 * firebase-admin bypasses security rules, which is exactly why that guard is not
 * optional: this is the one script in the repo that rules would not stop.
 *
 * Everybody gets the SAME well-known password. That is safe here and only here -
 * an emulator holds no real data and is not reachable from another machine.
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { readFileSync } from 'node:fs';

const PROJECT_ID = process.env.GCLOUD_PROJECT || 'demo-qms';
const TEST_PASSWORD = 'Test1234!';

// ---- the guard ------------------------------------------------------------
if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error('REFUSING: FIRESTORE_EMULATOR_HOST is not set. This script only ever seeds an emulator.');
  process.exit(1);
}
if (!PROJECT_ID.startsWith('demo-')) {
  console.error(`REFUSING: project id "${PROJECT_ID}" is not a demo- project.`);
  process.exit(1);
}

initializeApp({ projectId: PROJECT_ID });
const db = getFirestore();
const auth = getAuth();

const org = JSON.parse(readFileSync(new URL('../src/data/org-structure.json', import.meta.url), 'utf8'));

// ---- helpers --------------------------------------------------------------
const norm = (n) => n.toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();
const slug = (n) => 'user-' + norm(n).replace(/\s+/g, '-');
const email = (n) => norm(n).replace(/\s+/g, '.') + '@saudicables.test';

const QUALITY_MANAGER = 'mohammed a bahwairith';

// ---- build the cast -------------------------------------------------------
/** @type {Map<string, any>} */
const people = new Map();

const upsert = (nameEn, nameAr, position, role) => {
  const key = norm(nameEn);
  const existing = people.get(key);
  if (existing) {
    // The auditor role wins over department_manager, matching scripts/seed-org.mjs.
    const rank = { employee: 0, section_head: 1, department_manager: 2, auditor: 3, quality_manager: 4, system_admin: 5 };
    if (rank[role] > rank[existing.role]) existing.role = role;
    return existing;
  }
  const person = {
    id: slug(nameEn),
    employeeNumber: '',            // filled below, once the cast is complete
    fullNameEn: nameEn,
    fullNameAr: nameAr || nameEn,
    email: email(nameEn),
    jobTitleEn: position || '',
    jobTitleAr: position || '',
    role,
    isActive: true,
    // canBeAuditor is a SEPARATE flag from the role - src/app/plans/page.tsx filters the
    // lead-auditor dropdown on it, not on role, so an auditor without it is invisible.
    canBeAuditor: false,
    auditableDepartmentIds: [],
    auditableSectionIds: [],
    departmentIds: [],             // internal accumulator -> departmentId below
    sectionIds: [],                // internal accumulator -> sectionId below
  };
  people.set(key, person);
  return person;
};

// auditors roster -> auditor, except the QMS Lead Auditor who is the quality manager
for (const a of org.auditors) {
  upsert(a.nameEn, a.nameAr, a.positionEn, norm(a.nameEn) === QUALITY_MANAGER ? 'quality_manager' : 'auditor');
}

// departments + sections
const departments = [];
const sections = [];
for (const dept of org.departments) {
  departments.push({ id: dept.code, code: dept.code, nameEn: dept.nameEn, nameAr: dept.nameAr, isActive: true });
  for (const sec of dept.sections || []) {
    sections.push({
      id: sec.code, code: sec.code, departmentId: dept.code,
      nameEn: sec.nameEn, nameAr: sec.nameAr, isActive: true,
    });
    if (sec.departmentHead) {
      const p = upsert(sec.departmentHead, null, 'Department Head', 'department_manager');
      if (!p.departmentIds.includes(dept.code)) p.departmentIds.push(dept.code);
    }
    if (sec.auditee) {
      const p = upsert(sec.auditee, null, 'Section Auditee', 'section_head');
      if (!p.sectionIds.includes(sec.code)) p.sectionIds.push(sec.code);
      if (!p.departmentIds.includes(dept.code)) p.departmentIds.push(dept.code);
    }
  }
}

// the system administrator - the id the rules hard-code
people.set('system admin', {
  id: 'system-admin-root',
  fullNameEn: 'System Administrator', fullNameAr: 'مدير النظام',
  email: 'admin@saudicables.test', jobTitleEn: 'System Administrator', jobTitleAr: 'مدير النظام',
  role: 'system_admin', isActive: true, isSystemAccount: true, employeeNumber: 'SYS-0001',
  canBeAuditor: false, auditableDepartmentIds: [], auditableSectionIds: [],
  departmentIds: [], sectionIds: [],
});

// an EXTERNAL AUDITOR - read-only certification body reviewer
people.set('external auditor', {
  id: 'user-external-auditor',
  fullNameEn: 'External Certification Auditor', fullNameAr: 'مراجع خارجي معتمد',
  email: 'external.auditor@certbody.test',
  jobTitleEn: 'Lead Assessor, Certification Body', jobTitleAr: 'مقيّم رئيسي، جهة المنح',
  role: 'external_auditor', isActive: true, employeeNumber: 'EXT-0001',
  canBeAuditor: false, auditableDepartmentIds: [], auditableSectionIds: [],
  departmentIds: [], sectionIds: [],
});

// ---- derive the fields the app actually reads ------------------------------
// The User type (src/types/index.ts) carries ONE primary department, plus explicit
// auditing rights. An auditor is never given rights over their own department: auditing
// your own area is the thing an internal audit programme exists to prevent.
const allDeptCodes = departments.map(d => d.id);
let seq = 0;
for (const p of people.values()) {
  p.departmentId = p.departmentIds[0] || '';
  if (p.sectionIds[0]) p.sectionId = p.sectionIds[0];
  if (!p.employeeNumber) p.employeeNumber = `EMP-${String(++seq).padStart(4, '0')}`;

  if (p.role === 'auditor' || p.role === 'quality_manager') {
    p.canBeAuditor = true;
    p.auditableDepartmentIds = allDeptCodes.filter(c => !p.departmentIds.includes(c));
  }

  delete p.departmentIds;
  delete p.sectionIds;
}

// ---- write ----------------------------------------------------------------
const now = new Date().toISOString();
let batch = db.batch();
let ops = 0;
const flush = async () => { if (ops) { await batch.commit(); batch = db.batch(); ops = 0; } };
const put = async (col, id, data) => {
  batch.set(db.collection(col).doc(id), data, { merge: true });
  if (++ops >= 400) await flush();
};

for (const d of departments) await put('departments', d.id, { ...d, createdAt: now, updatedAt: now });
for (const s of sections)    await put('sections',    s.id, { ...s, createdAt: now, updatedAt: now });
await flush();

let created = 0;
for (const p of people.values()) {
  // Auth account first: the mapping is worthless without the uid it keys on.
  let uid;
  try {
    uid = (await auth.createUser({ email: p.email, password: TEST_PASSWORD, displayName: p.fullNameEn })).uid;
    created++;
  } catch (e) {
    if (e.code === 'auth/email-already-exists') uid = (await auth.getUserByEmail(p.email)).uid;
    else throw e;
  }
  await put('users', p.id, { ...p, authUid: uid, createdAt: now, updatedAt: now });
  // authUsers/{uid} is the ONLY thing that grants authority - see firestore.rules
  await put('authUsers', uid, { userId: p.id, role: p.role, isActive: true });
}
await flush();

// ---- report ---------------------------------------------------------------
const byRole = {};
for (const p of people.values()) (byRole[p.role] ??= []).push(p);

console.log(`\nSeeded emulator "${PROJECT_ID}"`);
console.log(`  departments ${departments.length}   sections ${sections.length}   users ${people.size}   new auth accounts ${created}`);
console.log(`  password for every account: ${TEST_PASSWORD}\n`);
for (const role of Object.keys(byRole).sort()) {
  console.log(`  ${role} (${byRole[role].length})`);
  for (const p of byRole[role].slice(0, 4)) console.log(`      ${p.email.padEnd(42)} ${p.fullNameAr}`);
  if (byRole[role].length > 4) console.log(`      ... +${byRole[role].length - 4}`);
}
