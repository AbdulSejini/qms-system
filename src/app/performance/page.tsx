'use client';

import { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { Button, Badge } from '@/components/ui';
import { useTranslation } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  TrendingUp,
  TrendingDown,
  Users,
  Target,
  Clock,
  CheckCircle,
  AlertTriangle,
  Award,
  BarChart3,
  Calendar,
  ClipboardCheck,
  UserCheck,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from 'lucide-react';

// Types
interface AuditorPerformance {
  id: string;
  name: string;
  nameEn: string;
  role: 'auditor' | 'lead_auditor';
  totalAudits: number;
  completedAudits: number;
  findingsRecorded: number;
  avgAuditDuration: number; // days
  onTimeCompletion: number; // percentage
  qualityScore: number; // 0-100
}

interface AuditeePerformance {
  id: string;
  departmentId: string;
  departmentName: string;
  departmentNameEn: string;
  totalFindings: number;
  closedFindings: number;
  openFindings: number;
  overdueFindings: number;
  avgClosureTime: number; // days
  complianceScore: number; // 0-100
}

export default function PerformancePage() {
  const { t, language, isRTL } = useTranslation();
  const { currentUser, hasPermission } = useAuth();

  const [auditorStats, setAuditorStats] = useState<AuditorPerformance[]>([]);
  const [auditeeStats, setAuditeeStats] = useState<AuditeePerformance[]>([]);
  const [viewMode, setViewMode] = useState<'auditors' | 'auditees'>('auditors');
  const [timeRange, setTimeRange] = useState<'month' | 'quarter' | 'year'>('quarter');

  // Load performance data from audits
  useEffect(() => {
    const loadPerformanceData = () => {
      const storedAudits = localStorage.getItem('qms_audits');
      const storedUsers = localStorage.getItem('qms_users');
      const storedDepartments = localStorage.getItem('qms_departments');

      if (!storedAudits) {
        setAuditorStats([]);
        setAuditeeStats([]);
        return;
      }

      try {
        const audits = JSON.parse(storedAudits);
        // إخفاء حسابات النظام
        const users = storedUsers ? JSON.parse(storedUsers).filter((u: any) => !u.isSystemAccount) : [];
        const departments = storedDepartments ? JSON.parse(storedDepartments) : [];

        // Calculate auditor performance
        const auditorMap = new Map<string, AuditorPerformance>();

        audits.forEach((audit: any) => {
          // Lead Auditor
          if (audit.leadAuditorId) {
            const existing = auditorMap.get(audit.leadAuditorId);
            const user = users.find((u: any) => u.id === audit.leadAuditorId);
            const findingsCount = audit.findings?.length || 0;
            const isCompleted = audit.status === 'completed';

            if (existing) {
              existing.totalAudits++;
              if (isCompleted) existing.completedAudits++;
              existing.findingsRecorded += findingsCount;
            } else {
              auditorMap.set(audit.leadAuditorId, {
                id: audit.leadAuditorId,
                name: user?.fullNameAr || 'مراجع',
                nameEn: user?.fullNameEn || 'Auditor',
                role: 'lead_auditor',
                totalAudits: 1,
                completedAudits: isCompleted ? 1 : 0,
                findingsRecorded: findingsCount,
                avgAuditDuration: 5,
                onTimeCompletion: isCompleted ? 100 : 0,
                qualityScore: 85,
              });
            }
          }

          // Team Auditors
          if (audit.auditorIds && Array.isArray(audit.auditorIds)) {
            audit.auditorIds.forEach((auditorId: string) => {
              if (auditorId === audit.leadAuditorId) return;

              const existing = auditorMap.get(auditorId);
              const user = users.find((u: any) => u.id === auditorId);
              const isCompleted = audit.status === 'completed';

              if (existing) {
                existing.totalAudits++;
                if (isCompleted) existing.completedAudits++;
              } else {
                auditorMap.set(auditorId, {
                  id: auditorId,
                  name: user?.fullNameAr || 'مراجع',
                  nameEn: user?.fullNameEn || 'Auditor',
                  role: 'auditor',
                  totalAudits: 1,
                  completedAudits: isCompleted ? 1 : 0,
                  findingsRecorded: 0,
                  avgAuditDuration: 5,
                  onTimeCompletion: isCompleted ? 100 : 0,
                  qualityScore: 80,
                });
              }
            });
          }
        });

        // Calculate auditee (department) performance
        const departmentMap = new Map<string, AuditeePerformance>();

        audits.forEach((audit: any) => {
          if (!audit.departmentId) return;

          const dept = departments.find((d: any) => d.id === audit.departmentId);
          const findings = audit.findings || [];

          const existing = departmentMap.get(audit.departmentId);

          const closedFindings = findings.filter((f: any) => f.status === 'closed').length;
          const openFindings = findings.filter((f: any) => f.status !== 'closed').length;
          const overdueFindings = findings.filter((f: any) => {
            if (f.status === 'closed') return false;
            const dueDate = new Date(f.estimatedClosingDate || f.dueDate);
            return dueDate < new Date();
          }).length;

          if (existing) {
            existing.totalFindings += findings.length;
            existing.closedFindings += closedFindings;
            existing.openFindings += openFindings;
            existing.overdueFindings += overdueFindings;
          } else {
            departmentMap.set(audit.departmentId, {
              id: audit.departmentId,
              departmentId: audit.departmentId,
              departmentName: dept?.nameAr || 'إدارة',
              departmentNameEn: dept?.nameEn || 'Department',
              totalFindings: findings.length,
              closedFindings,
              openFindings,
              overdueFindings,
              avgClosureTime: 14,
              complianceScore: findings.length > 0 ? Math.round((closedFindings / findings.length) * 100) : 100,
            });
          }
        });

        // Update quality scores for auditors
        auditorMap.forEach((auditor) => {
          if (auditor.totalAudits > 0) {
            auditor.onTimeCompletion = Math.round((auditor.completedAudits / auditor.totalAudits) * 100);
            auditor.qualityScore = Math.min(100, 70 + Math.round(auditor.findingsRecorded / auditor.totalAudits * 5));
          }
        });

        setAuditorStats(Array.from(auditorMap.values()).sort((a, b) => b.qualityScore - a.qualityScore));
        setAuditeeStats(Array.from(departmentMap.values()).sort((a, b) => b.complianceScore - a.complianceScore));

      } catch (e) {
        console.error('Error loading performance data:', e);
      }
    };

    loadPerformanceData();

    window.addEventListener('storage', loadPerformanceData);
    return () => window.removeEventListener('storage', loadPerformanceData);
  }, []);

  // Summary statistics
  const summaryStats = useMemo(() => {
    const totalAuditors = auditorStats.length;
    const totalAudits = auditorStats.reduce((sum, a) => sum + a.totalAudits, 0);
    const completedAudits = auditorStats.reduce((sum, a) => sum + a.completedAudits, 0);
    const totalFindings = auditeeStats.reduce((sum, a) => sum + a.totalFindings, 0);
    const closedFindings = auditeeStats.reduce((sum, a) => sum + a.closedFindings, 0);
    const overdueFindings = auditeeStats.reduce((sum, a) => sum + a.overdueFindings, 0);
    const avgComplianceScore = auditeeStats.length > 0
      ? Math.round(auditeeStats.reduce((sum, a) => sum + a.complianceScore, 0) / auditeeStats.length)
      : 0;

    return {
      totalAuditors,
      totalAudits,
      completedAudits,
      completionRate: totalAudits > 0 ? Math.round((completedAudits / totalAudits) * 100) : 0,
      totalFindings,
      closedFindings,
      closureRate: totalFindings > 0 ? Math.round((closedFindings / totalFindings) * 100) : 0,
      overdueFindings,
      avgComplianceScore,
    };
  }, [auditorStats, auditeeStats]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-green-100 dark:bg-green-900/30';
    if (score >= 60) return 'bg-yellow-100 dark:bg-yellow-900/30';
    return 'bg-red-100 dark:bg-red-900/30';
  };

  const getTrendIcon = (value: number) => {
    if (value > 0) return <ArrowUpRight className="h-4 w-4 text-green-500" />;
    if (value < 0) return <ArrowDownRight className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-gray-400" />;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--foreground)]">
              {language === 'ar' ? 'أداء المراجعين والإدارات' : 'Auditors & Departments Performance'}
            </h1>
            <p className="text-sm text-[var(--foreground-secondary)] mt-1">
              {language === 'ar'
                ? 'تتبع أداء المراجعين ومدى التزام الإدارات'
                : 'Track auditor performance and department compliance'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Time Range Filter */}
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as any)}
              className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            >
              <option value="month">{language === 'ar' ? 'هذا الشهر' : 'This Month'}</option>
              <option value="quarter">{language === 'ar' ? 'هذا الربع' : 'This Quarter'}</option>
              <option value="year">{language === 'ar' ? 'هذه السنة' : 'This Year'}</option>
            </select>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                    {language === 'ar' ? 'إجمالي المراجعات' : 'Total Audits'}
                  </p>
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{summaryStats.totalAudits}</p>
                  <p className="text-xs text-blue-600/70 dark:text-blue-400/70 mt-1">
                    {summaryStats.completedAudits} {language === 'ar' ? 'مكتملة' : 'completed'}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-blue-200/50 dark:bg-blue-700/30">
                  <ClipboardCheck className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                    {language === 'ar' ? 'نسبة الإنجاز' : 'Completion Rate'}
                  </p>
                  <p className="text-2xl font-bold text-green-700 dark:text-green-300">{summaryStats.completionRate}%</p>
                  <div className="flex items-center gap-1 mt-1">
                    {getTrendIcon(5)}
                    <span className="text-xs text-green-600/70">+5%</span>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-green-200/50 dark:bg-green-700/30">
                  <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 border-orange-200 dark:border-orange-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-orange-600 dark:text-orange-400 font-medium">
                    {language === 'ar' ? 'الملاحظات المفتوحة' : 'Open Findings'}
                  </p>
                  <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">
                    {summaryStats.totalFindings - summaryStats.closedFindings}
                  </p>
                  <p className="text-xs text-orange-600/70 dark:text-orange-400/70 mt-1">
                    {summaryStats.overdueFindings} {language === 'ar' ? 'متأخرة' : 'overdue'}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-orange-200/50 dark:bg-orange-700/30">
                  <AlertTriangle className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border-purple-200 dark:border-purple-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                    {language === 'ar' ? 'متوسط الامتثال' : 'Avg Compliance'}
                  </p>
                  <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">{summaryStats.avgComplianceScore}%</p>
                  <div className="flex items-center gap-1 mt-1">
                    {getTrendIcon(3)}
                    <span className="text-xs text-purple-600/70">+3%</span>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-purple-200/50 dark:bg-purple-700/30">
                  <Award className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* View Toggle */}
        <div className="flex flex-wrap gap-2 p-1 bg-[var(--background-secondary)] rounded-lg w-fit">
          <button
            onClick={() => setViewMode('auditors')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              viewMode === 'auditors'
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 shadow-sm'
                : 'text-[var(--foreground-secondary)] hover:text-[var(--foreground)]'
            }`}
          >
            <ClipboardCheck className="h-4 w-4" />
            {language === 'ar' ? 'أداء المراجعين' : 'Auditor Performance'}
            <span className="px-1.5 py-0.5 text-xs rounded-full bg-blue-200 dark:bg-blue-800">
              {auditorStats.length}
            </span>
          </button>
          <button
            onClick={() => setViewMode('auditees')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              viewMode === 'auditees'
                ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 shadow-sm'
                : 'text-[var(--foreground-secondary)] hover:text-[var(--foreground)]'
            }`}
          >
            <UserCheck className="h-4 w-4" />
            {language === 'ar' ? 'أداء الإدارات' : 'Department Performance'}
            <span className="px-1.5 py-0.5 text-xs rounded-full bg-orange-200 dark:bg-orange-800">
              {auditeeStats.length}
            </span>
          </button>
        </div>

        {/* Performance Cards */}
        {viewMode === 'auditors' ? (
          <div className="space-y-4">
            {auditorStats.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {auditorStats.map((auditor, index) => (
                  <Card key={auditor.id} className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-12 w-12 items-center justify-center rounded-xl text-lg font-bold ${
                            index === 0 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                            index === 1 ? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400' :
                            index === 2 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                            'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          }`}>
                            {index < 3 ? <Award className="h-6 w-6" /> : (language === 'ar' ? auditor.name : auditor.nameEn).charAt(0)}
                          </div>
                          <div>
                            <h3 className="font-semibold">{language === 'ar' ? auditor.name : auditor.nameEn}</h3>
                            <p className="text-xs text-[var(--foreground-secondary)]">
                              {auditor.role === 'lead_auditor'
                                ? (language === 'ar' ? 'مراجع رئيسي' : 'Lead Auditor')
                                : (language === 'ar' ? 'مراجع' : 'Auditor')}
                            </p>
                          </div>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-sm font-bold ${getScoreBg(auditor.qualityScore)} ${getScoreColor(auditor.qualityScore)}`}>
                          {auditor.qualityScore}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-lg bg-[var(--background-secondary)]">
                          <p className="text-xs text-[var(--foreground-secondary)]">
                            {language === 'ar' ? 'المراجعات' : 'Audits'}
                          </p>
                          <p className="text-lg font-bold">{auditor.totalAudits}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-[var(--background-secondary)]">
                          <p className="text-xs text-[var(--foreground-secondary)]">
                            {language === 'ar' ? 'الملاحظات' : 'Findings'}
                          </p>
                          <p className="text-lg font-bold">{auditor.findingsRecorded}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-[var(--background-secondary)]">
                          <p className="text-xs text-[var(--foreground-secondary)]">
                            {language === 'ar' ? 'نسبة الإنجاز' : 'Completion'}
                          </p>
                          <p className={`text-lg font-bold ${getScoreColor(auditor.onTimeCompletion)}`}>
                            {auditor.onTimeCompletion}%
                          </p>
                        </div>
                        <div className="p-3 rounded-lg bg-[var(--background-secondary)]">
                          <p className="text-xs text-[var(--foreground-secondary)]">
                            {language === 'ar' ? 'المدة المتوسطة' : 'Avg Duration'}
                          </p>
                          <p className="text-lg font-bold">{auditor.avgAuditDuration} {language === 'ar' ? 'أيام' : 'days'}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <ClipboardCheck className="h-12 w-12 mx-auto text-[var(--foreground-muted)] mb-4" />
                  <h3 className="text-lg font-semibold mb-2">
                    {language === 'ar' ? 'لا توجد بيانات' : 'No Data Available'}
                  </h3>
                  <p className="text-sm text-[var(--foreground-secondary)]">
                    {language === 'ar'
                      ? 'ستظهر بيانات أداء المراجعين عند إجراء مراجعات'
                      : 'Auditor performance data will appear when audits are conducted'}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {auditeeStats.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {auditeeStats.map((dept, index) => (
                  <Card key={dept.id} className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                            dept.complianceScore >= 80 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                            dept.complianceScore >= 60 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                            'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          }`}>
                            <Target className="h-6 w-6" />
                          </div>
                          <div>
                            <h3 className="font-semibold">{language === 'ar' ? dept.departmentName : dept.departmentNameEn}</h3>
                            <p className="text-xs text-[var(--foreground-secondary)]">
                              {dept.totalFindings} {language === 'ar' ? 'ملاحظة' : 'findings'}
                            </p>
                          </div>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-sm font-bold ${getScoreBg(dept.complianceScore)} ${getScoreColor(dept.complianceScore)}`}>
                          {dept.complianceScore}%
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="mb-4">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-[var(--foreground-secondary)]">
                            {language === 'ar' ? 'نسبة الإغلاق' : 'Closure Rate'}
                          </span>
                          <span className="font-medium">{dept.totalFindings > 0 ? Math.round((dept.closedFindings / dept.totalFindings) * 100) : 100}%</span>
                        </div>
                        <div className="w-full bg-[var(--background-secondary)] rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              dept.complianceScore >= 80 ? 'bg-green-500' :
                              dept.complianceScore >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${dept.totalFindings > 0 ? (dept.closedFindings / dept.totalFindings) * 100 : 100}%` }}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="p-2 rounded-lg bg-green-50 dark:bg-green-900/20 text-center">
                          <p className="text-xs text-green-600 dark:text-green-400">
                            {language === 'ar' ? 'مغلقة' : 'Closed'}
                          </p>
                          <p className="text-lg font-bold text-green-700 dark:text-green-300">{dept.closedFindings}</p>
                        </div>
                        <div className="p-2 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 text-center">
                          <p className="text-xs text-yellow-600 dark:text-yellow-400">
                            {language === 'ar' ? 'مفتوحة' : 'Open'}
                          </p>
                          <p className="text-lg font-bold text-yellow-700 dark:text-yellow-300">{dept.openFindings}</p>
                        </div>
                        <div className="p-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-center">
                          <p className="text-xs text-red-600 dark:text-red-400">
                            {language === 'ar' ? 'متأخرة' : 'Overdue'}
                          </p>
                          <p className="text-lg font-bold text-red-700 dark:text-red-300">{dept.overdueFindings}</p>
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t border-[var(--border)]">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-[var(--foreground-secondary)]">
                            {language === 'ar' ? 'متوسط وقت الإغلاق' : 'Avg Closure Time'}
                          </span>
                          <span className="font-medium">{dept.avgClosureTime} {language === 'ar' ? 'يوم' : 'days'}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <Target className="h-12 w-12 mx-auto text-[var(--foreground-muted)] mb-4" />
                  <h3 className="text-lg font-semibold mb-2">
                    {language === 'ar' ? 'لا توجد بيانات' : 'No Data Available'}
                  </h3>
                  <p className="text-sm text-[var(--foreground-secondary)]">
                    {language === 'ar'
                      ? 'ستظهر بيانات أداء الإدارات عند تسجيل ملاحظات'
                      : 'Department performance data will appear when findings are recorded'}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
