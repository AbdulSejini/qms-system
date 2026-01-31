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
  | 'employee';         // موظف عادي - صلاحيات محدودة

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

// سؤال المراجعة
export interface AuditQuestion {
  id: string;
  auditId: string;
  questionAr: string;
  questionEn: string;
  clause?: string;          // بند المعيار المرتبط
  answer?: string;
  status: 'pending' | 'answered' | 'finding_raised';
  findingId?: string;       // معرف الملاحظة إذا تم رفعها
  answeredBy?: string;
  answeredAt?: Date;
  createdAt: Date;
}

// المراجعة
export interface Audit {
  id: string;
  number: string;
  titleAr: string;
  titleEn: string;
  type: AuditType;
  currentStage: AuditWorkflowStage;

  // الإدارة/القسم المدقق عليه
  departmentId: string;
  sectionId?: string;

  // فريق المراجعة
  leadAuditorId: string;
  auditorIds: string[];     // المراجعين المشاركين

  // المواعيد
  plannedStartDate: Date;
  plannedEndDate: Date;
  actualStartDate?: Date;
  actualEndDate?: Date;

  // تفاصيل المراجعة
  scopeAr?: string;
  scopeEn?: string;
  objectivesAr?: string;
  objectivesEn?: string;

  // مراجعة الإدارة
  managementReviewNotes?: string;
  managementApprovedBy?: string;
  managementApprovedAt?: Date;

  // إحصائيات
  questionsCount: number;
  answeredCount: number;
  findingsCount: number;

  createdAt: Date;
  updatedAt: Date;
}

export interface AuditFinding {
  id: string;
  auditId: string;
  questionId?: string;      // السؤال المرتبط
  number: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  severity: FindingSeverity;
  status: FindingStatus;
  clause?: string;

  // المسؤول عن الإجراء التصحيحي
  responsibleId: string;
  responsibleDepartmentId: string;
  responsibleSectionId?: string;

  // الإجراء التصحيحي
  correctiveActionAr?: string;
  correctiveActionEn?: string;
  rootCauseAr?: string;
  rootCauseEn?: string;

  dueDate: Date;
  closedAt?: Date;
  verifiedBy?: string;
  verifiedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
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
