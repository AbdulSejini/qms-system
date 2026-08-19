'use client';

import { useState, useMemo, useEffect, Suspense } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { DashboardLayout } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { Button, Badge } from '@/components/ui';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui';
import { useTranslation } from '@/contexts/LanguageContext';
import { isIndependentOf } from '@/lib/audit-workflow';
import { useAuth } from '@/contexts/AuthContext';
import {
  subscribeToAnnualPlans,
  createAnnualPlan,
  updateAnnualPlan,
  deleteAnnualPlan,
  deleteNotificationsForPlan,
  addNotification,
} from '@/lib/firestore';
import { recordActivity } from '@/lib/activity-log';
import { AnnualPlan, AnnualPlanItem, AnnualPlanStatus, AuditType } from '@/types';
import orgStructure from '@/data/org-structure.json';
import {
  Plus,
  X,
  Trash2,
  Send,
  CheckCircle,
  XCircle,
  Search,
  CalendarRange,
  ClipboardList,
  Clock,
  Shield,
  AlertCircle,
  Eye,
  UserCheck,
  Undo2,
  ClipboardPlus,
  ExternalLink,
} from 'lucide-react';

// ===========================================
// خطة المراجعة الداخلية السنوية
// المتطلب 1 و 2: مدير الجودة يبني خطة سنوية ببنود (إدارة/قسم/شهر/نوع)
// ثم يرسلها لمعتمِد يختاره من مستخدمي النظام - المعتمِد غير ثابت في الكود
// ===========================================

// أشهر السنة
const months = [
  { value: 1, labelAr: 'يناير', labelEn: 'January' },
  { value: 2, labelAr: 'فبراير', labelEn: 'February' },
  { value: 3, labelAr: 'مارس', labelEn: 'March' },
  { value: 4, labelAr: 'أبريل', labelEn: 'April' },
  { value: 5, labelAr: 'مايو', labelEn: 'May' },
  { value: 6, labelAr: 'يونيو', labelEn: 'June' },
  { value: 7, labelAr: 'يوليو', labelEn: 'July' },
  { value: 8, labelAr: 'أغسطس', labelEn: 'August' },
  { value: 9, labelAr: 'سبتمبر', labelEn: 'September' },
  { value: 10, labelAr: 'أكتوبر', labelEn: 'October' },
  { value: 11, labelAr: 'نوفمبر', labelEn: 'November' },
  { value: 12, labelAr: 'ديسمبر', labelEn: 'December' },
];

// أنواع المراجعة - نفس الأنواع المستخدمة في صفحة المراجعات
const auditTypes: { value: AuditType; labelAr: string; labelEn: string }[] = [
  { value: 'internal', labelAr: 'داخلي', labelEn: 'Internal' },
  { value: 'external', labelAr: 'خارجي', labelEn: 'External' },
  { value: 'surveillance', labelAr: 'مراقبة', labelEn: 'Surveillance' },
  { value: 'certification', labelAr: 'شهادة', labelEn: 'Certification' },
];

// معرّف بند جديد - خارج المكوّن لأنه استدعاء غير نقي لا يجوز أثناء العرض
const createItemId = (): string =>
  `item-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

// خيار إدارة/قسم للعرض - يأتي من Firestore أو من الهيكل التنظيمي المحفوظ
interface OrgOption {
  id: string;
  nameAr: string;
  nameEn: string;
}

function PlansPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t, language } = useTranslation();
  const { currentUser, users: allUsers, departments: allDepartments, sections: allSections } = useAuth();

  // من يملك بناء الخطة: مدير الجودة ومدير النظام
  const canManagePlans = currentUser?.role === 'quality_manager' || currentUser?.role === 'system_admin';
  const isSystemAdmin = currentUser?.role === 'system_admin';

  // ===========================================
  // البيانات
  // ===========================================
  const [plans, setPlans] = useState<AnnualPlan[]>([]);
  const [plansLoaded, setPlansLoaded] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToAnnualPlans((firestorePlans) => {
      const sorted = [...firestorePlans].sort((a, b) => b.year - a.year);
      setPlans(sorted);
      setPlansLoaded(true);
    });
    return () => unsubscribe();
  }, []);

  // ===========================================
  // الفلاتر
  // ===========================================
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'all' | AnnualPlanStatus>('all');

  // ===========================================
  // النوافذ المنبثقة
  // ===========================================
  const [showNewModal, setShowNewModal] = useState(false);
  const [newPlan, setNewPlan] = useState({
    year: new Date().getFullYear(),
    titleAr: '',
    titleEn: '',
  });
  const [newPlanError, setNewPlanError] = useState('');
  const [isSavingPlan, setIsSavingPlan] = useState(false);

  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [detailError, setDetailError] = useState('');
  const [detailNotice, setDetailNotice] = useState('');
  const [isSavingItem, setIsSavingItem] = useState(false);

  const [newItem, setNewItem] = useState<{
    departmentId: string;
    sectionId: string;
    plannedMonth: number;
    auditType: AuditType;
    leadAuditorId: string;
    auditorIds: string[];
    notes: string;
  }>({
    departmentId: '',
    sectionId: '',
    plannedMonth: 1,
    auditType: 'internal',
    leadAuditorId: '',
    auditorIds: [],
    notes: '',
  });

  // نافذة الإرسال للاعتماد - اختيار المعتمِد
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [approverSearch, setApproverSearch] = useState('');
  const [selectedApproverId, setSelectedApproverId] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // نافذة قرار الاعتماد
  const [showDecisionModal, setShowDecisionModal] = useState(false);
  const [decision, setDecision] = useState<'approve' | 'reject'>('approve');
  const [decisionComment, setDecisionComment] = useState('');
  const [decisionError, setDecisionError] = useState('');
  const [isDeciding, setIsDeciding] = useState(false);

  // نافذة سحب الطلب من الاعتماد
  const [showRecallModal, setShowRecallModal] = useState(false);
  const [recallReason, setRecallReason] = useState('');
  const [recallError, setRecallError] = useState('');
  const [isRecalling, setIsRecalling] = useState(false);

  // نافذة الحذف
  const [planToDelete, setPlanToDelete] = useState<AnnualPlan | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // رسالة على مستوى الصفحة - تُستخدم بعد إغلاق النافذة المنبثقة: نتيجة الحذف،
  // أو أن الخطة المطلوبة برابط الإشعار لم تعد موجودة.
  const [pageNotice, setPageNotice] = useState('');

  // فتح خطة بعينها من رابط الإشعار: /plans?plan=<id>
  // المعتمِد قد يكون موظفاً عادياً لا يظهر له عنصر "الخطط" في القائمة الجانبية،
  // فالرابط المباشر هو ما يضمن وصوله للخطة التي عليه البت فيها.
  // نقرأ المعرّف من useSearchParams لا من window.location مرة واحدة عند التركيب:
  // القراءة لمرة واحدة كانت تجعل الإشعار بلا أثر لمن هو أصلاً على /plans - الرابط
  // يتغيّر والصفحة لا تُعاد تركيبها فلا يُقرأ المعرّف الجديد. الاعتماد على
  // useSearchParams يفرض حدود Suspense، وهي موجودة في PlansPage أسفل الملف.
  // مزامنة الحالة مع العنوان أثناء العرض لا داخل useEffect: النافذة تُفتح في نفس
  // الدورة بلا وميض، والقاعدة التي يقوم عليها هذا النمط أن أي تغيّر في المعرّف
  // يُقرأ مرة واحدة (urlPlanIdSeen) فلا تتكرر إعادة الفتح بعد إغلاق المستخدم لها.
  const planIdFromUrl = searchParams.get('plan');
  const [urlPlanIdSeen, setUrlPlanIdSeen] = useState<string | null>(null);

  if (planIdFromUrl !== urlPlanIdSeen) {
    setUrlPlanIdSeen(planIdFromUrl);
    if (planIdFromUrl) setSelectedPlanId(planIdFromUrl);
  }

  // إغلاق نافذة الخطة يُزيل ?plan= من العنوان أيضاً، وإلا بقي العنوان على الخطة
  // نفسها فلا يُحدث الضغط على إشعارها ثانيةً أي تغيير في الرابط ولا يفتحها.
  const closePlanDetail = () => {
    setSelectedPlanId(null);
    if (planIdFromUrl) router.replace(pathname, { scroll: false });
  };

  // الخطة المفتوحة تُشتق من الاشتراك حتى تبقى محدّثة لحظياً
  const selectedPlan = useMemo(
    () => plans.find(p => p.id === selectedPlanId) || null,
    [plans, selectedPlanId]
  );

  // خطة مطلوبة بمعرّف لا يقابله شيء - غالباً خطة حُذفت وإشعارها ما زال قائماً عند
  // صاحبه، أو خطة حُذفت من متصفّح آخر بينما نافذتها مفتوحة هنا. الحالتان كانتا
  // صمتاً تاماً: النافذة لا تُفتح ولا تُقال كلمة، فيبقى القارئ يظن أن الرابط معطوب.
  // مشتقّة لا محفوظة: لا setState في العرض ولا في useEffect، والرسالة تختفي وحدها
  // متى ما أُغلقت الخطة. الشرط plansLoaded ضروري لأن القائمة فارغة قبل وصول أول
  // لقطة من الاشتراك، فتبدو كل خطة عندها "غير موجودة".
  const missingPlanNotice = plansLoaded && selectedPlanId && !selectedPlan
    ? (language === 'ar'
      ? 'الخطة المطلوبة لم تعد موجودة - يبدو أنها حُذفت. إن كنت وصلت إليها من تنبيه فبإمكانك حذف ذلك التنبيه.'
      : 'The requested plan no longer exists - it appears to have been deleted. If a notification brought you here, you can dismiss it.')
    : '';

  // إغلاق شريط الرسالة: يمسح رسالة الحذف، ويُغلق الخطة المفقودة معها فيختفي
  // التنبيه المشتقّ ويُنظَّف ?plan= من العنوان.
  const dismissPageNotice = () => {
    setPageNotice('');
    if (missingPlanNotice) closePlanDetail();
  };

  // ===========================================
  // الهيكل التنظيمي - نفضّل بيانات Firestore ونرجع للملف عند غيابها
  // ===========================================
  const departmentOptions: OrgOption[] = useMemo(() => {
    const active = allDepartments.filter(d => d.isActive);
    if (active.length > 0) {
      return active.map(d => ({ id: d.id, nameAr: d.nameAr, nameEn: d.nameEn }));
    }
    return orgStructure.departments.map(d => ({ id: d.code, nameAr: d.nameAr, nameEn: d.nameEn }));
  }, [allDepartments]);

  const getSectionOptions = (departmentId: string): OrgOption[] => {
    if (!departmentId) return [];
    const fromFirestore = allSections.filter(s => s.departmentId === departmentId && s.isActive);
    if (fromFirestore.length > 0) {
      return fromFirestore.map(s => ({ id: s.id, nameAr: s.nameAr, nameEn: s.nameEn }));
    }
    // الرجوع للهيكل المحفوظ - المعرّف هو رمز القسم في الملف
    const dept = orgStructure.departments.find(d => d.code === departmentId);
    if (!dept) return [];
    return dept.sections.map(s => ({ id: s.code, nameAr: s.nameAr, nameEn: s.nameEn }));
  };

  // أسماء للعرض - تبحث في Firestore ثم في الهيكل المحفوظ
  const getDepartmentName = (departmentId: string): string => {
    const dept = allDepartments.find(d => d.id === departmentId);
    if (dept) return language === 'ar' ? dept.nameAr : dept.nameEn;
    const orgDept = orgStructure.departments.find(d => d.code === departmentId);
    if (orgDept) return language === 'ar' ? orgDept.nameAr : orgDept.nameEn;
    return departmentId;
  };

  const getSectionName = (sectionId?: string): string => {
    if (!sectionId) return '';
    const section = allSections.find(s => s.id === sectionId);
    if (section) return language === 'ar' ? section.nameAr : section.nameEn;
    for (const dept of orgStructure.departments) {
      const orgSection = dept.sections.find(s => s.code === sectionId);
      if (orgSection) return language === 'ar' ? orgSection.nameAr : orgSection.nameEn;
    }
    return sectionId;
  };

  const getUserName = (userId?: string): string => {
    if (!userId) return '';
    const user = allUsers.find(u => u.id === userId);
    if (!user) return userId;
    return language === 'ar' ? user.fullNameAr : user.fullNameEn;
  };

  const getMonthName = (month: number): string => {
    const m = months.find(x => x.value === month);
    return m ? (language === 'ar' ? m.labelAr : m.labelEn) : String(month);
  };

  const getTypeName = (type: AuditType): string => {
    const found = auditTypes.find(x => x.value === type);
    return found ? (language === 'ar' ? found.labelAr : found.labelEn) : type;
  };

  // المراجعون المتاحون لبند الخطة الجاري تحريره - المستقلون عن إدارته فقط.
  // نفس الحارس المطبّق في معالج إنشاء المراجعة، لأن البند هنا هو ما يُعبّئ ذلك المعالج:
  // اختيار غير مستقل هنا يصل إلى المراجعة نفسها.
  const auditors = useMemo(
    () =>
      allUsers.filter(
        u =>
          u.canBeAuditor &&
          u.isActive &&
          isIndependentOf(u, newItem.departmentId, newItem.sectionId)
      ),
    [allUsers, newItem.departmentId, newItem.sectionId]
  );

  // أعضاء الفريق المتاحون للإضافة الآن: مراجع مستقل، ليس رئيس الفريق، ولم يُضف بعد.
  const availableTeamAuditors = useMemo(
    () => auditors.filter(
      a => a.id !== newItem.leadAuditorId && !newItem.auditorIds.includes(a.id)
    ),
    [auditors, newItem.leadAuditorId, newItem.auditorIds]
  );

  // تغيير الإدارة أو القسم يغيّر من هو مستقل عن الجهة محل المراجعة. من لم يعد مستقلاً
  // يخرج من الاختيار في اللحظة نفسها - وإلا بقي مختاراً وهو غائب عن القائمة، ثم انتقل
  // مع البند إلى المراجعة، وهو بالضبط ما يمنعه فلتر الاستقلالية.
  const keepIndependent = (ids: string[], departmentId: string, sectionId: string): string[] =>
    ids.filter(id => {
      const user = allUsers.find(u => u.id === id);
      return !!user && isIndependentOf(user, departmentId, sectionId);
    });

  const addTeamMember = (auditorId: string) => {
    if (!auditorId || newItem.auditorIds.includes(auditorId)) return;
    setNewItem({ ...newItem, auditorIds: [...newItem.auditorIds, auditorId] });
  };

  const removeTeamMember = (auditorId: string) => {
    setNewItem({ ...newItem, auditorIds: newItem.auditorIds.filter(id => id !== auditorId) });
  };

  // من ترفضه القواعد معتمِداً، فلا يُعرض في القائمة أصلاً. قاعدة authorSubmits في
  // firestore.rules تشترط approverId != createdBy و approverId != المستخدم الذي
  // يُرسل، فاستثناء المُرسِل وحده كان يترك مدير النظام يختار منشئ الخطة حين يُرسل
  // نيابةً عنه - اختيارٌ يبدو سليماً ثم يُرفض عند الحفظ بلا تفسير.
  const excludedApproverIds = useMemo(() => {
    const ids = new Set<string>();
    if (currentUser?.id) ids.add(currentUser.id);
    if (selectedPlan?.createdBy) ids.add(selectedPlan.createdBy);
    return ids;
  }, [currentUser, selectedPlan]);

  // المعتمِدون المحتملون - أي مستخدم نشط غير مستثنى، يبحث عنه مدير الجودة بالاسم
  const approverCandidates = useMemo(() => {
    const active = allUsers.filter(u => u.isActive && !u.isSystemAccount && !excludedApproverIds.has(u.id));
    if (!approverSearch) return active;
    const search = approverSearch.toLowerCase();
    return active.filter(u =>
      u.fullNameAr.toLowerCase().includes(search) ||
      u.fullNameEn.toLowerCase().includes(search) ||
      u.email.toLowerCase().includes(search) ||
      (u.employeeNumber || '').toLowerCase().includes(search)
    );
  }, [allUsers, approverSearch, excludedApproverIds]);

  // ===========================================
  // الصلاحيات على خطة بعينها
  // ===========================================
  // الخطة قابلة للتعديل من منشئها ما دامت مسودة أو مرفوضة - ومنها الخطة التي
  // سُحبت من الاعتماد فعادت مسودة. مطابق لقاعدة authorEditsContent في
  // firestore.rules: isQualityStaff() && (منشئ الخطة || مدير النظام) && الحالة
  // مسودة أو مرفوضة. اشتراط canManagePlans هو مقابل isQualityStaff: منشئ خطة
  // تغيّر دوره لاحقاً لم يعد يملك الكتابة عليها، فلا معنى لعرض أدوات التعديل له.
  const canEditPlan = (plan: AnnualPlan): boolean => {
    if (plan.status !== 'draft' && plan.status !== 'rejected') return false;
    if (!canManagePlans) return false;
    return plan.createdBy === currentUser?.id || isSystemAdmin;
  };

  // القرار للمعتمِد المسمّى على الخطة وحده. مدير النظام ليس استثناءً: قاعدة
  // approverDecides في firestore.rules تشترط approverId == المستخدم نفسه، فزر
  // "اعتماد" لغيره كان وعداً ترفضه القواعد (permission-denied) بلا تفسير.
  // ولا يوجد تجاوز إداري هنا لأن التجاوز موجود أصلاً وصريح: مدير النظام يسحب
  // الطلب (canRecallPlan) ثم يعيد إرساله إلى المعتمِد الصحيح.
  // والشرط الأخير يقابل appUserId() != author() في القاعدة نفسها: خطة قديمة قد
  // تسمّي منشئها معتمِداً لها، والقواعد ترفض قراره - فنخفي الأزرار ونشرح السبب.
  const canDecideOnPlan = (plan: AnnualPlan): boolean => {
    if (plan.status !== 'pending_approval') return false;
    if (!plan.approverId || plan.approverId !== currentUser?.id) return false;
    return plan.approverId !== plan.createdBy;
  };

  // سحب الطلب: خطة بانتظار الاعتماد كانت طريقاً مسدوداً - لا تُعدّل ولا تُحذف ولا
  // يُستبدل معتمِدها، وسنتها محجوزة. منشئ الخطة (ومدير النظام) يعيدها إلى مسودة
  // فتستعيد كل صلاحيات canEditPlan: التعديل، اختيار معتمِد آخر، أو الحذف.
  // الاتساق مع firestore.rules: للقواعد فرعٌ خاص يسمح بالانتقال
  // pending_approval -> draft لمنشئ الخطة ولمدير النظام وحدهما؛ والمعتمِد ليس
  // منهما، فلا يظهر له هذا الإجراء. وشرط canManagePlans هو نفسه شرط
  // canEditPlan، لأن سحب خطة لا يستطيع صاحبها تعديلها بعده لا فائدة منه.
  const canRecallPlan = (plan: AnnualPlan): boolean => {
    if (plan.status !== 'pending_approval') return false;
    if (!canManagePlans) return false;
    return plan.createdBy === currentUser?.id || isSystemAdmin;
  };

  // عمود إجراءات البنود: يظهر للتعديل، ولإنشاء المراجعة من بنود الخطة المعتمدة،
  // ولفتح المراجعة المرتبطة ببند سبق تنفيذه
  const showItemActions = (plan: AnnualPlan): boolean =>
    canEditPlan(plan) || plan.status === 'approved' || (plan.items || []).some(i => !!i.auditId);

  // نسبة الإنجاز: كم بنداً صار له مراجعة فعلية
  const getPlanProgress = (plan: AnnualPlan) => {
    const items = plan.items || [];
    const created = items.filter(i => !!i.auditId).length;
    const total = items.length;
    const percent = total > 0 ? Math.round((created / total) * 100) : 0;
    return { created, total, percent };
  };

  // ===========================================
  // العرض
  // ===========================================
  const statusFilters: { value: 'all' | AnnualPlanStatus; labelAr: string; labelEn: string }[] = [
    { value: 'all', labelAr: 'الكل', labelEn: 'All' },
    { value: 'draft', labelAr: 'مسودة', labelEn: 'Draft' },
    { value: 'pending_approval', labelAr: 'بانتظار الاعتماد', labelEn: 'Pending Approval' },
    { value: 'approved', labelAr: 'معتمدة', labelEn: 'Approved' },
    { value: 'rejected', labelAr: 'مرفوضة', labelEn: 'Rejected' },
  ];

  const getStatusBadge = (status: AnnualPlanStatus) => {
    if (status === 'pending_approval') {
      return (
        <Badge variant="pending">
          <Clock className="h-3 w-3 me-1" />
          {t('plans.status.pendingApproval')}
        </Badge>
      );
    }
    if (status === 'approved') {
      return (
        <Badge variant="approved">
          <CheckCircle className="h-3 w-3 me-1" />
          {t('plans.status.approved')}
        </Badge>
      );
    }
    if (status === 'rejected') {
      return (
        <Badge variant="rejected">
          <XCircle className="h-3 w-3 me-1" />
          {t('plans.status.rejected')}
        </Badge>
      );
    }
    return <Badge variant="draft">{t('plans.status.draft')}</Badge>;
  };

  const filteredPlans = useMemo(() => {
    return plans.filter(plan => {
      const search = searchQuery.toLowerCase();
      const matchesSearch =
        !search ||
        String(plan.year).includes(search) ||
        (plan.titleAr || '').toLowerCase().includes(search) ||
        (plan.titleEn || '').toLowerCase().includes(search);
      const matchesStatus = selectedStatus === 'all' || plan.status === selectedStatus;
      return matchesSearch && matchesStatus;
    });
  }, [plans, searchQuery, selectedStatus]);

  // إحصائيات أعلى الصفحة
  const stats = useMemo(() => {
    const allItems = plans.flatMap(p => p.items || []);
    return {
      total: plans.length,
      pending: plans.filter(p => p.status === 'pending_approval').length,
      approved: plans.filter(p => p.status === 'approved').length,
      plannedAudits: allItems.length,
    };
  }, [plans]);

  // ===========================================
  // العمليات
  // ===========================================

  // إنشاء خطة سنة جديدة
  const handleCreatePlan = async () => {
    if (isSavingPlan) return;
    setNewPlanError('');

    if (!newPlan.year || newPlan.year < 2000 || newPlan.year > 2100) {
      setNewPlanError(t('plans.errors.invalidYear'));
      return;
    }
    if (!newPlan.titleAr.trim()) {
      setNewPlanError(t('plans.errors.titleRequired'));
      return;
    }
    // سنة واحدة = خطة واحدة
    if (plans.some(p => p.year === newPlan.year)) {
      setNewPlanError(t('plans.errors.yearExists'));
      return;
    }

    setIsSavingPlan(true);
    const planId = await createAnnualPlan({
      year: newPlan.year,
      titleAr: newPlan.titleAr.trim(),
      titleEn: (newPlan.titleEn || newPlan.titleAr).trim(),
      status: 'draft',
      items: [],
      approverId: '', // يختاره مدير الجودة عند الإرسال للاعتماد
      createdBy: currentUser?.id || '',
    });
    setIsSavingPlan(false);

    // لا نغلق النافذة إلا بعد تأكيد الحفظ
    if (!planId) {
      setNewPlanError(t('plans.errors.createFailed'));
      return;
    }

    setShowNewModal(false);
    setNewPlan({ year: new Date().getFullYear(), titleAr: '', titleEn: '' });
    setSelectedPlanId(planId);
  };

  // فتح خطة
  const handleOpenPlan = (plan: AnnualPlan) => {
    setSelectedPlanId(plan.id);
    setDetailError('');
    setDetailNotice('');
    resetItemForm();
  };

  const resetItemForm = () => {
    setNewItem({
      departmentId: '',
      sectionId: '',
      plannedMonth: 1,
      auditType: 'internal',
      leadAuditorId: '',
      auditorIds: [],
      notes: '',
    });
  };

  // إضافة بند للخطة - يُحفظ فوراً في Firestore
  const handleAddItem = async () => {
    if (!selectedPlan || isSavingItem) return;
    setDetailError('');
    setDetailNotice('');

    if (!newItem.departmentId) {
      setDetailError(t('plans.errors.departmentRequired'));
      return;
    }

    const item: AnnualPlanItem = {
      id: createItemId(),
      departmentId: newItem.departmentId,
      sectionId: newItem.sectionId || undefined,
      plannedMonth: newItem.plannedMonth,
      auditType: newItem.auditType,
      leadAuditorId: newItem.leadAuditorId || undefined,
      // رئيس الفريق لا يُكرَّر داخل الأعضاء - الحقلان منفصلان في البند وفي المراجعة
      auditorIds: newItem.auditorIds.length > 0
        ? newItem.auditorIds.filter(id => id !== newItem.leadAuditorId)
        : undefined,
      notes: newItem.notes.trim() || undefined,
    };

    setIsSavingItem(true);
    const saved = await updateAnnualPlan(selectedPlan.id, {
      items: [...(selectedPlan.items || []), item],
    });
    setIsSavingItem(false);

    // لا نُفرغ النموذج إذا لم يُحفظ البند - حتى لا يضيع إدخال المستخدم
    if (!saved) {
      setDetailError(t('plans.errors.itemSaveFailed'));
      return;
    }

    resetItemForm();
  };

  // حذف بند من الخطة
  const handleRemoveItem = async (itemId: string) => {
    if (!selectedPlan || isSavingItem) return;
    setDetailError('');
    setDetailNotice('');

    setIsSavingItem(true);
    const saved = await updateAnnualPlan(selectedPlan.id, {
      items: (selectedPlan.items || []).filter(i => i.id !== itemId),
    });
    setIsSavingItem(false);

    if (!saved) {
      setDetailError(t('plans.errors.itemDeleteFailed'));
    }
  };

  // لماذا ضاقت قائمة المعتمِدين - يُعرض داخل النافذة حتى لا يبحث المستخدم عن اسم
  // استبعدناه بصمت. صياغته تتبع من يُرسل: هو نفسه المنشئ، أو يُرسل نيابةً عنه.
  const getApproverExclusionHint = (plan: AnnualPlan): string => {
    const authorIsSender = plan.createdBy === currentUser?.id;
    if (authorIsSender) {
      return language === 'ar'
        ? 'حسابك غير معروض في القائمة: منشئ الخطة لا يعتمد خطته بنفسه، وهذا ما يجعل خطوة الاعتماد اعتماداً حقيقياً.'
        : 'Your own account is not listed: a plan\'s author cannot approve their own plan, which is the whole point of the approval step.';
    }
    const authorName = getUserName(plan.createdBy) || (language === 'ar' ? 'منشئ الخطة' : 'the plan author');
    return language === 'ar'
      ? `القائمة لا تعرض حسابك ولا حساب ${authorName} (منشئ الخطة): القواعد ترفض اعتماد صاحب الخطة لخطته، وترفض اعتماد من أرسلها.`
      : `The list excludes your own account and ${authorName} (the plan's author): the rules refuse an approval from a plan's author, and from whoever submits it.`;
  };

  // فتح نافذة الإرسال للاعتماد
  const handleOpenSubmitModal = () => {
    if (!selectedPlan) return;
    // لا نُرشّح معتمِداً سابقاً صار مستبعداً - خطة قديمة قد تحمل منشئها في
    // approverId، فيبدو الاختيار جاهزاً ثم يُرفض عند الحفظ.
    const previous = selectedPlan.approverId || '';
    setSelectedApproverId(previous && !excludedApproverIds.has(previous) ? previous : '');
    setApproverSearch('');
    setSubmitError('');
    setShowSubmitModal(true);
  };

  // إرسال الخطة للمعتمِد المختار
  const handleSubmitForApproval = async () => {
    if (!selectedPlan || isSubmitting) return;
    setSubmitError('');

    if ((selectedPlan.items || []).length === 0) {
      setSubmitError(t('plans.errors.noItems'));
      return;
    }
    // المعتمِد اختيار إجباري - لا يوجد معتمِد افتراضي في النظام
    if (!selectedApproverId) {
      setSubmitError(t('plans.errors.approverRequired'));
      return;
    }
    // الحارس الأخير قبل كتابة ترفضها القواعد: نفس شرطَي authorSubmits
    if (excludedApproverIds.has(selectedApproverId)) {
      setSubmitError(getApproverExclusionHint(selectedPlan));
      return;
    }

    setIsSubmitting(true);
    const saved = await updateAnnualPlan(selectedPlan.id, {
      status: 'pending_approval',
      approverId: selectedApproverId,
      submittedAt: new Date().toISOString(),
    });

    if (!saved) {
      setIsSubmitting(false);
      setSubmitError(t('plans.errors.submitFailed'));
      return;
    }

    // إشعار المعتمِد المختار
    const notified = await addNotification({
      type: 'plan_approval_request',
      title: language === 'ar' ? 'خطة سنوية بانتظار اعتمادك' : 'Annual Plan Awaiting Your Approval',
      message: language === 'ar'
        ? `أُرسلت خطة المراجعة السنوية ${selectedPlan.year} لاعتمادك من ${getUserName(currentUser?.id) || 'مدير الجودة'}`
        : `The ${selectedPlan.year} annual audit plan was submitted for your approval by ${getUserName(currentUser?.id) || 'the quality manager'}`,
      recipientId: selectedApproverId,
      senderId: currentUser?.id,
      planId: selectedPlan.id,
    });
    setIsSubmitting(false);

    setShowSubmitModal(false);
    // الخطة أُرسلت فعلاً، لكن الإشعار لم يصل - نخبر المستخدم بدل الصمت
    setDetailNotice(notified ? '' : t('plans.errors.notificationFailed'));
  };

  // سحب الطلب وإرجاع الخطة إلى مسودة، مع إشعار المعتمِد بسحب الطلب منه
  const handleRecallPlan = async () => {
    if (!selectedPlan || isRecalling) return;
    setRecallError('');

    const previousApproverId = selectedPlan.approverId;
    const reason = recallReason.trim();

    setIsRecalling(true);
    // الكتابة الوحيدة هي الانتقال pending_approval -> draft، وهو بالضبط ما يسمح
    // به فرع السحب في firestore.rules. لا نلمس approverId ولا submittedAt ولا
    // أختام القرار: أي مفتاح إضافي هو مخاطرة برفض الكتابة كاملة، والمعتمِد
    // السابق يبقى مسجّلاً على الخطة فيُرشَّح تلقائياً عند إعادة الإرسال ويظل
    // تغييره ممكناً من نافذة الإرسال. (updatedAt يضيفه updateAnnualPlan.)
    const saved = await updateAnnualPlan(selectedPlan.id, {
      status: 'draft',
    });

    if (!saved) {
      setIsRecalling(false);
      setRecallError(language === 'ar'
        ? 'تعذّر سحب الطلب. تحقق من الاتصال وأعد المحاولة.'
        : 'Could not recall the request. Check your connection and try again.');
      return;
    }

    // إشعار المعتمِد السابق بأن الطلب سُحب - لا يوجد نوع إشعار مخصص للسحب، فنستخدم
    // 'general' مع planId ليفتح الإشعار الخطة نفسها من قائمة التنبيهات.
    let notified = true;
    if (previousApproverId) {
      notified = !!(await addNotification({
        type: 'general',
        title: language === 'ar' ? 'سُحب طلب اعتماد الخطة السنوية' : 'Plan Approval Request Withdrawn',
        message: language === 'ar'
          ? `سحب ${getUserName(currentUser?.id)} طلب اعتماد خطة المراجعة السنوية ${selectedPlan.year}، وعادت الخطة إلى مسودة للتعديل. لم يعد مطلوباً منك اتخاذ قرار، وقد يصلك الطلب مرة أخرى بعد التعديل.${reason ? ` السبب: ${reason}` : ''}`
          : `${getUserName(currentUser?.id)} withdrew the ${selectedPlan.year} annual audit plan from approval and returned it to draft for editing. No decision is required from you any more, and the request may reach you again once the plan is revised.${reason ? ` Reason: ${reason}` : ''}`,
        recipientId: previousApproverId,
        senderId: currentUser?.id,
        planId: selectedPlan.id,
      }));
    }
    setIsRecalling(false);

    setShowRecallModal(false);
    setRecallReason('');
    setDetailNotice(notified ? '' : t('plans.errors.notificationFailed'));
  };

  // إنشاء مراجعة من بند مخطط: يفتح نموذج المراجعة محمّلاً بالإدارة والقسم والشهر
  // ونوع المراجعة ورئيس الفريق، والنموذج هو من يكتب معرّف المراجعة الناتجة على
  // البند (src/app/audits/new/page.tsx) - وبذلك تتحرك نسبة الإنجاز فعلياً.
  // الزر لموظفي الجودة فقط لأن قاعدة تحديث annualPlans في firestore.rules لا تسمح
  // لغيرهم بالكتابة على بنود الخطة، فلا معنى لعرضه لمن ستُرفض كتابته.
  const handleCreateAuditFromItem = (item: AnnualPlanItem) => {
    if (!selectedPlan) return;
    const params = new URLSearchParams({
      planId: selectedPlan.id,
      planItemId: item.id,
      year: String(selectedPlan.year),
      month: String(item.plannedMonth),
      departmentId: item.departmentId,
      type: item.auditType,
    });
    if (item.sectionId) params.set('sectionId', item.sectionId);
    if (item.leadAuditorId) params.set('leadAuditorId', item.leadAuditorId);
    // بقية الفريق تنتقل معه: النموذج يقرأها ويملأ بها فريق المراجعة، فلا يُعاد
    // اختيار الأسماء نفسها يدوياً بعد أن اختارها مدير الجودة على البند.
    if (item.auditorIds && item.auditorIds.length > 0) {
      params.set('auditorIds', item.auditorIds.join(','));
    }
    router.push(`/audits/new?${params.toString()}`);
  };

  // فتح نافذة القرار
  const handleOpenDecisionModal = (type: 'approve' | 'reject') => {
    setDecision(type);
    setDecisionComment('');
    setDecisionError('');
    setShowDecisionModal(true);
  };

  // اعتماد أو رفض الخطة - المعتمِد المختار فقط، أو مدير النظام
  const handleDecision = async () => {
    if (!selectedPlan || isDeciding) return;
    setDecisionError('');

    const approving = decision === 'approve';
    if (!approving && !decisionComment.trim()) {
      setDecisionError(t('plans.errors.reasonRequired'));
      return;
    }

    setIsDeciding(true);
    const now = new Date().toISOString();
    const saved = await updateAnnualPlan(
      selectedPlan.id,
      approving
        ? {
          status: 'approved',
          approvedBy: currentUser?.id || '',
          approvedAt: now,
          approverComment: decisionComment.trim(),
        }
        : {
          status: 'rejected',
          rejectedBy: currentUser?.id || '',
          rejectedAt: now,
          rejectionReason: decisionComment.trim(),
        }
    );

    if (!saved) {
      setIsDeciding(false);
      // النافذة تبقى مفتوحة ليعيد المحاولة دون فقدان التعليق
      setDecisionError(t('plans.errors.decisionFailed'));
      return;
    }

    // إشعار منشئ الخطة بالقرار
    const notified = await addNotification({
      type: approving ? 'plan_approved' : 'plan_rejected',
      title: approving
        ? (language === 'ar' ? 'تم اعتماد الخطة السنوية' : 'Annual Plan Approved')
        : (language === 'ar' ? 'تم رفض الخطة السنوية' : 'Annual Plan Rejected'),
      message: approving
        ? (language === 'ar'
          ? `اعتمد ${getUserName(currentUser?.id)} خطة المراجعة السنوية ${selectedPlan.year}`
          : `${getUserName(currentUser?.id)} approved the ${selectedPlan.year} annual audit plan`)
        : (language === 'ar'
          ? `رفض ${getUserName(currentUser?.id)} خطة المراجعة السنوية ${selectedPlan.year}. السبب: ${decisionComment.trim()}`
          : `${getUserName(currentUser?.id)} rejected the ${selectedPlan.year} annual audit plan. Reason: ${decisionComment.trim()}`),
      recipientId: selectedPlan.createdBy,
      senderId: currentUser?.id,
      planId: selectedPlan.id,
    });
    setIsDeciding(false);

    setShowDecisionModal(false);
    setDecisionComment('');
    setDetailNotice(notified ? '' : t('plans.errors.notificationFailed'));
  };

  // حذف خطة - للمسودات والمرفوضة فقط.
  //
  // الحذف لا يمسّ وثيقة الخطة وحدها: الإشعارات التي أنتجتها الخطة تظهر في الجرس
  // الموجود في رأس كل صفحة، فبقاؤها بعد الحذف يعني أن المعتمِد يظل يُطالَب باعتماد
  // خطة لم تعد موجودة، وأن الضغط على الإشعار يفتح /plans?plan=<محذوفة> فلا يحدث شيء.
  // لذلك يمضي الحذف على ثلاث خطوات مرتّبة: تُحذف الخطة، ثم تُنظَّف إشعاراتها، ثم
  // يُسجَّل الحذف في سجل النشاط ليبقى في السجل أثرٌ لمن حذف ماذا ومتى.
  //
  // ترتيب الخطوات مقصود: نجاح حذف الخطة هو نجاح العملية. تعذُّر تنظيف إشعار أو
  // كتابة قيد في السجل يُعرَض كملاحظة لا كفشل، وإلا فهمها المستخدم على أن الخطة
  // لم تُحذف وأعاد المحاولة على شيء لم يعد موجوداً. باقي الصفحات (لوحة التحكم
  // وهذه الصفحة) تقرأ الخطط عبر subscribeToAnnualPlans، فتختفي الخطة عنها لحظياً
  // دون أي عمل إضافي هنا.
  const confirmDeletePlan = async () => {
    if (!planToDelete || isDeleting) return;
    const plan = planToDelete;
    setDeleteError('');

    setIsDeleting(true);
    const deleted = await deleteAnnualPlan(plan.id);

    if (!deleted) {
      setIsDeleting(false);
      setDeleteError(t('plans.errors.deleteFailed'));
      return;
    }

    // إشعارات الخطة: طلب الاعتماد، وإشعار السحب، وقرار المعتمِد
    const cleanup = await deleteNotificationsForPlan(plan.id, {
      userId: currentUser?.id || '',
      isSystemAdmin,
    });
    setIsDeleting(false);

    // سجل النشاط - يُكتب ولا يُنتظر (recordActivity لا ترمي أبداً)
    if (currentUser) {
      void recordActivity({
        actorUserId: currentUser.id,
        actorName: currentUser.fullNameEn || currentUser.fullNameAr,
        actorEmail: currentUser.email ?? '',
        actorRole: currentUser.role,
        action: 'delete',
        entity: 'annualPlan',
        entityId: plan.id,
        entityLabel: plan.titleAr || plan.titleEn || `${plan.year}`,
        summaryAr: `حذف خطة المراجعة الداخلية السنوية ${plan.year} (${plan.items?.length || 0} بنداً مخططاً، الحالة قبل الحذف: ${plan.status === 'rejected' ? 'مرفوضة' : 'مسودة'})`,
        summaryEn: `Deleted the ${plan.year} annual internal audit plan (${plan.items?.length || 0} planned items, status before deletion: ${plan.status})`,
      });
    }

    if (selectedPlanId === plan.id) closePlanDetail();
    setPlanToDelete(null);

    setPageNotice(
      cleanup.failed > 0
        ? (language === 'ar'
          ? `حُذفت خطة ${plan.year} ولم تعد تظهر في أي صفحة، لكن تعذّر حذف بعض إشعاراتها - قد تبقى في جرس التنبيهات حتى يزيلها صاحبها.`
          : `The ${plan.year} plan was deleted and no longer appears on any page, but some of its notifications could not be removed - they may remain in their recipient's bell until dismissed.`)
        : (language === 'ar'
          ? `حُذفت خطة ${plan.year} مع إشعاراتها، ولم تعد تظهر في لوحة التحكم ولا في قائمة التنبيهات.`
          : `The ${plan.year} plan and its notifications were deleted; it no longer appears on the dashboard or in the notification list.`)
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--foreground)]">
              {t('plans.title')}
            </h1>
            <p className="mt-1 text-[var(--foreground-secondary)]">
              {t('plans.subtitle')}
            </p>
          </div>
          {canManagePlans && (
            <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => { setNewPlanError(''); setShowNewModal(true); }}>
              {t('plans.newPlan')}
            </Button>
          )}
        </div>

        {/* نتيجة الحذف أو خطة مفقودة - تبقى حتى يُغلقها القارئ */}
        {(pageNotice || missingPlanNotice) && (
          <div className="flex items-start gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 text-sm text-[var(--foreground-secondary)]">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--primary)]" />
            <span className="flex-1">{pageNotice || missingPlanNotice}</span>
            <button
              type="button"
              onClick={dismissPageNotice}
              className="shrink-0 rounded p-0.5 text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
              aria-label={language === 'ar' ? 'إغلاق' : 'Dismiss'}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--primary-light)]">
                <CalendarRange className="h-5 w-5 text-[var(--primary)]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--foreground)]">{stats.total}</p>
                <p className="text-sm text-[var(--foreground-secondary)]">{t('plans.stats.totalPlans')}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--foreground)]">{stats.pending}</p>
                <p className="text-sm text-[var(--foreground-secondary)]">{t('plans.stats.pendingApproval')}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
                <Shield className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--foreground)]">{stats.approved}</p>
                <p className="text-sm text-[var(--foreground-secondary)]">{t('plans.stats.approvedPlans')}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <ClipboardList className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--foreground)]">{stats.plannedAudits}</p>
                <p className="text-sm text-[var(--foreground-secondary)]">{t('plans.stats.plannedAudits')}</p>
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
                  placeholder={t('plans.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] py-2 ps-10 pe-4 text-sm"
                />
              </div>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as 'all' | AnnualPlanStatus)}
                className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm"
              >
                {statusFilters.map(status => (
                  <option key={status.value} value={status.value}>
                    {language === 'ar' ? status.labelAr : status.labelEn}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Plans Table */}
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('plans.table.year')}</TableHead>
                <TableHead>{t('plans.table.planTitle')}</TableHead>
                <TableHead>{t('plans.table.planStatus')}</TableHead>
                <TableHead>{t('plans.table.plannedItems')}</TableHead>
                <TableHead>{t('plans.table.progress')}</TableHead>
                <TableHead>{t('plans.table.approver')}</TableHead>
                <TableHead className="text-center">{t('common.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPlans.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-[360px] text-center">
                    <div className="flex flex-col items-center justify-center max-w-md mx-auto">
                      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--background-secondary)] mb-6">
                        <CalendarRange className="h-10 w-10 text-[var(--foreground-secondary)] opacity-50" />
                      </div>
                      <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">
                        {!plansLoaded
                          ? t('common.loading')
                          : (searchQuery || selectedStatus !== 'all'
                            ? t('plans.empty.noMatches')
                            : t('plans.empty.noPlans'))}
                      </h3>
                      <p className="text-[var(--foreground-secondary)] mb-6 max-w-sm">
                        {searchQuery || selectedStatus !== 'all'
                          ? t('plans.empty.noMatchesHint')
                          : t('plans.empty.noPlansHint')}
                      </p>
                      {canManagePlans && !searchQuery && selectedStatus === 'all' && plansLoaded && (
                        <Button onClick={() => { setNewPlanError(''); setShowNewModal(true); }}>
                          <Plus className="h-4 w-4 me-2" />
                          {t('plans.newPlan')}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredPlans.map((plan) => {
                  const progress = getPlanProgress(plan);
                  return (
                    <TableRow key={plan.id}>
                      <TableCell className="font-mono text-sm font-semibold">{plan.year}</TableCell>
                      <TableCell>
                        <p className="font-medium">{language === 'ar' ? plan.titleAr : plan.titleEn}</p>
                        <p className="text-xs text-[var(--foreground-muted)]">
                          {t('plans.table.createdBy')}: {getUserName(plan.createdBy) || '-'}
                        </p>
                      </TableCell>
                      <TableCell>{getStatusBadge(plan.status)}</TableCell>
                      <TableCell>
                        <span className="text-sm">{(plan.items || []).length}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 min-w-[120px]">
                          <div className="h-2 flex-1 rounded-full bg-[var(--background-tertiary)]">
                            <div
                              className="h-2 rounded-full bg-[var(--primary)]"
                              style={{ width: `${progress.percent}%` }}
                            />
                          </div>
                          <span className="text-xs text-[var(--foreground-secondary)] whitespace-nowrap">
                            {progress.created}/{progress.total}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{getUserName(plan.approverId) || '-'}</span>
                        {/* خطة سُحبت من الاعتماد تحتفظ بمعتمِدها السابق - نقولها
                            صراحةً حتى لا تُقرأ المسودة وكأن عليها طلباً قائماً */}
                        {plan.status === 'draft' && plan.approverId && (
                          <p className="text-xs text-[var(--foreground-muted)]">
                            {language === 'ar'
                              ? 'أُرسلت إليه سابقاً - يُؤكَّد أو يُغيَّر عند إعادة الإرسال'
                              : 'previously sent to — confirmed or changed on resubmit'}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleOpenPlan(plan)}
                            title={t('plans.actions.open')}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {canRecallPlan(plan) && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => {
                                setSelectedPlanId(plan.id);
                                setRecallReason('');
                                setRecallError('');
                                setShowRecallModal(true);
                              }}
                              title={language === 'ar' ? 'سحب الطلب وإرجاع الخطة إلى مسودة' : 'Recall and return the plan to draft'}
                            >
                              <Undo2 className="h-4 w-4" />
                            </Button>
                          )}
                          {canEditPlan(plan) && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                              onClick={() => { setDeleteError(''); setPlanToDelete(plan); }}
                              title={t('plans.actions.delete')}
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

        {/* New Plan Modal */}
        {showNewModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowNewModal(false)} />
            <div className="relative z-50 w-full max-w-lg rounded-xl bg-white dark:bg-gray-900 p-6 shadow-xl mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">{t('plans.newPlan')}</h2>
                <Button variant="ghost" size="icon-sm" onClick={() => setShowNewModal(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">{t('plans.form.year')} *</label>
                  <input
                    type="number"
                    value={newPlan.year}
                    onChange={(e) => setNewPlan({ ...newPlan, year: Number(e.target.value) })}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">{t('plans.form.titleAr')} *</label>
                  <input
                    type="text"
                    value={newPlan.titleAr}
                    onChange={(e) => setNewPlan({ ...newPlan, titleAr: e.target.value })}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">{t('plans.form.titleEn')}</label>
                  <input
                    type="text"
                    value={newPlan.titleEn}
                    onChange={(e) => setNewPlan({ ...newPlan, titleEn: e.target.value })}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm"
                  />
                </div>

                {newPlanError && (
                  <div className="flex items-start gap-2 rounded-lg bg-[var(--status-error-bg)] p-3 text-sm text-[var(--status-error)]">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{newPlanError}</span>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setShowNewModal(false)}>
                    {t('common.cancel')}
                  </Button>
                  <Button onClick={handleCreatePlan} isLoading={isSavingPlan}>
                    {t('common.save')}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Plan Detail Modal */}
        {selectedPlan && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={closePlanDetail} />
            <div className="relative z-50 w-full max-w-5xl rounded-xl bg-white dark:bg-gray-900 p-6 shadow-xl mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-semibold">
                      {language === 'ar' ? selectedPlan.titleAr : selectedPlan.titleEn}
                    </h2>
                    {getStatusBadge(selectedPlan.status)}
                  </div>
                  <p className="mt-1 text-sm text-[var(--foreground-secondary)]">
                    {t('plans.form.year')}: {selectedPlan.year} · {t('plans.table.createdBy')}: {getUserName(selectedPlan.createdBy) || '-'}
                  </p>
                </div>
                <Button variant="ghost" size="icon-sm" onClick={closePlanDetail}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Progress summary - يقرؤه ويدجت التقدم في لوحة المعلومات */}
              <Card className="mb-6">
                <CardContent className="p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm font-medium">{t('plans.detail.progressTitle')}</p>
                    <p className="text-sm text-[var(--foreground-secondary)]">
                      {getPlanProgress(selectedPlan).created} / {getPlanProgress(selectedPlan).total} · {getPlanProgress(selectedPlan).percent}%
                    </p>
                  </div>
                  <div className="mt-2 h-2 w-full rounded-full bg-[var(--background-tertiary)]">
                    <div
                      className="h-2 rounded-full bg-[var(--primary)]"
                      style={{ width: `${getPlanProgress(selectedPlan).percent}%` }}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Approval details */}
              {(selectedPlan.status === 'approved' || selectedPlan.status === 'rejected' || selectedPlan.status === 'pending_approval') && (
                <Card className="mb-6">
                  <CardContent className="p-4 space-y-1 text-sm">
                    <p className="flex items-center gap-2 text-[var(--foreground-secondary)]">
                      <UserCheck className="h-4 w-4" />
                      {t('plans.detail.approver')}: <span className="text-[var(--foreground)] font-medium">{getUserName(selectedPlan.approverId) || '-'}</span>
                    </p>
                    {selectedPlan.status === 'approved' && selectedPlan.approvedAt && (
                      <p className="text-[var(--foreground-secondary)]">
                        {t('plans.detail.approvedAt')}: {new Date(selectedPlan.approvedAt).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}
                      </p>
                    )}
                    {selectedPlan.status === 'approved' && selectedPlan.approverComment && (
                      <p className="text-[var(--foreground-secondary)]">
                        {t('plans.detail.comment')}: {selectedPlan.approverComment}
                      </p>
                    )}
                    {selectedPlan.status === 'rejected' && (
                      <p className="text-[var(--status-error)]">
                        {t('plans.detail.rejectionReason')}: {selectedPlan.rejectionReason || '-'}
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Read-only notice for an approved plan */}
              {selectedPlan.status === 'approved' && (
                <div className="mb-6 flex items-start gap-2 rounded-lg bg-[var(--status-success-bg)] p-3 text-sm text-[var(--status-success)]">
                  <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{t('plans.detail.readOnly')}</span>
                </div>
              )}

              {/* How a planned line becomes a real audit */}
              {selectedPlan.status === 'approved' && canManagePlans && (
                <div className="mb-6 flex items-start gap-2 rounded-lg bg-[var(--background-secondary)] p-3 text-sm text-[var(--foreground-secondary)]">
                  <ClipboardPlus className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    {language === 'ar'
                      ? 'أنشئ المراجعة من بندها عبر زر الإنشاء في عمود الإجراءات: يفتح نموذج المراجعة محمّلاً بالإدارة والقسم والشهر ورئيس الفريق، ويُربط معرّف المراجعة بالبند فور حفظها فتتحرك نسبة الإنجاز.'
                      : 'Create each audit from its planned line using the button in the actions column: the audit form opens pre-filled with the department, section, month and lead auditor, and the new audit id is written back onto the line, which is what moves the progress bar.'}
                  </span>
                </div>
              )}

              {/* A plan waiting on an approver is not a dead end any more.
                  The same note is where we say, once, that the decision is the
                  named approver's alone - so a system_admin who expected an
                  Approve button reads why there is none instead of meeting a
                  permission-denied. */}
              {canRecallPlan(selectedPlan) && (
                <div className="mb-6 flex items-start gap-2 rounded-lg bg-[var(--status-warning-bg)] p-3 text-sm text-[var(--status-warning)]">
                  <Clock className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    {language === 'ar'
                      ? `هذه الخطة بانتظار قرار ${getUserName(selectedPlan.approverId) || 'المعتمِد المسمّى عليها'}، والاعتماد أو الرفض من صلاحيته وحده - ولو كنت مدير النظام. اسحب الطلب لإرجاعها إلى مسودة إن أردت تعديلها أو إرسالها إلى معتمِد آخر أو حذفها.`
                      : `This plan is waiting on ${getUserName(selectedPlan.approverId) || 'its named approver'}, and approving or rejecting it is theirs alone to do — a system administrator included. Recall the request to return the plan to draft if you need to edit it, send it to a different approver, or delete it.`}
                    {selectedPlan.approverId && selectedPlan.approverId === selectedPlan.createdBy && (
                      <>
                        {' '}
                        {language === 'ar'
                          ? 'ملاحظة: المعتمِد المسمّى هنا هو منشئ الخطة نفسه، وقواعد قاعدة البيانات ترفض أن يعتمد صاحب الخطة خطته - فلا سبيل لاعتمادها إلا بسحب الطلب وإرساله إلى شخص آخر.'
                          : 'Note: the named approver here is the plan\'s own author, and the database rules refuse an approval from a plan\'s author — the only way forward is to recall the request and send it to somebody else.'}
                      </>
                    )}
                  </span>
                </div>
              )}

              {/* The named approver of a plan they wrote themselves: the buttons
                  are hidden and they are not the author-side audience of the
                  note above, so the explanation has to reach them here. */}
              {selectedPlan.status === 'pending_approval'
                && selectedPlan.approverId === currentUser?.id
                && !canDecideOnPlan(selectedPlan)
                && !canRecallPlan(selectedPlan) && (
                  <div className="mb-6 flex items-start gap-2 rounded-lg bg-[var(--status-warning-bg)] p-3 text-sm text-[var(--status-warning)]">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>
                      {language === 'ar'
                        ? `أنت مُسجَّل معتمِداً لهذه الخطة، لكنك أيضاً منشئها، والقواعد ترفض أن يعتمد صاحب الخطة خطته. اطلب من ${getUserName(selectedPlan.createdBy) || 'منشئ الخطة'} أو من مدير النظام سحب الطلب وإرساله إلى معتمِد آخر.`
                        : `You are named as this plan's approver, but you are also its author, and the rules refuse an approval from a plan's author. Ask ${getUserName(selectedPlan.createdBy) || 'the plan author'} or a system administrator to recall the request and send it to a different approver.`}
                    </span>
                  </div>
                )}

              {/* Items */}
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ClipboardList className="h-5 w-5 text-[var(--primary)]" />
                    {t('plans.detail.itemsTitle')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('plans.table.department')}</TableHead>
                        <TableHead>{t('plans.table.section')}</TableHead>
                        <TableHead>{t('plans.table.month')}</TableHead>
                        <TableHead>{t('plans.table.auditType')}</TableHead>
                        <TableHead>{t('plans.table.leadAuditor')}</TableHead>
                        <TableHead>{t('plans.table.team')}</TableHead>
                        <TableHead>{t('plans.table.auditCreated')}</TableHead>
                        {showItemActions(selectedPlan) && (
                          <TableHead className="text-center">{t('common.actions')}</TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(selectedPlan.items || []).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={showItemActions(selectedPlan) ? 8 : 7} className="py-8 text-center text-[var(--foreground-secondary)]">
                            {t('plans.detail.noItems')}
                          </TableCell>
                        </TableRow>
                      ) : (
                        [...(selectedPlan.items || [])]
                          .sort((a, b) => a.plannedMonth - b.plannedMonth)
                          .map(item => (
                            <TableRow key={item.id}>
                              <TableCell>
                                <p className="text-sm font-medium">{getDepartmentName(item.departmentId)}</p>
                                {item.notes && (
                                  <p className="text-xs text-[var(--foreground-muted)]">{item.notes}</p>
                                )}
                              </TableCell>
                              <TableCell className="text-sm">{getSectionName(item.sectionId) || '-'}</TableCell>
                              <TableCell className="text-sm">{getMonthName(item.plannedMonth)}</TableCell>
                              <TableCell className="text-sm">{getTypeName(item.auditType)}</TableCell>
                              <TableCell className="text-sm">{getUserName(item.leadAuditorId) || '-'}</TableCell>
                              <TableCell className="text-sm">
                                {(item.auditorIds || []).length === 0
                                  ? '-'
                                  : (item.auditorIds || [])
                                    .map(id => getUserName(id) || id)
                                    .join(language === 'ar' ? '، ' : ', ')}
                              </TableCell>
                              <TableCell>
                                {item.auditId ? (
                                  <Badge variant="success">{t('plans.detail.auditCreatedYes')}</Badge>
                                ) : (
                                  <Badge variant="draft">{t('plans.detail.auditCreatedNo')}</Badge>
                                )}
                              </TableCell>
                              {showItemActions(selectedPlan) && (
                                <TableCell>
                                  <div className="flex items-center justify-center gap-1">
                                    {item.auditId ? (
                                      <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        onClick={() => router.push(`/audits/${item.auditId}`)}
                                        title={language === 'ar' ? 'فتح المراجعة المرتبطة' : 'Open the linked audit'}
                                      >
                                        <ExternalLink className="h-4 w-4" />
                                      </Button>
                                    ) : (
                                      selectedPlan.status === 'approved' && canManagePlans && (
                                        <Button
                                          variant="ghost"
                                          size="icon-sm"
                                          onClick={() => handleCreateAuditFromItem(item)}
                                          title={language === 'ar' ? 'إنشاء مراجعة من هذا البند' : 'Create an audit from this planned line'}
                                        >
                                          <ClipboardPlus className="h-4 w-4" />
                                        </Button>
                                      )
                                    )}
                                    {canEditPlan(selectedPlan) && (
                                      <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                        onClick={() => handleRemoveItem(item.id)}
                                        disabled={isSavingItem}
                                        title={t('plans.actions.removeItem')}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </div>
                                </TableCell>
                              )}
                            </TableRow>
                          ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Add item form - only while the plan is editable */}
              {canEditPlan(selectedPlan) && (
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Plus className="h-5 w-5 text-[var(--primary)]" />
                      {t('plans.detail.addItemTitle')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <div>
                        <label className="mb-1.5 block text-sm font-medium">{t('plans.table.department')} *</label>
                        <select
                          value={newItem.departmentId}
                          onChange={(e) => {
                            const departmentId = e.target.value;
                            setNewItem({
                              ...newItem,
                              departmentId,
                              sectionId: '',
                              leadAuditorId: keepIndependent(
                                newItem.leadAuditorId ? [newItem.leadAuditorId] : [], departmentId, ''
                              )[0] || '',
                              auditorIds: keepIndependent(newItem.auditorIds, departmentId, ''),
                            });
                          }}
                          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm"
                        >
                          <option value="">{t('plans.form.selectDepartment')}</option>
                          {departmentOptions.map(dept => (
                            <option key={dept.id} value={dept.id}>
                              {language === 'ar' ? dept.nameAr : dept.nameEn}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium">{t('plans.table.section')}</label>
                        <select
                          value={newItem.sectionId}
                          onChange={(e) => {
                            const sectionId = e.target.value;
                            setNewItem({
                              ...newItem,
                              sectionId,
                              leadAuditorId: keepIndependent(
                                newItem.leadAuditorId ? [newItem.leadAuditorId] : [], newItem.departmentId, sectionId
                              )[0] || '',
                              auditorIds: keepIndependent(newItem.auditorIds, newItem.departmentId, sectionId),
                            });
                          }}
                          disabled={!newItem.departmentId}
                          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm disabled:opacity-50"
                        >
                          <option value="">{t('plans.form.allSections')}</option>
                          {getSectionOptions(newItem.departmentId).map(section => (
                            <option key={section.id} value={section.id}>
                              {language === 'ar' ? section.nameAr : section.nameEn}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium">{t('plans.table.month')} *</label>
                        <select
                          value={newItem.plannedMonth}
                          onChange={(e) => setNewItem({ ...newItem, plannedMonth: Number(e.target.value) })}
                          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm"
                        >
                          {months.map(month => (
                            <option key={month.value} value={month.value}>
                              {language === 'ar' ? month.labelAr : month.labelEn}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium">{t('plans.table.auditType')} *</label>
                        <select
                          value={newItem.auditType}
                          onChange={(e) => setNewItem({ ...newItem, auditType: e.target.value as AuditType })}
                          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm"
                        >
                          {auditTypes.map(type => (
                            <option key={type.value} value={type.value}>
                              {language === 'ar' ? type.labelAr : type.labelEn}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium">{t('plans.table.leadAuditor')}</label>
                        <select
                          value={newItem.leadAuditorId}
                          onChange={(e) => {
                            const leadAuditorId = e.target.value;
                            setNewItem({
                              ...newItem,
                              leadAuditorId,
                              // من رُقّي رئيساً للفريق يخرج من قائمة الأعضاء - لا يُحسب مرتين
                              auditorIds: newItem.auditorIds.filter(id => id !== leadAuditorId),
                            });
                          }}
                          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm"
                        >
                          <option value="">{t('plans.form.selectLater')}</option>
                          {auditors.map(auditor => (
                            <option key={auditor.id} value={auditor.id}>
                              {language === 'ar' ? auditor.fullNameAr : auditor.fullNameEn}
                            </option>
                          ))}
                        </select>
                      </div>
                      {/* بقية فريق المراجعة - يُضاف عضو في كل مرة، والمضافون يظهرون
                          كوسوم قابلة للإزالة. القائمة هي نفسها قائمة رئيس الفريق:
                          مراجعون مستقلون عن الجهة محل المراجعة لا غير. */}
                      <div>
                        <label className="mb-1.5 block text-sm font-medium">{t('plans.table.team')}</label>
                        <select
                          value=""
                          onChange={(e) => addTeamMember(e.target.value)}
                          disabled={availableTeamAuditors.length === 0}
                          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm disabled:opacity-50"
                        >
                          <option value="">
                            {availableTeamAuditors.length === 0
                              ? t('plans.form.noMoreAuditors')
                              : t('plans.form.addTeamMember')}
                          </option>
                          {availableTeamAuditors.map(auditor => (
                            <option key={auditor.id} value={auditor.id}>
                              {language === 'ar' ? auditor.fullNameAr : auditor.fullNameEn}
                            </option>
                          ))}
                        </select>
                        {newItem.auditorIds.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {newItem.auditorIds.map(id => (
                              <span
                                key={id}
                                className="inline-flex items-center gap-1 rounded-full bg-[var(--primary)]/10 px-3 py-1 text-xs text-[var(--primary)]"
                              >
                                {getUserName(id) || id}
                                <button
                                  type="button"
                                  onClick={() => removeTeamMember(id)}
                                  className="hover:text-red-500"
                                  aria-label={language === 'ar' ? 'إزالة من الفريق' : 'Remove from the team'}
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium">{t('plans.form.notes')}</label>
                        <input
                          type="text"
                          value={newItem.notes}
                          onChange={(e) => setNewItem({ ...newItem, notes: e.target.value })}
                          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button
                        leftIcon={<Plus className="h-4 w-4" />}
                        onClick={handleAddItem}
                        isLoading={isSavingItem}
                      >
                        {t('plans.actions.addItem')}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Detail level messages */}
              {detailError && (
                <div className="mb-4 flex items-start gap-2 rounded-lg bg-[var(--status-error-bg)] p-3 text-sm text-[var(--status-error)]">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{detailError}</span>
                </div>
              )}
              {detailNotice && (
                <div className="mb-4 flex items-start gap-2 rounded-lg bg-[var(--status-warning-bg)] p-3 text-sm text-[var(--status-warning)]">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{detailNotice}</span>
                </div>
              )}

              {/* Footer actions */}
              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--border)] pt-4">
                <Button variant="outline" onClick={closePlanDetail}>
                  {t('common.close')}
                </Button>

                {canEditPlan(selectedPlan) && (
                  <Button leftIcon={<Send className="h-4 w-4" />} onClick={handleOpenSubmitModal}>
                    {t('plans.actions.submitForApproval')}
                  </Button>
                )}

                {canRecallPlan(selectedPlan) && (
                  <Button
                    variant="outline"
                    leftIcon={<Undo2 className="h-4 w-4" />}
                    onClick={() => { setRecallReason(''); setRecallError(''); setShowRecallModal(true); }}
                  >
                    {language === 'ar' ? 'سحب الطلب' : 'Recall Request'}
                  </Button>
                )}

                {canDecideOnPlan(selectedPlan) && (
                  <>
                    <Button
                      variant="danger"
                      leftIcon={<XCircle className="h-4 w-4" />}
                      onClick={() => handleOpenDecisionModal('reject')}
                    >
                      {t('plans.actions.reject')}
                    </Button>
                    <Button
                      variant="success"
                      leftIcon={<CheckCircle className="h-4 w-4" />}
                      onClick={() => handleOpenDecisionModal('approve')}
                    >
                      {t('plans.actions.approve')}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Submit for approval modal - choosing the approver */}
        {showSubmitModal && selectedPlan && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowSubmitModal(false)} />
            <div className="relative z-[60] w-full max-w-lg rounded-xl bg-white dark:bg-gray-900 p-6 shadow-xl mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">{t('plans.submit.title')}</h2>
                <Button variant="ghost" size="icon-sm" onClick={() => setShowSubmitModal(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <p className="mb-2 text-sm text-[var(--foreground-secondary)]">
                {t('plans.submit.description')}
              </p>

              {/* من استُبعد ولماذا - القائمة أضيق مما يتوقعه المستخدم عمداً */}
              <p className="mb-4 flex items-start gap-2 rounded-lg bg-[var(--background-secondary)] p-3 text-xs text-[var(--foreground-secondary)]">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>{getApproverExclusionHint(selectedPlan)}</span>
              </p>

              <div className="relative mb-3">
                <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--foreground-muted)]" />
                <input
                  type="text"
                  value={approverSearch}
                  onChange={(e) => setApproverSearch(e.target.value)}
                  placeholder={t('plans.submit.searchPlaceholder')}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] py-2 ps-10 pe-4 text-sm"
                />
              </div>

              <div className="mb-4 max-h-64 overflow-y-auto rounded-lg border border-[var(--border)]">
                {approverCandidates.length === 0 ? (
                  <p className="p-4 text-center text-sm text-[var(--foreground-secondary)]">
                    {t('plans.submit.noUsers')}
                  </p>
                ) : (
                  approverCandidates.map(user => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => setSelectedApproverId(user.id)}
                      className={`flex w-full items-center gap-3 px-4 py-2.5 text-start transition-colors ${selectedApproverId === user.id
                        ? 'bg-[var(--primary-light)] text-[var(--primary)]'
                        : 'hover:bg-[var(--background-secondary)]'
                        }`}
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--primary-light)] text-xs font-medium text-[var(--primary)]">
                        {(language === 'ar' ? user.fullNameAr : user.fullNameEn).charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {language === 'ar' ? user.fullNameAr : user.fullNameEn}
                        </p>
                        <p className="truncate text-xs text-[var(--foreground-muted)]">
                          {(language === 'ar' ? user.jobTitleAr : user.jobTitleEn) || user.email}
                        </p>
                      </div>
                      {selectedApproverId === user.id && (
                        <CheckCircle className="ms-auto h-4 w-4 shrink-0" />
                      )}
                    </button>
                  ))
                )}
              </div>

              {submitError && (
                <div className="mb-4 flex items-start gap-2 rounded-lg bg-[var(--status-error-bg)] p-3 text-sm text-[var(--status-error)]">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{submitError}</span>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowSubmitModal(false)}>
                  {t('common.cancel')}
                </Button>
                <Button
                  leftIcon={<Send className="h-4 w-4" />}
                  onClick={handleSubmitForApproval}
                  isLoading={isSubmitting}
                >
                  {t('plans.actions.submitForApproval')}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Approve / Reject modal */}
        {showDecisionModal && selectedPlan && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowDecisionModal(false)} />
            <div className="relative z-[60] w-full max-w-lg rounded-xl bg-white dark:bg-gray-900 p-6 shadow-xl mx-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">
                  {decision === 'approve' ? t('plans.decision.approveTitle') : t('plans.decision.rejectTitle')}
                </h2>
                <Button variant="ghost" size="icon-sm" onClick={() => setShowDecisionModal(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <label className="mb-1.5 block text-sm font-medium">
                {decision === 'approve' ? t('plans.decision.commentOptional') : t('plans.decision.reasonRequired')}
              </label>
              <textarea
                value={decisionComment}
                onChange={(e) => setDecisionComment(e.target.value)}
                rows={4}
                className="mb-4 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm"
              />

              {decisionError && (
                <div className="mb-4 flex items-start gap-2 rounded-lg bg-[var(--status-error-bg)] p-3 text-sm text-[var(--status-error)]">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{decisionError}</span>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowDecisionModal(false)}>
                  {t('common.cancel')}
                </Button>
                <Button
                  variant={decision === 'approve' ? 'success' : 'danger'}
                  onClick={handleDecision}
                  isLoading={isDeciding}
                >
                  {decision === 'approve' ? t('plans.actions.approve') : t('plans.actions.reject')}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Recall from approval modal */}
        {showRecallModal && selectedPlan && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowRecallModal(false)} />
            <div className="relative z-[60] w-full max-w-lg rounded-xl bg-white dark:bg-gray-900 p-6 shadow-xl mx-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">
                  {language === 'ar' ? 'سحب طلب الاعتماد' : 'Recall Approval Request'}
                </h2>
                <Button variant="ghost" size="icon-sm" onClick={() => setShowRecallModal(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <p className="mb-4 text-sm text-[var(--foreground-secondary)]">
                {language === 'ar'
                  ? `ستعود خطة ${selectedPlan.year} إلى حالة مسودة فتصير قابلة للتعديل والحذف من جديد، ويُخطر ${getUserName(selectedPlan.approverId) || 'المعتمِد'} بسحب الطلب فلا يبقى عليه قرار. البنود المُدخلة تبقى كما هي، ويبقى المعتمِد السابق مُرشَّحاً عند إعادة الإرسال ولك تغييره.`
                  : `The ${selectedPlan.year} plan returns to draft, so it becomes editable and deletable again, and ${getUserName(selectedPlan.approverId) || 'the approver'} is notified that the request was withdrawn and has no decision left to make. The planned items are kept, and the previous approver stays pre-selected when you resubmit — you can pick someone else there.`}
              </p>

              <label className="mb-1.5 block text-sm font-medium">
                {language === 'ar' ? 'سبب السحب (اختياري)' : 'Reason for recalling (optional)'}
              </label>
              <textarea
                value={recallReason}
                onChange={(e) => setRecallReason(e.target.value)}
                rows={3}
                className="mb-4 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm"
              />

              {recallError && (
                <div className="mb-4 flex items-start gap-2 rounded-lg bg-[var(--status-error-bg)] p-3 text-sm text-[var(--status-error)]">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{recallError}</span>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowRecallModal(false)}>
                  {t('common.cancel')}
                </Button>
                <Button
                  leftIcon={<Undo2 className="h-4 w-4" />}
                  onClick={handleRecallPlan}
                  isLoading={isRecalling}
                >
                  {language === 'ar' ? 'سحب الطلب' : 'Recall Request'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Delete plan modal */}
        {planToDelete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setPlanToDelete(null)} />
            <div className="relative z-[60] w-full max-w-md rounded-xl bg-white dark:bg-gray-900 p-6 shadow-xl mx-4">
              <h2 className="mb-2 text-lg font-semibold">{t('plans.delete.title')}</h2>
              <p className="mb-2 text-sm text-[var(--foreground-secondary)]">
                {t('plans.delete.description')} ({planToDelete.year})
              </p>
              {/* ما يذهب مع الخطة - يُقال قبل الضغط لا بعده */}
              <p className="mb-4 text-sm text-[var(--foreground-muted)]">
                {t('plans.delete.cascade')}
              </p>

              {deleteError && (
                <div className="mb-4 flex items-start gap-2 rounded-lg bg-[var(--status-error-bg)] p-3 text-sm text-[var(--status-error)]">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{deleteError}</span>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setPlanToDelete(null)}>
                  {t('common.cancel')}
                </Button>
                <Button variant="danger" onClick={confirmDeletePlan} isLoading={isDeleting}>
                  {t('common.delete')}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

// حدود Suspense التي يفرضها useSearchParams على صفحة عميل في App Router.
// البديل الوحيد هو قراءة window.location مرة واحدة، وهو ما جعل رابط الإشعار
// بلا أثر لمن هو أصلاً على هذه الصفحة.
export default function PlansPage() {
  return (
    <Suspense fallback={null}>
      <PlansPageContent />
    </Suspense>
  );
}
