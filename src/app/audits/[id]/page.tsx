'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { DashboardLayout } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { Button, Badge } from '@/components/ui';
import { useTranslation } from '@/contexts/LanguageContext';
import {
  getAuditById,
  updateAudit as updateAuditInFirestore,
  addNotification,
  getAllUsers,
} from '@/lib/firestore';
import {
  ArrowRight,
  ArrowLeft,
  Save,
  Calendar,
  Users,
  Building2,
  FileQuestion,
  ClipboardCheck,
  Info,
  CheckCircle,
  AlertCircle,
  X,
  Plus,
  Shield,
  Wrench,
  FileCheck,
  Clock,
  ThumbsUp,
  ThumbsDown,
  Lightbulb,
  AlertTriangle,
  User,
  Send,
  Pause,
  Edit3,
  MessageCircle,
  History,
  Eye,
  Paperclip,
  FileText,
  Image,
  Trash2,
  Upload,
  HelpCircle,
  Award,
  Lock,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import type { QMSDecision, QMSComment, QMSModificationEntry, QMSApprovalData } from '@/types';
import { OneDrivePicker } from '@/components/ui/OneDrivePicker';
import type { OneDriveFile } from '@/lib/onedrive';
import { Cloud } from 'lucide-react';

// Type for attachments (local files or OneDrive files)
interface AttachmentFile {
  type: 'local' | 'onedrive';
  name: string;
  size?: number;
  webUrl?: string; // For OneDrive files
  id?: string; // For OneDrive files
}

// ===========================================
// Workflow stages
// ===========================================
const workflowStages = [
  {
    id: 'planning',
    stepAr: 'التخطيط وإعداد الأسئلة',
    stepEn: 'Planning & Questions',
    icon: Calendar,
    descriptionAr: 'تحديد نطاق المراجعة والفريق والتواريخ وإعداد الأسئلة',
    descriptionEn: 'Define audit scope, team, dates and prepare questions',
    instructionAr: 'في هذه المرحلة، قم بمراجعة خطة المراجعة وإضافة جميع الأسئلة التي ستطرحها أثناء المراجعة. تأكد من اكتمال الأسئلة قبل الانتقال للتنفيذ.',
    instructionEn: 'In this phase, review the audit plan and add all questions you will ask during the audit. Make sure questions are complete before moving to execution.',
    responsibleAr: 'رئيس فريق المراجعة',
    responsibleEn: 'Lead Auditor',
  },
  {
    id: 'execution',
    stepAr: 'التنفيذ',
    stepEn: 'Execution',
    icon: ClipboardCheck,
    descriptionAr: 'إجراء المراجعة وتسجيل الملاحظات',
    descriptionEn: 'Conduct audit and record findings',
    instructionAr: 'قم بتنفيذ المراجعة وفق الخطة المعدة. أجب على الأسئلة وسجل الملاحظات. أضف أي ملاحظات (عدم مطابقة، ملاحظة، فرصة تحسين).',
    instructionEn: 'Conduct the audit according to the prepared plan. Answer questions and record findings. Add any observations (non-conformity, observation, improvement opportunity).',
    responsibleAr: 'فريق المراجعة',
    responsibleEn: 'Audit Team',
  },
  {
    id: 'qms_review',
    stepAr: 'مراجعة إدارة الجودة',
    stepEn: 'QMS Review',
    icon: Shield,
    descriptionAr: 'مراجعة واعتماد نتائج المراجعة من إدارة الجودة',
    descriptionEn: 'QMS department reviews and approves audit results',
    instructionAr: 'تتم مراجعة نتائج المراجعة من قبل إدارة الجودة للتأكد من صحة الملاحظات واكتمال التوثيق.',
    instructionEn: 'Audit results are reviewed by QMS department to verify findings accuracy and documentation completeness.',
    responsibleAr: 'إدارة الجودة (QMS)',
    responsibleEn: 'QMS Department',
    requiresApproval: true,
  },
  {
    id: 'corrective_actions',
    stepAr: 'الإجراءات التصحيحية',
    stepEn: 'Corrective Actions',
    icon: Wrench,
    descriptionAr: 'تنفيذ الإجراءات التصحيحية من قبل الجهة المراجعة',
    descriptionEn: 'Auditee implements corrective actions',
    instructionAr: 'الجهة المراجعة تقوم بتنفيذ الإجراءات التصحيحية لمعالجة الملاحظات المسجلة. يجب توثيق كل إجراء مع الأدلة.',
    instructionEn: 'The auditee implements corrective actions to address recorded findings. Each action must be documented with evidence.',
    responsibleAr: 'الجهة المراجعة',
    responsibleEn: 'Auditee',
  },
  {
    id: 'verification',
    stepAr: 'التحقق والإغلاق',
    stepEn: 'Verification',
    icon: FileCheck,
    descriptionAr: 'التحقق من تنفيذ الإجراءات وإغلاق الملاحظات',
    descriptionEn: 'Verify actions implementation and close findings',
    instructionAr: 'يتم التحقق من تنفيذ الإجراءات التصحيحية وفعاليتها. بعد التأكد، يتم إغلاق الملاحظات.',
    instructionEn: 'Verify the implementation and effectiveness of corrective actions. After confirmation, findings are closed.',
    responsibleAr: 'رئيس فريق المراجعة',
    responsibleEn: 'Lead Auditor',
  },
  {
    id: 'completed',
    stepAr: 'مكتمل',
    stepEn: 'Completed',
    icon: CheckCircle,
    descriptionAr: 'المراجعة منتهية',
    descriptionEn: 'Audit completed',
    instructionAr: 'تم إكمال المراجعة بنجاح. يمكنك الآن مراجعة التقرير النهائي.',
    instructionEn: 'The audit has been completed successfully. You can now review the final report.',
    responsibleAr: 'مكتمل',
    responsibleEn: 'Completed',
  },
];

// Finding categories
const findingCategories = {
  A: [
    { value: 'quality', labelAr: 'الجودة', labelEn: 'Quality' },
    { value: 'ohsas', labelAr: 'السلامة والصحة المهنية', labelEn: 'OHSAS' },
    { value: 'environment', labelAr: 'البيئة', labelEn: 'Environment' },
  ],
  B: [
    { value: 'major_nc', labelAr: 'عدم مطابقة رئيسي', labelEn: 'Major Non-Conformity' },
    { value: 'minor_nc', labelAr: 'عدم مطابقة ثانوي', labelEn: 'Minor Non-Conformity' },
    { value: 'observation', labelAr: 'ملاحظة', labelEn: 'Observation' },
    { value: 'noteworthy', labelAr: 'جهد ملحوظ', labelEn: 'Noteworthy Effort' },
  ],
};

// Interfaces
interface AuditQuestion {
  id: string;
  questionAr: string;
  questionEn: string;
  clause: string;
  answer?: string;
  status: 'pending' | 'compliant' | 'non_compliant' | 'not_applicable';
  notes?: string;
}

interface ExtensionRequest {
  id: string;
  requestedDate: string;
  newDate: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedBy: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewComment?: string;
}

// Comment interface for discussions
interface FindingComment {
  id: string;
  findingId: string;
  userId: string;
  comment: string;
  createdAt: string;
  attachments?: AttachmentFile[];
}

// Department response to corrective action
interface DepartmentResponse {
  approvedBy: string;
  approvedAt: string;
  closingDate: string;
  comment?: string;
  attachments?: AttachmentFile[];
}

interface Finding {
  id: string;
  reportNumber: string;
  departmentId: string;
  sectionId?: string;
  focusArea?: string;
  clause: string;
  finding: string;
  evidence: string;
  categoryA: string;
  categoryB: string;
  estimatedClosingDate: string;
  rootCause?: string;
  correctiveAction?: string;
  actionEvidence?: string;
  status: 'open' | 'in_progress' | 'pending_verification' | 'closed' | 'pending_department_approval';
  createdAt: string;
  closedAt?: string;
  extensionRequests?: ExtensionRequest[];
  attachments?: AttachmentFile[];
  // New fields for department approval and discussion
  comments?: FindingComment[];
  departmentResponse?: DepartmentResponse;
  qmsApprovedCorrectiveAction?: boolean;
  qmsApprovalDate?: string;
  qmsApprovalComment?: string;
}

// Activity Log Entry for tracking all actions
interface ActivityLogEntry {
  id: string;
  type: 'audit_created' | 'audit_submitted' | 'audit_approved' | 'audit_rejected' | 'audit_postponed' |
        'modification_requested' | 'stage_changed' | 'question_added' | 'question_answered' |
        'finding_added' | 'finding_updated' | 'corrective_action_added' | 'extension_requested' |
        'extension_approved' | 'extension_rejected' | 'execution_confirmed' | 'comment_added' |
        'department_response' | 'corrective_actions_approved';
  userId: string;
  timestamp: string;
  details: {
    description?: string;
    previousValue?: string;
    newValue?: string;
    questionId?: string;
    findingId?: string;
    stageFrom?: number;
    stageTo?: number;
    comment?: string;
  };
}

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
  // الهيكل القديم للتوافق
  qmsApproval?: {
    approved: boolean;
    comment: string;
    date: string;
    approvedBy: string;
  };
  // الهيكل الجديد لمراجعة إدارة الجودة
  qmsApprovalData?: QMSApprovalData;
  createdAt: string;
  createdBy?: string;
  // Execution confirmation by lead auditor
  executionConfirmed?: boolean;
  executionConfirmedAt?: string;
  executionConfirmedBy?: string;
  // Corrective actions QMS approval
  correctiveActionsApproved?: boolean;
  correctiveActionsApprovedAt?: string;
  correctiveActionsApprovedBy?: string;
  correctiveActionsApprovalComment?: string;
  // Activity Log - سجل النشاطات
  activityLog?: ActivityLogEntry[];
}

// Get auditors from users
const auditors = allUsers.filter(u => u.canBeAuditor && u.isActive);

// Initial demo audits data (same as in main page)
const initialAudits: Audit[] = [
  {
    id: '1',
    number: 'AUD-2026-0001',
    titleAr: 'مراجعة قسم الإنتاج',
    titleEn: 'Production Department Audit',
    type: 'internal',
    departmentId: 'dept-3',
    sectionId: 'sec-5',
    status: 'execution',
    currentStage: 1,
    leadAuditorId: 'user-3',
    auditorIds: ['user-3', 'user-5'],
    startDate: '2026-01-25',
    endDate: '2026-01-30',
    scope: 'مراجعة عمليات التصنيع والجودة',
    objective: 'التحقق من الالتزام بمتطلبات ISO 9001:2015',
    questions: [
      { id: 'q1', questionAr: 'هل يتم توثيق جميع عمليات الإنتاج؟', questionEn: 'Are all production processes documented?', clause: '8.5.1', answer: 'نعم، جميع العمليات موثقة', status: 'compliant' },
      { id: 'q2', questionAr: 'هل يتم إجراء فحوصات الجودة بانتظام؟', questionEn: 'Are quality checks performed regularly?', clause: '8.6', answer: 'نعم، كل ساعتين', status: 'compliant' },
      { id: 'q3', questionAr: 'هل تم تدريب جميع الموظفين؟', questionEn: 'Are all employees trained?', clause: '7.2', status: 'pending' },
    ],
    findings: [
      {
        id: 'f1',
        reportNumber: 'FND-2026-001',
        departmentId: 'dept-3',
        sectionId: 'sec-5',
        clause: 'ISO 9001:2015 - 8.5.1',
        finding: 'عدم توثيق بعض إجراءات الصيانة الوقائية',
        evidence: 'سجلات الصيانة للفترة من يناير إلى مارس 2026',
        categoryA: 'quality',
        categoryB: 'minor_nc',
        estimatedClosingDate: '2026-02-15',
        status: 'open',
        createdAt: '2026-01-26',
      },
    ],
    createdAt: '2026-01-20',
  },
  {
    id: '2',
    number: 'AUD-2026-0002',
    titleAr: 'مراجعة الموارد البشرية',
    titleEn: 'Human Resources Audit',
    type: 'internal',
    departmentId: 'dept-1',
    status: 'planning',
    currentStage: 0,
    leadAuditorId: 'user-3',
    auditorIds: ['user-3'],
    startDate: '2026-02-01',
    endDate: '2026-02-05',
    scope: 'مراجعة عمليات التوظيف والتدريب',
    objective: 'التحقق من الالتزام بسياسات الموارد البشرية',
    questions: [],
    findings: [],
    createdAt: '2026-01-25',
  },
  {
    id: '3',
    number: 'AUD-2026-0003',
    titleAr: 'مراجعة ISO 9001 الخارجية',
    titleEn: 'ISO 9001 External Audit',
    type: 'external',
    departmentId: 'dept-2',
    status: 'planning',
    currentStage: 0,
    leadAuditorId: 'user-3',
    auditorIds: ['user-3'],
    startDate: '2026-03-15',
    endDate: '2026-03-18',
    scope: 'مراجعة نظام إدارة الجودة الشامل',
    objective: 'تجديد شهادة ISO 9001:2015',
    questions: [],
    findings: [],
    createdAt: '2026-01-15',
  },
  {
    id: '4',
    number: 'AUD-2025-0012',
    titleAr: 'مراجعة المشتريات',
    titleEn: 'Procurement Audit',
    type: 'internal',
    departmentId: 'dept-4',
    sectionId: 'sec-7',
    status: 'qms_review',
    currentStage: 2,
    leadAuditorId: 'user-5',
    auditorIds: ['user-5', 'user-3'],
    startDate: '2025-12-10',
    endDate: '2025-12-15',
    scope: 'مراجعة عمليات الشراء وتقييم الموردين',
    objective: 'التحقق من الالتزام بإجراءات الشراء',
    questions: [
      { id: 'q4', questionAr: 'هل يتم تقييم الموردين سنوياً؟', questionEn: 'Are suppliers evaluated annually?', clause: '8.4', answer: 'بعض الموردين لم يتم تقييمهم', status: 'non_compliant' },
    ],
    findings: [
      {
        id: 'f2',
        reportNumber: 'FND-2025-012',
        departmentId: 'dept-4',
        clause: 'ISO 9001:2015 - 8.4',
        finding: 'عدم إجراء تقييم دوري لبعض الموردين',
        evidence: 'قائمة الموردين النشطين',
        categoryA: 'quality',
        categoryB: 'observation',
        estimatedClosingDate: '2026-01-30',
        rootCause: 'نقص في الموارد البشرية لإجراء التقييمات',
        correctiveAction: 'توظيف مختص إضافي لتقييم الموردين',
        status: 'in_progress',
        createdAt: '2025-12-12',
      },
    ],
    createdAt: '2025-12-01',
  },
  {
    id: '5',
    number: 'AUD-2025-0011',
    titleAr: 'مراجعة المستودعات',
    titleEn: 'Warehouse Audit',
    type: 'internal',
    departmentId: 'dept-3',
    sectionId: 'sec-6',
    status: 'completed',
    currentStage: 5,
    leadAuditorId: 'user-3',
    auditorIds: ['user-3', 'user-5'],
    startDate: '2025-11-20',
    endDate: '2025-11-25',
    scope: 'مراجعة إدارة المخزون والتخزين',
    objective: 'التحقق من سلامة المخزون',
    questions: [],
    findings: [],
    qmsApproval: {
      approved: true,
      comment: 'تمت الموافقة على نتائج المراجعة',
      date: '2025-11-26',
      approvedBy: 'user-3',
    },
    createdAt: '2025-11-15',
  },
  // مراجعة على الموارد البشرية - مرحلة الإجراءات التصحيحية
  {
    id: '6',
    number: 'AUD-2025-0010',
    titleAr: 'مراجعة قسم التوظيف',
    titleEn: 'Recruitment Section Audit',
    type: 'internal',
    departmentId: 'dept-1',
    sectionId: 'sec-1',
    status: 'corrective_actions',
    currentStage: 3,
    leadAuditorId: 'user-3',
    auditorIds: ['user-3'],
    startDate: '2025-12-01',
    endDate: '2025-12-05',
    scope: 'مراجعة إجراءات التوظيف والاختيار',
    objective: 'التحقق من الالتزام بسياسات التوظيف',
    questions: [
      { id: 'q5', questionAr: 'هل يتم توثيق جميع طلبات التوظيف؟', questionEn: 'Are all recruitment requests documented?', clause: '7.1.2', answer: 'نعم', status: 'compliant' },
      { id: 'q6', questionAr: 'هل يتم إجراء مقابلات منظمة؟', questionEn: 'Are structured interviews conducted?', clause: '7.2', answer: 'لا يوجد نموذج موحد', status: 'non_compliant' },
    ],
    findings: [
      {
        id: 'f3',
        reportNumber: 'FND-2025-010',
        departmentId: 'dept-1',
        sectionId: 'sec-1',
        clause: 'ISO 9001:2015 - 7.2',
        finding: 'عدم وجود نموذج موحد للمقابلات الوظيفية',
        evidence: 'ملفات التوظيف للربع الأخير 2025',
        categoryA: 'quality',
        categoryB: 'minor_nc',
        estimatedClosingDate: '2026-02-28',
        status: 'open',
        createdAt: '2025-12-05',
      },
      {
        id: 'f4',
        reportNumber: 'FND-2025-011',
        departmentId: 'dept-1',
        sectionId: 'sec-1',
        clause: 'ISO 9001:2015 - 7.5',
        finding: 'تأخر في أرشفة بعض ملفات الموظفين الجدد',
        evidence: 'ملفات التوظيف للشهرين الأخيرين',
        categoryA: 'quality',
        categoryB: 'observation',
        estimatedClosingDate: '2026-02-15',
        status: 'open',
        createdAt: '2025-12-05',
      },
    ],
    qmsApproval: {
      approved: true,
      comment: 'تمت الموافقة على نتائج المراجعة، يرجى متابعة الإجراءات التصحيحية',
      date: '2025-12-10',
      approvedBy: 'user-3',
    },
    createdAt: '2025-11-25',
  },
  // مراجعة مكتملة على الموارد البشرية
  {
    id: '7',
    number: 'AUD-2025-0008',
    titleAr: 'مراجعة التدريب والتطوير',
    titleEn: 'Training & Development Audit',
    type: 'internal',
    departmentId: 'dept-1',
    sectionId: 'sec-2',
    status: 'completed',
    currentStage: 5,
    leadAuditorId: 'user-5',
    auditorIds: ['user-5'],
    startDate: '2025-10-15',
    endDate: '2025-10-20',
    scope: 'مراجعة برامج التدريب والتطوير',
    objective: 'التحقق من فعالية برامج التدريب',
    questions: [],
    findings: [],
    qmsApproval: {
      approved: true,
      comment: 'لا توجد ملاحظات',
      date: '2025-10-22',
      approvedBy: 'user-3',
    },
    createdAt: '2025-10-10',
  },
];

export default function AuditDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { t, language } = useTranslation();
  const { currentUser, users: allUsers, departments: allDepartments, sections: allSections } = useAuth();
  const auditId = params.id as string;

  // State
  const [audit, setAudit] = useState<Audit | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'details' | 'questions' | 'findings' | 'approval' | 'activity' | 'my_findings'>('details');

  // Modals
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [showFindingModal, setShowFindingModal] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showExtensionModal, setShowExtensionModal] = useState(false);
  const [showCorrectiveActionModal, setShowCorrectiveActionModal] = useState(false);
  const [showQMSDecisionModal, setShowQMSDecisionModal] = useState(false);
  const [showEditAuditModal, setShowEditAuditModal] = useState(false);
  const [showAuditeeResponseModal, setShowAuditeeResponseModal] = useState(false);

  // Auditee response form state
  const [auditeeResponseForm, setAuditeeResponseForm] = useState({
    comment: '',
    closingDate: '',
    attachments: [] as OneDriveFile[],
  });

  // Edit audit form state (for QMS Manager only)
  const [editAuditForm, setEditAuditForm] = useState({
    titleAr: '',
    titleEn: '',
    scope: '',
    objective: '',
    departmentId: '',
    sectionId: '',
    leadAuditorId: '',
    auditorIds: [] as string[],
    startDate: '',
    endDate: '',
  });

  // Selected finding for actions
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);

  // Selected question for answering
  const [selectedQuestion, setSelectedQuestion] = useState<AuditQuestion | null>(null);
  const [showAnswerModal, setShowAnswerModal] = useState(false);
  const [questionAnswer, setQuestionAnswer] = useState({ answer: '', status: 'pending' as 'pending' | 'compliant' | 'non_compliant' | 'not_applicable', notes: '' });

  // QMS Review states
  const [selectedDecision, setSelectedDecision] = useState<QMSDecision | null>(null);
  const [qmsComment, setQmsComment] = useState('');
  const [replyComment, setReplyComment] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);

  // Form states
  const [newQuestion, setNewQuestion] = useState({ questionAr: '', questionEn: '', clause: '' });
  const [newFinding, setNewFinding] = useState({
    departmentId: '',
    sectionId: '',
    focusArea: '',
    requirements: '',
    clause: '',
    finding: '',
    evidence: '',
    categoryA: '',
    categoryB: '',
    estimatedClosingDate: '',
    attachments: [] as AttachmentFile[], // Local or OneDrive files
  });
  const [approvalComment, setApprovalComment] = useState('');
  const [extensionRequest, setExtensionRequest] = useState({ newDate: '', reason: '' });
  const [correctiveActionForm, setCorrectiveActionForm] = useState({ rootCause: '', correctiveAction: '' });

  // Helper functions
  const getDepartment = (id: string) => allDepartments.find(d => d.id === id);
  const getSection = (id: string) => allSections.find(s => s.id === id);
  const getUser = (id: string) => allUsers.find(u => u.id === id);

  // Load audit data from Firestore
  useEffect(() => {
    const loadAudit = async () => {
      try {
        const firestoreAudit = await getAuditById(auditId);
        if (firestoreAudit) {
          // Convert Firestore audit to local Audit interface
          const convertedAudit: Audit = {
            id: firestoreAudit.id,
            number: firestoreAudit.id.replace('audit-', 'AUD-'),
            titleAr: firestoreAudit.titleAr,
            titleEn: firestoreAudit.titleEn,
            type: firestoreAudit.type,
            departmentId: firestoreAudit.departmentId,
            sectionId: firestoreAudit.sectionId,
            status: firestoreAudit.status,
            currentStage: getStageFromStatus(firestoreAudit.status),
            leadAuditorId: firestoreAudit.leadAuditorId,
            auditorIds: firestoreAudit.teamMemberIds || [],
            startDate: firestoreAudit.startDate,
            endDate: firestoreAudit.endDate,
            scope: firestoreAudit.scope || '',
            objective: firestoreAudit.objectives || '',
            questions: [],
            findings: firestoreAudit.findings || [],
            createdAt: firestoreAudit.createdAt,
            createdBy: firestoreAudit.createdBy,
            activityLog: [],
          };
          setAudit(convertedAudit);
        }
      } catch (error) {
        console.error('Error loading audit:', error);
      }
      setLoading(false);
    };
    loadAudit();
  }, [auditId]);

  // Helper to get stage from status
  const getStageFromStatus = (status: string): number => {
    const stageMap: Record<string, number> = {
      'draft': 0,
      'pending_approval': 0,
      'approved': 0,
      'planning': 0,
      'questions_preparation': 0,
      'execution': 1,
      'in_progress': 1,
      'qms_review': 2,
      'corrective_actions': 3,
      'verification': 4,
      'completed': 5,
      'cancelled': 5,
      'postponed': 0,
    };
    return stageMap[status] || 0;
  };

  // Save audit changes to Firestore
  const saveAudit = async (updatedAudit: Audit) => {
    // Update in Firestore
    await updateAuditInFirestore(auditId, {
      titleAr: updatedAudit.titleAr,
      titleEn: updatedAudit.titleEn,
      type: updatedAudit.type,
      status: updatedAudit.status as any,
      departmentId: updatedAudit.departmentId,
      sectionId: updatedAudit.sectionId,
      leadAuditorId: updatedAudit.leadAuditorId,
      teamMemberIds: updatedAudit.auditorIds,
      startDate: updatedAudit.startDate,
      endDate: updatedAudit.endDate,
      objectives: updatedAudit.objective,
      scope: updatedAudit.scope,
      findings: updatedAudit.findings,
    });
    setAudit(updatedAudit);
  };

  // Helper function to add activity log entry
  const addActivityLog = (
    auditData: Audit,
    type: ActivityLogEntry['type'],
    details: ActivityLogEntry['details']
  ): Audit => {
    const newEntry: ActivityLogEntry = {
      id: `activity-${Date.now()}`,
      type,
      userId: currentUser?.id || '',
      timestamp: new Date().toISOString(),
      details,
    };
    return {
      ...auditData,
      activityLog: [...(auditData.activityLog || []), newEntry],
    };
  };

  // Move to next stage
  const handleMoveToNextStage = () => {
    if (!audit || audit.currentStage >= workflowStages.length - 1) return;

    const fromStage = audit.currentStage;
    const toStage = audit.currentStage + 1;

    let updatedAudit = {
      ...audit,
      currentStage: toStage,
      status: workflowStages[toStage].id,
    };

    // Add activity log for stage change
    updatedAudit = addActivityLog(updatedAudit, 'stage_changed', {
      stageFrom: fromStage,
      stageTo: toStage,
      description: `تم الانتقال من "${workflowStages[fromStage].stepAr}" إلى "${workflowStages[toStage].stepAr}"`,
    });

    // If moving to QMS review stage, add submission log
    if (toStage === 2) {
      updatedAudit = addActivityLog(updatedAudit, 'audit_submitted', {
        description: 'تم إرسال المراجعة لمدير إدارة الجودة للموافقة',
      });
    }

    saveAudit(updatedAudit);
  };

  // Move to previous stage
  const handleMoveToPrevStage = () => {
    if (!audit || audit.currentStage <= 0) return;

    const fromStage = audit.currentStage;
    const toStage = audit.currentStage - 1;

    let updatedAudit = {
      ...audit,
      currentStage: toStage,
      status: workflowStages[toStage].id,
    };

    // Add activity log
    updatedAudit = addActivityLog(updatedAudit, 'stage_changed', {
      stageFrom: fromStage,
      stageTo: toStage,
      description: `تم الرجوع من "${workflowStages[fromStage].stepAr}" إلى "${workflowStages[toStage].stepAr}"`,
    });

    saveAudit(updatedAudit);
  };

  // تأكيد إتمام المراجعة من قبل رئيس الفريق
  const handleConfirmExecution = () => {
    if (!audit || audit.currentStage !== 1) return;

    const baseAudit: Audit = {
      ...audit,
      executionConfirmed: true,
      executionConfirmedAt: new Date().toISOString(),
      executionConfirmedBy: currentUser?.id,
    };

    // Add activity log
    const updatedAudit = addActivityLog(baseAudit, 'execution_confirmed', {
      description: 'تم تأكيد إتمام المراجعة على الإدارة',
    });

    saveAudit(updatedAudit);
  };

  // موافقة مدير الجودة على الإجراءات التصحيحية
  const handleApproveCorrectiveActions = (comment: string) => {
    if (!audit || audit.currentStage !== 3) return;

    const updatedAudit = {
      ...audit,
      correctiveActionsApproved: true,
      correctiveActionsApprovedAt: new Date().toISOString(),
      correctiveActionsApprovedBy: currentUser?.id,
      correctiveActionsApprovalComment: comment,
    };
    saveAudit(updatedAudit);

    // إرسال إشعار للإدارة المُراجَعة via Firestore
    const deptUsers = allUsers.filter(u => u.departmentId === audit.departmentId && u.isActive);
    deptUsers.forEach(async (user) => {
      await addNotification({
        type: 'corrective_action_response_required',
        title: language === 'ar' ? 'مطلوب استجابة للإجراءات التصحيحية' : 'Corrective Action Response Required',
        message: language === 'ar'
          ? `المراجعة ${audit.number} تحتاج استجابتكم للإجراءات التصحيحية`
          : `Audit ${audit.number} requires your response to corrective actions`,
        recipientId: user.id,
        senderId: currentUser?.id,
        auditId: audit.id,
      });
    });
  };

  // استجابة الإدارة للملاحظة
  const handleDepartmentResponse = (findingId: string, response: {
    closingDate: string;
    comment?: string;
    attachments?: AttachmentFile[];
  }) => {
    if (!audit) return;

    const updatedFindings = audit.findings.map(f => {
      if (f.id === findingId) {
        return {
          ...f,
          status: 'pending_verification' as const,
          departmentResponse: {
            approvedBy: currentUser?.id || '',
            approvedAt: new Date().toISOString(),
            closingDate: response.closingDate,
            comment: response.comment,
            attachments: response.attachments,
          },
        };
      }
      return f;
    });

    const updatedAudit = {
      ...audit,
      findings: updatedFindings,
    };
    saveAudit(updatedAudit);
  };

  // إضافة تعليق على الملاحظة
  const handleAddFindingComment = (findingId: string, comment: string, attachments?: AttachmentFile[]) => {
    if (!audit || !currentUser) return;

    const newComment: FindingComment = {
      id: `comment-${Date.now()}`,
      findingId,
      userId: currentUser.id,
      comment,
      createdAt: new Date().toISOString(),
      attachments,
    };

    const updatedFindings = audit.findings.map(f => {
      if (f.id === findingId) {
        return {
          ...f,
          comments: [...(f.comments || []), newComment],
        };
      }
      return f;
    });

    const updatedAudit = {
      ...audit,
      findings: updatedFindings,
    };
    saveAudit(updatedAudit);
  };


  // إرسال للموافقة من إدارة الجودة
  const handleSubmitForQMSApproval = () => {
    if (!audit || audit.currentStage !== 1) return; // مرحلة التنفيذ هي 1 الآن

    // التحقق من وجود أسئلة
    if (audit.questions.length === 0) {
      alert(language === 'ar'
        ? 'يجب إضافة سؤال واحد على الأقل قبل الإرسال للموافقة'
        : 'You must add at least one question before submitting for approval');
      return;
    }

    // الانتقال لمرحلة مراجعة الجودة
    const updatedAudit = {
      ...audit,
      currentStage: 2, // مرحلة مراجعة الجودة هي 2 الآن
      status: 'qms_review',
    };
    saveAudit(updatedAudit);

    // إرسال إشعار لمدير الجودة via Firestore
    const allUsersData = await getAllUsers();
    const qualityManagers = allUsersData.filter(u => u.role === 'quality_manager' && u.isActive);
    for (const qm of qualityManagers) {
      await addNotification({
        type: 'audit_approval_request',
        title: language === 'ar' ? 'طلب موافقة على مراجعة' : 'Audit Approval Request',
        message: language === 'ar'
          ? `المراجعة ${audit.number} جاهزة للمراجعة والموافقة`
          : `Audit ${audit.number} is ready for review and approval`,
        recipientId: qm.id,
        senderId: currentUser?.id,
        auditId: audit.id,
      });
    }
  };

  // Add question
  const handleAddQuestion = () => {
    if (!audit || !newQuestion.questionAr) return;

    const question: AuditQuestion = {
      id: `q-${Date.now()}`,
      questionAr: newQuestion.questionAr,
      questionEn: newQuestion.questionEn || newQuestion.questionAr,
      clause: newQuestion.clause,
      status: 'pending',
    };

    let updatedAudit = {
      ...audit,
      questions: [...audit.questions, question],
    };

    // Add activity log
    updatedAudit = addActivityLog(updatedAudit, 'question_added', {
      questionId: question.id,
      description: `تم إضافة سؤال جديد: "${newQuestion.questionAr.substring(0, 50)}${newQuestion.questionAr.length > 50 ? '...' : ''}"`,
    });

    saveAudit(updatedAudit);
    setNewQuestion({ questionAr: '', questionEn: '', clause: '' });
    setShowQuestionModal(false);
  };

  // Answer question
  const handleAnswerQuestion = () => {
    if (!audit || !selectedQuestion) return;

    const statusLabels = {
      compliant: 'مطابق',
      non_compliant: 'غير مطابق',
      not_applicable: 'غير قابل للتطبيق',
      pending: 'بانتظار الإجابة',
    };

    const updatedQuestions = audit.questions.map(q => {
      if (q.id === selectedQuestion.id) {
        return {
          ...q,
          answer: questionAnswer.answer,
          status: questionAnswer.status,
          notes: questionAnswer.notes || undefined,
        };
      }
      return q;
    });

    let updatedAudit = {
      ...audit,
      questions: updatedQuestions,
    };

    // Add activity log
    updatedAudit = addActivityLog(updatedAudit, 'question_answered', {
      questionId: selectedQuestion.id,
      description: `تم الإجابة على السؤال بـ "${statusLabels[questionAnswer.status]}"`,
      newValue: questionAnswer.status,
    });

    saveAudit(updatedAudit);
    setSelectedQuestion(null);
    setQuestionAnswer({ answer: '', status: 'pending', notes: '' });
    setShowAnswerModal(false);
  };

  // Open answer modal for a question
  const openAnswerModal = (question: AuditQuestion) => {
    setSelectedQuestion(question);
    setQuestionAnswer({
      answer: question.answer || '',
      status: question.status,
      notes: question.notes || '',
    });
    setShowAnswerModal(true);
  };

  // Add finding
  const handleAddFinding = () => {
    if (!audit || !newFinding.finding || !newFinding.categoryA || !newFinding.categoryB || !newFinding.clause || !newFinding.evidence || !newFinding.estimatedClosingDate) return;

    const finding: Finding = {
      id: `f-${Date.now()}`,
      reportNumber: `${audit.number}-F${String(audit.findings.length + 1).padStart(3, '0')}`,
      departmentId: newFinding.departmentId || audit.departmentId,
      sectionId: newFinding.sectionId || audit.sectionId,
      clause: newFinding.clause,
      finding: newFinding.finding,
      evidence: newFinding.evidence,
      categoryA: newFinding.categoryA,
      categoryB: newFinding.categoryB,
      estimatedClosingDate: newFinding.estimatedClosingDate,
      status: 'open',
      createdAt: new Date().toISOString(),
      // New fields
      focusArea: newFinding.focusArea,
      attachments: newFinding.attachments.length > 0 ? newFinding.attachments : undefined,
    };

    let updatedAudit = {
      ...audit,
      findings: [...audit.findings, finding],
    };

    // Add activity log
    const categoryBLabels: Record<string, string> = {
      major_nc: 'عدم مطابقة رئيسي',
      minor_nc: 'عدم مطابقة ثانوي',
      observation: 'ملاحظة',
      opportunity: 'فرصة تحسين',
    };
    updatedAudit = addActivityLog(updatedAudit, 'finding_added', {
      findingId: finding.id,
      description: `تم إضافة ملاحظة جديدة (${categoryBLabels[newFinding.categoryB] || newFinding.categoryB}): "${newFinding.finding.substring(0, 50)}${newFinding.finding.length > 50 ? '...' : ''}"`,
    });

    saveAudit(updatedAudit);

    // Send notification to auditee department employees
    const targetDepartmentId = newFinding.departmentId || audit.departmentId;
    const deptEmployees = allUsers.filter(u =>
      u.departmentId === targetDepartmentId && u.isActive
    );

    if (deptEmployees.length > 0) {
      const dept = allDepartments.find(d => d.id === targetDepartmentId);
      const deptName = dept?.nameAr || '';

      sendNotification({
        type: 'new_finding',
        title: `ملاحظة جديدة - ${finding.reportNumber}`,
        message: `تم تسجيل ملاحظة جديدة على إدارة ${deptName}: "${newFinding.finding.substring(0, 100)}${newFinding.finding.length > 100 ? '...' : ''}"`,
        auditId: audit.id,
        forUserIds: deptEmployees.map(e => e.id),
      });
    }
    setNewFinding({
      departmentId: '',
      sectionId: '',
      focusArea: '',
      requirements: '',
      clause: '',
      finding: '',
      evidence: '',
      categoryA: '',
      categoryB: '',
      estimatedClosingDate: '',
      attachments: [],
    });
    setShowFindingModal(false);
  };

  // Handle approval
  const handleApproval = (approved: boolean) => {
    if (!audit) return;

    const currentUser = allUsers.find(u => u.id === 'user-3'); // In real app, get from auth context

    const updatedAudit = {
      ...audit,
      qmsApproval: {
        approved,
        comment: approvalComment,
        date: new Date().toISOString().split('T')[0],
        approvedBy: currentUser?.id || '',
      },
      ...(approved && {
        currentStage: audit.currentStage + 1,
        status: workflowStages[audit.currentStage + 1].id,
      }),
    };
    saveAudit(updatedAudit);
    setApprovalComment('');
    setShowApprovalModal(false);
  };

  // Handle extension request
  const handleExtensionRequest = () => {
    if (!audit || !selectedFinding || !extensionRequest.newDate || !extensionRequest.reason) return;

    const newExtension: ExtensionRequest = {
      id: `ext-${Date.now()}`,
      requestedDate: new Date().toISOString().split('T')[0],
      newDate: extensionRequest.newDate,
      reason: extensionRequest.reason,
      status: 'pending',
      requestedBy: 'user-3', // In real app, get from auth context
    };

    const updatedFindings = audit.findings.map(f =>
      f.id === selectedFinding.id
        ? { ...f, extensionRequests: [...(f.extensionRequests || []), newExtension] }
        : f
    );

    saveAudit({ ...audit, findings: updatedFindings });
    setExtensionRequest({ newDate: '', reason: '' });
    setSelectedFinding(null);
    setShowExtensionModal(false);
  };

  // Handle extension response (approve/reject)
  const handleExtensionResponse = (findingId: string, extensionId: string, approved: boolean) => {
    if (!audit) return;

    const updatedFindings: Finding[] = audit.findings.map(f => {
      if (f.id === findingId) {
        const updatedExtensions: ExtensionRequest[] | undefined = f.extensionRequests?.map(er => {
          if (er.id === extensionId) {
            const newStatus: 'approved' | 'rejected' = approved ? 'approved' : 'rejected';
            return {
              ...er,
              status: newStatus,
              reviewedBy: 'user-3',
              reviewedAt: new Date().toISOString(),
            };
          }
          return er;
        });

        // إذا تمت الموافقة، تحديث تاريخ الإغلاق المتوقع
        const approvedExtension = updatedExtensions?.find(er => er.id === extensionId && er.status === 'approved');

        return {
          ...f,
          extensionRequests: updatedExtensions,
          ...(approvedExtension && { estimatedClosingDate: approvedExtension.newDate }),
        };
      }
      return f;
    });

    saveAudit({ ...audit, findings: updatedFindings });
  };

  // Handle corrective action
  const handleCorrectiveAction = () => {
    if (!audit || !selectedFinding || !correctiveActionForm.correctiveAction) return;

    const updatedFindings = audit.findings.map(f =>
      f.id === selectedFinding.id
        ? {
            ...f,
            rootCause: correctiveActionForm.rootCause,
            correctiveAction: correctiveActionForm.correctiveAction,
            status: 'in_progress' as const,
          }
        : f
    );

    saveAudit({ ...audit, findings: updatedFindings });
    setCorrectiveActionForm({ rootCause: '', correctiveAction: '' });
    setSelectedFinding(null);
    setShowCorrectiveActionModal(false);
  };

  // Handle verify finding
  const handleVerifyFinding = (findingId: string) => {
    if (!audit) return;

    const updatedFindings = audit.findings.map(f =>
      f.id === findingId
        ? { ...f, status: 'closed' as const, closedAt: new Date().toISOString() }
        : f
    );

    saveAudit({ ...audit, findings: updatedFindings });
  };

  // Handle auditee response to finding
  const handleAuditeeResponse = () => {
    if (!audit || !selectedFinding || !auditeeResponseForm.closingDate) return;

    const updatedFindings = audit.findings.map(f =>
      f.id === selectedFinding.id
        ? {
            ...f,
            departmentResponse: {
              approvedBy: currentUser?.id || '',
              approvedAt: new Date().toISOString(),
              closingDate: auditeeResponseForm.closingDate,
              comment: auditeeResponseForm.comment || undefined,
              attachments: auditeeResponseForm.attachments.map(file => ({
                type: 'onedrive' as const,
                name: file.name,
                size: file.size,
                webUrl: file.webUrl,
                id: file.id,
              })),
            },
            estimatedClosingDate: auditeeResponseForm.closingDate,
            status: 'in_progress' as const,
          }
        : f
    );

    // Add activity log entry
    const activityEntry: ActivityLogEntry = {
      id: `act-${Date.now()}`,
      type: 'department_response',
      userId: currentUser?.id || '',
      timestamp: new Date().toISOString(),
      details: {
        description: `تم الرد على الملاحظة ${selectedFinding.reportNumber}`,
        findingId: selectedFinding.id,
        comment: auditeeResponseForm.comment,
      },
    };

    saveAudit({
      ...audit,
      findings: updatedFindings,
      activityLog: [...(audit.activityLog || []), activityEntry],
    });

    // Reset form and close modal
    setAuditeeResponseForm({ comment: '', closingDate: '', attachments: [] });
    setSelectedFinding(null);
    setShowAuditeeResponseModal(false);
  };

  // ===========================================
  // QMS Review Functions - دوال مراجعة إدارة الجودة
  // ===========================================

  // إرسال إشعار via Firestore
  const sendNotification = async (notification: {
    type: string;
    title: string;
    message: string;
    auditId: string;
    forRole?: string;
    forUserIds?: string[];
  }) => {
    // If notification is for specific users
    if (notification.forUserIds && notification.forUserIds.length > 0) {
      for (const userId of notification.forUserIds) {
        await addNotification({
          type: notification.type as any,
          title: notification.title,
          message: notification.message,
          recipientId: userId,
          senderId: currentUser?.id,
          auditId: notification.auditId,
        });
      }
    }
    // If notification is for a role
    else if (notification.forRole) {
      const allUsersData = await getAllUsers();
      const roleUsers = allUsersData.filter(u => u.role === notification.forRole && u.isActive);
      for (const user of roleUsers) {
        await addNotification({
          type: notification.type as any,
          title: notification.title,
          message: notification.message,
          recipientId: user.id,
          senderId: currentUser?.id,
          auditId: notification.auditId,
        });
      }
    }
  };

  // معالجة قرار مدير إدارة الجودة
  const handleQMSDecision = (decision: QMSDecision | null) => {
    if (!audit || !decision) return;
    // التعليق مطلوب فقط في حالات غير الموافقة
    if (decision !== 'approved' && !qmsComment.trim()) return;

    const newHistoryEntry: QMSModificationEntry = {
      id: `mod-${Date.now()}`,
      date: new Date().toISOString(),
      modifiedBy: currentUser?.id || '',
      description: qmsComment,
      decision: decision,
      comment: qmsComment,
    };

    const newComment: QMSComment = {
      id: `comment-${Date.now()}`,
      content: qmsComment,
      authorId: currentUser?.id || '',
      createdAt: new Date().toISOString(),
      isFromQMSManager: true,
    };

    const existingApprovalData = audit.qmsApprovalData || {
      currentDecision: null,
      comments: [],
      history: [],
      lastUpdated: new Date().toISOString(),
    };

    const updatedApprovalData: QMSApprovalData = {
      currentDecision: decision,
      comments: [...existingApprovalData.comments, newComment],
      history: [...existingApprovalData.history, newHistoryEntry],
      lastUpdated: new Date().toISOString(),
    };

    let updatedAudit: Audit = {
      ...audit,
      qmsApprovalData: updatedApprovalData,
    };

    // تحديث الحالة بناءً على القرار
    if (decision === 'approved') {
      updatedAudit = {
        ...updatedAudit,
        currentStage: audit.currentStage + 1,
        status: workflowStages[audit.currentStage + 1].id,
        qmsApproval: {
          approved: true,
          comment: qmsComment,
          date: new Date().toISOString().split('T')[0],
          approvedBy: currentUser?.id || '',
        },
      };
      // إرسال إشعار للمراجعين
      sendNotification({
        type: 'audit_approved',
        title: language === 'ar' ? 'تمت الموافقة على المراجعة' : 'Audit Approved',
        message: language === 'ar'
          ? `تمت الموافقة على المراجعة ${audit.number} من قبل إدارة الجودة`
          : `Audit ${audit.number} has been approved by QMS`,
        auditId: audit.id,
        forUserIds: audit.auditorIds,
      });

      // إرسال إشعار لموظفي الإدارة المُراجَعة (المدقق عليهم) via Firestore
      const deptUsers = allUsers.filter(u => u.departmentId === audit.departmentId && u.isActive);
      for (const user of deptUsers) {
        // لا ترسل إشعار للمراجعين (فهم يعرفون بالفعل)
        if (!audit.auditorIds.includes(user.id)) {
          await addNotification({
            type: 'audit_scheduled',
            title: language === 'ar' ? 'مراجعة مجدولة على إدارتكم' : 'Audit Scheduled for Your Department',
            message: language === 'ar'
              ? `سيتم إجراء مراجعة "${audit.titleAr}" على إدارتكم بتاريخ ${audit.startDate}`
              : `Audit "${audit.titleEn}" is scheduled for your department on ${audit.startDate}`,
            recipientId: user.id,
            senderId: currentUser?.id,
            auditId: audit.id,
          });
        }
      }
    } else if (decision === 'rejected') {
      updatedAudit = {
        ...updatedAudit,
        qmsApproval: {
          approved: false,
          comment: qmsComment,
          date: new Date().toISOString().split('T')[0],
          approvedBy: currentUser?.id || '',
        },
      };
      // إرسال إشعار للمراجعين
      sendNotification({
        type: 'audit_rejected',
        title: language === 'ar' ? 'تم رفض المراجعة' : 'Audit Rejected',
        message: language === 'ar'
          ? `تم رفض المراجعة ${audit.number} من قبل إدارة الجودة`
          : `Audit ${audit.number} has been rejected by QMS`,
        auditId: audit.id,
        forUserIds: audit.auditorIds,
      });
    } else if (decision === 'postponed') {
      // إرسال إشعار للمراجعين
      sendNotification({
        type: 'audit_postponed',
        title: language === 'ar' ? 'تم تأجيل المراجعة' : 'Audit Postponed',
        message: language === 'ar'
          ? `تم تأجيل مراجعة ${audit.number} من قبل إدارة الجودة`
          : `Audit ${audit.number} has been postponed by QMS`,
        auditId: audit.id,
        forUserIds: audit.auditorIds,
      });
    } else if (decision === 'modification_requested') {
      // إرسال إشعار للمراجعين لطلب التعديل
      sendNotification({
        type: 'audit_modification_requested',
        title: language === 'ar' ? 'طلب تعديل على المراجعة' : 'Modification Requested',
        message: language === 'ar'
          ? `مدير الجودة يطلب تعديلات على المراجعة ${audit.number}`
          : `QMS Manager requests modifications on audit ${audit.number}`,
        auditId: audit.id,
        forUserIds: audit.auditorIds,
      });
    }

    // Add activity log based on decision
    const decisionLabels: Record<QMSDecision, string> = {
      approved: 'تمت الموافقة على المراجعة',
      rejected: 'تم رفض المراجعة',
      postponed: 'تم تأجيل المراجعة',
      modification_requested: 'تم طلب تعديلات على المراجعة',
    };
    const activityType = decision === 'approved' ? 'audit_approved' :
                        decision === 'rejected' ? 'audit_rejected' :
                        decision === 'postponed' ? 'audit_postponed' : 'modification_requested';

    updatedAudit = addActivityLog(updatedAudit, activityType, {
      description: decisionLabels[decision],
      comment: qmsComment || undefined,
    });

    saveAudit(updatedAudit);
    setQmsComment('');
    setSelectedDecision(null);
    setShowQMSDecisionModal(false);
  };

  // إضافة رد من المراجع
  const handleAddReply = () => {
    if (!audit || !replyComment.trim()) return;

    const newComment: QMSComment = {
      id: `comment-${Date.now()}`,
      content: replyComment,
      authorId: currentUser?.id || '',
      createdAt: new Date().toISOString(),
      isFromQMSManager: currentUser?.role === 'quality_manager',
    };

    const existingApprovalData = audit.qmsApprovalData || {
      currentDecision: null,
      comments: [],
      history: [],
      lastUpdated: new Date().toISOString(),
    };

    const updatedApprovalData: QMSApprovalData = {
      ...existingApprovalData,
      comments: [...existingApprovalData.comments, newComment],
      lastUpdated: new Date().toISOString(),
    };

    saveAudit({
      ...audit,
      qmsApprovalData: updatedApprovalData,
    });

    setReplyComment('');
  };

  // فتح modal تعديل بيانات المراجعة (لمدير الجودة فقط)
  const openEditAuditModal = () => {
    if (!audit) return;
    setEditAuditForm({
      titleAr: audit.titleAr,
      titleEn: audit.titleEn,
      scope: audit.scope || '',
      objective: audit.objective || '',
      departmentId: audit.departmentId,
      sectionId: audit.sectionId || '',
      leadAuditorId: audit.leadAuditorId,
      auditorIds: audit.auditorIds.filter(id => id !== audit.leadAuditorId),
      startDate: audit.startDate,
      endDate: audit.endDate || '',
    });
    setShowEditAuditModal(true);
  };

  // حفظ تعديلات بيانات المراجعة (لمدير الجودة فقط)
  const handleSaveAuditEdit = () => {
    if (!audit || !isQualityManager) return;

    // جمع التغييرات لتسجيلها
    const changes: string[] = [];
    if (editAuditForm.titleAr !== audit.titleAr) changes.push(`عنوان المراجعة (عربي): "${audit.titleAr}" ← "${editAuditForm.titleAr}"`);
    if (editAuditForm.titleEn !== audit.titleEn) changes.push(`Audit Title (English): "${audit.titleEn}" → "${editAuditForm.titleEn}"`);
    if (editAuditForm.scope !== (audit.scope || '')) changes.push('تم تعديل نطاق المراجعة');
    if (editAuditForm.objective !== (audit.objective || '')) changes.push('تم تعديل هدف المراجعة');
    if (editAuditForm.departmentId !== audit.departmentId) changes.push('تم تغيير الإدارة');
    if (editAuditForm.leadAuditorId !== audit.leadAuditorId) changes.push('تم تغيير رئيس الفريق');
    if (editAuditForm.startDate !== audit.startDate) changes.push(`تاريخ البدء: ${audit.startDate} ← ${editAuditForm.startDate}`);
    if (editAuditForm.endDate !== (audit.endDate || '')) changes.push(`تاريخ الانتهاء: ${audit.endDate || '-'} ← ${editAuditForm.endDate}`);

    const allAuditorIds = [editAuditForm.leadAuditorId, ...editAuditForm.auditorIds.filter(id => id !== editAuditForm.leadAuditorId)];

    let updatedAudit: Audit = {
      ...audit,
      titleAr: editAuditForm.titleAr,
      titleEn: editAuditForm.titleEn,
      scope: editAuditForm.scope,
      objective: editAuditForm.objective,
      departmentId: editAuditForm.departmentId,
      sectionId: editAuditForm.sectionId || undefined,
      leadAuditorId: editAuditForm.leadAuditorId,
      auditorIds: allAuditorIds,
      startDate: editAuditForm.startDate,
      endDate: editAuditForm.endDate,
    };

    // Add activity log if there are changes
    if (changes.length > 0) {
      updatedAudit = addActivityLog(updatedAudit, 'finding_updated', {
        description: `تم تعديل بيانات المراجعة بواسطة مدير الجودة: ${changes.join('، ')}`,
      });
    }

    saveAudit(updatedAudit);
    setShowEditAuditModal(false);
  };

  // إرسال التعديلات من المراجع
  const handleSubmitModifications = () => {
    if (!audit) return;

    const existingApprovalData = audit.qmsApprovalData || {
      currentDecision: null,
      comments: [],
      history: [],
      lastUpdated: new Date().toISOString(),
    };

    // إعادة تعيين القرار للمراجعة مرة أخرى
    const updatedApprovalData: QMSApprovalData = {
      ...existingApprovalData,
      currentDecision: null, // إعادة للمراجعة
      lastUpdated: new Date().toISOString(),
    };

    saveAudit({
      ...audit,
      qmsApprovalData: updatedApprovalData,
    });

    // إرسال إشعار لمدير الجودة
    sendNotification({
      type: 'audit_modification_submitted',
      title: language === 'ar' ? 'تم تقديم التعديلات' : 'Modifications Submitted',
      message: language === 'ar'
        ? `تم تقديم التعديلات على المراجعة ${audit.number}`
        : `Modifications submitted for audit ${audit.number}`,
      auditId: audit.id,
      forRole: 'quality_manager',
    });

    setIsEditMode(false);
  };

  // التحقق من الصلاحيات
  const canMakeQMSDecision =
    currentUser?.role === 'quality_manager' &&
    audit?.status === 'qms_review' &&
    (!audit?.qmsApprovalData?.currentDecision ||
     audit?.qmsApprovalData?.currentDecision === 'modification_requested' &&
     audit?.qmsApprovalData?.currentDecision === null);

  const canEditAudit =
    audit?.status === 'qms_review' &&
    audit?.qmsApprovalData?.currentDecision === 'modification_requested' &&
    audit?.auditorIds?.includes(currentUser?.id || '');

  const canReply =
    audit?.status === 'qms_review' &&
    (currentUser?.role === 'quality_manager' ||
     audit?.auditorIds?.includes(currentUser?.id || ''));

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary)] mx-auto"></div>
            <p className="mt-4 text-[var(--foreground-secondary)]">
              {language === 'ar' ? 'جاري التحميل...' : 'Loading...'}
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!audit) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
            <p className="mt-4 text-lg font-medium">
              {language === 'ar' ? 'المراجعة غير موجودة' : 'Audit not found'}
            </p>
            <Button className="mt-4" onClick={() => router.push('/audits')}>
              {language === 'ar' ? 'العودة للقائمة' : 'Back to List'}
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const currentStage = workflowStages[audit.currentStage];
  const StageIcon = currentStage.icon;

  // Get responsible person for current stage
  const getResponsiblePerson = () => {
    const stage = workflowStages[audit.currentStage];
    if (stage.id === 'qms_review') {
      // Find QMS manager
      const qmsManager = allUsers.find(u => u.departmentId === 'dept-2' && u.canBeAuditor);
      return qmsManager ? (language === 'ar' ? qmsManager.fullNameAr : qmsManager.fullNameEn) : (language === 'ar' ? 'مدير إدارة الجودة' : 'QMS Manager');
    }
    if (stage.id === 'corrective_actions') {
      const dept = getDepartment(audit.departmentId);
      const deptManager = allUsers.find(u => u.departmentId === audit.departmentId && u.role === 'department_manager');
      return deptManager ? (language === 'ar' ? deptManager.fullNameAr : deptManager.fullNameEn) : (dept ? (language === 'ar' ? `مدير ${dept.nameAr}` : `${dept.nameEn} Manager`) : '');
    }
    const lead = getUser(audit.leadAuditorId);
    return lead ? (language === 'ar' ? lead.fullNameAr : lead.fullNameEn) : '';
  };

  // Check if waiting for approval
  const isWaitingForApproval = currentStage.requiresApproval && !audit.qmsApproval;

  // Check if can move to previous stage
  const canMoveToPrev = audit.currentStage > 0 && audit.currentStage < workflowStages.length - 1;

  // Check if all questions are answered (not pending)
  const allQuestionsAnswered = audit.questions.length > 0 &&
    audit.questions.every(q => q.status !== 'pending');

  // Check if has findings (at least one finding added)
  const hasFindings = audit.findings.length > 0;

  // Check if execution is confirmed by lead auditor
  const isExecutionConfirmed = audit.executionConfirmed === true;

  // Check if corrective actions are approved by QMS
  const areCorrectiveActionsApproved = audit.correctiveActionsApproved === true;

  // Check if all findings have department response
  const allFindingsHaveDepartmentResponse = audit.findings.length > 0 &&
    audit.findings.every(f => f.departmentResponse);

  // Check if user is lead auditor
  const isLeadAuditor = currentUser?.id === audit.leadAuditorId;

  // Check if user is quality manager
  const isQualityManager = currentUser?.role === 'quality_manager';

  // Check if user is from the audited department
  const isFromAuditedDepartment = currentUser?.departmentId === audit.departmentId;

  // Check if user is an auditor on this audit
  const isAuditor = audit.auditorIds.includes(currentUser?.id || '');

  // Users who can see full audit details: QMS Manager, Lead Auditor, or Auditors
  const canSeeFullDetails = isQualityManager || isLeadAuditor || isAuditor;

  // Users from audited department who are not auditors can only see limited info
  const isAuditeeOnly = isFromAuditedDepartment && !canSeeFullDetails;

  // Check if user is both an auditor AND from the audited department (dual role)
  const hasAuditeeFindings = audit.findings.filter(f => f.departmentId === currentUser?.departmentId).length > 0;
  const isDualRole = isAuditor && isFromAuditedDepartment;

  // Check requirements for moving between stages
  // Stage 0: planning
  // Stage 1: execution - تأكيد المراجعة + الإجابة على الأسئلة
  // Stage 2: qms_review - موافقة مدير الجودة
  // Stage 3: corrective_actions - موافقة مدير الجودة على الإجراءات + استجابة الإدارة
  // Stage 4: verification
  // Stage 5: completed

  // Check if can move to next stage
  const canMoveToNext = (() => {
    // Basic checks
    if (audit.currentStage >= workflowStages.length - 1) return false;
    if (isWaitingForApproval) return false;

    // Stage 1 (execution) -> Stage 2 (qms_review)
    // Requires: execution confirmed AND all questions answered
    if (audit.currentStage === 1) {
      return isExecutionConfirmed && allQuestionsAnswered;
    }

    // Stage 3 (corrective_actions) -> Stage 4 (verification)
    // Requires: corrective actions approved by QMS AND all findings have department response
    if (audit.currentStage === 3) {
      return areCorrectiveActionsApproved && (audit.findings.length === 0 || allFindingsHaveDepartmentResponse);
    }

    return true;
  })();

  // Reason why can't move to next stage
  const cantMoveReason = (() => {
    // Stage 1 (execution)
    if (audit.currentStage === 1) {
      if (!isExecutionConfirmed && !allQuestionsAnswered) {
        return language === 'ar'
          ? 'يجب تأكيد إتمام المراجعة والإجابة على جميع الأسئلة قبل الانتقال للمرحلة التالية'
          : 'You must confirm the audit completion and answer all questions before moving to the next stage';
      }
      if (!isExecutionConfirmed) {
        return language === 'ar'
          ? 'يجب تأكيد إتمام المراجعة على الإدارة قبل الانتقال للمرحلة التالية'
          : 'You must confirm the audit execution before moving to the next stage';
      }
      if (!allQuestionsAnswered) {
        return language === 'ar'
          ? 'يجب الإجابة على جميع الأسئلة قبل الانتقال للمرحلة التالية'
          : 'All questions must be answered before moving to the next stage';
      }
    }

    // Stage 3 (corrective_actions)
    if (audit.currentStage === 3) {
      if (!areCorrectiveActionsApproved) {
        return language === 'ar'
          ? 'يجب موافقة مدير إدارة الجودة على الإجراءات التصحيحية قبل الانتقال للمرحلة التالية'
          : 'QMS manager must approve the corrective actions before moving to the next stage';
      }
      if (audit.findings.length > 0 && !allFindingsHaveDepartmentResponse) {
        return language === 'ar'
          ? 'يجب أن تستجيب الإدارة المُراجَعة لجميع الملاحظات قبل الانتقال للمرحلة التالية'
          : 'The audited department must respond to all findings before moving to the next stage';
      }
    }

    return '';
  })();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">
                {language === 'ar' ? audit.titleAr : audit.titleEn}
              </h1>
              <Badge variant="outline">{audit.number}</Badge>
            </div>
            <p className="text-[var(--foreground-secondary)] mt-1">
              {getDepartment(audit.departmentId)?.[language === 'ar' ? 'nameAr' : 'nameEn']}
              {audit.sectionId && ` - ${getSection(audit.sectionId)?.[language === 'ar' ? 'nameAr' : 'nameEn']}`}
            </p>
          </div>
          <Button variant="outline" onClick={() => router.push('/audits')}>
            {language === 'ar' ? 'العودة للقائمة' : 'Back to List'}
          </Button>
        </div>

        {/* Progress Steps */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between overflow-x-auto pb-2">
              {workflowStages.map((stage, idx) => {
                const Icon = stage.icon;
                const isCompleted = idx < audit.currentStage;
                const isCurrent = idx === audit.currentStage;

                return (
                  <div key={stage.id} className="flex items-center flex-shrink-0">
                    <div className="flex flex-col items-center">
                      <div className={`flex items-center justify-center w-12 h-12 rounded-full transition-colors ${
                        isCompleted
                          ? 'bg-green-500 text-white'
                          : isCurrent
                            ? 'bg-[var(--primary)] text-white'
                            : 'bg-[var(--background-secondary)] text-[var(--foreground-secondary)]'
                      }`}>
                        {isCompleted ? <CheckCircle className="h-6 w-6" /> : <Icon className="h-6 w-6" />}
                      </div>
                      <p className={`text-xs mt-2 text-center max-w-[80px] ${
                        isCurrent ? 'font-semibold text-[var(--primary)]' : 'text-[var(--foreground-secondary)]'
                      }`}>
                        {language === 'ar' ? stage.stepAr : stage.stepEn}
                      </p>
                    </div>
                    {idx < workflowStages.length - 1 && (
                      <div className={`w-12 h-1 mx-2 rounded-full ${
                        isCompleted ? 'bg-green-500' : 'bg-[var(--background-secondary)]'
                      }`} />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Current Stage Instructions */}
        <Card className={`border-2 ${isWaitingForApproval ? 'border-yellow-500' : 'border-[var(--primary)]'}`}>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className={`flex-shrink-0 p-3 rounded-full ${isWaitingForApproval ? 'bg-yellow-100 dark:bg-yellow-900/30' : 'bg-[var(--primary)]/10'}`}>
                {isWaitingForApproval ? (
                  <Clock className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                ) : (
                  <StageIcon className="h-6 w-6 text-[var(--primary)]" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold text-lg">
                    {language === 'ar' ? currentStage.stepAr : currentStage.stepEn}
                  </h3>
                  {isWaitingForApproval && (
                    <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200">
                      {language === 'ar' ? 'بانتظار الموافقة' : 'Waiting for Approval'}
                    </Badge>
                  )}
                </div>

                <p className="text-[var(--foreground-secondary)] mb-4">
                  {language === 'ar' ? currentStage.instructionAr : currentStage.instructionEn}
                </p>

                {/* Responsible Person */}
                <div className={`flex items-center gap-2 p-3 rounded-lg ${isWaitingForApproval ? 'bg-yellow-50 dark:bg-yellow-900/20' : 'bg-[var(--background-secondary)]'}`}>
                  <User className={`h-5 w-5 ${isWaitingForApproval ? 'text-yellow-600' : 'text-[var(--primary)]'}`} />
                  <span className="text-sm">
                    {isWaitingForApproval ? (
                      <>
                        <span className="font-medium">
                          {language === 'ar' ? 'بانتظار موافقة: ' : 'Waiting for approval from: '}
                        </span>
                        <span className="text-yellow-700 dark:text-yellow-300 font-semibold">
                          {getResponsiblePerson()}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="font-medium">
                          {language === 'ar' ? 'المسؤول: ' : 'Responsible: '}
                        </span>
                        <span className="text-[var(--primary)]">
                          {getResponsiblePerson()}
                        </span>
                      </>
                    )}
                  </span>
                </div>

                {/* Tips */}
                {!isWaitingForApproval && audit.currentStage < workflowStages.length - 1 && (
                  <div className="mt-4 flex items-center gap-2 text-sm text-[var(--foreground-secondary)]">
                    <Lightbulb className="h-4 w-4 text-yellow-500" />
                    <span>
                      {language === 'ar'
                        ? 'نصيحة: تأكد من إكمال جميع المتطلبات قبل الانتقال للمرحلة التالية'
                        : 'Tip: Make sure to complete all requirements before moving to the next stage'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-[var(--border)] overflow-x-auto">
          {(isAuditeeOnly
            ? [
                // الموظف المدقق عليه يرى التفاصيل فقط، والملاحظات فقط إذا كان لديه ملاحظات
                { id: 'details', labelAr: 'التفاصيل', labelEn: 'Details' },
                ...(hasAuditeeFindings ? [{ id: 'findings', labelAr: 'الملاحظات', labelEn: 'Findings', count: audit.findings.filter(f => f.departmentId === currentUser?.departmentId).length }] : []),
              ]
            : isDualRole
              ? [
                  // المستخدم مراجع ومراجع عليه - يرى كل شيء مع تبويب خاص للملاحظات عليه
                  { id: 'details', labelAr: 'التفاصيل', labelEn: 'Details' },
                  { id: 'questions', labelAr: 'الأسئلة', labelEn: 'Questions', count: audit.questions.length },
                  { id: 'findings', labelAr: 'الملاحظات (كمراجع)', labelEn: 'Findings (As Auditor)', count: audit.findings.length },
                  ...(hasAuditeeFindings ? [{ id: 'my_findings', labelAr: 'الملاحظات عليّ', labelEn: 'My Findings', count: audit.findings.filter(f => f.departmentId === currentUser?.departmentId).length }] : []),
                  { id: 'approval', labelAr: 'الموافقات', labelEn: 'Approvals' },
                  { id: 'activity', labelAr: 'سجل النشاطات', labelEn: 'Activity Log', count: audit.activityLog?.length || 0 },
                ]
              : [
                  // المراجعون ومدير الجودة يرون كل التبويبات
                  { id: 'details', labelAr: 'التفاصيل', labelEn: 'Details' },
                  { id: 'questions', labelAr: 'الأسئلة', labelEn: 'Questions', count: audit.questions.length },
                  { id: 'findings', labelAr: 'الملاحظات', labelEn: 'Findings', count: audit.findings.length },
                  { id: 'approval', labelAr: 'الموافقات', labelEn: 'Approvals' },
                  { id: 'activity', labelAr: 'سجل النشاطات', labelEn: 'Activity Log', count: audit.activityLog?.length || 0 },
                ]
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-[var(--primary)] text-[var(--primary)]'
                  : 'border-transparent text-[var(--foreground-secondary)] hover:text-[var(--foreground)]'
              }`}
            >
              {language === 'ar' ? tab.labelAr : tab.labelEn}
              {tab.count !== undefined && (
                <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-[var(--background-secondary)]">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <Card>
          <CardContent className="p-6">
            {/* Details Tab */}
            {activeTab === 'details' && (
              <div className="space-y-8">
                {/* عرض خاص للموظف المدقق عليه - يرى فقط موعد المراجعة وفريق المراجعة */}
                {isAuditeeOnly ? (
                  <>
                    <div className="text-center py-4">
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-900/30 mb-4">
                        <ClipboardCheck className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <h3 className="text-xl font-semibold mb-2">
                        {language === 'ar' ? 'مراجعة مجدولة على إدارتكم' : 'Audit Scheduled for Your Department'}
                      </h3>
                      <p className="text-[var(--foreground-secondary)]">
                        {language === 'ar'
                          ? 'سيتم إجراء مراجعة على إدارتكم. يرجى الاستعداد والتعاون مع فريق المراجعة.'
                          : 'An audit will be conducted on your department. Please prepare and cooperate with the audit team.'}
                      </p>
                    </div>

                    {/* الجدول الزمني */}
                    <div className="p-4 rounded-lg border border-[var(--border)] bg-[var(--background-secondary)]/50">
                      <h4 className="font-medium text-[var(--primary)] mb-4 flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        {language === 'ar' ? 'موعد المراجعة' : 'Audit Schedule'}
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 rounded-lg bg-[var(--background)] text-center">
                          <p className="text-xs text-[var(--foreground-secondary)] mb-1">{language === 'ar' ? 'تاريخ البدء' : 'Start Date'}</p>
                          <p className="text-2xl font-bold text-[var(--primary)]">{audit.startDate || '-'}</p>
                        </div>
                        <div className="p-4 rounded-lg bg-[var(--background)] text-center">
                          <p className="text-xs text-[var(--foreground-secondary)] mb-1">{language === 'ar' ? 'تاريخ الانتهاء' : 'End Date'}</p>
                          <p className="text-2xl font-bold text-[var(--primary)]">{audit.endDate || audit.startDate || '-'}</p>
                        </div>
                      </div>
                    </div>

                    {/* فريق المراجعة */}
                    <div className="p-4 rounded-lg border border-[var(--border)] bg-[var(--background-secondary)]/50">
                      <h4 className="font-medium text-[var(--primary)] mb-4 flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        {language === 'ar' ? 'فريق المراجعة' : 'Audit Team'}
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {[...new Set(audit.auditorIds)].map((id, idx) => {
                          const auditor = getUser(id);
                          const isLead = id === audit.leadAuditorId;
                          return auditor ? (
                            <div key={`auditee-auditor-${id}-${idx}`} className={`flex items-center gap-3 p-3 rounded-lg ${
                              isLead ? 'bg-[var(--primary)]/10 border border-[var(--primary)]/30' : 'bg-[var(--background)]'
                            }`}>
                              <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium ${
                                isLead ? 'bg-[var(--primary)] text-white' : 'bg-[var(--background-secondary)] text-[var(--foreground)]'
                              }`}>
                                {(language === 'ar' ? auditor.fullNameAr : auditor.fullNameEn).charAt(0)}
                              </div>
                              <div className="flex-1">
                                <p className="font-medium">{language === 'ar' ? auditor.fullNameAr : auditor.fullNameEn}</p>
                                <p className="text-xs text-[var(--foreground-secondary)]">
                                  {isLead ? (language === 'ar' ? 'رئيس فريق المراجعة' : 'Lead Auditor') : (language === 'ar' ? 'عضو فريق المراجعة' : 'Audit Team Member')}
                                </p>
                              </div>
                              {isLead && (
                                <span className="px-2 py-1 text-xs rounded-full bg-[var(--primary)] text-white">
                                  {language === 'ar' ? 'رئيس الفريق' : 'Lead'}
                                </span>
                              )}
                            </div>
                          ) : null;
                        })}
                      </div>
                    </div>

                    {/* ملاحظة للموظف */}
                    <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                      <div className="flex items-start gap-3 text-amber-700 dark:text-amber-300">
                        <Lightbulb className="h-5 w-5 flex-shrink-0 mt-0.5" />
                        <div className="text-sm">
                          <p className="font-medium mb-1">
                            {language === 'ar' ? 'تعليمات مهمة' : 'Important Instructions'}
                          </p>
                          <ul className="space-y-1 list-disc list-inside">
                            <li>{language === 'ar' ? 'يرجى تجهيز جميع الوثائق والسجلات المطلوبة' : 'Please prepare all required documents and records'}</li>
                            <li>{language === 'ar' ? 'كن متواجداً في موعد المراجعة' : 'Be available at the scheduled audit time'}</li>
                            <li>{language === 'ar' ? 'تعاون مع فريق المراجعة وأجب على استفساراتهم' : 'Cooperate with the audit team and answer their questions'}</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Header with Edit Button for QMS Manager */}
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold flex items-center gap-2">
                        <Info className="h-5 w-5 text-[var(--primary)]" />
                        {language === 'ar' ? 'تفاصيل المراجعة' : 'Audit Details'}
                      </h3>
                      {isQualityManager && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={openEditAuditModal}
                          className="flex items-center gap-2"
                        >
                          <Edit3 className="h-4 w-4" />
                          {language === 'ar' ? 'تعديل البيانات' : 'Edit Details'}
                        </Button>
                      )}
                    </div>

                    {/* تنبيه للمستخدمين غير مدير الجودة */}
                    {!isQualityManager && (
                      <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                        <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 text-sm">
                          <Lock className="h-4 w-4" />
                          {language === 'ar'
                            ? 'هذه البيانات مقفلة ولا يمكن تعديلها إلا بواسطة مدير إدارة الجودة'
                            : 'This data is locked and can only be edited by the QMS Manager'}
                        </div>
                      </div>
                    )}

                {/* الخطوة 1: معلومات المراجعة الأساسية */}
                <div className="p-4 rounded-lg border border-[var(--border)] bg-[var(--background-secondary)]/50">
                  <h4 className="font-medium text-[var(--primary)] mb-4 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-[var(--primary)] text-white text-xs flex items-center justify-center">1</span>
                    {language === 'ar' ? 'معلومات المراجعة الأساسية' : 'Basic Audit Information'}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-3 rounded-lg bg-[var(--background)]">
                      <p className="text-xs text-[var(--foreground-secondary)] mb-1">{language === 'ar' ? 'عنوان المراجعة (عربي)' : 'Audit Title (Arabic)'}</p>
                      <p className="font-medium">{audit.titleAr || '-'}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-[var(--background)]">
                      <p className="text-xs text-[var(--foreground-secondary)] mb-1">{language === 'ar' ? 'عنوان المراجعة (إنجليزي)' : 'Audit Title (English)'}</p>
                      <p className="font-medium">{audit.titleEn || '-'}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-[var(--background)]">
                      <p className="text-xs text-[var(--foreground-secondary)] mb-1">{language === 'ar' ? 'نوع المراجعة' : 'Audit Type'}</p>
                      <p className="font-medium">
                        {audit.type === 'internal' && (language === 'ar' ? 'داخلي' : 'Internal')}
                        {audit.type === 'external' && (language === 'ar' ? 'خارجي' : 'External')}
                        {audit.type === 'surveillance' && (language === 'ar' ? 'مراقبة' : 'Surveillance')}
                        {audit.type === 'certification' && (language === 'ar' ? 'شهادة' : 'Certification')}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-[var(--background)]">
                      <p className="text-xs text-[var(--foreground-secondary)] mb-1">{language === 'ar' ? 'رقم المراجعة' : 'Audit Number'}</p>
                      <p className="font-medium">{audit.number}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-[var(--background)] md:col-span-2">
                      <p className="text-xs text-[var(--foreground-secondary)] mb-1">{language === 'ar' ? 'نطاق المراجعة' : 'Audit Scope'}</p>
                      <p className="text-sm">{audit.scope || '-'}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-[var(--background)] md:col-span-2">
                      <p className="text-xs text-[var(--foreground-secondary)] mb-1">{language === 'ar' ? 'هدف المراجعة' : 'Audit Objective'}</p>
                      <p className="text-sm">{audit.objective || '-'}</p>
                    </div>
                  </div>
                </div>

                {/* الخطوة 2: الإدارة وفريق المراجعة */}
                <div className="p-4 rounded-lg border border-[var(--border)] bg-[var(--background-secondary)]/50">
                  <h4 className="font-medium text-[var(--primary)] mb-4 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-[var(--primary)] text-white text-xs flex items-center justify-center">2</span>
                    {language === 'ar' ? 'الإدارة وفريق المراجعة' : 'Department & Audit Team'}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* الإدارة */}
                    <div>
                      <div className="p-3 rounded-lg bg-[var(--background)] mb-3">
                        <p className="text-xs text-[var(--foreground-secondary)] mb-1">{language === 'ar' ? 'الإدارة' : 'Department'}</p>
                        <p className="font-medium flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-[var(--primary)]" />
                          {getDepartment(audit.departmentId)?.[language === 'ar' ? 'nameAr' : 'nameEn'] || '-'}
                        </p>
                      </div>
                      {audit.sectionId && (
                        <div className="p-3 rounded-lg bg-[var(--background)]">
                          <p className="text-xs text-[var(--foreground-secondary)] mb-1">{language === 'ar' ? 'القسم' : 'Section'}</p>
                          <p className="font-medium">
                            {getSection(audit.sectionId)?.[language === 'ar' ? 'nameAr' : 'nameEn'] || '-'}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* فريق المراجعة */}
                    <div>
                      <p className="text-xs text-[var(--foreground-secondary)] mb-2 flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {language === 'ar' ? 'فريق المراجعة' : 'Audit Team'}
                      </p>
                      <div className="space-y-2">
                        {[...new Set(audit.auditorIds)].map((id, idx) => {
                          const auditor = getUser(id);
                          const isLead = id === audit.leadAuditorId;
                          return auditor ? (
                            <div key={`auditor-${id}-${idx}`} className={`flex items-center gap-3 p-3 rounded-lg ${
                              isLead ? 'bg-[var(--primary)]/10 border border-[var(--primary)]/30' : 'bg-[var(--background)]'
                            }`}>
                              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium ${
                                isLead ? 'bg-[var(--primary)] text-white' : 'bg-[var(--background-secondary)] text-[var(--foreground)]'
                              }`}>
                                {(language === 'ar' ? auditor.fullNameAr : auditor.fullNameEn).charAt(0)}
                              </div>
                              <div className="flex-1">
                                <p className="font-medium text-sm">{language === 'ar' ? auditor.fullNameAr : auditor.fullNameEn}</p>
                                <p className="text-xs text-[var(--foreground-secondary)]">
                                  {isLead ? (language === 'ar' ? 'رئيس الفريق' : 'Lead Auditor') : (language === 'ar' ? 'عضو' : 'Member')}
                                </p>
                              </div>
                              {isLead && (
                                <span className="px-2 py-0.5 text-xs rounded-full bg-[var(--primary)] text-white">
                                  {language === 'ar' ? 'المسؤول' : 'Lead'}
                                </span>
                              )}
                            </div>
                          ) : null;
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* الخطوة 3: الجدول الزمني */}
                <div className="p-4 rounded-lg border border-[var(--border)] bg-[var(--background-secondary)]/50">
                  <h4 className="font-medium text-[var(--primary)] mb-4 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-[var(--primary)] text-white text-xs flex items-center justify-center">3</span>
                    {language === 'ar' ? 'الجدول الزمني' : 'Timeline'}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-3 rounded-lg bg-[var(--background)]">
                      <p className="text-xs text-[var(--foreground-secondary)] mb-1 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {language === 'ar' ? 'تاريخ البدء' : 'Start Date'}
                      </p>
                      <p className="font-medium">{audit.startDate || '-'}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-[var(--background)]">
                      <p className="text-xs text-[var(--foreground-secondary)] mb-1 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {language === 'ar' ? 'تاريخ الانتهاء' : 'End Date'}
                      </p>
                      <p className="font-medium">{audit.endDate || '-'}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-[var(--background)]">
                      <p className="text-xs text-[var(--foreground-secondary)] mb-1 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {language === 'ar' ? 'مدة المراجعة' : 'Duration'}
                      </p>
                      <p className="font-medium">
                        {audit.startDate && audit.endDate
                          ? (() => {
                              const days = Math.ceil((new Date(audit.endDate).getTime() - new Date(audit.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1;
                              return days === 1
                                ? (language === 'ar' ? 'يوم واحد' : '1 day')
                                : (language === 'ar' ? `${days} أيام` : `${days} days`);
                            })()
                          : '-'}
                      </p>
                    </div>
                  </div>
                  {/* ملاحظة */}
                  <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                    <div className="flex items-start gap-2 text-amber-700 dark:text-amber-300 text-xs">
                      <Lightbulb className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      <div>
                        <p>{language === 'ar' ? 'التدقيق يستغرق عادةً يوم واحد' : 'Audit typically takes one day'}</p>
                        <p>{language === 'ar' ? 'الإجراءات التصحيحية يحدد المدقق موعداً لها وقد يُمدد عند الحاجة' : 'Corrective actions deadline is set by auditor and may be extended if needed'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* معلومات الإنشاء */}
                <div className="p-4 rounded-lg border border-dashed border-[var(--border)] bg-[var(--background)]">
                  <div className="flex items-center justify-between text-sm text-[var(--foreground-secondary)]">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <span>{language === 'ar' ? 'تم الإنشاء بواسطة:' : 'Created by:'}</span>
                      <span className="font-medium text-[var(--foreground)]">
                        {audit.createdBy ? (
                          getUser(audit.createdBy)?.[language === 'ar' ? 'fullNameAr' : 'fullNameEn'] || '-'
                        ) : '-'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span>{language === 'ar' ? 'تاريخ الإنشاء:' : 'Created on:'}</span>
                      <span className="font-medium text-[var(--foreground)]">
                        {audit.createdAt ? new Date(audit.createdAt).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US') : '-'}
                      </span>
                    </div>
                  </div>
                </div>
                  </>
                )}
              </div>
            )}

            {/* Questions Tab - تبويب الأسئلة */}
            {activeTab === 'questions' && (
              <div className="space-y-6">
                {/* تعليمات المرحلة */}
                <div className={`p-4 rounded-lg border ${
                  audit.currentStage === 0 ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' :
                  audit.currentStage === 1 ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' :
                  'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700'
                }`}>
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-full ${
                      audit.currentStage === 0 ? 'bg-blue-100 dark:bg-blue-800' :
                      audit.currentStage === 1 ? 'bg-green-100 dark:bg-green-800' :
                      'bg-gray-100 dark:bg-gray-700'
                    }`}>
                      <FileQuestion className={`h-5 w-5 ${
                        audit.currentStage === 0 ? 'text-blue-600 dark:text-blue-400' :
                        audit.currentStage === 1 ? 'text-green-600 dark:text-green-400' :
                        'text-gray-600 dark:text-gray-400'
                      }`} />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium mb-1">
                        {audit.currentStage === 0 ? (
                          language === 'ar' ? 'مرحلة التخطيط وإعداد الأسئلة' : 'Planning & Questions Preparation Phase'
                        ) : audit.currentStage === 1 ? (
                          language === 'ar' ? 'مرحلة التنفيذ - الإجابة على الأسئلة' : 'Execution Phase - Answer Questions'
                        ) : audit.currentStage === 2 ? (
                          language === 'ar' ? 'قيد مراجعة إدارة الجودة' : 'Under QMS Review'
                        ) : (
                          language === 'ar' ? 'الأسئلة مكتملة' : 'Questions Completed'
                        )}
                      </h4>
                      <p className="text-sm text-[var(--foreground-secondary)]">
                        {audit.currentStage === 0 ? (
                          language === 'ar'
                            ? 'قم بإضافة جميع الأسئلة التي سيتم طرحها أثناء المراجعة. تأكد من تغطية جميع البنود المطلوب مراجعتها قبل الانتقال لمرحلة التنفيذ.'
                            : 'Add all questions to be asked during the audit. Make sure to cover all items to be audited before moving to the execution phase.'
                        ) : audit.currentStage === 1 ? (
                          language === 'ar'
                            ? 'قم بالإجابة على كل سؤال وتحديد حالة المطابقة. يمكنك إضافة ملاحظات إذا لزم الأمر.'
                            : 'Answer each question and set the compliance status. You can add findings if necessary.'
                        ) : audit.currentStage === 2 ? (
                          language === 'ar'
                            ? 'الأسئلة قيد المراجعة من إدارة الجودة. انتظر الموافقة أو التعديلات المطلوبة.'
                            : 'Questions are under QMS review. Wait for approval or requested modifications.'
                        ) : (
                          language === 'ar' ? 'تمت مراجعة الأسئلة بنجاح.' : 'Questions have been reviewed successfully.'
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                {/* شريط التقدم والإحصائيات */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 rounded-lg bg-[var(--background-secondary)] text-center">
                    <p className="text-2xl font-bold text-[var(--primary)]">{audit.questions.length}</p>
                    <p className="text-xs text-[var(--foreground-secondary)]">
                      {language === 'ar' ? 'إجمالي الأسئلة' : 'Total Questions'}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 text-center">
                    <p className="text-2xl font-bold text-green-600">{audit.questions.filter(q => q.status === 'compliant').length}</p>
                    <p className="text-xs text-green-700 dark:text-green-400">
                      {language === 'ar' ? 'مطابق' : 'Compliant'}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 text-center">
                    <p className="text-2xl font-bold text-red-600">{audit.questions.filter(q => q.status === 'non_compliant').length}</p>
                    <p className="text-xs text-red-700 dark:text-red-400">
                      {language === 'ar' ? 'غير مطابق' : 'Non-Compliant'}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 text-center">
                    <p className="text-2xl font-bold text-yellow-600">{audit.questions.filter(q => q.status === 'pending').length}</p>
                    <p className="text-xs text-yellow-700 dark:text-yellow-400">
                      {language === 'ar' ? 'بانتظار الإجابة' : 'Pending'}
                    </p>
                  </div>
                </div>

                {/* عنوان القائمة وزر الإضافة */}
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold flex items-center gap-2">
                    <ClipboardCheck className="h-5 w-5 text-[var(--primary)]" />
                    {language === 'ar' ? 'قائمة الأسئلة' : 'Questions List'}
                  </h3>
                  {(audit.currentStage === 0 || audit.currentStage === 1 ||
                    (audit.currentStage === 2 && audit.qmsApprovalData?.currentDecision === 'modification_requested' &&
                     audit.auditorIds.includes(currentUser?.id || ''))) && (
                    <Button size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowQuestionModal(true)}>
                      {language === 'ar' ? 'إضافة سؤال' : 'Add Question'}
                    </Button>
                  )}
                </div>

                {audit.questions.length > 0 ? (
                  <div className="space-y-3">
                    {audit.questions.map((q, idx) => (
                      <div key={q.id} className={`p-4 rounded-lg border transition-all ${
                        q.status === 'compliant' ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10' :
                        q.status === 'non_compliant' ? 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10' :
                        'border-[var(--border)] hover:border-[var(--primary)]/50'
                      }`}>
                        <div className="flex items-start gap-3">
                          <span className={`flex-shrink-0 w-8 h-8 rounded-full text-white text-sm flex items-center justify-center font-medium ${
                            q.status === 'compliant' ? 'bg-green-500' :
                            q.status === 'non_compliant' ? 'bg-red-500' :
                            'bg-[var(--primary)]'
                          }`}>
                            {idx + 1}
                          </span>
                          <div className="flex-1">
                            <p className="font-medium">{language === 'ar' ? q.questionAr : q.questionEn}</p>
                            {q.clause && (
                              <p className="text-xs text-[var(--foreground-secondary)] mt-1 flex items-center gap-1">
                                <Shield className="h-3 w-3" />
                                {language === 'ar' ? 'البند: ' : 'Clause: '}{q.clause}
                              </p>
                            )}
                            {q.answer && (
                              <div className="mt-2 p-2 rounded bg-[var(--background-secondary)] text-sm">
                                <span className="font-medium text-[var(--foreground-secondary)]">
                                  {language === 'ar' ? 'الإجابة: ' : 'Answer: '}
                                </span>
                                {q.answer}
                              </div>
                            )}
                            {q.notes && (
                              <div className="mt-1 text-xs text-[var(--foreground-secondary)] italic">
                                {language === 'ar' ? 'ملاحظات: ' : 'Notes: '}{q.notes}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={
                              q.status === 'compliant' ? 'success' :
                              q.status === 'non_compliant' ? 'danger' :
                              q.status === 'not_applicable' ? 'secondary' : 'warning'
                            }>
                              {q.status === 'pending' && (language === 'ar' ? 'بانتظار الإجابة' : 'Pending')}
                              {q.status === 'compliant' && (language === 'ar' ? 'مطابق' : 'Compliant')}
                              {q.status === 'non_compliant' && (language === 'ar' ? 'غير مطابق' : 'Non-Compliant')}
                              {q.status === 'not_applicable' && (language === 'ar' ? 'غير قابل للتطبيق' : 'N/A')}
                            </Badge>
                            {/* زر الإجابة - يظهر في مرحلة التنفيذ للمراجعين */}
                            {audit.currentStage === 1 && (isLeadAuditor || audit.auditorIds.includes(currentUser?.id || '')) && (
                              <Button
                                size="sm"
                                variant={q.status === 'pending' ? 'primary' : 'outline'}
                                onClick={() => openAnswerModal(q)}
                                className="whitespace-nowrap"
                              >
                                {q.status === 'pending'
                                  ? (language === 'ar' ? 'إجابة' : 'Answer')
                                  : (language === 'ar' ? 'تعديل' : 'Edit')
                                }
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-[var(--foreground-secondary)] border-2 border-dashed border-[var(--border)] rounded-lg">
                    <FileQuestion className="h-16 w-16 mx-auto mb-4 opacity-30" />
                    <p className="text-lg font-medium mb-2">
                      {language === 'ar' ? 'لم يتم إضافة أسئلة بعد' : 'No questions added yet'}
                    </p>
                    <p className="text-sm mb-4 max-w-md mx-auto">
                      {language === 'ar'
                        ? 'ابدأ بإضافة الأسئلة التي ستطرحها أثناء المراجعة. تأكد من تغطية جميع البنود المطلوبة.'
                        : 'Start adding questions you will ask during the audit. Make sure to cover all required items.'}
                    </p>
                    {(audit.currentStage === 0 || audit.currentStage === 1) && (
                      <Button onClick={() => setShowQuestionModal(true)} leftIcon={<Plus className="h-4 w-4" />}>
                        {language === 'ar' ? 'إضافة أول سؤال' : 'Add First Question'}
                      </Button>
                    )}
                  </div>
                )}

                {/* تنبيه قبل الانتقال للمرحلة التالية */}
                {audit.currentStage === 0 && audit.questions.length > 0 && (
                  <div className="mt-6 p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                    <div className="flex items-start gap-3">
                      <Lightbulb className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-amber-800 dark:text-amber-200">
                          {language === 'ar' ? 'ملاحظة مهمة' : 'Important Note'}
                        </p>
                        <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                          {language === 'ar'
                            ? 'تأكد من إضافة جميع الأسئلة المطلوبة قبل الانتقال لمرحلة التنفيذ. يمكنك إضافة المزيد من الأسئلة لاحقاً أثناء التنفيذ.'
                            : 'Make sure to add all required questions before moving to the execution phase. You can add more questions later during execution.'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* تأكيد إتمام المراجعة - يظهر في مرحلة التنفيذ لرئيس الفريق */}
                {audit.currentStage === 1 && (isLeadAuditor || isQualityManager) && !audit.executionConfirmed && (
                  <div className="mt-6 p-6 rounded-lg bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-800">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-800">
                          <CheckCircle className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <p className="font-semibold text-blue-800 dark:text-blue-200">
                            {language === 'ar' ? 'تأكيد إتمام المراجعة' : 'Confirm Audit Completion'}
                          </p>
                          <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                            {language === 'ar'
                              ? 'قم بتأكيد إتمام المراجعة على الإدارة قبل استكمال الإجابات على الأسئلة.'
                              : 'Confirm that the audit on the department has been completed before filling in the answers.'}
                          </p>
                        </div>
                      </div>
                      <Button
                        onClick={handleConfirmExecution}
                        className="bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap"
                        leftIcon={<CheckCircle className="h-4 w-4" />}
                      >
                        {language === 'ar' ? 'تأكيد إتمام المراجعة' : 'Confirm Completion'}
                      </Button>
                    </div>
                  </div>
                )}

                {/* رسالة تأكيد إتمام المراجعة */}
                {audit.currentStage === 1 && audit.executionConfirmed && (
                  <div className="mt-6 p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                      <div>
                        <p className="font-medium text-green-800 dark:text-green-200">
                          {language === 'ar' ? 'تم تأكيد إتمام المراجعة' : 'Audit Completion Confirmed'}
                        </p>
                        <p className="text-sm text-green-700 dark:text-green-300">
                          {language === 'ar'
                            ? `تم التأكيد في ${new Date(audit.executionConfirmedAt || '').toLocaleDateString('ar-SA')}`
                            : `Confirmed on ${new Date(audit.executionConfirmedAt || '').toLocaleDateString('en-US')}`}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* زر إرسال للموافقة - يظهر في مرحلة التنفيذ بعد تأكيد الإتمام وإكمال الأسئلة */}
                {audit.currentStage === 1 && audit.questions.length > 0 && audit.executionConfirmed && allQuestionsAnswered && (
                  <div className="mt-6 p-6 rounded-lg bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 border border-green-200 dark:border-green-800">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-full bg-green-100 dark:bg-green-800">
                          <Send className="h-6 w-6 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                          <p className="font-semibold text-green-800 dark:text-green-200">
                            {language === 'ar' ? 'جاهز للإرسال' : 'Ready to Submit'}
                          </p>
                          <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                            {language === 'ar'
                              ? 'تم تأكيد إتمام المراجعة والإجابة على جميع الأسئلة. يمكنك الآن إرسال المراجعة لمدير إدارة الجودة.'
                              : 'Audit completion confirmed and all questions answered. You can now submit to QMS Manager.'}
                          </p>
                          <div className="flex items-center gap-4 mt-2 text-sm">
                            <span className="flex items-center gap-1 text-green-600">
                              <CheckCircle className="h-4 w-4" />
                              {audit.questions.filter(q => q.status !== 'pending').length}/{audit.questions.length} {language === 'ar' ? 'سؤال مُجاب' : 'answered'}
                            </span>
                            <span className="flex items-center gap-1 text-[var(--foreground-secondary)]">
                              <AlertTriangle className="h-4 w-4" />
                              {audit.findings.length} {language === 'ar' ? 'ملاحظة' : 'findings'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Button
                        onClick={handleSubmitForQMSApproval}
                        className="bg-green-600 hover:bg-green-700 text-white whitespace-nowrap"
                        leftIcon={<Send className="h-4 w-4" />}
                      >
                        {language === 'ar' ? 'إرسال للموافقة' : 'Submit for Approval'}
                      </Button>
                    </div>
                  </div>
                )}

                {/* تنبيه بضرورة إكمال الأسئلة */}
                {audit.currentStage === 1 && audit.executionConfirmed && !allQuestionsAnswered && audit.questions.length > 0 && (
                  <div className="mt-6 p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                      <div>
                        <p className="font-medium text-amber-800 dark:text-amber-200">
                          {language === 'ar' ? 'يجب إكمال الإجابات' : 'Complete Answers Required'}
                        </p>
                        <p className="text-sm text-amber-700 dark:text-amber-300">
                          {language === 'ar'
                            ? `يجب الإجابة على جميع الأسئلة قبل الإرسال للموافقة. متبقي ${audit.questions.filter(q => q.status === 'pending').length} سؤال.`
                            : `All questions must be answered before submitting. ${audit.questions.filter(q => q.status === 'pending').length} questions remaining.`}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Findings Tab - تبويب الملاحظات */}
            {activeTab === 'findings' && (
              <div className="space-y-6">
                {/* عرض خاص للمراجع عليهم */}
                {isAuditeeOnly ? (
                  <>
                    {/* تعليمات للمراجع عليهم */}
                    <div className="p-4 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-full bg-indigo-100 dark:bg-indigo-800">
                          <ClipboardCheck className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium mb-1">
                            {language === 'ar' ? 'الملاحظات المسجلة على إدارتكم' : 'Findings Recorded for Your Department'}
                          </h4>
                          <p className="text-sm text-[var(--foreground-secondary)]">
                            {language === 'ar'
                              ? 'هذه الملاحظات تم تسجيلها أثناء المراجعة. يمكنك الرد على كل ملاحظة، إرفاق المستندات اللازمة، وطلب تمديد الموعد إذا لزم الأمر.'
                              : 'These findings were recorded during the audit. You can respond to each finding, attach necessary documents, and request an extension if needed.'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* إحصائيات الملاحظات للمراجع عليهم */}
                    {(() => {
                      const myFindings = audit.findings.filter(f => f.departmentId === currentUser?.departmentId);
                      return (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="p-4 rounded-lg bg-[var(--background-secondary)] text-center">
                            <p className="text-2xl font-bold text-[var(--primary)]">{myFindings.length}</p>
                            <p className="text-xs text-[var(--foreground-secondary)]">
                              {language === 'ar' ? 'إجمالي الملاحظات' : 'Total Findings'}
                            </p>
                          </div>
                          <div className="p-4 rounded-lg bg-orange-50 dark:bg-orange-900/20 text-center">
                            <p className="text-2xl font-bold text-orange-600">
                              {myFindings.filter(f => f.status === 'open' || f.status === 'in_progress').length}
                            </p>
                            <p className="text-xs text-orange-700 dark:text-orange-400">
                              {language === 'ar' ? 'تحتاج إجراء' : 'Need Action'}
                            </p>
                          </div>
                          <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-center">
                            <p className="text-2xl font-bold text-blue-600">
                              {myFindings.filter(f => f.status === 'pending_verification').length}
                            </p>
                            <p className="text-xs text-blue-700 dark:text-blue-400">
                              {language === 'ar' ? 'بانتظار التحقق' : 'Pending Verification'}
                            </p>
                          </div>
                          <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 text-center">
                            <p className="text-2xl font-bold text-green-600">
                              {myFindings.filter(f => f.status === 'closed').length}
                            </p>
                            <p className="text-xs text-green-700 dark:text-green-400">
                              {language === 'ar' ? 'مغلقة' : 'Closed'}
                            </p>
                          </div>
                        </div>
                      );
                    })()}

                    {/* عنوان القائمة */}
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold flex items-center gap-2">
                        <AlertCircle className="h-5 w-5 text-[var(--primary)]" />
                        {language === 'ar' ? 'قائمة الملاحظات' : 'Findings List'}
                      </h3>
                    </div>

                    {/* قائمة الملاحظات للمراجع عليهم */}
                    {(() => {
                      const myFindings = audit.findings.filter(f => f.departmentId === currentUser?.departmentId);

                      if (myFindings.length === 0) {
                        return (
                          <div className="text-center py-12 text-[var(--foreground-secondary)] border-2 border-dashed border-[var(--border)] rounded-lg">
                            <CheckCircle className="h-16 w-16 mx-auto mb-4 opacity-30 text-green-500" />
                            <p className="text-lg font-medium mb-2 text-green-700 dark:text-green-400">
                              {language === 'ar' ? 'لا توجد ملاحظات على إدارتكم' : 'No Findings for Your Department'}
                            </p>
                            <p className="text-sm max-w-md mx-auto">
                              {language === 'ar'
                                ? 'المراجعة لم تسجل أي ملاحظات على إدارتكم. استمروا في الأداء المتميز!'
                                : 'The audit has not recorded any findings for your department. Keep up the excellent work!'}
                            </p>
                          </div>
                        );
                      }

                      return (
                        <div className="space-y-4">
                          {myFindings.map((finding) => {
                            const isOverdue = finding.status !== 'closed' && new Date(finding.estimatedClosingDate) < new Date();
                            const hasPendingExtension = finding.extensionRequests?.some(er => er.status === 'pending');

                            return (
                              <div key={finding.id} className={`p-4 rounded-lg border ${
                                isOverdue ? 'border-red-300 bg-red-50/50 dark:bg-red-900/10' : 'border-[var(--border)]'
                              }`}>
                                {/* رأس الملاحظة */}
                                <div className="flex items-start justify-between mb-3">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-medium text-[var(--primary)]">{finding.reportNumber}</span>
                                    <Badge variant={
                                      finding.categoryB === 'major_nc' ? 'danger' :
                                      finding.categoryB === 'minor_nc' ? 'warning' :
                                      finding.categoryB === 'observation' ? 'secondary' : 'success'
                                    }>
                                      {findingCategories.B.find(c => c.value === finding.categoryB)?.[language === 'ar' ? 'labelAr' : 'labelEn']}
                                    </Badge>
                                    {isOverdue && !hasPendingExtension && (
                                      <Badge variant="danger">
                                        <AlertTriangle className="h-3 w-3 mr-1" />
                                        {language === 'ar' ? 'متأخر' : 'Overdue'}
                                      </Badge>
                                    )}
                                    {hasPendingExtension && (
                                      <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                        <Clock className="h-3 w-3 mr-1" />
                                        {language === 'ar' ? 'طلب تمديد قيد المراجعة' : 'Extension Pending'}
                                      </Badge>
                                    )}
                                  </div>
                                  <Badge variant={
                                    finding.status === 'closed' ? 'success' :
                                    finding.status === 'pending_verification' ? 'warning' : 'secondary'
                                  }>
                                    {finding.status === 'open' && (language === 'ar' ? 'مفتوح' : 'Open')}
                                    {finding.status === 'in_progress' && (language === 'ar' ? 'قيد التنفيذ' : 'In Progress')}
                                    {finding.status === 'pending_verification' && (language === 'ar' ? 'بانتظار التحقق' : 'Pending Verification')}
                                    {finding.status === 'closed' && (language === 'ar' ? 'مغلق' : 'Closed')}
                                  </Badge>
                                </div>

                                {/* نص الملاحظة */}
                                <div className="p-3 rounded-lg bg-[var(--background-secondary)] mb-3">
                                  <p className="text-sm font-medium mb-1">{language === 'ar' ? 'الملاحظة:' : 'Finding:'}</p>
                                  <p className="text-sm">{finding.finding}</p>
                                </div>

                                {/* الدليل */}
                                {finding.evidence && (
                                  <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 mb-3">
                                    <p className="text-sm font-medium mb-1 text-amber-800 dark:text-amber-200">{language === 'ar' ? 'الدليل:' : 'Evidence:'}</p>
                                    <p className="text-sm text-amber-700 dark:text-amber-300">{finding.evidence}</p>
                                  </div>
                                )}

                                {/* معلومات إضافية */}
                                <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--foreground-secondary)] mb-3">
                                  {finding.clause && (
                                    <span className="flex items-center gap-1">
                                      <FileText className="h-3 w-3" />
                                      {language === 'ar' ? 'البند: ' : 'Clause: '}{finding.clause}
                                    </span>
                                  )}
                                  <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-600 font-medium' : ''}`}>
                                    <Calendar className="h-3 w-3" />
                                    {language === 'ar' ? 'موعد الإغلاق: ' : 'Due: '}{finding.estimatedClosingDate}
                                  </span>
                                </div>

                                {/* عرض الإجراء التصحيحي إذا وجد */}
                                {finding.correctiveAction && (
                                  <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 mb-3">
                                    <p className="text-sm font-medium mb-1 text-green-800 dark:text-green-200">
                                      {language === 'ar' ? 'الإجراء التصحيحي المقترح:' : 'Proposed Corrective Action:'}
                                    </p>
                                    <p className="text-sm text-green-700 dark:text-green-300">{finding.correctiveAction}</p>
                                    {finding.rootCause && (
                                      <>
                                        <p className="text-sm font-medium mt-2 mb-1 text-green-800 dark:text-green-200">
                                          {language === 'ar' ? 'السبب الجذري:' : 'Root Cause:'}
                                        </p>
                                        <p className="text-sm text-green-700 dark:text-green-300">{finding.rootCause}</p>
                                      </>
                                    )}
                                  </div>
                                )}

                                {/* عرض رد الإدارة إذا وجد */}
                                {finding.departmentResponse && (
                                  <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 mb-3">
                                    <p className="text-sm font-medium mb-1 text-blue-800 dark:text-blue-200">
                                      {language === 'ar' ? 'ردكم السابق:' : 'Your Previous Response:'}
                                    </p>
                                    {finding.departmentResponse.comment && (
                                      <p className="text-sm text-blue-700 dark:text-blue-300 mb-2">{finding.departmentResponse.comment}</p>
                                    )}
                                    <p className="text-xs text-blue-600 dark:text-blue-400">
                                      {language === 'ar' ? 'تاريخ الإغلاق المحدد: ' : 'Set Closing Date: '}{finding.departmentResponse.closingDate}
                                    </p>
                                    {finding.departmentResponse.attachments && finding.departmentResponse.attachments.length > 0 && (
                                      <div className="mt-2">
                                        <p className="text-xs font-medium text-blue-800 dark:text-blue-200 mb-1">
                                          {language === 'ar' ? 'المرفقات:' : 'Attachments:'}
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                          {finding.departmentResponse.attachments.map((att, idx) => (
                                            <a
                                              key={idx}
                                              href={att.webUrl}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="flex items-center gap-1 px-2 py-1 rounded bg-blue-100 dark:bg-blue-800 text-xs text-blue-700 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-700"
                                            >
                                              <Cloud className="h-3 w-3" />
                                              {att.name}
                                            </a>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* عرض طلبات التمديد */}
                                {finding.extensionRequests && finding.extensionRequests.length > 0 && (
                                  <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 mb-3">
                                    <p className="text-sm font-medium mb-2">{language === 'ar' ? 'طلبات التمديد:' : 'Extension Requests:'}</p>
                                    <div className="space-y-2">
                                      {finding.extensionRequests.map((er) => (
                                        <div key={er.id} className={`p-2 rounded-lg text-xs ${
                                          er.status === 'pending' ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200' :
                                          er.status === 'approved' ? 'bg-green-50 dark:bg-green-900/20 border border-green-200' :
                                          'bg-red-50 dark:bg-red-900/20 border border-red-200'
                                        }`}>
                                          <div className="flex items-center justify-between mb-1">
                                            <span>
                                              {language === 'ar' ? 'الموعد الجديد المطلوب: ' : 'Requested New Date: '}
                                              <strong>{er.newDate}</strong>
                                            </span>
                                            <Badge variant={
                                              er.status === 'pending' ? 'warning' :
                                              er.status === 'approved' ? 'success' : 'danger'
                                            } className="text-xs">
                                              {er.status === 'pending' && (language === 'ar' ? 'قيد المراجعة' : 'Pending')}
                                              {er.status === 'approved' && (language === 'ar' ? 'موافق' : 'Approved')}
                                              {er.status === 'rejected' && (language === 'ar' ? 'مرفوض' : 'Rejected')}
                                            </Badge>
                                          </div>
                                          <p className="text-[var(--foreground-secondary)]">{er.reason}</p>
                                          {er.reviewComment && (
                                            <p className="mt-1 text-xs italic">
                                              {language === 'ar' ? 'تعليق المراجع: ' : 'Reviewer Comment: '}{er.reviewComment}
                                            </p>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* أزرار الإجراءات للمراجع عليهم */}
                                {finding.status !== 'closed' && audit.currentStage >= 3 && (
                                  <div className="flex flex-wrap gap-2 pt-3 border-t border-[var(--border)]">
                                    {/* زر الرد على الملاحظة */}
                                    <Button
                                      size="sm"
                                      onClick={() => {
                                        setSelectedFinding(finding);
                                        setShowAuditeeResponseModal(true);
                                      }}
                                    >
                                      <MessageCircle className="h-3 w-3 mx-1" />
                                      {language === 'ar' ? 'الرد على الملاحظة' : 'Respond to Finding'}
                                    </Button>

                                    {/* زر طلب تمديد */}
                                    {!hasPendingExtension && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          setSelectedFinding(finding);
                                          setShowExtensionModal(true);
                                        }}
                                      >
                                        <Clock className="h-3 w-3 mx-1" />
                                        {language === 'ar' ? 'طلب تمديد' : 'Request Extension'}
                                      </Button>
                                    )}
                                  </div>
                                )}

                                {/* رسالة إذا كانت الملاحظة مغلقة */}
                                {finding.status === 'closed' && (
                                  <div className="pt-3 border-t border-[var(--border)]">
                                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm">
                                      <CheckCircle className="h-4 w-4" />
                                      {language === 'ar' ? 'تم إغلاق هذه الملاحظة بنجاح' : 'This finding has been closed successfully'}
                                      {finding.closedAt && (
                                        <span className="text-xs text-[var(--foreground-secondary)]">
                                          ({finding.closedAt})
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </>
                ) : (
                  <>
                    {/* تعليمات المرحلة - للمراجعين */}
                    <div className={`p-4 rounded-lg border ${
                      audit.currentStage === 1 ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800' :
                      audit.currentStage >= 2 ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' :
                      'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700'
                    }`}>
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-full ${
                          audit.currentStage === 1 ? 'bg-orange-100 dark:bg-orange-800' :
                          audit.currentStage >= 2 ? 'bg-blue-100 dark:bg-blue-800' :
                          'bg-gray-100 dark:bg-gray-700'
                        }`}>
                          <AlertTriangle className={`h-5 w-5 ${
                            audit.currentStage === 1 ? 'text-orange-600 dark:text-orange-400' :
                            audit.currentStage >= 2 ? 'text-blue-600 dark:text-blue-400' :
                            'text-gray-600 dark:text-gray-400'
                          }`} />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium mb-1">
                            {audit.currentStage === 1 ? (
                              language === 'ar' ? 'مرحلة التنفيذ - تسجيل الملاحظات' : 'Execution Phase - Record Findings'
                            ) : audit.currentStage === 2 ? (
                              language === 'ar' ? 'الملاحظات قيد مراجعة إدارة الجودة' : 'Findings Under QMS Review'
                            ) : audit.currentStage >= 3 ? (
                              language === 'ar' ? 'مرحلة الإجراءات التصحيحية' : 'Corrective Actions Phase'
                            ) : (
                              language === 'ar' ? 'الملاحظات' : 'Findings'
                            )}
                          </h4>
                          <p className="text-sm text-[var(--foreground-secondary)]">
                            {audit.currentStage === 1 ? (
                              language === 'ar'
                                ? 'سجل أي ملاحظات أو عدم مطابقات تجدها أثناء المراجعة. حدد نوع الملاحظة ودرجة خطورتها.'
                                : 'Record any findings or non-conformities you discover during the audit. Specify the type and severity.'
                            ) : audit.currentStage === 2 ? (
                              language === 'ar'
                                ? 'الملاحظات قيد المراجعة من إدارة الجودة للتأكد من صحتها واكتمال التوثيق.'
                                : 'Findings are under QMS review to verify accuracy and documentation completeness.'
                            ) : audit.currentStage >= 3 ? (
                              language === 'ar'
                                ? 'يجب على الجهة المراجعة تنفيذ الإجراءات التصحيحية لكل ملاحظة قبل تاريخ الإغلاق المحدد.'
                                : 'The auditee must implement corrective actions for each finding before the due date.'
                            ) : (
                              language === 'ar' ? 'عرض الملاحظات المسجلة.' : 'View recorded findings.'
                            )}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* إحصائيات الملاحظات */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-4 rounded-lg bg-[var(--background-secondary)] text-center">
                        <p className="text-2xl font-bold text-[var(--primary)]">{audit.findings.length}</p>
                        <p className="text-xs text-[var(--foreground-secondary)]">
                          {language === 'ar' ? 'إجمالي الملاحظات' : 'Total Findings'}
                        </p>
                      </div>
                      <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 text-center">
                        <p className="text-2xl font-bold text-red-600">
                          {audit.findings.filter(f => f.categoryB === 'major_nc').length}
                        </p>
                        <p className="text-xs text-red-700 dark:text-red-400">
                          {language === 'ar' ? 'عدم مطابقة رئيسي' : 'Major NC'}
                        </p>
                      </div>
                      <div className="p-4 rounded-lg bg-orange-50 dark:bg-orange-900/20 text-center">
                        <p className="text-2xl font-bold text-orange-600">
                          {audit.findings.filter(f => f.categoryB === 'minor_nc').length}
                        </p>
                        <p className="text-xs text-orange-700 dark:text-orange-400">
                          {language === 'ar' ? 'عدم مطابقة ثانوي' : 'Minor NC'}
                        </p>
                      </div>
                      <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 text-center">
                        <p className="text-2xl font-bold text-green-600">
                          {audit.findings.filter(f => f.status === 'closed').length}
                        </p>
                        <p className="text-xs text-green-700 dark:text-green-400">
                          {language === 'ar' ? 'مغلقة' : 'Closed'}
                        </p>
                      </div>
                    </div>

                    {/* عنوان القائمة وزر الإضافة */}
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold flex items-center gap-2">
                        <AlertCircle className="h-5 w-5 text-[var(--primary)]" />
                        {language === 'ar' ? 'قائمة الملاحظات' : 'Findings List'}
                      </h3>
                      {audit.currentStage >= 1 && audit.currentStage < 5 && (
                        <Button size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowFindingModal(true)}>
                          {language === 'ar' ? 'إضافة ملاحظة' : 'Add Finding'}
                        </Button>
                      )}
                    </div>
                  </>
                )}

                {audit.findings.length > 0 ? (
                  <div className="space-y-4">
                    {audit.findings.map((finding) => {
                      // التحقق من تجاوز الموعد
                      const isOverdue = finding.status !== 'closed' &&
                        new Date(finding.estimatedClosingDate) < new Date();
                      const hasPendingExtension = finding.extensionRequests?.some(
                        er => er.status === 'pending'
                      );

                      return (
                        <div key={finding.id} className={`p-4 rounded-lg border ${
                          isOverdue ? 'border-red-300 bg-red-50/50 dark:bg-red-900/10' : 'border-[var(--border)]'
                        }`}>
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-[var(--primary)]">{finding.reportNumber}</span>
                              <Badge variant={
                                finding.categoryB === 'major_nc' ? 'danger' :
                                finding.categoryB === 'minor_nc' ? 'warning' :
                                finding.categoryB === 'observation' ? 'secondary' : 'success'
                              }>
                                {findingCategories.B.find(c => c.value === finding.categoryB)?.[language === 'ar' ? 'labelAr' : 'labelEn']}
                              </Badge>
                              {isOverdue && !hasPendingExtension && (
                                <Badge variant="danger">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  {language === 'ar' ? 'متأخر' : 'Overdue'}
                                </Badge>
                              )}
                              {hasPendingExtension && (
                                <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                  <Clock className="h-3 w-3 mr-1" />
                                  {language === 'ar' ? 'طلب تمديد' : 'Extension Requested'}
                                </Badge>
                              )}
                            </div>
                            <Badge variant={
                              finding.status === 'closed' ? 'success' :
                              finding.status === 'pending_verification' ? 'warning' : 'secondary'
                            }>
                              {finding.status === 'open' && (language === 'ar' ? 'مفتوح' : 'Open')}
                              {finding.status === 'in_progress' && (language === 'ar' ? 'قيد التنفيذ' : 'In Progress')}
                              {finding.status === 'pending_verification' && (language === 'ar' ? 'بانتظار التحقق' : 'Pending Verification')}
                              {finding.status === 'closed' && (language === 'ar' ? 'مغلق' : 'Closed')}
                            </Badge>
                          </div>

                          <p className="text-sm mb-3">{finding.finding}</p>

                          <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--foreground-secondary)] mb-3">
                            {finding.clause && (
                              <span>
                                {language === 'ar' ? 'البند: ' : 'Clause: '}{finding.clause}
                              </span>
                            )}
                            <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-600 font-medium' : ''}`}>
                              <Calendar className="h-3 w-3" />
                              {language === 'ar' ? 'موعد الإغلاق: ' : 'Due: '}
                              {finding.estimatedClosingDate}
                            </span>
                          </div>

                          {/* أزرار الإجراءات */}
                          {finding.status !== 'closed' && audit.currentStage >= 3 && (
                            <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-[var(--border)]">
                              {/* زر طلب تمديد (للجهة المراجعة) */}
                              {!hasPendingExtension && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedFinding(finding);
                                    setShowExtensionModal(true);
                                  }}
                                >
                                  <Clock className="h-3 w-3 mx-1" />
                                  {language === 'ar' ? 'طلب تمديد' : 'Request Extension'}
                                </Button>
                              )}

                              {/* زر إضافة إجراء تصحيحي */}
                              {finding.status === 'open' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedFinding(finding);
                                    setShowCorrectiveActionModal(true);
                                  }}
                                >
                                  <Wrench className="h-3 w-3 mx-1" />
                                  {language === 'ar' ? 'إضافة إجراء تصحيحي' : 'Add Corrective Action'}
                                </Button>
                              )}

                              {/* زر التحقق (للمدقق) */}
                              {finding.status === 'in_progress' && audit.currentStage === 4 && (
                                <Button
                                  size="sm"
                                  onClick={() => handleVerifyFinding(finding.id)}
                                >
                                  <CheckCircle className="h-3 w-3 mx-1" />
                                  {language === 'ar' ? 'تحقق وإغلاق' : 'Verify & Close'}
                                </Button>
                              )}
                            </div>
                          )}

                          {/* عرض الإجراء التصحيحي إذا وجد */}
                          {finding.correctiveAction && (
                            <div className="mt-3 pt-3 border-t border-[var(--border)]">
                              <p className="text-xs font-medium text-[var(--foreground-secondary)] mb-1">
                                {language === 'ar' ? 'الإجراء التصحيحي:' : 'Corrective Action:'}
                              </p>
                              <p className="text-sm">{finding.correctiveAction}</p>
                              {finding.rootCause && (
                                <>
                                  <p className="text-xs font-medium text-[var(--foreground-secondary)] mt-2 mb-1">
                                    {language === 'ar' ? 'السبب الجذري:' : 'Root Cause:'}
                                  </p>
                                  <p className="text-sm">{finding.rootCause}</p>
                                </>
                              )}
                            </div>
                          )}

                          {/* عرض طلبات التمديد */}
                          {finding.extensionRequests && finding.extensionRequests.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-[var(--border)]">
                              <p className="text-xs font-medium text-[var(--foreground-secondary)] mb-2">
                                {language === 'ar' ? 'طلبات التمديد:' : 'Extension Requests:'}
                              </p>
                              <div className="space-y-2">
                                {finding.extensionRequests.map((er) => (
                                  <div key={er.id} className={`p-2 rounded-lg text-xs ${
                                    er.status === 'pending' ? 'bg-blue-50 dark:bg-blue-900/20' :
                                    er.status === 'approved' ? 'bg-green-50 dark:bg-green-900/20' :
                                    'bg-red-50 dark:bg-red-900/20'
                                  }`}>
                                    <div className="flex items-center justify-between mb-1">
                                      <span>
                                        {language === 'ar' ? 'الموعد الجديد: ' : 'New Date: '}
                                        <strong>{er.newDate}</strong>
                                      </span>
                                      <Badge variant={
                                        er.status === 'pending' ? 'warning' :
                                        er.status === 'approved' ? 'success' : 'danger'
                                      } className="text-xs">
                                        {er.status === 'pending' && (language === 'ar' ? 'قيد المراجعة' : 'Pending')}
                                        {er.status === 'approved' && (language === 'ar' ? 'موافق' : 'Approved')}
                                        {er.status === 'rejected' && (language === 'ar' ? 'مرفوض' : 'Rejected')}
                                      </Badge>
                                    </div>
                                    <p className="text-[var(--foreground-secondary)]">{er.reason}</p>

                                    {/* أزرار الموافقة/الرفض للمدقق */}
                                    {er.status === 'pending' && audit.currentStage >= 3 && (
                                      <div className="flex gap-2 mt-2">
                                        <Button
                                          size="sm"
                                          className="bg-green-600 hover:bg-green-700 text-xs py-1 px-2 h-auto"
                                          onClick={() => handleExtensionResponse(finding.id, er.id, true)}
                                        >
                                          {language === 'ar' ? 'موافقة' : 'Approve'}
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="border-red-500 text-red-500 text-xs py-1 px-2 h-auto"
                                          onClick={() => handleExtensionResponse(finding.id, er.id, false)}
                                        >
                                          {language === 'ar' ? 'رفض' : 'Reject'}
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12 text-[var(--foreground-secondary)] border-2 border-dashed border-[var(--border)] rounded-lg">
                    <CheckCircle className="h-16 w-16 mx-auto mb-4 opacity-30 text-green-500" />
                    <p className="text-lg font-medium mb-2 text-green-700 dark:text-green-400">
                      {language === 'ar' ? 'لا توجد ملاحظات' : 'No Findings'}
                    </p>
                    <p className="text-sm max-w-md mx-auto">
                      {language === 'ar'
                        ? 'هذا يعني أن المراجعة لم تجد أي عدم مطابقات أو ملاحظات تحتاج لإجراءات تصحيحية.'
                        : 'This means the audit found no non-conformities or observations requiring corrective actions.'}
                    </p>
                    {audit.currentStage >= 2 && audit.currentStage < 6 && (
                      <Button className="mt-4" variant="outline" onClick={() => setShowFindingModal(true)} leftIcon={<Plus className="h-4 w-4" />}>
                        {language === 'ar' ? 'إضافة ملاحظة' : 'Add Finding'}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* My Findings Tab - تبويب الملاحظات عليّ (للمستخدم ذو الدور المزدوج) */}
            {activeTab === 'my_findings' && isDualRole && (
              <div className="space-y-6">
                {/* تعليمات */}
                <div className="p-4 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-full bg-indigo-100 dark:bg-indigo-800">
                      <User className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium mb-1">
                        {language === 'ar' ? 'الملاحظات المسجلة على إدارتكم' : 'Findings Recorded for Your Department'}
                      </h4>
                      <p className="text-sm text-[var(--foreground-secondary)]">
                        {language === 'ar'
                          ? 'بصفتك موظف من الإدارة المُراجعة، هذه الملاحظات تم تسجيلها على إدارتكم. يمكنك الرد عليها وإرفاق المستندات.'
                          : 'As an employee of the audited department, these findings were recorded for your department. You can respond and attach documents.'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* إحصائيات */}
                {(() => {
                  const myFindings = audit.findings.filter(f => f.departmentId === currentUser?.departmentId);
                  return (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-4 rounded-lg bg-[var(--background-secondary)] text-center">
                        <p className="text-2xl font-bold text-[var(--primary)]">{myFindings.length}</p>
                        <p className="text-xs text-[var(--foreground-secondary)]">
                          {language === 'ar' ? 'إجمالي الملاحظات' : 'Total Findings'}
                        </p>
                      </div>
                      <div className="p-4 rounded-lg bg-orange-50 dark:bg-orange-900/20 text-center">
                        <p className="text-2xl font-bold text-orange-600">
                          {myFindings.filter(f => f.status === 'open' || f.status === 'in_progress').length}
                        </p>
                        <p className="text-xs text-orange-700 dark:text-orange-400">
                          {language === 'ar' ? 'تحتاج إجراء' : 'Need Action'}
                        </p>
                      </div>
                      <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-center">
                        <p className="text-2xl font-bold text-blue-600">
                          {myFindings.filter(f => f.status === 'pending_verification').length}
                        </p>
                        <p className="text-xs text-blue-700 dark:text-blue-400">
                          {language === 'ar' ? 'بانتظار التحقق' : 'Pending Verification'}
                        </p>
                      </div>
                      <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 text-center">
                        <p className="text-2xl font-bold text-green-600">
                          {myFindings.filter(f => f.status === 'closed').length}
                        </p>
                        <p className="text-xs text-green-700 dark:text-green-400">
                          {language === 'ar' ? 'مغلقة' : 'Closed'}
                        </p>
                      </div>
                    </div>
                  );
                })()}

                {/* قائمة الملاحظات */}
                {(() => {
                  const myFindings = audit.findings.filter(f => f.departmentId === currentUser?.departmentId);

                  if (myFindings.length === 0) {
                    return (
                      <div className="text-center py-12 text-[var(--foreground-secondary)] border-2 border-dashed border-[var(--border)] rounded-lg">
                        <CheckCircle className="h-16 w-16 mx-auto mb-4 opacity-30 text-green-500" />
                        <p className="text-lg font-medium mb-2 text-green-700 dark:text-green-400">
                          {language === 'ar' ? 'لا توجد ملاحظات على إدارتكم' : 'No Findings for Your Department'}
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-4">
                      {myFindings.map((finding) => {
                        const isOverdue = finding.status !== 'closed' && new Date(finding.estimatedClosingDate) < new Date();
                        const hasPendingExtension = finding.extensionRequests?.some(er => er.status === 'pending');

                        return (
                          <div key={finding.id} className={`p-4 rounded-lg border ${
                            isOverdue ? 'border-red-300 bg-red-50/50 dark:bg-red-900/10' : 'border-[var(--border)]'
                          }`}>
                            {/* رأس الملاحظة */}
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium text-[var(--primary)]">{finding.reportNumber}</span>
                                <Badge variant={
                                  finding.categoryB === 'major_nc' ? 'danger' :
                                  finding.categoryB === 'minor_nc' ? 'warning' :
                                  finding.categoryB === 'observation' ? 'secondary' : 'success'
                                }>
                                  {findingCategories.B.find(c => c.value === finding.categoryB)?.[language === 'ar' ? 'labelAr' : 'labelEn']}
                                </Badge>
                                {isOverdue && !hasPendingExtension && (
                                  <Badge variant="danger">
                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                    {language === 'ar' ? 'متأخر' : 'Overdue'}
                                  </Badge>
                                )}
                              </div>
                              <Badge variant={
                                finding.status === 'closed' ? 'success' :
                                finding.status === 'pending_verification' ? 'warning' : 'secondary'
                              }>
                                {finding.status === 'open' && (language === 'ar' ? 'مفتوح' : 'Open')}
                                {finding.status === 'in_progress' && (language === 'ar' ? 'قيد التنفيذ' : 'In Progress')}
                                {finding.status === 'pending_verification' && (language === 'ar' ? 'بانتظار التحقق' : 'Pending Verification')}
                                {finding.status === 'closed' && (language === 'ar' ? 'مغلق' : 'Closed')}
                              </Badge>
                            </div>

                            {/* نص الملاحظة */}
                            <div className="p-3 rounded-lg bg-[var(--background-secondary)] mb-3">
                              <p className="text-sm">{finding.finding}</p>
                            </div>

                            {/* معلومات إضافية */}
                            <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--foreground-secondary)] mb-3">
                              {finding.clause && (
                                <span className="flex items-center gap-1">
                                  <FileText className="h-3 w-3" />
                                  {language === 'ar' ? 'البند: ' : 'Clause: '}{finding.clause}
                                </span>
                              )}
                              <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-600 font-medium' : ''}`}>
                                <Calendar className="h-3 w-3" />
                                {language === 'ar' ? 'موعد الإغلاق: ' : 'Due: '}{finding.estimatedClosingDate}
                              </span>
                            </div>

                            {/* عرض رد الإدارة إذا وجد */}
                            {finding.departmentResponse && (
                              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 mb-3">
                                <p className="text-sm font-medium mb-1 text-blue-800 dark:text-blue-200">
                                  {language === 'ar' ? 'ردكم السابق:' : 'Your Previous Response:'}
                                </p>
                                {finding.departmentResponse.comment && (
                                  <p className="text-sm text-blue-700 dark:text-blue-300">{finding.departmentResponse.comment}</p>
                                )}
                              </div>
                            )}

                            {/* أزرار الإجراءات */}
                            {finding.status !== 'closed' && audit.currentStage >= 3 && (
                              <div className="flex flex-wrap gap-2 pt-3 border-t border-[var(--border)]">
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setSelectedFinding(finding);
                                    setShowAuditeeResponseModal(true);
                                  }}
                                >
                                  <MessageCircle className="h-3 w-3 mx-1" />
                                  {language === 'ar' ? 'الرد على الملاحظة' : 'Respond'}
                                </Button>
                                {!hasPendingExtension && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setSelectedFinding(finding);
                                      setShowExtensionModal(true);
                                    }}
                                  >
                                    <Clock className="h-3 w-3 mx-1" />
                                    {language === 'ar' ? 'طلب تمديد' : 'Request Extension'}
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Approval Tab - تبويب مراجعة إدارة الجودة */}
            {activeTab === 'approval' && (
              <div className="space-y-6">
                {/* شرح الصفحة */}
                <div className="p-4 rounded-lg bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-800">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-800">
                      <Shield className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-2">
                        {language === 'ar' ? 'مراجعة إدارة الجودة' : 'QMS Review'}
                      </h3>
                      <p className="text-sm text-[var(--foreground-secondary)]">
                        {currentUser?.role === 'quality_manager' ? (
                          language === 'ar'
                            ? 'راجع مدخلات المراحل السابقة (التخطيط، الأسئلة، الملاحظات) واتخذ قرارك بالموافقة أو الرفض أو التأجيل أو طلب تعديلات من فريق المراجعة.'
                            : 'Review inputs from previous stages (planning, questions, findings) and make your decision to approve, reject, postpone, or request modifications from the audit team.'
                        ) : audit.auditorIds.includes(currentUser?.id || '') ? (
                          language === 'ar'
                            ? 'هذه الصفحة تعرض حالة مراجعة إدارة الجودة. يمكنك الرد على تعليقات مدير الجودة وإجراء التعديلات المطلوبة.'
                            : 'This page shows the QMS review status. You can reply to QMS manager comments and make required modifications.'
                        ) : (
                          language === 'ar'
                            ? 'هذه الصفحة تعرض حالة مراجعة إدارة الجودة لهذه المراجعة.'
                            : 'This page shows the QMS review status for this audit.'
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                {/* مسار سير العمل */}
                <div className="p-4 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)]">
                  <h4 className="font-medium mb-4 flex items-center gap-2">
                    <ArrowRight className="h-4 w-4 text-[var(--primary)]" />
                    {language === 'ar' ? 'مسار سير العمل' : 'Workflow Path'}
                  </h4>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                      audit.currentStage > 1 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-800'
                    }`}>
                      <CheckCircle className={`h-4 w-4 ${audit.currentStage > 1 ? 'text-green-600' : 'text-gray-400'}`} />
                      <span className="text-sm">{language === 'ar' ? 'التنفيذ' : 'Execution'}</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-[var(--foreground-secondary)]" />
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                      audit.currentStage === 2 ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 ring-2 ring-yellow-400' :
                      audit.currentStage > 2 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-800'
                    }`}>
                      {audit.currentStage === 2 ? <Clock className="h-4 w-4 text-yellow-600" /> :
                       audit.currentStage > 2 ? <CheckCircle className="h-4 w-4 text-green-600" /> : <Shield className="h-4 w-4 text-gray-400" />}
                      <span className="text-sm font-medium">{language === 'ar' ? 'مراجعة الجودة' : 'QMS Review'}</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-[var(--foreground-secondary)]" />
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                      audit.currentStage > 2 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-800'
                    }`}>
                      <Wrench className={`h-4 w-4 ${audit.currentStage > 2 ? 'text-green-600' : 'text-gray-400'}`} />
                      <span className="text-sm">{language === 'ar' ? 'الإجراءات التصحيحية' : 'Corrective Actions'}</span>
                    </div>
                  </div>
                </div>

                {/* ملخص المراحل السابقة */}
                {audit.currentStage >= 2 && (
                  <div className="space-y-4">
                    <h4 className="font-medium text-[var(--foreground-secondary)] flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      {language === 'ar' ? 'ملخص المراحل السابقة' : 'Previous Stages Summary'}
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* ملخص التخطيط */}
                      <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                        <div className="flex items-center gap-2 mb-3">
                          <Calendar className="h-5 w-5 text-blue-600" />
                          <span className="font-medium text-blue-800 dark:text-blue-200">
                            {language === 'ar' ? 'التخطيط' : 'Planning'}
                          </span>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-[var(--foreground-secondary)]">{language === 'ar' ? 'النطاق:' : 'Scope:'}</span>
                          </div>
                          <p className="text-xs">{audit.scope || '-'}</p>
                          <div className="flex justify-between">
                            <span className="text-[var(--foreground-secondary)]">{language === 'ar' ? 'الفترة:' : 'Period:'}</span>
                            <span>{audit.startDate} - {audit.endDate}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[var(--foreground-secondary)]">{language === 'ar' ? 'الفريق:' : 'Team:'}</span>
                            <span>{audit.auditorIds.length} {language === 'ar' ? 'مراجعين' : 'auditors'}</span>
                          </div>
                        </div>
                      </div>

                      {/* ملخص الأسئلة */}
                      <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
                        <div className="flex items-center gap-2 mb-3">
                          <FileQuestion className="h-5 w-5 text-purple-600" />
                          <span className="font-medium text-purple-800 dark:text-purple-200">
                            {language === 'ar' ? 'الأسئلة' : 'Questions'}
                          </span>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-[var(--foreground-secondary)]">{language === 'ar' ? 'الإجمالي:' : 'Total:'}</span>
                            <span className="font-medium">{audit.questions.length}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[var(--foreground-secondary)]">{language === 'ar' ? 'مطابق:' : 'Compliant:'}</span>
                            <span className="text-green-600">{audit.questions.filter(q => q.status === 'compliant').length}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[var(--foreground-secondary)]">{language === 'ar' ? 'غير مطابق:' : 'Non-Compliant:'}</span>
                            <span className="text-red-600">{audit.questions.filter(q => q.status === 'non_compliant').length}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[var(--foreground-secondary)]">{language === 'ar' ? 'معلق:' : 'Pending:'}</span>
                            <span className="text-yellow-600">{audit.questions.filter(q => q.status === 'pending').length}</span>
                          </div>
                        </div>
                      </div>

                      {/* ملخص الملاحظات */}
                      <div className="p-4 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800">
                        <div className="flex items-center gap-2 mb-3">
                          <AlertTriangle className="h-5 w-5 text-orange-600" />
                          <span className="font-medium text-orange-800 dark:text-orange-200">
                            {language === 'ar' ? 'الملاحظات' : 'Findings'}
                          </span>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-[var(--foreground-secondary)]">{language === 'ar' ? 'الإجمالي:' : 'Total:'}</span>
                            <span className="font-medium">{audit.findings.length}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[var(--foreground-secondary)]">{language === 'ar' ? 'عدم مطابقة رئيسي:' : 'Major NC:'}</span>
                            <span className="text-red-600">{audit.findings.filter(f => f.categoryB === 'major_nc').length}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[var(--foreground-secondary)]">{language === 'ar' ? 'عدم مطابقة ثانوي:' : 'Minor NC:'}</span>
                            <span className="text-orange-600">{audit.findings.filter(f => f.categoryB === 'minor_nc').length}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[var(--foreground-secondary)]">{language === 'ar' ? 'ملاحظات:' : 'Observations:'}</span>
                            <span className="text-yellow-600">{audit.findings.filter(f => f.categoryB === 'observation').length}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* حالة القرار الحالية */}
                {audit.qmsApprovalData?.currentDecision && (
                  <div className={`p-4 rounded-lg border ${
                    audit.qmsApprovalData.currentDecision === 'approved' ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' :
                    audit.qmsApprovalData.currentDecision === 'rejected' ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' :
                    audit.qmsApprovalData.currentDecision === 'postponed' ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' :
                    'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800'
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                      {audit.qmsApprovalData.currentDecision === 'approved' && <ThumbsUp className="h-5 w-5 text-green-600" />}
                      {audit.qmsApprovalData.currentDecision === 'rejected' && <ThumbsDown className="h-5 w-5 text-red-600" />}
                      {audit.qmsApprovalData.currentDecision === 'postponed' && <Pause className="h-5 w-5 text-amber-600" />}
                      {audit.qmsApprovalData.currentDecision === 'modification_requested' && <Edit3 className="h-5 w-5 text-purple-600" />}
                      <span className={`font-medium ${
                        audit.qmsApprovalData.currentDecision === 'approved' ? 'text-green-800 dark:text-green-200' :
                        audit.qmsApprovalData.currentDecision === 'rejected' ? 'text-red-800 dark:text-red-200' :
                        audit.qmsApprovalData.currentDecision === 'postponed' ? 'text-amber-800 dark:text-amber-200' :
                        'text-purple-800 dark:text-purple-200'
                      }`}>
                        {audit.qmsApprovalData.currentDecision === 'approved' && (language === 'ar' ? 'تمت الموافقة' : 'Approved')}
                        {audit.qmsApprovalData.currentDecision === 'rejected' && (language === 'ar' ? 'تم الرفض' : 'Rejected')}
                        {audit.qmsApprovalData.currentDecision === 'postponed' && (language === 'ar' ? 'تم التأجيل' : 'Postponed')}
                        {audit.qmsApprovalData.currentDecision === 'modification_requested' && (language === 'ar' ? 'طلب تعديل' : 'Modification Requested')}
                      </span>
                    </div>
                  </div>
                )}

                {/* أزرار القرار لمدير الجودة */}
                {audit.currentStage === 2 && currentUser?.role === 'quality_manager' &&
                 (!audit.qmsApprovalData?.currentDecision || audit.qmsApprovalData.currentDecision === 'postponed') && (
                  <div className="p-4 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)]">
                    <h4 className="font-medium mb-4 flex items-center gap-2">
                      <Shield className="h-5 w-5 text-[var(--primary)]" />
                      {language === 'ar' ? 'اتخاذ القرار' : 'Make Decision'}
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <Button
                        className="bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => {
                          setSelectedDecision('approved');
                          setShowQMSDecisionModal(true);
                        }}
                      >
                        <ThumbsUp className="h-4 w-4 mx-1" />
                        {language === 'ar' ? 'موافقة' : 'Approve'}
                      </Button>
                      <Button
                        variant="outline"
                        className="border-red-500 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                        onClick={() => {
                          setSelectedDecision('rejected');
                          setShowQMSDecisionModal(true);
                        }}
                      >
                        <ThumbsDown className="h-4 w-4 mx-1" />
                        {language === 'ar' ? 'رفض' : 'Reject'}
                      </Button>
                      <Button
                        variant="outline"
                        className="border-amber-500 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                        onClick={() => {
                          setSelectedDecision('postponed');
                          setShowQMSDecisionModal(true);
                        }}
                      >
                        <Pause className="h-4 w-4 mx-1" />
                        {language === 'ar' ? 'تأجيل' : 'Postpone'}
                      </Button>
                      <Button
                        variant="outline"
                        className="border-purple-500 text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                        onClick={() => {
                          setSelectedDecision('modification_requested');
                          setShowQMSDecisionModal(true);
                        }}
                      >
                        <Edit3 className="h-4 w-4 mx-1" />
                        {language === 'ar' ? 'طلب تعديل' : 'Request Modification'}
                      </Button>
                    </div>
                  </div>
                )}

                {/* وضع التعديل للمراجعين */}
                {audit.qmsApprovalData?.currentDecision === 'modification_requested' &&
                 audit.auditorIds.includes(currentUser?.id || '') && (
                  <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Edit3 className="h-5 w-5 text-purple-600" />
                        <span className="font-medium text-purple-800 dark:text-purple-200">
                          {language === 'ar' ? 'مطلوب تعديلات' : 'Modifications Required'}
                        </span>
                      </div>
                      {!isEditMode ? (
                        <Button
                          size="sm"
                          onClick={() => setIsEditMode(true)}
                        >
                          <Edit3 className="h-4 w-4 mx-1" />
                          {language === 'ar' ? 'بدء التعديل' : 'Start Editing'}
                        </Button>
                      ) : (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setIsEditMode(false)}
                          >
                            {language === 'ar' ? 'إلغاء' : 'Cancel'}
                          </Button>
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={handleSubmitModifications}
                          >
                            <Send className="h-4 w-4 mx-1" />
                            {language === 'ar' ? 'إرسال التعديلات' : 'Submit Modifications'}
                          </Button>
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-purple-700 dark:text-purple-300">
                      {language === 'ar'
                        ? 'مدير الجودة يطلب تعديلات على هذه المراجعة. قم بمراجعة التعليقات أدناه وإجراء التعديلات المطلوبة.'
                        : 'QMS Manager has requested modifications to this audit. Review the comments below and make the required changes.'}
                    </p>
                  </div>
                )}

                {/* قسم التعليقات والردود */}
                {audit.qmsApprovalData?.comments && audit.qmsApprovalData.comments.length > 0 && (
                  <div className="space-y-4">
                    <h4 className="font-medium text-[var(--foreground-secondary)] flex items-center gap-2">
                      <MessageCircle className="h-4 w-4" />
                      {language === 'ar' ? 'التعليقات والردود' : 'Comments & Replies'}
                    </h4>
                    <div className="space-y-3">
                      {audit.qmsApprovalData.comments.map((comment) => {
                        const author = getUser(comment.authorId);
                        return (
                          <div
                            key={comment.id}
                            className={`p-4 rounded-lg ${
                              comment.isFromQMSManager
                                ? 'bg-blue-50 dark:bg-blue-900/20 border-s-4 border-blue-500'
                                : 'bg-gray-50 dark:bg-gray-800/50 border-s-4 border-gray-300 dark:border-gray-600'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${
                                comment.isFromQMSManager ? 'bg-blue-500' : 'bg-gray-500'
                              }`}>
                                {author ? (language === 'ar' ? author.fullNameAr : author.fullNameEn).charAt(0) : '?'}
                              </div>
                              <div>
                                <p className="font-medium text-sm">
                                  {author ? (language === 'ar' ? author.fullNameAr : author.fullNameEn) : ''}
                                </p>
                                <p className="text-xs text-[var(--foreground-secondary)]">
                                  {comment.isFromQMSManager
                                    ? (language === 'ar' ? 'مدير الجودة' : 'QMS Manager')
                                    : (language === 'ar' ? 'مراجع' : 'Auditor')}
                                  {' • '}
                                  {new Date(comment.createdAt).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
                                    day: 'numeric',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </p>
                              </div>
                            </div>
                            <p className="text-sm">{comment.content}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* حقل إضافة رد */}
                {audit.currentStage === 2 && canReply && (
                  <div className="p-4 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)]">
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <MessageCircle className="h-4 w-4" />
                      {language === 'ar' ? 'إضافة رد' : 'Add Reply'}
                    </h4>
                    <div className="flex gap-2">
                      <textarea
                        rows={2}
                        value={replyComment}
                        onChange={(e) => setReplyComment(e.target.value)}
                        placeholder={language === 'ar' ? 'اكتب ردك هنا...' : 'Write your reply here...'}
                        className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm resize-none"
                      />
                      <Button
                        onClick={handleAddReply}
                        disabled={!replyComment.trim()}
                        className="self-end"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* سجل القرارات */}
                {audit.qmsApprovalData?.history && audit.qmsApprovalData.history.length > 0 && (
                  <div className="space-y-4">
                    <h4 className="font-medium text-[var(--foreground-secondary)] flex items-center gap-2">
                      <History className="h-4 w-4" />
                      {language === 'ar' ? 'سجل القرارات' : 'Decision History'}
                    </h4>
                    <div className="space-y-2">
                      {audit.qmsApprovalData.history.map((entry) => {
                        const author = getUser(entry.modifiedBy);
                        return (
                          <div key={entry.id} className="flex items-center gap-3 p-3 rounded-lg bg-[var(--background-secondary)]">
                            <div className={`w-3 h-3 rounded-full ${
                              entry.decision === 'approved' ? 'bg-green-500' :
                              entry.decision === 'rejected' ? 'bg-red-500' :
                              entry.decision === 'postponed' ? 'bg-amber-500' :
                              'bg-purple-500'
                            }`} />
                            <div className="flex-1">
                              <p className="text-sm font-medium">
                                {entry.decision === 'approved' && (language === 'ar' ? 'موافقة' : 'Approved')}
                                {entry.decision === 'rejected' && (language === 'ar' ? 'رفض' : 'Rejected')}
                                {entry.decision === 'postponed' && (language === 'ar' ? 'تأجيل' : 'Postponed')}
                                {entry.decision === 'modification_requested' && (language === 'ar' ? 'طلب تعديل' : 'Modification Requested')}
                              </p>
                              <p className="text-xs text-[var(--foreground-secondary)]">
                                {author ? (language === 'ar' ? author.fullNameAr : author.fullNameEn) : ''}
                                {' • '}
                                {new Date(entry.date).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* رسالة إذا لم تكن في مرحلة المراجعة */}
                {audit.currentStage !== 3 && !audit.qmsApprovalData && (
                  <div className="text-center py-8 text-[var(--foreground-secondary)]">
                    <Info className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    <p>
                      {language === 'ar'
                        ? 'ستكون مراجعة إدارة الجودة متاحة في المرحلة الرابعة'
                        : 'QMS Review will be available at stage 4'}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Activity Log Tab - سجل النشاطات */}
            {activeTab === 'activity' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold flex items-center gap-2">
                    <History className="h-5 w-5 text-[var(--primary)]" />
                    {language === 'ar' ? 'سجل النشاطات' : 'Activity Log'}
                  </h3>
                  <span className="text-sm text-[var(--foreground-secondary)]">
                    {audit.activityLog?.length || 0} {language === 'ar' ? 'نشاط' : 'activities'}
                  </span>
                </div>

                {audit.activityLog && audit.activityLog.length > 0 ? (
                  <div className="relative">
                    {/* Timeline line */}
                    <div className="absolute top-0 bottom-0 start-6 w-0.5 bg-[var(--border)]" />

                    <div className="space-y-4">
                      {[...audit.activityLog].reverse().map((activity, idx) => {
                        const user = getUser(activity.userId);
                        const activityConfig: Record<ActivityLogEntry['type'], { icon: React.ReactNode; color: string; labelAr: string; labelEn: string }> = {
                          audit_created: { icon: <Plus className="h-4 w-4" />, color: 'bg-blue-500', labelAr: 'إنشاء المراجعة', labelEn: 'Audit Created' },
                          audit_submitted: { icon: <Send className="h-4 w-4" />, color: 'bg-purple-500', labelAr: 'إرسال للموافقة', labelEn: 'Submitted for Approval' },
                          audit_approved: { icon: <ThumbsUp className="h-4 w-4" />, color: 'bg-green-500', labelAr: 'تمت الموافقة', labelEn: 'Approved' },
                          audit_rejected: { icon: <ThumbsDown className="h-4 w-4" />, color: 'bg-red-500', labelAr: 'تم الرفض', labelEn: 'Rejected' },
                          audit_postponed: { icon: <Pause className="h-4 w-4" />, color: 'bg-amber-500', labelAr: 'تم التأجيل', labelEn: 'Postponed' },
                          modification_requested: { icon: <Edit3 className="h-4 w-4" />, color: 'bg-purple-500', labelAr: 'طلب تعديل', labelEn: 'Modification Requested' },
                          stage_changed: { icon: <ArrowRight className="h-4 w-4" />, color: 'bg-blue-500', labelAr: 'تغيير المرحلة', labelEn: 'Stage Changed' },
                          question_added: { icon: <HelpCircle className="h-4 w-4" />, color: 'bg-cyan-500', labelAr: 'إضافة سؤال', labelEn: 'Question Added' },
                          question_answered: { icon: <CheckCircle className="h-4 w-4" />, color: 'bg-teal-500', labelAr: 'إجابة سؤال', labelEn: 'Question Answered' },
                          finding_added: { icon: <AlertTriangle className="h-4 w-4" />, color: 'bg-orange-500', labelAr: 'إضافة ملاحظة', labelEn: 'Finding Added' },
                          finding_updated: { icon: <Edit3 className="h-4 w-4" />, color: 'bg-yellow-500', labelAr: 'تحديث ملاحظة', labelEn: 'Finding Updated' },
                          corrective_action_added: { icon: <Wrench className="h-4 w-4" />, color: 'bg-indigo-500', labelAr: 'إضافة إجراء تصحيحي', labelEn: 'Corrective Action Added' },
                          extension_requested: { icon: <Clock className="h-4 w-4" />, color: 'bg-yellow-500', labelAr: 'طلب تمديد', labelEn: 'Extension Requested' },
                          extension_approved: { icon: <CheckCircle className="h-4 w-4" />, color: 'bg-green-500', labelAr: 'موافقة على التمديد', labelEn: 'Extension Approved' },
                          extension_rejected: { icon: <X className="h-4 w-4" />, color: 'bg-red-500', labelAr: 'رفض التمديد', labelEn: 'Extension Rejected' },
                          execution_confirmed: { icon: <CheckCircle className="h-4 w-4" />, color: 'bg-green-500', labelAr: 'تأكيد التنفيذ', labelEn: 'Execution Confirmed' },
                          comment_added: { icon: <MessageCircle className="h-4 w-4" />, color: 'bg-gray-500', labelAr: 'إضافة تعليق', labelEn: 'Comment Added' },
                          department_response: { icon: <Building2 className="h-4 w-4" />, color: 'bg-blue-500', labelAr: 'رد الإدارة', labelEn: 'Department Response' },
                          corrective_actions_approved: { icon: <Award className="h-4 w-4" />, color: 'bg-green-500', labelAr: 'موافقة على الإجراءات', labelEn: 'Corrective Actions Approved' },
                        };

                        const config = activityConfig[activity.type] || { icon: <Info className="h-4 w-4" />, color: 'bg-gray-500', labelAr: activity.type, labelEn: activity.type };

                        return (
                          <div key={activity.id} className="relative flex gap-4 ps-3">
                            {/* Timeline dot */}
                            <div className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full ${config.color} text-white shadow-sm`}>
                              {config.icon}
                            </div>

                            {/* Content */}
                            <div className="flex-1 pb-4">
                              <div className="flex items-start justify-between">
                                <div>
                                  <p className="font-medium text-sm">
                                    {language === 'ar' ? config.labelAr : config.labelEn}
                                  </p>
                                  {activity.details.description && (
                                    <p className="text-sm text-[var(--foreground-secondary)] mt-1">
                                      {activity.details.description}
                                    </p>
                                  )}
                                  {activity.details.comment && (
                                    <p className="text-sm text-[var(--foreground-secondary)] mt-1 italic">
                                      "{activity.details.comment}"
                                    </p>
                                  )}
                                </div>
                                <div className="text-xs text-[var(--foreground-secondary)] text-end whitespace-nowrap">
                                  <p>{new Date(activity.timestamp).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}</p>
                                  <p>{new Date(activity.timestamp).toLocaleTimeString(language === 'ar' ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</p>
                                </div>
                              </div>
                              {user && (
                                <div className="flex items-center gap-2 mt-2">
                                  <div className="w-6 h-6 rounded-full bg-[var(--primary)] text-white flex items-center justify-center text-xs font-medium">
                                    {(language === 'ar' ? user.fullNameAr : user.fullNameEn).charAt(0)}
                                  </div>
                                  <span className="text-xs text-[var(--foreground-secondary)]">
                                    {language === 'ar' ? user.fullNameAr : user.fullNameEn}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-[var(--foreground-secondary)] border-2 border-dashed border-[var(--border)] rounded-lg">
                    <History className="h-16 w-16 mx-auto mb-4 opacity-30" />
                    <p className="text-lg font-medium mb-2">
                      {language === 'ar' ? 'لا توجد نشاطات مسجلة' : 'No activities recorded'}
                    </p>
                    <p className="text-sm">
                      {language === 'ar'
                        ? 'سيتم تسجيل جميع التحركات والتعديلات هنا'
                        : 'All movements and changes will be recorded here'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons - Stage Navigation */}
        {audit.currentStage < workflowStages.length - 1 && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                {/* Previous Stage Button */}
                <div>
                  {canMoveToPrev && (
                    <Button variant="outline" onClick={handleMoveToPrevStage}>
                      {language === 'ar' ? <ArrowRight className="h-4 w-4 ml-2" /> : <ArrowLeft className="h-4 w-4 mr-2" />}
                      {language === 'ar' ? 'الرجوع للمرحلة السابقة' : 'Back to Previous Stage'}
                    </Button>
                  )}
                </div>

                {/* Current Stage Info */}
                <div className="text-center">
                  <p className="text-sm text-[var(--foreground-secondary)]">
                    {language === 'ar' ? 'المرحلة الحالية' : 'Current Stage'}
                  </p>
                  <p className="font-medium">
                    {language === 'ar'
                      ? workflowStages[audit.currentStage]?.stepAr
                      : workflowStages[audit.currentStage]?.stepEn}
                  </p>
                </div>

                {/* Next Stage Button */}
                <div>
                  {canMoveToNext && (
                    <Button onClick={handleMoveToNextStage}>
                      {language === 'ar' ? 'الانتقال للمرحلة التالية' : 'Move to Next Stage'}
                      {language === 'ar' ? <ArrowLeft className="h-4 w-4 mr-2" /> : <ArrowRight className="h-4 w-4 ml-2" />}
                    </Button>
                  )}
                  {isWaitingForApproval && (
                    <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                      <Clock className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        {language === 'ar' ? 'بانتظار موافقة إدارة الجودة' : 'Waiting for QMS Approval'}
                      </span>
                    </div>
                  )}
                  {/* Warning message when can't move to next stage */}
                  {!canMoveToNext && !isWaitingForApproval && audit.currentStage < workflowStages.length - 1 && cantMoveReason && (
                    <div className="flex items-center gap-2 text-red-600 dark:text-red-400 max-w-md">
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />
                      <span className="text-sm">
                        {cantMoveReason}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Question Modal */}
        {showQuestionModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowQuestionModal(false)} />
            <div className="relative z-50 w-full max-w-md rounded-xl bg-white dark:bg-gray-900 p-6 shadow-xl mx-4">
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
                  <label className="block text-sm font-medium mb-1">
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
                  <label className="block text-sm font-medium mb-1">
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
                  <label className="block text-sm font-medium mb-1">
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
              <div className="flex justify-end gap-2 mt-6">
                <Button variant="outline" onClick={() => setShowQuestionModal(false)}>
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </Button>
                <Button onClick={handleAddQuestion} disabled={!newQuestion.questionAr}>
                  {language === 'ar' ? 'إضافة' : 'Add'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Answer Question Modal */}
        {showAnswerModal && selectedQuestion && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowAnswerModal(false)} />
            <div className="relative z-50 w-full max-w-lg rounded-xl bg-white dark:bg-gray-900 p-6 shadow-xl mx-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">
                  {language === 'ar' ? 'الإجابة على السؤال' : 'Answer Question'}
                </h2>
                <Button variant="ghost" size="icon-sm" onClick={() => setShowAnswerModal(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* عرض السؤال */}
              <div className="mb-4 p-3 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)]">
                <p className="font-medium text-sm">{language === 'ar' ? selectedQuestion.questionAr : selectedQuestion.questionEn}</p>
                {selectedQuestion.clause && (
                  <p className="text-xs text-[var(--foreground-secondary)] mt-1 flex items-center gap-1">
                    <Shield className="h-3 w-3" />
                    {language === 'ar' ? 'البند: ' : 'Clause: '}{selectedQuestion.clause}
                  </p>
                )}
              </div>

              <div className="space-y-4">
                {/* حالة المطابقة */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    {language === 'ar' ? 'حالة المطابقة *' : 'Compliance Status *'}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setQuestionAnswer({ ...questionAnswer, status: 'compliant' })}
                      className={`p-3 rounded-lg border-2 transition-all flex items-center justify-center gap-2 ${
                        questionAnswer.status === 'compliant'
                          ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                          : 'border-[var(--border)] hover:border-green-300'
                      }`}
                    >
                      <CheckCircle className="h-5 w-5" />
                      <span className="font-medium">{language === 'ar' ? 'مطابق' : 'Compliant'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuestionAnswer({ ...questionAnswer, status: 'non_compliant' })}
                      className={`p-3 rounded-lg border-2 transition-all flex items-center justify-center gap-2 ${
                        questionAnswer.status === 'non_compliant'
                          ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                          : 'border-[var(--border)] hover:border-red-300'
                      }`}
                    >
                      <X className="h-5 w-5" />
                      <span className="font-medium">{language === 'ar' ? 'غير مطابق' : 'Non-Compliant'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuestionAnswer({ ...questionAnswer, status: 'not_applicable' })}
                      className={`p-3 rounded-lg border-2 transition-all flex items-center justify-center gap-2 col-span-2 ${
                        questionAnswer.status === 'not_applicable'
                          ? 'border-gray-500 bg-gray-50 dark:bg-gray-900/20 text-gray-700 dark:text-gray-300'
                          : 'border-[var(--border)] hover:border-gray-300'
                      }`}
                    >
                      <span className="font-medium">{language === 'ar' ? 'غير قابل للتطبيق' : 'Not Applicable'}</span>
                    </button>
                  </div>
                </div>

                {/* الإجابة / التفاصيل */}
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {language === 'ar' ? 'الإجابة / التفاصيل' : 'Answer / Details'}
                  </label>
                  <textarea
                    rows={3}
                    value={questionAnswer.answer}
                    onChange={(e) => setQuestionAnswer({ ...questionAnswer, answer: e.target.value })}
                    placeholder={language === 'ar' ? 'أدخل تفاصيل الإجابة...' : 'Enter answer details...'}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm"
                  />
                </div>

                {/* ملاحظات إضافية */}
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {language === 'ar' ? 'ملاحظات إضافية' : 'Additional Notes'}
                  </label>
                  <textarea
                    rows={2}
                    value={questionAnswer.notes}
                    onChange={(e) => setQuestionAnswer({ ...questionAnswer, notes: e.target.value })}
                    placeholder={language === 'ar' ? 'ملاحظات اختيارية...' : 'Optional notes...'}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <Button variant="outline" onClick={() => setShowAnswerModal(false)}>
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </Button>
                <Button
                  onClick={handleAnswerQuestion}
                  disabled={questionAnswer.status === 'pending'}
                  className={
                    questionAnswer.status === 'compliant' ? 'bg-green-600 hover:bg-green-700' :
                    questionAnswer.status === 'non_compliant' ? 'bg-red-600 hover:bg-red-700' :
                    ''
                  }
                >
                  {language === 'ar' ? 'حفظ الإجابة' : 'Save Answer'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Finding Modal - Internal Quality Audit Report Form */}
        {showFindingModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowFindingModal(false)} />
            <div className="relative z-50 w-full max-w-2xl rounded-xl bg-white dark:bg-gray-900 p-6 shadow-xl mx-4 max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="bg-[var(--primary)] text-white p-4 -m-6 mb-4 rounded-t-xl">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">
                    {language === 'ar' ? 'تقرير المراجعة الداخلية للجودة' : 'Internal Quality Audit Report'}
                  </h2>
                  <div className="flex items-center gap-4">
                    <span className="text-sm opacity-80">
                      {language === 'ar' ? 'رقم التقرير:' : 'Report No:'} {audit.number}-F{(audit.findings?.length || 0) + 1}
                    </span>
                    <Button variant="ghost" size="icon-sm" onClick={() => setShowFindingModal(false)} className="text-white hover:bg-white/20">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {/* Department/Area and Section */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      {language === 'ar' ? 'الإدارة / المنطقة *' : 'Department / Area *'}
                    </label>
                    <select
                      value={newFinding.departmentId || audit.departmentId}
                      onChange={(e) => setNewFinding({ ...newFinding, departmentId: e.target.value, sectionId: '' })}
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
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      {language === 'ar' ? 'القسم' : 'Section'}
                    </label>
                    <select
                      value={newFinding.sectionId}
                      onChange={(e) => setNewFinding({ ...newFinding, sectionId: e.target.value })}
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm"
                    >
                      <option value="">{language === 'ar' ? 'كل الأقسام' : 'All Sections'}</option>
                      {allSections.filter(s => s.departmentId === (newFinding.departmentId || audit.departmentId) && s.isActive).map(sec => (
                        <option key={sec.id} value={sec.id}>
                          {language === 'ar' ? sec.nameAr : sec.nameEn}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Focus/Risk Area */}
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {language === 'ar' ? 'منطقة التركيز / الخطر' : 'Focus / Risk Area'}
                  </label>
                  <input
                    type="text"
                    value={newFinding.focusArea}
                    onChange={(e) => setNewFinding({ ...newFinding, focusArea: e.target.value })}
                    placeholder={language === 'ar' ? 'مثال: إدارة الوثائق، السلامة المهنية...' : 'e.g., Document Control, Occupational Safety...'}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm"
                  />
                </div>

                {/* Requirements (ISO Clause) */}
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {language === 'ar' ? 'المتطلبات (بند ISO المرجعي) *' : 'Requirements (ISO Clause) *'}
                  </label>
                  <input
                    type="text"
                    value={newFinding.clause}
                    onChange={(e) => setNewFinding({ ...newFinding, clause: e.target.value })}
                    placeholder="e.g., ISO 9001:2015 - 8.5.1"
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm"
                  />
                </div>

                {/* Failure(s) - Finding Description */}
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {language === 'ar' ? 'عدم المطابقة / الملاحظة *' : 'Failure(s) / Finding *'}
                  </label>
                  <textarea
                    rows={3}
                    value={newFinding.finding}
                    onChange={(e) => setNewFinding({ ...newFinding, finding: e.target.value })}
                    placeholder={language === 'ar' ? 'وصف تفصيلي لعدم المطابقة أو الملاحظة...' : 'Detailed description of the non-conformity or finding...'}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm"
                  />
                </div>

                {/* Evidence(s) */}
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {language === 'ar' ? 'الأدلة *' : 'Evidence(s) *'}
                  </label>
                  <textarea
                    rows={2}
                    value={newFinding.evidence}
                    onChange={(e) => setNewFinding({ ...newFinding, evidence: e.target.value })}
                    placeholder={language === 'ar' ? 'الوثائق، السجلات، الملاحظات الميدانية...' : 'Documents, records, field observations...'}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm"
                  />

                  {/* File attachments section */}
                  <div className="mt-3 p-3 rounded-lg border border-dashed border-[var(--border)] bg-[var(--background-secondary)]/50">
                    <div className="flex items-center justify-between mb-2">
                      <label className="flex items-center gap-2 text-sm font-medium">
                        <Paperclip className="h-4 w-4 text-[var(--primary)]" />
                        {language === 'ar' ? 'المرفقات' : 'Attachments'}
                      </label>
                      <span className="text-xs text-[var(--foreground-secondary)]">
                        {language === 'ar' ? 'صور، PDF، مستندات (الحد الأقصى 5 ملفات)' : 'Images, PDF, Documents (Max 5 files)'}
                      </span>
                    </div>

                    {/* File input options - OneDrive only */}
                    <div className="flex flex-wrap gap-2 mb-3">
                      {/* OneDrive picker button */}
                      <OneDrivePicker
                        onFilesSelected={(files: OneDriveFile[]) => {
                          const oneDriveFiles: AttachmentFile[] = files.map(f => ({
                            type: 'onedrive' as const,
                            name: f.name,
                            size: f.size,
                            webUrl: f.webUrl,
                            id: f.id,
                          }));
                          const remainingSlots = 5 - newFinding.attachments.length;
                          const filesToAdd = oneDriveFiles.slice(0, remainingSlots);
                          setNewFinding({
                            ...newFinding,
                            attachments: [...newFinding.attachments, ...filesToAdd]
                          });
                        }}
                        selectedFiles={newFinding.attachments
                          .map(a => ({
                            id: a.id || '',
                            name: a.name,
                            size: a.size || 0,
                            webUrl: a.webUrl || '',
                          }))}
                        maxFiles={5 - newFinding.attachments.length}
                        language={language}
                        disabled={newFinding.attachments.length >= 5}
                        className="inline-flex"
                        showSelectedFiles={false}
                      />
                    </div>

                    {/* Attached files list */}
                    {newFinding.attachments.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs text-[var(--foreground-secondary)]">
                          {language === 'ar'
                            ? `الملفات المرفقة (${newFinding.attachments.length}/5)`
                            : `Attached files (${newFinding.attachments.length}/5)`}
                        </p>
                        {newFinding.attachments.map((file, index) => {
                          const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(file.name);
                          const isPdf = /\.pdf$/i.test(file.name);
                          const isOneDrive = file.type === 'onedrive';

                          return (
                            <div
                              key={index}
                              className={`flex items-center justify-between p-2 rounded-lg bg-[var(--background)] border ${
                                isOneDrive ? 'border-blue-200 dark:border-blue-800' : 'border-[var(--border)]'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                {isOneDrive ? (
                                  <Cloud className="h-4 w-4 text-blue-500 flex-shrink-0" />
                                ) : isImage ? (
                                  <Image className="h-4 w-4 text-green-600 flex-shrink-0" />
                                ) : isPdf ? (
                                  <FileText className="h-4 w-4 text-red-600 flex-shrink-0" />
                                ) : (
                                  <FileText className="h-4 w-4 text-blue-600 flex-shrink-0" />
                                )}
                                <div className="min-w-0 flex-1">
                                  <span className="text-sm truncate block">{file.name}</span>
                                  {file.size && (
                                    <span className="text-xs text-[var(--foreground-secondary)]">
                                      {file.size < 1024
                                        ? `${file.size} B`
                                        : file.size < 1024 * 1024
                                        ? `${(file.size / 1024).toFixed(1)} KB`
                                        : `${(file.size / (1024 * 1024)).toFixed(1)} MB`}
                                    </span>
                                  )}
                                </div>
                                {isOneDrive && (
                                  <span className="text-xs px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                                    OneDrive
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                {/* Open in OneDrive link */}
                                {isOneDrive && file.webUrl && (
                                  <a
                                    href={file.webUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600"
                                    title={language === 'ar' ? 'فتح في OneDrive' : 'Open in OneDrive'}
                                  >
                                    <ArrowRight className="h-4 w-4" />
                                  </a>
                                )}
                                {/* Remove button */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newAttachments = newFinding.attachments.filter((_, i) => i !== index);
                                    setNewFinding({ ...newFinding, attachments: newAttachments });
                                  }}
                                  className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-[var(--foreground-secondary)] hover:text-red-500"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Empty state */}
                    {newFinding.attachments.length === 0 && (
                      <div className="flex items-center justify-center py-4 text-xs text-[var(--foreground-secondary)]">
                        {language === 'ar'
                          ? 'اختر ملفات من جهازك أو من OneDrive'
                          : 'Select files from your device or OneDrive'}
                      </div>
                    )}
                  </div>
                </div>

                {/* Estimated Closing Date */}
                <div>
                  <label className="block text-sm font-medium mb-1 text-red-600">
                    + {language === 'ar' ? 'تاريخ الإغلاق المتوقع *' : 'Estimated Closing Date *'}
                  </label>
                  <input
                    type="date"
                    value={newFinding.estimatedClosingDate}
                    onChange={(e) => setNewFinding({ ...newFinding, estimatedClosingDate: e.target.value })}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm"
                  />
                </div>

                {/* Category Section */}
                <div className="border-t border-[var(--border)] pt-4">
                  <label className="block text-sm font-medium mb-3">
                    {language === 'ar' ? 'التصنيف' : 'Category'}
                  </label>

                  {/* Category A - System Type */}
                  <div className="mb-3">
                    <p className="text-xs text-[var(--foreground-secondary)] mb-2">A.</p>
                    <div className="flex flex-wrap gap-3">
                      {findingCategories.A.map(cat => (
                        <label key={cat.value} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="categoryA"
                            value={cat.value}
                            checked={newFinding.categoryA === cat.value}
                            onChange={(e) => setNewFinding({ ...newFinding, categoryA: e.target.value })}
                            className="w-4 h-4 text-[var(--primary)]"
                          />
                          <span className="text-sm">{language === 'ar' ? cat.labelAr : cat.labelEn}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Category B - Finding Type */}
                  <div>
                    <p className="text-xs text-[var(--foreground-secondary)] mb-2">B.</p>
                    <div className="flex flex-wrap gap-3">
                      {findingCategories.B.map(cat => (
                        <label key={cat.value} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="categoryB"
                            value={cat.value}
                            checked={newFinding.categoryB === cat.value}
                            onChange={(e) => setNewFinding({ ...newFinding, categoryB: e.target.value })}
                            className="w-4 h-4 text-[var(--primary)]"
                          />
                          <span className="text-sm">{language === 'ar' ? cat.labelAr : cat.labelEn}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-[var(--border)]">
                <Button variant="outline" onClick={() => setShowFindingModal(false)}>
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </Button>
                <Button
                  onClick={handleAddFinding}
                  disabled={!newFinding.finding || !newFinding.categoryA || !newFinding.categoryB || !newFinding.clause || !newFinding.evidence || !newFinding.estimatedClosingDate}
                >
                  {language === 'ar' ? 'إضافة الملاحظة' : 'Add Finding'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Approval Modal */}
        {showApprovalModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowApprovalModal(false)} />
            <div className="relative z-50 w-full max-w-md rounded-xl bg-white dark:bg-gray-900 p-6 shadow-xl mx-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">
                  {language === 'ar' ? 'موافقة إدارة الجودة' : 'QMS Approval'}
                </h2>
                <Button variant="ghost" size="icon-sm" onClick={() => setShowApprovalModal(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="mb-4">
                <p className="text-sm text-[var(--foreground-secondary)] mb-2">{audit.number}</p>
                <p className="font-medium">{language === 'ar' ? audit.titleAr : audit.titleEn}</p>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">
                  {language === 'ar' ? 'التعليق' : 'Comment'}
                </label>
                <textarea
                  rows={3}
                  value={approvalComment}
                  onChange={(e) => setApprovalComment(e.target.value)}
                  placeholder={language === 'ar' ? 'أضف تعليقك هنا...' : 'Add your comment here...'}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  className="border-red-500 text-red-500 hover:bg-red-50"
                  onClick={() => handleApproval(false)}
                >
                  <ThumbsDown className="h-4 w-4 mx-1" />
                  {language === 'ar' ? 'رفض' : 'Reject'}
                </Button>
                <Button
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => handleApproval(true)}
                >
                  <ThumbsUp className="h-4 w-4 mx-1" />
                  {language === 'ar' ? 'موافقة' : 'Approve'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Extension Request Modal */}
        {showExtensionModal && selectedFinding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowExtensionModal(false)} />
            <div className="relative z-50 w-full max-w-md rounded-xl bg-white dark:bg-gray-900 p-6 shadow-xl mx-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">
                  {language === 'ar' ? 'طلب تمديد الموعد' : 'Request Deadline Extension'}
                </h2>
                <Button variant="ghost" size="icon-sm" onClick={() => setShowExtensionModal(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="mb-4 p-3 rounded-lg bg-[var(--background-secondary)]">
                <p className="text-xs text-[var(--foreground-secondary)] mb-1">
                  {language === 'ar' ? 'الملاحظة:' : 'Finding:'}
                </p>
                <p className="text-sm font-medium">{selectedFinding.reportNumber}</p>
                <p className="text-xs text-[var(--foreground-secondary)] mt-2">
                  {language === 'ar' ? 'الموعد الحالي:' : 'Current Due Date:'}
                  <span className="font-medium mx-1">{selectedFinding.estimatedClosingDate}</span>
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {language === 'ar' ? 'الموعد الجديد المطلوب *' : 'Requested New Date *'}
                  </label>
                  <input
                    type="date"
                    value={extensionRequest.newDate}
                    onChange={(e) => setExtensionRequest({ ...extensionRequest, newDate: e.target.value })}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {language === 'ar' ? 'سبب طلب التمديد *' : 'Reason for Extension *'}
                  </label>
                  <textarea
                    rows={3}
                    value={extensionRequest.reason}
                    onChange={(e) => setExtensionRequest({ ...extensionRequest, reason: e.target.value })}
                    placeholder={language === 'ar' ? 'اشرح سبب الحاجة لتمديد الموعد...' : 'Explain why the extension is needed...'}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <Button variant="outline" onClick={() => setShowExtensionModal(false)}>
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </Button>
                <Button
                  onClick={handleExtensionRequest}
                  disabled={!extensionRequest.newDate || !extensionRequest.reason}
                >
                  <Send className="h-4 w-4 mx-1" />
                  {language === 'ar' ? 'إرسال الطلب' : 'Submit Request'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Auditee Response Modal - نافذة رد المراجع عليهم */}
        {showAuditeeResponseModal && selectedFinding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowAuditeeResponseModal(false)} />
            <div className="relative z-50 w-full max-w-lg rounded-xl bg-white dark:bg-gray-900 p-6 shadow-xl mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">
                  {language === 'ar' ? 'الرد على الملاحظة' : 'Respond to Finding'}
                </h2>
                <Button variant="ghost" size="icon-sm" onClick={() => setShowAuditeeResponseModal(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* معلومات الملاحظة */}
              <div className="mb-4 p-3 rounded-lg bg-[var(--background-secondary)]">
                <p className="text-xs text-[var(--foreground-secondary)] mb-1">
                  {language === 'ar' ? 'الملاحظة:' : 'Finding:'}
                </p>
                <p className="text-sm font-medium">{selectedFinding.reportNumber}</p>
                <p className="text-sm mt-2">{selectedFinding.finding}</p>
              </div>

              <div className="space-y-4">
                {/* تاريخ الإغلاق */}
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {language === 'ar' ? 'تاريخ الإغلاق المحدد *' : 'Set Closing Date *'}
                  </label>
                  <input
                    type="date"
                    value={auditeeResponseForm.closingDate}
                    onChange={(e) => setAuditeeResponseForm({ ...auditeeResponseForm, closingDate: e.target.value })}
                    min={new Date().toISOString().split('T')[0]}
                    max={selectedFinding.estimatedClosingDate}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm"
                  />
                  <p className="text-xs text-[var(--foreground-secondary)] mt-1">
                    {language === 'ar'
                      ? `الموعد الأقصى: ${selectedFinding.estimatedClosingDate}`
                      : `Maximum date: ${selectedFinding.estimatedClosingDate}`}
                  </p>
                </div>

                {/* التعليق */}
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {language === 'ar' ? 'ردكم / الإجراء المتخذ' : 'Your Response / Action Taken'}
                  </label>
                  <textarea
                    rows={4}
                    value={auditeeResponseForm.comment}
                    onChange={(e) => setAuditeeResponseForm({ ...auditeeResponseForm, comment: e.target.value })}
                    placeholder={language === 'ar' ? 'اشرح الإجراء المتخذ لمعالجة الملاحظة...' : 'Explain the action taken to address the finding...'}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm"
                  />
                </div>

                {/* رفع ملفات من OneDrive */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    {language === 'ar' ? 'المرفقات (اختياري)' : 'Attachments (Optional)'}
                  </label>
                  <OneDrivePicker
                    onFilesSelected={(files) => setAuditeeResponseForm({
                      ...auditeeResponseForm,
                      attachments: [...auditeeResponseForm.attachments, ...files],
                    })}
                    selectedFiles={auditeeResponseForm.attachments}
                    onRemoveFile={(fileId) => setAuditeeResponseForm({
                      ...auditeeResponseForm,
                      attachments: auditeeResponseForm.attachments.filter(f => f.id !== fileId),
                    })}
                    maxFiles={5}
                    language={language}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <Button variant="outline" onClick={() => {
                  setShowAuditeeResponseModal(false);
                  setAuditeeResponseForm({ comment: '', closingDate: '', attachments: [] });
                }}>
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </Button>
                <Button
                  onClick={handleAuditeeResponse}
                  disabled={!auditeeResponseForm.closingDate}
                >
                  <Send className="h-4 w-4 mx-1" />
                  {language === 'ar' ? 'إرسال الرد' : 'Submit Response'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Corrective Action Modal */}
        {showCorrectiveActionModal && selectedFinding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowCorrectiveActionModal(false)} />
            <div className="relative z-50 w-full max-w-lg rounded-xl bg-white dark:bg-gray-900 p-6 shadow-xl mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">
                  {language === 'ar' ? 'إضافة إجراء تصحيحي' : 'Add Corrective Action'}
                </h2>
                <Button variant="ghost" size="icon-sm" onClick={() => setShowCorrectiveActionModal(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="mb-4 p-3 rounded-lg bg-[var(--background-secondary)]">
                <p className="text-xs text-[var(--foreground-secondary)] mb-1">
                  {language === 'ar' ? 'الملاحظة:' : 'Finding:'}
                </p>
                <p className="text-sm font-medium">{selectedFinding.reportNumber}</p>
                <p className="text-sm mt-2">{selectedFinding.finding}</p>
                <p className="text-xs text-[var(--foreground-secondary)] mt-2">
                  {language === 'ar' ? 'موعد الإغلاق:' : 'Due Date:'}
                  <span className="font-medium mx-1">{selectedFinding.estimatedClosingDate}</span>
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {language === 'ar' ? 'السبب الجذري' : 'Root Cause'}
                  </label>
                  <textarea
                    rows={3}
                    value={correctiveActionForm.rootCause}
                    onChange={(e) => setCorrectiveActionForm({ ...correctiveActionForm, rootCause: e.target.value })}
                    placeholder={language === 'ar' ? 'ما هو السبب الجذري لهذه الملاحظة؟' : 'What is the root cause of this finding?'}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {language === 'ar' ? 'الإجراء التصحيحي *' : 'Corrective Action *'}
                  </label>
                  <textarea
                    rows={4}
                    value={correctiveActionForm.correctiveAction}
                    onChange={(e) => setCorrectiveActionForm({ ...correctiveActionForm, correctiveAction: e.target.value })}
                    placeholder={language === 'ar' ? 'ما هو الإجراء التصحيحي المتخذ؟' : 'What corrective action was taken?'}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <Button variant="outline" onClick={() => setShowCorrectiveActionModal(false)}>
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </Button>
                <Button
                  onClick={handleCorrectiveAction}
                  disabled={!correctiveActionForm.correctiveAction}
                >
                  <Save className="h-4 w-4 mx-1" />
                  {language === 'ar' ? 'حفظ' : 'Save'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* QMS Decision Modal - نافذة قرار إدارة الجودة */}
        {showQMSDecisionModal && selectedDecision && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => {
              setShowQMSDecisionModal(false);
              setSelectedDecision(null);
              setQmsComment('');
            }} />
            <div className="relative z-50 w-full max-w-md rounded-xl bg-white dark:bg-gray-900 p-6 shadow-xl mx-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  {selectedDecision === 'approved' && <ThumbsUp className="h-5 w-5 text-green-600" />}
                  {selectedDecision === 'rejected' && <ThumbsDown className="h-5 w-5 text-red-600" />}
                  {selectedDecision === 'postponed' && <Pause className="h-5 w-5 text-amber-600" />}
                  {selectedDecision === 'modification_requested' && <Edit3 className="h-5 w-5 text-purple-600" />}
                  {selectedDecision === 'approved' && (language === 'ar' ? 'تأكيد الموافقة' : 'Confirm Approval')}
                  {selectedDecision === 'rejected' && (language === 'ar' ? 'تأكيد الرفض' : 'Confirm Rejection')}
                  {selectedDecision === 'postponed' && (language === 'ar' ? 'تأكيد التأجيل' : 'Confirm Postponement')}
                  {selectedDecision === 'modification_requested' && (language === 'ar' ? 'طلب تعديل' : 'Request Modification')}
                </h2>
                <Button variant="ghost" size="icon-sm" onClick={() => {
                  setShowQMSDecisionModal(false);
                  setSelectedDecision(null);
                  setQmsComment('');
                }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="mb-4 p-3 rounded-lg bg-[var(--background-secondary)]">
                <p className="text-xs text-[var(--foreground-secondary)] mb-1">
                  {language === 'ar' ? 'المراجعة:' : 'Audit:'}
                </p>
                <p className="text-sm font-medium">{audit.number}</p>
                <p className="text-sm">{language === 'ar' ? audit.titleAr : audit.titleEn}</p>
              </div>

              <div className={`p-3 rounded-lg mb-4 ${
                selectedDecision === 'approved' ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200' :
                selectedDecision === 'rejected' ? 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200' :
                selectedDecision === 'postponed' ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200' :
                'bg-purple-50 dark:bg-purple-900/20 text-purple-800 dark:text-purple-200'
              }`}>
                <p className="text-sm">
                  {selectedDecision === 'approved' && (language === 'ar'
                    ? 'سيتم الموافقة على المراجعة والانتقال لمرحلة الإجراءات التصحيحية'
                    : 'The audit will be approved and moved to corrective actions stage')}
                  {selectedDecision === 'rejected' && (language === 'ar'
                    ? 'سيتم رفض المراجعة. هذا الإجراء نهائي'
                    : 'The audit will be rejected. This action is final')}
                  {selectedDecision === 'postponed' && (language === 'ar'
                    ? 'سيتم تأجيل المراجعة. يمكنك مراجعتها لاحقاً'
                    : 'The audit will be postponed. You can review it later')}
                  {selectedDecision === 'modification_requested' && (language === 'ar'
                    ? 'سيتم إرسال طلب للمراجعين لإجراء تعديلات'
                    : 'A request will be sent to auditors to make modifications')}
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">
                  {selectedDecision === 'approved'
                    ? (language === 'ar' ? 'التعليق (اختياري)' : 'Comment (Optional)')
                    : (language === 'ar' ? 'التعليق *' : 'Comment *')
                  }
                </label>
                <textarea
                  rows={4}
                  value={qmsComment}
                  onChange={(e) => setQmsComment(e.target.value)}
                  placeholder={
                    selectedDecision === 'modification_requested'
                      ? (language === 'ar' ? 'اذكر التعديلات المطلوبة بالتفصيل...' : 'Describe the required modifications in detail...')
                      : selectedDecision === 'approved'
                      ? (language === 'ar' ? 'أضف تعليقك هنا (اختياري)...' : 'Add your comment here (optional)...')
                      : (language === 'ar' ? 'أضف تعليقك هنا...' : 'Add your comment here...')
                  }
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => {
                  setShowQMSDecisionModal(false);
                  setSelectedDecision(null);
                  setQmsComment('');
                }}>
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </Button>
                <Button
                  onClick={() => handleQMSDecision(selectedDecision)}
                  disabled={selectedDecision !== 'approved' && !qmsComment.trim()}
                  className={
                    selectedDecision === 'approved' ? 'bg-green-600 hover:bg-green-700' :
                    selectedDecision === 'rejected' ? 'bg-red-600 hover:bg-red-700' :
                    selectedDecision === 'postponed' ? 'bg-amber-600 hover:bg-amber-700' :
                    'bg-purple-600 hover:bg-purple-700'
                  }
                >
                  {selectedDecision === 'approved' && <ThumbsUp className="h-4 w-4 mx-1" />}
                  {selectedDecision === 'rejected' && <ThumbsDown className="h-4 w-4 mx-1" />}
                  {selectedDecision === 'postponed' && <Pause className="h-4 w-4 mx-1" />}
                  {selectedDecision === 'modification_requested' && <Send className="h-4 w-4 mx-1" />}
                  {language === 'ar' ? 'تأكيد' : 'Confirm'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Audit Modal - لمدير الجودة فقط */}
        {showEditAuditModal && isQualityManager && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowEditAuditModal(false)} />
            <div className="relative z-50 w-full max-w-3xl rounded-xl bg-white dark:bg-gray-900 shadow-xl mx-4 max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="bg-[var(--primary)] text-white p-4 rounded-t-xl sticky top-0">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Edit3 className="h-5 w-5" />
                    {language === 'ar' ? 'تعديل بيانات المراجعة' : 'Edit Audit Details'}
                  </h2>
                  <Button variant="ghost" size="icon-sm" onClick={() => setShowEditAuditModal(false)} className="text-white hover:bg-white/20">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* تنبيه */}
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                  <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 text-sm">
                    <AlertTriangle className="h-4 w-4" />
                    {language === 'ar'
                      ? 'التعديلات ستُسجل في سجل النشاطات'
                      : 'Changes will be recorded in the activity log'}
                  </div>
                </div>

                {/* الخطوة 1: معلومات أساسية */}
                <div className="space-y-4">
                  <h3 className="font-medium flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-[var(--primary)] text-white text-xs flex items-center justify-center">1</span>
                    {language === 'ar' ? 'معلومات المراجعة الأساسية' : 'Basic Information'}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        {language === 'ar' ? 'عنوان المراجعة (عربي) *' : 'Audit Title (Arabic) *'}
                      </label>
                      <input
                        type="text"
                        value={editAuditForm.titleAr}
                        onChange={(e) => setEditAuditForm({ ...editAuditForm, titleAr: e.target.value })}
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        {language === 'ar' ? 'عنوان المراجعة (إنجليزي)' : 'Audit Title (English)'}
                      </label>
                      <input
                        type="text"
                        value={editAuditForm.titleEn}
                        onChange={(e) => setEditAuditForm({ ...editAuditForm, titleEn: e.target.value })}
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium mb-1">
                        {language === 'ar' ? 'نطاق المراجعة' : 'Audit Scope'}
                      </label>
                      <textarea
                        rows={2}
                        value={editAuditForm.scope}
                        onChange={(e) => setEditAuditForm({ ...editAuditForm, scope: e.target.value })}
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium mb-1">
                        {language === 'ar' ? 'هدف المراجعة' : 'Audit Objective'}
                      </label>
                      <textarea
                        rows={2}
                        value={editAuditForm.objective}
                        onChange={(e) => setEditAuditForm({ ...editAuditForm, objective: e.target.value })}
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* الخطوة 2: الإدارة والفريق */}
                <div className="space-y-4">
                  <h3 className="font-medium flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-[var(--primary)] text-white text-xs flex items-center justify-center">2</span>
                    {language === 'ar' ? 'الإدارة وفريق المراجعة' : 'Department & Audit Team'}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        {language === 'ar' ? 'الإدارة *' : 'Department *'}
                      </label>
                      <select
                        value={editAuditForm.departmentId}
                        onChange={(e) => setEditAuditForm({ ...editAuditForm, departmentId: e.target.value, sectionId: '' })}
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm"
                      >
                        <option value="">{language === 'ar' ? 'اختر الإدارة' : 'Select Department'}</option>
                        {allDepartments.map(dept => (
                          <option key={dept.id} value={dept.id}>
                            {language === 'ar' ? dept.nameAr : dept.nameEn}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        {language === 'ar' ? 'القسم (اختياري)' : 'Section (Optional)'}
                      </label>
                      <select
                        value={editAuditForm.sectionId}
                        onChange={(e) => setEditAuditForm({ ...editAuditForm, sectionId: e.target.value })}
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm"
                      >
                        <option value="">{language === 'ar' ? '-- كل الأقسام --' : '-- All Sections --'}</option>
                        {allSections.filter(s => s.departmentId === editAuditForm.departmentId).map(section => (
                          <option key={section.id} value={section.id}>
                            {language === 'ar' ? section.nameAr : section.nameEn}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        {language === 'ar' ? 'رئيس فريق المراجعة *' : 'Lead Auditor *'}
                      </label>
                      <select
                        value={editAuditForm.leadAuditorId}
                        onChange={(e) => setEditAuditForm({ ...editAuditForm, leadAuditorId: e.target.value })}
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm"
                      >
                        <option value="">{language === 'ar' ? 'اختر رئيس الفريق' : 'Select Lead Auditor'}</option>
                        {auditors.map(auditor => (
                          <option key={auditor.id} value={auditor.id}>
                            {language === 'ar' ? auditor.fullNameAr : auditor.fullNameEn}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        {language === 'ar' ? 'أعضاء الفريق' : 'Team Members'}
                      </label>
                      <select
                        multiple
                        value={editAuditForm.auditorIds}
                        onChange={(e) => {
                          const selected = Array.from(e.target.selectedOptions, option => option.value);
                          setEditAuditForm({ ...editAuditForm, auditorIds: selected });
                        }}
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm h-24"
                      >
                        {auditors.filter(a => a.id !== editAuditForm.leadAuditorId).map(auditor => (
                          <option key={auditor.id} value={auditor.id}>
                            {language === 'ar' ? auditor.fullNameAr : auditor.fullNameEn}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-[var(--foreground-secondary)] mt-1">
                        {language === 'ar' ? 'اضغط Ctrl للاختيار المتعدد' : 'Hold Ctrl to select multiple'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* الخطوة 3: الجدول الزمني */}
                <div className="space-y-4">
                  <h3 className="font-medium flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-[var(--primary)] text-white text-xs flex items-center justify-center">3</span>
                    {language === 'ar' ? 'الجدول الزمني' : 'Timeline'}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        {language === 'ar' ? 'تاريخ البدء *' : 'Start Date *'}
                      </label>
                      <input
                        type="date"
                        value={editAuditForm.startDate}
                        onChange={(e) => setEditAuditForm({ ...editAuditForm, startDate: e.target.value })}
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        {language === 'ar' ? 'تاريخ الانتهاء' : 'End Date'}
                      </label>
                      <input
                        type="date"
                        value={editAuditForm.endDate}
                        onChange={(e) => setEditAuditForm({ ...editAuditForm, endDate: e.target.value })}
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-2 p-4 border-t border-[var(--border)] sticky bottom-0 bg-white dark:bg-gray-900">
                <Button variant="outline" onClick={() => setShowEditAuditModal(false)}>
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </Button>
                <Button onClick={handleSaveAuditEdit} disabled={!editAuditForm.titleAr || !editAuditForm.departmentId || !editAuditForm.leadAuditorId || !editAuditForm.startDate}>
                  {language === 'ar' ? 'حفظ التعديلات' : 'Save Changes'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
