'use client';

import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { StatCard } from '@/components/shared';
import { Badge } from '@/components/ui';
import { useTranslation } from '@/contexts/LanguageContext';
import {
  FileText,
  ClipboardCheck,
  AlertCircle,
  CheckCircle,
  Clock,
  Calendar,
  TrendingUp,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';

// Demo data
const recentDocuments = [
  {
    id: '1',
    number: 'DOC-2026-0001',
    titleAr: 'سياسة الجودة العامة',
    titleEn: 'General Quality Policy',
    status: 'approved' as const,
    category: 'policy' as const,
    updatedAt: '2026-01-28',
  },
  {
    id: '2',
    number: 'DOC-2026-0002',
    titleAr: 'إجراء مراقبة الجودة',
    titleEn: 'Quality Control Procedure',
    status: 'pending_review' as const,
    category: 'procedure' as const,
    updatedAt: '2026-01-27',
  },
  {
    id: '3',
    number: 'DOC-2026-0003',
    titleAr: 'تعليمات الفحص الداخلي',
    titleEn: 'Internal Inspection Instructions',
    status: 'draft' as const,
    category: 'work_instruction' as const,
    updatedAt: '2026-01-26',
  },
];

const upcomingAudits = [
  {
    id: '1',
    number: 'AUD-2026-0001',
    titleAr: 'تدقيق قسم الإنتاج',
    titleEn: 'Production Department Audit',
    startDate: '2026-02-01',
    status: 'planned' as const,
  },
  {
    id: '2',
    number: 'AUD-2026-0002',
    titleAr: 'تدقيق الموارد البشرية',
    titleEn: 'Human Resources Audit',
    startDate: '2026-02-15',
    status: 'planned' as const,
  },
];

const recentFindings = [
  {
    id: '1',
    number: 'AUD-2026-0001-F01',
    titleAr: 'عدم تحديث إجراء الصيانة',
    titleEn: 'Maintenance Procedure Not Updated',
    severity: 'minor' as const,
    status: 'open' as const,
    dueDate: '2026-02-10',
  },
  {
    id: '2',
    number: 'AUD-2026-0001-F02',
    titleAr: 'نقص في تدريب الموظفين',
    titleEn: 'Lack of Employee Training',
    severity: 'major' as const,
    status: 'in_progress' as const,
    dueDate: '2026-02-05',
  },
];

export default function DashboardPage() {
  const router = useRouter();
  const { t, language, isRTL } = useTranslation();

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { variant: 'approved' | 'pending' | 'draft' | 'rejected'; label: string }> = {
      approved: { variant: 'approved', label: language === 'ar' ? 'معتمد' : 'Approved' },
      pending_review: { variant: 'pending', label: language === 'ar' ? 'قيد المراجعة' : 'Pending' },
      draft: { variant: 'draft', label: language === 'ar' ? 'مسودة' : 'Draft' },
      rejected: { variant: 'rejected', label: language === 'ar' ? 'مرفوض' : 'Rejected' },
      planned: { variant: 'pending', label: language === 'ar' ? 'مخطط' : 'Planned' },
      open: { variant: 'pending', label: language === 'ar' ? 'مفتوحة' : 'Open' },
      in_progress: { variant: 'pending', label: language === 'ar' ? 'قيد المعالجة' : 'In Progress' },
    };
    const config = statusMap[status] || { variant: 'draft' as const, label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getSeverityBadge = (severity: string) => {
    const severityMap: Record<string, { variant: 'critical' | 'major' | 'minor' | 'observation'; label: string }> = {
      critical: { variant: 'critical', label: language === 'ar' ? 'حرجة' : 'Critical' },
      major: { variant: 'major', label: language === 'ar' ? 'رئيسية' : 'Major' },
      minor: { variant: 'minor', label: language === 'ar' ? 'بسيطة' : 'Minor' },
      observation: { variant: 'observation', label: language === 'ar' ? 'ملاحظة' : 'Observation' },
    };
    const config = severityMap[severity] || { variant: 'observation' as const, label: severity };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const Arrow = isRTL ? ArrowLeft : ArrowRight;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">
            {t('dashboard.title')}
          </h1>
          <p className="mt-1 text-[var(--foreground-secondary)]">
            {t('dashboard.welcome')}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title={t('dashboard.totalDocuments')}
            value="128"
            icon={FileText}
            color="primary"
            trend={{ value: 12, isPositive: true }}
          />
          <StatCard
            title={t('dashboard.pendingReview')}
            value="8"
            icon={Clock}
            color="warning"
          />
          <StatCard
            title={t('dashboard.activeAudits')}
            value="3"
            icon={ClipboardCheck}
            color="info"
          />
          <StatCard
            title={t('dashboard.openFindings')}
            value="5"
            icon={AlertCircle}
            color="danger"
          />
        </div>

        {/* Content Grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Recent Documents */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-[var(--primary)]" />
                  {t('dashboard.recentDocuments')}
                </CardTitle>
                <button
                  onClick={() => router.push('/documents')}
                  className="flex items-center gap-1 text-sm text-[var(--primary)] hover:underline"
                >
                  {language === 'ar' ? 'عرض الكل' : 'View All'}
                  <Arrow className="h-4 w-4" />
                </button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between rounded-lg border border-[var(--border)] p-3 transition-colors hover:bg-[var(--background-tertiary)]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-[var(--foreground)] truncate">
                        {language === 'ar' ? doc.titleAr : doc.titleEn}
                      </p>
                      <p className="text-sm text-[var(--foreground-secondary)]">
                        {doc.number}
                      </p>
                    </div>
                    {getStatusBadge(doc.status)}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Upcoming Audits */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-[var(--status-info)]" />
                  {t('dashboard.upcomingAudits')}
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
              <div className="space-y-3">
                {upcomingAudits.map((audit) => (
                  <div
                    key={audit.id}
                    className="flex items-center justify-between rounded-lg border border-[var(--border)] p-3 transition-colors hover:bg-[var(--background-tertiary)]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-[var(--foreground)] truncate">
                        {language === 'ar' ? audit.titleAr : audit.titleEn}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-[var(--foreground-secondary)]">
                        <Calendar className="h-3.5 w-3.5" />
                        {new Date(audit.startDate).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}
                      </div>
                    </div>
                    {getStatusBadge(audit.status)}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Findings */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-[var(--status-error)]" />
                  {t('dashboard.recentFindings')}
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
              <div className="grid gap-3 sm:grid-cols-2">
                {recentFindings.map((finding) => (
                  <div
                    key={finding.id}
                    className="flex flex-col gap-2 rounded-lg border border-[var(--border)] p-4 transition-colors hover:bg-[var(--background-tertiary)]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-[var(--foreground)]">
                        {language === 'ar' ? finding.titleAr : finding.titleEn}
                      </p>
                      {getSeverityBadge(finding.severity)}
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[var(--foreground-secondary)]">{finding.number}</span>
                      <div className="flex items-center gap-1 text-[var(--foreground-muted)]">
                        <Clock className="h-3.5 w-3.5" />
                        {new Date(finding.dueDate).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}
                      </div>
                    </div>
                    <div className="pt-1">
                      {getStatusBadge(finding.status)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
