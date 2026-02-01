'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { Button, Badge } from '@/components/ui';
import { useTranslation } from '@/contexts/LanguageContext';
import {
  ArrowRight,
  ArrowLeft,
  Save,
  Calendar,
  Users,
  Building2,
  FileQuestion,
  ClipboardCheck,
  Info,
  CheckCircle,
  AlertCircle,
  X,
  Search,
  HelpCircle,
  Lightbulb,
  Send,
  Clock,
  Plus,
  Trash2,
  Edit3,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { createAudit, addNotification, getAllUsers } from '@/lib/firestore';

// ===========================================
// صفحة إنشاء مراجعة جديدة
// ===========================================

// Audit types
const auditTypes = [
  { value: 'internal', labelAr: 'داخلي', labelEn: 'Internal', descAr: 'مراجعة داخلية من فريق الجودة', descEn: 'Internal audit by quality team' },
  { value: 'external', labelAr: 'خارجي', labelEn: 'External', descAr: 'مراجعة من جهة خارجية', descEn: 'External audit by third party' },
  { value: 'surveillance', labelAr: 'مراقبة', labelEn: 'Surveillance', descAr: 'مراجعة مراقبة دورية', descEn: 'Periodic surveillance audit' },
  { value: 'certification', labelAr: 'شهادة', labelEn: 'Certification', descAr: 'مراجعة للحصول على شهادة', descEn: 'Certification audit' },
];

// Duration options for audit end date
const durationOptions = [
  { value: 'same_day', days: 0, labelAr: 'نفس اليوم', labelEn: 'Same Day' },
  { value: '1_day', days: 1, labelAr: 'يوم واحد', labelEn: '1 Day' },
  { value: '2_days', days: 2, labelAr: 'يومين', labelEn: '2 Days' },
  { value: '3_days', days: 3, labelAr: 'ثلاثة أيام', labelEn: '3 Days' },
  { value: 'week', days: 7, labelAr: 'أسبوع', labelEn: '1 Week' },
  { value: 'month', days: 30, labelAr: 'شهر', labelEn: '1 Month' },
  { value: 'custom', days: -1, labelAr: 'تاريخ مخصص', labelEn: 'Custom Date' },
];

export default function NewAuditPage() {
  const router = useRouter();
  const { t, language } = useTranslation();
  const { currentUser, departments: allDepartments, sections: allSections, users: allUsers, dataLoaded } = useAuth();

  // Get auditors from users
  const auditors = useMemo(() => {
    console.log('All users:', allUsers.length, 'Data loaded:', dataLoaded);
    const filtered = allUsers.filter(u => u.canBeAuditor && u.isActive);
    console.log('Auditors:', filtered.length, filtered.map(a => a.fullNameEn));
    return filtered;
  }, [allUsers, dataLoaded]);

  // Current step in the wizard
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 5;

  // Duration selection (default: same day)
  const [selectedDuration, setSelectedDuration] = useState('same_day');

  // Confirmation modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Question interface
  interface AuditQuestion {
    id: string;
    questionAr: string;
    questionEn: string;
    clause: string;
  }

  // Get default lead auditor (current user if they can be auditor)
  const getDefaultLeadAuditorId = () => {
    if (currentUser && auditors.some(a => a.id === currentUser.id)) {
      return currentUser.id;
    }
    return '';
  };

  // Get today's date in YYYY-MM-DD format
  const getTodayDate = () => {
    return new Date().toISOString().split('T')[0];
  };

  // Form data
  const [formData, setFormData] = useState({
    titleAr: '',
    titleEn: '',
    type: 'internal' as 'internal' | 'external' | 'surveillance' | 'certification',
    departmentId: '',
    sectionId: '',
    leadAuditorId: getDefaultLeadAuditorId(),
    auditorIds: [] as string[],
    startDate: getTodayDate(),
    endDate: getTodayDate(), // Same day by default
    scope: '',
    objective: '',
    questions: [] as AuditQuestion[],
  });

  // Question form state
  const [newQuestion, setNewQuestion] = useState({ questionAr: '', questionEn: '', clause: '' });
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);

  // Auditor search
  const [auditorSearch, setAuditorSearch] = useState('');
  const [showAuditorDropdown, setShowAuditorDropdown] = useState(false);

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Helper functions
  const getDepartment = (id: string) => allDepartments.find(d => d.id === id);
  const getSection = (id: string) => allSections.find(s => s.id === id);
  const getUser = (id: string) => allUsers.find(u => u.id === id);
  const getSectionsByDepartment = (deptId: string) => allSections.filter(s => s.departmentId === deptId && s.isActive);

  // Filtered auditors for search
  const filteredAuditors = useMemo(() => {
    if (!auditorSearch) return auditors;
    const search = auditorSearch.toLowerCase();
    return auditors.filter(a =>
      a.fullNameAr.toLowerCase().includes(search) ||
      a.fullNameEn.toLowerCase().includes(search)
    );
  }, [auditorSearch]);

  // Add auditor to team
  const addAuditorToTeam = (auditorId: string) => {
    if (!formData.auditorIds.includes(auditorId) && auditorId !== formData.leadAuditorId) {
      setFormData({ ...formData, auditorIds: [...formData.auditorIds, auditorId] });
    }
    setAuditorSearch('');
    setShowAuditorDropdown(false);
  };

  // Remove auditor from team
  const removeAuditorFromTeam = (auditorId: string) => {
    setFormData({ ...formData, auditorIds: formData.auditorIds.filter(id => id !== auditorId) });
  };

  // Add question
  const addQuestion = () => {
    if (!newQuestion.questionAr.trim() && !newQuestion.questionEn.trim()) return;

    if (editingQuestionId) {
      // Update existing question
      setFormData({
        ...formData,
        questions: formData.questions.map(q =>
          q.id === editingQuestionId
            ? { ...q, ...newQuestion }
            : q
        ),
      });
      setEditingQuestionId(null);
    } else {
      // Add new question
      const question: AuditQuestion = {
        id: `q-${Date.now()}`,
        questionAr: newQuestion.questionAr,
        questionEn: newQuestion.questionEn,
        clause: newQuestion.clause,
      };
      setFormData({ ...formData, questions: [...formData.questions, question] });
    }
    setNewQuestion({ questionAr: '', questionEn: '', clause: '' });
  };

  // Edit question
  const editQuestion = (question: AuditQuestion) => {
    setNewQuestion({
      questionAr: question.questionAr,
      questionEn: question.questionEn,
      clause: question.clause,
    });
    setEditingQuestionId(question.id);
  };

  // Remove question
  const removeQuestion = (questionId: string) => {
    setFormData({
      ...formData,
      questions: formData.questions.filter(q => q.id !== questionId),
    });
    if (editingQuestionId === questionId) {
      setEditingQuestionId(null);
      setNewQuestion({ questionAr: '', questionEn: '', clause: '' });
    }
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingQuestionId(null);
    setNewQuestion({ questionAr: '', questionEn: '', clause: '' });
  };

  // Calculate end date based on duration
  const calculateEndDate = (startDate: string, duration: string): string => {
    if (!startDate || duration === 'custom') return formData.endDate;
    const option = durationOptions.find(d => d.value === duration);
    if (!option || option.days === -1) return formData.endDate;

    const start = new Date(startDate);
    start.setDate(start.getDate() + option.days);
    return start.toISOString().split('T')[0];
  };

  // Handle duration change
  const handleDurationChange = (duration: string) => {
    setSelectedDuration(duration);
    if (duration !== 'custom' && formData.startDate) {
      const endDate = calculateEndDate(formData.startDate, duration);
      setFormData({ ...formData, endDate });
    }
  };

  // Handle start date change (auto-update end date)
  const handleStartDateChange = (startDate: string) => {
    const endDate = selectedDuration !== 'custom' ? calculateEndDate(startDate, selectedDuration) : formData.endDate;
    setFormData({ ...formData, startDate, endDate });
  };

  // Check if current user is quality manager
  const isQualityManager = currentUser?.role === 'quality_manager';

  // Validate current step
  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    switch (step) {
      case 1: // Basic info
        if (!formData.titleAr.trim()) {
          newErrors.titleAr = language === 'ar' ? 'عنوان المراجعة مطلوب' : 'Audit title is required';
        }
        if (!formData.titleEn.trim()) {
          newErrors.titleEn = language === 'ar' ? 'العنوان بالإنجليزية مطلوب' : 'English title is required';
        }
        break;
      case 2: // Department & Team
        if (!formData.departmentId) {
          newErrors.departmentId = language === 'ar' ? 'الإدارة مطلوبة' : 'Department is required';
        }
        if (!formData.leadAuditorId) {
          newErrors.leadAuditorId = language === 'ar' ? 'رئيس فريق المراجعة مطلوب' : 'Lead auditor is required';
        }
        break;
      case 3: // Schedule
        if (!formData.startDate) {
          newErrors.startDate = language === 'ar' ? 'تاريخ البدء مطلوب' : 'Start date is required';
        }
        break;
      case 5: // Questions
        if (formData.questions.length === 0) {
          newErrors.questions = language === 'ar' ? 'يجب إضافة سؤال واحد على الأقل' : 'At least one question is required';
        }
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle next step
  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, totalSteps));
    }
  };

  // Handle previous step
  const handlePrev = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  // Handle showing confirmation modal
  const handleShowConfirmation = () => {
    if (!validateStep(currentStep)) return;
    setShowConfirmModal(true);
  };

  // Handle save
  const handleSave = (continueToDetails: boolean = false) => {
    if (!validateStep(currentStep)) return;

    // Determine initial status - quality manager doesn't need approval for their own audits
    const initialStatus = isQualityManager ? 'planning' : 'pending_approval';

    // Create audit object with questions formatted for audit detail page
    const questionsFormatted = formData.questions.map(q => ({
      ...q,
      status: 'pending' as const,
      answer: '',
      notes: '',
    }));

    const audit = {
      id: `${Date.now()}`,
      number: `AUD-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`,
      titleAr: formData.titleAr,
      titleEn: formData.titleEn,
      type: formData.type,
      departmentId: formData.departmentId,
      sectionId: formData.sectionId || undefined,
      leadAuditorId: formData.leadAuditorId,
      scope: formData.scope,
      objective: formData.objective,
      status: initialStatus,
      currentStage: 0,
      auditorIds: [formData.leadAuditorId, ...formData.auditorIds.filter(id => id !== formData.leadAuditorId)],
      startDate: formData.startDate || new Date().toISOString().split('T')[0],
      endDate: formData.endDate,
      questions: questionsFormatted,
      findings: [],
      createdAt: new Date().toISOString(),
      createdBy: currentUser?.id,
      // Add notification for quality manager if not self-created
      needsApproval: !isQualityManager,
      // Activity log - سجل النشاطات
      activityLog: [{
        id: `activity-${Date.now()}`,
        type: 'audit_created',
        userId: currentUser?.id || '',
        timestamp: new Date().toISOString(),
        details: {
          description: `تم إنشاء المراجعة "${formData.titleAr}"`,
        },
      }],
    };

    // Save to Firestore
    const auditId = await createAudit({
      titleAr: audit.titleAr,
      titleEn: audit.titleEn,
      type: audit.type,
      status: initialStatus as any,
      departmentId: audit.departmentId,
      sectionId: audit.sectionId,
      leadAuditorId: audit.leadAuditorId,
      teamMemberIds: audit.auditorIds,
      startDate: audit.startDate,
      endDate: audit.endDate,
      objectives: audit.objective,
      scope: audit.scope,
      criteria: '',
      findings: [],
      createdBy: currentUser?.id || '',
    });

    if (!auditId) {
      console.error('Failed to create audit');
      return;
    }

    // Update the local audit id
    audit.id = auditId;

    // Add notification for quality manager if not self-created
    if (!isQualityManager) {
      // Find all quality managers to notify
      const allUsersData = await getAllUsers();
      const qualityManagers = allUsersData.filter(u => u.role === 'quality_manager' && u.isActive);

      for (const qm of qualityManagers) {
        await addNotification({
          type: 'audit_approval_request',
          title: language === 'ar' ? 'طلب موافقة على مراجعة جديدة' : 'New Audit Approval Request',
          message: language === 'ar'
            ? `طلب موافقة على مراجعة: ${formData.titleAr}`
            : `Approval request for audit: ${formData.titleEn}`,
          recipientId: qm.id,
          senderId: currentUser?.id,
          auditId: auditId,
        });
      }
    }

    // Add notifications for team members (excluding the creator)
    const teamMemberIds = formData.auditorIds.filter(id => id !== currentUser?.id);

    // Also notify lead auditor if they're not the creator
    if (formData.leadAuditorId !== currentUser?.id && !teamMemberIds.includes(formData.leadAuditorId)) {
      teamMemberIds.push(formData.leadAuditorId);
    }

    for (const memberId of teamMemberIds) {
      const member = getUser(memberId);
      if (member) {
        await addNotification({
          type: 'audit_team_assignment',
          title: language === 'ar' ? 'تم إضافتك لفريق مراجعة' : 'Added to Audit Team',
          message: language === 'ar'
            ? `تم إضافتك كعضو في فريق المراجعة: ${formData.titleAr}`
            : `You have been added as a team member in audit: ${formData.titleEn}`,
          recipientId: memberId,
          senderId: currentUser?.id,
          auditId: auditId,
        });
      }
    }

    setShowConfirmModal(false);

    if (continueToDetails) {
      router.push(`/audits/${audit.id}`);
    } else {
      router.push('/audits');
    }
  };

  // Step instructions
  const stepInstructions = {
    1: {
      titleAr: 'المعلومات الأساسية',
      titleEn: 'Basic Information',
      instructionAr: 'قم بإدخال المعلومات الأساسية للمراجعة. اختر نوع المراجعة المناسب وأدخل عنواناً واضحاً يصف الغرض من المراجعة.',
      instructionEn: 'Enter the basic audit information. Choose the appropriate audit type and enter a clear title that describes the purpose of the audit.',
      tips: [
        { ar: 'اختر عنواناً يوضح نطاق المراجعة', en: 'Choose a title that clarifies the audit scope' },
        { ar: 'المراجعة الداخلية هي الأكثر شيوعاً', en: 'Internal audit is the most common type' },
      ],
    },
    2: {
      titleAr: 'الإدارة وفريق المراجعة',
      titleEn: 'Department & Audit Team',
      instructionAr: 'حدد الإدارة أو القسم الذي سيتم مراجعته، ثم اختر فريق المراجعة. يجب اختيار رئيس فريق المراجعة ويمكن إضافة أعضاء آخرين.',
      instructionEn: 'Select the department or section to be audited, then choose the audit team. A lead auditor must be selected, and additional team members can be added.',
      tips: [
        { ar: 'رئيس الفريق هو المسؤول عن إدارة المراجعة', en: 'The lead auditor is responsible for managing the audit' },
        { ar: 'يمكنك البحث عن المراجعين بالاسم', en: 'You can search for auditors by name' },
      ],
    },
    3: {
      titleAr: 'الجدول الزمني',
      titleEn: 'Schedule',
      instructionAr: 'حدد تاريخ بدء وانتهاء المراجعة. تأكد من إعطاء وقت كافٍ لإكمال جميع مراحل المراجعة.',
      instructionEn: 'Set the audit start and end dates. Make sure to allow enough time to complete all audit phases.',
      tips: [
        { ar: 'التدقيق يستغرق عادةً يوم واحد', en: 'Audit typically takes one day' },
        { ar: 'الإجراءات التصحيحية يحدد المدقق موعداً لها وقد يُمدد عند الحاجة', en: 'Corrective actions have a deadline set by the auditor that can be extended if needed' },
      ],
    },
    4: {
      titleAr: 'النطاق والهدف',
      titleEn: 'Scope & Objective',
      instructionAr: 'حدد نطاق المراجعة (ما الذي سيتم مراجعته) وهدفها (ماذا نريد تحقيقه). هذه الخطوة اختيارية لكنها مهمة للتوثيق.',
      instructionEn: 'Define the audit scope (what will be reviewed) and objective (what we want to achieve). This step is optional but important for documentation.',
      tips: [
        { ar: 'حدد العمليات والوثائق المراد مراجعتها', en: 'Specify processes and documents to review' },
        { ar: 'الهدف يساعد في تركيز جهود المراجعة', en: 'The objective helps focus audit efforts' },
      ],
    },
    5: {
      titleAr: 'أسئلة المراجعة',
      titleEn: 'Audit Questions',
      instructionAr: 'أضف الأسئلة التي ستُطرح أثناء المراجعة. يجب إضافة سؤال واحد على الأقل. يمكنك ربط كل سؤال ببند من معيار ISO.',
      instructionEn: 'Add the questions that will be asked during the audit. At least one question is required. You can link each question to an ISO clause.',
      tips: [
        { ar: 'أضف أسئلة محددة وواضحة', en: 'Add specific and clear questions' },
        { ar: 'اربط الأسئلة ببنود ISO للتوثيق الأفضل', en: 'Link questions to ISO clauses for better documentation' },
        { ar: 'يمكنك تعديل أو حذف الأسئلة قبل الإرسال', en: 'You can edit or delete questions before submitting' },
      ],
    },
  };

  const currentStepInfo = stepInstructions[currentStep as keyof typeof stepInstructions];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              {language === 'ar' ? 'إنشاء مراجعة جديدة' : 'Create New Audit'}
            </h1>
            <p className="text-[var(--foreground-secondary)] mt-1">
              {language === 'ar'
                ? 'اتبع الخطوات التالية لإنشاء مراجعة جديدة'
                : 'Follow the steps below to create a new audit'}
            </p>
          </div>
          <Button variant="outline" onClick={() => router.push('/audits')}>
            {language === 'ar' ? 'العودة للقائمة' : 'Back to List'}
          </Button>
        </div>

        {/* Progress Steps */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-8">
              {[1, 2, 3, 4, 5].map((step) => (
                <div key={step} className="flex items-center flex-1">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full text-sm font-semibold transition-colors ${
                    step < currentStep
                      ? 'bg-green-500 text-white'
                      : step === currentStep
                        ? 'bg-[var(--primary)] text-white'
                        : 'bg-[var(--background-secondary)] text-[var(--foreground-secondary)]'
                  }`}>
                    {step < currentStep ? <CheckCircle className="h-5 w-5" /> : step}
                  </div>
                  <div className={`mx-3 flex-1 ${step < 5 ? 'block' : 'hidden'}`}>
                    <div className={`h-1 rounded-full transition-colors ${
                      step < currentStep ? 'bg-green-500' : 'bg-[var(--background-secondary)]'
                    }`} />
                  </div>
                </div>
              ))}
            </div>

            {/* Step Title & Instructions */}
            <div className="bg-[var(--background-secondary)] rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 p-2 rounded-full bg-[var(--primary)]/10">
                  <Info className="h-5 w-5 text-[var(--primary)]" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-2">
                    {language === 'ar'
                      ? `الخطوة ${currentStep}: ${currentStepInfo.titleAr}`
                      : `Step ${currentStep}: ${currentStepInfo.titleEn}`}
                  </h3>
                  <p className="text-[var(--foreground-secondary)] text-sm">
                    {language === 'ar' ? currentStepInfo.instructionAr : currentStepInfo.instructionEn}
                  </p>
                </div>
              </div>

              {/* Tips */}
              <div className="mt-4 flex flex-wrap gap-2">
                {currentStepInfo.tips.map((tip, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 px-3 py-1.5 rounded-full">
                    <Lightbulb className="h-3.5 w-3.5" />
                    <span>{language === 'ar' ? tip.ar : tip.en}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Form Content */}
        <Card>
          <CardContent className="p-6">
            {/* Step 1: Basic Info */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      {language === 'ar' ? 'عنوان المراجعة (عربي) *' : 'Audit Title (Arabic) *'}
                    </label>
                    <input
                      type="text"
                      value={formData.titleAr}
                      onChange={(e) => setFormData({ ...formData, titleAr: e.target.value })}
                      placeholder={language === 'ar' ? 'مثال: مراجعة قسم الإنتاج' : 'Example: Production Department Audit'}
                      className={`w-full rounded-lg border px-4 py-3 text-sm ${
                        errors.titleAr ? 'border-red-500' : 'border-[var(--border)]'
                      } bg-[var(--background)]`}
                    />
                    {errors.titleAr && (
                      <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.titleAr}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      {language === 'ar' ? 'عنوان المراجعة (إنجليزي) *' : 'Audit Title (English) *'}
                    </label>
                    <input
                      type="text"
                      value={formData.titleEn}
                      onChange={(e) => setFormData({ ...formData, titleEn: e.target.value })}
                      placeholder={language === 'ar' ? 'مثال: Production Department Audit' : 'Example: Production Department Audit'}
                      className={`w-full rounded-lg border px-4 py-3 text-sm ${
                        errors.titleEn ? 'border-red-500' : 'border-[var(--border)]'
                      } bg-[var(--background)]`}
                    />
                    {errors.titleEn && (
                      <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.titleEn}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-3">
                    {language === 'ar' ? 'نوع المراجعة *' : 'Audit Type *'}
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {auditTypes.map((type) => (
                      <div
                        key={type.value}
                        onClick={() => setFormData({ ...formData, type: type.value as typeof formData.type })}
                        className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                          formData.type === type.value
                            ? 'border-[var(--primary)] bg-[var(--primary)]/5'
                            : 'border-[var(--border)] hover:border-[var(--primary)]/50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            formData.type === type.value
                              ? 'border-[var(--primary)]'
                              : 'border-[var(--border)]'
                          }`}>
                            {formData.type === type.value && (
                              <div className="w-2 h-2 rounded-full bg-[var(--primary)]" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium">{language === 'ar' ? type.labelAr : type.labelEn}</p>
                            <p className="text-xs text-[var(--foreground-secondary)]">
                              {language === 'ar' ? type.descAr : type.descEn}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Department & Team */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      {language === 'ar' ? 'الإدارة *' : 'Department *'}
                    </label>
                    <select
                      value={formData.departmentId}
                      onChange={(e) => setFormData({ ...formData, departmentId: e.target.value, sectionId: '' })}
                      className={`w-full rounded-lg border px-4 py-3 text-sm ${
                        errors.departmentId ? 'border-red-500' : 'border-[var(--border)]'
                      } bg-[var(--background)]`}
                    >
                      <option value="">{language === 'ar' ? '-- اختر الإدارة --' : '-- Select Department --'}</option>
                      {allDepartments.filter(d => d.isActive).map(dept => (
                        <option key={dept.id} value={dept.id}>
                          {language === 'ar' ? dept.nameAr : dept.nameEn}
                        </option>
                      ))}
                    </select>
                    {errors.departmentId && (
                      <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.departmentId}
                      </p>
                    )}
                  </div>

                  {formData.departmentId && (
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        {language === 'ar' ? 'القسم (اختياري)' : 'Section (Optional)'}
                      </label>
                      <select
                        value={formData.sectionId}
                        onChange={(e) => setFormData({ ...formData, sectionId: e.target.value })}
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm"
                      >
                        <option value="">{language === 'ar' ? '-- كل الأقسام --' : '-- All Sections --'}</option>
                        {getSectionsByDepartment(formData.departmentId).map(section => (
                          <option key={section.id} value={section.id}>
                            {language === 'ar' ? section.nameAr : section.nameEn}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="border-t border-[var(--border)] pt-6">
                  <h4 className="font-medium mb-4 flex items-center gap-2">
                    <Users className="h-5 w-5 text-[var(--primary)]" />
                    {language === 'ar' ? 'فريق المراجعة' : 'Audit Team'}
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        {language === 'ar' ? 'رئيس فريق المراجعة *' : 'Lead Auditor *'}
                      </label>
                      <select
                        value={formData.leadAuditorId}
                        onChange={(e) => setFormData({ ...formData, leadAuditorId: e.target.value })}
                        className={`w-full rounded-lg border px-4 py-3 text-sm ${
                          errors.leadAuditorId ? 'border-red-500' : 'border-[var(--border)]'
                        } bg-[var(--background)]`}
                      >
                        <option value="">{language === 'ar' ? '-- اختر رئيس الفريق --' : '-- Select Lead Auditor --'}</option>
                        {auditors.map(auditor => (
                          <option key={auditor.id} value={auditor.id}>
                            {language === 'ar' ? auditor.fullNameAr : auditor.fullNameEn} - {language === 'ar' ? auditor.jobTitleAr : auditor.jobTitleEn}
                          </option>
                        ))}
                      </select>
                      {errors.leadAuditorId && (
                        <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {errors.leadAuditorId}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">
                        {language === 'ar' ? 'أعضاء الفريق' : 'Team Members'}
                      </label>
                      <div className="relative">
                        <div className="flex items-center gap-2">
                          <Search className="absolute right-3 h-4 w-4 text-[var(--foreground-secondary)]" />
                          <input
                            type="text"
                            value={auditorSearch}
                            onChange={(e) => {
                              setAuditorSearch(e.target.value);
                              setShowAuditorDropdown(true);
                            }}
                            onFocus={() => setShowAuditorDropdown(true)}
                            placeholder={language === 'ar' ? 'ابحث عن مراجع...' : 'Search for auditor...'}
                            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] pl-4 pr-10 py-3 text-sm"
                          />
                        </div>

                        {showAuditorDropdown && (
                          <div className="absolute z-10 w-full mt-1 bg-[var(--background)] border border-[var(--border)] rounded-lg shadow-lg max-h-48 overflow-auto">
                            {filteredAuditors
                              .filter(a => a.id !== formData.leadAuditorId && !formData.auditorIds.includes(a.id))
                              .length === 0 ? (
                              <div className="px-4 py-3 text-sm text-[var(--foreground-secondary)]">
                                {language === 'ar' ? 'لا يوجد مراجعين متاحين' : 'No auditors available'}
                              </div>
                            ) : (
                              filteredAuditors
                                .filter(a => a.id !== formData.leadAuditorId && !formData.auditorIds.includes(a.id))
                                .map(auditor => (
                                  <button
                                    key={auditor.id}
                                    type="button"
                                    onClick={() => addAuditorToTeam(auditor.id)}
                                    className="w-full px-4 py-2 text-right hover:bg-[var(--background-secondary)] text-sm"
                                  >
                                    {language === 'ar' ? auditor.fullNameAr : auditor.fullNameEn}
                                    <span className="text-xs text-[var(--foreground-secondary)] mx-2">-</span>
                                    <span className="text-xs text-[var(--foreground-secondary)]">
                                      {language === 'ar' ? auditor.jobTitleAr : auditor.jobTitleEn}
                                    </span>
                                  </button>
                                ))
                            )}
                          </div>
                        )}
                      </div>

                      {/* Selected team members */}
                      {formData.auditorIds.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          {formData.auditorIds.map(id => {
                            const auditor = getUser(id);
                            return auditor ? (
                              <span
                                key={id}
                                className="inline-flex items-center gap-1 px-3 py-1 bg-[var(--primary)]/10 text-[var(--primary)] rounded-full text-sm"
                              >
                                {language === 'ar' ? auditor.fullNameAr : auditor.fullNameEn}
                                <button
                                  type="button"
                                  onClick={() => removeAuditorFromTeam(id)}
                                  className="hover:text-red-500"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </span>
                            ) : null;
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Schedule */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      {language === 'ar' ? 'تاريخ البدء *' : 'Start Date *'}
                    </label>
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => handleStartDateChange(e.target.value)}
                      className={`w-full rounded-lg border px-4 py-3 text-sm ${
                        errors.startDate ? 'border-red-500' : 'border-[var(--border)]'
                      } bg-[var(--background)]`}
                    />
                    {errors.startDate && (
                      <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.startDate}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                      <Clock className="h-4 w-4 text-[var(--primary)]" />
                      {language === 'ar' ? 'مدة المراجعة' : 'Audit Duration'}
                    </label>
                    <select
                      value={selectedDuration}
                      onChange={(e) => handleDurationChange(e.target.value)}
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm"
                    >
                      {durationOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {language === 'ar' ? option.labelAr : option.labelEn}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Custom end date (only shown when custom is selected) */}
                {selectedDuration === 'custom' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-start-2">
                      <label className="block text-sm font-medium mb-2">
                        {language === 'ar' ? 'تاريخ الانتهاء المخصص' : 'Custom End Date'}
                      </label>
                      <input
                        type="date"
                        value={formData.endDate}
                        onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                        min={formData.startDate}
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm"
                      />
                    </div>
                  </div>
                )}

                {/* Calendar Preview */}
                {formData.startDate && (
                  <div className="bg-[var(--background-secondary)] rounded-lg p-4">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-[var(--primary)]" />
                      <span className="font-medium">
                        {language === 'ar' ? 'مدة المراجعة:' : 'Audit Duration:'}
                      </span>
                      <span className="text-[var(--foreground-secondary)]">
                        {formData.endDate
                          ? `${Math.ceil((new Date(formData.endDate).getTime() - new Date(formData.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1} ${language === 'ar' ? 'يوم' : 'days'}`
                          : language === 'ar' ? 'غير محدد' : 'Not set'}
                      </span>
                    </div>
                    {formData.endDate && (
                      <div className="mt-2 text-xs text-[var(--foreground-secondary)]">
                        {language === 'ar'
                          ? `من ${new Date(formData.startDate).toLocaleDateString('ar-SA')} إلى ${new Date(formData.endDate).toLocaleDateString('ar-SA')}`
                          : `From ${new Date(formData.startDate).toLocaleDateString('en-US')} to ${new Date(formData.endDate).toLocaleDateString('en-US')}`}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Step 4: Scope & Objective */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    {language === 'ar' ? 'نطاق المراجعة' : 'Audit Scope'}
                  </label>
                  <textarea
                    rows={4}
                    value={formData.scope}
                    onChange={(e) => setFormData({ ...formData, scope: e.target.value })}
                    placeholder={language === 'ar'
                      ? 'حدد العمليات والإجراءات والوثائق التي سيتم مراجعتها...'
                      : 'Specify the processes, procedures, and documents to be reviewed...'}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    {language === 'ar' ? 'هدف المراجعة' : 'Audit Objective'}
                  </label>
                  <textarea
                    rows={4}
                    value={formData.objective}
                    onChange={(e) => setFormData({ ...formData, objective: e.target.value })}
                    placeholder={language === 'ar'
                      ? 'حدد الهدف من هذه المراجعة وما تريد تحقيقه...'
                      : 'Specify the audit objective and what you want to achieve...'}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm"
                  />
                </div>

              </div>
            )}

            {/* Step 5: Questions */}
            {currentStep === 5 && (
              <div className="space-y-6">
                {/* Question Form */}
                <div className="bg-[var(--background-secondary)] rounded-lg p-4 border border-[var(--border)]">
                  <h4 className="font-medium mb-4 flex items-center gap-2">
                    <FileQuestion className="h-5 w-5 text-[var(--primary)]" />
                    {editingQuestionId
                      ? (language === 'ar' ? 'تعديل السؤال' : 'Edit Question')
                      : (language === 'ar' ? 'إضافة سؤال جديد' : 'Add New Question')}
                  </h4>

                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          {language === 'ar' ? 'السؤال (عربي)' : 'Question (Arabic)'}
                        </label>
                        <input
                          type="text"
                          value={newQuestion.questionAr}
                          onChange={(e) => setNewQuestion({ ...newQuestion, questionAr: e.target.value })}
                          placeholder={language === 'ar' ? 'مثال: هل يتم توثيق العمليات؟' : 'Example: Are processes documented?'}
                          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          {language === 'ar' ? 'السؤال (إنجليزي)' : 'Question (English)'}
                        </label>
                        <input
                          type="text"
                          value={newQuestion.questionEn}
                          onChange={(e) => setNewQuestion({ ...newQuestion, questionEn: e.target.value })}
                          placeholder={language === 'ar' ? 'Example: Are processes documented?' : 'Example: Are processes documented?'}
                          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          {language === 'ar' ? 'بند ISO (اختياري)' : 'ISO Clause (Optional)'}
                        </label>
                        <input
                          type="text"
                          value={newQuestion.clause}
                          onChange={(e) => setNewQuestion({ ...newQuestion, clause: e.target.value })}
                          placeholder={language === 'ar' ? 'مثال: 8.5.1' : 'Example: 8.5.1'}
                          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm"
                        />
                      </div>
                      <div className="flex gap-2">
                        {editingQuestionId && (
                          <Button
                            variant="outline"
                            onClick={cancelEditing}
                            className="flex-1"
                          >
                            {language === 'ar' ? 'إلغاء' : 'Cancel'}
                          </Button>
                        )}
                        <Button
                          onClick={addQuestion}
                          disabled={!newQuestion.questionAr.trim() && !newQuestion.questionEn.trim()}
                          className="flex-1"
                        >
                          <Plus className="h-4 w-4 mx-1" />
                          {editingQuestionId
                            ? (language === 'ar' ? 'تحديث' : 'Update')
                            : (language === 'ar' ? 'إضافة' : 'Add')}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Error message */}
                {errors.questions && (
                  <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-lg flex items-center gap-2 text-sm">
                    <AlertCircle className="h-4 w-4" />
                    {errors.questions}
                  </div>
                )}

                {/* Questions List */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-medium flex items-center gap-2">
                      <ClipboardCheck className="h-5 w-5 text-[var(--primary)]" />
                      {language === 'ar' ? 'قائمة الأسئلة' : 'Questions List'}
                      <span className="text-sm font-normal text-[var(--foreground-secondary)]">
                        ({formData.questions.length} {language === 'ar' ? 'سؤال' : 'questions'})
                      </span>
                    </h4>
                  </div>

                  {formData.questions.length > 0 ? (
                    <div className="space-y-3">
                      {formData.questions.map((question, index) => (
                        <div
                          key={question.id}
                          className="flex items-start justify-between p-4 rounded-lg border border-[var(--border)] bg-[var(--background)] hover:border-[var(--primary)]/30 transition-colors"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] text-xs font-medium">
                                {index + 1}
                              </span>
                              {question.clause && (
                                <span className="text-xs px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                                  {question.clause}
                                </span>
                              )}
                            </div>
                            <p className="text-sm font-medium">
                              {language === 'ar' ? question.questionAr : question.questionEn}
                            </p>
                            {language === 'ar' && question.questionEn && (
                              <p className="text-xs text-[var(--foreground-secondary)] mt-1">{question.questionEn}</p>
                            )}
                            {language === 'en' && question.questionAr && (
                              <p className="text-xs text-[var(--foreground-secondary)] mt-1">{question.questionAr}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mr-4">
                            <button
                              type="button"
                              onClick={() => editQuestion(question)}
                              className="p-2 rounded-lg hover:bg-[var(--background-secondary)] text-[var(--foreground-secondary)] hover:text-[var(--primary)]"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeQuestion(question.id)}
                              className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-[var(--foreground-secondary)] hover:text-red-500"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-[var(--background-secondary)] rounded-lg">
                      <FileQuestion className="h-12 w-12 text-[var(--foreground-secondary)] mx-auto mb-3 opacity-50" />
                      <p className="text-[var(--foreground-secondary)]">
                        {language === 'ar' ? 'لم يتم إضافة أسئلة بعد' : 'No questions added yet'}
                      </p>
                      <p className="text-xs text-[var(--foreground-secondary)] mt-1">
                        {language === 'ar' ? 'استخدم النموذج أعلاه لإضافة أسئلة المراجعة' : 'Use the form above to add audit questions'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Summary */}
                {formData.questions.length > 0 && (
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
                    <h4 className="font-medium text-green-800 dark:text-green-200 mb-3 flex items-center gap-2">
                      <CheckCircle className="h-5 w-5" />
                      {language === 'ar' ? 'ملخص المراجعة' : 'Audit Summary'}
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-[var(--foreground-secondary)]">{language === 'ar' ? 'العنوان:' : 'Title:'}</span>
                        <p className="font-medium">{language === 'ar' ? formData.titleAr : formData.titleEn}</p>
                      </div>
                      <div>
                        <span className="text-[var(--foreground-secondary)]">{language === 'ar' ? 'الإدارة:' : 'Department:'}</span>
                        <p className="font-medium">
                          {getDepartment(formData.departmentId)?.[language === 'ar' ? 'nameAr' : 'nameEn'] || '-'}
                        </p>
                      </div>
                      <div>
                        <span className="text-[var(--foreground-secondary)]">{language === 'ar' ? 'رئيس الفريق:' : 'Lead Auditor:'}</span>
                        <p className="font-medium">
                          {getUser(formData.leadAuditorId)?.[language === 'ar' ? 'fullNameAr' : 'fullNameEn'] || '-'}
                        </p>
                      </div>
                      <div>
                        <span className="text-[var(--foreground-secondary)]">{language === 'ar' ? 'عدد الأسئلة:' : 'Questions:'}</span>
                        <p className="font-medium text-[var(--primary)]">{formData.questions.length}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-[var(--border)]">
              <div>
                {currentStep > 1 && (
                  <Button variant="outline" onClick={handlePrev}>
                    {language === 'ar' ? (
                      <>
                        <ArrowRight className="h-4 w-4 ml-2" />
                        السابق
                      </>
                    ) : (
                      <>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Previous
                      </>
                    )}
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-3">
                {currentStep < totalSteps ? (
                  <Button onClick={handleNext}>
                    {language === 'ar' ? (
                      <>
                        التالي
                        <ArrowLeft className="h-4 w-4 mr-2" />
                      </>
                    ) : (
                      <>
                        Next
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>
                ) : (
                  <Button onClick={handleShowConfirmation}>
                    <Send className="h-4 w-4 mx-2" />
                    {isQualityManager
                      ? (language === 'ar' ? 'إنشاء المراجعة' : 'Create Audit')
                      : (language === 'ar' ? 'إرسال للموافقة' : 'Send for Approval')}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Confirmation Modal */}
        {showConfirmModal && (
          <>
            <div
              className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowConfirmModal(false)}
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="w-full max-w-lg rounded-2xl bg-[var(--card)] p-6 shadow-xl">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--primary)]/10">
                    <Send className="h-6 w-6 text-[var(--primary)]" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-[var(--foreground)]">
                      {isQualityManager
                        ? (language === 'ar' ? 'تأكيد إنشاء المراجعة' : 'Confirm Audit Creation')
                        : (language === 'ar' ? 'إرسال للموافقة' : 'Send for Approval')}
                    </h2>
                    <p className="text-sm text-[var(--foreground-secondary)]">
                      {isQualityManager
                        ? (language === 'ar' ? 'سيتم إنشاء المراجعة مباشرة' : 'The audit will be created directly')
                        : (language === 'ar' ? 'سيتم إرسال التخطيط لمدير إدارة الجودة' : 'The plan will be sent to the Quality Manager')}
                    </p>
                  </div>
                </div>

                {/* Summary */}
                <div className="bg-[var(--background-secondary)] rounded-lg p-4 mb-6">
                  <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                    <ClipboardCheck className="h-4 w-4 text-[var(--primary)]" />
                    {language === 'ar' ? 'ملخص المراجعة' : 'Audit Summary'}
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[var(--foreground-secondary)]">{language === 'ar' ? 'العنوان:' : 'Title:'}</span>
                      <span className="font-medium">{language === 'ar' ? formData.titleAr : formData.titleEn}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--foreground-secondary)]">{language === 'ar' ? 'النوع:' : 'Type:'}</span>
                      <span className="font-medium">
                        {auditTypes.find(t => t.value === formData.type)?.[language === 'ar' ? 'labelAr' : 'labelEn']}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--foreground-secondary)]">{language === 'ar' ? 'الإدارة:' : 'Department:'}</span>
                      <span className="font-medium">
                        {getDepartment(formData.departmentId)?.[language === 'ar' ? 'nameAr' : 'nameEn'] || '-'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--foreground-secondary)]">{language === 'ar' ? 'رئيس الفريق:' : 'Lead Auditor:'}</span>
                      <span className="font-medium">
                        {getUser(formData.leadAuditorId)?.[language === 'ar' ? 'fullNameAr' : 'fullNameEn'] || '-'}
                      </span>
                    </div>
                    {formData.startDate && (
                      <div className="flex justify-between">
                        <span className="text-[var(--foreground-secondary)]">{language === 'ar' ? 'التاريخ:' : 'Date:'}</span>
                        <span className="font-medium">
                          {new Date(formData.startDate).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}
                          {formData.endDate && formData.endDate !== formData.startDate && (
                            <> - {new Date(formData.endDate).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}</>
                          )}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-[var(--foreground-secondary)]">{language === 'ar' ? 'عدد الأسئلة:' : 'Questions:'}</span>
                      <span className="font-medium text-[var(--primary)]">{formData.questions.length}</span>
                    </div>
                  </div>
                </div>

                {/* Info message for non-quality managers */}
                {!isQualityManager && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-6 border border-blue-200 dark:border-blue-800">
                    <div className="flex items-start gap-2">
                      <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                      <div className="text-sm text-blue-800 dark:text-blue-200">
                        <p className="font-medium mb-1">
                          {language === 'ar' ? 'ملاحظة مهمة' : 'Important Note'}
                        </p>
                        <p className="text-blue-700 dark:text-blue-300">
                          {language === 'ar'
                            ? 'سيتم إرسال هذا التخطيط إلى مدير إدارة الجودة للمراجعة والموافقة. ستتمكن من متابعة الحالة من قائمة المراجعات.'
                            : 'This plan will be sent to the Quality Manager for review and approval. You can track the status from the audits list.'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setShowConfirmModal(false)}
                    className="flex-1"
                  >
                    {language === 'ar' ? 'إلغاء' : 'Cancel'}
                  </Button>
                  <Button
                    onClick={() => handleSave(false)}
                    className="flex-1"
                  >
                    <CheckCircle className="h-4 w-4 mx-2" />
                    {isQualityManager
                      ? (language === 'ar' ? 'إنشاء المراجعة' : 'Create Audit')
                      : (language === 'ar' ? 'إرسال للموافقة' : 'Send for Approval')}
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
