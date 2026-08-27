// قواعد تسلسل المراجعة - The rules that order an audit
//
// Everything that decides WHEN something may happen in an audit, and WHO may do it, lives
// here. It used to live in three places that disagreed: the audit list page hard-coded a
// seven-stage ladder, the audit detail page hard-coded a six-stage one, and this file held
// a third model - a schedule-confirmation gate and a questions gate - that no screen ever
// called. All three wrote the same `currentStage` field.
//
// THE ORDER IS ONE ORDER. AUDIT_STAGE_ORDER in @/types is it, and both pages now read the
// stage index through stageOf() below rather than deriving their own. The seven-stage
// ladder is gone: `questions_preparation` was never a stage anybody sat in - questions are
// prepared during planning - and its only effect was to shift every later index by one, so
// that an audit approved from the list page skipped the corrective-actions stage entirely.
//
// WHY THE PREDICATES ARE PURE. Everything that only ASKS about state is a plain function of
// the audit document - no reads, no awaits - so the same answer can gate a rule, disable a
// button and colour a badge without three round trips or three subtly different definitions
// of "approved". The transitions are pure too: they RETURN the new gate rather than writing
// it, so the audit document keeps a single writer (saveAudit in the detail page). Two
// writers on one document is what produced the stage corruption in the first place.
//
// WHY EVERY GATE IS OPTIONAL. Audits created before these fields existed carry none of them.
// Absent is read as "not started" everywhere below, never as "failed", so old audits stay
// openable instead of becoming permanently blocked on a gate they never had.
import {
  Audit,
  ApprovalGate,
  AUDIT_STAGE_ORDER,
  AuditStageId,
  User,
} from '@/types';
import { addNotification } from './firestore';
import { recordActivity } from './activity-log';
import { logger } from './logger';

// ===========================================
// من هو هذا المستخدم في هذه المراجعة
// ===========================================

type AuditParties = Pick<Audit, 'leadAuditorId' | 'auditorIds' | 'teamMemberIds' | 'auditeeId'>;

const teamOf = (audit: AuditParties): string[] =>
  audit.auditorIds ?? audit.teamMemberIds ?? [];

// إدارة الجودة ومدير النظام. صلاحيات مدير النظام في DEFAULT_PERMISSIONS تشمل
// canApproveAudits، وكانت الشاشات تفحص الدور نصاً فتحجبه - فإذا غاب مدير الجودة توقّف
// النظام كله بلا بديل.
export const isQualityStaff = (user: Pick<User, 'role'> | null | undefined): boolean =>
  user?.role === 'quality_manager' || user?.role === 'system_admin';

export const isLeadAuditorOf = (audit: AuditParties, userId: string | undefined): boolean =>
  !!userId && audit.leadAuditorId === userId;

export const isOnAuditTeam = (audit: AuditParties, userId: string | undefined): boolean =>
  !!userId && (audit.leadAuditorId === userId || teamOf(audit).includes(userId));

// الجهة المُراجَع عليها: شخص واحد مسمّى. هذا هو نفس الشرط الذي تفحصه firestore.rules،
// فما يعرضه هذا المسند للمستخدم هو بالضبط ما ستقبل القاعدة كتابته منه.
const isAuditeeOf = (audit: AuditParties, userId: string | undefined): boolean =>
  !!userId && audit.auditeeId === userId;

// هل تقبل قاعدة البيانات كتابةً من هذا المستخدم على هذه المراجعة؟ يطابق belongsToAudit
// في firestore.rules حرفاً بحرف. الشاشات تسأل هذا السؤال قبل أن تعرض زر حفظ، حتى لا
// يُعرض زر تُرفض كتابته ثم يُقال للمستخدم إنها نجحت.
export const mayWriteToAudit = (
  audit: AuditParties,
  user: Pick<User, 'id' | 'role'> | null | undefined
): boolean => {
  if (!user) return false;
  if (user.role === 'external_auditor') return false;
  return isQualityStaff(user) || isOnAuditTeam(audit, user.id) || isAuditeeOf(audit, user.id);
};

// ===========================================
// المراحل - الترتيب الواحد
// ===========================================

// كل حالة مخزَّنة وأين تقع على سُلَّم AUDIT_STAGE_ORDER.
// الحالات الأربع الأولى كلها "قبل أن تبدأ": المراجعة أُنشئت ولم تُنفَّذ بعد.
const STATUS_TO_STAGE: Record<string, number> = {
  draft: 0,
  pending_approval: 0,
  approved: 0,
  planning: 0,
  questions_preparation: 0,
  postponed: 0,
  execution: 1,
  in_progress: 1,
  qms_review: 2,
  corrective_actions: 3,
  verification: 4,
  completed: 5,
  cancelled: 5,
};

// حالات تحدد المرحلة بذاتها: أي مرحلة مخزَّنة معها لا يُعتد بها لأنها قد تكون قديمة
// (الرفض من صفحة المراجعات يغيّر الحالة إلى cancelled دون تحديث المرحلة).
const STATUS_DETERMINED = ['completed', 'cancelled'];

export const stageIndexFromStatus = (status: string): number => STATUS_TO_STAGE[status] ?? 0;

// المرحلة الحقيقية للمراجعة. المرجع الوحيد - لا تشتقّ مرحلة في صفحة.
export const stageOf = (audit: Pick<Audit, 'status' | 'currentStage'>): number => {
  if (STATUS_DETERMINED.includes(audit.status)) return stageIndexFromStatus(audit.status);
  const stored = audit.currentStage;
  if (typeof stored === 'number' && stored >= 0 && stored < AUDIT_STAGE_ORDER.length) {
    return stored;
  }
  return stageIndexFromStatus(audit.status);
};

// الحالة التي تُخزَّن مع كل مرحلة. المرحلة والحالة يتحركان معاً دائماً، وإلا وصفا شيئين مختلفين.
export const statusForStage = (index: number): AuditStageId =>
  AUDIT_STAGE_ORDER[Math.max(0, Math.min(index, AUDIT_STAGE_ORDER.length - 1))];

export const LAST_STAGE = AUDIT_STAGE_ORDER.length - 1;

// من يحرّك كل مرحلة إلى ما بعدها - المسؤول عنها، لا كل من يفتح الرابط.
//   'lead'    رئيس فريق المراجعة، ومعه إدارة الجودة دائماً
//   'quality' إدارة الجودة وحدها
// كانت الأزرار بلا أي حارس دور، فموظف الإدارة المُراجَع عليها يستطيع دفع المراجعة
// التي تُجرى عليه من مرحلة إلى مرحلة.
const STAGE_MOVER: Record<AuditStageId, 'lead' | 'quality'> = {
  planning: 'lead',
  execution: 'lead',
  qms_review: 'quality',
  corrective_actions: 'quality',
  verification: 'lead',
  completed: 'quality',
};

// ===========================================
// موافقة إنشاء المراجعة - القفل الأول
// ===========================================
//
// مراجعة ينشئها غير مدير الجودة تُحفظ بحالة pending_approval. كانت هذه الحالة تُقرأ على
// أنها المرحلة صفر ولا تمنع شيئاً: تُضاف الأسئلة، ويُضغط "الانتقال للمرحلة التالية"،
// فتُنفَّذ المراجعة قبل أن يوافق عليها أحد. الموافقة التي تُطلب من مدير الجودة كانت لا
// تغيّر شيئاً في الواقع.

export const isAwaitingCreationApproval = (audit: Pick<Audit, 'status'>): boolean =>
  audit.status === 'pending_approval';

export const isAuditClosed = (audit: Pick<Audit, 'status'>): boolean =>
  audit.status === 'completed' || audit.status === 'cancelled';

// المراجعة مقفلة: لا تُعدَّل أسئلتها ولا تُجاب ولا تتحرك مراحلها.
export const isAuditLocked = (audit: Pick<Audit, 'status'>): boolean =>
  isAwaitingCreationApproval(audit) || isAuditClosed(audit);

// ===========================================
// بوابة اعتماد الأجوبة
// ===========================================
//
// المراجع يسجّل الأجوبة والملاحظات، ومدير الجودة يعتمدها قبل أن تُعرض على الجهة
// المُراجَع عليها. هذه هي البوابة التي تهمّ: حكمٌ لم يُراجَع يُعرض على الإدارة التي
// يحكم عليها هو ملاحظة نُشرت بلا تحقق.

export const newApprovalGate = (): ApprovalGate => ({ status: 'draft' });

export const answersGateOf = (audit: Pick<Audit, 'answersGate'>): ApprovalGate =>
  audit.answersGate ?? newApprovalGate();

export const areAnswersApproved = (audit: Pick<Audit, 'answersGate'>): boolean =>
  answersGateOf(audit).status === 'approved';

export const isAwaitingAnswersApproval = (audit: Pick<Audit, 'answersGate'>): boolean =>
  answersGateOf(audit).status === 'pending_approval';

export const wereAnswersReturned = (audit: Pick<Audit, 'answersGate'>): boolean =>
  answersGateOf(audit).status === 'rejected';

// هل يبتّ هذا المستخدم في البوابة؟ إدارة الجودة ومدير النظام.
export const mayDecideGate = (user: Pick<User, 'role'> | null | undefined): boolean =>
  isQualityStaff(user);

// قاعدة الرؤية. الجهة المُراجَع عليها ترى الأجوبة والملاحظات بعد اعتماد مدير الجودة لها،
// لا قبله. ومن يُنتجها ويفحصها - فريق المراجعة وإدارة الجودة - يراها طوال الوقت.
//
// وهذا قرار عرض، وليس حاجزاً أمنياً بذاته: مستند المراجعة مقروء لكل موظف نشط، فالقارئ
// المُصرّ يستطيع جلبه. إبقاء الأجوبة غير المعتمدة خارج شاشات المُراجَع عليه هو ما يمنع
// التصرّف بناءً على حكم نصف مكتمل؛ وجعلها غير مقروءة يحتاج أن تسكن الأجوبة مجموعة
// مستقلة، وتلك خطوة تالية لا هذه.
export const mayViewAnswers = (
  audit: Pick<Audit, 'answersGate' | 'leadAuditorId' | 'auditorIds' | 'teamMemberIds' | 'auditeeId'>,
  user: Pick<User, 'id' | 'role'> | null | undefined
): boolean => {
  if (!user) return false;
  if (isQualityStaff(user)) return true;
  if (isOnAuditTeam(audit, user.id)) return true;
  // المراجع الخارجي لا يرى إلا ما اعتُمد - وهذا هو تعريف دوره
  return areAnswersApproved(audit);
};

// المراجع يرسل الأجوبة لاعتمادها. دالة خالصة: تُرجع البوابة ولا تكتبها.
export const submittedAnswersGate = (actorId: string): ApprovalGate => ({
  status: 'pending_approval',
  submittedBy: actorId,
  submittedAt: new Date().toISOString(),
});

// قرار مدير الجودة على الأجوبة.
export const decidedAnswersGate = (
  previous: ApprovalGate,
  decision: 'approved' | 'rejected',
  actorId: string,
  comment?: string
): ApprovalGate => ({
  ...previous,
  status: decision,
  decidedBy: actorId,
  decidedAt: new Date().toISOString(),
  ...(comment?.trim() ? { comment: comment.trim() } : {}),
});

// الاعتماد يسقط بتغيّر ما اعتُمد.
//
// كان الرجوع لمرحلة سابقة ينقص الرقم ولا يمسّ الاعتماد، فالمراجعة تعود إلى التنفيذ،
// تُعدَّل أجوبتها، ثم تمرّ من بوابة مراجعة الجودة مرة أخرى دون قرار جديد - لأن اعتماد
// الأمس ما زال قائماً على أجوبة اليوم. أي تعديل على الأجوبة أو الملاحظات بعد الاعتماد
// يُعيد البوابة إلى مسودة، فتُطلب الموافقة من جديد على ما صار عليه الحال.
export const invalidatedAnswersGate = (previous: ApprovalGate): ApprovalGate =>
  previous.status === 'draft'
    ? previous
    : { status: 'draft', ...(previous.comment ? { comment: previous.comment } : {}) };

// ===========================================
// شروط الانتقال بين المراحل
// ===========================================

export interface StageGateInput {
  audit: Pick<Audit,
    'status' | 'currentStage' | 'answersGate' | 'questions' | 'findings' |
    'leadAuditorId' | 'auditorIds' | 'teamMemberIds' | 'auditeeId'
  > & {
    executionConfirmed?: boolean;
    correctiveActionsApproved?: boolean;
  };
  user: Pick<User, 'id' | 'role'> | null | undefined;
}

export type StageBlock =
  | 'locked_pending_creation_approval'
  | 'closed'
  | 'not_your_stage'
  | 'last_stage'
  | 'no_questions'
  | 'execution_not_confirmed'
  | 'answers_incomplete'
  | 'answers_not_submitted'
  | 'answers_not_approved'
  | 'corrective_actions_not_approved'
  | 'auditee_has_not_responded'
  | 'findings_still_open'
  | null;

const allQuestionsAnswered = (questions: Audit['questions']): boolean => {
  const list = questions ?? [];
  return list.length > 0 && list.every(q => q.status !== 'pending');
};

const allFindingsAnswered = (findings: Audit['findings']): boolean =>
  (findings ?? []).every(f => !!f.departmentResponse);

const allFindingsClosed = (findings: Audit['findings']): boolean =>
  (findings ?? []).every(f => f.status === 'closed');

// ما الذي يمنع الانتقال للمرحلة التالية؟ null يعني: لا شيء.
//
// ترتيب الفحوص مقصود - القفل أولاً، ثم الدور، ثم شروط المرحلة - حتى تكون الرسالة
// المعروضة هي أول سبب حقيقي، لا آخر شرط فشل.
export const whatBlocksAdvance = ({ audit, user }: StageGateInput): StageBlock => {
  const stage = stageOf(audit);

  if (stage >= LAST_STAGE) return 'last_stage';
  if (isAuditClosed(audit)) return 'closed';
  if (isAwaitingCreationApproval(audit)) return 'locked_pending_creation_approval';

  const stageId = AUDIT_STAGE_ORDER[stage];
  const mover = STAGE_MOVER[stageId];
  const permitted = mover === 'quality'
    ? isQualityStaff(user)
    : isQualityStaff(user) || isLeadAuditorOf(audit, user?.id);
  if (!permitted) return 'not_your_stage';

  if (stageId === 'planning') {
    if ((audit.questions ?? []).length === 0) return 'no_questions';
    return null;
  }

  if (stageId === 'execution') {
    if (!audit.executionConfirmed) return 'execution_not_confirmed';
    if (!allQuestionsAnswered(audit.questions)) return 'answers_incomplete';
    if (!isAwaitingAnswersApproval(audit) && !areAnswersApproved(audit)) {
      return 'answers_not_submitted';
    }
    return null;
  }

  if (stageId === 'qms_review') {
    if (!areAnswersApproved(audit)) return 'answers_not_approved';
    return null;
  }

  if (stageId === 'corrective_actions') {
    if (!allFindingsAnswered(audit.findings)) return 'auditee_has_not_responded';
    if (!audit.correctiveActionsApproved) return 'corrective_actions_not_approved';
    return null;
  }

  if (stageId === 'verification') {
    if (!allFindingsClosed(audit.findings)) return 'findings_still_open';
    return null;
  }

  return null;
};

export const mayAdvanceStage = (input: StageGateInput): boolean =>
  whatBlocksAdvance(input) === null;

// الرجوع خطوة إلى الوراء: إدارة الجودة وحدها.
//
// الرجوع يُبطل قراراً اتُّخذ - وهذا فعل رقابي، لا تصحيح مسار يملكه كل من يمرّ.
export const mayRewindStage = ({ audit, user }: StageGateInput): boolean => {
  if (isAuditClosed(audit)) return false;
  if (stageOf(audit) <= 0) return false;
  return isQualityStaff(user);
};

// ===========================================
// من يُدخل ماذا، ومتى - تسلسل توقيت الإدخالات
// ===========================================

// تعديل قائمة الأسئلة: فريق المراجعة وإدارة الجودة، في التخطيط والتنفيذ، وأثناء مراجعة
// الجودة حين تُعاد الأجوبة للتعديل. ولا شيء من ذلك على مراجعة مقفلة.
export const mayEditQuestions = (
  audit: Pick<Audit, 'status' | 'currentStage' | 'answersGate' | 'leadAuditorId' | 'auditorIds' | 'teamMemberIds' | 'auditeeId'>,
  user: Pick<User, 'id' | 'role'> | null | undefined
): boolean => {
  if (isAuditLocked(audit)) return false;
  if (!isQualityStaff(user) && !isOnAuditTeam(audit, user?.id)) return false;
  const stage = stageOf(audit);
  if (stage <= 1) return true;
  return stage === 2 && wereAnswersReturned(audit);
};

// تسجيل إجابة على سؤال: فريق المراجعة، في مرحلة التنفيذ، وبعد تأكيد إتمام المراجعة
// ميدانياً - وهذا هو الترتيب الذي كانت اللافتة في الشاشة تطلبه ولا يفرضه شيء، فتُملأ
// الأجوبة قبل الزيارة أصلاً. ويُسمح به أيضاً حين تُعاد الأجوبة من مدير الجودة للتعديل.
export const mayAnswerQuestions = (
  audit: Pick<Audit, 'status' | 'currentStage' | 'answersGate' | 'leadAuditorId' | 'auditorIds' | 'teamMemberIds' | 'auditeeId'> & { executionConfirmed?: boolean },
  user: Pick<User, 'id' | 'role'> | null | undefined
): boolean => {
  if (isAuditLocked(audit)) return false;
  if (!isOnAuditTeam(audit, user?.id)) return false;
  if (!audit.executionConfirmed) return false;
  const stage = stageOf(audit);
  if (stage === 1) return true;
  return stage === 2 && wereAnswersReturned(audit);
};

// تسجيل ملاحظة: فريق المراجعة، في التنفيذ أو أثناء تعديل مطلوب من مدير الجودة.
export const mayRecordFindings = (
  audit: Pick<Audit, 'status' | 'currentStage' | 'answersGate' | 'leadAuditorId' | 'auditorIds' | 'teamMemberIds' | 'auditeeId'> & { executionConfirmed?: boolean },
  user: Pick<User, 'id' | 'role'> | null | undefined
): boolean => mayAnswerQuestions(audit, user);

// رد الجهة المُراجَع عليها على ملاحظة: بعد اعتماد الأجوبة فقط - قبل ذلك لم تُعرض عليها
// أصلاً - وفي مرحلة الإجراءات التصحيحية.
export const mayRespondToFinding = (
  audit: Pick<Audit, 'status' | 'currentStage' | 'answersGate' | 'leadAuditorId' | 'auditorIds' | 'teamMemberIds' | 'auditeeId'>,
  user: Pick<User, 'id' | 'role'> | null | undefined
): boolean => {
  if (isAuditLocked(audit)) return false;
  if (!areAnswersApproved(audit)) return false;
  if (stageOf(audit) !== 3) return false;
  return isAuditeeOf(audit, user?.id) || isQualityStaff(user);
};

// إدخال السبب الجذري والإجراء التصحيحي: بعد اعتماد الملاحظة، لا أثناء تسجيلها.
// كان الزر مشروطاً بحالة الملاحظة وحدها، فيُكتب علاجٌ لعلّة لم تُقرّ بعد.
export const mayEnterCorrectiveAction = (
  audit: Pick<Audit, 'status' | 'currentStage' | 'answersGate' | 'leadAuditorId' | 'auditorIds' | 'teamMemberIds' | 'auditeeId'>,
  user: Pick<User, 'id' | 'role'> | null | undefined
): boolean => {
  if (isAuditLocked(audit)) return false;
  if (!areAnswersApproved(audit)) return false;
  if (stageOf(audit) !== 3) return false;
  return isAuditeeOf(audit, user?.id) || isOnAuditTeam(audit, user?.id) || isQualityStaff(user);
};

// اعتماد مدير الجودة للإجراءات التصحيحية - الشرط الذي كان مطلوباً للانتقال ولا يوجد
// في النظام كله زر يمنحه، فتتجمّد كل مراجعة تصل إلى هذه المرحلة إلى الأبد.
export const mayApproveCorrectiveActions = (
  audit: Pick<Audit, 'status' | 'currentStage' | 'findings'> & { correctiveActionsApproved?: boolean },
  user: Pick<User, 'id' | 'role'> | null | undefined
): boolean => {
  if (isAuditLocked(audit)) return false;
  if (audit.correctiveActionsApproved) return false;
  if (stageOf(audit) !== 3) return false;
  if (!allFindingsAnswered(audit.findings)) return false;
  return isQualityStaff(user);
};

// التحقق من الإجراء وإغلاق الملاحظة: المراجع أو إدارة الجودة - وليس الجهة التي رُفعت
// عليها الملاحظة. كان الزر بلا فحص دور إطلاقاً، فتُغلق الإدارة الملاحظة المرفوعة عليها
// بنفسها، وهو ما يُبطل معنى التحقق. والدليل شرط: إغلاق بلا دليل ليس تحققاً.
export const mayVerifyFinding = (
  audit: Pick<Audit, 'status' | 'currentStage' | 'leadAuditorId' | 'auditorIds' | 'teamMemberIds' | 'auditeeId'>,
  finding: { status: string; departmentResponse?: unknown },
  user: Pick<User, 'id' | 'role'> | null | undefined
): boolean => {
  if (isAuditLocked(audit)) return false;
  if (stageOf(audit) !== 4) return false;
  if (finding.status === 'closed') return false;
  if (!finding.departmentResponse) return false;
  if (isAuditeeOf(audit, user?.id) && !isQualityStaff(user)) return false;
  return isOnAuditTeam(audit, user?.id) || isQualityStaff(user);
};

// ===========================================
// الاستقلالية - استقلالية المراجع
// ===========================================
//
// A person may not audit their own area. ISO 9001:2015 clause 9.2.2(c) puts it plainly -
// "the auditors shall not audit their own work" - and it is the property that makes an
// internal audit worth anything at all: a section head reviewing their own section will
// find what they already knew and nothing else.
//
// Enforced here as a shared predicate rather than a filter written twice, because it was
// missing from BOTH lists: the annual-plan line editor and the new-audit wizard each
// offered the audited department's own manager as lead auditor.
export const isIndependentOf = (
  user: Pick<User, 'departmentId' | 'sectionId' | 'auditableDepartmentIds'>,
  departmentId: string,
  sectionId?: string
): boolean => {
  if (!departmentId) return true;                       // لم تُختر إدارة بعد
  if (user.departmentId === departmentId) return false;  // إدارته نفسها
  if (sectionId && user.sectionId === sectionId) return false;
  // حين تكون صلاحيات المراجعة محدّدة صراحة، تُحترم كما هي
  const allowed = user.auditableDepartmentIds ?? [];
  return allowed.length === 0 || allowed.includes(departmentId);
};

// من هو المُراجَع عليه في إدارة أو قسم؟ رئيس القسم حين تُراجَع أقسام بعينها، وإلا فمدير
// الإدارة. يُشتق عند إنشاء المراجعة ويُخزَّن، لأن القاعدة في firestore.rules تقرأ الحقل
// المخزَّن لا الاشتقاق.
export const deriveAuditeeId = (
  users: Pick<User, 'id' | 'role' | 'departmentId' | 'sectionId' | 'isActive'>[],
  departmentId: string,
  sectionId?: string
): string | undefined => {
  if (!departmentId) return undefined;
  const active = users.filter(u => u.isActive);
  if (sectionId) {
    const head = active.find(u => u.role === 'section_head' && u.sectionId === sectionId);
    if (head) return head.id;
  }
  const manager = active.find(u => u.role === 'department_manager' && u.departmentId === departmentId);
  return manager?.id;
};

// ===========================================
// الآثار الجانبية - الإشعارات وسجل النشاط
// ===========================================
//
// Notifications and the activity log must never decide whether the operation succeeded:
// the write to the audit is the operation. These are fire-and-forget on purpose, and they
// are called by the page AFTER its own write returned true - never before it, and never
// instead of it.

const notify = (
  recipientId: string | undefined,
  n: { type: Parameters<typeof addNotification>[0]['type']; title: string; message: string; auditId: string; senderId: string }
): void => {
  if (!recipientId) return;
  void addNotification({ ...n, recipientId }).catch(error =>
    logger.error('Could not send audit-workflow notification:', error)
  );
};

const nameOf = (user: Pick<User, 'fullNameAr' | 'fullNameEn'>): string =>
  user.fullNameAr || user.fullNameEn;

export const logAuditAction = (
  actor: Pick<User, 'id' | 'fullNameAr' | 'fullNameEn' | 'email' | 'role'>,
  entry: { action: 'submit' | 'approve' | 'reject' | 'update'; entityId: string; entityLabel: string; summaryAr: string; summaryEn: string }
): void => {
  void recordActivity({
    actorUserId: actor.id,
    actorName: actor.fullNameEn || actor.fullNameAr,
    actorEmail: actor.email ?? '',
    actorRole: actor.role,
    entity: 'audit',
    ...entry,
  });
};

// إشعار طلب اعتماد الأجوبة - يذهب لإدارة الجودة، ولا يذهب للمُراجَع عليه.
export const notifyAnswersSubmitted = (
  audit: Pick<Audit, 'id' | 'titleAr' | 'titleEn'>,
  actor: Pick<User, 'id' | 'fullNameAr' | 'fullNameEn' | 'email' | 'role'>,
  qualityStaffIds: string[]
): void => {
  qualityStaffIds.forEach(recipientId =>
    notify(recipientId, {
      type: 'answers_approval_request',
      title: 'طلب اعتماد أجوبة مراجعة',
      message: `أرسل ${nameOf(actor)} أجوبة مراجعة "${audit.titleAr}" وملاحظاتها لاعتمادها.`,
      auditId: audit.id,
      senderId: actor.id,
    })
  );

  logAuditAction(actor, {
    action: 'submit',
    entityId: audit.id,
    entityLabel: audit.titleAr,
    summaryAr: `أرسل ${nameOf(actor)} أجوبة مراجعة "${audit.titleAr}" لاعتمادها من إدارة الجودة.`,
    summaryEn: `${nameOf(actor)} submitted the answers for "${audit.titleEn}" for quality approval.`,
  });
};
