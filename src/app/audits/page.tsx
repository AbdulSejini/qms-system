'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout';
// موحَّدة في @/types - كانت نسخاً محلية تختلف عن المخزَّن فعلاً
import type { AuditFinding as Finding, AuditQuestion, AuditStageId, AuditStoredStatus, ApprovalGate } from '@/types';
import { AUDIT_STAGE_ORDER } from '@/types';
import { stageOf, isQualityStaff, areAnswersApproved, LAST_STAGE } from '@/lib/audit-workflow';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { Button, Badge } from '@/components/ui';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui';
import { useTranslation } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  subscribeToAudits,
  updateAudit,
  deleteAudit as deleteAuditFromFirestore,
  addNotification,
} from '@/lib/firestore';
import {
  Plus,
  Search,
  ClipboardCheck,
  Eye,
  Calendar,
  AlertCircle,
  CheckCircle,
  Clock,
  UserCheck,
  Wrench,
  ChevronRight,
  ChevronLeft,
  X,
  AlertTriangle,
  Shield,
  Trash2,
  Building2,
  FileCheck,
  ArrowUp,
  ArrowDown,
  SlidersHorizontal,
} from 'lucide-react';

// ===========================================
// سير عمل المراجعة المنطقي
// ===========================================
//
// ستّ مراحل، وترتيبها هو AUDIT_STAGE_ORDER في @/types - نفس الترتيب الذي تقرؤه صفحة
// تفاصيل المراجعة بالضبط.
//
// كانت هنا سبع مراحل، بمرحلة 'questions_preparation' إضافية لا يجلس فيها أحد (الأسئلة
// تُعدّ أثناء التخطيط)، وكان أثرها الوحيد أن تُزيح كل مرحلة بعدها رقماً واحداً. وبما أن
// الصفحتين تكتبان في currentStage نفسه، فإن اعتماد مراجعة من هذه الصفحة كان يكتب رقماً
// على سُلَّم السبعة تقرؤه صفحة التفاصيل على سُلَّم الستة: مراجعة في "مراجعة الجودة"
// تُعتمد فتظهر في "التحقق والإغلاق"، متخطّيةً مرحلة الإجراءات التصحيحية كلها.
interface WorkflowStage {
  id: AuditStageId;
  stepAr: string;
  stepEn: string;
  icon: typeof Calendar;
  descriptionAr: string;
  descriptionEn: string;
}

const workflowStages: WorkflowStage[] = [
  {
    id: 'planning',
    stepAr: 'التخطيط وإعداد الأسئلة',
    stepEn: 'Planning & Questions',
    icon: Calendar,
    descriptionAr: 'تحديد نطاق المراجعة والفريق والتواريخ وإعداد الأسئلة',
    descriptionEn: 'Define audit scope, team, dates and prepare questions',
  },
  {
    id: 'execution',
    stepAr: 'التنفيذ',
    stepEn: 'Execution',
    icon: ClipboardCheck,
    descriptionAr: 'إجراء المراجعة وتسجيل الملاحظات',
    descriptionEn: 'Conduct audit and record findings',
  },
  {
    id: 'qms_review',
    stepAr: 'مراجعة إدارة الجودة',
    stepEn: 'QMS Review',
    icon: Shield,
    descriptionAr: 'مراجعة واعتماد نتائج المراجعة من إدارة الجودة',
    descriptionEn: 'QMS department reviews and approves audit results',
  },
  {
    id: 'corrective_actions',
    stepAr: 'الإجراءات التصحيحية',
    stepEn: 'Corrective Actions',
    icon: Wrench,
    descriptionAr: 'تنفيذ الإجراءات التصحيحية من قبل الجهة المراجعة',
    descriptionEn: 'Auditee implements corrective actions',
  },
  {
    id: 'verification',
    stepAr: 'التحقق والإغلاق',
    stepEn: 'Verification',
    icon: FileCheck,
    descriptionAr: 'التحقق من تنفيذ الإجراءات وإغلاق الملاحظات',
    descriptionEn: 'Verify actions implementation and close findings',
  },
  {
    id: 'completed',
    stepAr: 'مكتمل',
    stepEn: 'Completed',
    icon: CheckCircle,
    descriptionAr: 'المراجعة منتهية',
    descriptionEn: 'Audit completed',
  },
];

// نفس الحارس الموجود في صفحة تفاصيل المراجعة: أي انحراف عن الترتيب الواحد خطأ عند
// التحميل، لا خلل صامت في البيانات.
if (workflowStages.length !== AUDIT_STAGE_ORDER.length ||
    workflowStages.some((stage, index) => stage.id !== AUDIT_STAGE_ORDER[index])) {
  throw new Error('workflowStages must mirror AUDIT_STAGE_ORDER exactly');
}

// ISO 9001 Finding Categories - من @/types، مصدر واحد للصفحتين

// Question interface

// Audit interface
interface Audit {
  id: string;
  number: string;
  titleAr: string;
  titleEn: string;
  type: 'internal' | 'external' | 'surveillance' | 'certification';
  departmentId: string;
  sectionId?: string;
  // نفس اتحاد الحالات المخزَّنة، لا `string`: التساهل هنا هو ما سمح للصفحتين أن
  // تختلفا في معنى الحالة نفسها دون أن يعترض المترجم
  status: AuditStoredStatus;
  currentStage: number;
  leadAuditorId: string;
  auditorIds: string[];
  auditeeId?: string;
  // بوابة اعتماد الأجوبة - ما يقرّر ظهور المراجعة للجهة المُراجَع عليها في القائمة
  answersGate?: ApprovalGate;
  startDate: string;
  endDate: string;
  scope: string;
  objective: string;
  questions: AuditQuestion[];
  findings: Finding[];
  qmsApproval?: {
    approved: boolean;
    comment: string;
    date: string;
    approvedBy: string;
  };
  createdAt: string;
  createdBy?: string;
}

// No demo data - start with empty audits

export default function AuditsPage() {
  const router = useRouter();
  const { t, language, isRTL } = useTranslation();
  const { currentUser, hasPermission, users: allUsers, departments: allDepartments, sections: allSections } = useAuth();

  // Get auditors from users (canBeAuditor = true)

  // Check if current user is quality manager
  // إدارة الجودة: مدير الجودة ومدير النظام. كان مدير النظام محجوباً عن الموافقة على
  // إنشاء المراجعات رغم أن canApproveAudits في صلاحياته true.
  const isQualityManager = isQualityStaff(currentUser);

  // Audits data - load from Firestore with real-time updates
  const [auditsData, setAuditsData] = useState<Audit[]>([]);

  // Subscribe to Firestore audits on mount
  useEffect(() => {
    const unsubscribe = subscribeToAudits((firestoreAudits) => {
      // Convert Firestore audits to local Audit interface
      const convertedAudits: Audit[] = firestoreAudits.map(fa => ({
        id: fa.id,
        number: fa.id.replace('audit-', 'AUD-'),
        titleAr: fa.titleAr,
        titleEn: fa.titleEn,
        type: fa.type,
        departmentId: fa.departmentId,
        sectionId: fa.sectionId,
        status: fa.status,
        // نفس الدالة التي تقرأ بها صفحة التفاصيل، لا اشتقاق محلي
        currentStage: stageOf(fa),
        leadAuditorId: fa.leadAuditorId,
        auditorIds: fa.teamMemberIds || [],
        auditeeId: fa.auditeeId,
        answersGate: fa.answersGate,
        startDate: fa.startDate,
        endDate: fa.endDate,
        scope: fa.scope || '',
        objective: fa.objectives || '',
        questions: [],
        findings: fa.findings || [],
        createdAt: fa.createdAt,
        createdBy: fa.createdBy,
      }));
      setAuditsData(convertedAudits);
    });
    return () => unsubscribe();
  }, []);

  // Role view mode - auditor vs auditee
  const [viewMode, setViewMode] = useState<'all' | 'as_auditor' | 'as_auditee'>('all');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Sorting
  const [sortBy, setSortBy] = useState<'createdAt' | 'startDate' | 'number' | 'title' | 'department'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Modals
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [auditToDelete, setAuditToDelete] = useState<Audit | null>(null);

  // Detail modal tabs

  // New audit form

  // Helper functions
  const getDepartment = (id: string) => allDepartments.find(d => d.id === id);
  const getSection = (id: string) => allSections.find(s => s.id === id);
  const getUser = (id: string) => allUsers.find(u => u.id === id);
  // Types
  const types = [
    { value: 'all', labelAr: 'الكل', labelEn: 'All' },
    { value: 'internal', labelAr: 'داخلي', labelEn: 'Internal' },
    { value: 'external', labelAr: 'خارجي', labelEn: 'External' },
    { value: 'surveillance', labelAr: 'مراقبة', labelEn: 'Surveillance' },
    { value: 'certification', labelAr: 'شهادة', labelEn: 'Certification' },
  ];

  // Statuses
  const statuses = [
    { value: 'all', labelAr: 'الكل', labelEn: 'All' },
    ...workflowStages.map(s => ({ value: s.id, labelAr: s.stepAr, labelEn: s.stepEn })),
  ];

  // Sort options
  const sortOptions = [
    { value: 'createdAt', labelAr: 'تاريخ الإنشاء', labelEn: 'Created Date' },
    { value: 'startDate', labelAr: 'تاريخ البدء', labelEn: 'Start Date' },
    { value: 'number', labelAr: 'رقم المراجعة', labelEn: 'Audit Number' },
    { value: 'title', labelAr: 'العنوان', labelEn: 'Title' },
    { value: 'department', labelAr: 'الإدارة', labelEn: 'Department' },
  ];

  // من هو هذا المستخدم في كل مراجعة، ومن يرى ماذا - مرفوعة فوق ما يقرؤها.
  const isUserAuditor = (audit: Audit) =>
    audit.leadAuditorId === currentUser?.id ||
    (audit.auditorIds?.includes(currentUser?.id || '') ?? false) ||
    audit.createdBy === currentUser?.id;

  // الإدارة التي تُراجَع
  const isUserAuditee = (audit: Audit) =>
    audit.departmentId === currentUser?.departmentId;

  // ماذا ترى الجهة المُراجَع عليها من قائمة المراجعات.
  //
  // بعد اعتماد إدارة الجودة للنتائج - وهي نفس البوابة التي تقرّر ما تراه داخل المراجعة،
  // فلا يُخفى عنها هناك ما تُظهره القائمة هنا. ومدير الإدارة ورئيس القسم يريان المراجعة
  // المجدولة عليهما قبل ذلك، فهما يستقبلان فريق المراجعة، لكن دون نتائجها.
  //
  // كان الشرط رقمَ مرحلة (>= 3) مكتوباً على سُلَّم المراحل السبع، فلا يعني على السُّلَّم
  // الواحد ما كان يعنيه. والقاعدة لم تكن يوماً عن رقم المرحلة، بل عن الاعتماد نفسه.
  const auditeeMaySee = (audit: Audit): boolean =>
    areAnswersApproved(audit) ||
    ((currentUser?.role === 'department_manager' || currentUser?.role === 'section_head') &&
      stageOf(audit) >= 1);

  // Filter and sort audits
  const filteredAudits = useMemo(() => {
    // First filter by user access and view mode
    const accessibleAudits = auditsData.filter(audit => {
      // Quality manager can see all audits
      if (isQualityManager && viewMode === 'all') return true;

      // Filter by view mode
      if (viewMode === 'as_auditor') {
        return isUserAuditor(audit);
      }

      if (viewMode === 'as_auditee') {
        return isUserAuditee(audit) && auditeeMaySee(audit);
      }

      // Default 'all' mode
      // User can see audits they created
      if (audit.createdBy === currentUser?.id) return true;

      // User can see audits where they are lead auditor
      if (audit.leadAuditorId === currentUser?.id) return true;

      // User can see audits where they are part of the team
      if (audit.auditorIds?.includes(currentUser?.id || '')) return true;

      // الإدارة التي تُراجَع ترى المراجعة بعد اعتماد نتائجها، لا قبله
      if (audit.departmentId === currentUser?.departmentId && auditeeMaySee(audit)) return true;

      return false;
    });

    // Then apply search and other filters
    const filtered = accessibleAudits.filter(audit => {
      const matchesSearch =
        audit.titleAr.toLowerCase().includes(searchQuery.toLowerCase()) ||
        audit.titleEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
        audit.number.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = selectedType === 'all' || audit.type === selectedType;
      const matchesStatus = selectedStatus === 'all' || audit.status === selectedStatus;
      return matchesSearch && matchesType && matchesStatus;
    });

    // Then sort
    const sorted = [...filtered].sort((a, b) => {
      let compareValue = 0;

      switch (sortBy) {
        case 'createdAt':
          compareValue = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'startDate':
          compareValue = new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
          break;
        case 'number':
          compareValue = a.number.localeCompare(b.number);
          break;
        case 'title':
          compareValue = (language === 'ar' ? a.titleAr : a.titleEn).localeCompare(
            language === 'ar' ? b.titleAr : b.titleEn
          );
          break;
        case 'department':
          const deptA = getDepartment(a.departmentId);
          const deptB = getDepartment(b.departmentId);
          const deptNameA = deptA ? (language === 'ar' ? deptA.nameAr : deptA.nameEn) : '';
          const deptNameB = deptB ? (language === 'ar' ? deptB.nameAr : deptB.nameEn) : '';
          compareValue = deptNameA.localeCompare(deptNameB);
          break;
        default:
          compareValue = 0;
      }

      return sortOrder === 'desc' ? -compareValue : compareValue;
    });

    return sorted;
  }, [auditsData, searchQuery, selectedType, selectedStatus, sortBy, sortOrder, language]);

  // Audits where user is auditor
  const auditsAsAuditor = useMemo(() =>
    auditsData.filter(audit => isUserAuditor(audit)),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [auditsData, currentUser]);

  // Audits where user is auditee
  const auditsAsAuditee = useMemo(() =>
    auditsData.filter(audit => isUserAuditee(audit) && auditeeMaySee(audit)),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [auditsData, currentUser]);

  // Get accessible audits for stats (same logic as filtering)
  const accessibleAuditsForStats = useMemo(() => {
    return auditsData.filter(audit => {
      if (isQualityManager) return true;
      if (audit.createdBy === currentUser?.id) return true;
      if (audit.leadAuditorId === currentUser?.id) return true;
      if (audit.auditorIds?.includes(currentUser?.id || '')) return true;
      return false;
    });
  }, [auditsData, currentUser?.id, isQualityManager]);

  // Stats based on accessible audits
  const stats = {
    total: accessibleAuditsForStats.length,
    inProgress: accessibleAuditsForStats.filter(a => a.currentStage >= 1 && a.currentStage < LAST_STAGE).length,
    pendingApproval: accessibleAuditsForStats.filter(a => a.status === 'qms_review' || a.status === 'pending_approval').length,
    openFindings: accessibleAuditsForStats.reduce((sum, a) => sum + a.findings.filter(f => f.status !== 'closed').length, 0),
  };

  // Status badge
  const getStatusBadge = (status: string) => {
    // Handle pending_approval status specially
    if (status === 'pending_approval') {
      return (
        <Badge variant="warning" className="animate-pulse">
          <Clock className="h-3 w-3 ml-1" />
          {language === 'ar' ? 'بانتظار موافقة مدير الجودة' : 'Awaiting QM Approval'}
        </Badge>
      );
    }

    const stage = workflowStages.find(s => s.id === status);
    const variants: Record<string, 'success' | 'warning' | 'info' | 'danger' | 'pending'> = {
      planning: 'pending',
      questions_preparation: 'warning',
      execution: 'info',
      qms_review: 'warning',
      corrective_actions: 'danger',
      verification: 'info',
      completed: 'success',
    };
    return (
      <Badge variant={variants[status] || 'pending'}>
        {stage ? (language === 'ar' ? stage.stepAr : stage.stepEn) : status}
      </Badge>
    );
  };

  // Type badge
  const getTypeBadge = (type: string) => {
    const config: Record<string, { color: string; labelAr: string; labelEn: string }> = {
      internal: { color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', labelAr: 'داخلي', labelEn: 'Internal' },
      external: { color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400', labelAr: 'خارجي', labelEn: 'External' },
      surveillance: { color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', labelAr: 'مراقبة', labelEn: 'Surveillance' },
      certification: { color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', labelAr: 'شهادة', labelEn: 'Certification' },
    };
    const c = config[type] || { color: 'bg-gray-100 text-gray-700', labelAr: type, labelEn: type };
    return (
      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${c.color}`}>
        {language === 'ar' ? c.labelAr : c.labelEn}
      </span>
    );
  };


  // Handle view audit - redirect to detail page
  const handleViewAudit = (audit: Audit) => {
    router.push(`/audits/${audit.id}`);
  };

  // Handle delete
  const handleDeleteAudit = (audit: Audit) => {
    setAuditToDelete(audit);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (auditToDelete) {
      // Delete from Firestore
      await deleteAuditFromFirestore(auditToDelete.id);
      setShowDeleteModal(false);
      setAuditToDelete(null);
    }
  };

  // Handle approve audit (Quality Manager only)
  const handleApproveAudit = async (auditId: string) => {
    // Update in Firestore
    await updateAudit(auditId, {
      status: 'approved',
      approvedBy: currentUser?.id,
      approvedAt: new Date().toISOString(),
    });

    // Add notification for the creator
    const audit = auditsData.find(a => a.id === auditId);
    if (audit && audit.createdBy) {
      await addNotification({
        type: 'audit_approved',
        title: language === 'ar' ? 'تمت الموافقة على المراجعة' : 'Audit Approved',
        message: language === 'ar'
          ? `تمت الموافقة على مراجعة: ${audit.titleAr}`
          : `Audit approved: ${audit.titleEn}`,
        recipientId: audit.createdBy,
        senderId: currentUser?.id,
        auditId: audit.id,
      });
    }
  };

  // Handle reject audit (Quality Manager only)
  const handleRejectAudit = async (auditId: string, reason: string) => {
    const audit = auditsData.find(a => a.id === auditId);

    // Update in Firestore - mark as rejected
    await updateAudit(auditId, {
      status: 'cancelled',
      rejectedBy: currentUser?.id,
      rejectedAt: new Date().toISOString(),
      rejectionReason: reason,
    });

    // Add notification for the creator
    if (audit && audit.createdBy) {
      await addNotification({
        type: 'audit_rejected',
        title: language === 'ar' ? 'تم رفض المراجعة' : 'Audit Rejected',
        message: language === 'ar'
          ? `تم رفض مراجعة: ${audit.titleAr}. السبب: ${reason || 'لم يحدد'}`
          : `Audit rejected: ${audit.titleEn}. Reason: ${reason || 'Not specified'}`,
        recipientId: audit.createdBy,
        senderId: currentUser?.id,
        auditId: audit.id,
      });
    }
  };

  const Arrow = isRTL ? ChevronLeft : ChevronRight;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--foreground)]">
              {t('audits.title')}
            </h1>
            <p className="mt-1 text-[var(--foreground-secondary)]">
              {language === 'ar' ? 'إدارة عمليات المراجعة الداخلية والخارجية' : 'Manage internal and external audit operations'}
            </p>
          </div>
          <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => router.push('/audits/new')}>
            {t('audits.newAudit')}
          </Button>
        </div>

        {/* Role View Tabs - Only show if user has both roles */}
        {(auditsAsAuditor.length > 0 || auditsAsAuditee.length > 0) && !isQualityManager && (
          <Card className="overflow-hidden">
            <div className="flex border-b border-[var(--border)]">
              {/* All Tab */}
              <button
                onClick={() => setViewMode('all')}
                className={`flex-1 flex items-center justify-center gap-3 px-6 py-4 text-sm font-medium transition-all relative ${viewMode === 'all'
                  ? 'text-[var(--primary)] bg-[var(--primary-light)]'
                  : 'text-[var(--foreground-secondary)] hover:bg-[var(--background-secondary)]'
                  }`}
              >
                <div className={`flex items-center justify-center w-10 h-10 rounded-full ${viewMode === 'all' ? 'bg-[var(--primary)] text-white' : 'bg-[var(--background-tertiary)]'
                  }`}>
                  <ClipboardCheck className="h-5 w-5" />
                </div>
                <div className="text-start">
                  <p className="font-semibold">{language === 'ar' ? 'جميع المراجعات' : 'All Audits'}</p>
                  <p className="text-xs opacity-70">{auditsAsAuditor.length + auditsAsAuditee.length} {language === 'ar' ? 'مراجعة' : 'audits'}</p>
                </div>
                {viewMode === 'all' && (
                  <div className="absolute bottom-0 start-0 end-0 h-1 bg-[var(--primary)]" />
                )}
              </button>

              {/* As Auditor Tab */}
              {auditsAsAuditor.length > 0 && (
                <button
                  onClick={() => setViewMode('as_auditor')}
                  className={`flex-1 flex items-center justify-center gap-3 px-6 py-4 text-sm font-medium transition-all relative border-s border-[var(--border)] ${viewMode === 'as_auditor'
                    ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20'
                    : 'text-[var(--foreground-secondary)] hover:bg-[var(--background-secondary)]'
                    }`}
                >
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full ${viewMode === 'as_auditor' ? 'bg-blue-600 text-white' : 'bg-[var(--background-tertiary)]'
                    }`}>
                    <UserCheck className="h-5 w-5" />
                  </div>
                  <div className="text-start">
                    <p className="font-semibold">{language === 'ar' ? 'كمراجع' : 'As Auditor'}</p>
                    <p className="text-xs opacity-70">{auditsAsAuditor.length} {language === 'ar' ? 'مراجعة' : 'audits'}</p>
                  </div>
                  {viewMode === 'as_auditor' && (
                    <div className="absolute bottom-0 start-0 end-0 h-1 bg-blue-600" />
                  )}
                </button>
              )}

              {/* As Auditee Tab */}
              {auditsAsAuditee.length > 0 && (
                <button
                  onClick={() => setViewMode('as_auditee')}
                  className={`flex-1 flex items-center justify-center gap-3 px-6 py-4 text-sm font-medium transition-all relative border-s border-[var(--border)] ${viewMode === 'as_auditee'
                    ? 'text-orange-600 bg-orange-50 dark:bg-orange-900/20'
                    : 'text-[var(--foreground-secondary)] hover:bg-[var(--background-secondary)]'
                    }`}
                >
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full ${viewMode === 'as_auditee' ? 'bg-orange-600 text-white' : 'bg-[var(--background-tertiary)]'
                    }`}>
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div className="text-start">
                    <p className="font-semibold">{language === 'ar' ? 'كمراجع عليه' : 'As Auditee'}</p>
                    <p className="text-xs opacity-70">{auditsAsAuditee.length} {language === 'ar' ? 'مراجعة' : 'audits'}</p>
                  </div>
                  {viewMode === 'as_auditee' && (
                    <div className="absolute bottom-0 start-0 end-0 h-1 bg-orange-600" />
                  )}
                </button>
              )}
            </div>

            {/* Role Description */}
            <div className="p-4 bg-[var(--background-secondary)]">
              {viewMode === 'all' && (
                <p className="text-sm text-[var(--foreground-secondary)] flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4" />
                  {language === 'ar'
                    ? 'عرض جميع المراجعات المتعلقة بك سواء كمراجع أو مراجع عليه'
                    : 'View all audits related to you, whether as auditor or auditee'}
                </p>
              )}
              {viewMode === 'as_auditor' && (
                <p className="text-sm text-blue-600 dark:text-blue-400 flex items-center gap-2">
                  <UserCheck className="h-4 w-4" />
                  {language === 'ar'
                    ? 'المراجعات التي تقوم فيها بدور المراجع - يمكنك إضافة الملاحظات وتسجيل النتائج'
                    : 'Audits where you are the auditor - you can add findings and record results'}
                </p>
              )}
              {viewMode === 'as_auditee' && (
                <p className="text-sm text-orange-600 dark:text-orange-400 flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  {language === 'ar'
                    ? 'المراجعات على إدارتك - يمكنك متابعة الملاحظات والرد على الإجراءات التصحيحية'
                    : 'Audits on your department - you can track findings and respond to corrective actions'}
                </p>
              )}
            </div>
          </Card>
        )}

        {/* Workflow Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-[var(--primary)]" />
              {language === 'ar' ? 'مراحل سير العمل' : 'Workflow Stages'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between overflow-x-auto pb-2">
              {workflowStages.map((stage, index) => {
                const Icon = stage.icon;
                const count = auditsData.filter(a => a.currentStage === index).length;
                return (
                  <div key={stage.id} className="flex items-center">
                    <div className="flex flex-col items-center min-w-[100px]">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-full ${count > 0 ? 'bg-[var(--primary)] text-white' : 'bg-[var(--background-tertiary)] text-[var(--foreground-secondary)]'}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <p className="mt-2 text-xs font-medium text-[var(--foreground)] text-center">
                        {language === 'ar' ? stage.stepAr : stage.stepEn}
                      </p>
                      <p className="text-lg font-bold text-[var(--primary)]">{count}</p>
                    </div>
                    {index < workflowStages.length - 1 && (
                      <Arrow className="mx-1 h-5 w-5 text-[var(--foreground-muted)]" />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--primary-light)]">
                <ClipboardCheck className="h-5 w-5 text-[var(--primary)]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--foreground)]">{stats.total}</p>
                <p className="text-sm text-[var(--foreground-secondary)]">
                  {language === 'ar' ? 'إجمالي المراجعات' : 'Total Audits'}
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--foreground)]">{stats.inProgress}</p>
                <p className="text-sm text-[var(--foreground-secondary)]">
                  {language === 'ar' ? 'قيد التنفيذ' : 'In Progress'}
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
                <Shield className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--foreground)]">{stats.pendingApproval}</p>
                <p className="text-sm text-[var(--foreground-secondary)]">
                  {language === 'ar' ? 'بانتظار الموافقة' : 'Pending Approval'}
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
                <AlertCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--foreground)]">{stats.openFindings}</p>
                <p className="text-sm text-[var(--foreground-secondary)]">
                  {language === 'ar' ? 'ملاحظات مفتوحة' : 'Open Findings'}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
              <div className="relative flex-1">
                <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--foreground-muted)]" />
                <input
                  type="text"
                  placeholder={language === 'ar' ? 'بحث في المراجعات...' : 'Search audits...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] py-2 ps-10 pe-4 text-sm"
                />
              </div>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm"
              >
                {types.map(type => (
                  <option key={type.value} value={type.value}>
                    {language === 'ar' ? type.labelAr : type.labelEn}
                  </option>
                ))}
              </select>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm"
              >
                {statuses.map(status => (
                  <option key={status.value} value={status.value}>
                    {language === 'ar' ? status.labelAr : status.labelEn}
                  </option>
                ))}
              </select>

              {/* Sorting Options */}
              <div className="flex items-center gap-2 border-s border-[var(--border)] ps-4">
                <SlidersHorizontal className="h-4 w-4 text-[var(--foreground-muted)]" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                >
                  {sortOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {language === 'ar' ? option.labelAr : option.labelEn}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                  className="flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm hover:bg-[var(--background-secondary)] transition-colors"
                  title={language === 'ar' ? (sortOrder === 'desc' ? 'ترتيب تنازلي' : 'ترتيب تصاعدي') : (sortOrder === 'desc' ? 'Descending' : 'Ascending')}
                >
                  {sortOrder === 'desc' ? (
                    <>
                      <ArrowDown className="h-4 w-4" />
                      <span className="hidden sm:inline">{language === 'ar' ? 'الأحدث' : 'Newest'}</span>
                    </>
                  ) : (
                    <>
                      <ArrowUp className="h-4 w-4" />
                      <span className="hidden sm:inline">{language === 'ar' ? 'الأقدم' : 'Oldest'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <div className="flex flex-col">
                    <span>{t('audits.auditNumber')}</span>
                    {!isQualityManager && <span className="text-xs font-normal opacity-70">{language === 'ar' ? 'دورك' : 'Your Role'}</span>}
                  </div>
                </TableHead>
                <TableHead>{t('audits.auditTitle')}</TableHead>
                <TableHead>{t('audits.auditType')}</TableHead>
                <TableHead>{language === 'ar' ? 'المرحلة' : 'Stage'}</TableHead>
                <TableHead>{language === 'ar' ? 'الإدارة/القسم' : 'Dept/Section'}</TableHead>
                <TableHead>{language === 'ar' ? 'رئيس الفريق' : 'Lead Auditor'}</TableHead>
                <TableHead>{language === 'ar' ? 'الملاحظات' : 'Findings'}</TableHead>
                <TableHead className="text-center">{t('common.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAudits.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-[400px] text-center">
                    <div className="flex flex-col items-center justify-center max-w-md mx-auto">
                      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--background-secondary)] mb-6 animate-pulse">
                        <ClipboardCheck className="h-10 w-10 text-[var(--foreground-secondary)] opacity-50" />
                      </div>
                      <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">
                        {searchQuery || selectedType !== 'all' || selectedStatus !== 'all'
                          ? (language === 'ar' ? 'لا توجد نتائج مطابقة' : 'No matching results')
                          : (language === 'ar' ? 'لا توجد مراجعات حالياً' : 'No audits found')}
                      </h3>
                      <p className="text-[var(--foreground-secondary)] mb-6 max-w-sm">
                        {searchQuery || selectedType !== 'all' || selectedStatus !== 'all'
                          ? (language === 'ar' ? 'حاول تغيير معايير البحث أو الفلترة' : 'Try adjusting your search or filters')
                          : (language === 'ar' ? 'ابدأ بإنشاء مراجعة جديدة لتتبع الجودة والامتثال' : 'Get started by creating a new audit to track quality and compliance')}
                      </p>
                      {!searchQuery && selectedType === 'all' && selectedStatus === 'all' && (
                        <Button onClick={() => router.push('/audits/new')}>
                          <Plus className="h-4 w-4 me-2" />
                          {t('audits.newAudit')}
                        </Button>
                      )}
                      {(searchQuery || selectedType !== 'all' || selectedStatus !== 'all') && (
                        <Button variant="outline" onClick={() => {
                          setSearchQuery('');
                          setSelectedType('all');
                          setSelectedStatus('all');
                        }}>
                          {language === 'ar' ? 'مسح الفلاتر' : 'Clear Filters'}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredAudits.map((audit) => {
                  const dept = getDepartment(audit.departmentId);
                  const section = audit.sectionId ? getSection(audit.sectionId) : null;
                  const leadAuditor = getUser(audit.leadAuditorId);
                  const openFindings = audit.findings.filter(f => f.status !== 'closed').length;

                  // Determine user's role in this audit
                  const userIsAuditor = isUserAuditor(audit);
                  const userIsAuditee = isUserAuditee(audit);

                  return (
                    <TableRow key={audit.id}>
                      <TableCell className="font-mono text-sm">
                        <div className="flex flex-col gap-1">
                          <span>{audit.number}</span>
                          {/* Role Badge */}
                          {!isQualityManager && (userIsAuditor || userIsAuditee) && (
                            <div className="flex gap-1">
                              {userIsAuditor && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                  <UserCheck className="h-3 w-3" />
                                  {language === 'ar' ? 'مراجع' : 'Auditor'}
                                </span>
                              )}
                              {userIsAuditee && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
                                  <Building2 className="h-3 w-3" />
                                  {language === 'ar' ? 'مراجع عليه' : 'Auditee'}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{language === 'ar' ? audit.titleAr : audit.titleEn}</p>
                        <p className="text-xs text-[var(--foreground-muted)]">
                          {new Date(audit.startDate).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}
                        </p>
                      </TableCell>
                      <TableCell>{getTypeBadge(audit.type)}</TableCell>
                      <TableCell>{getStatusBadge(audit.status)}</TableCell>
                      <TableCell>
                        <p className="text-sm">{dept ? (language === 'ar' ? dept.nameAr : dept.nameEn) : '-'}</p>
                        {section && (
                          <p className="text-xs text-[var(--foreground-muted)]">
                            {language === 'ar' ? section.nameAr : section.nameEn}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--primary-light)] text-xs font-medium text-[var(--primary)]">
                            {(leadAuditor ? (language === 'ar' ? leadAuditor.fullNameAr : leadAuditor.fullNameEn) : '?').charAt(0)}
                          </div>
                          <span className="text-sm">
                            {leadAuditor ? (language === 'ar' ? leadAuditor.fullNameAr : leadAuditor.fullNameEn) : '-'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {openFindings > 0 ? (
                          <Badge variant="danger">{openFindings}</Badge>
                        ) : (
                          <span className="text-[var(--foreground-muted)]">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Button variant="ghost" size="icon-sm" onClick={() => handleViewAudit(audit)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {/* Approval buttons for Quality Manager when audit is pending approval */}
                          {isQualityManager && audit.status === 'pending_approval' && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                onClick={() => handleApproveAudit(audit.id)}
                                title={language === 'ar' ? 'موافقة' : 'Approve'}
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                onClick={() => {
                                  const reason = prompt(language === 'ar' ? 'سبب الرفض (اختياري):' : 'Rejection reason (optional):');
                                  handleRejectAudit(audit.id, reason || '');
                                }}
                                title={language === 'ar' ? 'رفض' : 'Reject'}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {audit.status !== 'pending_approval' && hasPermission('canDeleteAudits') && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleDeleteAudit(audit)}
                              title={language === 'ar' ? 'حذف المراجعة' : 'Delete Audit'}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Card>

        {/* نافذة المعاينة داخل القائمة: حُذفت.
            كانت نسخة ثانية أضعف من صفحة المراجعة - بمراحلها ومواقفها وأزرار اعتمادها -
            ولم يكن يفتحها شيء أصلاً: زر العين يذهب إلى /audits/[id] منذ البداية، ولا
            مستدعي لـ setSelectedAudit في الصفحة كلها. والقائمة تعرض وتنقل؛ والعمل على
            المراجعة يجري في مكان واحد. */}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && auditToDelete && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowDeleteModal(false)} />
            <div className="relative z-[70] w-full max-w-md rounded-xl bg-white dark:bg-gray-900 p-6 shadow-xl mx-4">
              <div className="flex items-center justify-center mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
              </div>
              <h2 className="text-xl font-semibold text-center mb-2">
                {language === 'ar' ? 'تأكيد الحذف' : 'Confirm Delete'}
              </h2>
              <p className="text-center text-[var(--foreground-secondary)] mb-4">
                {language === 'ar'
                  ? `هل أنت متأكد من حذف المراجعة "${auditToDelete.titleAr}"؟`
                  : `Are you sure you want to delete "${auditToDelete.titleEn}"?`}
              </p>
              <p className="text-xs text-red-500 text-center mb-6">
                {language === 'ar' ? 'لا يمكن التراجع عن هذا الإجراء' : 'This action cannot be undone'}
              </p>
              <div className="flex justify-center gap-3">
                <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
                  {t('common.cancel')}
                </Button>
                <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={confirmDelete}>
                  <Trash2 className="h-4 w-4 me-2" />
                  {language === 'ar' ? 'حذف' : 'Delete'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
