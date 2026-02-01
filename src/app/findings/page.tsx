'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout';
import { Card, CardContent } from '@/components/ui';
import { Button, Badge } from '@/components/ui';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui';
import { useTranslation } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { subscribeToAudits, updateAudit } from '@/lib/firestore';
import {
  Plus,
  Search,
  AlertCircle,
  Eye,
  Edit,
  Clock,
  CheckCircle,
  AlertTriangle,
  XCircle,
  X,
  Calendar,
  FileText,
  Building2,
  User,
  MessageCircle,
  Send,
  Wrench,
  Cloud,
  ClipboardCheck,
  UserCheck,
} from 'lucide-react';
import { OneDrivePicker } from '@/components/ui/OneDrivePicker';
import type { OneDriveFile } from '@/lib/onedrive';

// No demo data - only actual data from localStorage

// Finding interface
interface Finding {
  id: string;
  number: string;
  auditId?: string;
  auditNumber: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  severity: string;
  status: string;
  clause: string;
  departmentId?: string;
  sectionId?: string;
  responsibleAr: string;
  responsibleEn: string;
  dueDate: string;
  closedAt?: string;
  createdAt: string;
  rootCause?: string;
  correctiveAction?: string;
  evidence?: string;
  attachments?: { type: string; name: string; webUrl?: string }[];
  departmentResponse?: {
    comment?: string;
    closingDate: string;
    attachments?: { type: string; name: string; webUrl?: string }[];
  };
}

export default function FindingsPage() {
  const router = useRouter();
  const { t, language, isRTL } = useTranslation();
  const { currentUser, departments: allDepartments, sections: allSections, users: allUsers } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'all' | 'as_auditor' | 'as_auditee'>('all');

  // Modal states
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);

  // Edit form state
  const [editForm, setEditForm] = useState({
    rootCause: '',
    correctiveAction: '',
    comment: '',
    closingDate: '',
    attachments: [] as OneDriveFile[],
  });

  // All findings from audits (loaded from Firestore)
  const [allFindings, setAllFindings] = useState<Finding[]>([]);

  // Load findings from Firestore (from audits)
  useEffect(() => {
    const unsubscribe = subscribeToAudits((audits) => {
        const findingsFromAudits: Finding[] = [];

        audits.forEach((audit: any) => {
          if (audit.findings && audit.findings.length > 0) {
            audit.findings.forEach((f: any) => {
              findingsFromAudits.push({
                id: f.id,
                number: f.reportNumber || `${audit.number}-F${findingsFromAudits.length + 1}`,
                auditId: audit.id,
                auditNumber: audit.number,
                titleAr: f.finding,
                titleEn: f.finding,
                descriptionAr: f.evidence || '',
                descriptionEn: f.evidence || '',
                severity: f.categoryB === 'major_nc' ? 'major' : f.categoryB === 'minor_nc' ? 'minor' : f.categoryB === 'observation' ? 'observation' : 'minor',
                status: f.status === 'closed' ? 'closed' : f.status === 'in_progress' ? 'in_progress' : f.status === 'pending_verification' ? 'verified' : 'open',
                clause: f.clause || '',
                departmentId: f.departmentId,
                sectionId: f.sectionId,
                responsibleAr: getDepartmentName(f.departmentId, 'ar'),
                responsibleEn: getDepartmentName(f.departmentId, 'en'),
                dueDate: f.estimatedClosingDate,
                closedAt: f.closedAt,
                createdAt: f.createdAt,
                rootCause: f.rootCause,
                correctiveAction: f.correctiveAction,
                evidence: f.evidence,
                attachments: f.attachments,
                departmentResponse: f.departmentResponse,
              });
            });
          }
        });

        setAllFindings(findingsFromAudits);
    });

    return () => unsubscribe();
  }, []);

  // Helper function to get department name
  const getDepartmentName = (deptId: string, lang: 'ar' | 'en') => {
    const dept = allDepartments.find(d => d.id === deptId);
    return dept ? (lang === 'ar' ? dept.nameAr : dept.nameEn) : '';
  };

  // All findings from audits - sorted by newest first
  const combinedFindings = [...allFindings].sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  // Findings that need action (status is open and belongs to current user's department)
  const findingsNeedingAction = combinedFindings.filter(f =>
    f.status === 'open' &&
    'departmentId' in f && f.departmentId === currentUser?.departmentId
  );

  // Check if user is an auditee (from audited department)
  const isAuditee = combinedFindings.some(f => 'departmentId' in f && f.departmentId === currentUser?.departmentId);

  // Helper functions to determine user's role in each finding
  const isUserAuditor = (finding: Finding) => {
    // Get the audit to check if user is the lead auditor or in auditor team
    const storedAudits = localStorage.getItem('qms_audits');
    if (storedAudits && finding.auditId) {
      const audits = JSON.parse(storedAudits);
      const audit = audits.find((a: any) => a.id === finding.auditId);
      if (audit) {
        return audit.leadAuditorId === currentUser?.id ||
               audit.auditorIds?.includes(currentUser?.id || '') ||
               audit.createdBy === currentUser?.id;
      }
    }
    return false;
  };

  const isUserAuditee = (finding: Finding) => {
    // User is auditee if finding is for their department
    return finding.departmentId === currentUser?.departmentId;
  };

  const getUserRoleInFinding = (finding: Finding): 'auditor' | 'auditee' | 'both' | 'none' => {
    const auditor = isUserAuditor(finding);
    const auditee = isUserAuditee(finding);
    if (auditor && auditee) return 'both';
    if (auditor) return 'auditor';
    if (auditee) return 'auditee';
    return 'none';
  };

  // Role-based filtering
  const getFilteredByRole = (findings: typeof combinedFindings) => {
    if (viewMode === 'as_auditor') {
      return findings.filter(f => isUserAuditor(f as Finding));
    }
    if (viewMode === 'as_auditee') {
      return findings.filter(f => isUserAuditee(f as Finding));
    }
    return findings;
  };

  // Count findings by role
  const auditorFindingsCount = combinedFindings.filter(f => isUserAuditor(f as Finding)).length;
  const auditeeFindingsCount = combinedFindings.filter(f => isUserAuditee(f as Finding)).length;

  const severities = [
    { value: 'all', labelAr: 'الكل', labelEn: 'All' },
    { value: 'observation', labelAr: 'ملاحظة', labelEn: 'Observation' },
    { value: 'minor', labelAr: 'بسيطة', labelEn: 'Minor' },
    { value: 'major', labelAr: 'رئيسية', labelEn: 'Major' },
    { value: 'critical', labelAr: 'حرجة', labelEn: 'Critical' },
  ];

  const statuses = [
    { value: 'all', labelAr: 'الكل', labelEn: 'All' },
    { value: 'open', labelAr: 'مفتوحة', labelEn: 'Open' },
    { value: 'in_progress', labelAr: 'قيد المعالجة', labelEn: 'In Progress' },
    { value: 'closed', labelAr: 'مغلقة', labelEn: 'Closed' },
    { value: 'verified', labelAr: 'تم التحقق', labelEn: 'Verified' },
  ];

  const getSeverityBadge = (severity: string) => {
    const config: Record<string, { variant: 'critical' | 'major' | 'minor' | 'observation'; labelAr: string; labelEn: string }> = {
      critical: { variant: 'critical', labelAr: 'حرجة', labelEn: 'Critical' },
      major: { variant: 'major', labelAr: 'رئيسية', labelEn: 'Major' },
      minor: { variant: 'minor', labelAr: 'بسيطة', labelEn: 'Minor' },
      observation: { variant: 'observation', labelAr: 'ملاحظة', labelEn: 'Observation' },
    };
    const c = config[severity] || { variant: 'observation' as const, labelAr: severity, labelEn: severity };
    return <Badge variant={c.variant}>{language === 'ar' ? c.labelAr : c.labelEn}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: 'warning' | 'info' | 'success'; icon: React.ElementType; labelAr: string; labelEn: string }> = {
      open: { variant: 'warning', icon: AlertCircle, labelAr: 'مفتوحة', labelEn: 'Open' },
      in_progress: { variant: 'info', icon: Clock, labelAr: 'قيد المعالجة', labelEn: 'In Progress' },
      closed: { variant: 'success', icon: CheckCircle, labelAr: 'مغلقة', labelEn: 'Closed' },
      verified: { variant: 'success', icon: CheckCircle, labelAr: 'تم التحقق', labelEn: 'Verified' },
    };
    const c = config[status] || { variant: 'warning' as const, icon: AlertCircle, labelAr: status, labelEn: status };
    return <Badge variant={c.variant}>{language === 'ar' ? c.labelAr : c.labelEn}</Badge>;
  };

  const filteredFindings = getFilteredByRole(combinedFindings).filter(finding => {
    const matchesSearch =
      finding.titleAr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      finding.titleEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      finding.number.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSeverity = selectedSeverity === 'all' || finding.severity === selectedSeverity;
    const matchesStatus = selectedStatus === 'all' || finding.status === selectedStatus;
    return matchesSearch && matchesSeverity && matchesStatus;
  });

  const openCount = combinedFindings.filter(f => f.status === 'open').length;
  const inProgressCount = combinedFindings.filter(f => f.status === 'in_progress').length;
  const closedCount = combinedFindings.filter(f => f.status === 'closed' || f.status === 'verified').length;
  const criticalCount = combinedFindings.filter(f => f.severity === 'critical' && f.status !== 'closed' && f.status !== 'verified').length;

  // Handle view finding
  const handleViewFinding = (finding: Finding) => {
    setSelectedFinding(finding);
    setShowViewModal(true);
  };

  // Handle edit finding
  const handleEditFinding = (finding: Finding) => {
    setSelectedFinding(finding);
    setEditForm({
      rootCause: finding.rootCause || '',
      correctiveAction: finding.correctiveAction || '',
      comment: finding.departmentResponse?.comment || '',
      closingDate: finding.departmentResponse?.closingDate || finding.dueDate,
      attachments: [],
    });
    setShowEditModal(true);
  };

  // Save finding changes
  const handleSaveFinding = () => {
    if (!selectedFinding) return;

    // Update in localStorage
    const storedAudits = localStorage.getItem('qms_audits');
    if (storedAudits && selectedFinding.auditId) {
      const audits = JSON.parse(storedAudits);
      const updatedAudits = audits.map((audit: any) => {
        if (audit.id === selectedFinding.auditId) {
          return {
            ...audit,
            findings: audit.findings.map((f: any) =>
              f.id === selectedFinding.id
                ? {
                    ...f,
                    rootCause: editForm.rootCause,
                    correctiveAction: editForm.correctiveAction,
                    status: editForm.correctiveAction ? 'in_progress' : f.status,
                    departmentResponse: {
                      approvedBy: currentUser?.id || '',
                      approvedAt: new Date().toISOString(),
                      closingDate: editForm.closingDate,
                      comment: editForm.comment,
                      attachments: editForm.attachments.map(file => ({
                        type: 'onedrive',
                        name: file.name,
                        size: file.size,
                        webUrl: file.webUrl,
                        id: file.id,
                      })),
                    },
                  }
                : f
            ),
          };
        }
        return audit;
      });

      localStorage.setItem('qms_audits', JSON.stringify(updatedAudits));

      // Reload findings
      window.dispatchEvent(new Event('storage'));
    }

    setShowEditModal(false);
    setSelectedFinding(null);
    setEditForm({ rootCause: '', correctiveAction: '', comment: '', closingDate: '', attachments: [] });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--foreground)]">
              {t('findings.title')}
            </h1>
            <p className="mt-1 text-[var(--foreground-secondary)]">
              {language === 'ar' ? 'متابعة ملاحظات التدقيق والإجراءات التصحيحية' : 'Track audit findings and corrective actions'}
            </p>
          </div>
          <Button leftIcon={<Plus className="h-4 w-4" />}>
            {t('findings.newFinding')}
          </Button>
        </div>

        {/* Alert for findings needing action */}
        {findingsNeedingAction.length > 0 && (
          <div className="p-4 rounded-lg bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 border border-orange-200 dark:border-orange-800 animate-pulse">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-orange-100 dark:bg-orange-800 animate-bounce">
                <AlertTriangle className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-orange-800 dark:text-orange-200 mb-1">
                  {language === 'ar'
                    ? `لديك ${findingsNeedingAction.length} ملاحظة تحتاج إجراء!`
                    : `You have ${findingsNeedingAction.length} finding(s) requiring action!`}
                </h3>
                <p className="text-sm text-orange-700 dark:text-orange-300 mb-3">
                  {language === 'ar'
                    ? 'يرجى تحديد تاريخ الإغلاق والرد على الملاحظات التالية:'
                    : 'Please set closing date and respond to the following findings:'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {findingsNeedingAction.slice(0, 5).map((f) => (
                    <button
                      key={f.id}
                      onClick={() => handleEditFinding(f)}
                      className="px-3 py-1 rounded-full text-xs font-medium bg-orange-200 dark:bg-orange-800 text-orange-800 dark:text-orange-200 hover:bg-orange-300 dark:hover:bg-orange-700 transition-colors"
                    >
                      {f.number}
                    </button>
                  ))}
                  {findingsNeedingAction.length > 5 && (
                    <span className="px-3 py-1 text-xs text-orange-600 dark:text-orange-400">
                      +{findingsNeedingAction.length - 5} {language === 'ar' ? 'المزيد' : 'more'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--status-warning-bg)]">
                <AlertCircle className="h-5 w-5 text-[var(--status-warning)]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--foreground)]">{openCount}</p>
                <p className="text-sm text-[var(--foreground-secondary)]">
                  {language === 'ar' ? 'مفتوحة' : 'Open'}
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--status-info-bg)]">
                <Clock className="h-5 w-5 text-[var(--status-info)]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--foreground)]">{inProgressCount}</p>
                <p className="text-sm text-[var(--foreground-secondary)]">
                  {language === 'ar' ? 'قيد المعالجة' : 'In Progress'}
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--status-success-bg)]">
                <CheckCircle className="h-5 w-5 text-[var(--status-success)]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--foreground)]">{closedCount}</p>
                <p className="text-sm text-[var(--foreground-secondary)]">
                  {language === 'ar' ? 'مغلقة' : 'Closed'}
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--risk-critical-bg)]">
                <AlertTriangle className="h-5 w-5 text-[var(--risk-critical)]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--foreground)]">{criticalCount}</p>
                <p className="text-sm text-[var(--foreground-secondary)]">
                  {language === 'ar' ? 'حرجة مفتوحة' : 'Critical Open'}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Role Tabs */}
        <div className="flex flex-wrap gap-2 p-1 bg-[var(--background-secondary)] rounded-lg w-fit">
          <button
            onClick={() => setViewMode('all')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              viewMode === 'all'
                ? 'bg-[var(--background)] text-[var(--foreground)] shadow-sm'
                : 'text-[var(--foreground-secondary)] hover:text-[var(--foreground)]'
            }`}
          >
            <FileText className="h-4 w-4" />
            {language === 'ar' ? 'كل الملاحظات' : 'All Findings'}
            <span className="px-1.5 py-0.5 text-xs rounded-full bg-[var(--foreground-muted)]/20">
              {combinedFindings.length}
            </span>
          </button>
          <button
            onClick={() => setViewMode('as_auditor')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              viewMode === 'as_auditor'
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 shadow-sm'
                : 'text-[var(--foreground-secondary)] hover:text-[var(--foreground)]'
            }`}
          >
            <ClipboardCheck className="h-4 w-4" />
            {language === 'ar' ? 'كمراجع' : 'As Auditor'}
            {auditorFindingsCount > 0 && (
              <span className="px-1.5 py-0.5 text-xs rounded-full bg-blue-200 dark:bg-blue-800 text-blue-700 dark:text-blue-300">
                {auditorFindingsCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setViewMode('as_auditee')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              viewMode === 'as_auditee'
                ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 shadow-sm'
                : 'text-[var(--foreground-secondary)] hover:text-[var(--foreground)]'
            }`}
          >
            <UserCheck className="h-4 w-4" />
            {language === 'ar' ? 'كمراجع عليه' : 'As Auditee'}
            {auditeeFindingsCount > 0 && (
              <span className="px-1.5 py-0.5 text-xs rounded-full bg-orange-200 dark:bg-orange-800 text-orange-700 dark:text-orange-300">
                {auditeeFindingsCount}
              </span>
            )}
          </button>
        </div>

        {/* Role Description Banner */}
        {viewMode !== 'all' && (
          <div className={`p-3 rounded-lg ${
            viewMode === 'as_auditor'
              ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
              : 'bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800'
          }`}>
            <p className={`text-sm ${
              viewMode === 'as_auditor'
                ? 'text-blue-700 dark:text-blue-300'
                : 'text-orange-700 dark:text-orange-300'
            }`}>
              {viewMode === 'as_auditor'
                ? (language === 'ar'
                    ? 'عرض الملاحظات التي قمت بتسجيلها كمراجع - يمكنك متابعة حالة الإجراءات التصحيحية'
                    : 'Showing findings you recorded as an auditor - you can track corrective action status')
                : (language === 'ar'
                    ? 'عرض الملاحظات المسجلة على إدارتك - يتطلب منك اتخاذ إجراءات تصحيحية'
                    : 'Showing findings recorded against your department - corrective actions required from you')
              }
            </p>
          </div>
        )}

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--foreground-muted)]" />
                <input
                  type="text"
                  placeholder={language === 'ar' ? 'بحث في الملاحظات...' : 'Search findings...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] py-2 ps-10 pe-4 text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-muted)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-opacity-20"
                />
              </div>

              {/* Severity Filter */}
              <select
                value={selectedSeverity}
                onChange={(e) => setSelectedSeverity(e.target.value)}
                className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-opacity-20"
              >
                {severities.map(sev => (
                  <option key={sev.value} value={sev.value}>
                    {language === 'ar' ? sev.labelAr : sev.labelEn}
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-opacity-20"
              >
                {statuses.map(status => (
                  <option key={status.value} value={status.value}>
                    {language === 'ar' ? status.labelAr : status.labelEn}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Findings Table */}
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('findings.findingNumber')}</TableHead>
                <TableHead>{t('findings.findingTitle')}</TableHead>
                <TableHead>{language === 'ar' ? 'دورك' : 'Your Role'}</TableHead>
                <TableHead>{t('findings.severity')}</TableHead>
                <TableHead>{t('common.status')}</TableHead>
                <TableHead>{t('findings.clause')}</TableHead>
                <TableHead>{t('findings.responsible')}</TableHead>
                <TableHead>{t('findings.dueDate')}</TableHead>
                <TableHead className="text-center">{t('common.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredFindings.map((finding) => {
                const userRole = getUserRoleInFinding(finding as Finding);
                return (
                <TableRow key={finding.id}>
                  <TableCell className="font-mono text-sm">{finding.number}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{language === 'ar' ? finding.titleAr : finding.titleEn}</p>
                      <p className="text-xs text-[var(--foreground-muted)]">{finding.auditNumber}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(userRole === 'auditor' || userRole === 'both') && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                          <ClipboardCheck className="h-3 w-3" />
                          {language === 'ar' ? 'مراجع' : 'Auditor'}
                        </span>
                      )}
                      {(userRole === 'auditee' || userRole === 'both') && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300">
                          <UserCheck className="h-3 w-3" />
                          {language === 'ar' ? 'مراجع عليه' : 'Auditee'}
                        </span>
                      )}
                      {userRole === 'none' && (
                        <span className="text-xs text-[var(--foreground-muted)]">-</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{getSeverityBadge(finding.severity)}</TableCell>
                  <TableCell>{getStatusBadge(finding.status)}</TableCell>
                  <TableCell className="font-mono text-sm text-[var(--foreground-secondary)]">
                    {finding.clause}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--primary-light)] text-xs font-medium text-[var(--primary)]">
                        {(language === 'ar' ? finding.responsibleAr : finding.responsibleEn).charAt(0)}
                      </div>
                      <span className="text-sm">{language === 'ar' ? finding.responsibleAr : finding.responsibleEn}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {new Date(finding.dueDate).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}
                      {new Date(finding.dueDate) < new Date() && finding.status !== 'closed' && finding.status !== 'verified' && (
                        <span className="ms-2 text-xs text-[var(--status-error)]">
                          {language === 'ar' ? '(متأخر)' : '(Overdue)'}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title={t('common.view')}
                        onClick={() => handleViewFinding(finding as Finding)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title={t('common.edit')}
                        onClick={() => handleEditFinding(finding as Finding)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>

        {/* View Finding Modal */}
        {showViewModal && selectedFinding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowViewModal(false)} />
            <div className="relative z-50 w-full max-w-2xl rounded-xl bg-white dark:bg-gray-900 p-6 shadow-xl mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold">{selectedFinding.number}</h2>
                  <p className="text-sm text-[var(--foreground-secondary)]">{selectedFinding.auditNumber}</p>
                </div>
                <Button variant="ghost" size="icon-sm" onClick={() => setShowViewModal(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-4">
                {/* Status and Severity */}
                <div className="flex gap-2">
                  {getSeverityBadge(selectedFinding.severity)}
                  {getStatusBadge(selectedFinding.status)}
                </div>

                {/* Finding Title/Description */}
                <div className="p-4 rounded-lg bg-[var(--background-secondary)]">
                  <p className="text-sm font-medium mb-1">{language === 'ar' ? 'الملاحظة' : 'Finding'}</p>
                  <p className="text-sm">{language === 'ar' ? selectedFinding.titleAr : selectedFinding.titleEn}</p>
                </div>

                {/* Evidence */}
                {selectedFinding.descriptionAr && (
                  <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20">
                    <p className="text-sm font-medium mb-1 text-amber-800 dark:text-amber-200">{language === 'ar' ? 'الدليل' : 'Evidence'}</p>
                    <p className="text-sm text-amber-700 dark:text-amber-300">{language === 'ar' ? selectedFinding.descriptionAr : selectedFinding.descriptionEn}</p>
                  </div>
                )}

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-[var(--background-secondary)]">
                    <p className="text-xs text-[var(--foreground-secondary)] mb-1">{language === 'ar' ? 'البند' : 'Clause'}</p>
                    <p className="text-sm font-medium">{selectedFinding.clause || '-'}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-[var(--background-secondary)]">
                    <p className="text-xs text-[var(--foreground-secondary)] mb-1">{language === 'ar' ? 'تاريخ الإغلاق' : 'Due Date'}</p>
                    <p className="text-sm font-medium">{selectedFinding.dueDate}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-[var(--background-secondary)]">
                    <p className="text-xs text-[var(--foreground-secondary)] mb-1">{language === 'ar' ? 'المسؤول' : 'Responsible'}</p>
                    <p className="text-sm font-medium">{language === 'ar' ? selectedFinding.responsibleAr : selectedFinding.responsibleEn}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-[var(--background-secondary)]">
                    <p className="text-xs text-[var(--foreground-secondary)] mb-1">{language === 'ar' ? 'تاريخ الإنشاء' : 'Created At'}</p>
                    <p className="text-sm font-medium">{selectedFinding.createdAt}</p>
                  </div>
                </div>

                {/* Root Cause */}
                {selectedFinding.rootCause && (
                  <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                    <p className="text-sm font-medium mb-1 text-blue-800 dark:text-blue-200">{language === 'ar' ? 'السبب الجذري' : 'Root Cause'}</p>
                    <p className="text-sm text-blue-700 dark:text-blue-300">{selectedFinding.rootCause}</p>
                  </div>
                )}

                {/* Corrective Action */}
                {selectedFinding.correctiveAction && (
                  <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20">
                    <p className="text-sm font-medium mb-1 text-green-800 dark:text-green-200">{language === 'ar' ? 'الإجراء التصحيحي' : 'Corrective Action'}</p>
                    <p className="text-sm text-green-700 dark:text-green-300">{selectedFinding.correctiveAction}</p>
                  </div>
                )}

                {/* Department Response */}
                {selectedFinding.departmentResponse && (
                  <div className="p-4 rounded-lg bg-indigo-50 dark:bg-indigo-900/20">
                    <p className="text-sm font-medium mb-1 text-indigo-800 dark:text-indigo-200">{language === 'ar' ? 'رد الإدارة' : 'Department Response'}</p>
                    {selectedFinding.departmentResponse.comment && (
                      <p className="text-sm text-indigo-700 dark:text-indigo-300 mb-2">{selectedFinding.departmentResponse.comment}</p>
                    )}
                    <p className="text-xs text-indigo-600 dark:text-indigo-400">
                      {language === 'ar' ? 'تاريخ الإغلاق المحدد: ' : 'Set Closing Date: '}{selectedFinding.departmentResponse.closingDate}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <Button variant="outline" onClick={() => setShowViewModal(false)}>
                  {language === 'ar' ? 'إغلاق' : 'Close'}
                </Button>
                {selectedFinding.auditId && (
                  <Button onClick={() => router.push(`/audits/${selectedFinding.auditId}`)}>
                    {language === 'ar' ? 'عرض المراجعة' : 'View Audit'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Edit Finding Modal */}
        {showEditModal && selectedFinding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowEditModal(false)} />
            <div className="relative z-50 w-full max-w-2xl rounded-xl bg-white dark:bg-gray-900 p-6 shadow-xl mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold">
                    {language === 'ar' ? 'تعديل الملاحظة' : 'Edit Finding'}
                  </h2>
                  <p className="text-sm text-[var(--foreground-secondary)]">{selectedFinding.number}</p>
                </div>
                <Button variant="ghost" size="icon-sm" onClick={() => setShowEditModal(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Finding Info */}
              <div className="mb-4 p-3 rounded-lg bg-[var(--background-secondary)]">
                <p className="text-sm">{language === 'ar' ? selectedFinding.titleAr : selectedFinding.titleEn}</p>
              </div>

              <div className="space-y-4">
                {/* Root Cause */}
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {language === 'ar' ? 'السبب الجذري' : 'Root Cause'}
                  </label>
                  <textarea
                    rows={3}
                    value={editForm.rootCause}
                    onChange={(e) => setEditForm({ ...editForm, rootCause: e.target.value })}
                    placeholder={language === 'ar' ? 'ما هو السبب الجذري لهذه الملاحظة؟' : 'What is the root cause of this finding?'}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm"
                  />
                </div>

                {/* Corrective Action */}
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {language === 'ar' ? 'الإجراء التصحيحي' : 'Corrective Action'}
                  </label>
                  <textarea
                    rows={3}
                    value={editForm.correctiveAction}
                    onChange={(e) => setEditForm({ ...editForm, correctiveAction: e.target.value })}
                    placeholder={language === 'ar' ? 'ما هو الإجراء التصحيحي المتخذ؟' : 'What corrective action was taken?'}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm"
                  />
                </div>

                {/* Comment */}
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {language === 'ar' ? 'التعليق' : 'Comment'}
                  </label>
                  <textarea
                    rows={2}
                    value={editForm.comment}
                    onChange={(e) => setEditForm({ ...editForm, comment: e.target.value })}
                    placeholder={language === 'ar' ? 'أي تعليقات إضافية...' : 'Any additional comments...'}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm"
                  />
                </div>

                {/* Closing Date */}
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {language === 'ar' ? 'تاريخ الإغلاق المحدد' : 'Set Closing Date'}
                  </label>
                  <input
                    type="date"
                    value={editForm.closingDate}
                    onChange={(e) => setEditForm({ ...editForm, closingDate: e.target.value })}
                    max={selectedFinding.dueDate}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm"
                  />
                </div>

                {/* Attachments */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    {language === 'ar' ? 'المرفقات' : 'Attachments'}
                  </label>
                  <OneDrivePicker
                    onFilesSelected={(files) => setEditForm({
                      ...editForm,
                      attachments: [...editForm.attachments, ...files],
                    })}
                    selectedFiles={editForm.attachments}
                    onRemoveFile={(fileId) => setEditForm({
                      ...editForm,
                      attachments: editForm.attachments.filter(f => f.id !== fileId),
                    })}
                    maxFiles={5}
                    language={language}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <Button variant="outline" onClick={() => {
                  setShowEditModal(false);
                  setEditForm({ rootCause: '', correctiveAction: '', comment: '', closingDate: '', attachments: [] });
                }}>
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </Button>
                <Button onClick={handleSaveFinding}>
                  <Send className="h-4 w-4 mx-1" />
                  {language === 'ar' ? 'حفظ التغييرات' : 'Save Changes'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
