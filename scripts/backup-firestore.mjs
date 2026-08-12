/**
 * Read-only Firestore backup.
 * نسخة احتياطية للقراءة فقط من Firestore.
 *
 * Run this BEFORE any migration, and before any operator step that deletes
 * anything. It exports every readable collection the app uses into a timestamped
 * JSON file under backups/ (gitignored) so a bad migration can be reversed. It
 * never writes to Firestore. The one collection it cannot export is the dead
 * `passwords` store, which the rules deny to everybody - see COLLECTIONS below.
 *
 *   QMS_OPERATOR_EMAIL=admin@example.com QMS_OPERATOR_PASSWORD=... \
 *     node scripts/backup-firestore.mjs
 *
 * Uses the same NEXT_PUBLIC_FIREBASE_* values the app uses, read from
 * .env.local. Since the Firestore rules went live this script has to sign in
 * first - anonymous reads are refused - so it needs the credentials of an
 * account allowed to read everything (a system_admin). There is no
 * firebase-admin service account for this project, so it runs on the client SDK
 * and is bound by the same rules as the app.
 *
 * Exit codes:
 *   0  a complete backup was written
 *   1  the file was written but one or more collections failed - INCOMPLETE
 *   2  the backup could not be started (bad config, sign-in refused)
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { collection, getDocs } from 'firebase/firestore';
import {
  ROOT,
  loadEnv,
  initFirebase,
  readCredentials,
  signInOperator,
  signOutQuietly,
  describeReadError,
} from './firebase-cli.mjs';

// Every collection in src/lib/firestore.ts (COLLECTIONS) that can still be
// read, in the same order, plus the authUsers mapping that Firebase Auth
// sign-in depends on.
//
// `annualPlans` was missing from this list and is now included: the annual
// audit plan is real company data - a year of scheduled audits and an approval
// record - and a "complete" backup that silently skipped it was not a restore
// point for it.
//
// `passwords` is deliberately NOT here. The deployed rules deny every read of
// that collection to everybody (see firestore.rules), and this script runs on
// the client SDK under exactly those rules, so listing it could only ever
// produce a guaranteed failure, exit code 1, and an operator staring at an
// "INCOMPLETE" backup that is in fact complete. Nothing reads those documents
// any more; they are a dead legacy store, and SECURITY.md section 4.4 says what
// to do with them.
const COLLECTIONS = [
  'users',
  'departments',
  'sections',
  'audits',
  'annualPlans',
  'activeSessions',
  'notifications',
  'authUsers',
];

const env = loadEnv();
const { db, auth } = initFirebase(env);
const credentials = readCredentials();

console.log('Firestore backup | نسخة احتياطية');
console.log(`Project: ${env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}\n`);

await signInOperator(auth, credentials);

// Firestore Timestamps do not survive JSON.stringify - keep them recognisable.
function serialise(value) {
  if (value === null || value === undefined) return value ?? null;
  if (typeof value?.toDate === 'function') {
    return { __timestamp__: value.toDate().toISOString() };
  }
  if (Array.isArray(value)) return value.map(serialise);
  if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, serialise(v)]));
  }
  return value;
}

const backup = { projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, collections: {} };
let total = 0;

for (const name of COLLECTIONS) {
  try {
    const snapshot = await getDocs(collection(db, name));
    backup.collections[name] = snapshot.docs.map((d) => ({
      id: d.id,
      data: serialise(d.data()),
    }));
    total += snapshot.size;
    console.log(`  ${name.padEnd(16)} ${snapshot.size} documents`);
  } catch (error) {
    // Record the failure rather than silently producing a partial backup that
    // looks complete - restoring from one of those is how data gets lost.
    backup.collections[name] = { error: describeReadError(name, error) };
    console.error(`  ${name.padEnd(16)} FAILED: ${describeReadError(name, error)}`);
  }
}

const failed = Object.entries(backup.collections)
  .filter(([, v]) => !Array.isArray(v))
  .map(([k]) => k);

const dir = join(ROOT, 'backups');
mkdirSync(dir, { recursive: true });
// Colons are illegal in filenames on Windows and awkward everywhere else.
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const file = join(dir, `firestore-${stamp}.json`);
writeFileSync(file, JSON.stringify(backup, null, 2), 'utf8');

await signOutQuietly(auth);

console.log(`\n${total} documents written to ${file}`);
if (failed.length) {
  console.error(`INCOMPLETE - these collections failed: ${failed.join(', ')}`);
  console.error('Do NOT treat this file as a restore point.');
  process.exit(1);
}
process.exit(0);
