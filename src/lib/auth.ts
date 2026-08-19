// Authentication service - Firebase Auth on top of the existing Firestore user data
//
// HOW AN ACCOUNT COMES INTO EXISTENCE
// The system predates Firebase Auth: users lived only in the `users` collection and their
// credentials in the `passwords` collection (bcrypt hashes, some legacy plaintext).
// Firestore user ids ('system-admin-root', 'user-1739...') are referenced across every
// audit, finding and notification, so they are NOT renumbered. The link between the two
// worlds is `authUsers/{authUid} = { userId, role, isActive }` (plus an `authUid` field on
// the user document so the mapping reads both ways). Firestore rules resolve a caller's
// role with a single get() on that known path.
//
// Sign-in itself no longer creates anything. An existing employee is onboarded by an
// ADMINISTRATOR from the Users page (createSignInAccountForUser below): the admin is
// already authenticated, so the mapping write is made by a caller the rules trust and no
// unauthenticated read of `users` or `passwords` is needed anywhere. The self-service
// migration that used to run inside signIn required exactly those anonymous reads, which
// the hardened rules deny, so it could only ever fail - and it reported the denial as a
// wrong password. It is gone.
//
// ONBOARDING IS A SPOKEN ACCESS CODE, NOT AN EMAIL
// This installation has no working email service, so a password-setup email cannot be the
// way anybody gets in. createSignInAccountForUser therefore creates the Auth account with
// a one-time ACCESS CODE (generateAccessCode) as its password, returns that code to the
// caller so the Users page can show it to the administrator ONCE, and sets
// mustChangePassword on the user document. The code is never stored anywhere - not here,
// not in Firestore - and no mail is sent.
//
// The flag is what makes the code single-use in practice: checkPendingPasswordChange below
// refuses to let the login page open an application session while it is set, so an employee
// holding a code can do exactly one thing with it - hand it back in exchange for a password
// of their own (setPasswordWithAccessCode). Note the order that gate implies: the check runs
// on the SECONDARY Firebase app instance, so a user who still owes a password change never
// becomes the primary session at all. Gating after a real sign-in would race the
// AuthContext listener, which navigates the moment it resolves a session.
//
// THE ONE EXCEPTION IS THE FIRST ACCOUNT
// An administrator has to exist before an administrator can onboard anybody, so
// bootstrapSystemAdmin below writes the very first mapping as the account it has just
// created. The rules allow that single self-claim only while users/system-admin-root
// carries no authUid, and the bootstrap's last act is to write that authUid - the door
// closes behind it, permanently. See the comment on the function for why the order of its
// three writes is not negotiable.
//
// THE `passwords` COLLECTION IS INERT
// Nothing in this module reads or writes it any more. It is left in the database
// untouched as a pre-migration rollback record; the operator documentation states when it
// may be dropped. It is no longer a way into the system: authorization comes only from
// authUsers/{authUid}, which the user it describes can never create or modify.

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updatePassword,
  reauthenticateWithCredential,
  deleteUser as deleteAuthAccount,
  EmailAuthProvider,
  getAuth,
  type User as FirebaseAuthUser,
} from 'firebase/auth';
import { initializeApp, getApps } from 'firebase/app';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  getFirestore,
  Timestamp,
  type Firestore,
} from 'firebase/firestore';
import { auth, db, firebaseConfig, connectEmulators } from './firebase';
import { generateAccessCode, setMustChangePassword } from './firestore';
import { recordActivity } from './activity-log';
import { getRoleNameAr, getRoleNameEn } from '@/data/mock-data';
import { logger } from './logger';
import { ActivityEntry, User, UserRole } from '@/types';

// ===========================================
// Collection Names
// ===========================================
const COLLECTIONS = {
  USERS: 'users',
  AUTH_USERS: 'authUsers',
};

// Firebase Auth refuses to create an account with a shorter password. Used by
// changeOwnPassword and by the password forms in the UI.
export const MIN_PASSWORD_LENGTH = 6;

// createUserWithEmailAndPassword signs in as the new account on whichever app instance it
// is called on, which would silently replace the administrator's own session. Everything
// that creates an account therefore does it on a secondary instance and signs that
// instance out afterwards. The instance is reused rather than re-initialized.
const SECONDARY_APP_NAME = 'userCreation';

const getSecondaryApp = () => {
  const existingApp = getApps().find((app) => app.name === SECONDARY_APP_NAME);
  return existingApp ?? initializeApp(firebaseConfig, SECONDARY_APP_NAME);
};

const getSecondaryAuth = () => {
  const secondary = getSecondaryApp();
  // The secondary instance needs the same routing as the primary one, or onboarding a
  // test employee under emulator mode would create a real account in the live project.
  connectEmulators(getAuth(secondary), getFirestore(secondary));
  return getAuth(secondary);
};

// Firestore bound to the SECONDARY app, so its writes are made as whoever is signed in
// on that instance rather than as the primary session. Only the first-run bootstrap
// needs it: there, the account that has just been created is the only caller the rules
// will accept, and it exists on the secondary instance alone.
const getSecondaryDb = (): Firestore => getFirestore(getSecondaryApp());

// The authUsers mapping document: Firestore rules read `role` from it with a single
// get(/databases/$(database)/documents/authUsers/$(request.auth.uid))
interface AuthUserMapping {
  userId: string;
  role: UserRole;
  isActive: boolean;
}

// ===========================================
// Result Types
// ===========================================

// Every branch returns one of these - expected failures (wrong password, disabled
// account) never throw. `message` is an English diagnostic only; the UI maps `reason`
// to its own bilingual text.
//
// The reasons, and what the UI is expected to do with each:
//   invalid_credentials  wrong email or password, or no Auth account for this email -
//                        retry, and if it persists ask an administrator to create the
//                        sign-in account
//   inactive             the user document or its mapping is disabled - contact the
//                        quality department
//   not_linked           authenticated, but no authUsers mapping exists for this account,
//                        so every Firestore rule would deny this session - an
//                        administrator has to create it from the Users page
//   service_unavailable  authenticated, but the mapping could not be READ (offline, rules
//                        or Firestore failure). Nothing is wrong with the account; the
//                        session is left alone and the answer is "try again"
//   auth_not_enabled     Email/Password sign-in is off in the Firebase project
//   auth_not_configured  the Firebase config does not resolve to an Auth setup
//   too_many_requests    Auth is rate-limiting this client
//   network_error        the browser could not reach Firebase
//   error                anything else, logged with its code
//
// password_too_short, weak_new_password and account_exists are no longer produced by
// signIn - they belonged to the removed legacy-migration path - but remain in the union
// because the password forms still speak in these terms.
export type SignInReason =
  | 'invalid_credentials'
  | 'inactive'
  | 'password_too_short'
  | 'weak_new_password'
  | 'account_exists'
  | 'not_linked'
  | 'service_unavailable'
  | 'auth_not_enabled'
  | 'auth_not_configured'
  | 'too_many_requests'
  | 'network_error'
  | 'error';

export type SignInResult =
  | { ok: true; user: User; migrated: boolean }
  | { ok: false; reason: SignInReason; message?: string };

// Why an Auth uid could not be turned into an application user.
//   not_linked   no authUsers mapping exists (or it points at a user document that is
//                gone) - a real, permanent state that an administrator must fix
//   inactive     the mapping or the user document is disabled
//   unavailable  the lookup itself failed. This says nothing about the account, so the
//                caller must NOT end the session over it.
export type ResolveUserReason = 'not_linked' | 'inactive' | 'unavailable';

export type ResolveUserResult =
  | { ok: true; user: User }
  | { ok: false; reason: ResolveUserReason; message?: string };

// Outcome of an administrator creating a sign-in account for an existing employee.
//   account_exists       an Auth account already uses this email. The employee may
//                        already be able to sign in and only need the mapping written -
//                        which needs their uid, so it is reported, never guessed at.
//                        This is also the answer when a REPLACEMENT code is asked for:
//                        the client SDK cannot set another account's password
//   not_linked           the account exists now but the authorization mapping could not
//                        be written or confirmed - the employee still cannot work
//   flag_not_set         account and mapping are in place, but the user document could
//                        not be marked as owing a password change, which would leave the
//                        access code working forever. Rolled back like not_linked
//   inactive / no_email  refused before anything was created
export type CreateSignInAccountReason =
  | 'account_exists'
  | 'not_linked'
  | 'flag_not_set'
  | 'inactive'
  | 'no_email'
  | 'auth_not_enabled'
  | 'auth_not_configured'
  | 'too_many_requests'
  | 'network_error'
  | 'error';

// On success the ONE-TIME ACCESS CODE comes back, because this is the only moment it
// exists: it is not written to Firestore and cannot be read back afterwards. A caller
// that drops it has left the employee with an account nobody can open.
export type CreateSignInAccountResult =
  | { ok: true; accessCode: string }
  | { ok: false; reason: CreateSignInAccountReason; message?: string };

// ===========================================
// Helper Functions
// ===========================================

// Firebase error codes arrive on a plain object, not on an Error subclass
const errorCode = (error: unknown): string => {
  if (error && typeof error === 'object' && 'code' in error) {
    return String((error as { code?: unknown }).code ?? '');
  }
  return '';
};

const errorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return String(error);
};

// With email enumeration protection on (the modern default) Auth answers
// 'auth/invalid-credential' for both an unknown email and a wrong password, so the two
// cannot be told apart. The older, more specific codes are still accepted for projects
// where the protection is off.
const isUnknownOrWrongCredential = (code: string): boolean =>
  code === 'auth/invalid-credential' ||
  code === 'auth/invalid-login-credentials' ||
  code === 'auth/user-not-found' ||
  code === 'auth/wrong-password';

// Failures of the environment rather than of the credentials. Each of these hits every
// user at once - they are the likely cutover misconfigurations - so they must never be
// reported as a generic error that nobody can triage. Returns null for anything else.
const infrastructureReason = (code: string): SignInReason | null => {
  // Email/Password sign-in switched off in the Firebase console
  if (code === 'auth/operation-not-allowed') return 'auth_not_enabled';

  // The API key / project in the environment variables does not resolve to an Auth
  // configuration - a wrong or missing NEXT_PUBLIC_FIREBASE_* value
  if (code === 'auth/configuration-not-found') return 'auth_not_configured';

  // Auth's own throttling after repeated failures from this client
  if (code === 'auth/too-many-requests') return 'too_many_requests';

  // The request never reached Firebase: offline, blocked, or a proxy in the way
  if (code === 'auth/network-request-failed') return 'network_error';

  return null;
};

// One definition of "active", used by every caller.
// A user counts as active unless isActive is explicitly false, so a document where the
// field is absent or null still signs in. The mapping written by linkAuthUser stores the
// same expression, and the previous mismatch - signIn testing `isActive === false` while
// the auth listener tested truthiness - let such a user log in and then be signed out
// again immediately.
export const isUserActive = (user: User): boolean => user.isActive !== false;

// ===========================================
// Activity log helpers
// ===========================================

// The four denormalised actor fields every entry carries. The log has to stay readable
// years after the employee's user document is gone, so the name, email and role are
// copied into the entry rather than referenced.
const actorFields = (user: User) => ({
  actorUserId: user.id,
  actorName: user.fullNameEn || user.fullNameAr,
  actorEmail: user.email ?? '',
  actorRole: user.role,
});

// recordActivity never rejects and never blocks the operation it describes, so nothing
// here is awaited. Kept as one helper so every call site in this file reads the same.
const logActivity = (entry: Omit<ActivityEntry, 'id' | 'at'>): void => {
  void recordActivity(entry);
};

// ===========================================
// Mapping Operations
// ===========================================

// Write both sides of the authUid <-> Firestore user id mapping. Idempotent: merged
// writes, safe to repeat. Never throws - an unhandled rejection in a sign-in flow would be
// worse than a degraded one - but it REPORTS whether the mapping itself was written,
// because without that document Firestore rules resolve the caller to no role and deny
// everything. Every caller must check the result: a discarded `false` here is a user who
// is told they have an account and then cannot read a single document.
//
// The two writes are reported separately on purpose:
//   - authUsers/{authUid} is the authorization record. Its failure is fatal to the session.
//   - users/{id}.authUid is only a reverse pointer for operator reports. It is written
//     second (the rules allow it only once the mapping exists) and its failure is not.
export const linkAuthUser = async (authUid: string, user: User): Promise<boolean> => {
  try {
    const mapping: AuthUserMapping = {
      userId: user.id,
      role: user.role,
      isActive: isUserActive(user),
    };

    const mappingRef = doc(db, COLLECTIONS.AUTH_USERS, authUid);
    await setDoc(mappingRef, mapping, { merge: true });
  } catch (error) {
    logger.error('Error writing the authUsers mapping:', error);
    return false;
  }

  try {
    // Store the reverse pointer on the user document so the mapping is navigable both ways
    const userRef = doc(db, COLLECTIONS.USERS, user.id);
    await setDoc(userRef, { authUid }, { merge: true });
  } catch (error) {
    // Degraded, not broken: the session works, only check-auth-migration will list this
    // user as unlinked until an administrator saves the document again.
    logger.warn('Could not write the authUid reverse pointer on the user document:', error);
  }

  return true;
};

// Read the mapping back and check it really points at this user.
// The write above can be accepted locally and still not exist on the server, and a
// mapping left over from another user id would authorize the wrong account, so an account
// is only reported as usable after this returns true.
const confirmAuthMapping = async (authUid: string, userId: string): Promise<boolean> => {
  try {
    const mappingDoc = await getDoc(doc(db, COLLECTIONS.AUTH_USERS, authUid));
    return mappingDoc.exists() && mappingDoc.data().userId === userId;
  } catch (error) {
    logger.error('Error confirming the authUsers mapping:', error);
    return false;
  }
};

// Same conversion firestore.ts applies when it reads a user document.
const toDateIfPossible = (value: unknown): unknown => {
  if (value instanceof Timestamp) return value.toDate();
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed;
  }
  return value;
};

// Read a user document with its failure kept visible.
// getUserById answers null both for "no such document" and for a read that failed, and
// resolveAppUser has to tell those apart: the first means an administrator must onboard
// this person, the second means Firestore was unreachable for a moment and the session
// must be left alone. Hence the direct read here.
//
// `database` selects which Firebase app instance the read is made on, and with it WHICH
// SESSION the rules see. It is the primary one everywhere except in
// checkPendingPasswordChange, which deliberately works on the secondary instance.
const readUserDoc = async (
  userId: string,
  database: Firestore = db
): Promise<{ ok: true; user: User | null } | { ok: false; message: string }> => {
  try {
    const snapshot = await getDoc(doc(database, COLLECTIONS.USERS, userId));
    if (!snapshot.exists()) {
      return { ok: true, user: null };
    }

    const data = snapshot.data() as Record<string, unknown>;
    const user = {
      ...data,
      id: snapshot.id,
      createdAt: toDateIfPossible(data.createdAt),
      updatedAt: toDateIfPossible(data.updatedAt),
      lastLoginAt: toDateIfPossible(data.lastLoginAt),
    } as unknown as User;

    return { ok: true, user };
  } catch (error) {
    logger.error('Error reading the user document:', error);
    return { ok: false, message: errorMessage(error) };
  }
};

// Resolve the application user behind a Firebase Auth uid.
// The authUsers mapping is the only path: it is what the Firestore rules read, so a
// session without one is denied every read and write no matter what this function says.
// There is deliberately no by-email backfill any more - writing a mapping for yourself is
// what the rules forbid, so that path could only fail, and its failure was being reported
// as "no mapping exists".
//
// The three failures are kept apart because they call for opposite handling: 'not_linked'
// and 'inactive' are answers about the account and end the session, 'unavailable' is a
// statement about Firestore and must not.
//
// `database` is the Firebase app instance to read through, which is also the session the
// rules will judge: the primary one by default, the secondary one for the pre-sign-in
// onboarding check.
export const resolveAppUser = async (
  authUid: string,
  email: string | null,
  database: Firestore = db
): Promise<ResolveUserResult> => {
  const who = `${authUid}${email ? ` (${email})` : ''}`;

  let mappingDoc;
  try {
    mappingDoc = await getDoc(doc(database, COLLECTIONS.AUTH_USERS, authUid));
  } catch (error) {
    // A permission denial here is indistinguishable from an outage - both are the rules
    // or the network, neither is proof that the mapping is absent.
    logger.error('Could not read the authUsers mapping:', error);
    return { ok: false, reason: 'unavailable', message: errorMessage(error) };
  }

  if (!mappingDoc.exists()) {
    return {
      ok: false,
      reason: 'not_linked',
      message: `No authUsers mapping exists for ${who}`,
    };
  }

  const mapping = mappingDoc.data() as Partial<AuthUserMapping>;

  // The mapping carries its own isActive, and it is what the rules test. A user disabled
  // here has an answer of their own - saying "not linked" would send them to an
  // administrator to fix a link that is already in place.
  if (mapping.isActive === false) {
    return { ok: false, reason: 'inactive', message: `authUsers mapping is disabled for ${who}` };
  }

  const userId = mapping.userId;
  if (typeof userId !== 'string' || userId.length === 0) {
    return {
      ok: false,
      reason: 'not_linked',
      message: `authUsers mapping for ${who} carries no userId`,
    };
  }

  const read = await readUserDoc(userId, database);
  if (!read.ok) {
    return { ok: false, reason: 'unavailable', message: read.message };
  }

  if (!read.user) {
    logger.warn('authUsers mapping points to a missing user document:', userId);
    return {
      ok: false,
      reason: 'not_linked',
      message: `authUsers mapping for ${who} points at the missing user document ${userId}`,
    };
  }

  if (!isUserActive(read.user)) {
    return { ok: false, reason: 'inactive', message: `User document ${userId} is disabled` };
  }

  return { ok: true, user: read.user };
};

// ===========================================
// Administrator-driven onboarding
// ===========================================

// Undo an account creation whose follow-up steps failed.
//
// Leaving the account behind is not a harmless leftover: the next attempt to onboard the
// same employee fails with auth/email-already-in-use, and the client SDK cannot look an
// existing account's uid up, so the mapping can never be written from the app. One failed
// attempt would make that employee permanently unonboardable. The account is therefore
// removed on every path that does not end with a usable login.
//
// The two documents linkAuthUser may already have written go with it. Both are written
// BEFORE the mapping is confirmed, so a rollback that only deleted the Auth account would
// leave a mapping for a uid that no longer exists and - worse - a user document claiming
// a sign-in account it does not have, which is exactly what the Users page reads to decide
// whether to offer the Create button. The retry would then be hidden from the
// administrator instead of merely failing.
//
// Deleting a document that was never written is not an error, so this is safe to call
// whether the failure happened before or after either write.
//
// Returns '' when nothing was left behind, or a sentence naming what was, to be appended
// to the message the operator sees. Never throws: it runs on an already-failing path.
const rollbackCreatedAccount = async (
  created: FirebaseAuthUser,
  userId: string
): Promise<string> => {
  let leftBehind = '';

  // Logged but never reported: a mapping whose uid no longer exists authorizes nobody -
  // Firebase does not reissue uids - so a leftover here costs the operator nothing and
  // naming it would bury the two leftovers that DO block the retry.
  try {
    await deleteDoc(doc(db, COLLECTIONS.AUTH_USERS, created.uid));
  } catch (error) {
    logger.error('Could not remove the mapping after a failed onboarding:', error);
  }

  try {
    await deleteAuthAccount(created);
  } catch (error) {
    logger.error('Could not delete the Auth account after a failed onboarding:', error);
    leftBehind +=
      ` The Auth account ${created.uid} could NOT be deleted (${errorMessage(error)}), so it is` +
      ' an orphan: every retry for this email will fail with auth/email-already-in-use until' +
      ' it is removed from the Firebase console.';
  }

  try {
    await updateDoc(doc(db, COLLECTIONS.USERS, userId), { authUid: deleteField() });
  } catch (error) {
    logger.error('Could not clear the authUid pointer after a failed onboarding:', error);
    leftBehind +=
      ` The authUid pointer on user document ${userId} could NOT be cleared` +
      ` (${errorMessage(error)}), so the user will be listed as having a sign-in account` +
      ' that does not exist.';
  }

  return leftBehind;
};

// Give an existing employee a way to sign in. Called by an administrator from the Users
// page, so every Firestore write below is made by an already-authenticated admin session -
// which is exactly what the rules require, and why nothing here needs an anonymous read.
//
// The steps, in order:
//   1. generate a one-time ACCESS CODE and create the Auth account with it as the
//      password, on the secondary instance so the administrator's own session is untouched,
//   2. write authUsers/{uid} + users/{id}.authUid and read the mapping back,
//   3. set mustChangePassword on the user document, which is what stops the code from
//      being a permanent password,
//   4. sign the secondary instance out - in a finally block, so a failure at any step
//      cannot leave that session live,
//   5. return the code to the caller, which must show it to the administrator once and
//      never store it. NO EMAIL IS SENT: there is no mail service on this project, and a
//      code read out to the employee in person is what replaces it.
//
// Success is only reported once the mapping has been confirmed on the server AND the flag
// is set. An account without a mapping is authenticated and authorized for nothing; an
// account without the flag holds a code that keeps working forever. Either one would hand
// the administrator a finished-looking task and the employee a broken - or unsafe - login.
//
// If step 2 or step 3 fails the account from step 1 is DELETED again
// (rollbackCreatedAccount): a half-created account cannot be repaired from the browser and
// would block every retry, so the only safe outcome of a failed attempt is no account at
// all, and the administrator can simply press the button again.
export const createSignInAccountForUser = async (
  user: User
): Promise<CreateSignInAccountResult> => {
  const email = (user.email ?? '').trim().toLowerCase();

  if (!email) {
    return {
      ok: false,
      reason: 'no_email',
      message: `User ${user.id} has no email address to create an account with`,
    };
  }

  if (!isUserActive(user)) {
    return {
      ok: false,
      reason: 'inactive',
      message: `User ${user.id} is disabled - no sign-in account was created`,
    };
  }

  const secondaryAuth = getSecondaryAuth();

  // Kept outside the try so the catch below can undo a creation that a later step, or an
  // unforeseen throw, has made useless. Anything that leaves it non-null is an account
  // that must not survive the call.
  let createdAccount: FirebaseAuthUser | null = null;

  try {
    // The code is generated here and returned at the end. It is never written to
    // Firestore and never logged - the administrator on screen is the only copy.
    const accessCode = generateAccessCode();

    const credential = await createUserWithEmailAndPassword(secondaryAuth, email, accessCode);
    createdAccount = credential.user;
    const authUid = credential.user.uid;

    const linked = await linkAuthUser(authUid, user);
    const confirmed = linked && (await confirmAuthMapping(authUid, user.id));

    if (!confirmed) {
      // Take the account back out again, so the administrator can simply try once more
      const leftBehind = await rollbackCreatedAccount(credential.user, user.id);
      createdAccount = null;

      return {
        ok: false,
        reason: 'not_linked',
        message:
          `Auth account ${authUid} was created for ${email} but its authUsers mapping could` +
          ` not be written or confirmed, so the account was removed again.${leftBehind}`,
      };
    }

    // Without this flag the access code is simply the employee's password, for good, and
    // it has been spoken out loud and probably written on a piece of paper. An account in
    // that state is worse than no account, so the failure is rolled back like the one
    // above rather than reported as a partial success.
    const flagged = await setMustChangePassword(user.id, true);

    if (!flagged) {
      const leftBehind = await rollbackCreatedAccount(credential.user, user.id);
      createdAccount = null;

      return {
        ok: false,
        reason: 'flag_not_set',
        message:
          `Auth account ${authUid} was created for ${email}, but user document ${user.id} could` +
          ' not be marked as owing a password change, which would have left the access code' +
          ` working forever, so the account was removed again.${leftBehind}`,
      };
    }

    createdAccount = null;
    return { ok: true, accessCode };
  } catch (error) {
    const code = errorCode(error);

    // Something threw after the account existed. It is not usable - nothing below can
    // finish the onboarding - so it is removed rather than left to block the retry.
    const leftBehind = createdAccount
      ? await rollbackCreatedAccount(createdAccount, user.id)
      : '';

    // An Auth account already uses this address. It may be this same employee, already
    // able to authenticate and only missing the mapping - but writing that mapping needs
    // their uid, which the client SDK cannot look up, so this is reported, not guessed.
    // (This can only come from the creation call itself, so there is nothing to undo.)
    if (code === 'auth/email-already-in-use') {
      return {
        ok: false,
        reason: 'account_exists',
        message: `An Auth account already exists for ${email}`,
      };
    }

    const infrastructure = infrastructureReason(code);
    if (infrastructure) {
      logger.error('Infrastructure failure while creating a sign-in account:', code, error);
      return {
        ok: false,
        reason: infrastructure as CreateSignInAccountReason,
        message: `${code}${leftBehind}`,
      };
    }

    logger.error('Error creating a sign-in account:', error);
    return { ok: false, reason: 'error', message: `${errorMessage(error)}${leftBehind}` };
  } finally {
    // Whatever happened above, the new account must not stay signed in on the secondary
    // instance: the next administrator action would run as that account.
    try {
      await signOut(secondaryAuth);
    } catch (signOutError) {
      logger.error('Could not sign the secondary app instance out:', signOutError);
    }
  }
};

// Issue a REPLACEMENT access code for an employee who lost theirs before using it.
//
// It is the same operation as creating the account - a fresh code, a fresh
// mustChangePassword - and it is deliberately the same function, so a re-issued code can
// never differ in kind from a first one.
//
// WHAT IT CAN AND CANNOT DO, because the difference decides what the operator has to do
// next. If the employee has no Auth account (their user document has no authUid, or the
// account was deleted from the Firebase console), this creates it and returns a code, and
// the employee is onboarded normally. If the Auth account still exists, this returns
// 'account_exists' and nothing changes: setting an existing account's password needs the
// Admin SDK or the Firebase console, and this project has neither - the client SDK can
// only ever set a password for the account it is signed in as. There is no way around
// that from the browser, so the Users page states the two remaining routes outright
// (the password-reset link, or deleting the Auth account in the console and creating it
// again here) instead of pretending the code was replaced.
export const issueNewAccessCodeForUser = async (
  user: User
): Promise<CreateSignInAccountResult> => createSignInAccountForUser(user);

// ===========================================
// First-run bootstrap
// ===========================================

// Why the bootstrap could not be completed.
//   account_exists   an Auth account already uses the administrator email and this
//                    password did not open it - the setup was completed before, so the way
//                    in is the normal sign-in form and the reset link, not this panel
//   not_linked       the authorization could not be written or confirmed, so everything
//                    this attempt had made was undone and the panel can be used again
//   weak_password    Firebase refused the chosen password
export type BootstrapAdminReason =
  | 'account_exists'
  | 'not_linked'
  | 'weak_password'
  | 'auth_not_enabled'
  | 'auth_not_configured'
  | 'too_many_requests'
  | 'network_error'
  | 'error';

export type BootstrapAdminResult =
  | { ok: true }
  | { ok: false; reason: BootstrapAdminReason; message?: string };

// Create the very first sign-in account: the system administrator's.
//
// This is the one place in the system where an account authorizes ITSELF, and it is the
// owner's only way in, so both halves of that sentence are load-bearing:
//
//   * The rules open a single hole for it - authUsers/{uid} may be created with
//     userId 'system-admin-root' by the account that is signing itself in, but ONLY while
//     users/system-admin-root carries no authUid. Writing that authUid is what closes the
//     hole, so it is written LAST, after the mapping has been read back from the server.
//     A run that wrote the authUid first, or that wrote it while the mapping had failed,
//     would close the window over an account that cannot use it - and with the window
//     shut and no Console access, nothing could reopen it. That is the failure this
//     function exists to make impossible.
//
//   * Everything happens on the secondary Firebase app instance, INCLUDING the Firestore
//     writes (getSecondaryDb), so that the primary session - the one AuthContext watches -
//     never changes. On the primary instance, creating the account would fire
//     onAuthStateChanged, which resolves the mapping and signs out any account that has
//     none; racing that listener against these three writes is how a bootstrap ends up
//     half-written. Here the listener never sees this account at all.
//
// If any step fails, everything this call created is undone - and only what it created,
// never what it found - which leaves the database exactly as it was and the panel usable
// for another attempt. Nothing is reported as success before the authUid write has been
// acknowledged by the server.
export const bootstrapSystemAdmin = async (
  admin: User,
  email: string,
  password: string
): Promise<BootstrapAdminResult> => {
  const normalizedEmail = email.trim().toLowerCase();
  const secondaryAuth = getSecondaryAuth();
  const secondaryDb = getSecondaryDb();

  // Was the Auth account brought into existence by THIS call, and was the mapping below
  // written by it? The rollback is allowed to remove only what this call made. Deleting an
  // account or a mapping it merely found would be the one truly unrecoverable mistake
  // available here - the mapping it might find is the live administrator's.
  let accountIsOurs = false;
  let mappingIsOurs = false;

  // Undo an attempt that cannot be finished, so the next one starts from the state this
  // one did. Best effort, and only the leftover that actually blocks a retry - a surviving
  // Auth account - is reported; a surviving mapping for a deleted uid authorizes nobody,
  // because Firebase never reissues a uid.
  const rollback = async (account: FirebaseAuthUser): Promise<string> => {
    if (mappingIsOurs) {
      try {
        await deleteDoc(doc(secondaryDb, COLLECTIONS.AUTH_USERS, account.uid));
      } catch (error) {
        logger.error('Could not remove the mapping of a failed bootstrap:', error);
      }
    }

    if (!accountIsOurs) return '';

    try {
      await deleteAuthAccount(account);
      return '';
    } catch (error) {
      logger.error('Could not delete the Auth account of a failed bootstrap:', error);
      return (
        ` The Auth account for ${normalizedEmail} could NOT be deleted (${errorMessage(error)}):` +
        ' it is an orphan. Sign in from this panel with the same password to finish the' +
        ' setup, or delete that account from the Firebase console and start again.'
      );
    }
  };

  let openAccount: FirebaseAuthUser | null = null;

  try {
    // The account this bootstrap will authorize. Normally it is created here. If one
    // already exists for the administrator email, that is an earlier attempt that was
    // interrupted between creating the account and writing its authorization - the setup
    // window is demonstrably still open, since the panel only appears while
    // users/system-admin-root has no authUid - so the attempt is finished rather than
    // refused. It is not a way in for anyone else: the account has to be unlocked with the
    // password typed into this form, and this whole path disappears the moment the
    // bootstrap succeeds.
    let account: FirebaseAuthUser;

    try {
      const credential = await createUserWithEmailAndPassword(
        secondaryAuth,
        normalizedEmail,
        password
      );
      account = credential.user;
      accountIsOurs = true;
    } catch (creationError) {
      if (errorCode(creationError) !== 'auth/email-already-in-use') throw creationError;

      try {
        const credential = await signInWithEmailAndPassword(
          secondaryAuth,
          normalizedEmail,
          password
        );
        account = credential.user;
      } catch (signInError) {
        // Either the account belongs to a finished setup, or the password does not match
        // the interrupted attempt. Both answers are the same: this panel cannot help, use
        // the sign-in form and the reset link.
        logger.error('An account exists for the administrator email:', signInError);
        return {
          ok: false,
          reason: 'account_exists',
          message: `An Auth account already exists for ${normalizedEmail} and this password did not open it`,
        };
      }
    }

    openAccount = account;
    const authUid = account.uid;

    // 1. The authorization record. Written whole (no merge) so it carries exactly the
    //    three fields the rules accept, and with the role stated outright: this document
    //    is only allowed to exist because users/system-admin-root already says
    //    'system_admin', so a document that claimed anything else would be refused here
    //    rather than quietly granting something the directory does not record.
    const mapping: AuthUserMapping = {
      userId: admin.id,
      role: 'system_admin',
      isActive: true,
    };

    try {
      await setDoc(doc(secondaryDb, COLLECTIONS.AUTH_USERS, authUid), mapping);
      mappingIsOurs = true;
    } catch (error) {
      logger.error('Could not write the first-run authUsers mapping:', error);
      const leftBehind = await rollback(account);
      openAccount = null;
      return {
        ok: false,
        reason: 'not_linked',
        message: `The authorization mapping could not be written: ${errorMessage(error)}.${leftBehind}`,
      };
    }

    // 2. Read it back. A write can be accepted locally and never reach the server, and an
    //    unwritten mapping means an administrator account that is authorized for nothing.
    let confirmed = false;
    try {
      const snapshot = await getDoc(doc(secondaryDb, COLLECTIONS.AUTH_USERS, authUid));
      confirmed = snapshot.exists() && snapshot.data().userId === admin.id;
    } catch (error) {
      logger.error('Could not confirm the first-run authUsers mapping:', error);
    }

    if (!confirmed) {
      const leftBehind = await rollback(account);
      openAccount = null;
      return {
        ok: false,
        reason: 'not_linked',
        message: `The authorization mapping could not be confirmed on the server.${leftBehind}`,
      };
    }

    // 3. Only now the reverse pointer, which is also the switch that closes the setup
    //    window. It is deliberately NOT read back: a rejected write was never applied, so
    //    a failure here can be rolled back safely, whereas a read-back that failed after
    //    a write that had in fact succeeded would make this function delete the one
    //    account that could ever use the now-closed window.
    try {
      await setDoc(doc(secondaryDb, COLLECTIONS.USERS, admin.id), { authUid }, { merge: true });
    } catch (error) {
      logger.error('Could not write the authUid pointer during the first-run bootstrap:', error);
      const leftBehind = await rollback(account);
      openAccount = null;
      return {
        ok: false,
        reason: 'not_linked',
        message: `The account could not be recorded on the administrator document: ${errorMessage(error)}.${leftBehind}`,
      };
    }

    openAccount = null;
    return { ok: true };
  } catch (error) {
    const code = errorCode(error);

    // A throw after the account was open leaves the setup unfinished - undo whatever this
    // call made, so the panel still works.
    const leftBehind = openAccount ? await rollback(openAccount) : '';

    if (code === 'auth/weak-password') {
      return { ok: false, reason: 'weak_password', message: code };
    }

    const infrastructure = infrastructureReason(code);
    if (infrastructure) {
      logger.error('Infrastructure failure during the first-run bootstrap:', code, error);
      return {
        ok: false,
        reason: infrastructure as BootstrapAdminReason,
        message: `${code}${leftBehind}`,
      };
    }

    logger.error('Error during the first-run bootstrap:', error);
    return { ok: false, reason: 'error', message: `${errorMessage(error)}${leftBehind}` };
  } finally {
    // The new administrator account must not stay signed in on the secondary instance -
    // the next account creation from the Users page would run as it.
    try {
      await signOut(secondaryAuth);
    } catch (signOutError) {
      logger.error('Could not sign the secondary app instance out:', signOutError);
    }
  }
};

// ===========================================
// Sign In / Sign Out
// ===========================================

// Sign in with Firebase Auth, then resolve the authUsers mapping. Two steps, no fallback:
// an email with no Auth account is a failed sign-in, and an account with no mapping is a
// session the rules would deny everything, so both are refused here with a reason the
// login page can act on. Employees who have neither are onboarded by an administrator
// (createSignInAccountForUser), which is the only path that exists.
export const signIn = async (email: string, password: string): Promise<SignInResult> => {
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail || !password) {
    return { ok: false, reason: 'invalid_credentials' };
  }

  try {
    const credential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
    const resolved = await resolveAppUser(credential.user.uid, credential.user.email);

    if (resolved.ok) {
      // Recorded here rather than at the call site: this is the one place where a session
      // is known to have been both authenticated AND authorized, and the write is made by
      // that very session, which is what the activityLog rule requires.
      const user = resolved.user;
      const name = user.fullNameEn || user.fullNameAr;
      logActivity({
        ...actorFields(user),
        action: 'login',
        entity: 'session',
        entityId: user.id,
        entityLabel: name,
        summaryEn: `${name} (${user.email}) signed in to the quality management system as ${getRoleNameEn(user.role)}.`,
        summaryAr: `سجّل ${user.fullNameAr || name} (${user.email}) الدخول إلى نظام إدارة الجودة بصفة ${getRoleNameAr(user.role)}.`,
      });

      return { ok: true, user, migrated: false };
    }

    if (resolved.reason === 'unavailable') {
      // The credentials were accepted; only the authorization lookup failed. Ending the
      // Auth session would turn a moment of Firestore trouble into a logout, so the
      // session is left as it is and the answer is "try again".
      return {
        ok: false,
        reason: 'service_unavailable',
        message: resolved.message,
      };
    }

    // A deliberate refusal: either no mapping exists for this account, or it is disabled.
    // Leaving the Auth session behind would be a UI that looks signed in and is denied
    // every read.
    await signOut(auth);
    return { ok: false, reason: resolved.reason, message: resolved.message };
  } catch (error) {
    const code = errorCode(error);

    // No Auth account for this email, or the password does not match it. There is nothing
    // else to try: the legacy credentials are no longer a way in.
    if (isUnknownOrWrongCredential(code) || code === 'auth/invalid-email') {
      return { ok: false, reason: 'invalid_credentials' };
    }

    if (code === 'auth/user-disabled') {
      return { ok: false, reason: 'inactive' };
    }

    // Project-level failures: everyone is affected, so they must be named
    const infrastructure = infrastructureReason(code);
    if (infrastructure) {
      logger.error('Infrastructure failure while signing in:', code, error);
      return { ok: false, reason: infrastructure, message: code };
    }

    logger.error('Error signing in:', error);
    return { ok: false, reason: 'error', message: errorMessage(error) };
  }
};

// Is this employee still holding a one-time access code rather than a password of their
// own? Answered BEFORE any application session exists.
//
//   required      the credentials are correct and users/{id}.mustChangePassword is set.
//                 The caller must put them through the choose-a-password step and must
//                 NOT sign them in
//   not_required  the credentials are correct and nothing is owed - sign in normally
//   refused       the credentials, the account or Firestore said no. `reason` is the same
//                 vocabulary signIn speaks, so the login page renders it with the message
//                 it already has for that case
//
// WHY THIS IS A SEPARATE PRE-FLIGHT AND NOT A BRANCH INSIDE signIn.
// The whole point is that a user who owes a password change never becomes the primary
// session. Signing in on the primary instance and signing out again after reading the
// flag does not achieve that: AuthContext's onAuthStateChanged listener resolves the same
// session concurrently, and ProtectedRoute navigates to the dashboard the moment it does -
// a race this code would lose about as often as it won. Authenticating on the SECONDARY
// app instance instead means that listener never fires at all, so there is no window in
// which the application is reachable. The cost is one extra Auth round trip and two extra
// document reads per sign-in, which for an internal directory of this size is a fair price
// for a gate that cannot be raced.
//
// The secondary session is signed out again in every case, including success.
export type PendingPasswordChangeCheck =
  | { status: 'required'; user: User }
  | { status: 'not_required'; user: User }
  | { status: 'refused'; reason: SignInReason; message?: string };

export const checkPendingPasswordChange = async (
  email: string,
  password: string
): Promise<PendingPasswordChangeCheck> => {
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail || !password) {
    return { status: 'refused', reason: 'invalid_credentials' };
  }

  const secondaryAuth = getSecondaryAuth();
  const secondaryDb = getSecondaryDb();

  try {
    const credential = await signInWithEmailAndPassword(secondaryAuth, normalizedEmail, password);

    // Read through the secondary instance: the rules judge whichever session made the
    // request, and the primary one is still signed out (or signed in as somebody else).
    const resolved = await resolveAppUser(credential.user.uid, credential.user.email, secondaryDb);

    if (!resolved.ok) {
      // 'unavailable' says nothing about the account - but it also means the flag could
      // not be read, and letting somebody in on an unknown flag is exactly the hole this
      // check exists to close. So it is refused, with the "try again" message.
      if (resolved.reason === 'unavailable') {
        return { status: 'refused', reason: 'service_unavailable', message: resolved.message };
      }

      return { status: 'refused', reason: resolved.reason, message: resolved.message };
    }

    return resolved.user.mustChangePassword === true
      ? { status: 'required', user: resolved.user }
      : { status: 'not_required', user: resolved.user };
  } catch (error) {
    const code = errorCode(error);

    if (isUnknownOrWrongCredential(code) || code === 'auth/invalid-email') {
      return { status: 'refused', reason: 'invalid_credentials' };
    }

    if (code === 'auth/user-disabled') {
      return { status: 'refused', reason: 'inactive' };
    }

    const infrastructure = infrastructureReason(code);
    if (infrastructure) {
      logger.error('Infrastructure failure while checking for a pending password change:', code);
      return { status: 'refused', reason: infrastructure, message: code };
    }

    logger.error('Error checking for a pending password change:', error);
    return { status: 'refused', reason: 'error', message: errorMessage(error) };
  } finally {
    try {
      await signOut(secondaryAuth);
    } catch (signOutError) {
      logger.error('Could not sign the secondary app instance out:', signOutError);
    }
  }
};

// Sign out of Firebase Auth. Callers still clean up their own session bookkeeping
// (activeSessions) separately.
//
// `actor` is who is leaving, for the activity log. Callers that already hold the
// application user should pass it; when they do not, it is resolved from the session about
// to end, and an unidentifiable session (no mapping - the auth listener's own reason for
// calling this) is signed out without a log entry rather than one naming nobody.
//
// The entry is recorded BEFORE the sign-out on purpose: after it, the write would be made
// by an anonymous caller and the rules would refuse it. It is also AWAITED, which the rest
// of this file's activity logging deliberately is not - firing it and moving on left the
// write racing signOut() for the auth token, and the token usually won: every logout was
// refused with PERMISSION_DENIED and the one event the log most needs to show - when
// somebody left - was never recorded at all.
export const signOutUser = async (actor?: User): Promise<void> => {
  const current = auth.currentUser;
  let who: User | null = actor ?? null;

  if (!who && current) {
    const resolved = await resolveAppUser(current.uid, current.email);
    if (resolved.ok) who = resolved.user;
  }

  if (who) {
    const name = who.fullNameEn || who.fullNameAr;
    await recordActivity({
      ...actorFields(who),
      action: 'logout',
      entity: 'session',
      entityId: who.id,
      entityLabel: name,
      summaryEn: `${name} (${who.email}) signed out of the quality management system, ending the session held as ${getRoleNameEn(who.role)}.`,
      summaryAr: `سجّل ${who.fullNameAr || name} (${who.email}) الخروج من نظام إدارة الجودة، وأُنهيت الجلسة التي كانت بصفة ${getRoleNameAr(who.role)}.`,
    });
  }

  try {
    await signOut(auth);
  } catch (error) {
    logger.error('Error signing out:', error);
  }
};

// ===========================================
// Password Operations
// ===========================================

// Why a first-sign-in password could not be set.
//   invalid_credentials  the access code (or current password) did not open the account
//   password_too_short   Firebase's minimum, or ours, refused the new password
//   same_as_code         the new password is the code that was just handed over. Refused
//                        here as well as in the form, because a code that has been spoken
//                        out loud and written down is not a password
export type SetPasswordReason =
  | 'invalid_credentials'
  | 'password_too_short'
  | 'same_as_code'
  | 'inactive'
  | 'too_many_requests'
  | 'network_error'
  | 'auth_not_enabled'
  | 'auth_not_configured'
  | 'error';

export type SetPasswordResult = { ok: true } | { ok: false; reason: SetPasswordReason; message?: string };

// Exchange a one-time access code for a password of the employee's own choosing.
//
// This is changeOwnPassword's twin for the one moment when there is no application
// session: checkPendingPasswordChange refuses to open one while the flag is set, so the
// employee doing this is signed in nowhere. It runs on the SECONDARY app instance, where
// signing in with the code IS the reauthentication Firebase demands before updatePassword -
// and the freshest one possible, since it happened a moment ago, so
// 'auth/requires-recent-login' cannot arise here.
//
// It does NOT clear mustChangePassword. That write has to be made by the employee's own
// primary session (the rules resolve the caller through authUsers/{uid}), so the caller
// signs in normally afterwards and clears it then - which also makes the order matter:
// the password is changed first, the session opened second, the flag cleared last. If the
// tab is closed anywhere in the middle the flag is still set, the access code no longer
// opens anything, and the next sign-in with the NEW password lands back on the same step.
export const setPasswordWithAccessCode = async (
  email: string,
  accessCode: string,
  newPassword: string
): Promise<SetPasswordResult> => {
  const normalizedEmail = email.trim().toLowerCase();

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, reason: 'password_too_short' };
  }

  if (newPassword === accessCode) {
    return { ok: false, reason: 'same_as_code' };
  }

  const secondaryAuth = getSecondaryAuth();

  try {
    const credential = await signInWithEmailAndPassword(secondaryAuth, normalizedEmail, accessCode);
    await updatePassword(credential.user, newPassword);
    return { ok: true };
  } catch (error) {
    const code = errorCode(error);

    if (isUnknownOrWrongCredential(code) || code === 'auth/invalid-email') {
      return { ok: false, reason: 'invalid_credentials' };
    }

    if (code === 'auth/user-disabled') {
      return { ok: false, reason: 'inactive' };
    }

    if (code === 'auth/weak-password') {
      return { ok: false, reason: 'password_too_short' };
    }

    const infrastructure = infrastructureReason(code);
    if (infrastructure) {
      logger.error('Infrastructure failure while setting a first-sign-in password:', code);
      return { ok: false, reason: infrastructure as SetPasswordReason, message: code };
    }

    logger.error('Error setting a first-sign-in password:', error);
    return { ok: false, reason: 'error', message: errorMessage(error) };
  } finally {
    // The employee's account must not stay signed in on the secondary instance - the next
    // administrator action on this browser would run as it.
    try {
      await signOut(secondaryAuth);
    } catch (signOutError) {
      logger.error('Could not sign the secondary app instance out:', signOutError);
    }
  }
};

// Change the signed-in user's own password. Firebase requires a recent login before
// updatePassword, so we reauthenticate first and map the failure modes to reasons the
// UI can translate: 'not_signed_in' | 'invalid_credentials' | 'password_too_short' |
// 'requires_recent_login' | 'too_many_requests' | 'error'.
// The legacy `passwords` document is deliberately not touched - it stays as the
// pre-migration rollback record.
export const changeOwnPassword = async (
  currentPassword: string,
  newPassword: string
): Promise<{ ok: boolean; reason?: string }> => {
  const currentUser = auth.currentUser;

  if (!currentUser || !currentUser.email) {
    return { ok: false, reason: 'not_signed_in' };
  }

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, reason: 'password_too_short' };
  }

  try {
    const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
    await reauthenticateWithCredential(currentUser, credential);
    await updatePassword(currentUser, newPassword);

    return { ok: true };
  } catch (error) {
    const code = errorCode(error);

    // The session is too old for a credential change - the user has to sign in again
    if (code === 'auth/requires-recent-login') {
      return { ok: false, reason: 'requires_recent_login' };
    }

    if (isUnknownOrWrongCredential(code)) {
      return { ok: false, reason: 'invalid_credentials' };
    }

    if (code === 'auth/weak-password') {
      return { ok: false, reason: 'password_too_short' };
    }

    if (code === 'auth/too-many-requests') {
      return { ok: false, reason: 'too_many_requests' };
    }

    logger.error('Error changing password:', error);
    return { ok: false, reason: 'error' };
  }
};
