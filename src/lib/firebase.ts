// Firebase configuration and initialization
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, type Firestore } from 'firebase/firestore';
import { getAuth, connectAuthEmulator, type Auth } from 'firebase/auth';

// Exported so callers that must create an account without disturbing the current
// session (the Users page) can spin up a secondary app instance:
//   initializeApp(firebaseConfig, 'userCreation') -> getAuth(secondaryApp)
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// ===========================================
// Local emulator - محاكي محلي
// ===========================================
//
// THE GATE IS DELIBERATELY STRICT. Only the exact string 'true' turns this on, and the
// variable is absent from .env.local, so production builds can never drift into pointing
// at an emulator that is not there. It is opt-in per developer, through .env.emulator.
//
// Every Firebase app instance in this codebase must be routed, not just the default one:
// src/lib/auth.ts creates a SECONDARY instance ('userCreation') to onboard employees
// without disturbing the administrator's session. If that instance kept talking to the
// real project while the rest of the app talked to the emulator, onboarding a test
// employee would create a REAL account in the live project. Hence connectEmulators is
// exported and called for both.
export const USE_EMULATOR = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true';

const EMULATOR_HOST = process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_HOST || '127.0.0.1';
const FIRESTORE_PORT = Number(process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_PORT || 8080);
const AUTH_PORT = Number(process.env.NEXT_PUBLIC_AUTH_EMULATOR_PORT || 9099);

// connectAuthEmulator/connectFirestoreEmulator throw when an instance is connected twice,
// and Next.js re-executes modules across hot reloads, so each instance is remembered.
const routedAuth = new WeakSet<Auth>();
const routedDb = new WeakSet<Firestore>();

export const connectEmulators = (authInstance: Auth, dbInstance: Firestore): void => {
  if (!USE_EMULATOR) return;

  if (!routedAuth.has(authInstance)) {
    connectAuthEmulator(authInstance, `http://${EMULATOR_HOST}:${AUTH_PORT}`, {
      disableWarnings: true,
    });
    routedAuth.add(authInstance);
  }

  if (!routedDb.has(dbInstance)) {
    connectFirestoreEmulator(dbInstance, EMULATOR_HOST, FIRESTORE_PORT);
    routedDb.add(dbInstance);
  }
};

// Initialize Firebase only if it hasn't been initialized
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Initialize Firestore
export const db = getFirestore(app);

// Initialize Firebase Auth - its own persistence replaces the old localStorage session
export const auth = getAuth(app);

connectEmulators(auth, db);

// Said out loud on purpose: an emulator session holds no real data, and mistaking it for
// the live system is the one way this setting can cost anybody anything.
if (USE_EMULATOR && typeof window !== 'undefined') {
  console.warn(
    `[QMS] Firebase EMULATOR mode - ${EMULATOR_HOST}:${FIRESTORE_PORT} (Firestore), ` +
      `${EMULATOR_HOST}:${AUTH_PORT} (Auth). No live data is being read or written.`
  );
}

export default app;
