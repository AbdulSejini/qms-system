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
  subscribeToAudits,
  updateAudit,
  deleteAudit as deleteAuditFromFirestore,
  addNotification,
  Audit as FirestoreAudit,
} from '@/lib/firestore';
import {
  Plus,
  Search,
  ClipboardCheck,
  Eye,
  Edit,
  Calendar,
  AlertCircle,
  CheckCircle,
  Clock,
  FileQuestion,
  UserCheck,
  Wrench,
  ChevronRight,
  ChevronLeft,
  X,
  AlertTriangle,
  Award,
  Send,
  ThumbsUp,
  ThumbsDown,
  Paperclip,
  Shield,
  Trash2,
  Save,
  ArrowRight,
  Building2,
  Users,
  FileCheck,
  RotateCcw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  SlidersHorizontal,
} from 'lucide-react';

// ===========================================
// سير عمل المراجعة المنطقي
// ===========================================
const workflowStages = [
  {
    id: 'planning',
    stepAr: 'التخطيط',
    stepEn: 'Planning',
    icon: Calendar,
    descriptionAr: 'تحديد نطاق المراجعة والفريق والتواريخ',
    descriptionEn: 'Define audit scope, team, and dates',
  },
  {
    id: 'questions_preparation',
    stepAr: 'إعداد الأسئلة',
    stepEn: 'Questions Prep',
    icon: FileQuestion,
    descriptionAr: 'إعداد قائمة أسئلة المراجعة',
    descriptionEn: 'Prepare audit questions checklist',
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

// ISO 9001 Finding Categories
const findingCategories = {
  A: [
    { value: 'quality', labelAr: 'الجودة', labelEn: 'Quality' },
    { value: 'ohsas', labelAr: 'السلامة والصحة المهنية', labelEn: 'OHSAS' },
    { value: 'environment', labelAr: 'البيئة', labelEn: 'Environment' },
  ],
  B: [
    { value: 'major_nc', labelAr: 'عدم مطابقة رئيسي', labelEn: 'Major NC' },
    { value: 'minor_nc', labelAr: 'عدم مطابقة ثانوي', labelEn: 'Minor NC' },
    { value: 'observation', labelAr: 'ملاحظة', labelEn: 'Observation' },
    { value: 'opportunity', labelAr: 'فرصة تحسين', labelEn: 'Improvement Opportunity' },
  ],
};

// Finding interface
interface Finding {
  id: string;
  reportNumber: string;
  departmentId: string;
  sectionId?: string;
  clause: string; // ISO clause
  finding: string;
  evidence: string;
  categoryA: string;
  categoryB: string;
  estimatedClosingDate: string;
  rootCause?: string;
  correctiveAction?: string;
  actionEvidence?: string;
  status: 'open' | 'in_progress' | 'pending_verification' | 'closed';
  createdAt: string;
  closedAt?: string;
}

// Question interface
interface AuditQuestion {
  id: string;
  questionAr: string;
  questionEn: string;
  clause: string; // ISO clause reference
  answer?: string;
  status: 'pending' | 'compliant' | 'non_compliant' | 'not_applicable';
  notes?: string;
}

// Audit interface
interface Audit {
  id: string;
  number: string;
  titleAr: string;
  titleEn: string;
  type: 'internal' | 'external' | 'surveillance' | 'certification';
  departmentId: string;
  sectionId?: string;
  status: string;
  currentStage: number;
  leadAuditorId: string;
  auditorIds: string[];
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
const initialAudits: Audit[] = [];

export default function AuditsPage() {
  const router = useRouter();
  const { t, language, isRTL } = useTranslation();
  const { currentUser, hasPermission, users: allUsers, departments: allDepartments, sections: allSections } = useAuth();

  // Get auditors from users (canBeAuditor = true)
  const auditors = useMemo(() => allUsers.filter(u => u.canBeAuditor && u.isActive), [allUsers]);

  // Check if current user is quality manager
  const isQualityManager = currentUser?.role === 'quality_manager';

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
        currentStage: getStageFromStatus(fa.status),
        leadAuditorId: fa.leadAuditorId,
        auditorIds: fa.teamMemberIds || [],
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

  // Helper to get stage from status
  const getStageFromStatus = (status: string): number => {
    const stageMap: Record<string, number> = {
      'draft': 0,
      'pending_approval': 0,
      'approved': 0,
      'planning': 0,
      'questions_preparation': 1,
      'execution': 2,
      'in_progress': 2,
      'qms_review': 3,
      'corrective_actions': 4,
      'verification': 5,
      'completed': 6,
      'cancelled': 6,
      'postponed': 0,
    };
    return stageMap[status] || 0;
  };

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
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedAudit, setSelectedAudit] = useState<Audit | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [auditToDelete, setAuditToDelete] = useState<Audit | null>(null);

  // Detail modal tabs
  const [activeTab, setActiveTab] = useState<'details' | 'questions' | 'findings' | 'approval'>('details');

  // New audit form
  const [newAudit, setNewAudit] = useState<{
    titleAr: string;
    titleEn: string;
    type: 'internal' | 'external' | 'surveillance' | 'certification';
    departmentId: string;
    sectionId: string;
    leadAuditorId: string;
    auditorIds: string[];
    startDate: string;
    endDate: string;
    scope: string;
    objective: string;
  }>({
    titleAr: '',
    titleEn: '',
    type: 'internal',
    departmentId: '',
    sectionId: '',
    leadAuditorId: '',
    auditorIds: [],
    startDate: '',
    endDate: '',
    scope: '',
    objective: '',
  });

  // Auditor search
  const [auditorSearch, setAuditorSearch] = useState('');
  const [showAuditorDropdown, setShowAuditorDropdown] = useState(false);

  // Question modal
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [newQuestion, setNewQuestion] = useState({ questionAr: '', questionEn: '', clause: '' });

  // Finding modal
  const [showFindingModal, setShowFindingModal] = useState(false);
  const [newFinding, setNewFinding] = useState({
    clause: '',
    finding: '',
    evidence: '',
    categoryA: '',
    categoryB: '',
    estimatedClosingDate: '',
  });

  // QMS Approval modal
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalComment, setApprovalComment] = useState('');

  // Helper functions
  const getDepartment = (id: string) => allDepartments.find(d => d.id === id);
  const getSection = (id: string) => allSections.find(s => s.id === id);
  const getUser = (id: string) => allUsers.find(u => u.id === id);
  const getSectionsByDepartment = (deptId: string) => allSections.filter(s => s.departmentId === deptId);

  // Filtered auditors for search
  const filteredAuditors = useMemo(() => {
    if (!auditorSearch) return auditors;
    const search = auditorSearch.toLowerCase();
    return auditors.filter(a =>
      a.fullNameAr.toLowerCase().includes(search) ||
      a.fullNameEn.toLowerCase().includes(search)
    );
  }, [auditorSearch, auditors]);

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

  // Filter and sort audits
  const filteredAudits = useMemo(() => {
    // First filter by user access and view mode
    let accessibleAudits = auditsData.filter(audit => {
      // Quality manager can see all audits
      if (isQualityManager && viewMode === 'all') return true;

      // Filter by view mode
      if (viewMode === 'as_auditor') {
        return isUserAuditor(audit);
      }

      if (viewMode === 'as_auditee') {
        if (!isUserAuditee(audit)) return false;
        // Auditee can see after QMS approval (stage 3+) or if department head (stage 2+)
        if (audit.currentStage >= 3) return true;
        if ((currentUser?.role === 'department_manager' || currentUser?.role === 'section_head') && audit.currentStage >= 2) return true;
        return false;
      }

      // Default 'all' mode
      // User can see audits they created
      if (audit.createdBy === currentUser?.id) return true;

      // User can see audits where they are lead auditor
      if (audit.leadAuditorId === currentUser?.id) return true;

      // User can see audits where they are part of the team
      if (audit.auditorIds?.includes(currentUser?.id || '')) return true;

      // User can see audits where their department is being audited (auditee)
      // Only show after QMS approval (currentStage >= 3) or if user is department head
      if (audit.departmentId === currentUser?.departmentId) {
        // Show if audit has been approved by QMS (stage 3+)
        if (audit.currentStage >= 3) return true;
        // Or if user is department/section head, show scheduled audits (stage 2+)
        if ((currentUser?.role === 'department_manager' || currentUser?.role === 'section_head') && audit.currentStage >= 2) return true;
      }

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

  // Check if user is an auditor in an audit
  const isUserAuditor = (audit: Audit) => {
    return audit.leadAuditorId === currentUser?.id ||
           audit.auditorIds?.includes(currentUser?.id || '') ||
           audit.createdBy === currentUser?.id;
  };

  // Check if user is an auditee (their department is being audited)
  const isUserAuditee = (audit: Audit) => {
    return audit.departmentId === currentUser?.departmentId;
  };

  // Audits where user is auditor
  const auditsAsAuditor = useMemo(() => {
    return auditsData.filter(audit => isUserAuditor(audit));
  }, [auditsData, currentUser]);

  // Audits where user is auditee
  const auditsAsAuditee = useMemo(() => {
    return auditsData.filter(audit => {
      if (!isUserAuditee(audit)) return false;
      // Auditee can see after QMS approval (stage 3+) or if department head (stage 2+)
      if (audit.currentStage >= 3) return true;
      if ((currentUser?.role === 'department_manager' || currentUser?.role === 'section_head') && audit.currentStage >= 2) return true;
      return false;
    });
  }, [auditsData, currentUser]);

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
    inProgress: accessibleAuditsForStats.filter(a => a.currentStage >= 1 && a.currentStage < 6).length,
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

  // Finding status badge
  const getFindingStatusBadge = (status: Finding['status']) => {
    const config: Record<Finding['status'], { color: string; labelAr: string; labelEn: string }> = {
      open: { color: 'bg-red-100 text-red-700', labelAr: 'مفتوح', labelEn: 'Open' },
      in_progress: { color: 'bg-yellow-100 text-yellow-700', labelAr: 'قيد العمل', labelEn: 'In Progress' },
      pending_verification: { color: 'bg-blue-100 text-blue-700', labelAr: 'بانتظار التحقق', labelEn: 'Pending Verification' },
      closed: { color: 'bg-green-100 text-green-700', labelAr: 'مغلق', labelEn: 'Closed' },
    };
    const c = config[status];
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

  // Handle create audit
  const handleCreateAudit = () => {
    if (!newAudit.titleAr || !newAudit.departmentId || !newAudit.leadAuditorId) return;

    const audit: Audit = {
      id: `${Date.now()}`,
      number: `AUD-${new Date().getFullYear()}-${String(auditsData.length + 1).padStart(4, '0')}`,
      titleAr: newAudit.titleAr,
      titleEn: newAudit.titleEn || newAudit.titleAr,
      type: newAudit.type,
      departmentId: newAudit.departmentId,
      sectionId: newAudit.sectionId || undefined,
      status: 'planning',
      currentStage: 0,
      leadAuditorId: newAudit.leadAuditorId,
      auditorIds: [newAudit.leadAuditorId, ...newAudit.auditorIds.filter(id => id !== newAudit.leadAuditorId)],
      startDate: newAudit.startDate || new Date().toISOString().split('T')[0],
      endDate: newAudit.endDate,
      scope: newAudit.scope,
      objective: newAudit.objective,
      questions: [],
      findings: [],
      createdAt: new Date().toISOString().split('T')[0],
    };

    setAuditsData(prev => [audit, ...prev]);
    setShowNewModal(false);
    resetNewAuditForm();

    // Open the audit for detailed editing
    setSelectedAudit(audit);
    setActiveTab('details');
    setShowDetailModal(true);
  };

  const resetNewAuditForm = () => {
    setNewAudit({
      titleAr: '',
      titleEn: '',
      type: 'internal',
      departmentId: '',
      sectionId: '',
      leadAuditorId: '',
      auditorIds: [],
      startDate: '',
      endDate: '',
      scope: '',
      objective: '',
    });
    setAuditorSearch('');
  };

  // Add auditor to team
  const addAuditorToTeam = (auditorId: string) => {
    if (!newAudit.auditorIds.includes(auditorId) && auditorId !== newAudit.leadAuditorId) {
      setNewAudit({ ...newAudit, auditorIds: [...newAudit.auditorIds, auditorId] });
    }
    setAuditorSearch('');
    setShowAuditorDropdown(false);
  };

  // Remove auditor from team
  const removeAuditorFromTeam = (auditorId: string) => {
    setNewAudit({ ...newAudit, auditorIds: newAudit.auditorIds.filter(id => id !== auditorId) });
  };

  // Move to next stage
  const moveToNextStage = () => {
    if (!selectedAudit || selectedAudit.currentStage >= workflowStages.length - 1) return;

    const nextStage = selectedAudit.currentStage + 1;
    const updatedAudit = {
      ...selectedAudit,
      currentStage: nextStage,
      status: workflowStages[nextStage].id,
    };

    setAuditsData(prev => prev.map(a => a.id === selectedAudit.id ? updatedAudit : a));
    setSelectedAudit(updatedAudit);
  };

  // Add question
  const handleAddQuestion = () => {
    if (!selectedAudit || !newQuestion.questionAr) return;

    const question: AuditQuestion = {
      id: `q${Date.now()}`,
      questionAr: newQuestion.questionAr,
      questionEn: newQuestion.questionEn || newQuestion.questionAr,
      clause: newQuestion.clause,
      status: 'pending',
    };

    const updatedAudit = {
      ...selectedAudit,
      questions: [...selectedAudit.questions, question],
    };

    setAuditsData(prev => prev.map(a => a.id === selectedAudit.id ? updatedAudit : a));
    setSelectedAudit(updatedAudit);
    setNewQuestion({ questionAr: '', questionEn: '', clause: '' });
    setShowQuestionModal(false);
  };

  // Add finding
  const handleAddFinding = () => {
    if (!selectedAudit || !newFinding.finding || !newFinding.categoryB) return;

    const finding: Finding = {
      id: `f${Date.now()}`,
      reportNumber: `FND-${new Date().getFullYear()}-${String(selectedAudit.findings.length + 1).padStart(3, '0')}`,
      departmentId: selectedAudit.departmentId,
      sectionId: selectedAudit.sectionId,
      clause: newFinding.clause,
      finding: newFinding.finding,
      evidence: newFinding.evidence,
      categoryA: newFinding.categoryA || 'quality',
      categoryB: newFinding.categoryB,
      estimatedClosingDate: newFinding.estimatedClosingDate,
      status: 'open',
      createdAt: new Date().toISOString().split('T')[0],
    };

    const updatedAudit = {
      ...selectedAudit,
      findings: [...selectedAudit.findings, finding],
    };

    setAuditsData(prev => prev.map(a => a.id === selectedAudit.id ? updatedAudit : a));
    setSelectedAudit(updatedAudit);
    setNewFinding({ clause: '', finding: '', evidence: '', categoryA: '', categoryB: '', estimatedClosingDate: '' });
    setShowFindingModal(false);
  };

  // QMS Approval
  const handleQMSApproval = (approved: boolean) => {
    if (!selectedAudit) return;

    const updatedAudit = {
      ...selectedAudit,
      qmsApproval: {
        approved,
        comment: approvalComment,
        date: new Date().toISOString().split('T')[0],
        approvedBy: 'user-3', // Current user
      },
      currentStage: approved ? selectedAudit.currentStage + 1 : selectedAudit.currentStage,
      status: approved ? workflowStages[selectedAudit.currentStage + 1]?.id || 'completed' : selectedAudit.status,
    };

    setAuditsData(prev => prev.map(a => a.id === selectedAudit.id ? updatedAudit : a));
    setSelectedAudit(updatedAudit);
    setShowApprovalModal(false);
    setApprovalComment('');
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
                className={`flex-1 flex items-center justify-center gap-3 px-6 py-4 text-sm font-medium transition-all relative ${
                  viewMode === 'all'
                    ? 'text-[var(--primary)] bg-[var(--primary-light)]'
                    : 'text-[var(--foreground-secondary)] hover:bg-[var(--background-secondary)]'
                }`}
              >
                <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
                  viewMode === 'all' ? 'bg-[var(--primary)] text-white' : 'bg-[var(--background-tertiary)]'
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
                  className={`flex-1 flex items-center justify-center gap-3 px-6 py-4 text-sm font-medium transition-all relative border-s border-[var(--border)] ${
                    viewMode === 'as_auditor'
                      ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20'
                      : 'text-[var(--foreground-secondary)] hover:bg-[var(--background-secondary)]'
                  }`}
                >
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
                    viewMode === 'as_auditor' ? 'bg-blue-600 text-white' : 'bg-[var(--background-tertiary)]'
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
                  className={`flex-1 flex items-center justify-center gap-3 px-6 py-4 text-sm font-medium transition-all relative border-s border-[var(--border)] ${
                    viewMode === 'as_auditee'
                      ? 'text-orange-600 bg-orange-50 dark:bg-orange-900/20'
                      : 'text-[var(--foreground-secondary)] hover:bg-[var(--background-secondary)]'
                  }`}
                >
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
                    viewMode === 'as_auditee' ? 'bg-orange-600 text-white' : 'bg-[var(--background-tertiary)]'
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
              {filteredAudits.map((audit) => {
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
              })}
            </TableBody>
          </Table>
        </Card>

        {/* New Audit Modal */}
        {showNewModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowNewModal(false)} />
            <div className="relative z-50 w-full max-w-2xl rounded-xl bg-white dark:bg-gray-900 p-6 shadow-xl mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">{t('audits.newAudit')}</h2>
                <Button variant="ghost" size="icon-sm" onClick={() => setShowNewModal(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-5">
                {/* Title */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">
                      {language === 'ar' ? 'عنوان المراجعة (عربي) *' : 'Audit Title (Arabic) *'}
                    </label>
                    <input
                      type="text"
                      value={newAudit.titleAr}
                      onChange={(e) => setNewAudit({ ...newAudit, titleAr: e.target.value })}
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">
                      {language === 'ar' ? 'عنوان المراجعة (إنجليزي)' : 'Audit Title (English)'}
                    </label>
                    <input
                      type="text"
                      value={newAudit.titleEn}
                      onChange={(e) => setNewAudit({ ...newAudit, titleEn: e.target.value })}
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm"
                    />
                  </div>
                </div>

                {/* Type and Department */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">
                      {t('audits.auditType')}
                    </label>
                    <select
                      value={newAudit.type}
                      onChange={(e) => setNewAudit({ ...newAudit, type: e.target.value as typeof newAudit.type })}
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm"
                    >
                      {types.slice(1).map(type => (
                        <option key={type.value} value={type.value}>
                          {language === 'ar' ? type.labelAr : type.labelEn}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">
                      {language === 'ar' ? 'الإدارة *' : 'Department *'}
                    </label>
                    <select
                      value={newAudit.departmentId}
                      onChange={(e) => setNewAudit({ ...newAudit, departmentId: e.target.value, sectionId: '' })}
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm"
                    >
                      <option value="">{language === 'ar' ? 'اختر الإدارة' : 'Select Department'}</option>
                      {allDepartments.filter(d => d.isActive).map(dept => (
                        <option key={dept.id} value={dept.id}>
                          {language === 'ar' ? dept.nameAr : dept.nameEn}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Section */}
                {newAudit.departmentId && (
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">
                      {language === 'ar' ? 'القسم (اختياري)' : 'Section (Optional)'}
                    </label>
                    <select
                      value={newAudit.sectionId}
                      onChange={(e) => setNewAudit({ ...newAudit, sectionId: e.target.value })}
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm"
                    >
                      <option value="">{language === 'ar' ? 'كل الأقسام' : 'All Sections'}</option>
                      {getSectionsByDepartment(newAudit.departmentId).filter(s => s.isActive).map(sec => (
                        <option key={sec.id} value={sec.id}>
                          {language === 'ar' ? sec.nameAr : sec.nameEn}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Lead Auditor */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    {language === 'ar' ? 'رئيس فريق المراجعة *' : 'Lead Auditor *'}
                  </label>
                  <select
                    value={newAudit.leadAuditorId}
                    onChange={(e) => setNewAudit({ ...newAudit, leadAuditorId: e.target.value })}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm"
                  >
                    <option value="">{language === 'ar' ? 'اختر رئيس الفريق' : 'Select Lead Auditor'}</option>
                    {auditors.map(auditor => (
                      <option key={auditor.id} value={auditor.id}>
                        {language === 'ar' ? auditor.fullNameAr : auditor.fullNameEn} - {language === 'ar' ? auditor.jobTitleAr : auditor.jobTitleEn}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Team Members */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    {language === 'ar' ? 'أعضاء الفريق' : 'Team Members'}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={auditorSearch}
                      onChange={(e) => {
                        setAuditorSearch(e.target.value);
                        setShowAuditorDropdown(true);
                      }}
                      onFocus={() => setShowAuditorDropdown(true)}
                      placeholder={language === 'ar' ? 'ابحث عن مراجع...' : 'Search for auditor...'}
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm"
                    />
                    {showAuditorDropdown && filteredAuditors.length > 0 && (
                      <div className="absolute z-10 mt-1 w-full rounded-lg border border-[var(--border)] bg-white dark:bg-gray-800 shadow-lg max-h-48 overflow-y-auto">
                        {filteredAuditors
                          .filter(a => a.id !== newAudit.leadAuditorId && !newAudit.auditorIds.includes(a.id))
                          .map(auditor => (
                            <button
                              key={auditor.id}
                              type="button"
                              onClick={() => addAuditorToTeam(auditor.id)}
                              className="w-full px-4 py-2 text-start text-sm hover:bg-[var(--background-tertiary)]"
                            >
                              {language === 'ar' ? auditor.fullNameAr : auditor.fullNameEn}
                              <span className="text-xs text-[var(--foreground-muted)] ms-2">
                                {language === 'ar' ? auditor.jobTitleAr : auditor.jobTitleEn}
                              </span>
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                  {newAudit.auditorIds.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {newAudit.auditorIds.map(id => {
                        const auditor = getUser(id);
                        return auditor ? (
                          <span key={id} className="inline-flex items-center gap-1 px-2 py-1 bg-[var(--primary-light)] text-[var(--primary)] rounded-full text-xs">
                            {language === 'ar' ? auditor.fullNameAr : auditor.fullNameEn}
                            <button type="button" onClick={() => removeAuditorFromTeam(id)}>
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">{t('audits.startDate')}</label>
                    <input
                      type="date"
                      value={newAudit.startDate}
                      onChange={(e) => setNewAudit({ ...newAudit, startDate: e.target.value })}
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">{t('audits.endDate')}</label>
                    <input
                      type="date"
                      value={newAudit.endDate}
                      onChange={(e) => setNewAudit({ ...newAudit, endDate: e.target.value })}
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm"
                    />
                  </div>
                </div>

                {/* Scope and Objective */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    {language === 'ar' ? 'نطاق المراجعة' : 'Audit Scope'}
                  </label>
                  <textarea
                    rows={2}
                    value={newAudit.scope}
                    onChange={(e) => setNewAudit({ ...newAudit, scope: e.target.value })}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    {language === 'ar' ? 'هدف المراجعة' : 'Audit Objective'}
                  </label>
                  <textarea
                    rows={2}
                    value={newAudit.objective}
                    onChange={(e) => setNewAudit({ ...newAudit, objective: e.target.value })}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <Button variant="outline" onClick={() => setShowNewModal(false)}>
                  {t('common.cancel')}
                </Button>
                <Button
                  onClick={handleCreateAudit}
                  disabled={!newAudit.titleAr || !newAudit.departmentId || !newAudit.leadAuditorId}
                >
                  {language === 'ar' ? 'إنشاء ومتابعة' : 'Create & Continue'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Detail Modal */}
        {showDetailModal && selectedAudit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowDetailModal(false)} />
            <div className="relative z-50 w-full max-w-5xl rounded-xl bg-white dark:bg-gray-900 shadow-xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-[var(--border)]">
                <div>
                  <h2 className="text-xl font-semibold">
                    {language === 'ar' ? selectedAudit.titleAr : selectedAudit.titleEn}
                  </h2>
                  <p className="text-sm text-[var(--foreground-secondary)]">{selectedAudit.number}</p>
                </div>
                <div className="flex items-center gap-3">
                  {getTypeBadge(selectedAudit.type)}
                  {getStatusBadge(selectedAudit.status)}
                  <Button variant="ghost" size="icon-sm" onClick={() => setShowDetailModal(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Workflow Progress */}
              <div className="p-4 bg-[var(--background-secondary)] border-b border-[var(--border)]">
                <div className="flex items-center justify-between overflow-x-auto">
                  {workflowStages.map((stage, index) => {
                    const Icon = stage.icon;
                    const isCompleted = index < selectedAudit.currentStage;
                    const isCurrent = index === selectedAudit.currentStage;
                    return (
                      <div key={stage.id} className="flex items-center">
                        <div className="flex flex-col items-center">
                          <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                            isCompleted ? 'bg-green-500 text-white' :
                            isCurrent ? 'bg-[var(--primary)] text-white' :
                            'bg-[var(--background-tertiary)] text-[var(--foreground-muted)]'
                          }`}>
                            {isCompleted ? <CheckCircle className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                          </div>
                          <p className={`mt-1 text-xs font-medium text-center ${isCurrent ? 'text-[var(--primary)]' : 'text-[var(--foreground-secondary)]'}`}>
                            {language === 'ar' ? stage.stepAr : stage.stepEn}
                          </p>
                        </div>
                        {index < workflowStages.length - 1 && (
                          <div className={`mx-1 h-0.5 w-8 ${isCompleted ? 'bg-green-500' : 'bg-[var(--border)]'}`} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-[var(--border)]">
                {[
                  { id: 'details', labelAr: 'التفاصيل', labelEn: 'Details' },
                  { id: 'questions', labelAr: 'الأسئلة', labelEn: 'Questions', count: selectedAudit.questions.length },
                  { id: 'findings', labelAr: 'الملاحظات', labelEn: 'Findings', count: selectedAudit.findings.length },
                  { id: 'approval', labelAr: 'الموافقات', labelEn: 'Approval' },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                    className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === tab.id
                        ? 'border-[var(--primary)] text-[var(--primary)]'
                        : 'border-transparent text-[var(--foreground-secondary)] hover:text-[var(--foreground)]'
                    }`}
                  >
                    {language === 'ar' ? tab.labelAr : tab.labelEn}
                    {tab.count !== undefined && tab.count > 0 && (
                      <span className="ms-2 px-1.5 py-0.5 rounded-full bg-[var(--primary-light)] text-[var(--primary)] text-xs">
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {/* Details Tab */}
                {activeTab === 'details' && (
                  <div className="grid gap-6 lg:grid-cols-2">
                    <div className="space-y-4">
                      <h3 className="font-semibold">{language === 'ar' ? 'تفاصيل المراجعة' : 'Audit Details'}</h3>
                      <div className="space-y-3">
                        <div className="flex justify-between py-2 border-b border-[var(--border)]">
                          <span className="text-[var(--foreground-secondary)]">{language === 'ar' ? 'الإدارة' : 'Department'}</span>
                          <span>{getDepartment(selectedAudit.departmentId) ? (language === 'ar' ? getDepartment(selectedAudit.departmentId)!.nameAr : getDepartment(selectedAudit.departmentId)!.nameEn) : '-'}</span>
                        </div>
                        {selectedAudit.sectionId && (
                          <div className="flex justify-between py-2 border-b border-[var(--border)]">
                            <span className="text-[var(--foreground-secondary)]">{language === 'ar' ? 'القسم' : 'Section'}</span>
                            <span>{getSection(selectedAudit.sectionId) ? (language === 'ar' ? getSection(selectedAudit.sectionId)!.nameAr : getSection(selectedAudit.sectionId)!.nameEn) : '-'}</span>
                          </div>
                        )}
                        <div className="flex justify-between py-2 border-b border-[var(--border)]">
                          <span className="text-[var(--foreground-secondary)]">{t('audits.startDate')}</span>
                          <span>{new Date(selectedAudit.startDate).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-[var(--border)]">
                          <span className="text-[var(--foreground-secondary)]">{t('audits.endDate')}</span>
                          <span>{selectedAudit.endDate ? new Date(selectedAudit.endDate).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US') : '-'}</span>
                        </div>
                        {selectedAudit.scope && (
                          <div className="py-2">
                            <span className="text-[var(--foreground-secondary)] block mb-1">{language === 'ar' ? 'نطاق المراجعة' : 'Scope'}</span>
                            <p className="text-sm">{selectedAudit.scope}</p>
                          </div>
                        )}
                        {selectedAudit.objective && (
                          <div className="py-2">
                            <span className="text-[var(--foreground-secondary)] block mb-1">{language === 'ar' ? 'الهدف' : 'Objective'}</span>
                            <p className="text-sm">{selectedAudit.objective}</p>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="space-y-4">
                      <h3 className="font-semibold">{language === 'ar' ? 'فريق المراجعة' : 'Audit Team'}</h3>
                      <div className="space-y-2">
                        {[...new Set(selectedAudit.auditorIds)].map((id, idx) => {
                          const auditor = getUser(id);
                          const isLead = id === selectedAudit.leadAuditorId;
                          return auditor ? (
                            <div key={`auditor-${id}-${idx}`} className="flex items-center gap-3 p-3 rounded-lg bg-[var(--background-tertiary)]">
                              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                                isLead ? 'bg-[var(--primary)] text-white' : 'bg-[var(--background)] text-[var(--foreground)]'
                              }`}>
                                {idx + 1}
                              </div>
                              <div className="flex-1">
                                <p className="text-sm font-medium">{language === 'ar' ? auditor.fullNameAr : auditor.fullNameEn}</p>
                                <p className="text-xs text-[var(--foreground-secondary)]">
                                  {isLead ? (language === 'ar' ? 'رئيس الفريق' : 'Lead Auditor') : (language === 'ar' ? 'عضو' : 'Member')}
                                </p>
                              </div>
                            </div>
                          ) : null;
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Questions Tab */}
                {activeTab === 'questions' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">{language === 'ar' ? 'قائمة الأسئلة' : 'Questions Checklist'}</h3>
                      {(selectedAudit.currentStage === 1 || selectedAudit.currentStage === 2) && (
                        <Button size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowQuestionModal(true)}>
                          {language === 'ar' ? 'إضافة سؤال' : 'Add Question'}
                        </Button>
                      )}
                    </div>

                    {selectedAudit.questions.length > 0 ? (
                      <div className="space-y-3">
                        {selectedAudit.questions.map((q, idx) => (
                          <div key={q.id} className="rounded-lg border border-[var(--border)] p-4">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <p className="text-sm font-medium">
                                  {idx + 1}. {language === 'ar' ? q.questionAr : q.questionEn}
                                </p>
                                {q.clause && (
                                  <p className="text-xs text-[var(--foreground-muted)] mt-1">
                                    {language === 'ar' ? 'البند:' : 'Clause:'} {q.clause}
                                  </p>
                                )}
                              </div>
                              <span className={`px-2 py-0.5 rounded-full text-xs ${
                                q.status === 'compliant' ? 'bg-green-100 text-green-700' :
                                q.status === 'non_compliant' ? 'bg-red-100 text-red-700' :
                                q.status === 'not_applicable' ? 'bg-gray-100 text-gray-700' :
                                'bg-yellow-100 text-yellow-700'
                              }`}>
                                {q.status === 'compliant' ? (language === 'ar' ? 'مطابق' : 'Compliant') :
                                 q.status === 'non_compliant' ? (language === 'ar' ? 'غير مطابق' : 'Non-Compliant') :
                                 q.status === 'not_applicable' ? (language === 'ar' ? 'لا ينطبق' : 'N/A') :
                                 (language === 'ar' ? 'معلق' : 'Pending')}
                              </span>
                            </div>
                            {q.answer && (
                              <p className="mt-3 text-sm text-[var(--foreground-secondary)] bg-[var(--background-tertiary)] rounded p-3">
                                {q.answer}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-[var(--foreground-muted)]">
                        <FileQuestion className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>{language === 'ar' ? 'لم يتم إضافة أسئلة بعد' : 'No questions added yet'}</p>
                        {selectedAudit.currentStage === 1 && (
                          <Button size="sm" className="mt-4" onClick={() => setShowQuestionModal(true)}>
                            {language === 'ar' ? 'إضافة أول سؤال' : 'Add First Question'}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Findings Tab */}
                {activeTab === 'findings' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">{language === 'ar' ? 'الملاحظات' : 'Findings'}</h3>
                      {selectedAudit.currentStage >= 2 && selectedAudit.currentStage < 4 && (
                        <Button size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowFindingModal(true)}>
                          {language === 'ar' ? 'إضافة ملاحظة' : 'Add Finding'}
                        </Button>
                      )}
                    </div>

                    {selectedAudit.findings.length > 0 ? (
                      <div className="space-y-4">
                        {selectedAudit.findings.map(finding => (
                          <div key={finding.id} className="border border-[var(--border)] rounded-lg p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="font-mono text-sm text-[var(--foreground-secondary)]">{finding.reportNumber}</span>
                                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                                    finding.categoryB === 'major_nc' ? 'bg-red-100 text-red-700' :
                                    finding.categoryB === 'minor_nc' ? 'bg-orange-100 text-orange-700' :
                                    finding.categoryB === 'observation' ? 'bg-yellow-100 text-yellow-700' :
                                    'bg-blue-100 text-blue-700'
                                  }`}>
                                    {findingCategories.B.find(c => c.value === finding.categoryB)?.[language === 'ar' ? 'labelAr' : 'labelEn'] || finding.categoryB}
                                  </span>
                                  {getFindingStatusBadge(finding.status)}
                                </div>
                                <p className="text-sm font-medium">{finding.finding}</p>
                                <p className="text-xs text-[var(--foreground-secondary)] mt-1">
                                  {language === 'ar' ? 'البند:' : 'Clause:'} {finding.clause}
                                </p>
                              </div>
                            </div>
                            {finding.evidence && (
                              <div className="mt-3 p-3 bg-[var(--background-tertiary)] rounded-lg">
                                <p className="text-xs font-medium text-[var(--foreground-secondary)] mb-1">
                                  {language === 'ar' ? 'الدليل:' : 'Evidence:'}
                                </p>
                                <p className="text-sm">{finding.evidence}</p>
                              </div>
                            )}
                            {finding.rootCause && (
                              <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">
                                  {language === 'ar' ? 'السبب الجذري:' : 'Root Cause:'}
                                </p>
                                <p className="text-sm">{finding.rootCause}</p>
                              </div>
                            )}
                            {finding.correctiveAction && (
                              <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                                <p className="text-xs font-medium text-green-700 dark:text-green-300 mb-1">
                                  {language === 'ar' ? 'الإجراء التصحيحي:' : 'Corrective Action:'}
                                </p>
                                <p className="text-sm">{finding.correctiveAction}</p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-[var(--foreground-muted)]">
                        <CheckCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>{language === 'ar' ? 'لا توجد ملاحظات' : 'No findings recorded'}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Approval Tab */}
                {activeTab === 'approval' && (
                  <div className="space-y-6">
                    <h3 className="font-semibold">{language === 'ar' ? 'موافقة إدارة الجودة' : 'QMS Department Approval'}</h3>

                    {/* Workflow explanation */}
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                      <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">
                        {language === 'ar' ? 'مسار الموافقة' : 'Approval Workflow'}
                      </h4>
                      <div className="flex items-center gap-2 text-xs text-blue-700 dark:text-blue-400">
                        <span className="px-2 py-1 bg-blue-100 dark:bg-blue-800 rounded">
                          {language === 'ar' ? 'فريق المراجعة' : 'Audit Team'}
                        </span>
                        <Arrow className="h-4 w-4" />
                        <span className="px-2 py-1 bg-blue-100 dark:bg-blue-800 rounded">
                          {language === 'ar' ? 'إدارة الجودة (QMS)' : 'QMS Department'}
                        </span>
                        <Arrow className="h-4 w-4" />
                        <span className="px-2 py-1 bg-blue-100 dark:bg-blue-800 rounded">
                          {language === 'ar' ? 'الجهة المراجَعة' : 'Auditee'}
                        </span>
                      </div>
                    </div>

                    {selectedAudit.qmsApproval ? (
                      <div className={`p-4 rounded-lg border ${
                        selectedAudit.qmsApproval.approved
                          ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                          : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                      }`}>
                        <div className="flex items-center gap-2 mb-2">
                          {selectedAudit.qmsApproval.approved ? (
                            <ThumbsUp className="h-5 w-5 text-green-600" />
                          ) : (
                            <ThumbsDown className="h-5 w-5 text-red-600" />
                          )}
                          <span className="font-medium">
                            {selectedAudit.qmsApproval.approved
                              ? (language === 'ar' ? 'تمت الموافقة' : 'Approved')
                              : (language === 'ar' ? 'مرفوض' : 'Rejected')}
                          </span>
                        </div>
                        {selectedAudit.qmsApproval.comment && (
                          <p className="text-sm mt-2">{selectedAudit.qmsApproval.comment}</p>
                        )}
                        <p className="text-xs text-[var(--foreground-secondary)] mt-2">
                          {selectedAudit.qmsApproval.date} - {getUser(selectedAudit.qmsApproval.approvedBy)?.fullNameAr}
                        </p>
                      </div>
                    ) : selectedAudit.currentStage === 3 ? (
                      <div className="p-4 border border-yellow-200 dark:border-yellow-800 rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
                        <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-300 mb-3 flex items-center gap-2">
                          <Shield className="h-4 w-4" />
                          {language === 'ar' ? 'بانتظار موافقة إدارة الجودة' : 'Pending QMS Approval'}
                        </h4>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => setShowApprovalModal(true)}
                          >
                            <ThumbsUp className="h-4 w-4 me-2" />
                            {language === 'ar' ? 'موافقة' : 'Approve'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 border-red-600"
                            onClick={() => {
                              setShowApprovalModal(true);
                            }}
                          >
                            <ThumbsDown className="h-4 w-4 me-2" />
                            {language === 'ar' ? 'رفض' : 'Reject'}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-center py-8 text-[var(--foreground-muted)]">
                        {language === 'ar' ? 'لا توجد موافقات معلقة حالياً' : 'No pending approvals'}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Footer Actions */}
              <div className="flex justify-end gap-3 p-4 border-t border-[var(--border)]">
                <Button variant="outline" onClick={() => setShowDetailModal(false)}>
                  {t('common.close')}
                </Button>
                {selectedAudit.currentStage < workflowStages.length - 1 && selectedAudit.currentStage !== 3 && (
                  <Button leftIcon={<Arrow className="h-4 w-4" />} onClick={moveToNextStage}>
                    {language === 'ar' ? 'الانتقال للمرحلة التالية' : 'Move to Next Stage'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Add Question Modal */}
        {showQuestionModal && selectedAudit && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowQuestionModal(false)} />
            <div className="relative z-[60] w-full max-w-md rounded-xl bg-white dark:bg-gray-900 p-6 shadow-xl mx-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">
                  {language === 'ar' ? 'إضافة سؤال جديد' : 'Add New Question'}
                </h2>
                <Button variant="ghost" size="icon-sm" onClick={() => setShowQuestionModal(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    {language === 'ar' ? 'السؤال (عربي) *' : 'Question (Arabic) *'}
                  </label>
                  <textarea
                    rows={2}
                    value={newQuestion.questionAr}
                    onChange={(e) => setNewQuestion({ ...newQuestion, questionAr: e.target.value })}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    {language === 'ar' ? 'السؤال (إنجليزي)' : 'Question (English)'}
                  </label>
                  <textarea
                    rows={2}
                    value={newQuestion.questionEn}
                    onChange={(e) => setNewQuestion({ ...newQuestion, questionEn: e.target.value })}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    {language === 'ar' ? 'بند ISO المرجعي' : 'ISO Clause Reference'}
                  </label>
                  <input
                    type="text"
                    value={newQuestion.clause}
                    onChange={(e) => setNewQuestion({ ...newQuestion, clause: e.target.value })}
                    placeholder="e.g., 8.5.1"
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <Button variant="outline" onClick={() => setShowQuestionModal(false)}>
                  {t('common.cancel')}
                </Button>
                <Button onClick={handleAddQuestion} disabled={!newQuestion.questionAr}>
                  {language === 'ar' ? 'إضافة' : 'Add'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Add Finding Modal */}
        {showFindingModal && selectedAudit && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowFindingModal(false)} />
            <div className="relative z-[60] w-full max-w-lg rounded-xl bg-white dark:bg-gray-900 p-6 shadow-xl mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">
                  {language === 'ar' ? 'إضافة ملاحظة جديدة' : 'Add New Finding'}
                </h2>
                <Button variant="ghost" size="icon-sm" onClick={() => setShowFindingModal(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    {language === 'ar' ? 'بند ISO المرجعي' : 'ISO Clause Reference'}
                  </label>
                  <input
                    type="text"
                    value={newFinding.clause}
                    onChange={(e) => setNewFinding({ ...newFinding, clause: e.target.value })}
                    placeholder="e.g., ISO 9001:2015 - 8.5.1"
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    {language === 'ar' ? 'وصف الملاحظة *' : 'Finding Description *'}
                  </label>
                  <textarea
                    rows={3}
                    value={newFinding.finding}
                    onChange={(e) => setNewFinding({ ...newFinding, finding: e.target.value })}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    {language === 'ar' ? 'الدليل' : 'Evidence'}
                  </label>
                  <textarea
                    rows={2}
                    value={newFinding.evidence}
                    onChange={(e) => setNewFinding({ ...newFinding, evidence: e.target.value })}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">
                      {language === 'ar' ? 'الفئة' : 'Category'}
                    </label>
                    <select
                      value={newFinding.categoryA}
                      onChange={(e) => setNewFinding({ ...newFinding, categoryA: e.target.value })}
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm"
                    >
                      <option value="">{language === 'ar' ? 'اختر' : 'Select'}</option>
                      {findingCategories.A.map(cat => (
                        <option key={cat.value} value={cat.value}>
                          {language === 'ar' ? cat.labelAr : cat.labelEn}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">
                      {language === 'ar' ? 'نوع الملاحظة *' : 'Finding Type *'}
                    </label>
                    <select
                      value={newFinding.categoryB}
                      onChange={(e) => setNewFinding({ ...newFinding, categoryB: e.target.value })}
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm"
                    >
                      <option value="">{language === 'ar' ? 'اختر' : 'Select'}</option>
                      {findingCategories.B.map(cat => (
                        <option key={cat.value} value={cat.value}>
                          {language === 'ar' ? cat.labelAr : cat.labelEn}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    {language === 'ar' ? 'تاريخ الإغلاق المتوقع' : 'Expected Closing Date'}
                  </label>
                  <input
                    type="date"
                    value={newFinding.estimatedClosingDate}
                    onChange={(e) => setNewFinding({ ...newFinding, estimatedClosingDate: e.target.value })}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <Button variant="outline" onClick={() => setShowFindingModal(false)}>
                  {t('common.cancel')}
                </Button>
                <Button onClick={handleAddFinding} disabled={!newFinding.finding || !newFinding.categoryB}>
                  {language === 'ar' ? 'إضافة' : 'Add'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* QMS Approval Modal */}
        {showApprovalModal && selectedAudit && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowApprovalModal(false)} />
            <div className="relative z-[70] w-full max-w-md rounded-xl bg-white dark:bg-gray-900 p-6 shadow-xl mx-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">
                  {language === 'ar' ? 'موافقة إدارة الجودة' : 'QMS Approval'}
                </h2>
                <Button variant="ghost" size="icon-sm" onClick={() => setShowApprovalModal(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-4">
                <div className="p-3 bg-[var(--background-tertiary)] rounded-lg">
                  <p className="text-xs text-[var(--foreground-secondary)] mb-1">{selectedAudit.number}</p>
                  <p className="text-sm">{language === 'ar' ? selectedAudit.titleAr : selectedAudit.titleEn}</p>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    {language === 'ar' ? 'التعليق' : 'Comment'}
                  </label>
                  <textarea
                    rows={3}
                    value={approvalComment}
                    onChange={(e) => setApprovalComment(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <Button
                  variant="outline"
                  className="text-red-600 border-red-600"
                  onClick={() => handleQMSApproval(false)}
                >
                  <ThumbsDown className="h-4 w-4 me-2" />
                  {language === 'ar' ? 'رفض' : 'Reject'}
                </Button>
                <Button
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => handleQMSApproval(true)}
                >
                  <ThumbsUp className="h-4 w-4 me-2" />
                  {language === 'ar' ? 'موافقة' : 'Approve'}
                </Button>
              </div>
            </div>
          </div>
        )}

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
