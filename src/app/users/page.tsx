'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { Badge } from '@/components/ui';
import { useTranslation } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  users as initialUsers,
  departments as initialDepartments,
  sections as initialSections,
  getRoleNameAr,
  getRoleNameEn,
} from '@/data/mock-data';
import { Department, Section } from '@/types';
import { User, UserRole } from '@/types';
import {
  Users,
  Search,
  Plus,
  Edit2,
  Eye,
  Shield,
  Building2,
  Mail,
  Phone,
  UserCheck,
  X,
  ChevronDown,
  Save,
  Trash2,
  AlertCircle,
  ShieldAlert,
  KeyRound,
  Check,
} from 'lucide-react';

// نموذج مستخدم فارغ
const emptyUser: Omit<User, 'id' | 'createdAt' | 'updatedAt'> = {
  employeeNumber: '',
  email: '',
  fullNameAr: '',
  fullNameEn: '',
  role: 'employee',
  departmentId: '',
  sectionId: undefined,
  canBeAuditor: false,
  auditableDepartmentIds: [],
  auditableSectionIds: [],
  phone: '',
  jobTitleAr: '',
  jobTitleEn: '',
  isActive: true,
  lastLoginAt: undefined,
};

export default function UsersPage() {
  const { t, language, isRTL } = useTranslation();
  const { currentUser, canManageUsers, canManageDepartments, resetUserPassword } = useAuth();
  const router = useRouter();

  // التحقق من الصلاحيات - فقط مدير النظام ومدير إدارة الجودة
  const hasAccess = currentUser?.role === 'system_admin' || currentUser?.role === 'quality_manager';
  const isSystemAdmin = currentUser?.role === 'system_admin';

  // State للأقسام والإدارات من localStorage
  const [departments, setDepartments] = useState<Department[]>(initialDepartments);
  const [sections, setSections] = useState<Section[]>(initialSections);

  // State للمستخدمين
  const [usersData, setUsersData] = useState<User[]>([]);

  // تحميل البيانات من localStorage
  useEffect(() => {
    // تحميل الأقسام
    const storedDepts = localStorage.getItem('qms_departments');
    const storedSections = localStorage.getItem('qms_sections');

    if (storedDepts) {
      setDepartments(JSON.parse(storedDepts));
    }
    if (storedSections) {
      setSections(JSON.parse(storedSections));
    }

    // تحميل المستخدمين
    const storedUsers = localStorage.getItem('qms_users');
    let loadedUsers: User[] = storedUsers ? JSON.parse(storedUsers) : initialUsers;

    // إخفاء مدير النظام إذا كان المستخدم الحالي ليس مدير النظام
    if (!isSystemAdmin) {
      loadedUsers = loadedUsers.filter(u => u.role !== 'system_admin');
    }

    setUsersData(loadedUsers);
  }, [isSystemAdmin]);

  // دوال مساعدة للحصول على الأقسام والإدارات
  const getDepartmentById = (id: string) => departments.find(d => d.id === id);
  const getSectionById = (id: string) => sections.find(s => s.id === id);
  const getSectionsByDepartment = (deptId: string) => sections.filter(s => s.departmentId === deptId);

  // State للفلترة
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole | 'all'>('all');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [showAuditorsOnly, setShowAuditorsOnly] = useState(false);
  const [showActiveOnly, setShowActiveOnly] = useState(true);

  // State للنماذج
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Omit<User, 'id' | 'createdAt' | 'updatedAt'>>(emptyUser);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showResetPasswordConfirm, setShowResetPasswordConfirm] = useState(false);
  const [passwordResetSuccess, setPasswordResetSuccess] = useState(false);

  // Filter users
  const filteredUsers = useMemo(() => {
    return usersData.filter((user) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          user.fullNameAr.toLowerCase().includes(query) ||
          user.fullNameEn.toLowerCase().includes(query) ||
          user.email.toLowerCase().includes(query) ||
          user.employeeNumber.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }
      if (selectedRole !== 'all' && user.role !== selectedRole) return false;
      if (selectedDepartment !== 'all' && user.departmentId !== selectedDepartment) return false;
      if (showAuditorsOnly && !user.canBeAuditor) return false;
      if (showActiveOnly && !user.isActive) return false;
      return true;
    });
  }, [usersData, searchQuery, selectedRole, selectedDepartment, showAuditorsOnly, showActiveOnly]);

  const getRoleBadge = (role: UserRole) => {
    const roleColors: Record<UserRole, string> = {
      system_admin: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
      quality_manager: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      auditor: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      department_manager: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      section_head: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
      employee: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
    };
    const roleName = language === 'ar' ? getRoleNameAr(role) : getRoleNameEn(role);
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${roleColors[role]}`}>
        {roleName}
      </span>
    );
  };

  const roles: UserRole[] = ['system_admin', 'quality_manager', 'auditor', 'department_manager', 'section_head', 'employee'];

  // Stats
  const stats = {
    total: usersData.length,
    active: usersData.filter((u) => u.isActive).length,
    auditors: usersData.filter((u) => u.canBeAuditor).length,
  };

  // فتح نموذج إضافة مستخدم جديد
  const openAddForm = () => {
    setFormData(emptyUser);
    setFormErrors({});
    setIsEditing(false);
    setShowFormModal(true);
  };

  // فتح نموذج تعديل مستخدم
  const openEditForm = (user: User) => {
    setFormData({
      employeeNumber: user.employeeNumber,
      email: user.email,
      fullNameAr: user.fullNameAr,
      fullNameEn: user.fullNameEn,
      role: user.role,
      departmentId: user.departmentId,
      sectionId: user.sectionId,
      canBeAuditor: user.canBeAuditor,
      auditableDepartmentIds: [...user.auditableDepartmentIds],
      auditableSectionIds: [...user.auditableSectionIds],
      phone: user.phone || '',
      jobTitleAr: user.jobTitleAr || '',
      jobTitleEn: user.jobTitleEn || '',
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
    });
    setFormErrors({});
    setSelectedUser(user);
    setIsEditing(true);
    setShowFormModal(true);
  };

  // عرض تفاصيل المستخدم
  const openUserDetail = (user: User) => {
    // الحصول على أحدث بيانات المستخدم من usersData
    const latestUser = usersData.find(u => u.id === user.id) || user;
    setSelectedUser(latestUser);
    setShowDetailModal(true);
  };

  // تحديث selectedUser تلقائياً عند تغير usersData
  const currentSelectedUser = useMemo(() => {
    if (!selectedUser) return null;
    return usersData.find(u => u.id === selectedUser.id) || selectedUser;
  }, [usersData, selectedUser]);

  // التحقق من صحة النموذج
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.email.trim()) {
      errors.email = language === 'ar' ? 'البريد الإلكتروني مطلوب' : 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = language === 'ar' ? 'البريد الإلكتروني غير صالح' : 'Invalid email address';
    } else if (!isEditing && usersData.some(u => u.email === formData.email)) {
      errors.email = language === 'ar' ? 'البريد الإلكتروني موجود مسبقاً' : 'Email already exists';
    }

    if (!formData.fullNameAr.trim()) {
      errors.fullNameAr = language === 'ar' ? 'الاسم بالعربي مطلوب' : 'Arabic name is required';
    }

    if (!formData.fullNameEn.trim()) {
      errors.fullNameEn = language === 'ar' ? 'الاسم بالإنجليزي مطلوب' : 'English name is required';
    }

    if (!formData.departmentId) {
      errors.departmentId = language === 'ar' ? 'الإدارة مطلوبة' : 'Department is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // حفظ المستخدم
  const handleSave = () => {
    if (!validateForm()) return;

    let newUsers: User[];

    if (isEditing && selectedUser) {
      // تحديث مستخدم موجود
      newUsers = usersData.map(u =>
        u.id === selectedUser.id
          ? { ...u, ...formData, updatedAt: new Date() }
          : u
      );
      setUsersData(newUsers);
    } else {
      // إضافة مستخدم جديد
      const newUser: User = {
        id: `user-${Date.now()}`,
        ...formData,
        employeeNumber: formData.employeeNumber || `EMP-${String(usersData.length + 1).padStart(4, '0')}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      newUsers = [...usersData, newUser];
      setUsersData(newUsers);

      // إضافة كلمة مرور افتراضية للمستخدم الجديد
      const passwords = JSON.parse(localStorage.getItem('qms_passwords') || '{}');
      passwords[newUser.id] = 'Welcome@123';
      localStorage.setItem('qms_passwords', JSON.stringify(passwords));
    }

    // حفظ في localStorage
    localStorage.setItem('qms_users', JSON.stringify(newUsers));

    setShowFormModal(false);
    setSelectedUser(null);
  };

  // حذف المستخدم
  const handleDelete = () => {
    if (selectedUser) {
      const newUsers = usersData.filter(u => u.id !== selectedUser.id);
      setUsersData(newUsers);
      // حفظ في localStorage
      localStorage.setItem('qms_users', JSON.stringify(newUsers));
      setShowDeleteConfirm(false);
      setShowFormModal(false);
      setSelectedUser(null);
    }
  };

  // إعادة تعيين كلمة المرور
  const handleResetPassword = () => {
    if (selectedUser) {
      const success = resetUserPassword(selectedUser.id);
      if (success) {
        setPasswordResetSuccess(true);
        setTimeout(() => {
          setPasswordResetSuccess(false);
          setShowResetPasswordConfirm(false);
        }, 2000);
      }
    }
  };

  // تحديث حقل في النموذج
  const updateFormField = (field: keyof typeof formData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // مسح الخطأ عند التعديل
    if (formErrors[field]) {
      setFormErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  // الأقسام حسب الإدارة المختارة
  const availableSections = formData.departmentId
    ? getSectionsByDepartment(formData.departmentId)
    : [];

  // إذا لم يكن للمستخدم صلاحية الوصول
  if (!hasAccess) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 mb-6">
            <ShieldAlert className="h-10 w-10 text-red-600 dark:text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--foreground)] mb-2">
            {language === 'ar' ? 'غير مصرح بالوصول' : 'Access Denied'}
          </h1>
          <p className="text-[var(--foreground-secondary)] mb-6 max-w-md">
            {language === 'ar'
              ? 'ليس لديك صلاحية للوصول إلى هذه الصفحة. فقط مدير النظام ومدير إدارة الجودة يمكنهم الوصول لقائمة المستخدمين.'
              : 'You do not have permission to access this page. Only System Administrator and Quality Manager can access the users list.'}
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[var(--primary-hover)]"
          >
            {language === 'ar' ? 'العودة للرئيسية' : 'Back to Dashboard'}
          </button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--foreground)]">
              {t('users.title')}
            </h1>
            <p className="mt-1 text-[var(--foreground-secondary)]">
              {language === 'ar'
                ? `إجمالي ${stats.total} مستخدم • ${stats.active} نشط • ${stats.auditors} مراجع`
                : `Total ${stats.total} users • ${stats.active} active • ${stats.auditors} auditors`}
            </p>
          </div>
          <button
            onClick={openAddForm}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[var(--primary-hover)]"
          >
            <Plus className="h-4 w-4" />
            {t('users.newUser')}
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-[var(--card)]">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30">
                  <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[var(--foreground)]">{stats.total}</p>
                  <p className="text-xs text-[var(--foreground-secondary)]">
                    {language === 'ar' ? 'إجمالي المستخدمين' : 'Total Users'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-white dark:from-green-950/20 dark:to-[var(--card)]">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100 dark:bg-green-900/30">
                  <UserCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[var(--foreground)]">{stats.active}</p>
                  <p className="text-xs text-[var(--foreground-secondary)]">
                    {language === 'ar' ? 'المستخدمين النشطين' : 'Active Users'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/20 dark:to-[var(--card)]">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-900/30">
                  <Shield className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[var(--foreground)]">{stats.auditors}</p>
                  <p className="text-xs text-[var(--foreground-secondary)]">
                    {language === 'ar' ? 'المراجعين' : 'Auditors'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/20 dark:to-[var(--card)]">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/30">
                  <Building2 className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[var(--foreground)]">{departments.length}</p>
                  <p className="text-xs text-[var(--foreground-secondary)]">
                    {language === 'ar' ? 'الإدارات' : 'Departments'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--foreground-muted)]" />
                <input
                  type="text"
                  placeholder={language === 'ar' ? 'بحث بالاسم أو البريد أو الرقم الوظيفي...' : 'Search by name, email, or employee number...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] py-2.5 pe-4 ps-10 text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-muted)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-light)]"
                />
              </div>

              {/* Role Filter */}
              <div className="relative">
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as UserRole | 'all')}
                  className="appearance-none rounded-xl border border-[var(--border)] bg-[var(--background)] py-2.5 pe-10 ps-4 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-light)]"
                >
                  <option value="all">{t('users.filters.allRoles')}</option>
                  {roles.map((role) => (
                    <option key={role} value={role}>
                      {language === 'ar' ? getRoleNameAr(role) : getRoleNameEn(role)}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--foreground-muted)]" />
              </div>

              {/* Department Filter */}
              <div className="relative">
                <select
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  className="appearance-none rounded-xl border border-[var(--border)] bg-[var(--background)] py-2.5 pe-10 ps-4 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-light)]"
                >
                  <option value="all">{t('users.filters.allDepartments')}</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {language === 'ar' ? dept.nameAr : dept.nameEn}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--foreground-muted)]" />
              </div>

              {/* Checkboxes */}
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-[var(--foreground-secondary)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showAuditorsOnly}
                    onChange={(e) => setShowAuditorsOnly(e.target.checked)}
                    className="h-4 w-4 rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]"
                  />
                  {t('users.filters.auditorsOnly')}
                </label>
                <label className="flex items-center gap-2 text-sm text-[var(--foreground-secondary)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showActiveOnly}
                    onChange={(e) => setShowActiveOnly(e.target.checked)}
                    className="h-4 w-4 rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]"
                  />
                  {t('users.filters.activeOnly')}
                </label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--background-secondary)]">
                    <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wider text-[var(--foreground-secondary)]">
                      {t('users.employeeNumber')}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wider text-[var(--foreground-secondary)]">
                      {t('users.fullName')}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wider text-[var(--foreground-secondary)]">
                      {t('users.role')}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wider text-[var(--foreground-secondary)]">
                      {t('users.department')}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wider text-[var(--foreground-secondary)]">
                      {t('users.section')}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wider text-[var(--foreground-secondary)]">
                      {t('users.canBeAuditor')}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wider text-[var(--foreground-secondary)]">
                      {t('common.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {filteredUsers.map((user) => {
                    const department = getDepartmentById(user.departmentId);
                    const section = user.sectionId ? getSectionById(user.sectionId) : null;

                    return (
                      <tr
                        key={user.id}
                        className="transition-colors hover:bg-[var(--background-tertiary)]"
                      >
                        <td className="px-4 py-3">
                          <span className="font-mono text-sm text-[var(--foreground-secondary)]">
                            {user.employeeNumber}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--primary-light)] text-[var(--primary)] font-semibold text-sm">
                              {(language === 'ar' ? user.fullNameAr : user.fullNameEn).charAt(0)}
                            </div>
                            <div>
                              <p className="font-medium text-[var(--foreground)]">
                                {language === 'ar' ? user.fullNameAr : user.fullNameEn}
                              </p>
                              <p className="text-xs text-[var(--foreground-muted)]">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">{getRoleBadge(user.role)}</td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-[var(--foreground)]">
                            {department
                              ? language === 'ar'
                                ? department.nameAr
                                : department.nameEn
                              : '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-[var(--foreground-secondary)]">
                            {section
                              ? language === 'ar'
                                ? section.nameAr
                                : section.nameEn
                              : '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {user.canBeAuditor ? (
                            <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                              <Shield className="h-4 w-4" />
                              <span className="text-xs font-medium">
                                {language === 'ar' ? 'نعم' : 'Yes'}
                              </span>
                            </span>
                          ) : (
                            <span className="text-[var(--foreground-muted)] text-xs">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openUserDetail(user)}
                              className="rounded-lg p-2 text-[var(--foreground-secondary)] transition-colors hover:bg-[var(--background-secondary)] hover:text-[var(--primary)]"
                              title={language === 'ar' ? 'عرض التفاصيل' : 'View Details'}
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => openEditForm(user)}
                              className="rounded-lg p-2 text-[var(--foreground-secondary)] transition-colors hover:bg-[var(--background-secondary)] hover:text-[var(--primary)]"
                              title={language === 'ar' ? 'تعديل' : 'Edit'}
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            {user.role !== 'system_admin' && (
                              <button
                                onClick={() => {
                                  setSelectedUser(user);
                                  setShowResetPasswordConfirm(true);
                                }}
                                className="rounded-lg p-2 text-[var(--foreground-secondary)] transition-colors hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-900/20"
                                title={language === 'ar' ? 'إعادة تعيين كلمة المرور' : 'Reset Password'}
                              >
                                <KeyRound className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filteredUsers.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12">
                <Users className="h-12 w-12 text-[var(--foreground-muted)]" />
                <p className="mt-4 text-[var(--foreground-secondary)]">
                  {language === 'ar' ? 'لا يوجد مستخدمين' : 'No users found'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* User Detail Modal */}
        {showDetailModal && currentSelectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowDetailModal(false)}
            />
            <div className="relative w-full max-w-2xl rounded-2xl bg-[var(--card)] p-6 shadow-xl max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--primary-light)] text-[var(--primary)] font-bold text-xl">
                    {(language === 'ar' ? currentSelectedUser.fullNameAr : currentSelectedUser.fullNameEn).charAt(0)}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-[var(--foreground)]">
                      {language === 'ar' ? currentSelectedUser.fullNameAr : currentSelectedUser.fullNameEn}
                    </h2>
                    <p className="text-sm text-[var(--foreground-secondary)]">
                      {language === 'ar' ? currentSelectedUser.jobTitleAr : currentSelectedUser.jobTitleEn}
                    </p>
                    <div className="mt-1">{getRoleBadge(currentSelectedUser.role)}</div>
                  </div>
                </div>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="rounded-lg p-2 text-[var(--foreground-secondary)] hover:bg-[var(--background-tertiary)] hover:text-[var(--foreground)]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* User Info */}
              <div className="space-y-6">
                {/* Basic Info */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex items-center gap-3 rounded-xl bg-[var(--background-secondary)] p-3">
                    <Mail className="h-5 w-5 text-[var(--primary)]" />
                    <div>
                      <p className="text-xs text-[var(--foreground-muted)]">{t('users.email')}</p>
                      <p className="text-sm font-medium text-[var(--foreground)]">{currentSelectedUser.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-xl bg-[var(--background-secondary)] p-3">
                    <Phone className="h-5 w-5 text-[var(--primary)]" />
                    <div>
                      <p className="text-xs text-[var(--foreground-muted)]">{t('users.phone')}</p>
                      <p className="text-sm font-medium text-[var(--foreground)] font-mono" dir="ltr">
                        {currentSelectedUser.phone || '-'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Organization Info */}
                <div>
                  <h3 className="text-sm font-semibold text-[var(--foreground)] mb-3">
                    {language === 'ar' ? 'المعلومات التنظيمية' : 'Organization Info'}
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border border-[var(--border)] p-3">
                      <p className="text-xs text-[var(--foreground-muted)]">{t('users.department')}</p>
                      <p className="text-sm font-medium text-[var(--foreground)]">
                        {(() => {
                          const dept = getDepartmentById(currentSelectedUser.departmentId);
                          return dept ? (language === 'ar' ? dept.nameAr : dept.nameEn) : '-';
                        })()}
                      </p>
                    </div>
                    <div className="rounded-xl border border-[var(--border)] p-3">
                      <p className="text-xs text-[var(--foreground-muted)]">{t('users.section')}</p>
                      <p className="text-sm font-medium text-[var(--foreground)]">
                        {(() => {
                          const sect = currentSelectedUser.sectionId ? getSectionById(currentSelectedUser.sectionId) : null;
                          return sect ? (language === 'ar' ? sect.nameAr : sect.nameEn) : '-';
                        })()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Audit Capability */}
                {currentSelectedUser.canBeAuditor && (
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--foreground)] mb-3 flex items-center gap-2">
                      <Shield className="h-4 w-4 text-green-600" />
                      {language === 'ar' ? 'صلاحيات المراجعة' : 'Audit Permissions'}
                    </h3>
                    <div className="rounded-xl border border-green-200 dark:border-green-900/30 bg-green-50 dark:bg-green-900/10 p-4">
                      <p className="text-xs text-[var(--foreground-muted)] mb-2">
                        {t('users.auditableDepartments')}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {currentSelectedUser.auditableDepartmentIds.length > 0 ? (
                          currentSelectedUser.auditableDepartmentIds.map((deptId) => {
                            const dept = getDepartmentById(deptId);
                            return dept ? (
                              <span
                                key={deptId}
                                className="inline-flex items-center rounded-lg bg-white dark:bg-[var(--background)] px-2.5 py-1 text-xs font-medium text-[var(--foreground)]"
                              >
                                {language === 'ar' ? dept.nameAr : dept.nameEn}
                              </span>
                            ) : null;
                          })
                        ) : (
                          <span className="text-sm text-green-700 dark:text-green-400">
                            {language === 'ar' ? 'جميع الإدارات' : 'All Departments'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Status */}
                <div className="flex items-center justify-between rounded-xl bg-[var(--background-secondary)] p-4">
                  <span className="text-sm text-[var(--foreground-secondary)]">{t('users.isActive')}</span>
                  <Badge variant={currentSelectedUser.isActive ? 'approved' : 'rejected'}>
                    {currentSelectedUser.isActive
                      ? language === 'ar' ? 'نشط' : 'Active'
                      : language === 'ar' ? 'غير نشط' : 'Inactive'}
                  </Badge>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground-secondary)] transition-colors hover:bg-[var(--background-secondary)]"
                >
                  {t('common.close')}
                </button>
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    openEditForm(currentSelectedUser);
                  }}
                  className="rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--primary-hover)]"
                >
                  {t('users.editUser')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add/Edit User Form Modal */}
        {showFormModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowFormModal(false)}
            />
            <div className="relative w-full max-w-2xl rounded-2xl bg-white dark:bg-gray-900 p-6 shadow-xl max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-[var(--foreground)]">
                  {isEditing ? t('users.editUser') : t('users.newUser')}
                </h2>
                <button
                  onClick={() => setShowFormModal(false)}
                  className="rounded-lg p-2 text-[var(--foreground-secondary)] hover:bg-[var(--background-tertiary)] hover:text-[var(--foreground)]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Form */}
              <div className="space-y-6">
                {/* Basic Info */}
                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Email */}
                  <div>
                    <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                      {t('users.email')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => updateFormField('email', e.target.value)}
                      className={`w-full rounded-xl border ${formErrors.email ? 'border-red-500' : 'border-[var(--border)]'} bg-[var(--background)] py-2.5 px-4 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-light)]`}
                      placeholder="user@saudicable.com"
                      dir="ltr"
                    />
                    {formErrors.email && (
                      <p className="mt-1 text-xs text-red-500">{formErrors.email}</p>
                    )}
                  </div>

                  {/* Arabic Name */}
                  <div>
                    <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                      {language === 'ar' ? 'الاسم بالعربي' : 'Arabic Name'} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.fullNameAr}
                      onChange={(e) => updateFormField('fullNameAr', e.target.value)}
                      className={`w-full rounded-xl border ${formErrors.fullNameAr ? 'border-red-500' : 'border-[var(--border)]'} bg-[var(--background)] py-2.5 px-4 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-light)]`}
                      placeholder="محمد أحمد"
                      dir="rtl"
                    />
                    {formErrors.fullNameAr && (
                      <p className="mt-1 text-xs text-red-500">{formErrors.fullNameAr}</p>
                    )}
                  </div>

                  {/* English Name */}
                  <div>
                    <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                      {language === 'ar' ? 'الاسم بالإنجليزي' : 'English Name'} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.fullNameEn}
                      onChange={(e) => updateFormField('fullNameEn', e.target.value)}
                      className={`w-full rounded-xl border ${formErrors.fullNameEn ? 'border-red-500' : 'border-[var(--border)]'} bg-[var(--background)] py-2.5 px-4 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-light)]`}
                      placeholder="Mohammed Ahmed"
                      dir="ltr"
                    />
                    {formErrors.fullNameEn && (
                      <p className="mt-1 text-xs text-red-500">{formErrors.fullNameEn}</p>
                    )}
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                      {t('users.phone')}
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => updateFormField('phone', e.target.value)}
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] py-2.5 px-4 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-light)]"
                      placeholder="+966501234567"
                      dir="ltr"
                    />
                  </div>

                  {/* Role */}
                  <div>
                    <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                      {t('users.role')} <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <select
                        value={formData.role}
                        onChange={(e) => updateFormField('role', e.target.value as UserRole)}
                        className="w-full appearance-none rounded-xl border border-[var(--border)] bg-[var(--background)] py-2.5 pe-10 ps-4 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-light)]"
                      >
                        {roles.map((role) => (
                          <option key={role} value={role}>
                            {language === 'ar' ? getRoleNameAr(role) : getRoleNameEn(role)}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--foreground-muted)]" />
                    </div>
                  </div>
                </div>

                {/* Job Title - Dropdown based on departments */}
                <div>
                  <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                    {language === 'ar' ? 'المسمى الوظيفي' : 'Job Title'}
                  </label>
                  <div className="relative">
                    <select
                      value={formData.jobTitleAr || ''}
                      onChange={(e) => {
                        const selectedDept = departments.find(d => d.nameAr === e.target.value);
                        if (selectedDept) {
                          updateFormField('jobTitleAr', selectedDept.nameAr);
                          updateFormField('jobTitleEn', selectedDept.nameEn);
                        } else {
                          updateFormField('jobTitleAr', '');
                          updateFormField('jobTitleEn', '');
                        }
                      }}
                      className="w-full appearance-none rounded-xl border border-[var(--border)] bg-[var(--background)] py-2.5 pe-10 ps-4 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-light)]"
                    >
                      <option value="">{language === 'ar' ? 'اختر المسمى الوظيفي' : 'Select Job Title'}</option>
                      {departments.map((dept) => (
                        <option key={dept.id} value={dept.nameAr}>
                          {language === 'ar' ? dept.nameAr : dept.nameEn}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--foreground-muted)]" />
                  </div>
                </div>

                {/* Organization */}
                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Department */}
                  <div>
                    <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                      {t('users.department')} <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <select
                        value={formData.departmentId}
                        onChange={(e) => {
                          updateFormField('departmentId', e.target.value);
                          updateFormField('sectionId', undefined);
                        }}
                        className={`w-full appearance-none rounded-xl border ${formErrors.departmentId ? 'border-red-500' : 'border-[var(--border)]'} bg-[var(--background)] py-2.5 pe-10 ps-4 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-light)]`}
                      >
                        <option value="">{t('organization.selectDepartment')}</option>
                        {departments.map((dept) => (
                          <option key={dept.id} value={dept.id}>
                            {language === 'ar' ? dept.nameAr : dept.nameEn}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--foreground-muted)]" />
                    </div>
                    {formErrors.departmentId && (
                      <p className="mt-1 text-xs text-red-500">{formErrors.departmentId}</p>
                    )}
                  </div>

                  {/* Section */}
                  <div>
                    <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                      {t('users.section')}
                    </label>
                    <div className="relative">
                      <select
                        value={formData.sectionId || ''}
                        onChange={(e) => updateFormField('sectionId', e.target.value || undefined)}
                        className="w-full appearance-none rounded-xl border border-[var(--border)] bg-[var(--background)] py-2.5 pe-10 ps-4 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-light)] disabled:opacity-50"
                        disabled={!formData.departmentId}
                      >
                        <option value="">{t('organization.selectSection')}</option>
                        {availableSections.map((section) => (
                          <option key={section.id} value={section.id}>
                            {language === 'ar' ? section.nameAr : section.nameEn}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--foreground-muted)]" />
                    </div>
                  </div>
                </div>

                {/* Auditor Settings */}
                <div className="rounded-xl border border-[var(--border)] p-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.canBeAuditor}
                      onChange={(e) => updateFormField('canBeAuditor', e.target.checked)}
                      className="h-5 w-5 rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]"
                    />
                    <div>
                      <p className="font-medium text-[var(--foreground)]">{t('users.canBeAuditor')}</p>
                      <p className="text-xs text-[var(--foreground-secondary)]">
                        {language === 'ar'
                          ? 'السماح لهذا المستخدم بإجراء المراجعات الداخلية'
                          : 'Allow this user to conduct internal audits'}
                      </p>
                    </div>
                  </label>

                  {formData.canBeAuditor && (
                    <div className="mt-4 pt-4 border-t border-[var(--border)]">
                      <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                        {t('users.auditableDepartments')}
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {departments.map((dept) => (
                          <label
                            key={dept.id}
                            className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm cursor-pointer transition-colors ${
                              formData.auditableDepartmentIds.includes(dept.id)
                                ? 'bg-[var(--primary)] text-white'
                                : 'bg-[var(--background-secondary)] text-[var(--foreground-secondary)] hover:bg-[var(--background-tertiary)]'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={formData.auditableDepartmentIds.includes(dept.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  updateFormField('auditableDepartmentIds', [...formData.auditableDepartmentIds, dept.id]);
                                } else {
                                  updateFormField('auditableDepartmentIds', formData.auditableDepartmentIds.filter(id => id !== dept.id));
                                }
                              }}
                              className="sr-only"
                            />
                            {language === 'ar' ? dept.nameAr : dept.nameEn}
                          </label>
                        ))}
                      </div>
                      <p className="mt-2 text-xs text-[var(--foreground-muted)]">
                        {language === 'ar'
                          ? 'اترك فارغاً للسماح بمراجعة جميع الإدارات'
                          : 'Leave empty to allow auditing all departments'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Active Status */}
                <div className="flex items-center justify-between rounded-xl bg-[var(--background-secondary)] p-4">
                  <div>
                    <p className="font-medium text-[var(--foreground)]">{t('users.isActive')}</p>
                    <p className="text-xs text-[var(--foreground-secondary)]">
                      {language === 'ar'
                        ? 'تفعيل أو تعطيل حساب المستخدم'
                        : 'Enable or disable user account'}
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => updateFormField('isActive', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[var(--primary-light)] rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-[var(--primary)]"></div>
                  </label>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-6 flex items-center justify-between">
                {isEditing && isSystemAdmin ? (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <Trash2 className="h-4 w-4" />
                    {t('common.delete')}
                  </button>
                ) : (
                  <div />
                )}
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowFormModal(false)}
                    className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground-secondary)] transition-colors hover:bg-[var(--background-secondary)]"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    onClick={handleSave}
                    className="inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--primary-hover)]"
                  >
                    <Save className="h-4 w-4" />
                    {t('common.save')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && selectedUser && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowDeleteConfirm(false)}
            />
            <div className="relative w-full max-w-md rounded-2xl bg-[var(--card)] p-6 shadow-xl">
              <div className="flex items-center gap-4 mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                  <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[var(--foreground)]">
                    {language === 'ar' ? 'تأكيد الحذف' : 'Confirm Delete'}
                  </h3>
                  <p className="text-sm text-[var(--foreground-secondary)]">
                    {language === 'ar'
                      ? `هل أنت متأكد من حذف "${selectedUser.fullNameAr}"؟`
                      : `Are you sure you want to delete "${selectedUser.fullNameEn}"?`}
                  </p>
                </div>
              </div>
              <p className="text-sm text-[var(--foreground-muted)] mb-6">
                {language === 'ar'
                  ? 'هذا الإجراء لا يمكن التراجع عنه.'
                  : 'This action cannot be undone.'}
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground-secondary)] transition-colors hover:bg-[var(--background-secondary)]"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleDelete}
                  className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700"
                >
                  {t('common.delete')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reset Password Confirmation Modal */}
        {showResetPasswordConfirm && selectedUser && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => !passwordResetSuccess && setShowResetPasswordConfirm(false)}
            />
            <div className="relative w-full max-w-md rounded-2xl bg-[var(--card)] p-6 shadow-xl">
              {passwordResetSuccess ? (
                <div className="flex flex-col items-center py-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
                    <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
                  </div>
                  <h3 className="text-lg font-bold text-[var(--foreground)] mb-2">
                    {language === 'ar' ? 'تم بنجاح!' : 'Success!'}
                  </h3>
                  <p className="text-sm text-[var(--foreground-secondary)] text-center">
                    {language === 'ar'
                      ? 'تم إعادة تعيين كلمة المرور إلى: Welcome@123'
                      : 'Password has been reset to: Welcome@123'}
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                      <KeyRound className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-[var(--foreground)]">
                        {language === 'ar' ? 'إعادة تعيين كلمة المرور' : 'Reset Password'}
                      </h3>
                      <p className="text-sm text-[var(--foreground-secondary)]">
                        {language === 'ar'
                          ? `إعادة تعيين كلمة مرور "${selectedUser.fullNameAr}"؟`
                          : `Reset password for "${selectedUser.fullNameEn}"?`}
                      </p>
                    </div>
                  </div>
                  <div className="rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 p-4 mb-6">
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      {language === 'ar'
                        ? 'سيتم تعيين كلمة المرور الجديدة إلى:'
                        : 'New password will be set to:'}
                    </p>
                    <p className="text-lg font-mono font-bold text-amber-900 dark:text-amber-100 mt-1">
                      Welcome@123
                    </p>
                  </div>
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => setShowResetPasswordConfirm(false)}
                      className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground-secondary)] transition-colors hover:bg-[var(--background-secondary)]"
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      onClick={handleResetPassword}
                      className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-700"
                    >
                      {language === 'ar' ? 'إعادة التعيين' : 'Reset Password'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
