// Firebase configuration and initialization
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDsY14_fjATqzglE-lHP7vPzBIZ01n5rLY",
  authDomain: "qms-saudicable.firebaseapp.com",
  projectId: "qms-saudicable",
  storageBucket: "qms-saudicable.firebasestorage.app",
  messagingSenderId: "293408682531",
  appId: "1:293408682531:web:113d1b4a8f4bac9d787796",
  measurementId: "G-B8W5RCBR32"
};

// Initialize Firebase only if it hasn't been initialized
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Initialize Firestore
export const db = getFirestore(app);

export default app;
