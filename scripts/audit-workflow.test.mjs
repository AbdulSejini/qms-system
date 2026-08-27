// اختبار تسلسل المراجعة - Audit sequence test
//
// يمشي بمراجعة واحدة عبر المسار كله ويتحقق عند كل خطوة: من يجب أن يُمنع مُنع فعلاً، ومن
// له أن يتصرّف يستطيع. كل تأكيد هنا يقابل عيباً كان قائماً - الجمود عند الإجراءات
// التصحيحية، والإدارة تغلق ملاحظتها بنفسها، والأجوبة تُعرض قبل اعتمادها، وسُلَّما المراحل
// المختلفان - فوجوده يمنع عودة أيٍّ منها بصمت.
//
// يُشغَّل من جذر المشروع:  node scripts/audit-workflow.test.mjs
// يخرج بالرمز 0 إن نجح، و 1 إن فشل، فيصلح لأي خطوة تحقق آلية.
//
// jiti تُحمّل مصدر TypeScript مباشرةً - فالمختبَر هو الشيفرة نفسها لا نسخة يدوية عنها.
import { createJiti } from 'jiti';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url, {
  alias: { '@/types': path.join(root, 'src/types/index.ts') },
  moduleCache: false,
});

const W = await jiti.import(path.join(root, 'src/lib/audit-workflow.ts'));

let pass = 0, fail = 0;
const ok = (label, cond) => { if (cond) { pass++; } else { fail++; console.log('  FAIL:', label); } };

const qm       = { id: 'qm',    role: 'quality_manager' };
const admin    = { id: 'admin', role: 'system_admin' };
const lead     = { id: 'lead',  role: 'auditor' };
const member   = { id: 'mem',   role: 'auditor' };
const auditee  = { id: 'ae',    role: 'department_manager' };
const stranger = { id: 'zzz',   role: 'employee' };
const external = { id: 'ext',   role: 'external_auditor' };

const base = {
  id: 'a1', titleAr: 'م', titleEn: 'a',
  leadAuditorId: 'lead', auditorIds: ['lead', 'mem'], auditeeId: 'ae',
  questions: [], findings: [], executionConfirmed: false,
};
const at = (stage, extra = {}) => ({
  ...base, status: W.statusForStage(stage), currentStage: stage, ...extra,
});
const answered = [{ id: 'q1', status: 'compliant' }];
const finding = (o = {}) => ({ id: 'f1', reportNumber: 'F1', status: 'open', ...o });

console.log('\n— 0. سُلَّم المراحل واحد —');
ok('six stages', W.LAST_STAGE === 5);
ok('planning is 0',  W.stageIndexFromStatus('planning') === 0);
ok('execution is 1', W.stageIndexFromStatus('execution') === 1);
ok('qms_review is 2', W.stageIndexFromStatus('qms_review') === 2);
ok('corrective_actions is 3', W.stageIndexFromStatus('corrective_actions') === 3);
ok('verification is 4', W.stageIndexFromStatus('verification') === 4);
ok('the retired 7th stage folds into planning', W.stageIndexFromStatus('questions_preparation') === 0);
ok('a stored stage out of range falls back to the status',
   W.stageOf({ status: 'qms_review', currentStage: 99 }) === 2);
ok('a completed audit ignores a stale stored stage',
   W.stageOf({ status: 'completed', currentStage: 1 }) === 5);

console.log('\n— 1. قفل موافقة الإنشاء —');
const pending = { ...base, status: 'pending_approval', currentStage: 0, questions: answered };
ok('locked before approval', W.isAuditLocked(pending));
ok('lead cannot advance it', W.whatBlocksAdvance({ audit: pending, user: lead }) === 'locked_pending_creation_approval');
ok('quality cannot advance it either', W.whatBlocksAdvance({ audit: pending, user: qm }) === 'locked_pending_creation_approval');
ok('no question editing while locked', !W.mayEditQuestions(pending, lead));
ok('no answering while locked', !W.mayAnswerQuestions({ ...pending, executionConfirmed: true }, lead));

console.log('\n— 2. التخطيط —');
const planning = at(0);
ok('cannot leave planning with no questions', W.whatBlocksAdvance({ audit: planning, user: lead }) === 'no_questions');
const planningQ = at(0, { questions: answered });
ok('lead may leave planning once questions exist', W.mayAdvanceStage({ audit: planningQ, user: lead }));
ok('quality may too', W.mayAdvanceStage({ audit: planningQ, user: qm }));
ok('a team member may NOT', W.whatBlocksAdvance({ audit: planningQ, user: member }) === 'not_your_stage');
ok('THE AUDITEE MAY NOT', W.whatBlocksAdvance({ audit: planningQ, user: auditee }) === 'not_your_stage');
ok('a stranger may NOT', W.whatBlocksAdvance({ audit: planningQ, user: stranger }) === 'not_your_stage');

console.log('\n— 3. التنفيذ: الإجابة بعد تأكيد الزيارة —');
const execRaw = at(1, { questions: [{ id: 'q1', status: 'pending' }] });
ok('no answering before execution is confirmed', !W.mayAnswerQuestions(execRaw, lead));
const execOn = { ...execRaw, executionConfirmed: true };
ok('lead may answer once confirmed', W.mayAnswerQuestions(execOn, lead));
ok('member may answer', W.mayAnswerQuestions(execOn, member));
ok('the auditee may never answer', !W.mayAnswerQuestions(execOn, auditee));
ok('the quality manager does not answer either', !W.mayAnswerQuestions(execOn, qm));
ok('blocked on unanswered questions',
   W.whatBlocksAdvance({ audit: execOn, user: lead }) === 'answers_incomplete');
const execDone = { ...execOn, questions: answered };
ok('blocked until the answers are submitted',
   W.whatBlocksAdvance({ audit: execDone, user: lead }) === 'answers_not_submitted');
const submitted = { ...execDone, answersGate: W.submittedAnswersGate('lead') };
ok('submitting unblocks execution', W.mayAdvanceStage({ audit: submitted, user: lead }));

console.log('\n— 4. البوابة: ما يراه المُراجَع عليه —');
ok('auditee sees nothing before approval', !W.mayViewAnswers(submitted, auditee));
ok('external assessor sees nothing before approval', !W.mayViewAnswers(submitted, external));
ok('lead sees them throughout', W.mayViewAnswers(submitted, lead));
ok('member sees them throughout', W.mayViewAnswers(submitted, member));
ok('quality sees them throughout', W.mayViewAnswers(submitted, qm));
const approvedGate = W.decidedAnswersGate(W.answersGateOf(submitted), 'approved', 'qm');
const approved = { ...at(2, { questions: answered, executionConfirmed: true }), answersGate: approvedGate };
ok('auditee sees them after approval', W.mayViewAnswers(approved, auditee));
ok('external assessor sees them after approval', W.mayViewAnswers(approved, external));

console.log('\n— 5. من يبتّ في البوابة —');
ok('quality manager decides', W.mayDecideGate(qm));
ok('SYSTEM ADMIN decides too', W.mayDecideGate(admin));
ok('lead auditor does not', !W.mayDecideGate(lead));
ok('auditee does not', !W.mayDecideGate(auditee));
const awaiting = { ...at(2, { questions: answered }), answersGate: W.submittedAnswersGate('lead') };
ok('qms_review blocked until approved',
   W.whatBlocksAdvance({ audit: awaiting, user: qm }) === 'answers_not_approved');
ok('lead cannot push past qms_review',
   W.whatBlocksAdvance({ audit: awaiting, user: lead }) === 'not_your_stage');
ok('approved audit leaves qms_review', W.mayAdvanceStage({ audit: approved, user: qm }));

console.log('\n— 6. الاعتماد يسقط بتغيّر ما اعتُمد —');
const revised = { ...approved, answersGate: W.invalidatedAnswersGate(approvedGate) };
ok('a revision drops the approval', !W.areAnswersApproved(revised));
ok('and hides the answers from the auditee again', !W.mayViewAnswers(revised, auditee));
ok('and re-blocks qms_review',
   W.whatBlocksAdvance({ audit: revised, user: qm }) === 'answers_not_approved');
ok('rewinding is quality-only', W.mayRewindStage({ audit: approved, user: qm })
   && !W.mayRewindStage({ audit: approved, user: lead })
   && !W.mayRewindStage({ audit: approved, user: auditee }));

console.log('\n— 7. الإجراءات التصحيحية —');
const ca = { ...at(3, { questions: answered, findings: [finding()] }), answersGate: approvedGate };
ok('auditee may respond', W.mayRespondToFinding(ca, auditee));
ok('a stranger may not', !W.mayRespondToFinding(ca, stranger));
ok('no response before approval',
   !W.mayRespondToFinding({ ...ca, answersGate: W.newApprovalGate() }, auditee));
ok('no corrective action during execution',
   !W.mayEnterCorrectiveAction({ ...at(1, { findings: [finding()] }), answersGate: approvedGate }, auditee));
ok('corrective action in its own stage', W.mayEnterCorrectiveAction(ca, auditee));
ok('blocked while a finding has no response',
   W.whatBlocksAdvance({ audit: ca, user: qm }) === 'auditee_has_not_responded');
const responded = { ...ca, findings: [finding({ status: 'pending_verification', departmentResponse: { approvedBy: 'ae' } })] };
ok('THE DEADLOCK: blocked on the approval that had no button',
   W.whatBlocksAdvance({ audit: responded, user: qm }) === 'corrective_actions_not_approved');
ok('quality may now give it', W.mayApproveCorrectiveActions(responded, qm));
ok('system admin may too', W.mayApproveCorrectiveActions(responded, admin));
ok('the auditee may not approve their own actions', !W.mayApproveCorrectiveActions(responded, auditee));
ok('the lead auditor may not either', !W.mayApproveCorrectiveActions(responded, lead));
ok('not offered before every finding is answered', !W.mayApproveCorrectiveActions(ca, qm));
const caApproved = { ...responded, correctiveActionsApproved: true };
ok('approved unblocks the stage', W.mayAdvanceStage({ audit: caApproved, user: qm }));

console.log('\n— 8. التحقق والإغلاق —');
const verifying = { ...at(4, { questions: answered, findings: caApproved.findings }), answersGate: approvedGate };
const answeredFinding = verifying.findings[0];
ok('lead may verify', W.mayVerifyFinding(verifying, answeredFinding, lead));
ok('quality may verify', W.mayVerifyFinding(verifying, answeredFinding, qm));
ok('THE AUDITEE MAY NOT CLOSE THEIR OWN FINDING',
   !W.mayVerifyFinding(verifying, answeredFinding, auditee));
ok('a stranger may not', !W.mayVerifyFinding(verifying, answeredFinding, stranger));
ok('no closing without a documented response',
   !W.mayVerifyFinding(verifying, finding(), lead));
ok('an audit does not complete with open findings',
   W.whatBlocksAdvance({ audit: verifying, user: lead }) === 'findings_still_open');
const closed = { ...verifying, findings: [finding({ status: 'closed', departmentResponse: {} })] };
ok('it completes once they are closed', W.mayAdvanceStage({ audit: closed, user: lead }));

console.log('\n— 9. المراجعة المقفلة —');
const done = at(5, { status: 'completed' });
ok('completed is the last stage', W.whatBlocksAdvance({ audit: done, user: qm }) === 'last_stage');
ok('no rewinding a completed audit', !W.mayRewindStage({ audit: done, user: qm }));
ok('no editing a completed audit', !W.mayEditQuestions(done, qm));

console.log('\n— 10. حدود الكتابة تطابق firestore.rules —');
ok('quality writes', W.mayWriteToAudit(base, qm));
ok('lead writes', W.mayWriteToAudit(base, lead));
ok('member writes', W.mayWriteToAudit(base, member));
ok('the named auditee writes', W.mayWriteToAudit(base, auditee));
ok('a stranger does not', !W.mayWriteToAudit(base, stranger));
ok('the external assessor never writes', !W.mayWriteToAudit(base, external));
ok('WITHOUT auditeeId the department cannot write - the original silent failure',
   !W.mayWriteToAudit({ ...base, auditeeId: undefined }, auditee));

console.log('\n— 11. الاستقلالية واشتقاق المُراجَع عليه —');
const users = [
  { id: 'dm', role: 'department_manager', departmentId: 'd1', isActive: true },
  { id: 'sh', role: 'section_head', departmentId: 'd1', sectionId: 's1', isActive: true },
  { id: 'old', role: 'department_manager', departmentId: 'd1', isActive: false },
];
ok('department manager for a department audit', W.deriveAuditeeId(users, 'd1') === 'dm');
ok('section head for a section audit', W.deriveAuditeeId(users, 'd1', 's1') === 'sh');
ok('nobody for a department with no manager', W.deriveAuditeeId(users, 'd9') === undefined);
ok('inactive people are not chosen',
   W.deriveAuditeeId([users[2]], 'd1') === undefined);
ok('no auditing your own department',
   !W.isIndependentOf({ departmentId: 'd1', auditableDepartmentIds: [] }, 'd1'));
ok('auditing another department is fine',
   W.isIndependentOf({ departmentId: 'd2', auditableDepartmentIds: [] }, 'd1'));

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'} — ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
