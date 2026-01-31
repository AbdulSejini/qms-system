'use client';

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import {
  User,
  UserRole,
  Permission,
  DEFAULT_PERMISSIONS,
  Department,
  Section,
} from '@/types';
import {
  users,
  departments,
  sections,
  getDepartmentById,
  getSectionById,
  getUserById,
  canUserAudit,
} from '@/data/mock-data';

// ===========================================
// Context Types
// ===========================================

interface AuthContextType {
  // المستخدم الحالي
  currentUser: User | null;
  isAuthenticated: boolean;

  // تسجيل الدخول/الخروج (للمحاكاة)
  login: (userId: string) => void;
  logout: () => void;
  switchUser: (userId: string) => void;

  // الصلاحيات
  permissions: Permission;
  hasPermission: (permission: keyof Permission) => boolean;
  canManageUsers: boolean;
  canManageDepartments: boolean;
  canViewAllData: boolean;

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

  // قائمة المستخدمين للتبديل (للتطوير)
  availableUsers: User[];
}

// ===========================================
// Context Creation
// ===========================================

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ===========================================
// Provider Component
// ===========================================

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // للمحاكاة: نبدأ بمدير الجودة كمستخدم افتراضي
  const [currentUserId, setCurrentUserId] = useState<string | null>('user-3');

  const currentUser = currentUserId ? getUserById(currentUserId) || null : null;
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
  const login = useCallback((userId: string) => {
    setCurrentUserId(userId);
  }, []);

  // تسجيل الخروج
  const logout = useCallback(() => {
    setCurrentUserId(null);
  }, []);

  // تبديل المستخدم (للتطوير)
  const switchUser = useCallback((userId: string) => {
    setCurrentUserId(userId);
  }, []);

  // التحقق من صلاحية معينة
  const hasPermission = useCallback(
    (permission: keyof Permission): boolean => {
      return permissions[permission];
    },
    [permissions]
  );

  // ===========================================
  // فلترة البيانات حسب الصلاحيات
  // ===========================================

  // الإدارات المتاحة للمستخدم
  const getAccessibleDepartments = useCallback((): Department[] => {
    if (!currentUser) return [];

    // مدير النظام ومدير الجودة يمكنهم الوصول لكل الإدارات
    if (permissions.canViewAllData) {
      return departments.filter((d) => d.isActive);
    }

    // باقي المستخدمين يرون إدارتهم فقط
    return departments.filter(
      (d) => d.isActive && d.id === currentUser.departmentId
    );
  }, [currentUser, permissions.canViewAllData]);

  // الأقسام المتاحة للمستخدم
  const getAccessibleSections = useCallback((): Section[] => {
    if (!currentUser) return [];

    // مدير النظام ومدير الجودة يمكنهم الوصول لكل الأقسام
    if (permissions.canViewAllData) {
      return sections.filter((s) => s.isActive);
    }

    // مدير الإدارة يرى كل أقسام إدارته
    if (currentUser.role === 'department_manager') {
      return sections.filter(
        (s) => s.isActive && s.departmentId === currentUser.departmentId
      );
    }

    // رئيس القسم والموظف يرون قسمهم فقط
    if (currentUser.sectionId) {
      return sections.filter(
        (s) => s.isActive && s.id === currentUser.sectionId
      );
    }

    // إذا لم يكن هناك قسم محدد، نعرض أقسام الإدارة
    return sections.filter(
      (s) => s.isActive && s.departmentId === currentUser.departmentId
    );
  }, [currentUser, permissions.canViewAllData]);

  // المستخدمين المتاحين للمستخدم الحالي
  const getAccessibleUsers = useCallback((): User[] => {
    if (!currentUser) return [];

    // مدير النظام ومدير الجودة يمكنهم الوصول لكل المستخدمين
    if (permissions.canViewAllData) {
      return users.filter((u) => u.isActive);
    }

    // مدير الإدارة يرى موظفي إدارته
    if (currentUser.role === 'department_manager') {
      return users.filter(
        (u) => u.isActive && u.departmentId === currentUser.departmentId
      );
    }

    // رئيس القسم يرى موظفي قسمه
    if (currentUser.role === 'section_head' && currentUser.sectionId) {
      return users.filter(
        (u) => u.isActive && u.sectionId === currentUser.sectionId
      );
    }

    // الموظف العادي يرى نفسه فقط
    return users.filter((u) => u.isActive && u.id === currentUser.id);
  }, [currentUser, permissions.canViewAllData]);

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

      const section = getSectionById(sectionId);
      if (!section) return false;

      // مدير الإدارة يمكنه الوصول لأي قسم في إدارته
      if (currentUser.role === 'department_manager') {
        return section.departmentId === currentUser.departmentId;
      }

      // رئيس القسم والموظف يمكنهم الوصول لقسمهم فقط
      return currentUser.sectionId === sectionId;
    },
    [currentUser, permissions.canViewAllData]
  );

  // التحقق من الوصول لمستخدم معين
  const canAccessUser = useCallback(
    (userId: string): boolean => {
      if (!currentUser) return false;
      if (permissions.canViewAllData) return true;

      const user = getUserById(userId);
      if (!user) return false;

      // مدير الإدارة يمكنه الوصول لموظفي إدارته
      if (currentUser.role === 'department_manager') {
        return user.departmentId === currentUser.departmentId;
      }

      // رئيس القسم يمكنه الوصول لموظفي قسمه
      if (currentUser.role === 'section_head' && currentUser.sectionId) {
        return user.sectionId === currentUser.sectionId;
      }

      // الموظف يمكنه الوصول لنفسه فقط
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
      if (!currentUser) return false;
      return canUserAudit(currentUser.id, departmentId);
    },
    [currentUser]
  );

  // التحقق من إمكانية مراجعة قسم معين
  const canAuditSection = useCallback(
    (sectionId: string): boolean => {
      if (!currentUser) return false;
      const section = getSectionById(sectionId);
      if (!section) return false;
      return canUserAudit(currentUser.id, section.departmentId, sectionId);
    },
    [currentUser]
  );

  // الإدارات التي يمكن للمستخدم مراجعتها
  const getAuditableDepartments = useCallback((): Department[] => {
    if (!currentUser || !currentUser.canBeAuditor) return [];

    // مدير النظام ومدير الجودة يمكنهم مراجعة كل الإدارات
    if (currentUser.role === 'system_admin' || currentUser.role === 'quality_manager') {
      return departments.filter((d) => d.isActive);
    }

    // المراجعين الآخرين حسب قائمتهم المحددة
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
    login,
    logout,
    switchUser,
    permissions,
    hasPermission,
    canManageUsers: permissions.canManageUsers,
    canManageDepartments: permissions.canManageDepartments,
    canViewAllData: permissions.canViewAllData,
    getAccessibleDepartments,
    getAccessibleSections,
    getAccessibleUsers,
    canAccessDepartment,
    canAccessSection,
    canAccessUser,
    canAuditDepartment,
    canAuditSection,
    getAuditableDepartments,
    availableUsers: users.filter((u) => u.isActive),
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
