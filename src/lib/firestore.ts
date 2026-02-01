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
  onSnapshot,
  Unsubscribe,
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
  NOTIFICATIONS: 'notifications',
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

// Convert Date objects to Firestore-compatible format and remove undefined values
const prepareForFirestore = (data: any): any => {
  if (!data) return data;

  const prepared = { ...data };

  // Process each key
  Object.keys(prepared).forEach(key => {
    // Remove undefined values (Firestore doesn't accept undefined)
    if (prepared[key] === undefined) {
      delete prepared[key];
    }
    // Convert Date objects to ISO strings for Firestore
    else if (prepared[key] instanceof Date) {
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

// Update last activity for a session (v2 - fixed to use setDoc with merge)
export const updateSessionActivity = async (userId: string): Promise<boolean> => {
  try {
    const sessionRef = doc(db, COLLECTIONS.ACTIVE_SESSIONS, userId);
    // Use setDoc with merge to create or update the session (prevents "No document to update" error)
    await setDoc(sessionRef, {
      userId: userId,
      lastActivity: new Date().toISOString(),
    }, { merge: true });
    console.log('Session activity updated for:', userId);
    return true;
  } catch (error) {
    console.error('Error updating session activity:', error);
    return false;
  }
};

// Subscribe to active sessions changes (real-time listener)
export const subscribeToActiveSessions = (
  callback: (sessions: any[]) => void
): Unsubscribe => {
  const sessionsRef = collection(db, COLLECTIONS.ACTIVE_SESSIONS);

  return onSnapshot(sessionsRef, (snapshot) => {
    const sessions = snapshot.docs.map(doc =>
      convertTimestamps({ id: doc.id, ...doc.data() })
    );
    callback(sessions);
  }, (error) => {
    console.error('Error listening to active sessions:', error);
    callback([]);
  });
};

// Clean up stale sessions (older than 30 minutes)
export const cleanupStaleSessions = async (): Promise<void> => {
  try {
    const sessionsRef = collection(db, COLLECTIONS.ACTIVE_SESSIONS);
    const snapshot = await getDocs(sessionsRef);
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    const deletePromises = snapshot.docs
      .filter(doc => {
        const data = doc.data();
        const lastActivity = data.lastActivity ? new Date(data.lastActivity) : new Date(0);
        return lastActivity < thirtyMinutesAgo;
      })
      .map(doc => deleteDoc(doc.ref));

    await Promise.all(deletePromises);
  } catch (error) {
    console.error('Error cleaning up stale sessions:', error);
  }
};

// ===========================================
// Notifications Operations
// ===========================================

// Notification type
export interface Notification {
  id: string;
  type: 'audit_approval_request' | 'audit_approved' | 'audit_rejected' | 'audit_postponed' |
        'audit_modification_requested' | 'audit_modification_submitted' | 'audit_team_assignment' |
        'audit_scheduled' | 'corrective_action_response_required' | 'new_finding' | 'general';
  title: string;
  message: string;
  recipientId: string; // User ID who should receive this notification
  senderId?: string; // User ID who triggered this notification
  auditId?: string;
  read: boolean;
  createdAt: string;
}

// Add notification
export const addNotification = async (notification: Omit<Notification, 'id' | 'createdAt' | 'read'>): Promise<string | null> => {
  try {
    console.log('Adding notification:', {
      type: notification.type,
      recipientId: notification.recipientId,
      title: notification.title,
    });

    const notificationId = `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const notificationRef = doc(db, COLLECTIONS.NOTIFICATIONS, notificationId);
    await setDoc(notificationRef, prepareForFirestore({
      ...notification,
      id: notificationId,
      read: false,
      createdAt: new Date().toISOString(),
    }));

    console.log('Notification added successfully:', notificationId);
    return notificationId;
  } catch (error) {
    console.error('Error adding notification:', error);
    return null;
  }
};

// Get notifications for a user
export const getNotificationsForUser = async (userId: string): Promise<Notification[]> => {
  try {
    const notificationsRef = collection(db, COLLECTIONS.NOTIFICATIONS);
    const q = query(notificationsRef, where('recipientId', '==', userId), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => convertTimestamps({ ...doc.data() }) as Notification);
  } catch (error) {
    console.error('Error getting notifications:', error);
    return [];
  }
};

// Subscribe to notifications for a user (real-time)
export const subscribeToNotifications = (
  userId: string,
  callback: (notifications: Notification[]) => void
): Unsubscribe => {
  const notificationsRef = collection(db, COLLECTIONS.NOTIFICATIONS);
  // Simple query without orderBy to avoid composite index requirement
  const q = query(notificationsRef, where('recipientId', '==', userId));

  return onSnapshot(q, (snapshot) => {
    console.log('Notifications snapshot received:', snapshot.docs.length, 'for user:', userId);
    const notifications = snapshot.docs
      .map(doc => convertTimestamps({ ...doc.data() }) as Notification)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); // Sort in JS instead
    callback(notifications);
  }, (error) => {
    console.error('Error listening to notifications:', error);
    // If index is required, Firestore will throw an error with a link to create it
    if (error.message?.includes('index')) {
      console.error('Firestore index required. Check console for the link to create it.');
    }
    callback([]);
  });
};

// Mark notification as read
export const markNotificationAsRead = async (notificationId: string): Promise<boolean> => {
  try {
    const notificationRef = doc(db, COLLECTIONS.NOTIFICATIONS, notificationId);
    await updateDoc(notificationRef, { read: true });
    return true;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return false;
  }
};

// Mark all notifications as read for a user
export const markAllNotificationsAsRead = async (userId: string): Promise<boolean> => {
  try {
    const notificationsRef = collection(db, COLLECTIONS.NOTIFICATIONS);
    const q = query(notificationsRef, where('recipientId', '==', userId), where('read', '==', false));
    const snapshot = await getDocs(q);

    const updatePromises = snapshot.docs.map(doc =>
      updateDoc(doc.ref, { read: true })
    );
    await Promise.all(updatePromises);
    return true;
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return false;
  }
};

// Delete notification
export const deleteNotification = async (notificationId: string): Promise<boolean> => {
  try {
    const notificationRef = doc(db, COLLECTIONS.NOTIFICATIONS, notificationId);
    await deleteDoc(notificationRef);
    return true;
  } catch (error) {
    console.error('Error deleting notification:', error);
    return false;
  }
};

// ===========================================
// Audit Operations
// ===========================================

// Audit interface
export interface Audit {
  id: string;
  titleAr: string;
  titleEn: string;
  type: 'internal' | 'external' | 'surveillance' | 'certification';
  status: 'draft' | 'pending_approval' | 'approved' | 'in_progress' | 'completed' | 'cancelled' | 'postponed';
  departmentId: string;
  sectionId?: string;
  leadAuditorId: string;
  teamMemberIds: string[];
  startDate: string;
  endDate: string;
  objectives?: string;
  scope?: string;
  criteria?: string;
  findings?: any[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  postponedTo?: string;
  postponeReason?: string;
}

// Get all audits
export const getAllAudits = async (): Promise<Audit[]> => {
  try {
    const auditsRef = collection(db, COLLECTIONS.AUDITS);
    const snapshot = await getDocs(auditsRef);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Audit);
  } catch (error) {
    console.error('Error getting audits:', error);
    return [];
  }
};

// Get audit by ID
export const getAuditById = async (auditId: string): Promise<Audit | null> => {
  try {
    const auditRef = doc(db, COLLECTIONS.AUDITS, auditId);
    const auditDoc = await getDoc(auditRef);
    if (auditDoc.exists()) {
      return { id: auditDoc.id, ...auditDoc.data() } as Audit;
    }
    return null;
  } catch (error) {
    console.error('Error getting audit:', error);
    return null;
  }
};

// Save audit (create or update)
export const saveAudit = async (audit: Audit): Promise<boolean> => {
  try {
    const auditRef = doc(db, COLLECTIONS.AUDITS, audit.id);
    await setDoc(auditRef, prepareForFirestore({
      ...audit,
      updatedAt: new Date().toISOString(),
    }));
    return true;
  } catch (error) {
    console.error('Error saving audit:', error);
    return false;
  }
};

// Create new audit
export const createAudit = async (auditData: Omit<Audit, 'id' | 'createdAt' | 'updatedAt'>): Promise<string | null> => {
  try {
    const auditId = `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const auditRef = doc(db, COLLECTIONS.AUDITS, auditId);
    await setDoc(auditRef, prepareForFirestore({
      ...auditData,
      id: auditId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
    return auditId;
  } catch (error) {
    console.error('Error creating audit:', error);
    return null;
  }
};

// Update audit
export const updateAudit = async (auditId: string, updates: Partial<Audit>): Promise<boolean> => {
  try {
    const auditRef = doc(db, COLLECTIONS.AUDITS, auditId);
    await updateDoc(auditRef, prepareForFirestore({
      ...updates,
      updatedAt: new Date().toISOString(),
    }));
    return true;
  } catch (error) {
    console.error('Error updating audit:', error);
    return false;
  }
};

// Delete audit
export const deleteAudit = async (auditId: string): Promise<boolean> => {
  try {
    const auditRef = doc(db, COLLECTIONS.AUDITS, auditId);
    await deleteDoc(auditRef);
    return true;
  } catch (error) {
    console.error('Error deleting audit:', error);
    return false;
  }
};

// Subscribe to audits (real-time)
export const subscribeToAudits = (
  callback: (audits: Audit[]) => void
): Unsubscribe => {
  const auditsRef = collection(db, COLLECTIONS.AUDITS);

  return onSnapshot(auditsRef, (snapshot) => {
    const audits = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Audit);
    callback(audits);
  }, (error) => {
    console.error('Error listening to audits:', error);
    callback([]);
  });
};

// Get audits by department
export const getAuditsByDepartment = async (departmentId: string): Promise<Audit[]> => {
  try {
    const auditsRef = collection(db, COLLECTIONS.AUDITS);
    const q = query(auditsRef, where('departmentId', '==', departmentId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Audit);
  } catch (error) {
    console.error('Error getting audits by department:', error);
    return [];
  }
};

// Get audits by lead auditor
export const getAuditsByLeadAuditor = async (auditorId: string): Promise<Audit[]> => {
  try {
    const auditsRef = collection(db, COLLECTIONS.AUDITS);
    const q = query(auditsRef, where('leadAuditorId', '==', auditorId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Audit);
  } catch (error) {
    console.error('Error getting audits by lead auditor:', error);
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

