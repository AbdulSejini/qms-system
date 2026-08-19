'use client';

// التقارير - تُبنى من البيانات، لا من قائمة ثابتة
//
// This page used to be a mock: six hard-coded cards and a Download button whose handler was
// `alert('Report download coming soon')`. It read nothing and produced nothing. Every number
// below is now computed from the audits actually in Firestore, and every export writes a real
// file the reader can open in Excel.
//
// WHY CSV AND NOT PDF. There is no server in this project - no Cloud Functions on the Spark
// plan, no render service - so anything produced here is produced in the browser. A CSV built
// from a Blob needs nothing but the browser, opens in Excel, and can be checked against the
// screen. A PDF would need a library, a font that draws Arabic correctly, and a bidi shaper,
// which is a real piece of work and not a side effect of fixing a fake page.
//
// THE UTF-8 BOM IS NOT OPTIONAL. Excel on Windows reads a BOM-less UTF-8 file as the local
// code page, which turns every Arabic column into mojibake. The '﻿' prefix below is what
// makes these files open correctly for the people who will actually open them.
import React, { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { Button, Badge, Skeleton } from '@/components/ui';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui';
import { useTranslation } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { subscribeToAudits, getAuditNumber, type Audit } from '@/lib/firestore';
import {
  FINDING_CATEGORY_A,
  FINDING_CATEGORY_B,
  isNonConformity,
  stageIdFromIndex,
  AUDIT_STAGE_ORDER,
  type AuditFinding,
} from '@/types';
import { Download, FileBarChart, AlertCircle, ClipboardCheck, TrendingUp, Building2, Printer } from 'lucide-react';
import {
  ReportLetterheadHeader,
  ReportLetterheadFooter,
  letterheadCsvRows,
} from '@/components/shared/ReportLetterhead';

// ===========================================
// CSV
// ===========================================

// A field is quoted whenever it could otherwise break the row. Doubling embedded quotes is
// the CSV escape - a lone " inside an unescaped field silently swallows the rest of the file.
const csvCell = (value: unknown): string => {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const downloadCsv = (filename: string, rows: (string | number)[][]): void => {
  const body = rows.map(row => row.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// ===========================================
// Shapes the page works in
// ===========================================

interface FindingRow {
  finding: AuditFinding;
  auditId: string;
  auditNumber: string;
  auditTitleAr: string;
  auditTitleEn: string;
  departmentId: string;
  isOverdue: boolean;
}

const STAGE_LABELS: Record<string, { ar: string; en: string }> = {
  planning: { ar: 'التخطيط', en: 'Planning' },
  execution: { ar: 'التنفيذ', en: 'Execution' },
  qms_review: { ar: 'مراجعة إدارة الجودة', en: 'QMS Review' },
  corrective_actions: { ar: 'الإجراءات التصحيحية', en: 'Corrective Actions' },
  verification: { ar: 'التحقق والإغلاق', en: 'Verification' },
  completed: { ar: 'مكتمل', en: 'Completed' },
};

export default function ReportsPage() {
  const { language } = useTranslation();
  const { departments, currentUser } = useAuth();
  const isRTL = language === 'ar';

  const [audits, setAudits] = useState<Audit[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToAudits(next => {
      setAudits(next);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const departmentName = useMemo(() => {
    const byId = new Map(departments.map(d => [d.id, isRTL ? d.nameAr : d.nameEn]));
    return (id: string) => byId.get(id) ?? id ?? '-';
  }, [departments, isRTL]);

  // Findings live inside the audit document, so every report here starts by flattening
  // them out with enough of their parent audit attached to stand on their own in a row.
  const findingRows = useMemo<FindingRow[]>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return audits.flatMap(audit =>
      (audit.findings ?? []).map(finding => {
        const due = finding.estimatedClosingDate ? new Date(finding.estimatedClosingDate) : null;
        return {
          finding,
          auditId: audit.id,
          auditNumber: getAuditNumber(audit),
          auditTitleAr: audit.titleAr,
          auditTitleEn: audit.titleEn,
          departmentId: finding.departmentId || audit.departmentId,
          isOverdue: !!due && due < today && finding.status !== 'closed',
        };
      })
    );
  }, [audits]);

  const summary = useMemo(() => {
    const open = findingRows.filter(r => r.finding.status !== 'closed');
    return {
      audits: audits.length,
      completed: audits.filter(a => stageIdFromIndex(a.currentStage) === 'completed').length,
      findings: findingRows.length,
      ncrs: findingRows.filter(r => isNonConformity(r.finding.categoryB)).length,
      open: open.length,
      overdue: findingRows.filter(r => r.isOverdue).length,
    };
  }, [audits, findingRows]);

  const byCategoryB = useMemo(
    () =>
      FINDING_CATEGORY_B.map(category => ({
        ...category,
        count: findingRows.filter(r => r.finding.categoryB === category.value).length,
      })),
    [findingRows]
  );

  const byCategoryA = useMemo(
    () =>
      FINDING_CATEGORY_A.map(category => ({
        ...category,
        count: findingRows.filter(r => r.finding.categoryA === category.value).length,
      })),
    [findingRows]
  );

  const byStage = useMemo(
    () =>
      AUDIT_STAGE_ORDER.map(stage => ({
        id: stage,
        label: isRTL ? STAGE_LABELS[stage].ar : STAGE_LABELS[stage].en,
        count: audits.filter(a => stageIdFromIndex(a.currentStage) === stage).length,
      })),
    [audits, isRTL]
  );

  const byDepartment = useMemo(() => {
    const map = new Map<string, { total: number; open: number; overdue: number }>();
    findingRows.forEach(row => {
      const key = row.departmentId || '-';
      const entry = map.get(key) ?? { total: 0, open: 0, overdue: 0 };
      entry.total += 1;
      if (row.finding.status !== 'closed') entry.open += 1;
      if (row.isOverdue) entry.overdue += 1;
      map.set(key, entry);
    });
    return Array.from(map.entries())
      .map(([departmentId, counts]) => ({ departmentId, ...counts }))
      .sort((a, b) => b.total - a.total);
  }, [findingRows]);

  // ===========================================
  // Exports
  // ===========================================

  const stamp = () => new Date().toISOString().slice(0, 10);

  // كل ملف مُصدَّر يحمل ترويسته: من أصدره ومتى وتحت أي كيان.
  // A spreadsheet that leaves this system ends up in an inbox, a shared drive, or an
  // external auditor's file, detached from the screen that produced it. The provenance
  // block travels with it so it can still be identified there.
  const withLetterhead = (titleAr: string, rows: (string | number)[][]) => [
    ...letterheadCsvRows(
      titleAr,
      currentUser?.fullNameAr || currentUser?.fullNameEn || '-',
      new Date().toLocaleString('ar-SA')
    ),
    ...rows,
  ];

  const exportAudits = () => {
    downloadCsv(`audits-${stamp()}.csv`, withLetterhead('تقرير المراجعات', [
      ['رقم المراجعة', 'العنوان', 'الإدارة', 'المرحلة', 'من', 'إلى', 'عدد الأسئلة', 'عدد الملاحظات'],
      ...audits.map(a => [
        getAuditNumber(a),
        isRTL ? a.titleAr : a.titleEn,
        departmentName(a.departmentId),
        isRTL
          ? STAGE_LABELS[stageIdFromIndex(a.currentStage)].ar
          : STAGE_LABELS[stageIdFromIndex(a.currentStage)].en,
        a.startDate ?? '',
        a.endDate ?? '',
        (a.questions ?? []).length,
        (a.findings ?? []).length,
      ]),
    ]));
  };

  const exportFindings = () => {
    const labelB = (value: string) =>
      FINDING_CATEGORY_B.find(c => c.value === value)?.[isRTL ? 'labelAr' : 'labelEn'] ?? value;
    const labelA = (value: string) =>
      FINDING_CATEGORY_A.find(c => c.value === value)?.[isRTL ? 'labelAr' : 'labelEn'] ?? value;

    downloadCsv(`findings-${stamp()}.csv`, withLetterhead('تقرير الملاحظات', [
      ['رقم البلاغ', 'المراجعة', 'الإدارة', 'المجال', 'النوع', 'البند', 'الملاحظة', 'الدليل', 'الحالة', 'تاريخ الإغلاق المتوقع', 'متأخرة'],
      ...findingRows.map(r => [
        r.finding.reportNumber ?? '',
        r.auditNumber,
        departmentName(r.departmentId),
        labelA(r.finding.categoryA),
        labelB(r.finding.categoryB),
        r.finding.clause ?? '',
        r.finding.finding ?? '',
        r.finding.evidence ?? '',
        r.finding.status,
        r.finding.estimatedClosingDate ?? '',
        r.isOverdue ? 'نعم' : 'لا',
      ]),
    ]));
  };

  const exportOverdue = () => {
    downloadCsv(`overdue-findings-${stamp()}.csv`, withLetterhead('تقرير الملاحظات المتأخرة', [
      ['رقم البلاغ', 'المراجعة', 'الإدارة', 'الملاحظة', 'تاريخ الإغلاق المتوقع', 'الحالة'],
      ...findingRows
        .filter(r => r.isOverdue)
        .map(r => [
          r.finding.reportNumber ?? '',
          r.auditNumber,
          departmentName(r.departmentId),
          r.finding.finding ?? '',
          r.finding.estimatedClosingDate ?? '',
          r.finding.status,
        ]),
    ]));
  };

  const exportByDepartment = () => {
    downloadCsv(`findings-by-department-${stamp()}.csv`, withLetterhead('الملاحظات حسب الإدارة', [
      ['الإدارة', 'إجمالي الملاحظات', 'المفتوحة', 'المتأخرة'],
      ...byDepartment.map(d => [departmentName(d.departmentId), d.total, d.open, d.overdue]),
    ]));
  };

  // ===========================================
  // Render
  // ===========================================

  const tiles = [
    { label: isRTL ? 'المراجعات' : 'Audits', value: summary.audits, icon: ClipboardCheck, tone: 'text-blue-600' },
    { label: isRTL ? 'المكتملة' : 'Completed', value: summary.completed, icon: TrendingUp, tone: 'text-green-600' },
    { label: isRTL ? 'الملاحظات' : 'Findings', value: summary.findings, icon: FileBarChart, tone: 'text-purple-600' },
    { label: isRTL ? 'عدم المطابقة' : 'Non-Conformities', value: summary.ncrs, icon: AlertCircle, tone: 'text-amber-600' },
    { label: isRTL ? 'المفتوحة' : 'Open', value: summary.open, icon: AlertCircle, tone: 'text-orange-600' },
    { label: isRTL ? 'المتأخرة' : 'Overdue', value: summary.overdue, icon: AlertCircle, tone: 'text-red-600' },
  ];

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-64" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <ReportLetterheadHeader
          titleAr="تقرير حالة المراجعة الداخلية"
          titleEn="Internal Audit Status Report"
          language={language === 'ar' ? 'ar' : 'en'}
          meta={[
            `${isRTL ? 'التاريخ' : 'Date'}: ${new Date().toLocaleDateString(isRTL ? 'ar-SA' : 'en-GB')}`,
            `${isRTL ? 'أُصدر بواسطة' : 'Produced by'}: ${currentUser?.fullNameAr || currentUser?.fullNameEn || '-'}`,
          ]}
        />

        <div className="flex items-start justify-between gap-4 print:hidden">
          <div>
            <h1 className="text-2xl font-bold text-[var(--foreground)]">
              {isRTL ? 'التقارير' : 'Reports'}
            </h1>
            <p className="mt-1 text-sm text-[var(--foreground-secondary)]">
              {isRTL
                ? 'أرقام محسوبة من المراجعات المسجّلة في النظام الآن، وكل تقرير قابل للتصدير إلى Excel أو الطباعة على ترويسة الشركة.'
                : 'Computed from the audits currently in the system. Every report exports to Excel or prints on the company letterhead.'}
            </p>
          </div>
          <Button
            variant="outline"
            leftIcon={<Printer className="h-4 w-4" />}
            onClick={() => window.print()}
          >
            {isRTL ? 'طباعة' : 'Print'}
          </Button>
        </div>

        {/* الأرقام */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
          {tiles.map(tile => (
            <Card key={tile.label}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-[var(--foreground)]">{tile.value}</span>
                  <tile.icon className={`h-5 w-5 ${tile.tone}`} />
                </div>
                <p className="mt-1 text-xs text-[var(--foreground-secondary)]">{tile.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {audits.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-sm text-[var(--foreground-secondary)]">
              {isRTL
                ? 'لا توجد مراجعات بعد. ستظهر التقارير هنا فور تسجيل أول مراجعة.'
                : 'No audits yet. Reports appear here as soon as the first audit is recorded.'}
            </CardContent>
          </Card>
        )}

        {audits.length > 0 && (
          <>
            {/* التوزيعات */}
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">
                    {isRTL ? 'الملاحظات حسب النوع' : 'Findings by type'}
                  </CardTitle>
                  <Button size="sm" variant="outline" leftIcon={<Download className="h-4 w-4" />} onClick={exportFindings}>
                    {isRTL ? 'تصدير' : 'Export'}
                  </Button>
                </CardHeader>
                <CardContent className="space-y-3">
                  {byCategoryB.map(category => {
                    const pct = summary.findings ? Math.round((category.count / summary.findings) * 100) : 0;
                    return (
                      <div key={category.value}>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span className="text-[var(--foreground)]">
                            {isRTL ? category.labelAr : category.labelEn}
                          </span>
                          <span className="text-[var(--foreground-secondary)]">
                            {category.count} ({pct}%)
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-[var(--border)]">
                          <div
                            className={`h-full rounded-full ${
                              category.value === 'major_nc'
                                ? 'bg-red-500'
                                : category.value === 'minor_nc'
                                  ? 'bg-amber-500'
                                  : category.value === 'observation'
                                    ? 'bg-blue-500'
                                    : 'bg-green-500'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">
                    {isRTL ? 'المراجعات حسب المرحلة' : 'Audits by stage'}
                  </CardTitle>
                  <Button size="sm" variant="outline" leftIcon={<Download className="h-4 w-4" />} onClick={exportAudits}>
                    {isRTL ? 'تصدير' : 'Export'}
                  </Button>
                </CardHeader>
                <CardContent className="space-y-3">
                  {byStage.map(stage => {
                    const pct = audits.length ? Math.round((stage.count / audits.length) * 100) : 0;
                    return (
                      <div key={stage.id}>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span className="text-[var(--foreground)]">{stage.label}</span>
                          <span className="text-[var(--foreground-secondary)]">{stage.count}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-[var(--border)]">
                          <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                  <div className="border-t border-[var(--border)] pt-3">
                    <p className="text-xs text-[var(--foreground-secondary)]">
                      {isRTL ? 'حسب المجال: ' : 'By area: '}
                      {byCategoryA.map(c => `${isRTL ? c.labelAr : c.labelEn} ${c.count}`).join(' · ')}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* حسب الإدارة */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Building2 className="h-4 w-4" />
                  {isRTL ? 'الملاحظات حسب الإدارة' : 'Findings by department'}
                </CardTitle>
                <div className="flex gap-2">
                  {summary.overdue > 0 && (
                    <Button size="sm" variant="outline" leftIcon={<Download className="h-4 w-4" />} onClick={exportOverdue}>
                      {isRTL ? 'تصدير المتأخرة' : 'Export overdue'}
                    </Button>
                  )}
                  <Button size="sm" variant="outline" leftIcon={<Download className="h-4 w-4" />} onClick={exportByDepartment}>
                    {isRTL ? 'تصدير' : 'Export'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{isRTL ? 'الإدارة' : 'Department'}</TableHead>
                        <TableHead>{isRTL ? 'الإجمالي' : 'Total'}</TableHead>
                        <TableHead>{isRTL ? 'مفتوحة' : 'Open'}</TableHead>
                        <TableHead>{isRTL ? 'متأخرة' : 'Overdue'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {byDepartment.map(row => (
                        <TableRow key={row.departmentId}>
                          <TableCell className="font-medium">{departmentName(row.departmentId)}</TableCell>
                          <TableCell>{row.total}</TableCell>
                          <TableCell>{row.open}</TableCell>
                          <TableCell>
                            {row.overdue > 0 ? (
                              <Badge variant="rejected">{row.overdue}</Badge>
                            ) : (
                              <span className="text-[var(--foreground-secondary)]">0</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        <ReportLetterheadFooter language={language === 'ar' ? 'ar' : 'en'} />
      </div>
    </DashboardLayout>
  );
}
