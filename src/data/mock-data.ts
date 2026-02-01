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
// المستخدمين - فقط مدير النظام
// ===========================================

export const users: User[] = [
  // مدير النظام
  {
    id: 'user-1',
    employeeNumber: 'EMP-0001',
    email: 'abdul.sejini@gmail.com',
    fullNameAr: 'عبدالإله سجيني',
    fullNameEn: 'Abdul Sejini',
    role: 'system_admin',
    departmentId: '',
    sectionId: '',
    canBeAuditor: false,
    auditableDepartmentIds: [],
    auditableSectionIds: [],
    phone: '+966500000000',
    jobTitleAr: 'مدير النظام',
    jobTitleEn: 'System Administrator',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
];

// ===========================================
// دوال مساعدة
// ===========================================

// الحصول على الإدارة بالمعرف
export const getDepartmentById = (id: string): Department | undefined => {
  // أولاً نحاول من localStorage
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('qms_departments');
    if (stored) {
      const storedDepts = JSON.parse(stored);
      const found = storedDepts.find((d: Department) => d.id === id);
      if (found) return found;
    }
  }
  return departments.find((d) => d.id === id);
};

// الحصول على القسم بالمعرف
export const getSectionById = (id: string): Section | undefined => {
  // أولاً نحاول من localStorage
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('qms_sections');
    if (stored) {
      const storedSections = JSON.parse(stored);
      const found = storedSections.find((s: Section) => s.id === id);
      if (found) return found;
    }
  }
  return sections.find((s) => s.id === id);
};

// الحصول على المستخدم بالمعرف
export const getUserById = (id: string): User | undefined => {
  // أولاً نحاول من localStorage
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('qms_users');
    if (stored) {
      const storedUsers = JSON.parse(stored);
      const found = storedUsers.find((u: User) => u.id === id);
      if (found) return found;
    }
  }
  return users.find((u) => u.id === id);
};

// الحصول على أقسام إدارة معينة
export const getSectionsByDepartment = (departmentId: string): Section[] => {
  // أولاً نحاول من localStorage
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('qms_sections');
    if (stored) {
      const storedSections = JSON.parse(stored);
      return storedSections.filter((s: Section) => s.departmentId === departmentId && s.isActive);
    }
  }
  return sections.filter((s) => s.departmentId === departmentId && s.isActive);
};

// الحصول على موظفي قسم معين
export const getUsersBySection = (sectionId: string): User[] => {
  // أولاً نحاول من localStorage
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('qms_users');
    if (stored) {
      const storedUsers = JSON.parse(stored);
      return storedUsers.filter((u: User) => u.sectionId === sectionId && u.isActive);
    }
  }
  return users.filter((u) => u.sectionId === sectionId && u.isActive);
};

// الحصول على موظفي إدارة معينة
export const getUsersByDepartment = (departmentId: string): User[] => {
  // أولاً نحاول من localStorage
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('qms_users');
    if (stored) {
      const storedUsers = JSON.parse(stored);
      return storedUsers.filter((u: User) => u.departmentId === departmentId && u.isActive);
    }
  }
  return users.filter((u) => u.departmentId === departmentId && u.isActive);
};

// الحصول على المراجعين المتاحين
export const getAvailableAuditors = (): User[] => {
  // أولاً نحاول من localStorage
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('qms_users');
    if (stored) {
      const storedUsers = JSON.parse(stored);
      return storedUsers.filter((u: User) => u.canBeAuditor && u.isActive);
    }
  }
  return users.filter((u) => u.canBeAuditor && u.isActive);
};

// الحصول على المراجعين الذين يمكنهم مراجعة إدارة معينة
export const getAuditorsForDepartment = (departmentId: string): User[] => {
  let allUsers = users;

  // أولاً نحاول من localStorage
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('qms_users');
    if (stored) {
      allUsers = JSON.parse(stored);
    }
  }

  return allUsers.filter(
    (u) =>
      u.canBeAuditor &&
      u.isActive &&
      (u.auditableDepartmentIds.includes(departmentId) ||
        u.role === 'quality_manager' ||
        u.role === 'system_admin')
  );
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
    system_admin: 'System Admin',
    quality_manager: 'Quality Manager',
    auditor: 'Internal Auditor',
    department_manager: 'Department Manager',
    section_head: 'Section Head',
    employee: 'Employee',
  };
  return roleNames[role];
};
