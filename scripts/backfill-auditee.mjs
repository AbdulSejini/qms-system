/**
 * Backfill `auditeeId` onto every existing audit.
 * تعبئة حقل الجهة المُراجَع عليها للمراجعات القائمة.
 *
 * WHY THIS EXISTS. `auditeeId` was declared on the Audit type and read by
 * firestore.rules, but no code path ever wrote it. Two things followed:
 *
 *   1. firestore.rules `belongsToAudit()` admits the audited department through
 *      `uid == resource.data.get('auditeeId', '')`. With the field absent that
 *      compares against '', which never matches a real user id, so the audited
 *      department's manager was DENIED every write on the audit - their
 *      corrective action, their response to a finding, their extension request.
 *      The audit screen discarded the denial and painted success, so the loss
 *      was invisible until a reload.
 *   2. Every notification addressed to the auditee was dropped: notify() in
 *      src/lib/audit-workflow.ts returns early on an undefined recipient.
 *
 * New audits now set it at creation (src/app/audits/new/page.tsx) and re-derive
 * it whenever the department or section changes (the audit detail page's edit
 * form). This script closes the gap for everything created before that.
 *
 *   QMS_OPERATOR_EMAIL=admin@example.com QMS_OPERATOR_PASSWORD=... \
 *     node scripts/backfill-auditee.mjs [--apply]
 *
 * Runs as a DRY RUN by default and prints exactly what it would change. Pass
 * --apply to write. Take a backup first:
 *
 *   node scripts/backup-firestore.mjs
 *
 * Like every script here it runs on the client SDK under the deployed rules, so
 * it needs a system_admin operator account.
 *
 * Exit codes:
 *   0  finished; every audit either was already correct or was updated
 *   1  finished, but one or more audits could not be resolved or written
 *   2  could not start (bad config, sign-in refused, collection unreadable)
 */

import { collection, doc, getDocs, updateDoc } from 'firebase/firestore';
import {
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

console.log('Backfill auditeeId | تعبئة الجهة المُراجَع عليها');
console.log(`Project: ${env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}`);
console.log(APPLY ? 'Mode: APPLY (writes)\n' : 'Mode: DRY RUN (no writes) - pass --apply to write\n');

await signInOperator(auth, credentials);

async function readAll(name) {
  try {
    const snapshot = await getDocs(collection(db, name));
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error(`Could not read ${describeReadError(name, error)}`);
    await signOutQuietly(auth);
    process.exit(2);
  }
}

const [audits, departments, sections, users] = await Promise.all([
  readAll('audits'),
  readAll('departments'),
  readAll('sections'),
  readAll('users'),
]);

console.log(
  `Loaded ${audits.length} audits, ${departments.length} departments, ` +
  `${sections.length} sections, ${users.length} users.\n`
);

// The same rule as resolveAuditeeId in src/lib/audit-workflow.ts: the head of the
// narrowest scoped unit - the section head when the audit is scoped to a section,
// the department manager otherwise - each with a role-based fallback, because
// headId/managerId are optional and a gap in the org chart must not silently
// produce an audit with no auditee.
function resolveAuditeeId(scope) {
  if (!scope.departmentId) return undefined;

  const isUsable = id => !!id && users.some(u => u.id === id && u.isActive);

  if (scope.sectionId) {
    const section = sections.find(s => s.id === scope.sectionId);
    if (isUsable(section?.headId)) return section.headId;

    const head = users.find(
      u => u.isActive && u.role === 'section_head' && u.sectionId === scope.sectionId
    );
    if (head) return head.id;
  }

  const department = departments.find(d => d.id === scope.departmentId);
  if (isUsable(department?.managerId)) return department.managerId;

  const manager = users.find(
    u => u.isActive && u.role === 'department_manager' && u.departmentId === scope.departmentId
  );
  return manager?.id;
}

const nameOf = id => {
  const u = users.find(x => x.id === id);
  return u ? `${u.fullNameAr || u.fullNameEn} <${u.email}>` : id;
};

let alreadySet = 0;
let resolved = 0;
let unresolved = 0;
let written = 0;
let failed = 0;

for (const audit of audits) {
  const label = `${audit.number || audit.id} "${audit.titleAr || audit.titleEn || ''}"`;

  if (audit.auditeeId) {
    alreadySet++;
    continue;
  }

  const auditeeId = resolveAuditeeId({
    departmentId: audit.departmentId,
    sectionId: audit.sectionId,
  });

  if (!auditeeId) {
    unresolved++;
    console.log(
      `  UNRESOLVED  ${label}\n` +
      `              department=${audit.departmentId || '(none)'} section=${audit.sectionId || '(none)'}\n` +
      `              No active section head or department manager. Assign one in the\n` +
      `              Departments screen, then re-run.`
    );
    continue;
  }

  resolved++;
  console.log(`  SET         ${label}\n              auditee -> ${nameOf(auditeeId)}`);

  if (!APPLY) continue;

  try {
    await updateDoc(doc(db, 'audits', audit.id), {
      auditeeId,
      updatedAt: new Date().toISOString(),
    });
    written++;
  } catch (error) {
    failed++;
    console.error(`              WRITE FAILED: ${describeReadError('audits', error)}`);
  }
}

console.log('\n---');
console.log(`Already set: ${alreadySet}`);
console.log(`Resolvable:  ${resolved}`);
console.log(`Unresolved:  ${unresolved}`);
if (APPLY) {
  console.log(`Written:     ${written}`);
  console.log(`Failed:      ${failed}`);
} else if (resolved > 0) {
  console.log('\nNothing was written. Re-run with --apply to write these changes.');
}

await signOutQuietly(auth);
process.exit(unresolved > 0 || failed > 0 ? 1 : 0);
