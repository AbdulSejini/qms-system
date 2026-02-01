'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { useTranslation } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  getRoleNameAr,
  getRoleNameEn,
} from '@/data/mock-data';
import { Department, Section } from '@/types';
import {
  saveDepartment,
  saveSection,
  deleteDepartment as deleteDepartmentFromFirestore,
  deleteSection as deleteSectionFromFirestore,
} from '@/lib/firestore';
import {
  Building2,
  Users,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Plus,
  Edit2,
  Eye,
  Search,
  FolderTree,
  X,
  List,
  Save,
  Trash2,
  AlertCircle,
  Loader2,
} from 'lucide-react';

// نماذج فارغة
const emptyDepartment: Omit<Department, 'id' | 'createdAt' | 'updatedAt'> = {
  code: '',
  nameAr: '',
  nameEn: '',
  descriptionAr: '',
  descriptionEn: '',
  managerId: undefined,
  isActive: true,
};

const emptySection: Omit<Section, 'id' | 'createdAt' | 'updatedAt'> = {
  code: '',
  departmentId: '',
  nameAr: '',
  nameEn: '',
  descriptionAr: '',
  descriptionEn: '',
  headId: undefined,
  isActive: true,
};

export default function DepartmentsPage() {
  const { t, language, isRTL } = useTranslation();
  const { canManageDepartments, hasPermission, departments, sections, users, dataLoaded, refreshData } = useAuth();

  // استخدام البيانات من الـ cache
  const departmentsData = departments;
  const sectionsData = sections;
  const usersData = users;

  // Loading state - use dataLoaded from context instead of checking array lengths
  const isLoading = !dataLoaded;
  const [isSaving, setIsSaving] = useState(false);

  // تحميل البيانات عند الحاجة
  const loadData = useCallback(async () => {
    await refreshData();
  }, [refreshData]);

  // State للعرض
  const [viewMode, setViewMode] = useState<'tree' | 'list'>('tree');
  const [expandedDepartments, setExpandedDepartments] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // توسيع جميع الإدارات عند تحميل البيانات
  useEffect(() => {
    if (departmentsData.length > 0 && expandedDepartments.length === 0) {
      setExpandedDepartments(departmentsData.map(d => d.id));
    }
  }, [departmentsData, expandedDepartments.length]);

  // State للنماذج
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [selectedSection, setSelectedSection] = useState<Section | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeptFormModal, setShowDeptFormModal] = useState(false);
  const [showSectionFormModal, setShowSectionFormModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [deptFormData, setDeptFormData] = useState<Omit<Department, 'id' | 'createdAt' | 'updatedAt'>>(emptyDepartment);
  const [sectionFormData, setSectionFormData] = useState<Omit<Section, 'id' | 'createdAt' | 'updatedAt'>>(emptySection);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteType, setDeleteType] = useState<'department' | 'section'>('department');

  const toggleDepartment = (deptId: string) => {
    setExpandedDepartments((prev) =>
      prev.includes(deptId) ? prev.filter((id) => id !== deptId) : [...prev, deptId]
    );
  };

  // Filter departments
  const filteredDepartments = useMemo(() => {
    if (!searchQuery) return departmentsData;
    const query = searchQuery.toLowerCase();
    return departmentsData.filter(
      (dept) =>
        dept.nameAr.toLowerCase().includes(query) ||
        dept.nameEn.toLowerCase().includes(query) ||
        dept.code.toLowerCase().includes(query)
    );
  }, [departmentsData, searchQuery]);

  // دوال مساعدة
  const getDepartmentById = (id: string) => departmentsData.find(d => d.id === id);
  const getSectionsForDepartment = (deptId: string) => sectionsData.filter(s => s.departmentId === deptId && s.isActive);
  const getUsersByDepartment = (deptId: string) => usersData.filter(u => u.departmentId === deptId && u.isActive);
  const getUsersBySection = (sectionId: string) => usersData.filter(u => u.sectionId === sectionId && u.isActive);
  const getUserFromList = (userId: string) => usersData.find(u => u.id === userId);

  // Stats
  const stats = {
    departments: departmentsData.length,
    sections: sectionsData.length,
    employees: usersData.filter(u => u.isActive).length,
  };

  const Arrow = isRTL ? ChevronLeft : ChevronRight;

  // فتح نموذج إضافة إدارة
  const openAddDeptForm = () => {
    setDeptFormData(emptyDepartment);
    setFormErrors({});
    setIsEditing(false);
    setShowDeptFormModal(true);
  };

  // فتح نموذج تعديل إدارة
  const openEditDeptForm = (dept: Department) => {
    setDeptFormData({
      code: dept.code,
      nameAr: dept.nameAr,
      nameEn: dept.nameEn,
      descriptionAr: dept.descriptionAr || '',
      descriptionEn: dept.descriptionEn || '',
      managerId: dept.managerId,
      isActive: dept.isActive,
    });
    setFormErrors({});
    setSelectedDepartment(dept);
    setIsEditing(true);
    setShowDeptFormModal(true);
  };

  // فتح نموذج إضافة قسم
  const openAddSectionForm = (departmentId?: string) => {
    setSectionFormData({ ...emptySection, departmentId: departmentId || '' });
    setFormErrors({});
    setIsEditing(false);
    setShowSectionFormModal(true);
  };

  // فتح نموذج تعديل قسم
  const openEditSectionForm = (section: Section) => {
    setSectionFormData({
      code: section.code,
      departmentId: section.departmentId,
      nameAr: section.nameAr,
      nameEn: section.nameEn,
      descriptionAr: section.descriptionAr || '',
      descriptionEn: section.descriptionEn || '',
      headId: section.headId,
      isActive: section.isActive,
    });
    setFormErrors({});
    setSelectedSection(section);
    setIsEditing(true);
    setShowSectionFormModal(true);
  };

  // عرض تفاصيل
  const openDepartmentDetail = (dept: Department) => {
    setSelectedDepartment(dept);
    setSelectedSection(null);
    setShowDetailModal(true);
  };

  const openSectionDetail = (section: Section) => {
    setSelectedSection(section);
    setSelectedDepartment(null);
    setShowDetailModal(true);
  };

  // التحقق من صحة نموذج الإدارة
  const validateDeptForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!deptFormData.code.trim()) {
      errors.code = language === 'ar' ? 'رمز الإدارة مطلوب' : 'Department code is required';
    } else if (!isEditing && departmentsData.some(d => d.code === deptFormData.code)) {
      errors.code = language === 'ar' ? 'الرمز موجود مسبقاً' : 'Code already exists';
    }

    if (!deptFormData.nameAr.trim()) {
      errors.nameAr = language === 'ar' ? 'الاسم بالعربي مطلوب' : 'Arabic name is required';
    }

    if (!deptFormData.nameEn.trim()) {
      errors.nameEn = language === 'ar' ? 'الاسم بالإنجليزي مطلوب' : 'English name is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // التحقق من صحة نموذج القسم
  const validateSectionForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!sectionFormData.code.trim()) {
      errors.code = language === 'ar' ? 'رمز القسم مطلوب' : 'Section code is required';
    } else if (!isEditing && sectionsData.some(s => s.code === sectionFormData.code)) {
      errors.code = language === 'ar' ? 'الرمز موجود مسبقاً' : 'Code already exists';
    }

    if (!sectionFormData.departmentId) {
      errors.departmentId = language === 'ar' ? 'الإدارة مطلوبة' : 'Department is required';
    }

    if (!sectionFormData.nameAr.trim()) {
      errors.nameAr = language === 'ar' ? 'الاسم بالعربي مطلوب' : 'Arabic name is required';
    }

    if (!sectionFormData.nameEn.trim()) {
      errors.nameEn = language === 'ar' ? 'الاسم بالإنجليزي مطلوب' : 'English name is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // حفظ الإدارة
  const handleSaveDept = async () => {
    if (!validateDeptForm()) return;

    setIsSaving(true);
    try {
      if (isEditing && selectedDepartment) {
        const updatedDept: Department = {
          ...selectedDepartment,
          ...deptFormData,
          updatedAt: new Date(),
        };
        await saveDepartment(updatedDept);
      } else {
        const newDept: Department = {
          id: `dept-${Date.now()}`,
          ...deptFormData,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        await saveDepartment(newDept);
      }

      await loadData();
      setShowDeptFormModal(false);
      setSelectedDepartment(null);
    } catch (error) {
      console.error('Error saving department:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // حفظ القسم
  const handleSaveSection = async () => {
    if (!validateSectionForm()) return;

    setIsSaving(true);
    try {
      if (isEditing && selectedSection) {
        const updatedSection: Section = {
          ...selectedSection,
          ...sectionFormData,
          updatedAt: new Date(),
        };
        await saveSection(updatedSection);
      } else {
        const newSection: Section = {
          id: `sec-${Date.now()}`,
          ...sectionFormData,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        await saveSection(newSection);
      }

      await loadData();
      setShowSectionFormModal(false);
      setSelectedSection(null);
    } catch (error) {
      console.error('Error saving section:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // حذف
  const handleDelete = async () => {
    setIsSaving(true);
    try {
      if (deleteType === 'department' && selectedDepartment) {
        // حذف جميع الأقسام التابعة للإدارة أولاً
        const deptSections = sectionsData.filter(s => s.departmentId === selectedDepartment.id);
        for (const section of deptSections) {
          await deleteSectionFromFirestore(section.id);
        }
        await deleteDepartmentFromFirestore(selectedDepartment.id);
      } else if (deleteType === 'section' && selectedSection) {
        await deleteSectionFromFirestore(selectedSection.id);
      }

      await loadData();
      setShowDeleteConfirm(false);
      setShowDeptFormModal(false);
      setShowSectionFormModal(false);
      setSelectedDepartment(null);
      setSelectedSection(null);
    } catch (error) {
      console.error('Error deleting:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // المدراء المتاحون
  const availableManagers = usersData.filter(u =>
    u.isActive && (u.role === 'department_manager' || u.role === 'quality_manager' || u.role === 'system_admin')
  );

  // رؤساء الأقسام المتاحون
  const availableHeads = usersData.filter(u =>
    u.isActive && (u.role === 'section_head' || u.role === 'department_manager')
  );

  // Loading state
  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <Loader2 className="h-12 w-12 text-[var(--primary)] animate-spin" />
          <p className="mt-4 text-[var(--foreground-secondary)]">
            {language === 'ar' ? 'جاري التحميل...' : 'Loading...'}
          </p>
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
              {t('departments.title')}
            </h1>
            <p className="mt-1 text-[var(--foreground-secondary)]">
              {language === 'ar'
                ? `${stats.departments} إدارة • ${stats.sections} قسم • ${stats.employees} موظف`
                : `${stats.departments} departments • ${stats.sections} sections • ${stats.employees} employees`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* View Mode Toggle */}
            <div className="flex rounded-xl border border-[var(--border)] p-1">
              <button
                onClick={() => setViewMode('tree')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  viewMode === 'tree'
                    ? 'bg-[var(--primary)] text-white'
                    : 'text-[var(--foreground-secondary)] hover:text-[var(--foreground)]'
                }`}
              >
                <FolderTree className="h-4 w-4" />
                {language === 'ar' ? 'شجري' : 'Tree'}
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  viewMode === 'list'
                    ? 'bg-[var(--primary)] text-white'
                    : 'text-[var(--foreground-secondary)] hover:text-[var(--foreground)]'
                }`}
              >
                <List className="h-4 w-4" />
                {language === 'ar' ? 'قائمة' : 'List'}
              </button>
            </div>
            <button
              onClick={openAddDeptForm}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[var(--primary-hover)]"
            >
              <Plus className="h-4 w-4" />
              {t('departments.newDepartment')}
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-[var(--card)]">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30">
                  <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[var(--foreground)]">{stats.departments}</p>
                  <p className="text-xs text-[var(--foreground-secondary)]">
                    {language === 'ar' ? 'الإدارات' : 'Departments'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/20 dark:to-[var(--card)]">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-900/30">
                  <FolderTree className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[var(--foreground)]">{stats.sections}</p>
                  <p className="text-xs text-[var(--foreground-secondary)]">
                    {language === 'ar' ? 'الأقسام' : 'Sections'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-white dark:from-green-950/20 dark:to-[var(--card)]">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100 dark:bg-green-900/30">
                  <Users className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[var(--foreground)]">{stats.employees}</p>
                  <p className="text-xs text-[var(--foreground-secondary)]">
                    {language === 'ar' ? 'الموظفين' : 'Employees'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--foreground-muted)]" />
              <input
                type="text"
                placeholder={language === 'ar' ? 'بحث في الإدارات والأقسام...' : 'Search departments and sections...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] py-2.5 pe-4 ps-10 text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-muted)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-light)]"
              />
            </div>
          </CardContent>
        </Card>

        {/* Tree View */}
        {viewMode === 'tree' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderTree className="h-5 w-5 text-[var(--primary)]" />
                {t('organization.structure')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {filteredDepartments.map((dept) => {
                  const deptSections = getSectionsForDepartment(dept.id);
                  const deptUsers = getUsersByDepartment(dept.id);
                  const isExpanded = expandedDepartments.includes(dept.id);
                  const manager = dept.managerId ? getUserFromList(dept.managerId) : null;

                  return (
                    <div key={dept.id} className="rounded-xl border border-[var(--border)]">
                      {/* Department Header */}
                      <div
                        className="flex items-center gap-3 p-4 cursor-pointer transition-colors hover:bg-[var(--background-tertiary)]"
                        onClick={() => toggleDepartment(dept.id)}
                      >
                        <button className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--background-secondary)] text-[var(--foreground-secondary)] transition-transform">
                          <ChevronDown
                            className={`h-4 w-4 transition-transform ${
                              isExpanded ? '' : isRTL ? 'rotate-90' : '-rotate-90'
                            }`}
                          />
                        </button>
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30">
                          <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-[var(--foreground)]">
                              {language === 'ar' ? dept.nameAr : dept.nameEn}
                            </h3>
                            <span className="text-xs font-mono text-[var(--foreground-muted)] bg-[var(--background-secondary)] px-2 py-0.5 rounded">
                              {dept.code}
                            </span>
                          </div>
                          {manager && (
                            <p className="text-xs text-[var(--foreground-secondary)]">
                              {language === 'ar' ? 'المدير:' : 'Manager:'}{' '}
                              {language === 'ar' ? manager.fullNameAr : manager.fullNameEn}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-[var(--foreground-secondary)]">
                          <span className="flex items-center gap-1">
                            <FolderTree className="h-4 w-4" />
                            {deptSections.length}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            {deptUsers.length}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openDepartmentDetail(dept);
                            }}
                            className="rounded-lg p-2 text-[var(--foreground-secondary)] transition-colors hover:bg-[var(--background-secondary)] hover:text-[var(--primary)]"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditDeptForm(dept);
                            }}
                            className="rounded-lg p-2 text-[var(--foreground-secondary)] transition-colors hover:bg-[var(--background-secondary)] hover:text-[var(--primary)]"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {/* Sections */}
                      {isExpanded && (
                        <div className="border-t border-[var(--border)] bg-[var(--background-secondary)] p-4">
                          <div className="ms-10 space-y-2">
                            {deptSections.map((section) => {
                              const sectionUsers = getUsersBySection(section.id);
                              const head = section.headId ? getUserFromList(section.headId) : null;

                              return (
                                <div
                                  key={section.id}
                                  className="flex items-center gap-3 rounded-lg bg-[var(--card)] p-3 transition-colors hover:bg-[var(--background-tertiary)]"
                                >
                                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
                                    <FolderTree className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <p className="font-medium text-[var(--foreground)]">
                                        {language === 'ar' ? section.nameAr : section.nameEn}
                                      </p>
                                      <span className="text-xs font-mono text-[var(--foreground-muted)] bg-[var(--background-secondary)] px-1.5 py-0.5 rounded">
                                        {section.code}
                                      </span>
                                    </div>
                                    {head && (
                                      <p className="text-xs text-[var(--foreground-secondary)]">
                                        {language === 'ar' ? 'الرئيس:' : 'Head:'}{' '}
                                        {language === 'ar' ? head.fullNameAr : head.fullNameEn}
                                      </p>
                                    )}
                                  </div>
                                  <span className="flex items-center gap-1 text-sm text-[var(--foreground-secondary)]">
                                    <Users className="h-4 w-4" />
                                    {sectionUsers.length}
                                  </span>
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => openSectionDetail(section)}
                                      className="rounded-lg p-1.5 text-[var(--foreground-secondary)] transition-colors hover:bg-[var(--background-secondary)] hover:text-[var(--primary)]"
                                    >
                                      <Eye className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      onClick={() => openEditSectionForm(section)}
                                      className="rounded-lg p-1.5 text-[var(--foreground-secondary)] transition-colors hover:bg-[var(--background-secondary)] hover:text-[var(--primary)]"
                                    >
                                      <Edit2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                            {/* Add Section Button */}
                            <button
                              onClick={() => openAddSectionForm(dept.id)}
                              className="flex items-center gap-2 rounded-lg border-2 border-dashed border-[var(--border)] p-2 text-sm text-[var(--foreground-secondary)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)] w-full justify-center"
                            >
                              <Plus className="h-4 w-4" />
                              {t('departments.sections.newSection')}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* List View */}
        {viewMode === 'list' && (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Departments List */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-blue-600" />
                    {language === 'ar' ? 'الإدارات' : 'Departments'}
                  </CardTitle>
                  <button
                    onClick={openAddDeptForm}
                    className="rounded-lg p-2 text-[var(--primary)] hover:bg-[var(--primary-light)]"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {filteredDepartments.map((dept) => {
                    const deptSections = getSectionsForDepartment(dept.id);
                    const deptUsers = getUsersByDepartment(dept.id);

                    return (
                      <div
                        key={dept.id}
                        className="flex items-center gap-3 rounded-xl border border-[var(--border)] p-3 transition-colors hover:bg-[var(--background-tertiary)] cursor-pointer"
                        onClick={() => openDepartmentDetail(dept)}
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30 shrink-0">
                          <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-[var(--foreground)] truncate">
                              {language === 'ar' ? dept.nameAr : dept.nameEn}
                            </p>
                            <span className="text-xs font-mono text-[var(--foreground-muted)] bg-[var(--background-secondary)] px-1.5 py-0.5 rounded shrink-0">
                              {dept.code}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-[var(--foreground-secondary)]">
                            <span>{deptSections.length} {language === 'ar' ? 'أقسام' : 'sections'}</span>
                            <span>{deptUsers.length} {language === 'ar' ? 'موظفين' : 'employees'}</span>
                          </div>
                        </div>
                        <Arrow className="h-4 w-4 text-[var(--foreground-muted)]" />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Sections List */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <FolderTree className="h-5 w-5 text-purple-600" />
                    {language === 'ar' ? 'الأقسام' : 'Sections'}
                  </CardTitle>
                  <button
                    onClick={() => openAddSectionForm()}
                    className="rounded-lg p-2 text-[var(--primary)] hover:bg-[var(--primary-light)]"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {sectionsData.filter(s => s.isActive).map((section) => {
                    const dept = getDepartmentById(section.departmentId);
                    const sectionUsers = getUsersBySection(section.id);

                    return (
                      <div
                        key={section.id}
                        className="flex items-center gap-3 rounded-xl border border-[var(--border)] p-3 transition-colors hover:bg-[var(--background-tertiary)] cursor-pointer"
                        onClick={() => openSectionDetail(section)}
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-900/30 shrink-0">
                          <FolderTree className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-[var(--foreground)] truncate">
                            {language === 'ar' ? section.nameAr : section.nameEn}
                          </p>
                          <p className="text-xs text-[var(--foreground-secondary)] truncate">
                            {dept ? (language === 'ar' ? dept.nameAr : dept.nameEn) : ''} •{' '}
                            {sectionUsers.length} {language === 'ar' ? 'موظفين' : 'employees'}
                          </p>
                        </div>
                        <Arrow className="h-4 w-4 text-[var(--foreground-muted)]" />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Department Form Modal */}
        {showDeptFormModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowDeptFormModal(false)} />
            <div className="relative w-full max-w-lg rounded-2xl bg-[var(--card)] p-6 shadow-xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-[var(--foreground)]">
                  {isEditing ? t('departments.editDepartment') : t('departments.newDepartment')}
                </h2>
                <button onClick={() => setShowDeptFormModal(false)} className="rounded-lg p-2 text-[var(--foreground-secondary)] hover:bg-[var(--background-tertiary)]">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Code */}
                <div>
                  <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                    {t('departments.departmentCode')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={deptFormData.code}
                    onChange={(e) => setDeptFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                    className={`w-full rounded-xl border ${formErrors.code ? 'border-red-500' : 'border-[var(--border)]'} bg-[var(--background)] py-2.5 px-4 text-sm font-mono`}
                    placeholder="HR"
                    disabled={isEditing}
                  />
                  {formErrors.code && <p className="mt-1 text-xs text-red-500">{formErrors.code}</p>}
                </div>

                {/* Names */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                      {language === 'ar' ? 'الاسم بالعربي' : 'Arabic Name'} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={deptFormData.nameAr}
                      onChange={(e) => setDeptFormData(prev => ({ ...prev, nameAr: e.target.value }))}
                      className={`w-full rounded-xl border ${formErrors.nameAr ? 'border-red-500' : 'border-[var(--border)]'} bg-[var(--background)] py-2.5 px-4 text-sm`}
                      dir="rtl"
                    />
                    {formErrors.nameAr && <p className="mt-1 text-xs text-red-500">{formErrors.nameAr}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                      {language === 'ar' ? 'الاسم بالإنجليزي' : 'English Name'} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={deptFormData.nameEn}
                      onChange={(e) => setDeptFormData(prev => ({ ...prev, nameEn: e.target.value }))}
                      className={`w-full rounded-xl border ${formErrors.nameEn ? 'border-red-500' : 'border-[var(--border)]'} bg-[var(--background)] py-2.5 px-4 text-sm`}
                      dir="ltr"
                    />
                    {formErrors.nameEn && <p className="mt-1 text-xs text-red-500">{formErrors.nameEn}</p>}
                  </div>
                </div>

                {/* Manager */}
                <div>
                  <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                    {t('departments.manager')}
                  </label>
                  <div className="relative">
                    <select
                      value={deptFormData.managerId || ''}
                      onChange={(e) => setDeptFormData(prev => ({ ...prev, managerId: e.target.value || undefined }))}
                      className="w-full appearance-none rounded-xl border border-[var(--border)] bg-[var(--background)] py-2.5 pe-10 ps-4 text-sm"
                    >
                      <option value="">{language === 'ar' ? 'اختر المدير' : 'Select Manager'}</option>
                      {availableManagers.map(u => (
                        <option key={u.id} value={u.id}>
                          {language === 'ar' ? u.fullNameAr : u.fullNameEn}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--foreground-muted)]" />
                  </div>
                </div>

                {/* Active */}
                <div className="flex items-center justify-between rounded-xl bg-[var(--background-secondary)] p-4">
                  <span className="text-sm font-medium text-[var(--foreground)]">
                    {language === 'ar' ? 'نشط' : 'Active'}
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={deptFormData.isActive}
                      onChange={(e) => setDeptFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-[var(--primary-light)] rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--primary)]"></div>
                  </label>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between">
                {isEditing && hasPermission('canDeleteAudits') ? (
                  <button
                    onClick={() => { setDeleteType('department'); setShowDeleteConfirm(true); }}
                    disabled={isSaving}
                    className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    {t('common.delete')}
                  </button>
                ) : <div />}
                <div className="flex gap-3">
                  <button onClick={() => setShowDeptFormModal(false)} disabled={isSaving} className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground-secondary)] disabled:opacity-50">
                    {t('common.cancel')}
                  </button>
                  <button onClick={handleSaveDept} disabled={isSaving} className="inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {t('common.save')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Section Form Modal */}
        {showSectionFormModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowSectionFormModal(false)} />
            <div className="relative w-full max-w-lg rounded-2xl bg-[var(--card)] p-6 shadow-xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-[var(--foreground)]">
                  {isEditing ? t('departments.sections.editSection') : t('departments.sections.newSection')}
                </h2>
                <button onClick={() => setShowSectionFormModal(false)} className="rounded-lg p-2 text-[var(--foreground-secondary)] hover:bg-[var(--background-tertiary)]">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Department */}
                <div>
                  <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                    {t('departments.sections.parentDepartment')} <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={sectionFormData.departmentId}
                      onChange={(e) => setSectionFormData(prev => ({ ...prev, departmentId: e.target.value }))}
                      className={`w-full appearance-none rounded-xl border ${formErrors.departmentId ? 'border-red-500' : 'border-[var(--border)]'} bg-[var(--background)] py-2.5 pe-10 ps-4 text-sm`}
                      disabled={isEditing}
                    >
                      <option value="">{t('organization.selectDepartment')}</option>
                      {departmentsData.filter(d => d.isActive).map(d => (
                        <option key={d.id} value={d.id}>{language === 'ar' ? d.nameAr : d.nameEn}</option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--foreground-muted)]" />
                  </div>
                  {formErrors.departmentId && <p className="mt-1 text-xs text-red-500">{formErrors.departmentId}</p>}
                </div>

                {/* Code */}
                <div>
                  <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                    {t('departments.sections.sectionCode')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={sectionFormData.code}
                    onChange={(e) => setSectionFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                    className={`w-full rounded-xl border ${formErrors.code ? 'border-red-500' : 'border-[var(--border)]'} bg-[var(--background)] py-2.5 px-4 text-sm font-mono`}
                    placeholder="HR-REC"
                    disabled={isEditing}
                  />
                  {formErrors.code && <p className="mt-1 text-xs text-red-500">{formErrors.code}</p>}
                </div>

                {/* Names */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                      {language === 'ar' ? 'الاسم بالعربي' : 'Arabic Name'} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={sectionFormData.nameAr}
                      onChange={(e) => setSectionFormData(prev => ({ ...prev, nameAr: e.target.value }))}
                      className={`w-full rounded-xl border ${formErrors.nameAr ? 'border-red-500' : 'border-[var(--border)]'} bg-[var(--background)] py-2.5 px-4 text-sm`}
                      dir="rtl"
                    />
                    {formErrors.nameAr && <p className="mt-1 text-xs text-red-500">{formErrors.nameAr}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                      {language === 'ar' ? 'الاسم بالإنجليزي' : 'English Name'} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={sectionFormData.nameEn}
                      onChange={(e) => setSectionFormData(prev => ({ ...prev, nameEn: e.target.value }))}
                      className={`w-full rounded-xl border ${formErrors.nameEn ? 'border-red-500' : 'border-[var(--border)]'} bg-[var(--background)] py-2.5 px-4 text-sm`}
                      dir="ltr"
                    />
                    {formErrors.nameEn && <p className="mt-1 text-xs text-red-500">{formErrors.nameEn}</p>}
                  </div>
                </div>

                {/* Head */}
                <div>
                  <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                    {t('departments.sections.head')}
                  </label>
                  <div className="relative">
                    <select
                      value={sectionFormData.headId || ''}
                      onChange={(e) => setSectionFormData(prev => ({ ...prev, headId: e.target.value || undefined }))}
                      className="w-full appearance-none rounded-xl border border-[var(--border)] bg-[var(--background)] py-2.5 pe-10 ps-4 text-sm"
                    >
                      <option value="">{language === 'ar' ? 'اختر الرئيس' : 'Select Head'}</option>
                      {availableHeads.map(u => (
                        <option key={u.id} value={u.id}>{language === 'ar' ? u.fullNameAr : u.fullNameEn}</option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--foreground-muted)]" />
                  </div>
                </div>

                {/* Active */}
                <div className="flex items-center justify-between rounded-xl bg-[var(--background-secondary)] p-4">
                  <span className="text-sm font-medium text-[var(--foreground)]">{language === 'ar' ? 'نشط' : 'Active'}</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sectionFormData.isActive}
                      onChange={(e) => setSectionFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-[var(--primary-light)] rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--primary)]"></div>
                  </label>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between">
                {isEditing && hasPermission('canDeleteAudits') ? (
                  <button
                    onClick={() => { setDeleteType('section'); setShowDeleteConfirm(true); }}
                    disabled={isSaving}
                    className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    {t('common.delete')}
                  </button>
                ) : <div />}
                <div className="flex gap-3">
                  <button onClick={() => setShowSectionFormModal(false)} disabled={isSaving} className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground-secondary)] disabled:opacity-50">
                    {t('common.cancel')}
                  </button>
                  <button onClick={handleSaveSection} disabled={isSaving} className="inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {t('common.save')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Detail Modal */}
        {showDetailModal && (selectedDepartment || selectedSection) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowDetailModal(false)} />
            <div className="relative w-full max-w-2xl rounded-2xl bg-[var(--card)] p-6 shadow-xl max-h-[90vh] overflow-y-auto">
              {selectedDepartment && (
                <>
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30">
                        <Building2 className="h-7 w-7 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-xl font-bold text-[var(--foreground)]">
                            {language === 'ar' ? selectedDepartment.nameAr : selectedDepartment.nameEn}
                          </h2>
                          <span className="text-xs font-mono text-[var(--foreground-muted)] bg-[var(--background-secondary)] px-2 py-0.5 rounded">
                            {selectedDepartment.code}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => setShowDetailModal(false)} className="rounded-lg p-2 text-[var(--foreground-secondary)] hover:bg-[var(--background-tertiary)]">
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  {selectedDepartment.managerId && (
                    <div className="mb-6">
                      <h3 className="text-sm font-semibold text-[var(--foreground)] mb-3">{t('departments.manager')}</h3>
                      {(() => {
                        const manager = getUserFromList(selectedDepartment.managerId!);
                        return manager ? (
                          <div className="flex items-center gap-3 rounded-xl bg-[var(--background-secondary)] p-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--primary-light)] text-[var(--primary)] font-semibold">
                              {(language === 'ar' ? manager.fullNameAr : manager.fullNameEn).charAt(0)}
                            </div>
                            <div>
                              <p className="font-medium text-[var(--foreground)]">{language === 'ar' ? manager.fullNameAr : manager.fullNameEn}</p>
                              <p className="text-xs text-[var(--foreground-secondary)]">{language === 'ar' ? manager.jobTitleAr : manager.jobTitleEn}</p>
                            </div>
                          </div>
                        ) : null;
                      })()}
                    </div>
                  )}

                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-[var(--foreground)] mb-3">
                      {t('departments.sections.title')} ({getSectionsForDepartment(selectedDepartment.id).length})
                    </h3>
                    <div className="space-y-2">
                      {getSectionsForDepartment(selectedDepartment.id).map((section) => {
                        const head = section.headId ? getUserFromList(section.headId) : null;
                        return (
                          <div key={section.id} className="flex items-center gap-3 rounded-xl border border-[var(--border)] p-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
                              <FolderTree className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-[var(--foreground)]">{language === 'ar' ? section.nameAr : section.nameEn}</p>
                              {head && <p className="text-xs text-[var(--foreground-secondary)]">{language === 'ar' ? head.fullNameAr : head.fullNameEn}</p>}
                            </div>
                            <span className="text-xs text-[var(--foreground-muted)]">
                              {getUsersBySection(section.id).length} {language === 'ar' ? 'موظفين' : 'employees'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              {selectedSection && (
                <>
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-900/30">
                        <FolderTree className="h-7 w-7 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-xl font-bold text-[var(--foreground)]">
                            {language === 'ar' ? selectedSection.nameAr : selectedSection.nameEn}
                          </h2>
                          <span className="text-xs font-mono text-[var(--foreground-muted)] bg-[var(--background-secondary)] px-2 py-0.5 rounded">
                            {selectedSection.code}
                          </span>
                        </div>
                        {(() => {
                          const dept = getDepartmentById(selectedSection.departmentId);
                          return <p className="text-sm text-[var(--foreground-secondary)]">{dept ? (language === 'ar' ? dept.nameAr : dept.nameEn) : ''}</p>;
                        })()}
                      </div>
                    </div>
                    <button onClick={() => setShowDetailModal(false)} className="rounded-lg p-2 text-[var(--foreground-secondary)] hover:bg-[var(--background-tertiary)]">
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  {selectedSection.headId && (
                    <div className="mb-6">
                      <h3 className="text-sm font-semibold text-[var(--foreground)] mb-3">{t('departments.sections.head')}</h3>
                      {(() => {
                        const head = getUserFromList(selectedSection.headId!);
                        return head ? (
                          <div className="flex items-center gap-3 rounded-xl bg-[var(--background-secondary)] p-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--primary-light)] text-[var(--primary)] font-semibold">
                              {(language === 'ar' ? head.fullNameAr : head.fullNameEn).charAt(0)}
                            </div>
                            <div>
                              <p className="font-medium text-[var(--foreground)]">{language === 'ar' ? head.fullNameAr : head.fullNameEn}</p>
                              <p className="text-xs text-[var(--foreground-secondary)]">{language === 'ar' ? head.jobTitleAr : head.jobTitleEn}</p>
                            </div>
                          </div>
                        ) : null;
                      })()}
                    </div>
                  )}

                  <div>
                    <h3 className="text-sm font-semibold text-[var(--foreground)] mb-3">
                      {language === 'ar' ? 'الموظفين' : 'Employees'} ({getUsersBySection(selectedSection.id).length})
                    </h3>
                    <div className="grid gap-2 sm:grid-cols-2 max-h-[200px] overflow-y-auto">
                      {getUsersBySection(selectedSection.id).map((user) => (
                        <div key={user.id} className="flex items-center gap-2 rounded-lg bg-[var(--background-secondary)] p-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--primary-light)] text-[var(--primary)] text-xs font-semibold">
                            {(language === 'ar' ? user.fullNameAr : user.fullNameEn).charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-[var(--foreground)] truncate">{language === 'ar' ? user.fullNameAr : user.fullNameEn}</p>
                            <p className="text-xs text-[var(--foreground-muted)] truncate">{language === 'ar' ? getRoleNameAr(user.role) : getRoleNameEn(user.role)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div className="mt-6 flex justify-end gap-3">
                <button onClick={() => setShowDetailModal(false)} className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground-secondary)]">
                  {t('common.close')}
                </button>
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    if (selectedDepartment) openEditDeptForm(selectedDepartment);
                    else if (selectedSection) openEditSectionForm(selectedSection);
                  }}
                  className="rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white"
                >
                  {selectedDepartment ? t('departments.editDepartment') : t('departments.sections.editSection')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(false)} />
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
                    {deleteType === 'department' && selectedDepartment
                      ? (language === 'ar' ? `هل أنت متأكد من حذف "${selectedDepartment.nameAr}"؟` : `Delete "${selectedDepartment.nameEn}"?`)
                      : selectedSection && (language === 'ar' ? `هل أنت متأكد من حذف "${selectedSection.nameAr}"؟` : `Delete "${selectedSection.nameEn}"?`)}
                  </p>
                </div>
              </div>
              {deleteType === 'department' && (
                <p className="text-sm text-amber-600 dark:text-amber-400 mb-6">
                  {language === 'ar' ? 'سيتم حذف جميع الأقسام التابعة لهذه الإدارة.' : 'All sections under this department will be deleted.'}
                </p>
              )}
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowDeleteConfirm(false)} disabled={isSaving} className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground-secondary)] disabled:opacity-50">
                  {t('common.cancel')}
                </button>
                <button onClick={handleDelete} disabled={isSaving} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                  {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t('common.delete')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
