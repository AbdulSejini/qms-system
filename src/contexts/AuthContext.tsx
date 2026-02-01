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
  updateSessionActivity,
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

  // قائمة المستخدمين للتبديل (لمدير النظام فقط)
  availableUsers: User[];

  // البيانات المحملة (cached)
  departments: Department[];
  sections: Section[];
  users: User[];
  dataLoaded: boolean;

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
  const [dataLoaded, setDataLoaded] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const dataLoadedRef = useRef(false);
  const systemInitializedRef = useRef(false);

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

  // تهيئة النظام مرة واحدة
  const initSystem = useCallback(async () => {
    if (systemInitializedRef.current) return;
    systemInitializedRef.current = true;
    await initializeSystemAdmin();
  }, []);

  // تحميل الجلسة عند بدء التطبيق
  useEffect(() => {
    const loadSession = async () => {
      try {
        await initSystem();

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
  }, [initSystem]);

  // تحميل البيانات عند تسجيل الدخول
  useEffect(() => {
    if (currentUser && !dataLoadedRef.current) {
      loadData();
    }
  }, [currentUser, loadData]);

  // تحديث نشاط المستخدم كل دقيقة (heartbeat)
  useEffect(() => {
    if (!currentUser) return;

    // تحديث النشاط فوراً
    updateSessionActivity(currentUser.id);

    // تحديث كل دقيقة
    const interval = setInterval(() => {
      updateSessionActivity(currentUser.id);
    }, 60000); // 60 ثانية

    return () => clearInterval(interval);
  }, [currentUser]);

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

  // المستخدمين المتاحين للتبديل
  const availableUsers = useMemo(() => {
    if (currentUser?.role !== 'system_admin') return [];
    return users.filter(u => u.isActive);
  }, [currentUser?.role, users]);

  // تحديث البيانات
  const refreshData = useCallback(async () => {
    await loadData(true);
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
      await initSystem();

      const user = await getUserByEmail(username);

      if (!user || !user.isActive) {
        return false;
      }

      const storedPassword = await getPassword(user.id);

      if (!storedPassword || storedPassword !== password) {
        return false;
      }

      const sessionData = {
        userId: user.id,
        loginAt: new Date().toISOString(),
      };
      localStorage.setItem('qms_session', JSON.stringify(sessionData));

      await addActiveSession(user.id, {
        loginAt: sessionData.loginAt,
        userEmail: user.email,
        userName: user.fullNameAr,
      });

      setCurrentUser(user);
      dataLoadedRef.current = false; // Reset to load fresh data
      return true;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  }, [initSystem]);

  // تسجيل الخروج
  const logout = useCallback(async () => {
    if (currentUser) {
      await removeActiveSession(currentUser.id);
    }

    setCurrentUser(null);
    localStorage.removeItem('qms_session');
    dataLoadedRef.current = false;
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

    const targetUser = users.find(u => u.id === userId);
    if (targetUser?.isSystemAccount) return false;

    const canReset =
      currentUser.role === 'system_admin' ||
      (currentUser.role === 'quality_manager' && permissions.canManageUsers);

    if (!canReset) return false;

    return await setPassword(userId, DEFAULT_PASSWORD);
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
