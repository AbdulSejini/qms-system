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
  DocumentReference,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import { logger } from './logger';
import { User, Department, Section, AnnualPlan, Audit } from '@/types';

// ===========================================
// Collection Names
// ===========================================
// Exported so src/lib/activity-log.ts names the same collections this file does
// rather than repeating the strings.
export const COLLECTIONS = {
  USERS: 'users',
  AUTH_USERS: 'authUsers',
  PASSWORDS: 'passwords',
  DEPARTMENTS: 'departments',
  SECTIONS: 'sections',
  AUDITS: 'audits',
  ANNUAL_PLANS: 'annualPlans',
  NOTIFICATIONS: 'notifications',
  ACTIVITY_LOG: 'activityLog',
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
// Onboarding - رمز الوصول لمرة واحدة
// ===========================================
//
// There is no working email service on this project, so a password-reset email cannot be
// the way a new employee gets in. Instead the administrator (or quality manager) creating
// the account is shown a random one-time ACCESS CODE on screen, reads it out to the
// employee in person, and the employee signs in with their email plus that code. The code
// IS the Firebase Auth password at creation time; mustChangePassword is set on the user
// document so the application forces a real password before anything else can be used.
//
// The code is deliberately NOT stored anywhere - not in Firestore, not in a field on the
// user document. Storing it would recreate exactly the known-password problem this
// replaces: a value that is readable by whoever can read the collection and that keeps
// working forever. Once it has been handed over and used it is gone; an employee who
// loses it gets a newly generated one from an administrator.

// Alphabet chosen for reading a code out loud and writing it down: no 0/O, no 1/I/L.
// 31 symbols, so 8 symbols carry log2(31^8) ≈ 39.6 bits - far past guessing, and Firebase
// Auth's 6-character minimum is met with room to spare (the code is 9 characters with the
// separator, 8 without).
const ACCESS_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const ACCESS_CODE_GROUPS = 2;
const ACCESS_CODE_GROUP_SIZE = 4;

// Generate a one-time access code, e.g. "K7RM-P2XD".
// Rejection sampling rather than a plain modulo: 256 is not a multiple of 31, so taking
// the remainder of a random byte would make the first few letters of the alphabet more
// likely than the last few. Bytes at or above the largest whole multiple of 31 are thrown
// away instead, which leaves every symbol exactly equally likely.
export const generateAccessCode = (): string => {
  const cryptoObj = globalThis.crypto;

  if (!cryptoObj?.getRandomValues) {
    // Falling back to Math.random here would produce a predictable code, which is the one
    // thing this must never be, so it refuses instead. Every browser this application
    // supports has Web Crypto.
    throw new Error('Cannot generate an access code: crypto.getRandomValues is unavailable');
  }

  const total = ACCESS_CODE_GROUPS * ACCESS_CODE_GROUP_SIZE;
  const limit = Math.floor(256 / ACCESS_CODE_ALPHABET.length) * ACCESS_CODE_ALPHABET.length;
  const symbols: string[] = [];

  while (symbols.length < total) {
    // Ask for what is still missing, plus headroom for the bytes that will be discarded
    const bytes = new Uint8Array(total - symbols.length + 8);
    cryptoObj.getRandomValues(bytes);

    for (let i = 0; i < bytes.length && symbols.length < total; i++) {
      if (bytes[i] >= limit) continue;
      symbols.push(ACCESS_CODE_ALPHABET[bytes[i] % ACCESS_CODE_ALPHABET.length]);
    }
  }

  const groups: string[] = [];
  for (let g = 0; g < ACCESS_CODE_GROUPS; g++) {
    groups.push(symbols.slice(g * ACCESS_CODE_GROUP_SIZE, (g + 1) * ACCESS_CODE_GROUP_SIZE).join(''));
  }

  return groups.join('-');
};

// Set or clear the "must set a real password before using anything" flag on a user.
// Set to true when the account is created with an access code, and to false by the
// forced-password screen once the employee has chosen their own password - which is also
// when onboarding is finished, so onboardedAt is stamped in the same write.
//
// NOTE for whoever wires the forced-password screen: firestore.rules currently allows
// `update` on users/{userId} to a system_admin only (plus the one-time bootstrap link-back),
// so an employee clearing their OWN flag is refused and this returns false. The rules need a
// self-update clause limited to exactly these two fields before the employee-side call can
// work; the administrator-side call (setting it to true at creation) is already permitted.
export const setMustChangePassword = async (userId: string, value: boolean): Promise<boolean> => {
  try {
    const userRef = doc(db, COLLECTIONS.USERS, userId);
    await updateDoc(userRef, prepareForFirestore({
      mustChangePassword: value,
      // Only meaningful when the flag is being cleared - that is the moment the employee
      // stopped being a half-created account and became a working one.
      ...(value ? {} : { onboardedAt: new Date().toISOString() }),
      updatedAt: new Date().toISOString(),
    }));
    return true;
  } catch (error) {
    console.error('Error setting mustChangePassword for user:', userId, error);
    return false;
  }
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
// Active Sessions Operations - REMOVED
// ===========================================
//
// The "who is online" feature is gone. Knowing that somebody has a tab open answered no
// question the business actually had, and the once-a-minute heartbeat it needed wrote to
// Firestore for every signed-in user all day long. What the owner wanted instead is a
// permanent record of what people DID: see src/lib/activity-log.ts, whose 'session'
// entries ('login' / 'logout' / 'login_failed') cover sign-in history properly.
//
// addActiveSession, removeActiveSession, getActiveSessions, updateSessionActivity,
// subscribeToActiveSessions and cleanupStaleSessions no longer exist, and nothing in the
// application reads or writes the activeSessions collection any more. The existing
// activeSessions documents in Firestore are deliberately left untouched.

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
  'plan_approval_request' | 'plan_approved' | 'plan_rejected' |
  // تعديل بند في خطة معتمدة: تغيير الفريق يمرّ بالمعتمِد نفسه، ويعود قراره لطالبه
  'plan_item_change_request' | 'plan_item_change_approved' | 'plan_item_change_rejected' |
  // تأكيد الموعد - يذهب للمراجع وللمراجَع عليه، ويعود ردّهما لمدير الجودة
  'schedule_confirmation_request' | 'schedule_accepted' | 'schedule_reschedule_requested' |
  // اعتماد قائمة الأسئلة ثم اعتماد الأجوبة - كلاهما من مدير الجودة
  'questions_approval_request' | 'questions_approved' | 'questions_rejected' |
  'answers_approval_request' | 'answers_approved' | 'answers_rejected' |
  'general';
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

// A FAILED READ IS NOT AN EMPTY ONE.
//
// Every subscription below used to answer a permission denial, a missing index or a dead
// connection by calling back with []. On screen that is indistinguishable from "you have
// no notifications" / "there are no audits" - which is precisely the complaint that
// approvals never arrive. The listener could have been refused at the door and the user
// would be told, in a calm empty state, that there was nothing for them.
//
// `onError` is optional so existing callers keep compiling, but every screen that shows a
// list a decision depends on should pass it and render the failure.
export type SubscriptionError = { code: string; message: string; needsIndex: boolean };

const describeSnapshotError = (error: { code?: string; message?: string }): SubscriptionError => ({
  code: error.code ?? 'unknown',
  message: error.message ?? String(error),
  needsIndex: !!error.message?.includes('index'),
});

// Subscribe to notifications for a user (real-time)
export const subscribeToNotifications = (
  userId: string,
  callback: (notifications: Notification[]) => void,
  onError?: (error: SubscriptionError) => void
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
    onError?.(describeSnapshotError(error));
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

// Remove every notification that belongs to one annual plan.
//
// A deleted plan used to leave its notifications standing, and a notification is visible on
// EVERY page - the bell lives in the header. So the approver kept being told that a plan
// awaited their decision after that plan had been deleted, and opening the notification
// landed on /plans?plan=<gone> which did nothing at all. A plan's notifications are part of
// the plan; they go when it goes.
//
// WHAT THE CALLER MAY REMOVE is settled in firestore.rules, not here: a system
// administrator may delete any notification, and everybody else may delete the ones
// addressed to them and the ones they themselves sent. For a plan that covers all of them,
// because the quality manager who deletes the plan is one or the other on every notification
// it ever produced - they sent the approval request and the recall notice, and they received
// the approval or the rejection from the approver they had picked. Anything a caller may not
// touch is counted in `failed` rather than silently ignored, so the page can say so.
//
// Both queries are equality-only. Firestore serves those by merging its automatic
// single-field indexes, so no composite index is needed - which matters here, because this
// project has no deployment step that could create one.
export const deleteNotificationsForPlan = async (
  planId: string,
  actor: { userId: string; isSystemAdmin: boolean }
): Promise<{ removed: number; failed: number }> => {
  const notificationsRef = collection(db, COLLECTIONS.NOTIFICATIONS);

  const queries = actor.isSystemAdmin
    ? [query(notificationsRef, where('planId', '==', planId))]
    : [
      query(notificationsRef, where('planId', '==', planId), where('recipientId', '==', actor.userId)),
      query(notificationsRef, where('planId', '==', planId), where('senderId', '==', actor.userId)),
    ];

  // The same notification can come back from both queries (the author notifying themselves
  // is not a shape the pages produce, but a Map costs nothing and a double delete would be
  // counted as a failure).
  const targets = new Map<string, DocumentReference>();
  let failed = 0;

  for (const q of queries) {
    try {
      const snapshot = await getDocs(q);
      snapshot.docs.forEach(entry => targets.set(entry.id, entry.ref));
    } catch (error) {
      // One query denied or offline must not stop the other from clearing what it can
      console.error('Error reading plan notifications for cleanup:', error);
      failed += 1;
    }
  }

  const results = await Promise.allSettled(
    Array.from(targets.values()).map(ref => deleteDoc(ref))
  );

  let removed = 0;
  results.forEach(result => {
    if (result.status === 'fulfilled') {
      removed += 1;
    } else {
      failed += 1;
      console.error('Error deleting plan notification:', result.reason);
    }
  });

  return { removed, failed };
};

// ===========================================
// Audit Operations
// ===========================================

// Audit, AuditQuestion and AuditFinding are DEFINED IN src/types/index.ts and re-exported
// here. There used to be a second, subtly different `Audit` declared in this file - it
// disagreed with the one in @/types about whether `currentStage` was a number or a string,
// and nothing caught it because nothing imported the other one. Callers that already say
// `import { Audit } from '@/lib/firestore'` keep working unchanged.
export type { Audit, AuditQuestion, AuditFinding, AuditStoredStatus } from '@/types';

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

// Delete audit.
//
// The plan line that spawned this audit is deliberately NOT rewritten here.
//
// AnnualPlanItem.auditId is written when an audit is created from a planned line and is
// never cleared, so a deleted audit leaves the plan pointing at something that no longer
// exists. The obvious fix - clear the field on delete - needs a firestore.rules branch
// permitting `id -> ''` on an approved plan, and adding one pushes the ruleset over the
// 1000-EXPRESSION CEILING. That is not a theoretical limit here: this project has already
// had plan approval die in production because of it, and Firestore reports the overrun as
// PERMISSION_DENIED, indistinguishable from a real authorization failure. Measured on the
// emulator, the mirrored rule broke seeding outright, and a merged single-evaluation
// version still answered from the ceiling rather than from the rule.
//
// So the stale id is left in place and made HARMLESS instead, by the two things that
// actually read it - see planItemAuditExists() below:
//   - plan progress counts a line as delivered only when its audit still exists;
//   - the new-audit wizard treats a line pointing at a missing audit as unlinked, so the
//     line can be planned again.
// Nothing else consults the field. If the rules ever gain headroom, unlinking here is the
// tidier answer; until then this costs nothing and cannot take the system down.
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

// Does the audit a plan line points at still exist? A line whose audit was deleted is an
// UNDELIVERED line, and must be plannable again.
export const planItemAuditExists = async (auditId: string | undefined): Promise<boolean> => {
  if (!auditId) return false;
  try {
    return (await getDoc(doc(db, COLLECTIONS.AUDITS, auditId))).exists();
  } catch (error) {
    // On a read failure, assume it exists: refusing to re-plan a line is recoverable,
    // silently creating a duplicate audit is not.
    console.error('Could not check whether a planned audit still exists:', error);
    return true;
  }
};

// Subscribe to ONE audit (real-time).
//
// The audit detail page was a one-shot getAuditById on mount. Two people working the same
// audit therefore never saw each other: the quality manager approved the answers and the
// auditor's screen went on showing them as unapproved until they reloaded by hand - and
// the auditor's next save wrote back a document assembled before the approval existed.
// "The approval doesn't arrive" was, in part, exactly this.
export const subscribeToAudit = (
  auditId: string,
  callback: (audit: Audit | null) => void,
  onError?: (error: SubscriptionError) => void
): Unsubscribe => {
  const auditRef = doc(db, COLLECTIONS.AUDITS, auditId);

  return onSnapshot(auditRef, (snapshot) => {
    callback(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as Audit) : null);
  }, (error) => {
    console.error('Error listening to audit:', error);
    onError?.(describeSnapshotError(error));
  });
};

// Subscribe to audits (real-time)
export const subscribeToAudits = (
  callback: (audits: Audit[]) => void,
  onError?: (error: SubscriptionError) => void
): Unsubscribe => {
  const auditsRef = collection(db, COLLECTIONS.AUDITS);

  return onSnapshot(auditsRef, (snapshot) => {
    const audits = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Audit);
    callback(audits);
  }, (error) => {
    console.error('Error listening to audits:', error);
    // Deliberately NOT callback([]): an empty list here reads as "no audits exist".
    onError?.(describeSnapshotError(error));
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

// Delete annual plan.
//
// The plan document is the only thing this removes. Its notifications are removed by
// deleteNotificationsForPlan (the Notifications section above), which the plans page calls
// straight after this returns true - deliberately as a second, separate call: the plan
// really is gone once this succeeds, and a notification that could not be cleared must not
// be reported to the operator as a plan that was not deleted.
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

