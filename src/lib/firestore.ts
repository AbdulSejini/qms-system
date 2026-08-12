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
import { logger } from './logger';
import { User, Department, Section, AnnualPlan } from '@/types';

// ===========================================
// Collection Names
// ===========================================
const COLLECTIONS = {
  USERS: 'users',
  AUTH_USERS: 'authUsers',
  PASSWORDS: 'passwords',
  DEPARTMENTS: 'departments',
  SECTIONS: 'sections',
  AUDITS: 'audits',
  ANNUAL_PLANS: 'annualPlans',
  ACTIVE_SESSIONS: 'activeSessions',
  NOTIFICATIONS: 'notifications',
};

// ===========================================
// System Admin Constants
// ===========================================
export const SYSTEM_ADMIN_ID = 'system-admin-root';
export const SYSTEM_ADMIN_EMAIL = 'abdul.sejini@gmail.com';
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

// Check for plain object literals - class instances (Timestamp, GeoPoint, FieldValue
// sentinels such as serverTimestamp/deleteField) must be passed through untouched
const isPlainObject = (value: any): boolean => {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

// Convert Date objects to Firestore-compatible format and remove undefined values.
// Recurses through nested objects and arrays because Firestore rejects undefined at
// any depth (e.g. "Unsupported field value: undefined (found in field findings.0.sectionId)")
const prepareForFirestore = (data: any): any => {
  // Primitives and null pass through (null is valid in Firestore, only undefined is not)
  if (data === null || typeof data !== 'object') return data;

  // Convert Date objects to ISO strings for Firestore
  if (data instanceof Date) return data.toISOString();

  // Arrays stay arrays - drop undefined entries and prepare the rest
  if (Array.isArray(data)) {
    return data
      .filter(item => item !== undefined)
      .map(item => prepareForFirestore(item));
  }

  // Timestamps, sentinels and other class instances are left as-is
  if (!isPlainObject(data)) return data;

  const prepared: any = {};

  // Process each key
  Object.keys(data).forEach(key => {
    // Remove undefined values (Firestore doesn't accept undefined)
    if (data[key] === undefined) return;
    prepared[key] = prepareForFirestore(data[key]);
  });

  return prepared;
};

// ===========================================
// User Operations
// ===========================================

// Initialize system admin if not exists.
// No password is seeded here on purpose: this runs in the browser, so any seed value
// would be readable in the shipped bundle and would give every employee the highest
// privilege account. The admin document is created without a password and the login
// page offers a one-time first-run setup (see hasPassword) to set the real one.
// Returns true when the admin document is present (created now or already there).
export const initializeSystemAdmin = async (): Promise<boolean> => {
  try {
    const userRef = doc(db, COLLECTIONS.USERS, SYSTEM_ADMIN_ID);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      // Create system admin user document only
      await setDoc(userRef, prepareForFirestore(SYSTEM_ADMIN));
      logger.log('System admin document created');
    }

    return true;
  } catch (error) {
    // Once first-run setup has completed, the rules deny this read to an
    // unauthenticated caller by design - the bootstrap window is closed. That
    // is the expected steady state, not a fault, so it must not be reported as
    // an error on every page load. Anything else is still worth surfacing.
    if ((error as { code?: string })?.code === 'permission-denied') {
      return false;
    }
    console.error('Error initializing system admin:', error);
    return false;
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
    // The login page probes for the system administrator before anyone is
    // signed in. After first-run setup the rules deny that read on purpose, so
    // it is the normal steady state rather than a fault - callers treat null as
    // "no such user" either way. Log anything else.
    if ((error as { code?: string })?.code !== 'permission-denied') {
      console.error('Error getting user:', error);
    }
    return null;
  }
};

// Get user by email.
// An email must identify exactly one user document. Two documents sharing one is a data
// fault, not a choice this function may make on its own: the query returns them ordered
// by document id, and 'system-admin-root' sorts before every 'user-<timestamp>' id, so
// picking the first would hand a duplicated email the system administrator account.
// Callers all treat null as "no such user" (verifyCredentials, resolveAppUser and
// migrateLegacyUser in src/lib/auth.ts), so refusing is a denied sign-in, never a crash.
export const getUserByEmail = async (email: string): Promise<User | null> => {
  try {
    const normalizedEmail = email.toLowerCase();
    const usersRef = collection(db, COLLECTIONS.USERS);
    const q = query(usersRef, where('email', '==', normalizedEmail));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    if (snapshot.docs.length > 1) {
      // logger.error so this is visible in production too - it needs an operator
      logger.error(
        `Ambiguous email "${normalizedEmail}": ${snapshot.docs.length} user documents share it ` +
        `(${snapshot.docs.map(d => d.id).join(', ')}). Refusing to guess which account it is - ` +
        `remove the duplicate user document in Firestore.`
      );
      return null;
    }

    const userDoc = snapshot.docs[0];
    return convertTimestamps({ id: userDoc.id, ...userDoc.data() }) as User;
  } catch (error) {
    console.error('Error getting user by email:', error);
    return null;
  }
};

// Create or update user.
// Firestore rules authorize on the authUsers/{authUid} mapping, not on the user document,
// so a role or isActive change written only here would be accepted by the UI and then
// silently ignored by every rule - the user would keep their old privileges. Whenever the
// stored user document is already linked to an Auth account, the mapping is updated in the
// same operation. A mapping that does not exist yet is NOT created here: creating one is
// linkAuthUser's job (src/lib/auth.ts), at sign-in or at account creation.
export const saveUser = async (user: User): Promise<boolean> => {
  try {
    const userRef = doc(db, COLLECTIONS.USERS, user.id);

    // authUid is written onto the user document by linkAuthUser and is not part of the
    // User type, so a caller that rebuilt the object from a form may have dropped it.
    // Read the stored document rather than trusting what was handed to us - that also
    // keeps this setDoc (no merge) from wiping the link off an existing user.
    const passedAuthUid = (user as User & { authUid?: string }).authUid;
    let authUid = typeof passedAuthUid === 'string' && passedAuthUid.length > 0 ? passedAuthUid : '';

    if (!authUid) {
      const existingDoc = await getDoc(userRef);
      const storedAuthUid = existingDoc.exists() ? existingDoc.data().authUid : undefined;
      if (typeof storedAuthUid === 'string' && storedAuthUid.length > 0) {
        authUid = storedAuthUid;
      }
    }

    await setDoc(userRef, prepareForFirestore({
      ...user,
      ...(authUid ? { authUid } : {}),
    }));

    // Keep role and isActive in step with the document we just wrote. The user document is
    // written first on purpose: the rules compare the claimed role against the role on the
    // user document, so the two must already agree by the time the mapping is written.
    if (authUid) {
      const mappingRef = doc(db, COLLECTIONS.AUTH_USERS, authUid);
      const mappingDoc = await getDoc(mappingRef);

      if (mappingDoc.exists()) {
        try {
          // Merged write, and only the three keys the rules accept
          await setDoc(mappingRef, {
            userId: user.id,
            role: user.role,
            isActive: user.isActive !== false,
          }, { merge: true });
        } catch (mappingError) {
          // The user document changed but the authorization mapping did not. Reporting
          // success here is exactly the defect this guards against, so this counts as a
          // failed save even though half of it landed.
          logger.error('Error updating authUsers mapping for user:', user.id, mappingError);
          return false;
        }
      }
    }

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

// Outcome of a password-presence check. 'unknown' means the check itself could not be
// completed (rules not deployed, offline, blocked domain, expired session) and must never
// be treated as 'missing' - that would advertise a first-run setup on a live system.
export type PasswordState = 'missing' | 'present' | 'unknown';

// Check whether a password has been set for a user (used for first-run setup).
// A document holding an empty value counts as 'missing' so this agrees with
// verifyPassword, which only accepts a non-empty stored value.
export const hasPassword = async (userId: string): Promise<PasswordState> => {
  try {
    const passwordRef = doc(db, COLLECTIONS.PASSWORDS, userId);
    const passwordDoc = await getDoc(passwordRef);

    if (!passwordDoc.exists()) {
      return 'missing';
    }

    const storedPassword = passwordDoc.data().password;
    return typeof storedPassword === 'string' && storedPassword.length > 0 ? 'present' : 'missing';
  } catch (error) {
    console.error('Error checking password:', error);
    return 'unknown';
  }
};

// Set password for user (with bcrypt hashing)
export const setPassword = async (userId: string, password: string): Promise<boolean> => {
  try {
    // Dynamically import bcrypt to avoid SSR issues
    const bcrypt = (await import('bcryptjs')).default;
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const passwordRef = doc(db, COLLECTIONS.PASSWORDS, userId);
    await setDoc(passwordRef, { password: hashedPassword });
    return true;
  } catch (error) {
    console.error('Error setting password:', error);
    return false;
  }
};

// Verify a user's password (handles both bcrypt hashes and legacy plaintext values)
export const verifyPassword = async (userId: string, plainPassword: string): Promise<boolean> => {
  try {
    const storedPassword = await getPassword(userId);
    if (!storedPassword) {
      return false;
    }

    // Stored value is a bcrypt hash
    if (/^\$2[aby]\$/.test(storedPassword)) {
      // Dynamically import bcrypt to avoid SSR issues
      const bcrypt = (await import('bcryptjs')).default;
      return await bcrypt.compare(plainPassword, storedPassword);
    }

    // Legacy plaintext value - compare directly and upgrade it to a hash
    if (storedPassword === plainPassword) {
      await setPassword(userId, plainPassword);
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error verifying password:', error);
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
    logger.log('Session activity updated for:', userId);
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
  'audit_scheduled' | 'corrective_action_response_required' | 'new_finding' |
  // الخطة السنوية - يرسلها مدير الجودة للمعتمِد الذي اختاره، ويعود قراره إليه
  'plan_approval_request' | 'plan_approved' | 'plan_rejected' | 'general';
  title: string;
  message: string;
  recipientId: string; // User ID who should receive this notification
  senderId?: string; // User ID who triggered this notification
  auditId?: string;
  planId?: string; // Annual plan this notification is about (plan_* types)
  read: boolean;
  createdAt: string;
}

// Add notification
export const addNotification = async (notification: Omit<Notification, 'id' | 'createdAt' | 'read'>): Promise<string | null> => {
  try {
    logger.log('Adding notification:', {
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

    logger.log('Notification added successfully:', notificationId);
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
    logger.log('Notifications snapshot received:', snapshot.docs.length, 'for user:', userId);
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
  number?: string; // Display number (e.g. AUD-1712345678901) - see getAuditNumber
  titleAr: string;
  titleEn: string;
  type: 'internal' | 'external' | 'surveillance' | 'certification';
  status: 'draft' | 'pending_approval' | 'approved' | 'in_progress' | 'completed' | 'cancelled' | 'postponed' | 'planning' | 'execution' | 'qms_review' | 'corrective_actions' | 'verification';
  currentStage?: number; // 0=planning, 1=execution, 2=qms_review, 3=corrective_actions, 4=verification, 5=completed
  departmentId: string;
  sectionId?: string;
  leadAuditorId: string;
  teamMemberIds: string[];
  startDate: string;
  endDate: string;
  objectives?: string;
  scope?: string;
  criteria?: string;
  questions?: any[]; // Audit questions with answers
  findings?: any[];
  qmsApproval?: any; // QMS approval data
  qmsApprovalData?: any; // Detailed QMS approval data
  activityLog?: any[]; // Activity log
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

// Get the audit display number - audits created without a number field fall back to
// the same synthesis everywhere, so every page renders the identical value
export const getAuditNumber = (audit: { id: string; number?: string }): string => {
  return audit.number || audit.id.replace('audit-', 'AUD-');
};

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
// Annual Audit Plan Operations
// ===========================================
//
// The annual internal audit plan: the quality manager enters one plan per year, listing
// which department/section is audited in which month, and submits it for approval. The
// approver is not a fixed person - approverId is chosen by the quality manager from the
// system's users on each plan (see AnnualPlan in src/types/index.ts).
//
// The plan document holds its items inline, exactly as an audit holds its questions and
// findings; there are no subcollections.

// Get all annual plans
export const getAllAnnualPlans = async (): Promise<AnnualPlan[]> => {
  try {
    const plansRef = collection(db, COLLECTIONS.ANNUAL_PLANS);
    const snapshot = await getDocs(plansRef);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as AnnualPlan);
  } catch (error) {
    console.error('Error getting annual plans:', error);
    return [];
  }
};

// Get annual plan by ID
export const getAnnualPlanById = async (planId: string): Promise<AnnualPlan | null> => {
  try {
    const planRef = doc(db, COLLECTIONS.ANNUAL_PLANS, planId);
    const planDoc = await getDoc(planRef);
    if (planDoc.exists()) {
      return { id: planDoc.id, ...planDoc.data() } as AnnualPlan;
    }
    return null;
  } catch (error) {
    console.error('Error getting annual plan:', error);
    return null;
  }
};

// Get the annual plan for a year. One year is meant to have one plan, and the pages use
// this both to open a year and to check before creating a new one. Should a year ever end
// up with more than one document (a rejected plan replaced by a fresh one, two people
// creating at once), the most recently updated is returned rather than an arbitrary one,
// and the duplicate is reported so an operator can merge or remove it.
export const getAnnualPlanByYear = async (year: number): Promise<AnnualPlan | null> => {
  try {
    const plansRef = collection(db, COLLECTIONS.ANNUAL_PLANS);
    const q = query(plansRef, where('year', '==', year));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    const plans = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as AnnualPlan);

    if (plans.length > 1) {
      // logger.error so this is visible in production too - it needs an operator
      logger.error(
        `Duplicate annual plans for year ${year}: ${plans.length} documents ` +
        `(${plans.map(p => p.id).join(', ')}). Returning the most recently updated one.`
      );
      plans.sort((a, b) =>
        new Date(b.updatedAt || b.createdAt || 0).getTime() -
        new Date(a.updatedAt || a.createdAt || 0).getTime()
      );
    }

    return plans[0];
  } catch (error) {
    console.error('Error getting annual plan by year:', error);
    return null;
  }
};

// Create new annual plan - returns the new plan id
export const createAnnualPlan = async (
  planData: Omit<AnnualPlan, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string | null> => {
  try {
    const planId = `plan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const planRef = doc(db, COLLECTIONS.ANNUAL_PLANS, planId);
    await setDoc(planRef, prepareForFirestore({
      ...planData,
      id: planId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
    return planId;
  } catch (error) {
    console.error('Error creating annual plan:', error);
    return null;
  }
};

// Update annual plan (items, status, approval decision)
export const updateAnnualPlan = async (planId: string, updates: Partial<AnnualPlan>): Promise<boolean> => {
  try {
    const planRef = doc(db, COLLECTIONS.ANNUAL_PLANS, planId);
    await updateDoc(planRef, prepareForFirestore({
      ...updates,
      updatedAt: new Date().toISOString(),
    }));
    return true;
  } catch (error) {
    console.error('Error updating annual plan:', error);
    return false;
  }
};

// Delete annual plan
export const deleteAnnualPlan = async (planId: string): Promise<boolean> => {
  try {
    const planRef = doc(db, COLLECTIONS.ANNUAL_PLANS, planId);
    await deleteDoc(planRef);
    return true;
  } catch (error) {
    console.error('Error deleting annual plan:', error);
    return false;
  }
};

// Subscribe to annual plans (real-time)
export const subscribeToAnnualPlans = (
  callback: (plans: AnnualPlan[]) => void
): Unsubscribe => {
  const plansRef = collection(db, COLLECTIONS.ANNUAL_PLANS);

  return onSnapshot(plansRef, (snapshot) => {
    const plans = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as AnnualPlan);
    callback(plans);
  }, (error) => {
    console.error('Error listening to annual plans:', error);
    callback([]);
  });
};

// ===========================================
// Authentication
// ===========================================

// Verify user credentials (delegates to verifyPassword)
export const verifyCredentials = async (email: string, password: string): Promise<User | null> => {
  try {
    // Initialize system admin if needed
    await initializeSystemAdmin();

    // Find user by email
    const user = await getUserByEmail(email);
    if (!user || !user.isActive) {
      return null;
    }

    // Verify password (bcrypt hash or legacy plaintext)
    const isPasswordValid = await verifyPassword(user.id, password);
    if (!isPasswordValid) {
      return null;
    }

    return user;
  } catch (error) {
    console.error('Error verifying credentials:', error);
    return null;
  }
};

