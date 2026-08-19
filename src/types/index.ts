// Language types
export type Language = 'ar' | 'en';

// ===========================================
// Role & Permission Types
// ===========================================

// أدوار النظام الرئيسية
export type UserRole =
  | 'system_admin'      // مدير النظام - صلاحيات كاملة
  | 'quality_manager'   // مدير إدارة الجودة - صلاحيات كاملة على الجودة
  | 'auditor'           // مراجع داخلي - يمكنه إجراء المراجعات
  | 'department_manager' // مدير إدارة - صلاحيات على إدارته فقط
  | 'section_head'      // رئيس قسم - صلاحيات على قسمه فقط
  | 'employee'          // موظف عادي - صلاحيات محدودة
  // مراجع خارجي - جهة المنح. قراءة فقط، ولا يرى إلا ما اعتُمد رسمياً.
  // A certification-body assessor. Read-only everywhere, and shown only what has been
  // formally approved - never a draft, never an unapproved answer.
  | 'external_auditor';

// صلاحيات المستخدم
export interface Permission {
  canManageUsers: boolean;        // إدارة المستخدمين
  canManageDepartments: boolean;  // إدارة الإدارات والأقسام
  canManageAudits: boolean;       // إدارة المراجعات
  canConductAudits: boolean;      // إجراء المراجعات كمراجع
  canManageDocuments: boolean;    // إدارة المستندات
  canViewAllData: boolean;        // عرض جميع البيانات
  canApproveAudits: boolean;      // اعتماد نتائج المراجعات
  canDeleteAudits: boolean;       // حذف المراجعات والملاحظات - مدير النظام ومدير الجودة فقط
}

// الصلاحيات الافتراضية لكل دور
export const DEFAULT_PERMISSIONS: Record<UserRole, Permission> = {
  system_admin: {
    canManageUsers: true,
    canManageDepartments: true,
    canManageAudits: true,
    canConductAudits: true,
    canManageDocuments: true,
    canViewAllData: true,
    canApproveAudits: true,
    canDeleteAudits: true,
  },
  quality_manager: {
    canManageUsers: false,
    canManageDepartments: true,
    canManageAudits: true,
    canConductAudits: true,
    canManageDocuments: true,
    canViewAllData: true,
    canApproveAudits: true,
    canDeleteAudits: true,
  },
  auditor: {
    canManageUsers: false,
    canManageDepartments: false,
    canManageAudits: false,
    canConductAudits: true,
    canManageDocuments: false,
    canViewAllData: false,
    canApproveAudits: false,
    canDeleteAudits: false,
  },
  department_manager: {
    canManageUsers: false,
    canManageDepartments: false,
    canManageAudits: false,
    canConductAudits: false,
    canManageDocuments: true,
    canViewAllData: false,
    canApproveAudits: false,
    canDeleteAudits: false,
  },
  section_head: {
    canManageUsers: false,
    canManageDepartments: false,
    canManageAudits: false,
    canConductAudits: false,
    canManageDocuments: false,
    canViewAllData: false,
    canApproveAudits: false,
    canDeleteAudits: false,
  },
  employee: {
    canManageUsers: false,
    canManageDepartments: false,
    canManageAudits: false,
    canConductAudits: false,
    canManageDocuments: false,
    canViewAllData: false,
    canApproveAudits: false,
    canDeleteAudits: false,
  },
  // المراجع الخارجي يرى كل شيء ولا يغيّر أي شيء.
  // canViewAllData is the only true here, and that is the entire role: a certification
  // body has to be able to see the programme whole - it just may never touch it. Every
  // write in firestore.rules is denied to this role outright, so the flags below are a
  // description of that, not the thing enforcing it.
  external_auditor: {
    canManageUsers: false,
    canManageDepartments: false,
    canManageAudits: false,
    canConductAudits: false,
    canManageDocuments: false,
    canViewAllData: true,
    canApproveAudits: false,
    canDeleteAudits: false,
  },
};

// ===========================================
// Organization Structure Types
// ===========================================

// الإدارة
export interface Department {
  id: string;
  code: string;           // رمز الإدارة مثل HR, QA, PROD
  nameAr: string;
  nameEn: string;
  descriptionAr?: string;
  descriptionEn?: string;
  managerId?: string;     // معرف مدير الإدارة
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// القسم
export interface Section {
  id: string;
  code: string;           // رمز القسم
  departmentId: string;   // معرف الإدارة التابع لها
  nameAr: string;
  nameEn: string;
  descriptionAr?: string;
  descriptionEn?: string;
  headId?: string;        // معرف رئيس القسم
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ===========================================
// User & Employee Types
// ===========================================

// المستخدم الكامل
export interface User {
  id: string;
  employeeNumber: string;  // الرقم الوظيفي
  email: string;
  fullNameAr: string;
  fullNameEn: string;
  role: UserRole;

  // الانتماء التنظيمي
  departmentId: string;
  sectionId?: string;

  // هل يمكنه أن يكون مراجع؟ (بغض النظر عن دوره الأساسي)
  canBeAuditor: boolean;

  // الإدارات/الأقسام التي يمكنه مراجعتها (إذا كان مراجع)
  auditableDepartmentIds: string[];
  auditableSectionIds: string[];

  // معلومات إضافية
  phone?: string;
  jobTitleAr?: string;
  jobTitleEn?: string;

  isActive: boolean;
  isSystemAccount?: boolean; // حساب نظام مخفي - لا يظهر في الإحصائيات والقوائم

  // التهيئة برمز وصول لمرة واحدة - لا يوجد بريد إلكتروني للنظام
  // Code-based onboarding. There is no working email service, so a new employee signs in
  // with the one-time ACCESS CODE their manager handed them in person; while this flag is
  // true they may do nothing but set a real password. Cleared by setMustChangePassword.
  mustChangePassword?: boolean;
  onboardedAt?: string;    // ISO - when the employee set their own password and finished onboarding

  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// تعيين المستخدم كمدقق عليه في مراجعة معينة
export interface AuditAssignment {
  id: string;
  auditId: string;
  userId: string;          // المدقق عليه
  departmentId: string;
  sectionId?: string;
  assignedAt: Date;
  status: 'pending' | 'in_progress' | 'completed';
}

// ===========================================
// Document types
// ===========================================

export type DocumentStatus = 'draft' | 'pending_review' | 'approved' | 'rejected' | 'archived';
export type DocumentCategory = 'policy' | 'procedure' | 'work_instruction' | 'form' | 'record' | 'manual';

export interface Document {
  id: string;
  number: string;
  titleAr: string;
  titleEn: string;
  descriptionAr?: string;
  descriptionEn?: string;
  category: DocumentCategory;
  version: string;
  status: DocumentStatus;
  departmentId: string;
  sectionId?: string;
  ownerId: string;
  reviewerId?: string;
  approverId?: string;
  effectiveDate?: Date;
  expiryDate?: Date;
  filePath?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ===========================================
// Audit types
// ===========================================

// مراحل سير عمل المراجعة
export type AuditWorkflowStage =
  | 'planning'              // التخطيط
  | 'questions_preparation' // إعداد الأسئلة
  | 'in_progress'           // قيد التنفيذ
  | 'awaiting_management'   // في انتظار الإدارة
  | 'management_approved'   // موافقة الإدارة
  | 'corrective_action'     // الإجراء التصحيحي
  | 'completed'             // مكتمل
  | 'cancelled';            // ملغي

export type AuditType = 'internal' | 'external' | 'surveillance' | 'certification';
export type FindingSeverity = 'observation' | 'minor' | 'major' | 'critical';
export type FindingStatus = 'open' | 'in_progress' | 'closed' | 'verified';

// ===========================================
// Schedule confirmation - تأكيد موعد المراجعة
// ===========================================
//
// A planned date is a PROPOSAL until both the auditor and the auditee have said yes.
// Either side may instead ask for a different date, with a reason - which is the point:
// an audit forced onto a date the auditee cannot make is an audit that does not happen,
// and one that nobody recorded as having been refused.

export type ScheduleResponseStatus =
  | 'pending'                // لم يرد بعد
  | 'accepted'               // وافق على الموعد
  | 'reschedule_requested';  // طلب موعداً آخر

export interface SchedulePartyResponse {
  status: ScheduleResponseStatus;
  respondedAt?: string;          // ISO
  comment?: string;              // سبب طلب التغيير
  proposedStartDate?: string;    // ISO - الموعد البديل المقترح
}

export interface AuditScheduleConfirmation {
  auditor: SchedulePartyResponse;
  auditee: SchedulePartyResponse;
}

// ===========================================
// Approval gate - بوابة اعتماد
// ===========================================
//
// One shape for both points where the quality manager signs off inside an audit: the
// question list before the audit runs, and the answers before the auditee is shown them.
// Deliberately the same structure as the AnnualPlan approval fields, so the two read alike.

export type ApprovalGateStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected';

export interface ApprovalGate {
  status: ApprovalGateStatus;
  submittedBy?: string;     // user id
  submittedAt?: string;     // ISO
  decidedBy?: string;       // user id - مدير الجودة الذي اعتمد أو رفض
  decidedAt?: string;       // ISO
  comment?: string;         // سبب الرفض أو تعليق الاعتماد
}

// THE SHAPES BELOW DESCRIBE WHAT IS ACTUALLY STORED.
//
// There used to be two different `Audit` interfaces - an aspirational one here and the real
// one in src/lib/firestore.ts - and they disagreed about `currentStage` (a string union here,
// a number there). Nothing imported this one, so the disagreement was invisible until
// something tried to write through both. These are now the single definition, matched to the
// documents in Firestore, and firestore.ts re-exports them rather than declaring its own.

// مرفق - ملف محلي أو من OneDrive
export interface AttachmentFile {
  type: 'local' | 'onedrive';
  name: string;
  size?: number;
  webUrl?: string;   // OneDrive فقط
  id?: string;       // OneDrive فقط
}

// قيد في سجل نشاط المراجعة - سجل داخل مستند المراجعة، منفصل عن activityLog العام
export interface AuditActivityLogEntry {
  id: string;
  type: string;
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

// موافقة إدارة الجودة - الهيكل القديم المحفوظ للتوافق
export interface QMSApprovalLegacy {
  approved: boolean;
  comment: string;
  date: string;
  approvedBy: string;
}

// ===========================================
// Finding categories - تصنيف الملاحظات
// ===========================================
//
// ONE definition, because there were two and they disagreed. The audit screen wrote
// `noteworthy` and the audit list rendered `opportunity`, so every "جهد ملحوظ" finding
// showed up on the list with a blank category. Both screens now read this.

export const FINDING_CATEGORY_A = [
  { value: 'quality',     labelAr: 'الجودة',                  labelEn: 'Quality' },
  { value: 'ohsas',       labelAr: 'السلامة والصحة المهنية',  labelEn: 'OHSAS' },
  { value: 'environment', labelAr: 'البيئة',                  labelEn: 'Environment' },
] as const;

export const FINDING_CATEGORY_B = [
  { value: 'major_nc',    labelAr: 'عدم مطابقة رئيسي', labelEn: 'Major Non-Conformity' },
  { value: 'minor_nc',    labelAr: 'عدم مطابقة ثانوي', labelEn: 'Minor Non-Conformity' },
  { value: 'observation', labelAr: 'ملاحظة',           labelEn: 'Observation' },
  { value: 'noteworthy',  labelAr: 'جهد ملحوظ',        labelEn: 'Noteworthy Effort' },
] as const;

export type FindingCategoryA = (typeof FINDING_CATEGORY_A)[number]['value'];
export type FindingCategoryB = (typeof FINDING_CATEGORY_B)[number]['value'];

// عدم المطابقة وحدها هي ما يُحتسب NCR؛ الملاحظة والجهد الملحوظ ليسا كذلك.
export const isNonConformity = (categoryB: string): boolean =>
  categoryB === 'major_nc' || categoryB === 'minor_nc';

// تعليق على ملاحظة - نقاش بين المراجع والإدارة
export interface FindingComment {
  id: string;
  findingId: string;
  userId: string;
  comment: string;
  createdAt: string;
  attachments?: AttachmentFile[];
}

// رد الإدارة على الإجراء التصحيحي
export interface DepartmentResponse {
  approvedBy: string;
  approvedAt: string;
  closingDate: string;
  comment?: string;
  attachments?: AttachmentFile[];
}

// سؤال في قائمة المراجعة
export interface AuditQuestion {
  id: string;
  questionAr: string;
  questionEn: string;
  clause: string;               // بند المعيار المرتبط
  answer?: string;
  status: 'pending' | 'compliant' | 'non_compliant' | 'not_applicable';
  findingId?: string;           // معرف الملاحظة إذا رُفعت من هذا السؤال
  notes?: string;
  attachments?: AttachmentFile[];
}

// طلب تمديد - يُستخدم لمواعيد الإغلاق ولمواعيد المراجعة
export interface ExtensionRequest {
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

// ملاحظة المراجعة - عدم مطابقة أو ملاحظة أو فرصة تحسين
//
// التصنيف على محورين: المجال (جودة/سلامة/بيئة) ونوع الملاحظة.
// Two axes, both stored as the raw option values the audit screen writes:
//   categoryA  quality | ohsas | environment
//   categoryB  major_nc | minor_nc | observation | noteworthy
export interface AuditFinding {
  id: string;
  reportNumber: string;
  departmentId: string;
  sectionId?: string;
  focusArea?: string;
  clause: string;
  finding: string;              // نص الملاحظة
  evidence: string;             // الدليل الموضوعي
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
  comments?: FindingComment[];
  departmentResponse?: DepartmentResponse;
  qmsApprovedCorrectiveAction?: boolean;
  qmsApprovalDate?: string;
  qmsApprovalComment?: string;
}

// الحالة المخزَّنة للمراجعة
export type AuditStoredStatus =
  | 'draft' | 'pending_approval' | 'approved' | 'in_progress' | 'completed'
  | 'cancelled' | 'postponed' | 'planning' | 'execution' | 'qms_review'
  | 'corrective_actions' | 'verification';

// المراجعة
export interface Audit {
  id: string;
  number?: string;
  titleAr: string;
  titleEn: string;
  type: AuditType;
  status: AuditStoredStatus;

  // المرحلة مخزَّنة كرقم، لا كنص - انظر AUDIT_STAGE_ORDER أدناه
  currentStage?: number;

  departmentId: string;
  sectionId?: string;

  // فريق المراجعة. teamMemberIds هو الحقل المخزَّن؛ صفحة تفاصيل المراجعة تحمّله
  // إلى auditorIds في الذاكرة وتحفظه إليه مرة أخرى. كلاهما مذكور هنا لأن كليهما موجود فعلاً.
  leadAuditorId: string;
  teamMemberIds?: string[];
  auditorIds?: string[];

  // الجهة المُراجَع عليها
  auditeeId?: string;

  startDate: string;
  endDate: string;

  scope?: string;
  objectives?: string;
  objective?: string;
  criteria?: string;

  questions?: AuditQuestion[];
  findings?: AuditFinding[];

  // البوابات الثلاث - انظر src/lib/audit-workflow.ts
  schedule?: AuditScheduleConfirmation;
  questionsGate?: ApprovalGate;
  answersGate?: ApprovalGate;

  qmsApproval?: QMSApprovalLegacy;
  qmsApprovalData?: QMSApprovalData;
  activityLog?: AuditActivityLogEntry[];

  createdBy?: string;
  createdAt: string;
  updatedAt?: string;

  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  postponedTo?: string;
  postponeReason?: string;

  executionConfirmed?: boolean;
  executionConfirmedAt?: string;
  executionConfirmedBy?: string;

  correctiveActionsApproved?: boolean;
  correctiveActionsApprovedAt?: string;
  correctiveActionsApprovedBy?: string;
  correctiveActionsApprovalComment?: string;
}

// ترتيب المراحل كما تخزَّن: currentStage هو فهرس في هذه القائمة.
// The audit screen and the audit list each hard-coded their own stage array, of six and
// seven entries. This is the one order both should read.
export const AUDIT_STAGE_ORDER = [
  'planning',
  'execution',
  'qms_review',
  'corrective_actions',
  'verification',
  'completed',
] as const;

export type AuditStageId = (typeof AUDIT_STAGE_ORDER)[number];

export const stageIdFromIndex = (index: number | undefined): AuditStageId =>
  AUDIT_STAGE_ORDER[index ?? 0] ?? 'planning';

export const stageIndexFromId = (id: string): number => {
  const found = AUDIT_STAGE_ORDER.indexOf(id as AuditStageId);
  return found === -1 ? 0 : found;
};

// ===========================================
// Annual Audit Plan Types - خطة المراجعة الداخلية السنوية
// ===========================================

// حالة الخطة السنوية - يعتمدها المدير المختار من قِبل مدير الجودة
export type AnnualPlanStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected';

// بند واحد في الخطة السنوية - مراجعة مخططة لإدارة/قسم في شهر معين
export interface AnnualPlanItem {
  id: string;
  departmentId: string;
  sectionId?: string;
  plannedMonth: number;        // 1-12
  auditType: AuditType;
  leadAuditorId?: string;
  // بقية فريق المراجعة إلى جانب رئيسه. يختارهم مدير الجودة على البند نفسه، فينتقلون
  // مع البند إلى نموذج إنشاء المراجعة. لا يحتوي رئيس الفريق أبداً - هو حقل مستقل.
  auditorIds?: string[];
  notes?: string;
  auditId?: string;            // set once the scheduled audit is created from this line
}

// الخطة السنوية للمراجعة الداخلية
export interface AnnualPlan {
  id: string;
  year: number;
  titleAr: string;
  titleEn: string;
  status: AnnualPlanStatus;
  items: AnnualPlanItem[];
  approverId: string;          // chosen by the quality manager, never hardcoded
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  approverComment?: string;
}

// ===========================================
// Helper Types
// ===========================================

// للعرض في القوائم
export interface DepartmentWithSections extends Department {
  sections: Section[];
  manager?: User;
}

export interface SectionWithUsers extends Section {
  head?: User;
  employees: User[];
}

// للبحث والفلترة
export interface UserFilter {
  departmentId?: string;
  sectionId?: string;
  role?: UserRole;
  canBeAuditor?: boolean;
  isActive?: boolean;
  searchQuery?: string;
}

// Legacy support - للتوافق مع الكود القديم
export type AuditStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled';

// ===========================================
// QMS Review Types - أنواع مراجعة إدارة الجودة
// ===========================================

// قرارات مدير إدارة الجودة
export type QMSDecision = 'approved' | 'rejected' | 'postponed' | 'modification_requested';

// التعليقات والردود في مراجعة إدارة الجودة
export interface QMSComment {
  id: string;
  content: string;
  authorId: string;
  createdAt: string;
  isFromQMSManager: boolean;
}

// سجل التعديلات والقرارات
export interface QMSModificationEntry {
  id: string;
  date: string;
  modifiedBy: string;
  description: string;
  decision: QMSDecision;
  comment: string;
}

// هيكل بيانات الموافقة الكامل
export interface QMSApprovalData {
  currentDecision: QMSDecision | null;
  comments: QMSComment[];
  history: QMSModificationEntry[];
  lastUpdated: string;
}

// ===========================================
// System Activity Log Types - سجل نشاط النظام
// ===========================================
//
// A complete record of who signed in and who created, changed or deleted anything.
// Readable by the system administrator only. Append-only: entries are never updated
// and never deleted, which is the whole point of keeping them.

// نوع الإجراء المسجل
export type ActivityAction =
  | 'login'
  | 'logout'
  | 'login_failed'
  | 'create'
  | 'update'
  | 'delete'
  | 'approve'
  | 'reject'
  | 'submit'
  | 'password_change';

// قيد واحد في سجل النشاط
export interface ActivityEntry {
  id: string;
  at: string;                 // ISO
  actorUserId: string;        // Firestore user doc id, '' when sign-in failed before identification
  // The actor's details are denormalised on purpose: the log has to stay readable years
  // later, including for an employee whose user document has since been deleted.
  actorName: string;
  actorEmail: string;
  actorRole: string;
  action: ActivityAction;
  entity: string;             // 'audit' | 'finding' | 'annualPlan' | 'user' | 'department' | 'section' | 'session'
  entityId?: string;
  entityLabel?: string;       // human-readable name of the thing acted on
  summaryAr: string;          // a full sentence describing exactly what happened
  summaryEn: string;
  changes?: { field: string; from?: string; to?: string }[];  // field-level diff for updates
}
