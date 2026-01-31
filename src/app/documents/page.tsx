'use client';

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { Button, Badge } from '@/components/ui';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui';
import { useTranslation } from '@/contexts/LanguageContext';
import {
  Plus,
  Search,
  Filter,
  FileText,
  Eye,
  Edit,
  Trash2,
  Download,
  MoreVertical,
  FolderOpen,
  Clock,
  CheckCircle,
  X,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  Printer,
} from 'lucide-react';

// Demo data with sample content for preview
const documents = [
  {
    id: '1',
    number: 'DOC-2026-0001',
    titleAr: 'سياسة الجودة العامة',
    titleEn: 'General Quality Policy',
    category: 'policy',
    version: '2.0',
    status: 'approved',
    departmentAr: 'إدارة الجودة',
    departmentEn: 'Quality Department',
    ownerAr: 'أحمد محمد',
    ownerEn: 'Ahmed Mohammed',
    effectiveDate: '2026-01-01',
    updatedAt: '2026-01-28',
    contentAr: `<h1>سياسة الجودة العامة</h1>
<h2>1. الهدف</h2>
<p>تهدف هذه السياسة إلى تحديد التزام شركة الكابلات السعودية بتقديم منتجات وخدمات عالية الجودة تلبي توقعات العملاء ومتطلبات المعايير الدولية.</p>

<h2>2. النطاق</h2>
<p>تنطبق هذه السياسة على جميع العمليات والأنشطة داخل المنظمة، بما في ذلك:</p>
<ul>
<li>عمليات التصنيع والإنتاج</li>
<li>خدمات العملاء</li>
<li>إدارة الموردين</li>
<li>البحث والتطوير</li>
</ul>

<h2>3. التزاماتنا</h2>
<p>نلتزم بما يلي:</p>
<ol>
<li>تلبية متطلبات العملاء وتجاوز توقعاتهم</li>
<li>الامتثال للمتطلبات القانونية والتنظيمية</li>
<li>التحسين المستمر لنظام إدارة الجودة</li>
<li>توفير الموارد اللازمة لتحقيق أهداف الجودة</li>
</ol>

<h2>4. المسؤوليات</h2>
<p>الإدارة العليا مسؤولة عن ضمان تطبيق هذه السياسة وتوفير الموارد اللازمة.</p>`,
    contentEn: `<h1>General Quality Policy</h1>
<h2>1. Purpose</h2>
<p>This policy aims to define Saudi Cable Company's commitment to delivering high-quality products and services that meet customer expectations and international standards requirements.</p>

<h2>2. Scope</h2>
<p>This policy applies to all processes and activities within the organization, including:</p>
<ul>
<li>Manufacturing and production processes</li>
<li>Customer services</li>
<li>Supplier management</li>
<li>Research and development</li>
</ul>

<h2>3. Our Commitments</h2>
<p>We are committed to:</p>
<ol>
<li>Meeting customer requirements and exceeding their expectations</li>
<li>Compliance with legal and regulatory requirements</li>
<li>Continuous improvement of the quality management system</li>
<li>Providing necessary resources to achieve quality objectives</li>
</ol>

<h2>4. Responsibilities</h2>
<p>Top management is responsible for ensuring the implementation of this policy and providing necessary resources.</p>`,
  },
  {
    id: '2',
    number: 'DOC-2026-0002',
    titleAr: 'إجراء مراقبة الجودة',
    titleEn: 'Quality Control Procedure',
    category: 'procedure',
    version: '1.1',
    status: 'pending_review',
    departmentAr: 'الإنتاج',
    departmentEn: 'Production',
    ownerAr: 'سعد العبدالله',
    ownerEn: 'Saad Al-Abdullah',
    effectiveDate: '2026-01-15',
    updatedAt: '2026-01-27',
    contentAr: `<h1>إجراء مراقبة الجودة</h1>
<h2>1. الغرض</h2>
<p>يحدد هذا الإجراء الخطوات اللازمة لضمان جودة المنتجات أثناء عملية الإنتاج.</p>

<h2>2. الإجراءات</h2>
<h3>2.1 فحص المواد الخام</h3>
<p>يجب فحص جميع المواد الخام عند الاستلام وفقاً للمواصفات المحددة.</p>

<h3>2.2 فحص خط الإنتاج</h3>
<p>يتم إجراء فحوصات دورية على خط الإنتاج كل ساعتين.</p>

<h3>2.3 الفحص النهائي</h3>
<p>يخضع كل منتج نهائي لفحص شامل قبل التعبئة والشحن.</p>`,
    contentEn: `<h1>Quality Control Procedure</h1>
<h2>1. Purpose</h2>
<p>This procedure defines the steps required to ensure product quality during the production process.</p>

<h2>2. Procedures</h2>
<h3>2.1 Raw Material Inspection</h3>
<p>All raw materials must be inspected upon receipt according to specified specifications.</p>

<h3>2.2 Production Line Inspection</h3>
<p>Periodic inspections are conducted on the production line every two hours.</p>

<h3>2.3 Final Inspection</h3>
<p>Every final product undergoes a comprehensive inspection before packaging and shipping.</p>`,
  },
  {
    id: '3',
    number: 'DOC-2026-0003',
    titleAr: 'تعليمات الفحص الداخلي',
    titleEn: 'Internal Inspection Instructions',
    category: 'work_instruction',
    version: '1.0',
    status: 'draft',
    departmentAr: 'الجودة',
    departmentEn: 'Quality',
    ownerAr: 'خالد السعيد',
    ownerEn: 'Khalid Al-Saeed',
    effectiveDate: null,
    updatedAt: '2026-01-26',
    contentAr: `<h1>تعليمات الفحص الداخلي</h1>
<p>هذا المستند قيد الإعداد...</p>`,
    contentEn: `<h1>Internal Inspection Instructions</h1>
<p>This document is under preparation...</p>`,
  },
  {
    id: '4',
    number: 'DOC-2026-0004',
    titleAr: 'نموذج طلب تغيير',
    titleEn: 'Change Request Form',
    category: 'form',
    version: '3.0',
    status: 'approved',
    departmentAr: 'الموارد البشرية',
    departmentEn: 'Human Resources',
    ownerAr: 'فهد المالكي',
    ownerEn: 'Fahad Al-Maliki',
    effectiveDate: '2025-12-01',
    updatedAt: '2026-01-20',
    contentAr: `<h1>نموذج طلب تغيير</h1>
<table border="1" style="width:100%; border-collapse: collapse;">
<tr><td style="padding: 8px;"><strong>رقم الطلب:</strong></td><td style="padding: 8px;"></td></tr>
<tr><td style="padding: 8px;"><strong>التاريخ:</strong></td><td style="padding: 8px;"></td></tr>
<tr><td style="padding: 8px;"><strong>مقدم الطلب:</strong></td><td style="padding: 8px;"></td></tr>
<tr><td style="padding: 8px;"><strong>القسم:</strong></td><td style="padding: 8px;"></td></tr>
<tr><td style="padding: 8px;"><strong>وصف التغيير المطلوب:</strong></td><td style="padding: 8px;"></td></tr>
<tr><td style="padding: 8px;"><strong>سبب التغيير:</strong></td><td style="padding: 8px;"></td></tr>
</table>`,
    contentEn: `<h1>Change Request Form</h1>
<table border="1" style="width:100%; border-collapse: collapse;">
<tr><td style="padding: 8px;"><strong>Request Number:</strong></td><td style="padding: 8px;"></td></tr>
<tr><td style="padding: 8px;"><strong>Date:</strong></td><td style="padding: 8px;"></td></tr>
<tr><td style="padding: 8px;"><strong>Requester:</strong></td><td style="padding: 8px;"></td></tr>
<tr><td style="padding: 8px;"><strong>Department:</strong></td><td style="padding: 8px;"></td></tr>
<tr><td style="padding: 8px;"><strong>Change Description:</strong></td><td style="padding: 8px;"></td></tr>
<tr><td style="padding: 8px;"><strong>Reason for Change:</strong></td><td style="padding: 8px;"></td></tr>
</table>`,
  },
  {
    id: '5',
    number: 'DOC-2026-0005',
    titleAr: 'دليل نظام إدارة الجودة',
    titleEn: 'Quality Management System Manual',
    category: 'manual',
    version: '4.0',
    status: 'approved',
    departmentAr: 'إدارة الجودة',
    departmentEn: 'Quality Department',
    ownerAr: 'أحمد محمد',
    ownerEn: 'Ahmed Mohammed',
    effectiveDate: '2025-06-01',
    updatedAt: '2026-01-15',
    contentAr: `<h1>دليل نظام إدارة الجودة</h1>
<h2>مقدمة</h2>
<p>يوثق هذا الدليل نظام إدارة الجودة المطبق في شركة الكابلات السعودية وفقاً لمتطلبات معيار ISO 9001:2015.</p>

<h2>سياق المنظمة</h2>
<p>شركة الكابلات السعودية هي شركة رائدة في تصنيع الكابلات الكهربائية في المملكة العربية السعودية.</p>

<h2>القيادة</h2>
<p>تلتزم الإدارة العليا بتطوير وتطبيق نظام إدارة الجودة والتحسين المستمر لفعاليته.</p>`,
    contentEn: `<h1>Quality Management System Manual</h1>
<h2>Introduction</h2>
<p>This manual documents the quality management system implemented at Saudi Cable Company in accordance with ISO 9001:2015 requirements.</p>

<h2>Context of the Organization</h2>
<p>Saudi Cable Company is a leading manufacturer of electrical cables in the Kingdom of Saudi Arabia.</p>

<h2>Leadership</h2>
<p>Top management is committed to developing and implementing the quality management system and continuously improving its effectiveness.</p>`,
  },
];

export default function DocumentsPage() {
  const { t, language, isRTL } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<typeof documents[0] | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(100);

  const handleView = (doc: typeof documents[0]) => {
    setSelectedDoc(doc);
    setShowViewModal(true);
  };

  const handlePreview = (doc: typeof documents[0]) => {
    setSelectedDoc(doc);
    setPreviewZoom(100);
    setShowPreviewModal(true);
  };

  const handleZoomIn = () => {
    setPreviewZoom(prev => Math.min(prev + 25, 200));
  };

  const handleZoomOut = () => {
    setPreviewZoom(prev => Math.max(prev - 25, 50));
  };

  const handlePrint = () => {
    window.print();
  };

  const handleEdit = (doc: typeof documents[0]) => {
    alert(language === 'ar' ? `سيتم تعديل: ${doc.titleAr}` : `Will edit: ${doc.titleEn}`);
  };

  const handleDownload = (doc: typeof documents[0]) => {
    alert(language === 'ar' ? `سيتم تحميل: ${doc.titleAr}` : `Will download: ${doc.titleEn}`);
  };

  const categories = [
    { value: 'all', labelAr: 'الكل', labelEn: 'All' },
    { value: 'policy', labelAr: 'سياسات', labelEn: 'Policies' },
    { value: 'procedure', labelAr: 'إجراءات', labelEn: 'Procedures' },
    { value: 'work_instruction', labelAr: 'تعليمات عمل', labelEn: 'Work Instructions' },
    { value: 'form', labelAr: 'نماذج', labelEn: 'Forms' },
    { value: 'manual', labelAr: 'أدلة', labelEn: 'Manuals' },
  ];

  const statuses = [
    { value: 'all', labelAr: 'الكل', labelEn: 'All' },
    { value: 'draft', labelAr: 'مسودة', labelEn: 'Draft' },
    { value: 'pending_review', labelAr: 'قيد المراجعة', labelEn: 'Pending Review' },
    { value: 'approved', labelAr: 'معتمد', labelEn: 'Approved' },
    { value: 'rejected', labelAr: 'مرفوض', labelEn: 'Rejected' },
  ];

  const getCategoryLabel = (category: string) => {
    const cat = categories.find(c => c.value === category);
    return cat ? (language === 'ar' ? cat.labelAr : cat.labelEn) : category;
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: 'approved' | 'pending' | 'draft' | 'rejected'; labelAr: string; labelEn: string }> = {
      approved: { variant: 'approved', labelAr: 'معتمد', labelEn: 'Approved' },
      pending_review: { variant: 'pending', labelAr: 'قيد المراجعة', labelEn: 'Pending' },
      draft: { variant: 'draft', labelAr: 'مسودة', labelEn: 'Draft' },
      rejected: { variant: 'rejected', labelAr: 'مرفوض', labelEn: 'Rejected' },
    };
    const config = statusConfig[status] || { variant: 'draft' as const, labelAr: status, labelEn: status };
    return <Badge variant={config.variant}>{language === 'ar' ? config.labelAr : config.labelEn}</Badge>;
  };

  const getCategoryBadge = (category: string) => {
    const categoryConfig: Record<string, { color: string; labelAr: string; labelEn: string }> = {
      policy: { color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', labelAr: 'سياسة', labelEn: 'Policy' },
      procedure: { color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', labelAr: 'إجراء', labelEn: 'Procedure' },
      work_instruction: { color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400', labelAr: 'تعليمات', labelEn: 'Instruction' },
      form: { color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', labelAr: 'نموذج', labelEn: 'Form' },
      manual: { color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400', labelAr: 'دليل', labelEn: 'Manual' },
    };
    const config = categoryConfig[category] || { color: 'bg-gray-100 text-gray-700', labelAr: category, labelEn: category };
    return (
      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${config.color}`}>
        {language === 'ar' ? config.labelAr : config.labelEn}
      </span>
    );
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch =
      doc.titleAr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.titleEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.number.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || doc.category === selectedCategory;
    const matchesStatus = selectedStatus === 'all' || doc.status === selectedStatus;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--foreground)]">
              {t('documents.title')}
            </h1>
            <p className="mt-1 text-[var(--foreground-secondary)]">
              {language === 'ar' ? 'إدارة وتتبع جميع مستندات الجودة' : 'Manage and track all quality documents'}
            </p>
          </div>
          <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowNewModal(true)}>
            {t('documents.newDocument')}
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--primary-light)]">
                <FileText className="h-5 w-5 text-[var(--primary)]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--foreground)]">{documents.length}</p>
                <p className="text-sm text-[var(--foreground-secondary)]">
                  {language === 'ar' ? 'إجمالي المستندات' : 'Total Documents'}
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
                <p className="text-2xl font-bold text-[var(--foreground)]">
                  {documents.filter(d => d.status === 'approved').length}
                </p>
                <p className="text-sm text-[var(--foreground-secondary)]">
                  {language === 'ar' ? 'معتمدة' : 'Approved'}
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--status-warning-bg)]">
                <Clock className="h-5 w-5 text-[var(--status-warning)]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--foreground)]">
                  {documents.filter(d => d.status === 'pending_review').length}
                </p>
                <p className="text-sm text-[var(--foreground-secondary)]">
                  {language === 'ar' ? 'قيد المراجعة' : 'Pending Review'}
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--background-tertiary)]">
                <FolderOpen className="h-5 w-5 text-[var(--foreground-secondary)]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--foreground)]">
                  {documents.filter(d => d.status === 'draft').length}
                </p>
                <p className="text-sm text-[var(--foreground-secondary)]">
                  {language === 'ar' ? 'مسودات' : 'Drafts'}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--foreground-muted)]" />
                <input
                  type="text"
                  placeholder={language === 'ar' ? 'بحث في المستندات...' : 'Search documents...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] py-2 ps-10 pe-4 text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-muted)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-opacity-20"
                />
              </div>

              {/* Category Filter */}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-opacity-20"
              >
                {categories.map(cat => (
                  <option key={cat.value} value={cat.value}>
                    {language === 'ar' ? cat.labelAr : cat.labelEn}
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

        {/* Documents Table */}
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('documents.documentNumber')}</TableHead>
                <TableHead>{t('documents.documentTitle')}</TableHead>
                <TableHead>{t('documents.category')}</TableHead>
                <TableHead>{t('documents.version')}</TableHead>
                <TableHead>{t('common.status')}</TableHead>
                <TableHead>{t('common.department')}</TableHead>
                <TableHead>{t('common.updatedAt')}</TableHead>
                <TableHead className="text-center">{t('common.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDocuments.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell className="font-mono text-sm">{doc.number}</TableCell>
                  <TableCell>
                    <p className="font-medium">{language === 'ar' ? doc.titleAr : doc.titleEn}</p>
                  </TableCell>
                  <TableCell>{getCategoryBadge(doc.category)}</TableCell>
                  <TableCell>{doc.version}</TableCell>
                  <TableCell>{getStatusBadge(doc.status)}</TableCell>
                  <TableCell className="text-[var(--foreground-secondary)]">
                    {language === 'ar' ? doc.departmentAr : doc.departmentEn}
                  </TableCell>
                  <TableCell className="text-[var(--foreground-secondary)]">
                    {new Date(doc.updatedAt).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      <Button variant="ghost" size="icon-sm" title={language === 'ar' ? 'استعراض' : 'Preview'} onClick={() => handlePreview(doc)}>
                        <FileText className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" title={t('common.view')} onClick={() => handleView(doc)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" title={t('common.edit')} onClick={() => handleEdit(doc)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" title={t('common.download')} onClick={() => handleDownload(doc)}>
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        {/* New Document Modal */}
        {showNewModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowNewModal(false)} />
            <div className="relative z-50 w-full max-w-lg rounded-xl bg-[var(--card)] p-6 shadow-xl mx-4">
              <h2 className="text-xl font-semibold text-[var(--foreground)] mb-4">
                {t('documents.newDocument')}
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">
                    {language === 'ar' ? 'عنوان المستند' : 'Document Title'}
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-opacity-20"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">
                    {t('documents.category')}
                  </label>
                  <select className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-opacity-20">
                    {categories.slice(1).map(cat => (
                      <option key={cat.value} value={cat.value}>
                        {language === 'ar' ? cat.labelAr : cat.labelEn}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">
                    {language === 'ar' ? 'الوصف' : 'Description'}
                  </label>
                  <textarea
                    rows={3}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-opacity-20"
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <Button variant="outline" onClick={() => setShowNewModal(false)}>
                  {t('common.cancel')}
                </Button>
                <Button onClick={() => { alert(language === 'ar' ? 'تم إنشاء المستند' : 'Document created'); setShowNewModal(false); }}>
                  {t('common.save')}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* View Document Modal */}
        {showViewModal && selectedDoc && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowViewModal(false)} />
            <div className="relative z-50 w-full max-w-lg rounded-xl bg-[var(--card)] p-6 shadow-xl mx-4">
              <h2 className="text-xl font-semibold text-[var(--foreground)] mb-4">
                {language === 'ar' ? selectedDoc.titleAr : selectedDoc.titleEn}
              </h2>
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b border-[var(--border)]">
                  <span className="text-[var(--foreground-secondary)]">{t('documents.documentNumber')}</span>
                  <span className="font-mono">{selectedDoc.number}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-[var(--border)]">
                  <span className="text-[var(--foreground-secondary)]">{t('documents.category')}</span>
                  {getCategoryBadge(selectedDoc.category)}
                </div>
                <div className="flex justify-between py-2 border-b border-[var(--border)]">
                  <span className="text-[var(--foreground-secondary)]">{t('documents.version')}</span>
                  <span>{selectedDoc.version}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-[var(--border)]">
                  <span className="text-[var(--foreground-secondary)]">{t('common.status')}</span>
                  {getStatusBadge(selectedDoc.status)}
                </div>
                <div className="flex justify-between py-2 border-b border-[var(--border)]">
                  <span className="text-[var(--foreground-secondary)]">{t('common.department')}</span>
                  <span>{language === 'ar' ? selectedDoc.departmentAr : selectedDoc.departmentEn}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-[var(--foreground-secondary)]">{t('common.owner')}</span>
                  <span>{language === 'ar' ? selectedDoc.ownerAr : selectedDoc.ownerEn}</span>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <Button variant="outline" onClick={() => setShowViewModal(false)}>
                  {t('common.close')}
                </Button>
                <Button variant="outline" leftIcon={<FileText className="h-4 w-4" />} onClick={() => { setShowViewModal(false); handlePreview(selectedDoc); }}>
                  {language === 'ar' ? 'استعراض' : 'Preview'}
                </Button>
                <Button leftIcon={<Download className="h-4 w-4" />} onClick={() => handleDownload(selectedDoc)}>
                  {t('common.download')}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Document Preview Modal */}
        {showPreviewModal && selectedDoc && (
          <div className="fixed inset-0 z-50 flex flex-col">
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/80" onClick={() => setShowPreviewModal(false)} />

            {/* Preview Container */}
            <div className="relative z-50 flex h-full flex-col">
              {/* Header Toolbar */}
              <div className="flex items-center justify-between bg-[var(--card)] px-4 py-3 border-b border-[var(--border)]">
                <div className="flex items-center gap-4">
                  <h3 className="font-semibold text-[var(--foreground)]">
                    {language === 'ar' ? selectedDoc.titleAr : selectedDoc.titleEn}
                  </h3>
                  <span className="text-sm text-[var(--foreground-secondary)]">
                    {selectedDoc.number} | v{selectedDoc.version}
                  </span>
                  {getStatusBadge(selectedDoc.status)}
                </div>

                <div className="flex items-center gap-2">
                  {/* Zoom Controls */}
                  <div className="flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2">
                    <Button variant="ghost" size="icon-sm" onClick={handleZoomOut} title={language === 'ar' ? 'تصغير' : 'Zoom Out'}>
                      <ZoomOut className="h-4 w-4" />
                    </Button>
                    <span className="min-w-[3rem] text-center text-sm text-[var(--foreground)]">{previewZoom}%</span>
                    <Button variant="ghost" size="icon-sm" onClick={handleZoomIn} title={language === 'ar' ? 'تكبير' : 'Zoom In'}>
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Print Button */}
                  <Button variant="ghost" size="icon-sm" onClick={handlePrint} title={language === 'ar' ? 'طباعة' : 'Print'}>
                    <Printer className="h-4 w-4" />
                  </Button>

                  {/* Download Button */}
                  <Button variant="ghost" size="icon-sm" onClick={() => handleDownload(selectedDoc)} title={t('common.download')}>
                    <Download className="h-4 w-4" />
                  </Button>

                  {/* Close Button */}
                  <Button variant="ghost" size="icon-sm" onClick={() => setShowPreviewModal(false)} title={t('common.close')}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Document Content */}
              <div className="flex-1 overflow-auto bg-[var(--background-secondary)] p-8">
                <div
                  className="mx-auto max-w-4xl rounded-lg bg-white shadow-lg print:shadow-none"
                  style={{ transform: `scale(${previewZoom / 100})`, transformOrigin: 'top center' }}
                >
                  {/* Document Header */}
                  <div className="border-b border-gray-200 p-6 print:border-black">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500">{language === 'ar' ? 'شركة الكابلات السعودية' : 'Saudi Cable Company'}</p>
                        <p className="text-xs text-gray-400">{language === 'ar' ? 'نظام إدارة الجودة' : 'Quality Management System'}</p>
                      </div>
                      <div className="text-end">
                        <p className="font-mono text-sm text-gray-600">{selectedDoc.number}</p>
                        <p className="text-xs text-gray-400">{language === 'ar' ? 'الإصدار' : 'Version'}: {selectedDoc.version}</p>
                      </div>
                    </div>
                  </div>

                  {/* Document Body */}
                  <div
                    className="prose prose-sm max-w-none p-8 text-gray-800"
                    style={{ direction: language === 'ar' ? 'rtl' : 'ltr' }}
                    dangerouslySetInnerHTML={{
                      __html: language === 'ar' ? selectedDoc.contentAr : selectedDoc.contentEn
                    }}
                  />

                  {/* Document Footer */}
                  <div className="border-t border-gray-200 p-4 print:border-black">
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span>{language === 'ar' ? 'تاريخ السريان' : 'Effective Date'}: {selectedDoc.effectiveDate || '-'}</span>
                      <span>{language === 'ar' ? 'المالك' : 'Owner'}: {language === 'ar' ? selectedDoc.ownerAr : selectedDoc.ownerEn}</span>
                      <span>{language === 'ar' ? selectedDoc.departmentAr : selectedDoc.departmentEn}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
