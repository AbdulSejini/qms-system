'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { Badge, Button } from '@/components/ui';
import { useTranslation } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { subscribeToAudits, subscribeToAnnualPlans, Audit as FirestoreAudit } from '@/lib/firestore';
import { AnnualPlan } from '@/types';
import {
  ClipboardCheck,
  AlertCircle,
  CheckCircle,
  Clock,
  Calendar,
  CalendarClock,
  TrendingUp,
  ArrowRight,
  ArrowLeft,
  Users,
  Building2,
  Target,
  Plus,
  ListChecks,
  CheckSquare,
  FileCheck,
} from 'lucide-react';

// Types
interface DashboardStats {
  totalAudits: number;
  activeAudits: number;
  completedAudits: number;
  totalFindings: number;
  openFindings: number;
  overdueFindings: number;
  closedFindings: number;
  totalDepartments: number;
}

interface RecentAudit {
  id: string;
  number: string;
  titleAr: string;
  titleEn: string;
  status: string;
  startDate: string;
  departmentName?: string;
}

interface RecentFinding {
  id: string;
  number: string;
  titleAr: string;
  titleEn: string;
  severity: string;
  status: string;
  dueDate: string;
}

// بند بانتظار تصرّف المستخدم الحالي - مراجعة بانتظار الاعتماد أو خطة سنوية هو معتمِدها
interface PendingApprovalItem {
  id: string;
  kind: 'audit' | 'plan';
  title: string;
  subtitle: string;
  href: string;
}

// مراجعة لم يبدأ تنفيذها بعد
interface UpcomingAudit {
  id: string;
  title: string;
  startDate: string;
  departmentName: string;
  daysRemaining: number;
}


export default function DashboardPage() {
  const router = useRouter();
  const { t, language, isRTL } = useTranslation();
  const { currentUser, hasPermission, departments } = useAuth();

  // Raw audits from Firestore - كل الإحصائيات تُشتق منها عبر useMemo
  const [rawAudits, setRawAudits] = useState<FirestoreAudit[]>([]);

  // Raw annual plans from Firestore - تُشتق منها نسبة إنجاز الخطة والموافقات المعلّقة
  const [rawPlans, setRawPlans] = useState<AnnualPlan[]>([]);

  // Subscribe to audits from Firestore (once - no dependency on users/departments/language)
  useEffect(() => {
    const unsubscribe = subscribeToAudits((firestoreAudits) => {
      setRawAudits(firestoreAudits);
    });

    return () => unsubscribe();
  }, []);

  // Subscribe to annual plans from Firestore (once - same pattern as audits)
  useEffect(() => {
    const unsubscribe = subscribeToAnnualPlans((firestorePlans) => {
      setRawPlans(firestorePlans);
    });

    return () => unsubscribe();
  }, []);

  // Extract all findings from audits
  const allFindings = useMemo(() => {
    const findings: any[] = [];
    rawAudits.forEach((audit: any) => {
      if (audit.findings && Array.isArray(audit.findings)) {
        audit.findings.forEach((finding: any) => {
          findings.push({
            ...finding,
            auditNumber: audit.number || audit.id,
            auditId: audit.id,
          });
        });
      }
    });
    return findings;
  }, [rawAudits]);

  // Calculate stats
  const stats = useMemo<DashboardStats>(() => {
    const activeAudits = rawAudits.filter(a =>
      a.status !== 'completed' && a.status !== 'cancelled'
    ).length;
    const completedAudits = rawAudits.filter(a => a.status === 'completed').length;
    const openFindings = allFindings.filter(f => f.status !== 'closed').length;
    const closedFindings = allFindings.filter(f => f.status === 'closed').length;
    const overdueFindings = allFindings.filter(f => {
      if (f.status === 'closed') return false;
      const dueDate = new Date(f.estimatedClosingDate || f.dueDate);
      return dueDate < new Date();
    }).length;

    return {
      totalAudits: rawAudits.length,
      activeAudits,
      completedAudits,
      totalFindings: allFindings.length,
      openFindings,
      overdueFindings,
      closedFindings,
      totalDepartments: departments.length,
    };
  }, [rawAudits, allFindings, departments]);

  // Recent audits (last 5)
  const recentAudits = useMemo<RecentAudit[]>(() => {
    return [...rawAudits]
      .sort((a, b) => new Date(b.createdAt || b.startDate).getTime() - new Date(a.createdAt || a.startDate).getTime())
      .slice(0, 5)
      .map(audit => {
        const dept = departments.find((d: any) => d.id === audit.departmentId);
        return {
          id: audit.id,
          number: audit.id.replace('audit-', 'AUD-'),
          titleAr: audit.titleAr || 'مراجعة',
          titleEn: audit.titleEn || 'Audit',
          status: audit.status,
          startDate: audit.startDate,
          departmentName: dept ? (language === 'ar' ? dept.nameAr : dept.nameEn) : '',
        };
      });
  }, [rawAudits, departments, language]);

  // Recent findings (last 4)
  const recentFindings = useMemo<RecentFinding[]>(() => {
    return [...allFindings]
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 4)
      .map(finding => ({
        id: finding.id,
        number: finding.number || `${finding.auditNumber}-F`,
        titleAr: finding.finding || finding.titleAr || 'ملاحظة',
        titleEn: finding.finding || finding.titleEn || 'Finding',
        severity: finding.categoryB === 'major_nc' ? 'major' : finding.categoryB === 'minor_nc' ? 'minor' : 'observation',
        status: finding.status || 'open',
        dueDate: finding.estimatedClosingDate || finding.dueDate || '',
      }));
  }, [allFindings]);

  // Finding due dates - المراجعات القادمة صار لها ودجت مستقلة، فبقيت هنا استحقاقات الملاحظات
  const findingDeadlines = useMemo<any[]>(() => {
    const tasks: any[] = [];

    allFindings.filter(f => f.status !== 'closed').forEach(finding => {
      const dueDate = finding.estimatedClosingDate || finding.dueDate;
      if (dueDate) {
        tasks.push({
          id: `finding-${finding.id}`,
          type: 'finding',
          title: language === 'ar' ? (finding.finding?.substring(0, 40) || 'ملاحظة') : (finding.finding?.substring(0, 40) || 'Finding'),
          date: dueDate,
          priority: finding.categoryB === 'major_nc' ? 'high' : 'medium',
        });
      }
    });

    // Sort by date and take first 5
    tasks.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return tasks.slice(0, 5);
  }, [allFindings, language]);

  // Annual audit progress - بنود خطة السنة الحالية المعتمدة مقابل ما أُنشئت له مراجعة فعلياً.
  // البند يُحتسب منجزاً فقط إذا كان auditId موجوداً وما زالت المراجعة قائمة.
  const currentYear = new Date().getFullYear();
  const annualProgress = useMemo(() => {
    const approvedPlans = rawPlans
      .filter(p => p.year === currentYear && p.status === 'approved')
      .sort((a, b) =>
        new Date(b.updatedAt || b.createdAt || 0).getTime() -
        new Date(a.updatedAt || a.createdAt || 0).getTime()
      );
    const plan = approvedPlans[0];

    if (!plan) {
      return { hasPlan: false, planned: 0, created: 0, percentage: 0 };
    }

    const auditIds = new Set(rawAudits.map(a => a.id));
    const items = plan.items || [];
    const created = items.filter(item => item.auditId && auditIds.has(item.auditId)).length;

    return {
      hasPlan: true,
      planned: items.length,
      created,
      percentage: items.length > 0 ? Math.round((created / items.length) * 100) : 0,
    };
  }, [rawPlans, rawAudits, currentYear]);

  // Pending approvals - ما ينتظر تصرّف المستخدم الحالي وحده، لا كل ما هو معلّق في النظام
  const pendingApprovals = useMemo<PendingApprovalItem[]>(() => {
    const items: PendingApprovalItem[] = [];
    if (!currentUser) return items;

    // المراجعات: من يملك صلاحية الاعتماد فقط (مدير النظام ومدير الجودة)
    if (hasPermission('canApproveAudits')) {
      rawAudits
        .filter(a => a.status === 'pending_approval' || a.status === 'qms_review')
        .forEach(audit => {
          const dept = departments.find((d: any) => d.id === audit.departmentId);
          items.push({
            id: `audit-${audit.id}`,
            kind: 'audit',
            title: language === 'ar' ? (audit.titleAr || 'مراجعة') : (audit.titleEn || 'Audit'),
            subtitle: dept
              ? (language === 'ar' ? dept.nameAr : dept.nameEn)
              : (audit.status === 'qms_review'
                  ? (language === 'ar' ? 'مراجعة إدارة الجودة' : 'QMS review')
                  : (language === 'ar' ? 'بانتظار الاعتماد' : 'Awaiting approval')),
            href: `/audits/${audit.id}`,
          });
        });
    }

    // الخطط السنوية: المعتمِد المسمّى في الخطة - ومدير النظام، تماماً كما في صفحة الخطط
    rawPlans
      .filter(p =>
        p.status === 'pending_approval' &&
        (p.approverId === currentUser.id || currentUser.role === 'system_admin')
      )
      .forEach(plan => {
        const itemCount = plan.items?.length || 0;
        items.push({
          id: `plan-${plan.id}`,
          kind: 'plan',
          title: language === 'ar'
            ? (plan.titleAr || `الخطة السنوية ${plan.year}`)
            : (plan.titleEn || `Annual Plan ${plan.year}`),
          subtitle: language === 'ar' ? `${itemCount} بند مخطط` : `${itemCount} planned items`,
          href: '/plans', // صفحة الخطط تعرض القائمة، ولا يوجد مسار لخطة مفردة
        });
      });

    // ============================================================
    // ما ينتظر الأدوار الأخرى - كان لا يظهر لأحد.
    //
    // Everything above is gated on canApproveAudits, which DEFAULT_PERMISSIONS grants to
    // system_admin and quality_manager alone. Every other role - the auditor waiting to
    // accept a date or fix a returned checklist, the department manager who has to
    // confirm a date, answer a finding or act on a corrective action - opened the
    // dashboard and was told, in a calm empty state, that nothing was waiting on them.
    // There was no inbox for them anywhere in the product: they had to already know the
    // audit's URL. "The approvals never arrive" is as often no inbox as a failed write.
    // ============================================================
    const openAudits = rawAudits.filter(a => a.status !== 'completed' && a.status !== 'cancelled');
    const titleOf = (a: any) => language === 'ar' ? (a.titleAr || 'مراجعة') : (a.titleEn || 'Audit');
    const push = (a: any, subtitleAr: string, subtitleEn: string, suffix: string) => {
      items.push({
        id: `audit-${a.id}-${suffix}`,
        kind: 'audit',
        title: titleOf(a),
        subtitle: language === 'ar' ? subtitleAr : subtitleEn,
        href: `/audits/${a.id}`,
      });
    };

    openAudits.forEach(a => {
      const onTeam = a.leadAuditorId === currentUser.id ||
        (a.teamMemberIds || []).includes(currentUser.id) ||
        (a.auditorIds || []).includes(currentUser.id);
      const isAuditee = a.auditeeId === currentUser.id;
      if (!onTeam && !isAuditee) return;

      // 1. الموعد ينتظر ردّي
      const myParty = onTeam ? 'auditor' : 'auditee';
      const myResponse = a.schedule?.[myParty];
      if (myResponse?.status === 'pending') {
        push(a, 'بانتظار تأكيدك لموعد المراجعة', 'Awaiting your confirmation of the audit date', 'schedule');
      }

      // 2. قائمة أسئلة أُعيدت للتعديل - على المراجع
      if (onTeam && a.questionsGate?.status === 'rejected') {
        push(a, 'أُعيدت قائمة الأسئلة للتعديل', 'The checklist was returned for revision', 'questions-rejected');
      }

      // 3. أجوبة أُعيدت للتعديل - على المراجع
      if (onTeam && a.answersGate?.status === 'rejected') {
        push(a, 'أُعيدت الأجوبة للتعديل', 'The answers were returned for revision', 'answers-rejected');
      }

      // 4. ملاحظات تنتظر ردّ الإدارة المُراجَعة
      if (isAuditee) {
        const awaiting = (a.findings || []).filter(
          (f: any) => f.status !== 'closed' && !f.departmentResponse
        ).length;
        if (awaiting > 0) {
          push(
            a,
            `${awaiting} ملاحظة تنتظر ردّ إدارتك`,
            `${awaiting} finding(s) awaiting your department's response`,
            'findings'
          );
        }
      }
    });

    return items;
  }, [rawAudits, rawPlans, departments, currentUser, hasPermission, language]);

  // Upcoming audits - المراجعات التي لم يحن موعد بدايتها بعد، الأقرب أولاً
  const upcomingAudits = useMemo<UpcomingAudit[]>(() => {
    const now = Date.now();
    return rawAudits
      .filter(a =>
        a.status !== 'completed' &&
        a.status !== 'cancelled' &&
        a.startDate &&
        new Date(a.startDate).getTime() > now
      )
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
      .slice(0, 5)
      .map(audit => {
        const dept = departments.find((d: any) => d.id === audit.departmentId);
        return {
          id: audit.id,
          title: language === 'ar' ? (audit.titleAr || 'مراجعة') : (audit.titleEn || 'Audit'),
          startDate: audit.startDate,
          departmentName: dept ? (language === 'ar' ? dept.nameAr : dept.nameEn) : '',
          daysRemaining: Math.ceil((new Date(audit.startDate).getTime() - now) / (1000 * 60 * 60 * 24)),
        };
      });
  }, [rawAudits, departments, language]);

  // Checklist status - الأسئلة المُجابة مقابل الإجمالي عبر المراجعات النشطة
  const checklistStatus = useMemo(() => {
    let total = 0;
    let answered = 0;

    rawAudits
      .filter(a => a.status !== 'completed' && a.status !== 'cancelled')
      .forEach(audit => {
        (audit.questions || []).forEach((q: any) => {
          total++;
          if (q.status && q.status !== 'pending') answered++;
        });
      });

    return {
      total,
      answered,
      percentage: total > 0 ? Math.round((answered / total) * 100) : 0,
    };
  }, [rawAudits]);

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { variant: any; label: string }> = {
      planning: { variant: 'secondary', label: language === 'ar' ? 'تخطيط' : 'Planning' },
      execution: { variant: 'info', label: language === 'ar' ? 'تنفيذ' : 'Execution' },
      awaiting_management: { variant: 'warning', label: language === 'ar' ? 'بانتظار الإدارة' : 'Awaiting Management' },
      completed: { variant: 'success', label: language === 'ar' ? 'مكتمل' : 'Completed' },
      cancelled: { variant: 'danger', label: language === 'ar' ? 'ملغي' : 'Cancelled' },
      open: { variant: 'warning', label: language === 'ar' ? 'مفتوحة' : 'Open' },
      in_progress: { variant: 'info', label: language === 'ar' ? 'قيد المعالجة' : 'In Progress' },
      closed: { variant: 'success', label: language === 'ar' ? 'مغلقة' : 'Closed' },
    };
    const config = statusMap[status] || { variant: 'secondary', label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getSeverityBadge = (severity: string) => {
    const severityMap: Record<string, { variant: any; label: string }> = {
      critical: { variant: 'danger', label: language === 'ar' ? 'حرجة' : 'Critical' },
      major: { variant: 'warning', label: language === 'ar' ? 'رئيسية' : 'Major' },
      minor: { variant: 'info', label: language === 'ar' ? 'بسيطة' : 'Minor' },
      observation: { variant: 'secondary', label: language === 'ar' ? 'ملاحظة' : 'Observation' },
    };
    const config = severityMap[severity] || { variant: 'secondary', label: severity };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const Arrow = isRTL ? ArrowLeft : ArrowRight;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return language === 'ar' ? 'صباح الخير' : 'Good Morning';
    if (hour < 18) return language === 'ar' ? 'مساء الخير' : 'Good Afternoon';
    return language === 'ar' ? 'مساء الخير' : 'Good Evening';
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Welcome Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-[var(--primary)] to-[var(--primary-hover)] text-white">
          <div>
            <h1 className="text-2xl font-bold">
              {getGreeting()}، {language === 'ar'
                ? (currentUser?.fullNameAr || currentUser?.fullNameEn || 'مدير النظام')
                : (currentUser?.fullNameEn || currentUser?.fullNameAr || 'System Admin')}
            </h1>
            <p className="text-white/80 mt-1">
              {language === 'ar'
                ? 'إليك ملخص نشاط نظام مراجعة لنظام الجودة QMS'
                : 'Here\'s your QMS audit activity summary'}
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => router.push('/audits/new')}
              className="bg-white/20 hover:bg-white/30 border-white/30 text-white"
            >
              <Plus className="h-4 w-4 me-2" />
              {language === 'ar' ? 'مراجعة جديدة' : 'New Audit'}
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Total Audits */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => router.push('/audits')}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[var(--foreground-secondary)]">
                    {language === 'ar' ? 'إجمالي المراجعات' : 'Total Audits'}
                  </p>
                  <p className="text-3xl font-bold mt-1">{stats.totalAudits}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                      {stats.activeAudits} {language === 'ar' ? 'نشطة' : 'active'}
                    </span>
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-blue-100 dark:bg-blue-900/30">
                  <ClipboardCheck className="h-7 w-7 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Open Findings */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => router.push('/findings')}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[var(--foreground-secondary)]">
                    {language === 'ar' ? 'الملاحظات المفتوحة' : 'Open Findings'}
                  </p>
                  <p className="text-3xl font-bold mt-1">{stats.openFindings}</p>
                  <div className="flex items-center gap-2 mt-2">
                    {stats.overdueFindings > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                        {stats.overdueFindings} {language === 'ar' ? 'متأخرة' : 'overdue'}
                      </span>
                    )}
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-orange-100 dark:bg-orange-900/30">
                  <AlertCircle className="h-7 w-7 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Completion Rate */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => router.push('/performance')}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[var(--foreground-secondary)]">
                    {language === 'ar' ? 'نسبة الإنجاز' : 'Completion Rate'}
                  </p>
                  <p className="text-3xl font-bold mt-1">
                    {stats.totalAudits > 0 ? Math.round((stats.completedAudits / stats.totalAudits) * 100) : 0}%
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                      {stats.completedAudits} {language === 'ar' ? 'مكتملة' : 'completed'}
                    </span>
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-green-100 dark:bg-green-900/30">
                  <TrendingUp className="h-7 w-7 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pending Approvals - بانتظار تصرّف المستخدم الحالي */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[var(--foreground-secondary)]">
                    {language === 'ar' ? 'بانتظار موافقتك' : 'Pending Approvals'}
                  </p>
                  <p className="text-3xl font-bold mt-1">{pendingApprovals.length}</p>
                  <div className="flex items-center gap-2 mt-2">
                    {pendingApprovals.length > 0 ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                        {pendingApprovals.filter(i => i.kind === 'audit').length} {language === 'ar' ? 'مراجعات' : 'audits'}
                        {' · '}
                        {pendingApprovals.filter(i => i.kind === 'plan').length} {language === 'ar' ? 'خطط' : 'plans'}
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                        {language === 'ar' ? 'لا شيء معلّق' : 'nothing pending'}
                      </span>
                    )}
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-purple-100 dark:bg-purple-900/30">
                  <FileCheck className="h-7 w-7 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Annual Plan Progress & Checklist Status */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Annual Audit Progress */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-[var(--primary)]" />
                  {language === 'ar' ? `إنجاز الخطة السنوية ${currentYear}` : `Annual Audit Progress ${currentYear}`}
                </CardTitle>
                <button
                  onClick={() => router.push('/plans')}
                  className="flex items-center gap-1 text-sm text-[var(--primary)] hover:underline"
                >
                  {language === 'ar' ? 'عرض الخطة' : 'View Plan'}
                  <Arrow className="h-4 w-4" />
                </button>
              </div>
            </CardHeader>
            <CardContent>
              {annualProgress.hasPlan ? (
                <div>
                  <div className="flex items-end justify-between mb-2">
                    <p className="text-3xl font-bold">{annualProgress.percentage}%</p>
                    <p className="text-sm text-[var(--foreground-secondary)]">
                      {language === 'ar'
                        ? `${annualProgress.created} من ${annualProgress.planned} بند أُنشئت له مراجعة`
                        : `${annualProgress.created} of ${annualProgress.planned} planned items have an audit`}
                    </p>
                  </div>
                  <div className="w-full bg-[var(--background-secondary)] rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        annualProgress.percentage === 100
                          ? 'bg-green-500'
                          : annualProgress.percentage >= 50
                            ? 'bg-blue-500'
                            : 'bg-orange-500'
                      }`}
                      style={{ width: `${annualProgress.percentage}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="text-center py-6">
                  <Calendar className="h-10 w-10 mx-auto text-[var(--foreground-muted)] mb-2" />
                  <p className="text-sm text-[var(--foreground-secondary)]">
                    {language === 'ar'
                      ? `لا توجد خطة سنوية معتمدة لعام ${currentYear}`
                      : `No approved annual plan for ${currentYear}`}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Checklist Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckSquare className="h-5 w-5 text-[var(--primary)]" />
                {language === 'ar' ? 'حالة قوائم الفحص' : 'Checklist Status'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {checklistStatus.total > 0 ? (
                <div>
                  <div className="flex items-end justify-between mb-2">
                    <p className="text-3xl font-bold">
                      {checklistStatus.answered}
                      <span className="text-xl font-normal text-[var(--foreground-secondary)]"> / {checklistStatus.total}</span>
                    </p>
                    <p className="text-sm text-[var(--foreground-secondary)]">
                      {language === 'ar'
                        ? `${checklistStatus.percentage}% مُجابة في المراجعات النشطة`
                        : `${checklistStatus.percentage}% answered across active audits`}
                    </p>
                  </div>
                  <div className="w-full bg-[var(--background-secondary)] rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        checklistStatus.percentage === 100
                          ? 'bg-green-500'
                          : checklistStatus.percentage >= 50
                            ? 'bg-blue-500'
                            : 'bg-orange-500'
                      }`}
                      style={{ width: `${checklistStatus.percentage}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="text-center py-6">
                  <ListChecks className="h-10 w-10 mx-auto text-[var(--foreground-muted)] mb-2" />
                  <p className="text-sm text-[var(--foreground-secondary)]">
                    {language === 'ar'
                      ? 'لا توجد أسئلة في المراجعات النشطة'
                      : 'No checklist questions in active audits'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Recent Audits */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5 text-[var(--primary)]" />
                  {language === 'ar' ? 'أحدث المراجعات' : 'Recent Audits'}
                </CardTitle>
                <button
                  onClick={() => router.push('/audits')}
                  className="flex items-center gap-1 text-sm text-[var(--primary)] hover:underline"
                >
                  {language === 'ar' ? 'عرض الكل' : 'View All'}
                  <Arrow className="h-4 w-4" />
                </button>
              </div>
            </CardHeader>
            <CardContent>
              {recentAudits.length > 0 ? (
                <div className="space-y-3">
                  {recentAudits.map((audit) => (
                    <div
                      key={audit.id}
                      onClick={() => router.push(`/audits/${audit.id}`)}
                      className="flex items-center justify-between rounded-xl border border-[var(--border)] p-4 transition-all hover:bg-[var(--background-tertiary)] hover:shadow-sm cursor-pointer"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-[var(--foreground)] truncate">
                            {language === 'ar' ? audit.titleAr : audit.titleEn}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-sm text-[var(--foreground-secondary)]">
                          <span className="font-mono">{audit.number}</span>
                          {audit.departmentName && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Building2 className="h-3 w-3" />
                                {audit.departmentName}
                              </span>
                            </>
                          )}
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(audit.startDate).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}
                          </span>
                        </div>
                      </div>
                      {getStatusBadge(audit.status)}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <ClipboardCheck className="h-12 w-12 mx-auto text-[var(--foreground-muted)] mb-3" />
                  <p className="text-[var(--foreground-secondary)]">
                    {language === 'ar' ? 'لا توجد مراجعات بعد' : 'No audits yet'}
                  </p>
                  <Button
                    className="mt-3"
                    onClick={() => router.push('/audits/new')}
                  >
                    <Plus className="h-4 w-4 me-2" />
                    {language === 'ar' ? 'إنشاء مراجعة' : 'Create Audit'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pending Approvals */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileCheck className="h-5 w-5 text-[var(--primary)]" />
                {language === 'ar' ? 'بانتظار موافقتك' : 'Pending Approvals'}
                {pendingApprovals.length > 0 && (
                  <Badge variant="warning">{pendingApprovals.length}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pendingApprovals.length > 0 ? (
                <div className="space-y-3">
                  {pendingApprovals.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => router.push(item.href)}
                      className="p-3 rounded-lg border border-[var(--border)] transition-all cursor-pointer hover:bg-[var(--background-tertiary)] hover:shadow-sm"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${
                          item.kind === 'audit'
                            ? 'bg-blue-100 dark:bg-blue-900/30'
                            : 'bg-purple-100 dark:bg-purple-900/30'
                        }`}>
                          {item.kind === 'audit'
                            ? <ClipboardCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            : <Calendar className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.title}</p>
                          <p className="text-xs mt-0.5 text-[var(--foreground-secondary)] truncate">
                            {item.subtitle}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <CheckCircle className="h-10 w-10 mx-auto text-green-500 mb-2" />
                  <p className="text-sm text-[var(--foreground-secondary)]">
                    {language === 'ar' ? 'لا شيء بانتظار موافقتك' : 'Nothing waiting on you'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Upcoming Audits & Finding Deadlines */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Upcoming Audits */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <CalendarClock className="h-5 w-5 text-[var(--primary)]" />
                  {language === 'ar' ? 'المراجعات القادمة' : 'Upcoming Audits'}
                </CardTitle>
                <button
                  onClick={() => router.push('/audits')}
                  className="flex items-center gap-1 text-sm text-[var(--primary)] hover:underline"
                >
                  {language === 'ar' ? 'عرض الكل' : 'View All'}
                  <Arrow className="h-4 w-4" />
                </button>
              </div>
            </CardHeader>
            <CardContent>
              {upcomingAudits.length > 0 ? (
                <div className="space-y-3">
                  {upcomingAudits.map((audit) => (
                    <div
                      key={audit.id}
                      onClick={() => router.push(`/audits/${audit.id}`)}
                      className="flex items-center justify-between gap-3 p-3 rounded-lg border border-[var(--border)] transition-all hover:bg-[var(--background-tertiary)] hover:shadow-sm cursor-pointer"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{audit.title}</p>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-[var(--foreground-secondary)]">
                          {audit.departmentName && (
                            <span className="flex items-center gap-1 truncate">
                              <Building2 className="h-3 w-3" />
                              {audit.departmentName}
                            </span>
                          )}
                          <span className="flex items-center gap-1 whitespace-nowrap">
                            <Calendar className="h-3 w-3" />
                            {new Date(audit.startDate).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}
                          </span>
                        </div>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 whitespace-nowrap">
                        {language === 'ar'
                          ? `متبقي ${audit.daysRemaining} يوم`
                          : `in ${audit.daysRemaining} ${audit.daysRemaining === 1 ? 'day' : 'days'}`}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <CalendarClock className="h-10 w-10 mx-auto text-[var(--foreground-muted)] mb-2" />
                  <p className="text-sm text-[var(--foreground-secondary)]">
                    {language === 'ar' ? 'لا توجد مراجعات قادمة' : 'No upcoming audits'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Finding Deadlines */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <ListChecks className="h-5 w-5 text-[var(--status-warning)]" />
                  {language === 'ar' ? 'استحقاقات الملاحظات' : 'Finding Deadlines'}
                </CardTitle>
                <button
                  onClick={() => router.push('/followup')}
                  className="flex items-center gap-1 text-sm text-[var(--primary)] hover:underline"
                >
                  {language === 'ar' ? 'المتابعة' : 'Follow-up'}
                  <Arrow className="h-4 w-4" />
                </button>
              </div>
            </CardHeader>
            <CardContent>
              {findingDeadlines.length > 0 ? (
                <div className="space-y-3">
                  {findingDeadlines.map((task) => {
                    const isOverdue = new Date(task.date) < new Date();
                    return (
                      <div
                        key={task.id}
                        className={`p-3 rounded-lg border ${
                          isOverdue
                            ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
                            : 'border-[var(--border)]'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                            <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{task.title}</p>
                            <p className={`text-xs mt-0.5 ${isOverdue ? 'text-red-600 dark:text-red-400' : 'text-[var(--foreground-secondary)]'}`}>
                              {isOverdue && (language === 'ar' ? 'متأخر - ' : 'Overdue - ')}
                              {new Date(task.date).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-6">
                  <CheckCircle className="h-10 w-10 mx-auto text-green-500 mb-2" />
                  <p className="text-sm text-[var(--foreground-secondary)]">
                    {language === 'ar' ? 'لا توجد استحقاقات قادمة' : 'No upcoming deadlines'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Findings */}
        {recentFindings.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-[var(--status-error)]" />
                  {language === 'ar' ? 'أحدث الملاحظات' : 'Recent Findings'}
                </CardTitle>
                <button
                  onClick={() => router.push('/findings')}
                  className="flex items-center gap-1 text-sm text-[var(--primary)] hover:underline"
                >
                  {language === 'ar' ? 'عرض الكل' : 'View All'}
                  <Arrow className="h-4 w-4" />
                </button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {recentFindings.map((finding) => (
                  <div
                    key={finding.id}
                    className="flex flex-col gap-3 rounded-xl border border-[var(--border)] p-4 transition-all hover:bg-[var(--background-tertiary)] hover:shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-[var(--foreground)] line-clamp-2 text-sm">
                        {language === 'ar' ? finding.titleAr : finding.titleEn}
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      {getSeverityBadge(finding.severity)}
                      {getStatusBadge(finding.status)}
                    </div>
                    {finding.dueDate && (
                      <div className="flex items-center gap-1 text-xs text-[var(--foreground-muted)]">
                        <Clock className="h-3 w-3" />
                        {new Date(finding.dueDate).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions for Empty State */}
        {stats.totalAudits === 0 && stats.totalDepartments === 0 && (
          <Card className="border-dashed border-2">
            <CardContent className="p-8 text-center">
              <Target className="h-16 w-16 mx-auto text-[var(--primary)] mb-4" />
              <h3 className="text-xl font-semibold mb-2">
                {language === 'ar' ? 'ابدأ إعداد نظام مراجعة لنظام الجودة QMS' : 'Start Setting Up Your QMS Audit System'}
              </h3>
              <p className="text-[var(--foreground-secondary)] mb-6 max-w-md mx-auto">
                {language === 'ar'
                  ? 'أنشئ الإدارات والمستخدمين ثم ابدأ بإجراء المراجعات'
                  : 'Create departments and users, then start conducting audits'}
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Button onClick={() => router.push('/departments')}>
                  <Building2 className="h-4 w-4 me-2" />
                  {language === 'ar' ? 'إضافة إدارة' : 'Add Department'}
                </Button>
                <Button variant="outline" onClick={() => router.push('/users')}>
                  <Users className="h-4 w-4 me-2" />
                  {language === 'ar' ? 'إضافة مستخدم' : 'Add User'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
