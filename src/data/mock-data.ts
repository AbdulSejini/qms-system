import {
  Department,
  Section,
  User,
  UserRole,
} from '@/types';

// ===========================================
// الإدارات - فارغة (يتم إنشاؤها من قبل المدير)
// ===========================================

export const departments: Department[] = [];

// ===========================================
// الأقسام - فارغة (يتم إنشاؤها من قبل المدير)
// ===========================================

export const sections: Section[] = [];

// ===========================================
// المستخدمين - فارغ (مدير النظام معرّف في AuthContext)
// ===========================================

export const users: User[] = [];

// ===========================================
// دوال مساعدة
// ===========================================

// الحصول على الإدارة بالمعرف
export const getDepartmentById = (id: string): Department | undefined => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('qms_departments');
    if (stored) {
      const storedDepts = JSON.parse(stored);
      return storedDepts.find((d: Department) => d.id === id);
    }
  }
  return undefined;
};

// الحصول على القسم بالمعرف
export const getSectionById = (id: string): Section | undefined => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('qms_sections');
    if (stored) {
      const storedSections = JSON.parse(stored);
      return storedSections.find((s: Section) => s.id === id);
    }
  }
  return undefined;
};

// الحصول على المستخدم بالمعرف
export const getUserById = (id: string): User | undefined => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('qms_users');
    if (stored) {
      const storedUsers = JSON.parse(stored);
      return storedUsers.find((u: User) => u.id === id);
    }
  }
  return undefined;
};

// الحصول على أقسام إدارة معينة
export const getSectionsByDepartment = (departmentId: string): Section[] => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('qms_sections');
    if (stored) {
      const storedSections = JSON.parse(stored);
      return storedSections.filter((s: Section) => s.departmentId === departmentId && s.isActive);
    }
  }
  return [];
};

// الحصول على موظفي قسم معين
export const getUsersBySection = (sectionId: string): User[] => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('qms_users');
    if (stored) {
      const storedUsers = JSON.parse(stored);
      return storedUsers.filter((u: User) => u.sectionId === sectionId && u.isActive);
    }
  }
  return [];
};

// الحصول على موظفي إدارة معينة
export const getUsersByDepartment = (departmentId: string): User[] => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('qms_users');
    if (stored) {
      const storedUsers = JSON.parse(stored);
      return storedUsers.filter((u: User) => u.departmentId === departmentId && u.isActive);
    }
  }
  return [];
};

// الحصول على المراجعين المتاحين
export const getAvailableAuditors = (): User[] => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('qms_users');
    if (stored) {
      const storedUsers = JSON.parse(stored);
      return storedUsers.filter((u: User) => u.canBeAuditor && u.isActive);
    }
  }
  return [];
};

// الحصول على المراجعين الذين يمكنهم مراجعة إدارة معينة
export const getAuditorsForDepartment = (departmentId: string): User[] => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('qms_users');
    if (stored) {
      const allUsers = JSON.parse(stored);
      return allUsers.filter(
        (u: User) =>
          u.canBeAuditor &&
          u.isActive &&
          (u.auditableDepartmentIds.includes(departmentId) ||
            u.auditableDepartmentIds.length === 0 ||
            u.role === 'quality_manager' ||
            u.role === 'system_admin')
      );
    }
  }
  return [];
};

// التحقق من قدرة المستخدم على مراجعة إدارة/قسم معين
export const canUserAudit = (
  userId: string,
  departmentId: string,
  sectionId?: string
): boolean => {
  const user = getUserById(userId);
  if (!user || !user.canBeAuditor || !user.isActive) return false;

  // مدير النظام ومدير الجودة يمكنهم مراجعة أي إدارة
  if (user.role === 'system_admin' || user.role === 'quality_manager') {
    return true;
  }

  // إذا كانت القائمة فارغة، يمكنه مراجعة الجميع
  if (user.auditableDepartmentIds.length === 0) {
    return true;
  }

  // التحقق من الإدارة
  if (user.auditableDepartmentIds.includes(departmentId)) {
    return true;
  }

  // التحقق من القسم
  if (sectionId && user.auditableSectionIds.includes(sectionId)) {
    return true;
  }

  return false;
};

// الحصول على اسم الدور بالعربي
export const getRoleNameAr = (role: UserRole): string => {
  const roleNames: Record<UserRole, string> = {
    system_admin: 'مدير النظام',
    quality_manager: 'مدير إدارة الجودة',
    auditor: 'مراجع داخلي',
    department_manager: 'مدير إدارة',
    section_head: 'رئيس قسم',
    employee: 'موظف',
  };
  return roleNames[role];
};

// الحصول على اسم الدور بالإنجليزي
export const getRoleNameEn = (role: UserRole): string => {
  const roleNames: Record<UserRole, string> = {
    system_admin: 'System Administrator',
    quality_manager: 'Quality Manager',
    auditor: 'Internal Auditor',
    department_manager: 'Department Manager',
    section_head: 'Section Head',
    employee: 'Employee',
  };
  return roleNames[role];
};
