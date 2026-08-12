/**
 * Shared helpers for the operator scripts in this folder.
 *
 * These scripts are plain Node ESM using the same Firebase *client* SDK the app
 * uses - there is no firebase-admin service account for this project, so every
 * script runs as a real signed-in user and is bound by the Firestore rules.
 *
 * Nothing here writes to Firestore. Signing in is the only side effect, and it
 * only lives in this process's memory.
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Exit codes - both are non-zero so either one stops a gated script, but they
// say different things:
//   1 = the script ran correctly and the answer is "not ready / incomplete"
//   2 = the script could not run at all (bad config, sign-in refused, ...)
export const EXIT_NOT_READY = 1;
export const EXIT_FAILED = 2;

/**
 * Stop with a loud, actionable message. Never let a script end quietly on a
 * half-finished result - a partial answer that looks complete is how the wrong
 * migration decision gets made.
 */
export function fail(message, hint) {
  console.error(`\nFAILED - ${message}`);
  if (hint) console.error(`         ${hint}`);
  process.exit(EXIT_FAILED);
}

/**
 * Minimal --flag / --flag=value / --flag value parser. No dependencies.
 * A flag with no value becomes `true`.
 */
export function parseFlags(argv = process.argv.slice(2)) {
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const eq = arg.indexOf('=');
    if (eq !== -1) {
      flags[arg.slice(2, eq)] = arg.slice(eq + 1);
      continue;
    }
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      flags[arg.slice(2)] = next;
      i += 1;
    } else {
      flags[arg.slice(2)] = true;
    }
  }
  return flags;
}

/** Read .env.local into a plain object (same file and format the app uses). */
export function loadEnv() {
  const path = join(ROOT, '.env.local');
  if (!existsSync(path)) {
    fail(
      '.env.local not found - cannot read Firebase configuration',
      'Copy .env.local.example to .env.local and fill in the NEXT_PUBLIC_FIREBASE_* values.'
    );
  }
  const env = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return env;
}

/** Build the Firebase app / Firestore / Auth handles from .env.local. */
export function initFirebase(env) {
  const required = [
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  ];
  const missing = required.filter((k) => !env[k]);
  if (missing.length) {
    fail(`Missing in .env.local: ${missing.join(', ')}`);
  }

  const app = initializeApp({
    apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
  });

  return { app, db: getFirestore(app), auth: getAuth(app) };
}

/**
 * Collect operator credentials from the environment or the command line.
 *
 * Deliberately NOT read from .env.local: that file is long-lived and shared,
 * and an administrator password does not belong in it. Nothing is written back
 * anywhere, so every run has to supply the credentials again.
 */
export function readCredentials(flags = parseFlags()) {
  const email = process.env.QMS_OPERATOR_EMAIL || flags.email;
  const password = process.env.QMS_OPERATOR_PASSWORD || flags.password;

  if (typeof email !== 'string' || !email || typeof password !== 'string' || !password) {
    fail(
      'No operator credentials supplied',
      'Pass them as environment variables (preferred):\n' +
        '           QMS_OPERATOR_EMAIL=you@example.com QMS_OPERATOR_PASSWORD=... node scripts/<script>.mjs\n' +
        '         or on the command line: --email you@example.com --password ...'
    );
  }

  if (flags.password) {
    // Arguments show up in `ps` output and in shell history - say so once.
    console.warn(
      'NOTE: the password was passed on the command line, where it is visible to\n' +
        '      other processes and saved in shell history. Prefer QMS_OPERATOR_PASSWORD.'
    );
  }

  return { email, password };
}

// Firebase Auth error codes translated into something an operator can act on.
const SIGN_IN_HINTS = {
  'auth/invalid-credential':
    'Wrong password, or this email has no Firebase Auth account yet. With email\n' +
    '         enumeration protection on, Firebase returns the same code for both.\n' +
    '         An account is created the first time the user signs in through the app.',
  'auth/user-not-found':
    'No Firebase Auth account for this email. Sign in through the app once so the\n' +
    '         lazy migration creates it, then run this script again.',
  'auth/wrong-password': 'Wrong password.',
  'auth/invalid-email': 'That is not a valid email address.',
  'auth/user-disabled': 'This account is disabled in the Firebase console.',
  'auth/too-many-requests':
    'Firebase temporarily blocked sign-in from this machine after repeated failures.\n' +
    '         Wait a few minutes and try again.',
  'auth/operation-not-allowed':
    'Email/Password sign-in is not enabled for this project (Firebase console >\n' +
    '         Authentication > Sign-in method).',
  'auth/network-request-failed': 'No network connection to Firebase.',
  'auth/api-key-not-valid': 'NEXT_PUBLIC_FIREBASE_API_KEY in .env.local is not valid for this project.',
  'auth/configuration-not-found':
    'Firebase Authentication is not configured for this project, or\n' +
    '         NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN in .env.local is wrong.',
};

/** Sign in as the operator, or stop with a clear explanation. */
export async function signInOperator(auth, credentials) {
  try {
    const result = await signInWithEmailAndPassword(auth, credentials.email, credentials.password);
    console.log(`Signed in as ${credentials.email} (uid ${result.user.uid})\n`);
    return result.user;
  } catch (error) {
    const code = error?.code || '';
    fail(`Sign-in failed for ${credentials.email}${code ? ` (${code})` : ''}`, SIGN_IN_HINTS[code] || String(error?.message || error));
  }
}

/** Best-effort sign-out. Never let cleanup mask the real result of a run. */
export async function signOutQuietly(auth) {
  try {
    await signOut(auth);
  } catch {
    // Nothing to do - the process is about to exit anyway.
  }
}

/**
 * Turn a Firestore read failure into an operator-readable message. The most
 * likely cause by far is that the signed-in account is not allowed to read the
 * collection under the deployed rules.
 */
export function describeReadError(collectionName, error) {
  const code = error?.code || '';
  if (code === 'permission-denied') {
    return `${collectionName}: permission denied - the signed-in account is not allowed to read this collection under the deployed Firestore rules`;
  }
  if (code === 'unavailable') {
    return `${collectionName}: Firestore unreachable - check the network connection`;
  }
  return `${collectionName}: ${error?.message || error}`;
}
