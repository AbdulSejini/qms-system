// The three gates an audit has to pass - بوابات دورة المراجعة الثلاث
//
// Between "an audit exists" and "the auditee is told what was found" the lifecycle turns
// on three agreements that nothing in the system used to record:
//
//   1. THE DATE          a planned date is a PROPOSAL. It becomes the date only once the
//                        auditor AND the auditee have each accepted it. Either may ask for
//                        a different one instead, with a reason and a suggested date.
//   2. THE QUESTIONS     the auditor assembles the checklist; the QUALITY MANAGER approves
//                        it before the audit is conducted. An audit run against questions
//                        nobody approved is an audit whose scope nobody agreed to.
//   3. THE ANSWERS       the auditor records the answers; the QUALITY MANAGER approves them
//                        before the AUDITEE is shown anything. This is the one that matters
//                        most: an unreviewed answer shown to the department it judges is a
//                        finding published without verification.
//
// WHY THE PREDICATES ARE PURE. Everything that only ASKS about state is a plain function of
// the audit document - no reads, no awaits - so the same answer can be used to gate a rule,
// disable a button and colour a badge without three round trips or three subtly different
// definitions of "approved".
//
// WHY EVERY GATE IS OPTIONAL. Audits created before these fields existed carry none of them.
// Absent is read as "not started" everywhere below, never as "failed", so old audits stay
// openable instead of becoming permanently blocked on a gate they never had.
import {
  Audit,
  ApprovalGate,
  ApprovalGateStatus,
  AuditScheduleConfirmation,
  SchedulePartyResponse,
  User,
} from '@/types';
import { updateAudit, addNotification } from './firestore';
import { recordActivity } from './activity-log';
import { logger } from './logger';

// ===========================================
// Defaults
// ===========================================

const pendingResponse = (): SchedulePartyResponse => ({ status: 'pending' });

// The state an audit starts in: a date proposed to two people, neither of whom has answered.
export const newScheduleConfirmation = (): AuditScheduleConfirmation => ({
  auditor: pendingResponse(),
  auditee: pendingResponse(),
});

export const newApprovalGate = (): ApprovalGate => ({ status: 'draft' });

// ===========================================
// Reading the state - دوال قراءة الحالة
// ===========================================

export const scheduleOf = (audit: Pick<Audit, 'schedule'>): AuditScheduleConfirmation =>
  audit.schedule ?? newScheduleConfirmation();

export const questionsGateOf = (audit: Pick<Audit, 'questionsGate'>): ApprovalGate =>
  audit.questionsGate ?? newApprovalGate();

export const answersGateOf = (audit: Pick<Audit, 'answersGate'>): ApprovalGate =>
  audit.answersGate ?? newApprovalGate();

// الموعد مؤكَّد فقط حين يقبله الطرفان
export const isScheduleConfirmed = (audit: Pick<Audit, 'schedule'>): boolean => {
  const s = scheduleOf(audit);
  return s.auditor.status === 'accepted' && s.auditee.status === 'accepted';
};

// أحد الطرفين طلب موعداً آخر - المراجعة لا تمضي حتى يُحسم ذلك
export const isRescheduleRequested = (audit: Pick<Audit, 'schedule'>): boolean => {
  const s = scheduleOf(audit);
  return s.auditor.status === 'reschedule_requested' || s.auditee.status === 'reschedule_requested';
};

// من لم يرد بعد - يُعرض لمدير الجودة حتى يعرف على من ينتظر
export const awaitingScheduleFrom = (audit: Pick<Audit, 'schedule'>): ('auditor' | 'auditee')[] => {
  const s = scheduleOf(audit);
  const waiting: ('auditor' | 'auditee')[] = [];
  if (s.auditor.status === 'pending') waiting.push('auditor');
  if (s.auditee.status === 'pending') waiting.push('auditee');
  return waiting;
};

export const areQuestionsApproved = (audit: Pick<Audit, 'questionsGate'>): boolean =>
  questionsGateOf(audit).status === 'approved';

export const areAnswersApproved = (audit: Pick<Audit, 'answersGate'>): boolean =>
  answersGateOf(audit).status === 'approved';

// THE VISIBILITY RULE. The auditee sees the answers only after the quality manager has
// approved them. Everyone else on the audit - the auditors and quality staff - sees them
// throughout, because they are the ones producing and checking them.
//
// This is a DISPLAY decision, and it is not a security boundary on its own: the audit
// document is readable by every active employee, so a determined reader could still fetch
// it. Keeping unapproved answers out of the auditee's screens is what stops a half-finished
// judgement from being acted on; making it unreadable would need answers to live in their
// own collection, which is the next step, not this one.
export const mayViewAnswers = (
  audit: Pick<Audit, 'answersGate' | 'leadAuditorId' | 'auditorIds' | 'auditeeId'>,
  user: Pick<User, 'id' | 'role'>
): boolean => {
  if (user.role === 'system_admin' || user.role === 'quality_manager') return true;
  if (audit.leadAuditorId === user.id) return true;
  if ((audit.auditorIds ?? []).includes(user.id)) return true;
  // المراجع الخارجي لا يرى إلا ما اعتُمد - وهذا هو تعريف دوره
  if (user.role === 'external_auditor') return areAnswersApproved(audit);
  if (audit.auditeeId === user.id) return areAnswersApproved(audit);
  return areAnswersApproved(audit);
};

// هل يستطيع هذا المستخدم البتّ في بوابة اعتماد؟ مدير الجودة ومدير النظام فقط.
export const mayDecideGate = (user: Pick<User, 'role'>): boolean =>
  user.role === 'quality_manager' || user.role === 'system_admin';

// دور هذا المستخدم في هذه المراجعة بالنسبة لتأكيد الموعد
export const schedulePartyFor = (
  audit: Pick<Audit, 'leadAuditorId' | 'auditorIds' | 'auditeeId'>,
  userId: string
): 'auditor' | 'auditee' | null => {
  if (audit.leadAuditorId === userId || (audit.auditorIds ?? []).includes(userId)) return 'auditor';
  if (audit.auditeeId === userId) return 'auditee';
  return null;
};

// ===========================================
// Independence - استقلالية المراجع
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

// ===========================================
// Helpers
// ===========================================

const now = (): string => new Date().toISOString();

const nameOf = (user: Pick<User, 'fullNameAr' | 'fullNameEn'>): string =>
  user.fullNameAr || user.fullNameEn;

// Notifications and the activity log must never decide whether the operation succeeded:
// the write to the audit is the operation. These are fire-and-forget on purpose.
const notify = (
  recipientId: string | undefined,
  n: { type: Parameters<typeof addNotification>[0]['type']; title: string; message: string; auditId: string; senderId: string }
): void => {
  if (!recipientId) return;
  void addNotification({ ...n, recipientId }).catch(error =>
    logger.error('Could not send audit-workflow notification:', error)
  );
};

const log = (
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

// Everyone who must hear about a decision on this audit, without duplicates.
const auditParties = (audit: Pick<Audit, 'leadAuditorId' | 'auditorIds' | 'auditeeId'>): string[] =>
  Array.from(
    new Set([audit.leadAuditorId, ...(audit.auditorIds ?? []), audit.auditeeId].filter(Boolean) as string[])
  );

// ===========================================
// 1. The date - تأكيد الموعد
// ===========================================

// Called when the audit is scheduled: both sides are asked, and neither has answered.
export const requestScheduleConfirmation = async (
  audit: Pick<Audit, 'id' | 'titleAr' | 'titleEn' | 'leadAuditorId' | 'auditorIds' | 'auditeeId' | 'startDate'>,
  actor: Pick<User, 'id' | 'fullNameAr' | 'fullNameEn' | 'email' | 'role'>
): Promise<boolean> => {
  const ok = await updateAudit(audit.id, { schedule: newScheduleConfirmation() });
  if (!ok) return false;

  const when = new Date(audit.startDate).toLocaleDateString('ar-SA');
  auditParties(audit).forEach(recipientId =>
    notify(recipientId, {
      type: 'schedule_confirmation_request',
      title: 'تأكيد موعد مراجعة',
      message: `يرجى تأكيد موعد "${audit.titleAr}" المقترح في ${when}، أو طلب موعد آخر مع بيان السبب.`,
      auditId: audit.id,
      senderId: actor.id,
    })
  );

  log(actor, {
    action: 'update',
    entityId: audit.id,
    entityLabel: audit.titleAr,
    summaryAr: `طلب تأكيد موعد المراجعة "${audit.titleAr}" من المراجع والمراجَع عليه.`,
    summaryEn: `Requested schedule confirmation for "${audit.titleEn}" from the auditor and the auditee.`,
  });
  return true;
};

// One side answers. Accepting needs nothing else; asking for another date needs a reason,
// because "no" without one leaves the quality manager with nothing to act on.
export const respondToSchedule = async (
  audit: Pick<Audit, 'id' | 'titleAr' | 'titleEn' | 'schedule' | 'leadAuditorId' | 'auditorIds' | 'auditeeId'>,
  party: 'auditor' | 'auditee',
  response: { accept: boolean; comment?: string; proposedStartDate?: string },
  actor: Pick<User, 'id' | 'fullNameAr' | 'fullNameEn' | 'email' | 'role'>,
  qualityManagerId?: string
): Promise<{ ok: boolean; error?: 'comment_required' }> => {
  if (!response.accept && !response.comment?.trim()) {
    return { ok: false, error: 'comment_required' };
  }

  const current = scheduleOf(audit);
  const answer: SchedulePartyResponse = {
    status: response.accept ? 'accepted' : 'reschedule_requested',
    respondedAt: now(),
    ...(response.comment?.trim() ? { comment: response.comment.trim() } : {}),
    ...(!response.accept && response.proposedStartDate
      ? { proposedStartDate: response.proposedStartDate }
      : {}),
  };

  const schedule: AuditScheduleConfirmation = { ...current, [party]: answer };
  const ok = await updateAudit(audit.id, { schedule });
  if (!ok) return { ok: false };

  const who = nameOf(actor);
  const partyAr = party === 'auditor' ? 'المراجع' : 'المراجَع عليه';

  // The quality manager hears every answer; the other side hears only a request to move,
  // because that is the one that changes what they were expecting.
  notify(qualityManagerId, {
    type: response.accept ? 'schedule_accepted' : 'schedule_reschedule_requested',
    title: response.accept ? 'تأكيد موعد مراجعة' : 'طلب تغيير موعد مراجعة',
    message: response.accept
      ? `أكّد ${who} (${partyAr}) موعد "${audit.titleAr}".`
      : `طلب ${who} (${partyAr}) تغيير موعد "${audit.titleAr}". السبب: ${response.comment}`,
    auditId: audit.id,
    senderId: actor.id,
  });

  if (!response.accept) {
    auditParties(audit)
      .filter(id => id !== actor.id)
      .forEach(recipientId =>
        notify(recipientId, {
          type: 'schedule_reschedule_requested',
          title: 'طلب تغيير موعد مراجعة',
          message: `طلب ${who} تغيير موعد "${audit.titleAr}". السبب: ${response.comment}`,
          auditId: audit.id,
          senderId: actor.id,
        })
      );
  }

  log(actor, {
    action: 'update',
    entityId: audit.id,
    entityLabel: audit.titleAr,
    summaryAr: response.accept
      ? `أكّد ${who} بصفته ${partyAr} موعد المراجعة "${audit.titleAr}".`
      : `طلب ${who} بصفته ${partyAr} تغيير موعد المراجعة "${audit.titleAr}": ${response.comment}`,
    summaryEn: response.accept
      ? `${who} accepted the schedule for "${audit.titleEn}" as the ${party}.`
      : `${who} asked to reschedule "${audit.titleEn}" as the ${party}: ${response.comment}`,
  });

  return { ok: true };
};

// ===========================================
// 2 & 3. The two approval gates - بوابتا الاعتماد
// ===========================================

type GateKind = 'questions' | 'answers';

const GATE_FIELD: Record<GateKind, 'questionsGate' | 'answersGate'> = {
  questions: 'questionsGate',
  answers: 'answersGate',
};

const GATE_LABEL_AR: Record<GateKind, string> = {
  questions: 'قائمة أسئلة المراجعة',
  answers: 'أجوبة المراجعة',
};

const GATE_LABEL_EN: Record<GateKind, string> = {
  questions: 'the audit checklist',
  answers: 'the audit answers',
};

// The auditor sends the list, or the answers, to the quality manager.
export const submitGateForApproval = async (
  kind: GateKind,
  audit: Pick<Audit, 'id' | 'titleAr' | 'titleEn'>,
  actor: Pick<User, 'id' | 'fullNameAr' | 'fullNameEn' | 'email' | 'role'>,
  qualityManagerId?: string
): Promise<boolean> => {
  const gate: ApprovalGate = {
    status: 'pending_approval',
    submittedBy: actor.id,
    submittedAt: now(),
  };

  const ok = await updateAudit(audit.id, { [GATE_FIELD[kind]]: gate } as Partial<Audit>);
  if (!ok) return false;

  notify(qualityManagerId, {
    type: kind === 'questions' ? 'questions_approval_request' : 'answers_approval_request',
    title: `طلب اعتماد ${GATE_LABEL_AR[kind]}`,
    message: `أرسل ${nameOf(actor)} ${GATE_LABEL_AR[kind]} لمراجعة "${audit.titleAr}" لاعتمادها.`,
    auditId: audit.id,
    senderId: actor.id,
  });

  log(actor, {
    action: 'submit',
    entityId: audit.id,
    entityLabel: audit.titleAr,
    summaryAr: `أرسل ${nameOf(actor)} ${GATE_LABEL_AR[kind]} لمراجعة "${audit.titleAr}" لاعتمادها من إدارة الجودة.`,
    summaryEn: `${nameOf(actor)} submitted ${GATE_LABEL_EN[kind]} for "${audit.titleEn}" for quality approval.`,
  });
  return true;
};

// The quality manager decides. A rejection needs a reason - the auditor has to know what
// to change, and "rejected" on its own tells them nothing.
export const decideGate = async (
  kind: GateKind,
  audit: Pick<Audit, 'id' | 'titleAr' | 'titleEn' | 'leadAuditorId' | 'auditorIds' | 'auditeeId' | 'questionsGate' | 'answersGate'>,
  decision: 'approved' | 'rejected',
  comment: string | undefined,
  actor: Pick<User, 'id' | 'fullNameAr' | 'fullNameEn' | 'email' | 'role'>
): Promise<{ ok: boolean; error?: 'comment_required' | 'not_permitted' }> => {
  if (!mayDecideGate(actor)) return { ok: false, error: 'not_permitted' };
  if (decision === 'rejected' && !comment?.trim()) return { ok: false, error: 'comment_required' };

  const previous = kind === 'questions' ? questionsGateOf(audit) : answersGateOf(audit);
  const gate: ApprovalGate = {
    ...previous,
    status: decision as ApprovalGateStatus,
    decidedBy: actor.id,
    decidedAt: now(),
    ...(comment?.trim() ? { comment: comment.trim() } : {}),
  };

  const ok = await updateAudit(audit.id, { [GATE_FIELD[kind]]: gate } as Partial<Audit>);
  if (!ok) return { ok: false };

  const approved = decision === 'approved';

  // On answers being approved the AUDITEE is told, because that approval is the moment the
  // findings become theirs to act on. Before it they are told nothing, which is the point.
  const recipients =
    kind === 'answers' && approved
      ? auditParties(audit)
      : auditParties(audit).filter(id => id !== audit.auditeeId);

  recipients.forEach(recipientId =>
    notify(recipientId, {
      type:
        kind === 'questions'
          ? approved ? 'questions_approved' : 'questions_rejected'
          : approved ? 'answers_approved' : 'answers_rejected',
      title: approved ? `اعتماد ${GATE_LABEL_AR[kind]}` : `إعادة ${GATE_LABEL_AR[kind]}`,
      message: approved
        ? `اعتمد ${nameOf(actor)} ${GATE_LABEL_AR[kind]} لمراجعة "${audit.titleAr}".`
        : `أعاد ${nameOf(actor)} ${GATE_LABEL_AR[kind]} لمراجعة "${audit.titleAr}". السبب: ${comment}`,
      auditId: audit.id,
      senderId: actor.id,
    })
  );

  log(actor, {
    action: approved ? 'approve' : 'reject',
    entityId: audit.id,
    entityLabel: audit.titleAr,
    summaryAr: approved
      ? `اعتمد ${nameOf(actor)} ${GATE_LABEL_AR[kind]} لمراجعة "${audit.titleAr}".`
      : `رفض ${nameOf(actor)} ${GATE_LABEL_AR[kind]} لمراجعة "${audit.titleAr}": ${comment}`,
    summaryEn: approved
      ? `${nameOf(actor)} approved ${GATE_LABEL_EN[kind]} for "${audit.titleEn}".`
      : `${nameOf(actor)} rejected ${GATE_LABEL_EN[kind]} for "${audit.titleEn}": ${comment}`,
  });

  return { ok: true };
};
