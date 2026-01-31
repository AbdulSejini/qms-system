'use client';

import { DashboardLayout } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { Button } from '@/components/ui';
import { useTranslation } from '@/contexts/LanguageContext';
import {
  FileBarChart,
  Download,
  Calendar,
  FileText,
  ClipboardCheck,
  AlertCircle,
  TrendingUp,
  PieChart,
} from 'lucide-react';

const reports = [
  {
    id: '1',
    titleAr: 'تقرير حالة المستندات',
    titleEn: 'Document Status Report',
    descriptionAr: 'ملخص شامل لحالة جميع المستندات في النظام',
    descriptionEn: 'Comprehensive summary of all document statuses',
    icon: FileText,
    color: 'primary',
  },
  {
    id: '2',
    titleAr: 'تقرير التدقيقات',
    titleEn: 'Audit Report',
    descriptionAr: 'تقرير عن جميع عمليات التدقيق المنجزة والمخططة',
    descriptionEn: 'Report on all completed and planned audits',
    icon: ClipboardCheck,
    color: 'info',
  },
  {
    id: '3',
    titleAr: 'تقرير الملاحظات',
    titleEn: 'Findings Report',
    descriptionAr: 'تحليل الملاحظات حسب الخطورة والحالة',
    descriptionEn: 'Analysis of findings by severity and status',
    icon: AlertCircle,
    color: 'warning',
  },
  {
    id: '4',
    titleAr: 'تقرير الأداء الشهري',
    titleEn: 'Monthly Performance Report',
    descriptionAr: 'مؤشرات الأداء الرئيسية لنظام الجودة',
    descriptionEn: 'Key performance indicators for quality system',
    icon: TrendingUp,
    color: 'success',
  },
  {
    id: '5',
    titleAr: 'تقرير التوزيع حسب القسم',
    titleEn: 'Department Distribution Report',
    descriptionAr: 'توزيع المستندات والتدقيقات حسب الأقسام',
    descriptionEn: 'Distribution of documents and audits by department',
    icon: PieChart,
    color: 'secondary',
  },
];

const colorClasses: Record<string, { bg: string; icon: string }> = {
  primary: { bg: 'bg-[var(--primary-light)]', icon: 'text-[var(--primary)]' },
  info: { bg: 'bg-[var(--status-info-bg)]', icon: 'text-[var(--status-info)]' },
  warning: { bg: 'bg-[var(--status-warning-bg)]', icon: 'text-[var(--status-warning)]' },
  success: { bg: 'bg-[var(--status-success-bg)]', icon: 'text-[var(--status-success)]' },
  secondary: { bg: 'bg-[var(--background-tertiary)]', icon: 'text-[var(--secondary)]' },
};

export default function ReportsPage() {
  const { t, language } = useTranslation();

  const handleDownload = (reportId: string) => {
    alert(language === 'ar' ? 'سيتم تحميل التقرير قريباً' : 'Report download coming soon');
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">
            {t('navigation.reports')}
          </h1>
          <p className="mt-1 text-[var(--foreground-secondary)]">
            {language === 'ar' ? 'إنشاء وتحميل تقارير نظام إدارة الجودة' : 'Generate and download QMS reports'}
          </p>
        </div>

        {/* Reports Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {reports.map((report) => {
            const Icon = report.icon;
            const colors = colorClasses[report.color];

            return (
              <Card key={report.id} hover className="flex flex-col">
                <CardHeader>
                  <div className="flex items-start gap-4">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${colors.bg}`}>
                      <Icon className={`h-6 w-6 ${colors.icon}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base">
                        {language === 'ar' ? report.titleAr : report.titleEn}
                      </CardTitle>
                      <p className="mt-1 text-sm text-[var(--foreground-secondary)]">
                        {language === 'ar' ? report.descriptionAr : report.descriptionEn}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="mt-auto pt-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    leftIcon={<Download className="h-4 w-4" />}
                    onClick={() => handleDownload(report.id)}
                  >
                    {language === 'ar' ? 'تحميل التقرير' : 'Download Report'}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Custom Report Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-[var(--primary)]" />
              {language === 'ar' ? 'تقرير مخصص' : 'Custom Report'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[var(--foreground-secondary)] mb-4">
              {language === 'ar'
                ? 'اختر الفترة الزمنية والمعايير لإنشاء تقرير مخصص'
                : 'Select time period and criteria to generate a custom report'}
            </p>
            <div className="flex flex-col gap-4 sm:flex-row">
              <input
                type="date"
                className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-opacity-20"
              />
              <input
                type="date"
                className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-opacity-20"
              />
              <Button leftIcon={<FileBarChart className="h-4 w-4" />}>
                {language === 'ar' ? 'إنشاء التقرير' : 'Generate Report'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
