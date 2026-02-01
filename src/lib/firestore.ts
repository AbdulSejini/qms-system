// Firestore database service
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { User, Department, Section } from '@/types';

// ===========================================
// Collection Names
// ===========================================
const COLLECTIONS = {
  USERS: 'users',
  PASSWORDS: 'passwords',
  DEPARTMENTS: 'departments',
  SECTIONS: 'sections',
  AUDITS: 'audits',
  ACTIVE_SESSIONS: 'activeSessions',
};

// ===========================================
// System Admin Constants
// ===========================================
export const SYSTEM_ADMIN_ID = 'system-admin-root';
export const SYSTEM_ADMIN_EMAIL = 'abdul.sejini@gmail.com';
export const SYSTEM_ADMIN_PASSWORD = 'Doha@1988';
export const DEFAULT_PASSWORD = 'Welcome@123';

export const SYSTEM_ADMIN: User = {
  id: SYSTEM_ADMIN_ID,
  employeeNumber: 'SYS-0001',
  email: SYSTEM_ADMIN_EMAIL,
  fullNameAr: 'مدير النظام',
  fullNameEn: 'System Administrator',
  role: 'system_admin',
  departmentId: '',
  sectionId: '',
  canBeAuditor: true,
  auditableDepartmentIds: [],
  auditableSectionIds: [],
  phone: '+966500000000',
  jobTitleAr: 'مدير النظام',
  jobTitleEn: 'System Administrator',
  isActive: true,
  isSystemAccount: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

// ===========================================
// Helper Functions
// ===========================================

// Convert Firestore timestamps to Date objects
const convertTimestamps = (data: any): any => {
  if (!data) return data;

  const converted = { ...data };

  // Convert known timestamp fields
  const timestampFields = ['createdAt', 'updatedAt', 'lastLoginAt', 'loginAt', 'lastActivity'];
  timestampFields.forEach(field => {
    if (converted[field] && converted[field] instanceof Timestamp) {
      converted[field] = converted[field].toDate();
    } else if (converted[field] && typeof converted[field] === 'string') {
      converted[field] = new Date(converted[field]);
    }
  });

  return converted;
};

// Convert Date objects to Firestore-compatible format
const prepareForFirestore = (data: any): any => {
  if (!data) return data;

  const prepared = { ...data };

  // Convert Date objects to ISO strings for Firestore
  Object.keys(prepared).forEach(key => {
    if (prepared[key] instanceof Date) {
      prepared[key] = prepared[key].toISOString();
    }
  });

  return prepared;
};

// ===========================================
// User Operations
// ===========================================

// Initialize system admin if not exists
export const initializeSystemAdmin = async (): Promise<void> => {
  try {
    const userRef = doc(db, COLLECTIONS.USERS, SYSTEM_ADMIN_ID);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      // Create system admin user
      await setDoc(userRef, prepareForFirestore(SYSTEM_ADMIN));

      // Create system admin password
      const passwordRef = doc(db, COLLECTIONS.PASSWORDS, SYSTEM_ADMIN_ID);
      await setDoc(passwordRef, { password: SYSTEM_ADMIN_PASSWORD });

      console.log('System admin initialized successfully');
    }
  } catch (error) {
    console.error('Error initializing system admin:', error);
  }
};

// Get all users
export const getAllUsers = async (): Promise<User[]> => {
  try {
    const usersRef = collection(db, COLLECTIONS.USERS);
    const snapshot = await getDocs(usersRef);

    return snapshot.docs.map(doc => convertTimestamps({ id: doc.id, ...doc.data() }) as User);
  } catch (error) {
    console.error('Error getting users:', error);
    return [];
  }
};

// Get visible users (excluding system accounts)
export const getVisibleUsers = async (): Promise<User[]> => {
  try {
    const allUsers = await getAllUsers();
    return allUsers.filter(u => !u.isSystemAccount);
  } catch (error) {
    console.error('Error getting visible users:', error);
    return [];
  }
};

// Get user by ID
export const getUserById = async (userId: string): Promise<User | null> => {
  try {
    const userRef = doc(db, COLLECTIONS.USERS, userId);
    const userDoc = await getDoc(userRef);

    if (userDoc.exists()) {
      return convertTimestamps({ id: userDoc.id, ...userDoc.data() }) as User;
    }
    return null;
  } catch (error) {
    console.error('Error getting user:', error);
    return null;
  }
};

// Get user by email
export const getUserByEmail = async (email: string): Promise<User | null> => {
  try {
    const usersRef = collection(db, COLLECTIONS.USERS);
    const q = query(usersRef, where('email', '==', email.toLowerCase()));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      return convertTimestamps({ id: doc.id, ...doc.data() }) as User;
    }
    return null;
  } catch (error) {
    console.error('Error getting user by email:', error);
    return null;
  }
};

// Create or update user
export const saveUser = async (user: User): Promise<boolean> => {
  try {
    const userRef = doc(db, COLLECTIONS.USERS, user.id);
    await setDoc(userRef, prepareForFirestore(user));
    return true;
  } catch (error) {
    console.error('Error saving user:', error);
    return false;
  }
};

// Delete user
export const deleteUser = async (userId: string): Promise<boolean> => {
  try {
    const userRef = doc(db, COLLECTIONS.USERS, userId);
    await deleteDoc(userRef);

    // Also delete password
    const passwordRef = doc(db, COLLECTIONS.PASSWORDS, userId);
    await deleteDoc(passwordRef);

    return true;
  } catch (error) {
    console.error('Error deleting user:', error);
    return false;
  }
};

// ===========================================
// Password Operations
// ===========================================

// Get password for user
export const getPassword = async (userId: string): Promise<string | null> => {
  try {
    const passwordRef = doc(db, COLLECTIONS.PASSWORDS, userId);
    const passwordDoc = await getDoc(passwordRef);

    if (passwordDoc.exists()) {
      return passwordDoc.data().password;
    }
    return null;
  } catch (error) {
    console.error('Error getting password:', error);
    return null;
  }
};

// Set password for user
export const setPassword = async (userId: string, password: string): Promise<boolean> => {
  try {
    const passwordRef = doc(db, COLLECTIONS.PASSWORDS, userId);
    await setDoc(passwordRef, { password });
    return true;
  } catch (error) {
    console.error('Error setting password:', error);
    return false;
  }
};

// Reset password to default
export const resetPassword = async (userId: string): Promise<boolean> => {
  return setPassword(userId, DEFAULT_PASSWORD);
};

// ===========================================
// Department Operations
// ===========================================

// Get all departments
export const getAllDepartments = async (): Promise<Department[]> => {
  try {
    const deptsRef = collection(db, COLLECTIONS.DEPARTMENTS);
    const snapshot = await getDocs(deptsRef);

    return snapshot.docs.map(doc => convertTimestamps({ id: doc.id, ...doc.data() }) as Department);
  } catch (error) {
    console.error('Error getting departments:', error);
    return [];
  }
};

// Get department by ID
export const getDepartmentById = async (deptId: string): Promise<Department | null> => {
  try {
    const deptRef = doc(db, COLLECTIONS.DEPARTMENTS, deptId);
    const deptDoc = await getDoc(deptRef);

    if (deptDoc.exists()) {
      return convertTimestamps({ id: deptDoc.id, ...deptDoc.data() }) as Department;
    }
    return null;
  } catch (error) {
    console.error('Error getting department:', error);
    return null;
  }
};

// Save department
export const saveDepartment = async (dept: Department): Promise<boolean> => {
  try {
    const deptRef = doc(db, COLLECTIONS.DEPARTMENTS, dept.id);
    await setDoc(deptRef, prepareForFirestore(dept));
    return true;
  } catch (error) {
    console.error('Error saving department:', error);
    return false;
  }
};

// Delete department
export const deleteDepartment = async (deptId: string): Promise<boolean> => {
  try {
    const deptRef = doc(db, COLLECTIONS.DEPARTMENTS, deptId);
    await deleteDoc(deptRef);
    return true;
  } catch (error) {
    console.error('Error deleting department:', error);
    return false;
  }
};

// ===========================================
// Section Operations
// ===========================================

// Get all sections
export const getAllSections = async (): Promise<Section[]> => {
  try {
    const sectionsRef = collection(db, COLLECTIONS.SECTIONS);
    const snapshot = await getDocs(sectionsRef);

    return snapshot.docs.map(doc => convertTimestamps({ id: doc.id, ...doc.data() }) as Section);
  } catch (error) {
    console.error('Error getting sections:', error);
    return [];
  }
};

// Get sections by department
export const getSectionsByDepartment = async (deptId: string): Promise<Section[]> => {
  try {
    const sectionsRef = collection(db, COLLECTIONS.SECTIONS);
    const q = query(sectionsRef, where('departmentId', '==', deptId));
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => convertTimestamps({ id: doc.id, ...doc.data() }) as Section);
  } catch (error) {
    console.error('Error getting sections by department:', error);
    return [];
  }
};

// Save section
export const saveSection = async (section: Section): Promise<boolean> => {
  try {
    const sectionRef = doc(db, COLLECTIONS.SECTIONS, section.id);
    await setDoc(sectionRef, prepareForFirestore(section));
    return true;
  } catch (error) {
    console.error('Error saving section:', error);
    return false;
  }
};

// Delete section
export const deleteSection = async (sectionId: string): Promise<boolean> => {
  try {
    const sectionRef = doc(db, COLLECTIONS.SECTIONS, sectionId);
    await deleteDoc(sectionRef);
    return true;
  } catch (error) {
    console.error('Error deleting section:', error);
    return false;
  }
};

// ===========================================
// Active Sessions Operations
// ===========================================

// Add active session
export const addActiveSession = async (userId: string, sessionData: any): Promise<boolean> => {
  try {
    const sessionRef = doc(db, COLLECTIONS.ACTIVE_SESSIONS, userId);
    await setDoc(sessionRef, prepareForFirestore({
      ...sessionData,
      userId,
      lastActivity: new Date().toISOString(),
    }));
    return true;
  } catch (error) {
    console.error('Error adding active session:', error);
    return false;
  }
};

// Remove active session
export const removeActiveSession = async (userId: string): Promise<boolean> => {
  try {
    const sessionRef = doc(db, COLLECTIONS.ACTIVE_SESSIONS, userId);
    await deleteDoc(sessionRef);
    return true;
  } catch (error) {
    console.error('Error removing active session:', error);
    return false;
  }
};

// Get all active sessions
export const getActiveSessions = async (): Promise<any[]> => {
  try {
    const sessionsRef = collection(db, COLLECTIONS.ACTIVE_SESSIONS);
    const snapshot = await getDocs(sessionsRef);

    return snapshot.docs.map(doc => convertTimestamps({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting active sessions:', error);
    return [];
  }
};

// ===========================================
// Authentication
// ===========================================

// Verify user credentials
export const verifyCredentials = async (email: string, password: string): Promise<User | null> => {
  try {
    // Initialize system admin if needed
    await initializeSystemAdmin();

    // Find user by email
    const user = await getUserByEmail(email);
    if (!user || !user.isActive) {
      return null;
    }

    // Verify password
    const storedPassword = await getPassword(user.id);
    if (storedPassword !== password) {
      return null;
    }

    return user;
  } catch (error) {
    console.error('Error verifying credentials:', error);
    return null;
  }
};
