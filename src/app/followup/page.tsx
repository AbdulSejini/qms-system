'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { Button, Badge } from '@/components/ui';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui';
import { useTranslation } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  users as allUsers,
  departments as allDepartments,
  sections as allSections,
} from '@/data/mock-data';
import {
  ClipboardList,
  AlertCircle,
  Clock,
  CheckCircle,
  AlertTriangle,
  Search,
  Filter,
  ChevronRight,
  ChevronLeft,
  Eye,
  MessageSquare,
  Calendar,
  User,
  Building2,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  RefreshCw,
  Bell,
  FileText,
  Target,
  BarChart3,
  Send,
  X,
  Check,
} from 'lucide-react';

// Types
interface FollowUpItem {
  id: string;
  type: 'finding' | 'corrective_action' | 'audit_task' | 'document_review';
  title: string;
  titleEn: string;
  description?: string;
  descriptionEn?: string;
  status: 'pending' | 'in_progress' | 'overdue' | 'completed' | 'awaiting_verification';
  priority: 'low' | 'medium' | 'high' | 'critical';
  dueDate: string;
  assignedTo: string;
  departmentId: string;
  sectionId?: string;
  relatedAuditId?: string;
  relatedFindingId?: string;
  progress?: number;
  lastUpdate?: string;
  comments?: number;
  createdAt: string;
}

// Sample follow-up data
const generateFollowUpItems = (): FollowUpItem[] => {
  return [
    {
      id: 'fu-1',
      type: 'finding',
      title: 'إغلاق ملاحظة توثيق الصيانة',
      titleEn: 'Close Maintenance Documentation Finding',
      description: 'تحديث وتوثيق جميع إجراءات الصيانة الوقائية',
      descriptionEn: 'Update and document all preventive maintenance procedures',
      status: 'in_progress',
      priority: 'high',
      dueDate: '2026-02-15',
      assignedTo: 'user-8',
      departmentId: 'dept-3',
      sectionId: 'sec-5',
      relatedAuditId: '1',
      relatedFindingId: 'f1',
      progress: 60,
      lastUpdate: '2026-01-30',
      comments: 3,
      createdAt: '2026-01-26',
    },
    {
      id: 'fu-2',
      type: 'corrective_action',
      title: 'تحديث سجلات التدريب',
      titleEn: 'Update Training Records',
      description: 'إكمال سجلات التدريب الناقصة للموظفين',
      descriptionEn: 'Complete missing employee training records',
      status: 'pending',
      priority: 'medium',
      dueDate: '2026-02-08',
      assignedTo: 'user-4',
      departmentId: 'dept-1',
      progress: 20,
      lastUpdate: '2026-01-28',
      comments: 1,
      createdAt: '2026-01-20',
    },
    {
      id: 'fu-3',
      type: 'finding',
      title: 'معالجة عدم المطابقة في المشتريات',
      titleEn: 'Address Procurement Non-Conformity',
      description: 'تصحيح إجراءات تقييم الموردين',
      descriptionEn: 'Correct supplier evaluation procedures',
      status: 'overdue',
      priority: 'critical',
      dueDate: '2026-01-25',
      assignedTo: 'user-11',
      departmentId: 'dept-4',
      sectionId: 'sec-7',
      relatedAuditId: '4',
      progress: 40,
      lastUpdate: '2026-01-20',
      comments: 5,
      createdAt: '2026-01-10',
    },
    {
      id: 'fu-4',
      type: 'audit_task',
      title: 'إعداد خطة المراجعة الخارجية',
      titleEn: 'Prepare External Audit Plan',
      description: 'تجهيز الوثائق والسجلات للمراجعة الخارجية',
      descriptionEn: 'Prepare documents and records for external audit',
      status: 'in_progress',
      priority: 'critical',
      dueDate: '2026-02-18',
      assignedTo: 'user-3',
      departmentId: 'dept-2',
      relatedAuditId: '3',
      progress: 75,
      lastUpdate: '2026-01-31',
      comments: 2,
      createdAt: '2026-01-15',
    },
    {
      id: 'fu-5',
      type: 'document_review',
      title: 'مراجعة دليل الجودة',
      titleEn: 'Review Quality Manual',
      description: 'مراجعة وتحديث دليل الجودة السنوي',
      descriptionEn: 'Annual quality manual review and update',
      status: 'pending',
      priority: 'medium',
      dueDate: '2026-02-28',
      assignedTo: 'user-3',
      departmentId: 'dept-2',
      progress: 0,
      lastUpdate: '2026-01-25',
      createdAt: '2026-01-25',
    },
    {
      id: 'fu-6',
      type: 'corrective_action',
      title: 'تحسين عملية الفحص',
      titleEn: 'Improve Inspection Process',
      description: 'تطوير قائمة فحص جديدة للمنتجات',
      descriptionEn: 'Develop new product inspection checklist',
      status: 'awaiting_verification',
      priority: 'high',
      dueDate: '2026-02-05',
      assignedTo: 'user-8',
      departmentId: 'dept-3',
      sectionId: 'sec-6',
      progress: 100,
      lastUpdate: '2026-02-01',
      comments: 4,
      createdAt: '2026-01-18',
    },
    {
      id: 'fu-7',
      type: 'finding',
      title: 'تصحيح معايرة الأجهزة',
      titleEn: 'Correct Equipment Calibration',
      description: 'إعادة معايرة أجهزة القياس المنتهية',
      descriptionEn: 'Recalibrate expired measurement equipment',
      status: 'completed',
      priority: 'high',
      dueDate: '2026-01-30',
      assignedTo: 'user-9',
      departmentId: 'dept-3',
      progress: 100,
      lastUpdate: '2026-01-29',
      comments: 2,
      createdAt: '2026-01-15',
    },
  ];
};

export default function FollowUpPage() {
  const router = useRouter();
  const { t, language, isRTL } = useTranslation();
  const { currentUser, hasPermission } = useAuth();

  // State
  const [followUpItems, setFollowUpItems] = useState<FollowUpItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterDepartment, setFilterDepartment] = useState<string>('all');
  const [selectedItem, setSelectedItem] = useState<FollowUpItem | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showSendReminderModal, setShowSendReminderModal] = useState(false);

  // Load data
  useEffect(() => {
    setFollowUpItems(generateFollowUpItems());
  }, []);

  // Filter items based on user role
  const accessibleItems = useMemo(() => {
    let items = followUpItems;

    // Role-based filtering
    if (!hasPermission('canViewAllData')) {
      // Users see only their department's items or items assigned to them
      items = items.filter(item =>
        item.departmentId === currentUser?.departmentId ||
        item.assignedTo === currentUser?.id
      );
    }

    return items;
  }, [followUpItems, currentUser, hasPermission]);

  // Apply filters
  const filteredItems = useMemo(() => {
    let items = accessibleItems;

    // Search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      items = items.filter(item =>
        item.title.toLowerCase().includes(query) ||
        item.titleEn.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (filterStatus !== 'all') {
      items = items.filter(item => item.status === filterStatus);
    }

    // Type filter
    if (filterType !== 'all') {
      items = items.filter(item => item.type === filterType);
    }

    // Priority filter
    if (filterPriority !== 'all') {
      items = items.filter(item => item.priority === filterPriority);
    }

    // Department filter (for admins)
    if (filterDepartment !== 'all') {
      items = items.filter(item => item.departmentId === filterDepartment);
    }

    return items;
  }, [accessibleItems, searchQuery, filterStatus, filterType, filterPriority, filterDepartment]);

  // Statistics
  const stats = useMemo(() => {
    const total = accessibleItems.length;
    const pending = accessibleItems.filter(i => i.status === 'pending').length;
    const inProgress = accessibleItems.filter(i => i.status === 'in_progress').length;
    const overdue = accessibleItems.filter(i => i.status === 'overdue').length;
    const awaitingVerification = accessibleItems.filter(i => i.status === 'awaiting_verification').length;
    const completed = accessibleItems.filter(i => i.status === 'completed').length;
    const critical = accessibleItems.filter(i => i.priority === 'critical' && i.status !== 'completed').length;

    return { total, pending, inProgress, overdue, awaitingVerification, completed, critical };
  }, [accessibleItems]);

  // Helpers
  const getUserName = (userId: string) => {
    const user = allUsers.find(u => u.id === userId);
    return user ? (language === 'ar' ? user.fullNameAr : user.fullNameEn) : '';
  };

  const getDepartmentName = (deptId: string) => {
    const dept = allDepartments.find(d => d.id === deptId);
    return dept ? (language === 'ar' ? dept.nameAr : dept.nameEn) : '';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
          <Clock className="h-3 w-3 me-1" />
          {language === 'ar' ? 'معلق' : 'Pending'}
        </Badge>;
      case 'in_progress':
        return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
          <RefreshCw className="h-3 w-3 me-1" />
          {language === 'ar' ? 'قيد التنفيذ' : 'In Progress'}
        </Badge>;
      case 'overdue':
        return <Badge variant="danger">
          <AlertTriangle className="h-3 w-3 me-1" />
          {language === 'ar' ? 'متأخر' : 'Overdue'}
        </Badge>;
      case 'awaiting_verification':
        return <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
          <Eye className="h-3 w-3 me-1" />
          {language === 'ar' ? 'بانتظار التحقق' : 'Awaiting Verification'}
        </Badge>;
      case 'completed':
        return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
          <CheckCircle className="h-3 w-3 me-1" />
          {language === 'ar' ? 'مكتمل' : 'Completed'}
        </Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'critical':
        return <Badge variant="danger">{language === 'ar' ? 'حرج' : 'Critical'}</Badge>;
      case 'high':
        return <Badge className="bg-orange-500 text-white">{language === 'ar' ? 'عالي' : 'High'}</Badge>;
      case 'medium':
        return <Badge className="bg-yellow-500 text-white">{language === 'ar' ? 'متوسط' : 'Medium'}</Badge>;
      case 'low':
        return <Badge variant="secondary">{language === 'ar' ? 'منخفض' : 'Low'}</Badge>;
      default:
        return null;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'finding':
        return AlertCircle;
      case 'corrective_action':
        return Target;
      case 'audit_task':
        return ClipboardList;
      case 'document_review':
        return FileText;
      default:
        return ClipboardList;
    }
  };

  const getTypeName = (type: string) => {
    switch (type) {
      case 'finding':
        return language === 'ar' ? 'ملاحظة' : 'Finding';
      case 'corrective_action':
        return language === 'ar' ? 'إجراء تصحيحي' : 'Corrective Action';
      case 'audit_task':
        return language === 'ar' ? 'مهمة مراجعة' : 'Audit Task';
      case 'document_review':
        return language === 'ar' ? 'مراجعة مستند' : 'Document Review';
      default:
        return type;
    }
  };

  // Calculate days remaining or overdue
  const getDaysStatus = (dueDate: string) => {
    const today = new Date('2026-02-01'); // Demo date
    const due = new Date(dueDate);
    const diff = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diff < 0) {
      return { days: Math.abs(diff), isOverdue: true };
    }
    return { days: diff, isOverdue: false };
  };

  // Filter options
  const statusOptions = [
    { value: 'all', labelAr: 'الكل', labelEn: 'All' },
    { value: 'pending', labelAr: 'معلق', labelEn: 'Pending' },
    { value: 'in_progress', labelAr: 'قيد التنفيذ', labelEn: 'In Progress' },
    { value: 'overdue', labelAr: 'متأخر', labelEn: 'Overdue' },
    { value: 'awaiting_verification', labelAr: 'بانتظار التحقق', labelEn: 'Awaiting Verification' },
    { value: 'completed', labelAr: 'مكتمل', labelEn: 'Completed' },
  ];

  const typeOptions = [
    { value: 'all', labelAr: 'الكل', labelEn: 'All' },
    { value: 'finding', labelAr: 'ملاحظات', labelEn: 'Findings' },
    { value: 'corrective_action', labelAr: 'إجراءات تصحيحية', labelEn: 'Corrective Actions' },
    { value: 'audit_task', labelAr: 'مهام المراجعة', labelEn: 'Audit Tasks' },
    { value: 'document_review', labelAr: 'مراجعة المستندات', labelEn: 'Document Reviews' },
  ];

  const priorityOptions = [
    { value: 'all', labelAr: 'الكل', labelEn: 'All' },
    { value: 'critical', labelAr: 'حرج', labelEn: 'Critical' },
    { value: 'high', labelAr: 'عالي', labelEn: 'High' },
    { value: 'medium', labelAr: 'متوسط', labelEn: 'Medium' },
    { value: 'low', labelAr: 'منخفض', labelEn: 'Low' },
  ];

  // Handle send reminder
  const handleSendReminder = (item: FollowUpItem) => {
    setSelectedItem(item);
    setShowSendReminderModal(true);
  };

  const confirmSendReminder = () => {
    // In real app, send notification
    alert(language === 'ar' ? 'تم إرسال التذكير بنجاح' : 'Reminder sent successfully');
    setShowSendReminderModal(false);
    setSelectedItem(null);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--foreground)]">
              {language === 'ar' ? 'المتابعة' : 'Follow-up'}
            </h1>
            <p className="text-sm text-[var(--foreground-secondary)] mt-1">
              {language === 'ar'
                ? 'متابعة الملاحظات والإجراءات التصحيحية والمهام'
                : 'Track findings, corrective actions and tasks'}
            </p>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterStatus('all')}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-[var(--foreground-secondary)]">
                    {language === 'ar' ? 'الإجمالي' : 'Total'}
                  </p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <ClipboardList className="h-8 w-8 text-[var(--primary)] opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterStatus('pending')}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-[var(--foreground-secondary)]">
                    {language === 'ar' ? 'معلق' : 'Pending'}
                  </p>
                  <p className="text-2xl font-bold text-gray-600">{stats.pending}</p>
                </div>
                <Clock className="h-8 w-8 text-gray-400 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterStatus('in_progress')}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-[var(--foreground-secondary)]">
                    {language === 'ar' ? 'قيد التنفيذ' : 'In Progress'}
                  </p>
                  <p className="text-2xl font-bold text-blue-600">{stats.inProgress}</p>
                </div>
                <RefreshCw className="h-8 w-8 text-blue-400 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow border-red-200 dark:border-red-800" onClick={() => setFilterStatus('overdue')}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-red-600">
                    {language === 'ar' ? 'متأخر' : 'Overdue'}
                  </p>
                  <p className="text-2xl font-bold text-red-600">{stats.overdue}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-400 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterStatus('awaiting_verification')}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-[var(--foreground-secondary)]">
                    {language === 'ar' ? 'بانتظار التحقق' : 'Awaiting'}
                  </p>
                  <p className="text-2xl font-bold text-purple-600">{stats.awaitingVerification}</p>
                </div>
                <Eye className="h-8 w-8 text-purple-400 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterStatus('completed')}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-[var(--foreground-secondary)]">
                    {language === 'ar' ? 'مكتمل' : 'Completed'}
                  </p>
                  <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-400 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow border-orange-200 dark:border-orange-800" onClick={() => setFilterPriority('critical')}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-orange-600">
                    {language === 'ar' ? 'حرج' : 'Critical'}
                  </p>
                  <p className="text-2xl font-bold text-orange-600">{stats.critical}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-orange-400 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--foreground-secondary)]" />
                <input
                  type="text"
                  placeholder={language === 'ar' ? 'بحث...' : 'Search...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] ps-10 pe-4 py-2 text-sm"
                />
              </div>

              {/* Status Filter */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              >
                {statusOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {language === 'ar' ? opt.labelAr : opt.labelEn}
                  </option>
                ))}
              </select>

              {/* Type Filter */}
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              >
                {typeOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {language === 'ar' ? opt.labelAr : opt.labelEn}
                  </option>
                ))}
              </select>

              {/* Priority Filter */}
              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
                className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              >
                {priorityOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {language === 'ar' ? opt.labelAr : opt.labelEn}
                  </option>
                ))}
              </select>

              {/* Department Filter (Admin only) */}
              {hasPermission('canViewAllData') && (
                <select
                  value={filterDepartment}
                  onChange={(e) => setFilterDepartment(e.target.value)}
                  className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                >
                  <option value="all">{language === 'ar' ? 'جميع الإدارات' : 'All Departments'}</option>
                  {allDepartments.filter(d => d.isActive).map(dept => (
                    <option key={dept.id} value={dept.id}>
                      {language === 'ar' ? dept.nameAr : dept.nameEn}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Follow-up Items Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{language === 'ar' ? 'النوع' : 'Type'}</TableHead>
                  <TableHead>{language === 'ar' ? 'العنوان' : 'Title'}</TableHead>
                  <TableHead>{language === 'ar' ? 'المسؤول' : 'Assigned To'}</TableHead>
                  <TableHead>{language === 'ar' ? 'الإدارة' : 'Department'}</TableHead>
                  <TableHead>{language === 'ar' ? 'تاريخ الاستحقاق' : 'Due Date'}</TableHead>
                  <TableHead>{language === 'ar' ? 'الأولوية' : 'Priority'}</TableHead>
                  <TableHead>{language === 'ar' ? 'الحالة' : 'Status'}</TableHead>
                  <TableHead>{language === 'ar' ? 'التقدم' : 'Progress'}</TableHead>
                  <TableHead>{language === 'ar' ? 'الإجراءات' : 'Actions'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.length > 0 ? (
                  filteredItems.map(item => {
                    const Icon = getTypeIcon(item.type);
                    const daysStatus = getDaysStatus(item.dueDate);

                    return (
                      <TableRow key={item.id} className="hover:bg-[var(--background-secondary)]">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-[var(--foreground-secondary)]" />
                            <span className="text-xs">{getTypeName(item.type)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{language === 'ar' ? item.title : item.titleEn}</p>
                            {item.description && (
                              <p className="text-xs text-[var(--foreground-secondary)] truncate max-w-[200px]">
                                {language === 'ar' ? item.description : item.descriptionEn}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-[var(--foreground-secondary)]" />
                            <span className="text-sm">{getUserName(item.assignedTo)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{getDepartmentName(item.departmentId)}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm">{item.dueDate}</span>
                            {item.status !== 'completed' && (
                              <span className={`text-xs ${daysStatus.isOverdue ? 'text-red-500' : 'text-[var(--foreground-secondary)]'}`}>
                                {daysStatus.isOverdue
                                  ? (language === 'ar' ? `متأخر ${daysStatus.days} يوم` : `${daysStatus.days} days overdue`)
                                  : (language === 'ar' ? `متبقي ${daysStatus.days} يوم` : `${daysStatus.days} days left`)}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{getPriorityBadge(item.priority)}</TableCell>
                        <TableCell>{getStatusBadge(item.status)}</TableCell>
                        <TableCell>
                          <div className="w-full bg-[var(--background-secondary)] rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                (item.progress || 0) === 100
                                  ? 'bg-green-500'
                                  : (item.progress || 0) >= 50
                                    ? 'bg-blue-500'
                                    : 'bg-orange-500'
                              }`}
                              style={{ width: `${item.progress || 0}%` }}
                            />
                          </div>
                          <span className="text-xs text-[var(--foreground-secondary)]">{item.progress || 0}%</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => {
                                setSelectedItem(item);
                                setShowDetailModal(true);
                              }}
                              title={language === 'ar' ? 'عرض التفاصيل' : 'View Details'}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {item.status !== 'completed' && hasPermission('canManageAudits') && (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => handleSendReminder(item)}
                                title={language === 'ar' ? 'إرسال تذكير' : 'Send Reminder'}
                              >
                                <Bell className="h-4 w-4" />
                              </Button>
                            )}
                            {item.comments && item.comments > 0 && (
                              <span className="flex items-center gap-1 text-xs text-[var(--foreground-secondary)]">
                                <MessageSquare className="h-3 w-3" />
                                {item.comments}
                              </span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-[var(--foreground-secondary)]">
                      {language === 'ar' ? 'لا توجد عناصر للمتابعة' : 'No follow-up items found'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Detail Modal */}
        {showDetailModal && selectedItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowDetailModal(false)} />
            <div className="relative w-full max-w-2xl rounded-2xl bg-[var(--card)] p-6 shadow-xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-3">
                  {(() => {
                    const Icon = getTypeIcon(selectedItem.type);
                    return (
                      <div className="p-3 rounded-xl bg-[var(--primary-light)]">
                        <Icon className="h-6 w-6 text-[var(--primary)]" />
                      </div>
                    );
                  })()}
                  <div>
                    <h2 className="text-lg font-bold">
                      {language === 'ar' ? selectedItem.title : selectedItem.titleEn}
                    </h2>
                    <p className="text-sm text-[var(--foreground-secondary)]">
                      {getTypeName(selectedItem.type)}
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="icon-sm" onClick={() => setShowDetailModal(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-6">
                {/* Description */}
                {selectedItem.description && (
                  <div>
                    <h4 className="text-sm font-medium text-[var(--foreground-secondary)] mb-2">
                      {language === 'ar' ? 'الوصف' : 'Description'}
                    </h4>
                    <p className="text-sm bg-[var(--background-secondary)] p-3 rounded-lg">
                      {language === 'ar' ? selectedItem.description : selectedItem.descriptionEn}
                    </p>
                  </div>
                )}

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-[var(--foreground-secondary)] mb-1">
                      {language === 'ar' ? 'المسؤول' : 'Assigned To'}
                    </h4>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-[var(--foreground-secondary)]" />
                      <span>{getUserName(selectedItem.assignedTo)}</span>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-[var(--foreground-secondary)] mb-1">
                      {language === 'ar' ? 'الإدارة' : 'Department'}
                    </h4>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-[var(--foreground-secondary)]" />
                      <span>{getDepartmentName(selectedItem.departmentId)}</span>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-[var(--foreground-secondary)] mb-1">
                      {language === 'ar' ? 'تاريخ الاستحقاق' : 'Due Date'}
                    </h4>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-[var(--foreground-secondary)]" />
                      <span>{selectedItem.dueDate}</span>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-[var(--foreground-secondary)] mb-1">
                      {language === 'ar' ? 'الأولوية' : 'Priority'}
                    </h4>
                    {getPriorityBadge(selectedItem.priority)}
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-[var(--foreground-secondary)] mb-1">
                      {language === 'ar' ? 'الحالة' : 'Status'}
                    </h4>
                    {getStatusBadge(selectedItem.status)}
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-[var(--foreground-secondary)] mb-1">
                      {language === 'ar' ? 'آخر تحديث' : 'Last Update'}
                    </h4>
                    <span className="text-sm">{selectedItem.lastUpdate || '-'}</span>
                  </div>
                </div>

                {/* Progress */}
                <div>
                  <h4 className="text-sm font-medium text-[var(--foreground-secondary)] mb-2">
                    {language === 'ar' ? 'نسبة الإنجاز' : 'Progress'}
                  </h4>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-[var(--background-secondary)] rounded-full h-3">
                      <div
                        className={`h-3 rounded-full transition-all ${
                          selectedItem.progress === 100
                            ? 'bg-green-500'
                            : selectedItem.progress && selectedItem.progress >= 50
                              ? 'bg-blue-500'
                              : 'bg-orange-500'
                        }`}
                        style={{ width: `${selectedItem.progress || 0}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium">{selectedItem.progress || 0}%</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 pt-4 border-t border-[var(--border)]">
                  {selectedItem.relatedAuditId && (
                    <Button
                      variant="outline"
                      onClick={() => router.push(`/audits/${selectedItem.relatedAuditId}`)}
                    >
                      <Eye className="h-4 w-4 me-2" />
                      {language === 'ar' ? 'عرض المراجعة' : 'View Audit'}
                    </Button>
                  )}
                  {selectedItem.status !== 'completed' && hasPermission('canManageAudits') && (
                    <Button onClick={() => handleSendReminder(selectedItem)}>
                      <Bell className="h-4 w-4 me-2" />
                      {language === 'ar' ? 'إرسال تذكير' : 'Send Reminder'}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Send Reminder Modal */}
        {showSendReminderModal && selectedItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowSendReminderModal(false)} />
            <div className="relative w-full max-w-md rounded-2xl bg-[var(--card)] p-6 shadow-xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/30">
                  <Bell className="h-6 w-6 text-blue-600" />
                </div>
                <h2 className="text-lg font-bold">
                  {language === 'ar' ? 'إرسال تذكير' : 'Send Reminder'}
                </h2>
              </div>

              <p className="text-sm text-[var(--foreground-secondary)] mb-4">
                {language === 'ar'
                  ? `سيتم إرسال تذكير إلى ${getUserName(selectedItem.assignedTo)} بخصوص:`
                  : `A reminder will be sent to ${getUserName(selectedItem.assignedTo)} regarding:`}
              </p>

              <div className="p-3 bg-[var(--background-secondary)] rounded-lg mb-6">
                <p className="font-medium">{language === 'ar' ? selectedItem.title : selectedItem.titleEn}</p>
                <p className="text-sm text-[var(--foreground-secondary)]">
                  {language === 'ar' ? 'تاريخ الاستحقاق:' : 'Due Date:'} {selectedItem.dueDate}
                </p>
              </div>

              <div className="flex items-center justify-end gap-3">
                <Button variant="outline" onClick={() => setShowSendReminderModal(false)}>
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </Button>
                <Button onClick={confirmSendReminder}>
                  <Send className="h-4 w-4 me-2" />
                  {language === 'ar' ? 'إرسال' : 'Send'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
