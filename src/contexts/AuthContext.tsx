'use client';

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  User,
  UserRole,
  Permission,
  DEFAULT_PERMISSIONS,
  Department,
  Section,
} from '@/types';
import { onAuthStateChanged, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import {
  signIn,
  signOutUser,
  resolveAppUser,
  type SignInResult,
} from '@/lib/auth';
import {
  initializeSystemAdmin,
  getUserById,
  getVisibleUsers as getVisibleUsersFromFirestore,
  getAllDepartments as getAllDepartmentsFromFirestore,
  getAllSections as getAllSectionsFromFirestore,
} from '@/lib/firestore';
import { logger } from '@/lib/logger';

// ===========================================
// Context Types
// ===========================================

interface AuthContextType {
  // المستخدم الحالي
  currentUser: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // تسجيل الدخول/الخروج
  // login يبقى boolean حفاظاً على المستدعين الحاليين، و loginWithResult يعطي سبب الفشل
  login: (username: string, password: string) => Promise<boolean>;
  loginWithResult: (username: string, password: string) => Promise<SignInResult>;
  logout: () => void;
  switchUser: (userId: string) => void; // معطّل - انظر التعليق عند التنفيذ

  // الصلاحيات
  permissions: Permission;
  hasPermission: (permission: keyof Permission) => boolean;
  canManageUsers: boolean;
  canManageDepartments: boolean;
  canViewAllData: boolean;

  // صلاحيات الوصول للصفحات
  canAccessUsersPage: boolean;
  canAccessDepartmentsPage: boolean;

  // الوصول للبيانات المفلترة (cached)
  getAccessibleDepartments: () => Department[];
  getAccessibleSections: () => Section[];
  getAccessibleUsers: () => User[];
  canAccessDepartment: (departmentId: string) => boolean;
  canAccessSection: (sectionId: string) => boolean;
  canAccessUser: (userId: string) => boolean;

  // صلاحيات المراجعة
  canAuditDepartment: (departmentId: string) => boolean;
  canAuditSection: (sectionId: string) => boolean;
  getAuditableDepartments: () => Department[];

  // قائمة المستخدمين للتبديل - فارغة دائماً بعد الانتقال إلى Firebase Auth
  availableUsers: User[];

  // البيانات المحملة (cached)
  departments: Department[];
  sections: Section[];
  users: User[];
  dataLoaded: boolean;

  // إعادة تعيين كلمة المرور - إرسال رابط إعادة التعيين إلى بريد المستخدم
  resetUserPassword: (userId: string) => Promise<boolean>;

  // تحديث البيانات
  refreshData: () => Promise<void>;
}

// ===========================================
// Context Creation
// ===========================================

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ===========================================
// Provider Component
// ===========================================

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const dataLoadedRef = useRef(false);
  const systemInitPromiseRef = useRef<Promise<boolean> | null>(null);

  // رقم جيل الجلسة. معالج onAuthStateChanged غير متزامن وفيه عدة await، فقد ينتهي
  // استدعاء قديم بعد تسجيل الخروج أو بعد دخول مستخدم آخر ويعيد ضبط currentUser على
  // مستخدم لم تعد له جلسة في Firebase - واجهة تبدو مسجلة الدخول بلا جلسة خلفها.
  // كل استدعاء يأخذ رقماً عند بدايته ويتوقف بعد أي await إذا لم يعد هو الأحدث.
  const authGenerationRef = useRef(0);

  // تحميل البيانات من Firestore مرة واحدة
  const loadData = useCallback(async (force = false) => {
    if (dataLoadedRef.current && !force) return;

    try {
      const [depts, sects, usrs] = await Promise.all([
        getAllDepartmentsFromFirestore(),
        getAllSectionsFromFirestore(),
        getVisibleUsersFromFirestore(),
      ]);
      setDepartments(depts);
      setSections(sects);
      setUsers(usrs);
      dataLoadedRef.current = true;
      setDataLoaded(true);
    } catch (error) {
      console.error('Error loading data:', error);
      setDataLoaded(true); // Set to true even on error to prevent infinite loading
    }
  }, []);

  // تهيئة النظام مرة واحدة.
  // نحتفظ بالوعد نفسه (وليس بعلامة منطقية) حتى ينتظر أي استدعاء متزامن - مثل login -
  // نفس عملية التهيئة الجارية بدلاً من المتابعة على قاعدة بيانات نصف مهيأة.
  const initSystem = useCallback((): Promise<boolean> => {
    if (!systemInitPromiseRef.current) {
      systemInitPromiseRef.current = initializeSystemAdmin()
        .then((success) => {
          // مسح الوعد عند الفشل حتى تكون إعادة المحاولة ممكنة
          if (!success) systemInitPromiseRef.current = null;
          return success;
        })
        .catch((error) => {
          systemInitPromiseRef.current = null;
          throw error;
        });
    }
    return systemInitPromiseRef.current;
  }, []);

  // الجلسة مشتقة بالكامل من Firebase Auth.
  // Auth يحتفظ بالجلسة بنفسه (IndexedDB) فلم تعد هناك حاجة لقراءة أو كتابة 'qms_session'
  // في localStorage. المستمع يُشترك مرة واحدة عند التركيب ويعمل عند كل تغيّر في الحالة:
  // استعادة الجلسة عند إعادة التحميل، تسجيل الدخول، تسجيل الخروج، وانتهاء صلاحية الرمز.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      const generation = ++authGenerationRef.current;
      const isStale = () => generation !== authGenerationRef.current;

      if (!firebaseUser) {
        setCurrentUser(null);
        dataLoadedRef.current = false;
        setIsLoading(false);
        return;
      }

      try {
        await initSystem();
        if (isStale()) return;

        // ربط حساب Auth بمستند المستخدم الأصلي عبر authUsers/{uid} وحده
        const resolved = await resolveAppUser(firebaseUser.uid, firebaseUser.email);
        // انتهت الجلسة أو تغيّرت أثناء انتظار Firestore - لا نلمس الحالة الحالية
        if (isStale()) return;

        if (resolved.ok) {
          // الاحتفاظ بنفس المرجع عند تطابق المعرّف حتى لا تُعاد التأثيرات المعتمدة عليه
          const user = resolved.user;
          setCurrentUser((prev) => (prev && prev.id === user.id ? prev : user));
        } else if (resolved.reason === 'unavailable') {
          // تعذّرت قراءة الربط - عطل مؤقت في Firestore أو في الشبكة، وليس حكماً على
          // الحساب. تسجيل الخروج هنا يحوّل انقطاعاً عابراً إلى طرد من الجلسة، فنكتفي
          // بتسجيل العطل ونترك الحالة كما هي حتى تنجح محاولة لاحقة.
          logger.error(
            'Could not resolve the auth session (temporary failure, session kept):',
            resolved.message
          );
        } else {
          // حكم صريح على الحساب: لا ربط له أو أنه معطّل - لا نترك جلسة نصفية
          setCurrentUser(null);
          await signOutUser();
        }
      } catch (error) {
        logger.error('Error resolving auth session:', error);
        if (!isStale()) setCurrentUser(null);
      } finally {
        if (!isStale()) setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, [initSystem]);

  // تحميل البيانات عند تسجيل الدخول
  useEffect(() => {
    if (currentUser && !dataLoadedRef.current) {
      loadData();
    }
  }, [currentUser, loadData]);

  const isAuthenticated = currentUser !== null;

  // الصلاحيات
  const permissions = useMemo<Permission>(() => {
    if (!currentUser) {
      return {
        canManageUsers: false,
        canManageDepartments: false,
        canManageAudits: false,
        canConductAudits: false,
        canManageDocuments: false,
        canViewAllData: false,
        canApproveAudits: false,
        canDeleteAudits: false,
      };
    }
    return DEFAULT_PERMISSIONS[currentUser.role];
  }, [currentUser]);

  // المستخدمين المتاحين للتبديل.
  // انتحال الهوية من العميل لم يعد ممكناً بعد ربط قواعد Firestore بـ request.auth.uid،
  // فالقائمة فارغة دائماً حتى لا تعرض الواجهة خياراً لا يعمل. تبقى الخاصية موجودة
  // لأن Header ما زال يقرؤها.
  const availableUsers = useMemo<User[]>(() => [], []);

  // تحديث البيانات.
  // كاتب ثانٍ لـ currentUser بعد عدة await، تماماً كمعالج onAuthStateChanged، فيخضع لنفس
  // حارس الجيل: لو سجّل المستخدم خروجه أو دخل مستخدم آخر أثناء انتظار Firestore، فإن
  // الكتابة هنا كانت تعيد مستخدماً لا جلسة له - واجهة تبدو مسجلة الدخول بلا جلسة خلفها.
  const refreshData = useCallback(async () => {
    const generation = authGenerationRef.current;
    const isStale = () => generation !== authGenerationRef.current;

    await loadData(true);
    if (isStale()) return;

    if (currentUser) {
      const updatedUser = await getUserById(currentUser.id);
      if (isStale()) return;

      if (updatedUser) {
        setCurrentUser(updatedUser);
      }
    }
  }, [loadData, currentUser]);

  // بدء الجلسة بعد نجاح المصادقة: نفس الخطوات لتسجيل الدخول العادي ولترقية كلمة
  // المرور القديمة، حتى لا يفترق المساران في تسجيل الجلسة النشطة أو في تحديث الحالة.
  const establishSession = useCallback(async (user: User) => {
    // onAuthStateChanged سيصل إلى نفس المستخدم، لكن نضبطه هنا فوراً حتى لا
    // ينتظر التوجيه إلى لوحة المعلومات دورة إضافية. ورفع رقم الجيل يمنع أي استدعاء
    // قديم للمستمع - لا يزال معلقاً على await - من الكتابة فوق هذه الحالة.
    authGenerationRef.current += 1;
    setCurrentUser(user);
    dataLoadedRef.current = false; // Reset to load fresh data
  }, []);

  // تسجيل الدخول - النسخة الكاملة التي تعيد سبب الفشل لصفحة تسجيل الدخول
  const loginWithResult = useCallback(
    async (username: string, password: string): Promise<SignInResult> => {
      try {
        await initSystem();

        // signIn: مصادقة Firebase ثم قراءة الربط authUsers/{uid} - بلا أي مسار قديم
        const result = await signIn(username, password);

        if (!result.ok) {
          return result;
        }

        await establishSession(result.user);

        return result;
      } catch (error) {
        logger.error('Login error:', error);
        return { ok: false, reason: 'error' };
      }
    },
    [initSystem, establishSession]
  );

  // ملاحظة: لم تعد هناك ترقية لكلمة مرور قديمة. كان ذلك المسار يقرأ مجموعة `passwords`
  // بلا مصادقة، وهو ما ترفضه قواعد Firestore المشدّدة، فلم يكن ينجح أصلاً. الموظف
  // القائم يُمنح حساب دخول من صفحة المستخدمين على يد مسؤول (createSignInAccountForUser)
  // ثم يختار كلمة مروره بنفسه عبر رسالة التعيين.

  // نفس العملية بواجهة منطقية - يبقى شكل الاستدعاء القديم صالحاً
  const login = useCallback(
    async (username: string, password: string): Promise<boolean> => {
      const result = await loginWithResult(username, password);
      return result.ok;
    },
    [loginWithResult]
  );

  // تسجيل الخروج
  const logout = useCallback(async () => {
    // رفع رقم الجيل أولاً: أي استدعاء للمستمع لا يزال ينتظر Firestore يصبح قديماً،
    // فلا يستطيع إعادة ضبط المستخدم بعد الخروج
    authGenerationRef.current += 1;

    // onAuthStateChanged سيمسح المستخدم أيضاً، لكن المسح المباشر يجعل الواجهة فورية
    await signOutUser();
    setCurrentUser(null);
    dataLoadedRef.current = false;
  }, [currentUser]);

  // تبديل المستخدم - معطّل.
  // كان يبدّل currentUser في العميل فقط. بعد ربط قواعد Firestore بـ request.auth.uid
  // أصبح ذلك يعطي واجهة تعرض بيانات ترفض القواعد تقديمها، أي شاشات فارغة وأخطاء صلاحيات.
  // نبقي الدالة في الواجهة العامة لأن Header ما زال يستدعيها، لكنها لا تفعل شيئاً.
  const switchUser = useCallback((userId: string) => {
    logger.warn(
      'switchUser is disabled: client-side impersonation no longer works with Firebase Auth rules',
      userId
    );
  }, []);

  // إعادة تعيين كلمة المرور.
  // إعادة تعيين كلمة مرور مستخدم آخر تتطلب Admin SDK، وهو غير متاح هنا، لذا نرسل
  // رابط إعادة تعيين ذاتي إلى بريد المستخدم بدلاً من كتابة كلمة مرور افتراضية.
  // نفس فحوص الصلاحية السابقة محفوظة كما هي.
  const resetUserPassword = useCallback(async (userId: string): Promise<boolean> => {
    if (!currentUser) return false;

    const targetUser = users.find(u => u.id === userId);
    if (targetUser?.isSystemAccount) return false;

    const canReset =
      currentUser.role === 'system_admin' ||
      (currentUser.role === 'quality_manager' && permissions.canManageUsers);

    if (!canReset) return false;

    try {
      // المستخدم قد لا يكون ضمن القائمة المخزنة (حسابات النظام مستثناة منها)
      const user = targetUser ?? (await getUserById(userId));
      if (!user || user.isSystemAccount || !user.email) return false;

      // مع تفعيل الحماية من تعداد الحسابات، ينجح sendPasswordResetEmail على بريد لا
      // حساب له في Firebase Auth ولا يُرسل شيئاً. الإبلاغ بالنجاح هنا يعطي مدير النظام
      // علاجاً غير موجود لمستخدم بلا حساب دخول، فنرفض بدل الكذب: مسار هذا المستخدم هو
      // زر "إنشاء حساب دخول" في صفحة المستخدمين، وهو يرسل رسالة تعيين كلمة المرور بنفسه.
      const authUid = (user as User & { authUid?: string }).authUid;
      if (!authUid) {
        logger.warn(
          'No password reset link sent: user has no sign-in account yet (not onboarded):',
          userId
        );
        return false;
      }

      await sendPasswordResetEmail(auth, user.email);
      return true;
    } catch (error) {
      logger.error('Error sending password reset email:', error);
      return false;
    }
  }, [currentUser, permissions.canManageUsers, users]);

  // التحقق من صلاحية معينة
  const hasPermission = useCallback(
    (permission: keyof Permission): boolean => {
      return permissions[permission];
    },
    [permissions]
  );

  // صلاحيات الوصول للصفحات
  const canAccessUsersPage = useMemo(() => {
    if (!currentUser) return false;
    return currentUser.role === 'system_admin' || currentUser.role === 'quality_manager';
  }, [currentUser]);

  const canAccessDepartmentsPage = useMemo(() => {
    if (!currentUser) return false;
    return currentUser.role === 'system_admin' || currentUser.role === 'quality_manager';
  }, [currentUser]);

  // ===========================================
  // فلترة البيانات حسب الصلاحيات (من الـ cache)
  // ===========================================

  const getAccessibleDepartments = useCallback((): Department[] => {
    if (!currentUser) return [];

    if (currentUser.role === 'system_admin' || currentUser.role === 'quality_manager' || permissions.canViewAllData) {
      return departments.filter((d) => d.isActive);
    }

    return departments.filter(
      (d) => d.isActive && d.id === currentUser.departmentId
    );
  }, [currentUser, permissions.canViewAllData, departments]);

  const getAccessibleSections = useCallback((): Section[] => {
    if (!currentUser) return [];

    if (permissions.canViewAllData) {
      return sections.filter((s) => s.isActive);
    }

    if (currentUser.role === 'department_manager') {
      return sections.filter(
        (s) => s.isActive && s.departmentId === currentUser.departmentId
      );
    }

    if (currentUser.sectionId) {
      return sections.filter(
        (s) => s.isActive && s.id === currentUser.sectionId
      );
    }

    return sections.filter(
      (s) => s.isActive && s.departmentId === currentUser.departmentId
    );
  }, [currentUser, permissions.canViewAllData, sections]);

  const getAccessibleUsers = useCallback((): User[] => {
    if (!currentUser) return [];

    if (currentUser.role === 'system_admin') {
      return users.filter((u) => u.isActive);
    }

    if (currentUser.role === 'quality_manager') {
      return users.filter((u) => u.isActive && u.role !== 'system_admin');
    }

    if (currentUser.role === 'department_manager') {
      return users.filter(
        (u) => u.isActive && u.departmentId === currentUser.departmentId
      );
    }

    if (currentUser.role === 'section_head' && currentUser.sectionId) {
      return users.filter(
        (u) => u.isActive && u.sectionId === currentUser.sectionId
      );
    }

    return users.filter((u) => u.isActive && u.id === currentUser.id);
  }, [currentUser, users]);

  const canAccessDepartment = useCallback(
    (departmentId: string): boolean => {
      if (!currentUser) return false;
      if (permissions.canViewAllData) return true;
      return currentUser.departmentId === departmentId;
    },
    [currentUser, permissions.canViewAllData]
  );

  const canAccessSection = useCallback(
    (sectionId: string): boolean => {
      if (!currentUser) return false;
      if (permissions.canViewAllData) return true;

      const section = sections.find(s => s.id === sectionId);
      if (!section) return false;

      if (currentUser.role === 'department_manager') {
        return section.departmentId === currentUser.departmentId;
      }

      return currentUser.sectionId === sectionId;
    },
    [currentUser, permissions.canViewAllData, sections]
  );

  const canAccessUser = useCallback(
    (userId: string): boolean => {
      if (!currentUser) return false;
      if (currentUser.role === 'system_admin') return true;

      const user = users.find(u => u.id === userId);
      if (!user) return false;

      if (currentUser.role === 'quality_manager') {
        return user.role !== 'system_admin';
      }

      if (permissions.canViewAllData) return true;

      if (currentUser.role === 'department_manager') {
        return user.departmentId === currentUser.departmentId;
      }

      if (currentUser.role === 'section_head' && currentUser.sectionId) {
        return user.sectionId === currentUser.sectionId;
      }

      return user.id === currentUser.id;
    },
    [currentUser, permissions.canViewAllData, users]
  );

  // ===========================================
  // صلاحيات المراجعة
  // ===========================================

  const canAuditDepartment = useCallback(
    (departmentId: string): boolean => {
      if (!currentUser || !currentUser.canBeAuditor) return false;

      if (currentUser.role === 'system_admin' || currentUser.role === 'quality_manager') {
        return true;
      }

      if (currentUser.auditableDepartmentIds.length === 0) {
        return true;
      }

      return currentUser.auditableDepartmentIds.includes(departmentId);
    },
    [currentUser]
  );

  const canAuditSection = useCallback(
    (sectionId: string): boolean => {
      if (!currentUser || !currentUser.canBeAuditor) return false;

      const section = sections.find(s => s.id === sectionId);
      if (!section) return false;

      return canAuditDepartment(section.departmentId);
    },
    [currentUser, canAuditDepartment, sections]
  );

  const getAuditableDepartments = useCallback((): Department[] => {
    if (!currentUser || !currentUser.canBeAuditor) return [];

    if (currentUser.role === 'system_admin' || currentUser.role === 'quality_manager') {
      return departments.filter((d) => d.isActive);
    }

    if (currentUser.auditableDepartmentIds.length === 0) {
      return departments.filter((d) => d.isActive);
    }

    return departments.filter(
      (d) => d.isActive && currentUser.auditableDepartmentIds.includes(d.id)
    );
  }, [currentUser, departments]);

  // ===========================================
  // Context Value
  // ===========================================

  const value: AuthContextType = {
    currentUser,
    isAuthenticated,
    isLoading,
    login,
    loginWithResult,
    logout,
    switchUser,
    permissions,
    hasPermission,
    canManageUsers: permissions.canManageUsers,
    canManageDepartments: permissions.canManageDepartments,
    canViewAllData: permissions.canViewAllData,
    canAccessUsersPage,
    canAccessDepartmentsPage,
    getAccessibleDepartments,
    getAccessibleSections,
    getAccessibleUsers,
    canAccessDepartment,
    canAccessSection,
    canAccessUser,
    canAuditDepartment,
    canAuditSection,
    getAuditableDepartments,
    availableUsers,
    departments,
    sections,
    users,
    dataLoaded,
    resetUserPassword,
    refreshData,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ===========================================
// Hook
// ===========================================

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// ===========================================
// Utility HOC for Protected Routes
// ===========================================

export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  requiredPermissions?: (keyof Permission)[]
) {
  return function AuthenticatedComponent(props: P) {
    const { isAuthenticated, hasPermission } = useAuth();

    if (!isAuthenticated) {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-[var(--foreground-secondary)]">
            يرجى تسجيل الدخول
          </p>
        </div>
      );
    }

    if (requiredPermissions) {
      const hasAllPermissions = requiredPermissions.every(hasPermission);
      if (!hasAllPermissions) {
        return (
          <div className="flex min-h-screen items-center justify-center">
            <p className="text-[var(--foreground-secondary)]">
              ليس لديك صلاحية للوصول لهذه الصفحة
            </p>
          </div>
        );
      }
    }

    return <Component {...props} />;
  };
}
