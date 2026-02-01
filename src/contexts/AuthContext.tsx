'use client';

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import {
  User,
  UserRole,
  Permission,
  DEFAULT_PERMISSIONS,
  Department,
  Section,
} from '@/types';
import {
  initializeSystemAdmin,
  getUserById,
  getUserByEmail,
  getVisibleUsers as getVisibleUsersFromFirestore,
  getAllDepartments as getAllDepartmentsFromFirestore,
  getAllSections as getAllSectionsFromFirestore,
  getPassword,
  setPassword,
  addActiveSession,
  removeActiveSession,
  SYSTEM_ADMIN_ID,
  DEFAULT_PASSWORD,
} from '@/lib/firestore';

// ===========================================
// Context Types
// ===========================================

interface AuthContextType {
  // المستخدم الحالي
  currentUser: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // تسجيل الدخول/الخروج
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  switchUser: (userId: string) => void; // فقط لمدير النظام

  // الصلاحيات
  permissions: Permission;
  hasPermission: (permission: keyof Permission) => boolean;
  canManageUsers: boolean;
  canManageDepartments: boolean;
  canViewAllData: boolean;

  // صلاحيات الوصول للصفحات
  canAccessUsersPage: boolean;
  canAccessDepartmentsPage: boolean;

  // الوصول للبيانات المفلترة
  getAccessibleDepartments: () => Promise<Department[]>;
  getAccessibleSections: () => Promise<Section[]>;
  getAccessibleUsers: () => Promise<User[]>;
  canAccessDepartment: (departmentId: string) => boolean;
  canAccessSection: (sectionId: string) => Promise<boolean>;
  canAccessUser: (userId: string) => Promise<boolean>;

  // صلاحيات المراجعة
  canAuditDepartment: (departmentId: string) => boolean;
  canAuditSection: (sectionId: string) => Promise<boolean>;
  getAuditableDepartments: () => Promise<Department[]>;

  // قائمة المستخدمين للتبديل (لمدير النظام فقط)
  availableUsers: User[];

  // إعادة تعيين كلمة المرور
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
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [allDepartments, setAllDepartments] = useState<Department[]>([]);
  const [allSections, setAllSections] = useState<Section[]>([]);

  // تحميل البيانات من Firestore
  const loadData = useCallback(async () => {
    try {
      const [departments, sections] = await Promise.all([
        getAllDepartmentsFromFirestore(),
        getAllSectionsFromFirestore(),
      ]);
      setAllDepartments(departments);
      setAllSections(sections);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  }, []);

  // تحميل قائمة المستخدمين المتاحين للتبديل
  const loadAvailableUsers = useCallback(async () => {
    if (currentUser?.role === 'system_admin') {
      const users = await getVisibleUsersFromFirestore();
      setAvailableUsers(users.filter(u => u.isActive));
    } else {
      setAvailableUsers([]);
    }
  }, [currentUser?.role]);

  // تحميل الجلسة عند بدء التطبيق
  useEffect(() => {
    const loadSession = async () => {
      try {
        // تهيئة مدير النظام
        await initializeSystemAdmin();

        // تحميل الجلسة المحفوظة
        const savedSession = localStorage.getItem('qms_session');
        if (savedSession) {
          const session = JSON.parse(savedSession);
          const user = await getUserById(session.userId);
          if (user && user.isActive) {
            setCurrentUser(user);
          } else {
            localStorage.removeItem('qms_session');
          }
        }
      } catch (error) {
        console.error('Error loading session:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSession();
  }, []);

  // تحميل البيانات عند تسجيل الدخول
  useEffect(() => {
    if (currentUser) {
      loadData();
      loadAvailableUsers();
    }
  }, [currentUser, loadData, loadAvailableUsers]);

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

  // تحديث البيانات
  const refreshData = useCallback(async () => {
    await loadData();
    if (currentUser) {
      const updatedUser = await getUserById(currentUser.id);
      if (updatedUser) {
        setCurrentUser(updatedUser);
      }
    }
  }, [loadData, currentUser]);

  // تسجيل الدخول
  const login = useCallback(async (username: string, password: string): Promise<boolean> => {
    try {
      // تهيئة مدير النظام
      await initializeSystemAdmin();

      // البحث عن المستخدم بالبريد الإلكتروني
      const user = await getUserByEmail(username);

      if (!user || !user.isActive) {
        console.log('User not found or inactive:', username);
        return false;
      }

      // التحقق من كلمة المرور
      const storedPassword = await getPassword(user.id);
      console.log('Checking password for user:', user.id);

      if (!storedPassword || storedPassword !== password) {
        console.log('Password mismatch');
        return false;
      }

      // حفظ الجلسة محلياً
      const sessionData = {
        userId: user.id,
        loginAt: new Date().toISOString(),
      };
      localStorage.setItem('qms_session', JSON.stringify(sessionData));

      // إضافة للجلسات النشطة في Firestore
      await addActiveSession(user.id, {
        loginAt: sessionData.loginAt,
        userEmail: user.email,
        userName: user.fullNameAr,
      });

      setCurrentUser(user);
      return true;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  }, []);

  // تسجيل الخروج
  const logout = useCallback(async () => {
    if (currentUser) {
      // إزالة من الجلسات النشطة في Firestore
      await removeActiveSession(currentUser.id);
    }

    setCurrentUser(null);
    localStorage.removeItem('qms_session');
  }, [currentUser]);

  // تبديل المستخدم (لمدير النظام فقط)
  const switchUser = useCallback(async (userId: string) => {
    if (!currentUser || currentUser.role !== 'system_admin') return;

    const user = await getUserById(userId);
    if (user && user.isActive) {
      setCurrentUser(user);
      localStorage.setItem('qms_session', JSON.stringify({
        userId: userId,
        loginAt: new Date().toISOString(),
      }));
    }
  }, [currentUser]);

  // إعادة تعيين كلمة المرور
  const resetUserPassword = useCallback(async (userId: string): Promise<boolean> => {
    if (!currentUser) return false;

    // لا يمكن إعادة تعيين كلمة مرور حساب نظام
    const targetUser = await getUserById(userId);
    if (targetUser?.isSystemAccount) return false;

    // التحقق من الصلاحية
    const canReset =
      currentUser.role === 'system_admin' ||
      (currentUser.role === 'quality_manager' && permissions.canManageUsers);

    if (!canReset) return false;

    return await setPassword(userId, DEFAULT_PASSWORD);
  }, [currentUser, permissions.canManageUsers]);

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
  // فلترة البيانات حسب الصلاحيات
  // ===========================================

  // الإدارات المتاحة للمستخدم
  const getAccessibleDepartments = useCallback(async (): Promise<Department[]> => {
    if (!currentUser) return [];

    const departments = await getAllDepartmentsFromFirestore();

    if (currentUser.role === 'system_admin') {
      return departments.filter((d) => d.isActive);
    }

    if (currentUser.role === 'quality_manager' || permissions.canViewAllData) {
      return departments.filter((d) => d.isActive);
    }

    return departments.filter(
      (d) => d.isActive && d.id === currentUser.departmentId
    );
  }, [currentUser, permissions.canViewAllData]);

  // الأقسام المتاحة للمستخدم
  const getAccessibleSections = useCallback(async (): Promise<Section[]> => {
    if (!currentUser) return [];

    const sections = await getAllSectionsFromFirestore();

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
  }, [currentUser, permissions.canViewAllData]);

  // المستخدمين المتاحين للمستخدم الحالي (بدون حسابات النظام المخفية)
  const getAccessibleUsers = useCallback(async (): Promise<User[]> => {
    if (!currentUser) return [];

    const users = await getVisibleUsersFromFirestore();

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
  }, [currentUser]);

  // التحقق من الوصول لإدارة معينة
  const canAccessDepartment = useCallback(
    (departmentId: string): boolean => {
      if (!currentUser) return false;
      if (permissions.canViewAllData) return true;
      return currentUser.departmentId === departmentId;
    },
    [currentUser, permissions.canViewAllData]
  );

  // التحقق من الوصول لقسم معين
  const canAccessSection = useCallback(
    async (sectionId: string): Promise<boolean> => {
      if (!currentUser) return false;
      if (permissions.canViewAllData) return true;

      const section = allSections.find(s => s.id === sectionId);
      if (!section) return false;

      if (currentUser.role === 'department_manager') {
        return section.departmentId === currentUser.departmentId;
      }

      return currentUser.sectionId === sectionId;
    },
    [currentUser, permissions.canViewAllData, allSections]
  );

  // التحقق من الوصول لمستخدم معين
  const canAccessUser = useCallback(
    async (userId: string): Promise<boolean> => {
      if (!currentUser) return false;
      if (currentUser.role === 'system_admin') return true;

      const user = await getUserById(userId);
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
    [currentUser, permissions.canViewAllData]
  );

  // ===========================================
  // صلاحيات المراجعة
  // ===========================================

  // التحقق من إمكانية مراجعة إدارة معينة
  const canAuditDepartment = useCallback(
    (departmentId: string): boolean => {
      if (!currentUser || !currentUser.canBeAuditor) return false;

      if (currentUser.role === 'system_admin' || currentUser.role === 'quality_manager') {
        return true;
      }

      if (currentUser.auditableDepartmentIds.length === 0) {
        return true; // يمكنه مراجعة الجميع
      }

      return currentUser.auditableDepartmentIds.includes(departmentId);
    },
    [currentUser]
  );

  // التحقق من إمكانية مراجعة قسم معين
  const canAuditSection = useCallback(
    async (sectionId: string): Promise<boolean> => {
      if (!currentUser || !currentUser.canBeAuditor) return false;

      const section = allSections.find(s => s.id === sectionId);
      if (!section) return false;

      return canAuditDepartment(section.departmentId);
    },
    [currentUser, canAuditDepartment, allSections]
  );

  // الإدارات التي يمكن للمستخدم مراجعتها
  const getAuditableDepartments = useCallback(async (): Promise<Department[]> => {
    if (!currentUser || !currentUser.canBeAuditor) return [];

    const departments = await getAllDepartmentsFromFirestore();

    if (currentUser.role === 'system_admin' || currentUser.role === 'quality_manager') {
      return departments.filter((d) => d.isActive);
    }

    if (currentUser.auditableDepartmentIds.length === 0) {
      return departments.filter((d) => d.isActive);
    }

    return departments.filter(
      (d) => d.isActive && currentUser.auditableDepartmentIds.includes(d.id)
    );
  }, [currentUser]);

  // ===========================================
  // Context Value
  // ===========================================

  const value: AuthContextType = {
    currentUser,
    isAuthenticated,
    isLoading,
    login,
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
