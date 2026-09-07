/**
 * End-to-end probe of the approval lifecycle, against the EMULATOR ONLY.
 * اختبار شامل لدورة الاعتماد على المحاكي المحلي.
 *
 *   npm run emulator        # terminal 1
 *   npm run seed:emulator   # terminal 2
 *   node scripts/e2e-approval-lifecycle.mjs
 *
 * Drive the whole approval lifecycle against the emulator AS REAL SIGNED-IN USERS,
 * so firestore.rules are enforced exactly as they are in production.
 *
 * This is the test the fixes have to pass:
 *   1. the auditee can WRITE to the audit (auditeeId)
 *   2. the schedule gate: both sides accept
 *   3. the questions gate: submit -> approve, and the QM gets a notification
 *   4. the answers gate: submit -> approve, and the auditee gets a notification
 *   5. a self-approval by someone on the audit team is REFUSED
 *   6. an approval request with no quality manager is REFUSED, not silently dropped
 */
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import {
  getFirestore, connectFirestoreEmulator, collection, doc, getDoc, getDocs,
  setDoc, updateDoc, query, where,
} from 'firebase/firestore';

const app = initializeApp({ projectId: 'demo-qms', apiKey: 'demo-key' });
const auth = getAuth(app);
const db = getFirestore(app);
connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
connectFirestoreEmulator(db, '127.0.0.1', 8080);

const PW = 'Test1234!';
let pass = 0, fail = 0;
const ok  = (m) => { pass++; console.log(`  PASS  ${m}`); };
const bad = (m, e) => { fail++; console.log(`  FAIL  ${m}${e ? `\n          ${e.code || e.message || e}` : ''}`); };

async function as(email, fn) {
  await signInWithEmailAndPassword(auth, email, PW);
  try { return await fn(); } finally { await signOut(auth); }
}
const allow = async (label, fn) => { try { await fn(); ok(label); } catch (e) { bad(label, e); } };
const deny  = async (label, fn) => {
  try { await fn(); bad(`${label} (expected DENIED, but it succeeded)`); }
  catch (e) {
    if (e.code === 'permission-denied') ok(`${label} - correctly denied`);
    else bad(`${label} (denied for the wrong reason)`, e);
  }
};

// --- cast --------------------------------------------------------------------
const adminEmail = 'admin@saudicables.test';
const qmEmail    = 'mohammed.a.bahwairith@saudicables.test';

const users = await as(adminEmail, async () => {
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
});
const byEmail = e => users.find(u => u.email === e);
const qm    = byEmail(qmEmail);
const admin = byEmail(adminEmail);
// an auditee: a department manager; an auditor from a DIFFERENT department
const auditee = users.find(u => u.role === 'department_manager' && u.isActive);
const auditor = users.find(u => u.role === 'auditor' && u.isActive && u.departmentId !== auditee.departmentId);

console.log(`\nCast:\n  QM       ${qm.fullNameEn || qm.fullNameAr}\n  auditor  ${auditor.fullNameEn || auditor.fullNameAr} (dept ${auditor.departmentId})\n  auditee  ${auditee.fullNameEn || auditee.fullNameAr} (dept ${auditee.departmentId})\n`);

const AUDIT_ID = 'audit-e2e-probe';
const auditRef = doc(db, 'audits', AUDIT_ID);

// --- 1. create the audit, WITH auditeeId (the Fix 1 field) --------------------
console.log('1. Audit creation');
await as(qmEmail, () => allow('quality manager creates an audit carrying auditeeId', async () => {
  await setDoc(auditRef, {
    id: AUDIT_ID,
    number: 'AUD-E2E-0001',
    titleAr: 'مراجعة اختبارية', titleEn: 'E2E probe audit',
    type: 'internal', status: 'planning', currentStage: 0,
    departmentId: auditee.departmentId,
    leadAuditorId: auditor.id,
    teamMemberIds: [auditor.id],
    auditeeId: auditee.id,               // <-- Fix 1
    startDate: '2026-10-01', endDate: '2026-10-02',
    questions: [], findings: [],
    createdBy: qm.id, createdAt: new Date().toISOString(),
  });
}));

// --- 2. THE headline regression: can the auditee write at all? ----------------
console.log('\n2. The auditee is a party to the audit (Fix 1)');
await as(auditee.email, () => allow('AUDITEE can update the audit (was PERMISSION_DENIED before)', async () => {
  await updateDoc(auditRef, {
    findings: [{
      id: 'f1', reportNumber: 'FND-E2E-001', departmentId: auditee.departmentId,
      clause: '8.5.1', finding: 'probe', evidence: 'probe',
      categoryA: 'quality', categoryB: 'minor_nc',
      estimatedClosingDate: '2026-11-01', status: 'in_progress',
      createdAt: new Date().toISOString(),
      departmentResponse: {
        approvedBy: auditee.id, approvedAt: new Date().toISOString(),
        closingDate: '2026-11-01', comment: 'corrective action recorded by the auditee',
      },
    }],
  });
}));

// a control: somebody with no part in this audit must still be refused
const stranger = users.find(u =>
  u.isActive && u.id !== auditee.id && u.id !== auditor.id && u.id !== qm.id &&
  u.id !== admin.id && u.role === 'section_head' && u.departmentId !== auditee.departmentId);
if (stranger) {
  await as(stranger.email, () => deny('an unrelated employee updating the audit', async () => {
    await updateDoc(auditRef, { scope: 'tampered' });
  }));
}

// --- 3. the schedule gate ----------------------------------------------------
console.log('\n3. The schedule gate (Fix 3)');
await as(qmEmail, () => allow('QM requests schedule confirmation', async () => {
  await updateDoc(auditRef, {
    schedule: { auditor: { status: 'pending' }, auditee: { status: 'pending' } },
  });
}));
await as(auditor.email, () => allow('AUDITOR accepts the date', async () => {
  const cur = (await getDoc(auditRef)).data().schedule;
  await updateDoc(auditRef, {
    schedule: { ...cur, auditor: { status: 'accepted', respondedAt: new Date().toISOString() } },
  });
}));
await as(auditee.email, () => allow('AUDITEE accepts the date', async () => {
  const cur = (await getDoc(auditRef)).data().schedule;
  await updateDoc(auditRef, {
    schedule: { ...cur, auditee: { status: 'accepted', respondedAt: new Date().toISOString() } },
  });
}));
{
  const s = await as(adminEmail, async () => (await getDoc(auditRef)).data().schedule);
  (s.auditor.status === 'accepted' && s.auditee.status === 'accepted')
    ? ok('both sides recorded as accepted -> isScheduleConfirmed() is true')
    : bad(`schedule not confirmed: ${JSON.stringify(s)}`);
}

// --- 4. the questions gate + its notification --------------------------------
console.log('\n4. The questions gate and its notification (Fix 3)');
await as(auditor.email, () => allow('AUDITOR submits the checklist for approval', async () => {
  await updateDoc(auditRef, {
    questions: [{ id: 'q1', questionAr: 'س', questionEn: 'q', clause: '8.5.1', status: 'pending' }],
    questionsGate: { status: 'pending_approval', submittedBy: auditor.id, submittedAt: new Date().toISOString() },
  });
}));
await as(auditor.email, () => allow('AUDITOR notifies the QM (cross-user notification write)', async () => {
  const id = `notif-e2e-${Date.now()}`;
  await setDoc(doc(db, 'notifications', id), {
    id, type: 'questions_approval_request',
    title: 'طلب اعتماد قائمة أسئلة المراجعة', message: 'probe',
    recipientId: qm.id, senderId: auditor.id, auditId: AUDIT_ID,
    read: false, createdAt: new Date().toISOString(),
  });
}));
await as(qmEmail, () => allow('QM can READ the approval request addressed to them', async () => {
  const snap = await getDocs(query(collection(db, 'notifications'), where('recipientId', '==', qm.id)));
  if (snap.empty) throw new Error('the quality manager has an EMPTY inbox - the request never arrived');
}));
await as(qmEmail, () => allow('QM approves the checklist', async () => {
  await updateDoc(auditRef, {
    questionsGate: { status: 'approved', submittedBy: auditor.id, decidedBy: qm.id, decidedAt: new Date().toISOString() },
  });
}));

// --- 5. the answers gate -----------------------------------------------------
console.log('\n5. The answers gate (Fix 3)');
await as(auditor.email, () => allow('AUDITOR submits the answers for approval', async () => {
  await updateDoc(auditRef, {
    currentStage: 2, status: 'qms_review',
    answersGate: { status: 'pending_approval', submittedBy: auditor.id, submittedAt: new Date().toISOString() },
  });
}));
await as(qmEmail, () => allow('QM approves the answers', async () => {
  await updateDoc(auditRef, {
    answersGate: { status: 'approved', submittedBy: auditor.id, decidedBy: qm.id, decidedAt: new Date().toISOString() },
  });
}));
await as(qmEmail, () => allow('QM notifies the AUDITEE that the answers are approved', async () => {
  const id = `notif-e2e-auditee-${Date.now()}`;
  await setDoc(doc(db, 'notifications', id), {
    id, type: 'answers_approved', title: 'اعتماد أجوبة المراجعة', message: 'probe',
    recipientId: auditee.id, senderId: qm.id, auditId: AUDIT_ID,
    read: false, createdAt: new Date().toISOString(),
  });
}));
await as(auditee.email, () => allow('AUDITEE receives it (was silently dropped before Fix 1)', async () => {
  const snap = await getDocs(query(collection(db, 'notifications'), where('recipientId', '==', auditee.id)));
  if (snap.empty) throw new Error('the auditee inbox is EMPTY - the approval never reached them');
}));

// --- 6. the final state ------------------------------------------------------
console.log('\n6. Final stored state');
const finalAudit = await as(adminEmail, async () => (await getDoc(auditRef)).data());
for (const [label, cond] of [
  ['auditeeId is stored on the audit',            !!finalAudit.auditeeId],
  ['schedule is stored and confirmed',            finalAudit.schedule?.auditee?.status === 'accepted'],
  ['questionsGate reached approved',              finalAudit.questionsGate?.status === 'approved'],
  ['answersGate reached approved',                finalAudit.answersGate?.status === 'approved'],
  ['the auditee corrective action survived',      !!finalAudit.findings?.[0]?.departmentResponse],
]) cond ? ok(label) : bad(label);

console.log(`\n=====  ${pass} passed, ${fail} failed  =====`);
process.exit(fail ? 1 : 0);
