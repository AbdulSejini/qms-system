'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { Badge, Button } from '@/components/ui';
import { useTranslation } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  ClipboardCheck,
  AlertCircle,
  CheckCircle,
  Clock,
  Calendar,
  TrendingUp,
  ArrowRight,
  ArrowLeft,
  Users,
  Building2,
  Target,
  AlertTriangle,
  BarChart3,
  Plus,
  Eye,
  ListChecks,
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
  totalUsers: number;
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

export default function DashboardPage() {
  const router = useRouter();
  const { t, language, isRTL } = useTranslation();
  const { currentUser, hasPermission } = useAuth();

  const [stats, setStats] = useState<DashboardStats>({
    totalAudits: 0,
    activeAudits: 0,
    completedAudits: 0,
    totalFindings: 0,
    openFindings: 0,
    overdueFindings: 0,
    closedFindings: 0,
    totalUsers: 0,
    totalDepartments: 0,
  });
  const [recentAudits, setRecentAudits] = useState<RecentAudit[]>([]);
  const [recentFindings, setRecentFindings] = useState<RecentFinding[]>([]);
  const [upcomingTasks, setUpcomingTasks] = useState<any[]>([]);

  // Load dashboard data
  useEffect(() => {
    const loadDashboardData = () => {
      // Load audits
      const storedAudits = localStorage.getItem('qms_audits');
      const storedUsers = localStorage.getItem('qms_users');
      const storedDepartments = localStorage.getItem('qms_departments');

      let audits: any[] = [];
      let users: any[] = [];
      let departments: any[] = [];
      let allFindings: any[] = [];

      if (storedAudits) {
        audits = JSON.parse(storedAudits);
      }
      if (storedUsers) {
        users = JSON.parse(storedUsers);
      }
      if (storedDepartments) {
        departments = JSON.parse(storedDepartments);
      }

      // Extract all findings from audits
      audits.forEach((audit: any) => {
        if (audit.findings && Array.isArray(audit.findings)) {
          audit.findings.forEach((finding: any) => {
            allFindings.push({
              ...finding,
              auditNumber: audit.number,
              auditId: audit.id,
            });
          });
        }
      });

      // Calculate stats
      const activeAudits = audits.filter(a =>
        a.status !== 'completed' && a.status !== 'cancelled'
      ).length;
      const completedAudits = audits.filter(a => a.status === 'completed').length;
      const openFindings = allFindings.filter(f => f.status !== 'closed').length;
      const closedFindings = allFindings.filter(f => f.status === 'closed').length;
      const overdueFindings = allFindings.filter(f => {
        if (f.status === 'closed') return false;
        const dueDate = new Date(f.estimatedClosingDate || f.dueDate);
        return dueDate < new Date();
      }).length;

      setStats({
        totalAudits: audits.length,
        activeAudits,
        completedAudits,
        totalFindings: allFindings.length,
        openFindings,
        overdueFindings,
        closedFindings,
        totalUsers: users.length + 1, // +1 for default admin
        totalDepartments: departments.length,
      });

      // Recent audits (last 5)
      const sortedAudits = [...audits]
        .sort((a, b) => new Date(b.createdAt || b.startDate).getTime() - new Date(a.createdAt || a.startDate).getTime())
        .slice(0, 5)
        .map(audit => {
          const dept = departments.find((d: any) => d.id === audit.departmentId);
          return {
            id: audit.id,
            number: audit.number,
            titleAr: audit.titleAr || audit.title || 'مراجعة',
            titleEn: audit.titleEn || audit.title || 'Audit',
            status: audit.status,
            startDate: audit.startDate,
            departmentName: dept ? (language === 'ar' ? dept.nameAr : dept.nameEn) : '',
          };
        });
      setRecentAudits(sortedAudits);

      // Recent findings (last 4)
      const sortedFindings = [...allFindings]
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
      setRecentFindings(sortedFindings);

      // Upcoming tasks
      const tasks: any[] = [];

      // Add upcoming audits
      audits.filter(a => a.status !== 'completed' && a.status !== 'cancelled').forEach(audit => {
        if (audit.startDate) {
          tasks.push({
            id: `audit-${audit.id}`,
            type: 'audit',
            title: language === 'ar' ? (audit.titleAr || 'مراجعة') : (audit.titleEn || 'Audit'),
            date: audit.startDate,
            priority: audit.type === 'external' ? 'high' : 'medium',
          });
        }
      });

      // Add finding due dates
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
      setUpcomingTasks(tasks.slice(0, 5));
    };

    loadDashboardData();

    window.addEventListener('storage', loadDashboardData);
    return () => window.removeEventListener('storage', loadDashboardData);
  }, [language]);

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
              {getGreeting()}، {currentUser?.fullNameAr || currentUser?.fullNameEn || (language === 'ar' ? 'مدير النظام' : 'System Admin')}
            </h1>
            <p className="text-white/80 mt-1">
              {language === 'ar'
                ? 'إليك ملخص نشاط نظام إدارة الجودة'
                : 'Here\'s your QMS activity summary'}
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

          {/* Users & Departments */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[var(--foreground-secondary)]">
                    {language === 'ar' ? 'الفريق' : 'Team'}
                  </p>
                  <p className="text-3xl font-bold mt-1">{stats.totalUsers}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                      {stats.totalDepartments} {language === 'ar' ? 'إدارات' : 'depts'}
                    </span>
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-purple-100 dark:bg-purple-900/30">
                  <Users className="h-7 w-7 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
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

          {/* Upcoming Tasks */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <ListChecks className="h-5 w-5 text-[var(--status-warning)]" />
                  {language === 'ar' ? 'المهام القادمة' : 'Upcoming Tasks'}
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
              {upcomingTasks.length > 0 ? (
                <div className="space-y-3">
                  {upcomingTasks.map((task) => {
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
                          <div className={`p-2 rounded-lg ${
                            task.type === 'audit'
                              ? 'bg-blue-100 dark:bg-blue-900/30'
                              : 'bg-orange-100 dark:bg-orange-900/30'
                          }`}>
                            {task.type === 'audit'
                              ? <ClipboardCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                              : <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                            }
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
                    {language === 'ar' ? 'لا توجد مهام قادمة' : 'No upcoming tasks'}
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
                {language === 'ar' ? 'ابدأ إعداد نظام إدارة الجودة' : 'Start Setting Up Your QMS'}
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
