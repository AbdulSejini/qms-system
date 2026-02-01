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

// ===========================================
// مدير النظام الرئيسي - بيانات ثابتة ومحمية
// ===========================================

const SYSTEM_ADMIN: User = {
  id: 'user-1',
  employeeNumber: 'EMP-0001',
  email: 'abdul.sejini@gmail.com',
  fullNameAr: 'عبدالإله سجيني',
  fullNameEn: 'Abdul Sejini',
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
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const SYSTEM_ADMIN_PASSWORD = 'Doha@1988';

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

  // قائمة المستخدمين للتبديل (لمدير النظام فقط)
  availableUsers: User[];

  // إعادة تعيين كلمة المرور
  resetUserPassword: (userId: string) => boolean;
}

// ===========================================
// Helper Functions
// ===========================================

// الحصول على جميع المستخدمين من localStorage + مدير النظام
const getAllUsers = (): User[] => {
  if (typeof window === 'undefined') return [SYSTEM_ADMIN];
  const stored = localStorage.getItem('qms_users');
  if (stored) {
    const storedUsers = JSON.parse(stored);
    // تأكد من وجود مدير النظام دائماً
    const hasAdmin = storedUsers.some((u: User) => u.id === SYSTEM_ADMIN.id);
    if (!hasAdmin) {
      return [SYSTEM_ADMIN, ...storedUsers];
    }
    // تحديث بيانات مدير النظام في حالة تغيرها
    return storedUsers.map((u: User) => u.id === SYSTEM_ADMIN.id ? SYSTEM_ADMIN : u);
  }
  return [SYSTEM_ADMIN];
};

// الحصول على مستخدم بواسطة الـ ID
const getUserByIdFromStorage = (userId: string): User | undefined => {
  if (userId === SYSTEM_ADMIN.id) return SYSTEM_ADMIN;
  const users = getAllUsers();
  return users.find(u => u.id === userId);
};

// الحصول على جميع الإدارات من localStorage
const getAllDepartments = (): Department[] => {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem('qms_departments');
  if (stored) {
    return JSON.parse(stored);
  }
  return [];
};

// الحصول على جميع الأقسام من localStorage
const getAllSections = (): Section[] => {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem('qms_sections');
  if (stored) {
    return JSON.parse(stored);
  }
  return [];
};

// الحصول على قسم بواسطة الـ ID
const getSectionByIdFromStorage = (sectionId: string): Section | undefined => {
  const sections = getAllSections();
  return sections.find(s => s.id === sectionId);
};

// الحصول على كلمات المرور من localStorage
const getPasswords = (): Record<string, string> => {
  if (typeof window === 'undefined') return { [SYSTEM_ADMIN.id]: SYSTEM_ADMIN_PASSWORD };
  const stored = localStorage.getItem('qms_passwords');
  if (stored) {
    const passwords = JSON.parse(stored);
    // تأكد من وجود كلمة مرور مدير النظام دائماً
    passwords[SYSTEM_ADMIN.id] = SYSTEM_ADMIN_PASSWORD;
    return passwords;
  }
  return { [SYSTEM_ADMIN.id]: SYSTEM_ADMIN_PASSWORD };
};

// حفظ كلمات المرور
const savePasswords = (passwords: Record<string, string>) => {
  if (typeof window !== 'undefined') {
    // لا تسمح بتغيير كلمة مرور مدير النظام
    passwords[SYSTEM_ADMIN.id] = SYSTEM_ADMIN_PASSWORD;
    localStorage.setItem('qms_passwords', JSON.stringify(passwords));
  }
};

// ===========================================
// Context Creation
// ===========================================

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ===========================================
// Provider Component
// ===========================================

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // تحميل الجلسة عند بدء التطبيق
  useEffect(() => {
    const savedSession = localStorage.getItem('qms_session');
    if (savedSession) {
      const session = JSON.parse(savedSession);
      const user = getUserByIdFromStorage(session.userId);
      if (user && user.isActive) {
        setCurrentUserId(session.userId);
      } else {
        localStorage.removeItem('qms_session');
      }
    }
    setIsLoading(false);
  }, []);

  const currentUser = currentUserId ? getUserByIdFromStorage(currentUserId) || null : null;
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

  // تسجيل الدخول
  const login = useCallback(async (username: string, password: string): Promise<boolean> => {
    // التحقق من مدير النظام أولاً (بيانات ثابتة)
    if (username.toLowerCase() === SYSTEM_ADMIN.email.toLowerCase()) {
      if (password === SYSTEM_ADMIN_PASSWORD) {
        setCurrentUserId(SYSTEM_ADMIN.id);
        localStorage.setItem('qms_session', JSON.stringify({
          userId: SYSTEM_ADMIN.id,
          loginAt: new Date().toISOString(),
        }));
        return true;
      }
      return false;
    }

    // البحث في المستخدمين الآخرين
    const users = getAllUsers();
    const passwords = getPasswords();

    // البحث عن المستخدم بالبريد الإلكتروني
    const user = users.find(
      (u) =>
        u.isActive &&
        u.id !== SYSTEM_ADMIN.id &&
        u.email.toLowerCase() === username.toLowerCase()
    );

    if (!user) {
      return false;
    }

    // التحقق من كلمة المرور
    const userPassword = passwords[user.id];
    if (!userPassword || userPassword !== password) {
      return false;
    }

    // حفظ الجلسة
    setCurrentUserId(user.id);
    localStorage.setItem('qms_session', JSON.stringify({
      userId: user.id,
      loginAt: new Date().toISOString(),
    }));

    return true;
  }, []);

  // تسجيل الخروج
  const logout = useCallback(() => {
    setCurrentUserId(null);
    localStorage.removeItem('qms_session');
  }, []);

  // تبديل المستخدم (لمدير النظام فقط)
  const switchUser = useCallback((userId: string) => {
    if (!currentUser || currentUser.role !== 'system_admin') return;

    const user = getUserByIdFromStorage(userId);
    if (user && user.isActive) {
      setCurrentUserId(userId);
      localStorage.setItem('qms_session', JSON.stringify({
        userId: userId,
        loginAt: new Date().toISOString(),
      }));
    }
  }, [currentUser]);

  // إعادة تعيين كلمة المرور
  const resetUserPassword = useCallback((userId: string): boolean => {
    if (!currentUser) return false;

    // لا يمكن إعادة تعيين كلمة مرور مدير النظام
    if (userId === SYSTEM_ADMIN.id) return false;

    // التحقق من الصلاحية
    const canReset =
      currentUser.role === 'system_admin' ||
      (currentUser.role === 'quality_manager' && permissions.canManageUsers);

    if (!canReset) return false;

    const passwords = getPasswords();
    passwords[userId] = 'Welcome@123';
    savePasswords(passwords);

    return true;
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
  const getAccessibleDepartments = useCallback((): Department[] => {
    if (!currentUser) return [];
    const departments = getAllDepartments();

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
  const getAccessibleSections = useCallback((): Section[] => {
    if (!currentUser) return [];
    const sections = getAllSections();

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

  // المستخدمين المتاحين للمستخدم الحالي
  const getAccessibleUsers = useCallback((): User[] => {
    if (!currentUser) return [];
    const users = getAllUsers();

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
    (sectionId: string): boolean => {
      if (!currentUser) return false;
      if (permissions.canViewAllData) return true;

      const section = getSectionByIdFromStorage(sectionId);
      if (!section) return false;

      if (currentUser.role === 'department_manager') {
        return section.departmentId === currentUser.departmentId;
      }

      return currentUser.sectionId === sectionId;
    },
    [currentUser, permissions.canViewAllData]
  );

  // التحقق من الوصول لمستخدم معين
  const canAccessUser = useCallback(
    (userId: string): boolean => {
      if (!currentUser) return false;
      if (currentUser.role === 'system_admin') return true;

      const user = getUserByIdFromStorage(userId);
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
    (sectionId: string): boolean => {
      if (!currentUser || !currentUser.canBeAuditor) return false;

      const section = getSectionByIdFromStorage(sectionId);
      if (!section) return false;

      return canAuditDepartment(section.departmentId);
    },
    [currentUser, canAuditDepartment]
  );

  // الإدارات التي يمكن للمستخدم مراجعتها
  const getAuditableDepartments = useCallback((): Department[] => {
    if (!currentUser || !currentUser.canBeAuditor) return [];
    const departments = getAllDepartments();

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

  // قائمة المستخدمين للتبديل (لمدير النظام فقط)
  const availableUsers = useMemo(() => {
    if (!currentUser || currentUser.role !== 'system_admin') return [];
    return getAllUsers().filter((u) => u.isActive);
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
