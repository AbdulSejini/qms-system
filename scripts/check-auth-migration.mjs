/**
 * Read-only status report for the Firebase Auth migration.
 * تقرير للاطلاع فقط عن حالة ترحيل المستخدمين إلى Firebase Auth.
 *
 * Users are migrated lazily: the first time someone signs in with their legacy
 * password, the app creates their Firebase Auth account, writes the mapping
 * document authUsers/{authUid} = { userId, role, isActive } and stores authUid
 * back on their users/{id} document. Nothing is deleted, so the legacy
 * `passwords` documents survive until an operator removes them - and that step
 * is only safe once EVERY user has been through the new sign-in path.
 *
 * This script answers "are we there yet?". It never writes.
 *
 *   QMS_OPERATOR_EMAIL=admin@example.com QMS_OPERATOR_PASSWORD=... \
 *     node scripts/check-auth-migration.mjs
 *
 * Options:
 *   --ignore-inactive          do not let deactivated users hold the gate open
 *   --check-legacy-passwords   also read `passwords` to flag users who CANNOT
 *                              self-migrate (no password, or a plaintext one
 *                              shorter than the 6 characters Firebase Auth
 *                              requires). Values are never printed.
 *
 * Exit codes:
 *   0  every user is migrated - the migration window can be closed
 *   1  the check ran, but users are still unmigrated or half-migrated
 *   2  the check could not be completed (bad config, sign-in or read refused)
 */

import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import {
  EXIT_NOT_READY,
  loadEnv,
  initFirebase,
  parseFlags,
  readCredentials,
  signInOperator,
  signOutQuietly,
  fail,
  describeReadError,
} from './firebase-cli.mjs';

const flags = parseFlags();
const ignoreInactive = flags['ignore-inactive'] === true || flags['ignore-inactive'] === 'true';
const checkLegacyPasswords =
  flags['check-legacy-passwords'] === true || flags['check-legacy-passwords'] === 'true';

const env = loadEnv();
const { db, auth } = initFirebase(env);
const credentials = readCredentials(flags);

console.log('Auth migration status | حالة ترحيل تسجيل الدخول');
console.log(`Project: ${env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}\n`);

await signInOperator(auth, credentials);

// ===========================================
// Read (never write)
// ===========================================

async function readCollection(name) {
  try {
    return await getDocs(collection(db, name));
  } catch (error) {
    // A partial report is worse than no report - it would say "everyone is
    // migrated" simply because the read that would have proved otherwise failed.
    await signOutQuietly(auth);
    fail(describeReadError(name, error), 'The report was abandoned rather than shown incomplete.');
  }
}

const usersSnapshot = await readCollection('users');
const mappingSnapshot = await readCollection('authUsers');

const users = usersSnapshot.docs.map((d) => {
  const data = d.data();
  return {
    id: d.id,
    email: typeof data.email === 'string' ? data.email.trim() : '',
    role: data.role || '(no role)',
    isActive: data.isActive !== false,
    isSystemAccount: data.isSystemAccount === true,
    authUid: typeof data.authUid === 'string' && data.authUid ? data.authUid : null,
  };
});

// authUsers/{authUid} = { userId, role, isActive }
const mappings = mappingSnapshot.docs.map((d) => {
  const data = d.data();
  return {
    authUid: d.id,
    userId: typeof data.userId === 'string' ? data.userId : '',
    role: data.role || '(no role)',
    isActive: data.isActive !== false,
  };
});

const mappingByAuthUid = new Map(mappings.map((m) => [m.authUid, m]));
const mappingsByUserId = new Map();
for (const mapping of mappings) {
  const list = mappingsByUserId.get(mapping.userId) || [];
  list.push(mapping);
  mappingsByUserId.set(mapping.userId, list);
}

// ===========================================
// Classify
// ===========================================

const migrated = [];      // authUid on the user doc AND a matching mapping document
const halfMigrated = [];  // one side of the pair is missing - needs a fix, not a login
const unmigrated = [];    // has never signed in through the new path

for (const user of users) {
  const mapping = user.authUid ? mappingByAuthUid.get(user.authUid) : undefined;
  const backReferences = mappingsByUserId.get(user.id) || [];

  if (user.authUid && mapping && mapping.userId === user.id) {
    migrated.push(user);
  } else if (user.authUid && !mapping) {
    halfMigrated.push({ user, reason: `users/${user.id}.authUid is set but authUsers/${user.authUid} does not exist` });
  } else if (user.authUid && mapping && mapping.userId !== user.id) {
    halfMigrated.push({ user, reason: `authUsers/${user.authUid}.userId points at "${mapping.userId}", not "${user.id}"` });
  } else if (!user.authUid && backReferences.length > 0) {
    halfMigrated.push({ user, reason: `authUsers/${backReferences[0].authUid} maps to this user, but users/${user.id}.authUid is missing` });
  } else {
    unmigrated.push(user);
  }
}

// Mapping documents whose user no longer exists still grant a role in the
// Firestore rules, so they are worth naming even though they do not gate.
const userIds = new Set(users.map((u) => u.id));
const orphanMappings = mappings.filter((m) => !userIds.has(m.userId));

// The rules read the role from the mapping, so drift there means wrong
// permissions - not a migration blocker, but an operator has to fix it.
const drifted = [];
for (const user of migrated) {
  const mapping = mappingByAuthUid.get(user.authUid);
  if (mapping.role !== user.role) {
    drifted.push(`${user.email || user.id}: role is "${user.role}" on the user document but "${mapping.role}" in the mapping`);
  }
  if (mapping.isActive !== user.isActive) {
    drifted.push(`${user.email || user.id}: isActive is ${user.isActive} on the user document but ${mapping.isActive} in the mapping`);
  }
}

const noEmail = users.filter((u) => !u.email);

// ===========================================
// Optional: who CANNOT self-migrate
// ===========================================

const blocked = [];
if (checkLegacyPasswords && unmigrated.length) {
  for (const user of unmigrated) {
    let snapshot;
    try {
      snapshot = await getDoc(doc(db, 'passwords', user.id));
    } catch (error) {
      await signOutQuietly(auth);
      fail(
        describeReadError('passwords', error),
        'Re-run without --check-legacy-passwords to get the rest of the report.'
      );
    }

    const stored = snapshot.exists() ? snapshot.data().password : null;
    if (typeof stored !== 'string' || !stored) {
      blocked.push(`${user.email || user.id}: no legacy password stored - nothing to sign in with`);
      continue;
    }
    // Hashed values tell us nothing about length; only plaintext leftovers can
    // be measured. The value itself is never printed.
    if (!/^\$2[aby]\$/.test(stored) && stored.length < 6) {
      blocked.push(`${user.email || user.id}: legacy password is shorter than 6 characters - Firebase Auth will refuse it, an administrator must reset it`);
    }
  }
}

// ===========================================
// Report
// ===========================================

const activeUnmigrated = unmigrated.filter((u) => u.isActive);
const inactiveUnmigrated = unmigrated.filter((u) => !u.isActive);

console.log('Counts');
console.log(`  users documents          ${users.length}  (${users.filter((u) => u.isActive).length} active, ${users.filter((u) => !u.isActive).length} inactive)`);
console.log(`  with authUid             ${users.filter((u) => u.authUid).length}`);
console.log(`  authUsers mappings       ${mappings.length}`);
console.log(`  fully migrated           ${migrated.length}`);
console.log(`  half migrated            ${halfMigrated.length}`);
console.log(`  not migrated             ${unmigrated.length}  (${activeUnmigrated.length} active, ${inactiveUnmigrated.length} inactive)`);

function list(title, lines) {
  if (!lines.length) return;
  console.log(`\n${title}`);
  for (const line of lines) console.log(`  - ${line}`);
}

const describe = (u) =>
  `${u.email || '(no email)'}  [${u.id}]  role=${u.role}${u.isSystemAccount ? ' system-account' : ''}`;

list('Not migrated - active users (they must sign in once through the app)', activeUnmigrated.map(describe));
list('Not migrated - deactivated users (they will never sign in on their own)', inactiveUnmigrated.map(describe));
list('Half migrated - needs an operator fix, signing in again will not repair it', halfMigrated.map((h) => `${describe(h.user)}\n    ${h.reason}`));
list('Cannot self-migrate', blocked);
list('WARNING - role/status drift between users and authUsers (does not affect the exit code)', drifted);
list('WARNING - mapping documents with no matching user (does not affect the exit code)', orphanMappings.map((m) => `authUsers/${m.authUid} -> users/${m.userId} (missing) role=${m.role}`));
list('WARNING - user documents with no email, so they can never sign in (does not affect the exit code)', noEmail.map(describe));

if (!checkLegacyPasswords && unmigrated.length) {
  console.log('\nTip: add --check-legacy-passwords to find users whose stored password is too');
  console.log('     short for Firebase Auth and who therefore need an administrator reset.');
}

await signOutQuietly(auth);

// ===========================================
// Verdict
// ===========================================

const outstanding = halfMigrated.length + (ignoreInactive ? activeUnmigrated.length : unmigrated.length);

console.log('');
if (outstanding === 0) {
  const note = ignoreInactive && inactiveUnmigrated.length
    ? ` (${inactiveUnmigrated.length} deactivated user(s) ignored by --ignore-inactive)`
    : '';
  console.log(`READY - every user is migrated${note}.`);
  console.log('        الترحيل مكتمل. Deleting the legacy `passwords` documents is a separate,');
  console.log('        deliberate operator step - take a backup first.');
  process.exit(0);
}

console.log(`NOT READY - ${outstanding} user(s) still need attention.`);
console.log('            الترحيل غير مكتمل. Keep the legacy sign-in path enabled and do NOT');
console.log('            delete anything from the `passwords` collection.');
if (!ignoreInactive && inactiveUnmigrated.length && activeUnmigrated.length === 0 && halfMigrated.length === 0) {
  console.log('            Only deactivated users remain - re-run with --ignore-inactive if you');
  console.log('            have decided those accounts will never be migrated.');
}
process.exit(EXIT_NOT_READY);
