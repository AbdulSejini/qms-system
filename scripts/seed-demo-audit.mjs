/**
 * Write ONE fully-formed audit into the emulator, so the reporting screens can be checked
 * against data that looks like the real thing. مراجعة نموذجية للتحقق من صفحات التقارير.
 *
 *   npm run emulator && npm run seed:emulator && npm run seed:demo-audit
 *
 * Same guard as scripts/seed-emulator.mjs, for the same reason: firebase-admin bypasses
 * security rules, so this refuses to run anywhere but an emulator on a demo- project.
 */
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
const PROJECT_ID = process.env.GCLOUD_PROJECT || 'demo-qms';
if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error('REFUSING: FIRESTORE_EMULATOR_HOST is not set. This script only ever seeds an emulator.');
  process.exit(1);
}
if (!PROJECT_ID.startsWith('demo-')) {
  console.error(`REFUSING: project id "${PROJECT_ID}" is not a demo- project.`);
  process.exit(1);
}
initializeApp({ projectId: PROJECT_ID });
const db = getFirestore();
const now = new Date().toISOString();

const audit = {
  id: 'audit-demo-mvhv',
  number: 'AUD-2026-001',
  titleAr: 'مراجعة داخلية - الإنتاج / الجهد المتوسط والعالي',
  titleEn: 'Internal Audit - Production / MV & HV',
  type: 'internal',
  status: 'qms_review',
  currentStage: 2,
  departmentId: 'OPS',
  sectionId: 'OPS-PROD-MVHV',
  leadAuditorId: 'user-abdul-hameed-abdullah',
  teamMemberIds: ['user-sony-mathews'],
  auditeeId: 'user-m-k-ashram',
  startDate: '2026-03-01',
  endDate: '2026-03-02',
  scope: 'ضبط معايير العزل والتشابك، معايرة أجهزة القياس، سجلات اختبارات الجهد.',
  objective: 'التحقق من فاعلية ضوابط الإنتاج ومطابقتها لمتطلبات ISO 9001:2015.',
  questions: [
    { id: 'q1', questionAr: 'هل تُعاير أجهزة قياس الجهد وفق جدول معتمد؟', questionEn: 'Are voltage meters calibrated on an approved schedule?', clause: '7.1.5', status: 'non_compliant', answer: 'سجلات المعايرة متوقفة منذ يناير 2026.' },
    { id: 'q2', questionAr: 'هل يُضبط المنتج غير المطابق ويُفصل؟', questionEn: 'Is nonconforming product controlled and segregated?', clause: '8.7', status: 'compliant', answer: 'منطقة الحجر معلّمة والسجلات محدّثة.' },
    { id: 'q3', questionAr: 'هل تُتبع المواد الخام حتى المنتج النهائي؟', questionEn: 'Is raw material traceable to finished product?', clause: '8.5.2', status: 'compliant', answer: 'التتبع سليم عبر أرقام الدفعات.' },
  ],
  findings: [
    {
      id: 'f1', reportNumber: 'NCR-2026-001', departmentId: 'OPS', sectionId: 'OPS-PROD-MVHV',
      clause: '7.1.5', categoryA: 'quality', categoryB: 'major_nc',
      finding: 'سجلات معايرة أجهزة قياس الجهد متوقفة منذ يناير 2026، وأربعة أجهزة قيد الاستخدام تجاوزت تاريخ معايرتها.',
      evidence: 'سجل المعايرة CAL-LOG-2026 خالٍ بعد 2026-01-14؛ الأجهزة MV-07, MV-09, HV-02, HV-05 عليها ملصقات منتهية.',
      estimatedClosingDate: '2026-05-15', status: 'open', createdAt: now,
    },
    {
      id: 'f2', reportNumber: 'OBS-2026-002', departmentId: 'OPS', sectionId: 'OPS-PROD-MVHV',
      clause: '8.5.1', categoryA: 'quality', categoryB: 'observation',
      finding: 'تعليمات التشغيل معلّقة قرب الخط لكنها بنسخة أقدم من المعتمدة إلكترونياً.',
      evidence: 'النسخة المعلّقة Rev.3 والمعتمدة Rev.5.',
      estimatedClosingDate: '2026-09-30', status: 'in_progress', createdAt: now,
    },
    {
      id: 'f3', reportNumber: 'NTW-2026-003', departmentId: 'OPS', sectionId: 'OPS-PROD-MVHV',
      clause: '8.5.2', categoryA: 'quality', categoryB: 'noteworthy',
      finding: 'نظام تتبع الدفعات المطبّق يتجاوز متطلبات المعيار ويسمح بالتتبع العكسي خلال دقائق.',
      evidence: 'عرض عملي أثناء المراجعة: تتبع دفعة من المنتج النهائي حتى مورّد النحاس في 4 دقائق.',
      estimatedClosingDate: '2026-12-31', status: 'closed', createdAt: now, closedAt: now,
    },
  ],
  schedule: {
    auditor: { status: 'accepted', respondedAt: now },
    auditee: { status: 'accepted', respondedAt: now },
  },
  questionsGate: { status: 'approved', submittedBy: 'user-abdul-hameed-abdullah', submittedAt: now, decidedBy: 'user-mohammed-a-bahwairith', decidedAt: now },
  answersGate: { status: 'pending_approval', submittedBy: 'user-abdul-hameed-abdullah', submittedAt: now },
  createdBy: 'user-mohammed-a-bahwairith',
  createdAt: now, updatedAt: now,
};

await db.collection('audits').doc(audit.id).set(audit, { merge: true });
console.log('demo audit written:', audit.number, '- findings:', audit.findings.length);
