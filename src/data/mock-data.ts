import {
  Department,
  Section,
  User,
  UserRole,
} from '@/types';

// ===========================================
// الإدارات
// ===========================================

export const departments: Department[] = [
  {
    id: 'dept-1',
    code: 'HR',
    nameAr: 'الموارد البشرية',
    nameEn: 'Human Resources',
    descriptionAr: 'إدارة شؤون الموظفين والتوظيف والتطوير',
    descriptionEn: 'Personnel affairs, recruitment and development',
    managerId: 'user-2',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: 'dept-2',
    code: 'QA',
    nameAr: 'إدارة الجودة',
    nameEn: 'Quality Assurance',
    descriptionAr: 'ضمان الجودة والمراجعة الداخلية',
    descriptionEn: 'Quality assurance and internal audit',
    managerId: 'user-3',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: 'dept-3',
    code: 'PROD',
    nameAr: 'الإنتاج',
    nameEn: 'Production',
    descriptionAr: 'إدارة عمليات الإنتاج والتصنيع',
    descriptionEn: 'Production and manufacturing operations',
    managerId: 'user-7',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: 'dept-4',
    code: 'FIN',
    nameAr: 'المالية',
    nameEn: 'Finance',
    descriptionAr: 'الشؤون المالية والمحاسبة',
    descriptionEn: 'Financial affairs and accounting',
    managerId: 'user-10',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: 'dept-5',
    code: 'IT',
    nameAr: 'تقنية المعلومات',
    nameEn: 'Information Technology',
    descriptionAr: 'البنية التحتية والأنظمة والدعم الفني',
    descriptionEn: 'Infrastructure, systems and technical support',
    managerId: 'user-13',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: 'dept-6',
    code: 'SALES',
    nameAr: 'المبيعات',
    nameEn: 'Sales',
    descriptionAr: 'المبيعات وخدمة العملاء',
    descriptionEn: 'Sales and customer service',
    managerId: 'user-16',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
];

// ===========================================
// الأقسام
// ===========================================

export const sections: Section[] = [
  // أقسام الموارد البشرية
  {
    id: 'sec-1',
    code: 'HR-REC',
    departmentId: 'dept-1',
    nameAr: 'التوظيف',
    nameEn: 'Recruitment',
    descriptionAr: 'استقطاب وتوظيف الكفاءات',
    descriptionEn: 'Talent acquisition and recruitment',
    headId: 'user-4',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: 'sec-2',
    code: 'HR-TRN',
    departmentId: 'dept-1',
    nameAr: 'التدريب والتطوير',
    nameEn: 'Training & Development',
    descriptionAr: 'تدريب وتطوير الموظفين',
    descriptionEn: 'Employee training and development',
    headId: 'user-5',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },

  // أقسام إدارة الجودة
  {
    id: 'sec-3',
    code: 'QA-AUD',
    departmentId: 'dept-2',
    nameAr: 'المراجعة الداخلية',
    nameEn: 'Internal Audit',
    descriptionAr: 'إجراء المراجعات الداخلية',
    descriptionEn: 'Conducting internal audits',
    headId: 'user-19',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: 'sec-4',
    code: 'QA-DOC',
    departmentId: 'dept-2',
    nameAr: 'إدارة الوثائق',
    nameEn: 'Document Control',
    descriptionAr: 'التحكم في الوثائق والسجلات',
    descriptionEn: 'Document and record control',
    headId: 'user-20',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },

  // أقسام الإنتاج
  {
    id: 'sec-5',
    code: 'PROD-MFG',
    departmentId: 'dept-3',
    nameAr: 'التصنيع',
    nameEn: 'Manufacturing',
    descriptionAr: 'عمليات التصنيع',
    descriptionEn: 'Manufacturing operations',
    headId: 'user-8',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: 'sec-6',
    code: 'PROD-QC',
    departmentId: 'dept-3',
    nameAr: 'مراقبة الجودة',
    nameEn: 'Quality Control',
    descriptionAr: 'فحص ومراقبة جودة المنتجات',
    descriptionEn: 'Product quality inspection and control',
    headId: 'user-9',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },

  // أقسام المالية
  {
    id: 'sec-7',
    code: 'FIN-ACC',
    departmentId: 'dept-4',
    nameAr: 'المحاسبة',
    nameEn: 'Accounting',
    descriptionAr: 'المحاسبة والتقارير المالية',
    descriptionEn: 'Accounting and financial reporting',
    headId: 'user-11',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: 'sec-8',
    code: 'FIN-BUD',
    departmentId: 'dept-4',
    nameAr: 'الميزانية',
    nameEn: 'Budget',
    descriptionAr: 'إعداد ومتابعة الميزانية',
    descriptionEn: 'Budget preparation and monitoring',
    headId: 'user-12',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },

  // أقسام تقنية المعلومات
  {
    id: 'sec-9',
    code: 'IT-INF',
    departmentId: 'dept-5',
    nameAr: 'البنية التحتية',
    nameEn: 'Infrastructure',
    descriptionAr: 'الشبكات والخوادم',
    descriptionEn: 'Networks and servers',
    headId: 'user-14',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: 'sec-10',
    code: 'IT-DEV',
    departmentId: 'dept-5',
    nameAr: 'التطوير',
    nameEn: 'Development',
    descriptionAr: 'تطوير التطبيقات والأنظمة',
    descriptionEn: 'Application and system development',
    headId: 'user-15',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },

  // أقسام المبيعات
  {
    id: 'sec-11',
    code: 'SALES-DOM',
    departmentId: 'dept-6',
    nameAr: 'المبيعات المحلية',
    nameEn: 'Domestic Sales',
    descriptionAr: 'المبيعات داخل المملكة',
    descriptionEn: 'Sales within the Kingdom',
    headId: 'user-17',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: 'sec-12',
    code: 'SALES-INT',
    departmentId: 'dept-6',
    nameAr: 'المبيعات الدولية',
    nameEn: 'International Sales',
    descriptionAr: 'المبيعات خارج المملكة',
    descriptionEn: 'Sales outside the Kingdom',
    headId: 'user-18',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
];

// ===========================================
// المستخدمين
// ===========================================

export const users: User[] = [
  // مدير النظام
  {
    id: 'user-1',
    employeeNumber: 'EMP-0001',
    email: 'admin@saudicable.com',
    fullNameAr: 'عبدالإله سجيني',
    fullNameEn: 'Abdulelah Sejini',
    role: 'system_admin',
    departmentId: 'dept-5',
    sectionId: 'sec-9',
    canBeAuditor: false,
    auditableDepartmentIds: [],
    auditableSectionIds: [],
    phone: '+966501234567',
    jobTitleAr: 'مدير النظام',
    jobTitleEn: 'System Administrator',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },

  // مدير الموارد البشرية
  {
    id: 'user-2',
    employeeNumber: 'EMP-0002',
    email: 'hr.manager@saudicable.com',
    fullNameAr: 'سارة عبدالله العمري',
    fullNameEn: 'Sarah Abdullah Al-Omari',
    role: 'department_manager',
    departmentId: 'dept-1',
    canBeAuditor: false,
    auditableDepartmentIds: [],
    auditableSectionIds: [],
    phone: '+966502345678',
    jobTitleAr: 'مدير إدارة الموارد البشرية',
    jobTitleEn: 'HR Director',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },

  // مدير إدارة الجودة
  {
    id: 'user-3',
    employeeNumber: 'EMP-0003',
    email: 'quality.manager@saudicable.com',
    fullNameAr: 'محمد باحويرث',
    fullNameEn: 'Mohammed Bahwairth',
    role: 'quality_manager',
    departmentId: 'dept-2',
    sectionId: 'sec-3',
    canBeAuditor: true,
    auditableDepartmentIds: ['dept-1', 'dept-2', 'dept-3', 'dept-4', 'dept-5', 'dept-6'],
    auditableSectionIds: [],
    phone: '+966503456789',
    jobTitleAr: 'مدير إدارة الجودة',
    jobTitleEn: 'Quality Manager',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },

  // رئيس قسم التوظيف
  {
    id: 'user-4',
    employeeNumber: 'EMP-0004',
    email: 'recruitment.head@saudicable.com',
    fullNameAr: 'فيصل محمد الأعمى',
    fullNameEn: 'Faisal Mohammed Al-Aama',
    role: 'section_head',
    departmentId: 'dept-1',
    sectionId: 'sec-1',
    canBeAuditor: false, // مدقق عليه فقط
    auditableDepartmentIds: [],
    auditableSectionIds: [],
    phone: '+966504567890',
    jobTitleAr: 'رئيس قسم التوظيف',
    jobTitleEn: 'Recruitment Head',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },

  // رئيس قسم التدريب
  {
    id: 'user-5',
    employeeNumber: 'EMP-0005',
    email: 'training.head@saudicable.com',
    fullNameAr: 'نورة سعد الدوسري',
    fullNameEn: 'Noura Saad Al-Dosari',
    role: 'section_head',
    departmentId: 'dept-1',
    sectionId: 'sec-2',
    canBeAuditor: true, // يمكنها أن تكون مراجعة أيضاً
    auditableDepartmentIds: ['dept-3'],
    auditableSectionIds: ['sec-5', 'sec-6'],
    phone: '+966505678901',
    jobTitleAr: 'رئيسة قسم التدريب والتطوير',
    jobTitleEn: 'Training & Development Head',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },

  // موظف التوظيف
  {
    id: 'user-6',
    employeeNumber: 'EMP-0006',
    email: 'recruiter@saudicable.com',
    fullNameAr: 'عبدالله حسن المالكي',
    fullNameEn: 'Abdullah Hassan Al-Maliki',
    role: 'employee',
    departmentId: 'dept-1',
    sectionId: 'sec-1',
    canBeAuditor: false,
    auditableDepartmentIds: [],
    auditableSectionIds: [],
    phone: '+966506789012',
    jobTitleAr: 'أخصائي توظيف',
    jobTitleEn: 'Recruitment Specialist',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },

  // مدير الإنتاج
  {
    id: 'user-7',
    employeeNumber: 'EMP-0007',
    email: 'production.manager@saudicable.com',
    fullNameAr: 'محمد علي الشهري',
    fullNameEn: 'Mohammed Ali Al-Shehri',
    role: 'department_manager',
    departmentId: 'dept-3',
    canBeAuditor: false,
    auditableDepartmentIds: [],
    auditableSectionIds: [],
    phone: '+966507890123',
    jobTitleAr: 'مدير إدارة الإنتاج',
    jobTitleEn: 'Production Director',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },

  // رئيس قسم التصنيع
  {
    id: 'user-8',
    employeeNumber: 'EMP-0008',
    email: 'manufacturing.head@saudicable.com',
    fullNameAr: 'يوسف خالد العتيبي',
    fullNameEn: 'Yousef Khalid Al-Otaibi',
    role: 'section_head',
    departmentId: 'dept-3',
    sectionId: 'sec-5',
    canBeAuditor: false,
    auditableDepartmentIds: [],
    auditableSectionIds: [],
    phone: '+966508901234',
    jobTitleAr: 'رئيس قسم التصنيع',
    jobTitleEn: 'Manufacturing Head',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },

  // رئيس قسم مراقبة الجودة
  {
    id: 'user-9',
    employeeNumber: 'EMP-0009',
    email: 'qc.head@saudicable.com',
    fullNameAr: 'عبدالعزيز فهد الحربي',
    fullNameEn: 'Abdulaziz Fahd Al-Harbi',
    role: 'section_head',
    departmentId: 'dept-3',
    sectionId: 'sec-6',
    canBeAuditor: true, // يمكنه أن يكون مراجع أيضاً
    auditableDepartmentIds: ['dept-1'],
    auditableSectionIds: ['sec-1', 'sec-2'],
    phone: '+966509012345',
    jobTitleAr: 'رئيس قسم مراقبة الجودة',
    jobTitleEn: 'Quality Control Head',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },

  // مدير المالية
  {
    id: 'user-10',
    employeeNumber: 'EMP-0010',
    email: 'finance.manager@saudicable.com',
    fullNameAr: 'سلطان ناصر الغامدي',
    fullNameEn: 'Sultan Nasser Al-Ghamdi',
    role: 'department_manager',
    departmentId: 'dept-4',
    canBeAuditor: false,
    auditableDepartmentIds: [],
    auditableSectionIds: [],
    phone: '+966510123456',
    jobTitleAr: 'مدير الإدارة المالية',
    jobTitleEn: 'Finance Director',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },

  // رئيس قسم المحاسبة
  {
    id: 'user-11',
    employeeNumber: 'EMP-0011',
    email: 'accounting.head@saudicable.com',
    fullNameAr: 'هند سعيد الزهراني',
    fullNameEn: 'Hind Saeed Al-Zahrani',
    role: 'section_head',
    departmentId: 'dept-4',
    sectionId: 'sec-7',
    canBeAuditor: false,
    auditableDepartmentIds: [],
    auditableSectionIds: [],
    phone: '+966511234567',
    jobTitleAr: 'رئيسة قسم المحاسبة',
    jobTitleEn: 'Accounting Head',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },

  // رئيس قسم الميزانية
  {
    id: 'user-12',
    employeeNumber: 'EMP-0012',
    email: 'budget.head@saudicable.com',
    fullNameAr: 'عمر بندر الخالدي',
    fullNameEn: 'Omar Bandar Al-Khalidi',
    role: 'section_head',
    departmentId: 'dept-4',
    sectionId: 'sec-8',
    canBeAuditor: false,
    auditableDepartmentIds: [],
    auditableSectionIds: [],
    phone: '+966512345678',
    jobTitleAr: 'رئيس قسم الميزانية',
    jobTitleEn: 'Budget Head',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },

  // مدير تقنية المعلومات
  {
    id: 'user-13',
    employeeNumber: 'EMP-0013',
    email: 'it.manager@saudicable.com',
    fullNameAr: 'تركي محمد البلوي',
    fullNameEn: 'Turki Mohammed Al-Balawi',
    role: 'department_manager',
    departmentId: 'dept-5',
    canBeAuditor: false,
    auditableDepartmentIds: [],
    auditableSectionIds: [],
    phone: '+966513456789',
    jobTitleAr: 'مدير إدارة تقنية المعلومات',
    jobTitleEn: 'IT Director',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },

  // رئيس قسم البنية التحتية
  {
    id: 'user-14',
    employeeNumber: 'EMP-0014',
    email: 'infrastructure.head@saudicable.com',
    fullNameAr: 'فهد عادل الجهني',
    fullNameEn: 'Fahd Adel Al-Juhani',
    role: 'section_head',
    departmentId: 'dept-5',
    sectionId: 'sec-9',
    canBeAuditor: false,
    auditableDepartmentIds: [],
    auditableSectionIds: [],
    phone: '+966514567890',
    jobTitleAr: 'رئيس قسم البنية التحتية',
    jobTitleEn: 'Infrastructure Head',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },

  // رئيس قسم التطوير
  {
    id: 'user-15',
    employeeNumber: 'EMP-0015',
    email: 'dev.head@saudicable.com',
    fullNameAr: 'ريم أحمد السبيعي',
    fullNameEn: 'Reem Ahmed Al-Subaie',
    role: 'section_head',
    departmentId: 'dept-5',
    sectionId: 'sec-10',
    canBeAuditor: true,
    auditableDepartmentIds: ['dept-4'],
    auditableSectionIds: ['sec-7', 'sec-8'],
    phone: '+966515678901',
    jobTitleAr: 'رئيسة قسم التطوير',
    jobTitleEn: 'Development Head',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },

  // مدير المبيعات
  {
    id: 'user-16',
    employeeNumber: 'EMP-0016',
    email: 'sales.manager@saudicable.com',
    fullNameAr: 'ماجد عبدالرحمن الحمد',
    fullNameEn: 'Majed Abdulrahman Al-Hamd',
    role: 'department_manager',
    departmentId: 'dept-6',
    canBeAuditor: false,
    auditableDepartmentIds: [],
    auditableSectionIds: [],
    phone: '+966516789012',
    jobTitleAr: 'مدير إدارة المبيعات',
    jobTitleEn: 'Sales Director',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },

  // رئيس قسم المبيعات المحلية
  {
    id: 'user-17',
    employeeNumber: 'EMP-0017',
    email: 'domestic.sales.head@saudicable.com',
    fullNameAr: 'سامي خالد العنزي',
    fullNameEn: 'Sami Khalid Al-Anzi',
    role: 'section_head',
    departmentId: 'dept-6',
    sectionId: 'sec-11',
    canBeAuditor: false,
    auditableDepartmentIds: [],
    auditableSectionIds: [],
    phone: '+966517890123',
    jobTitleAr: 'رئيس قسم المبيعات المحلية',
    jobTitleEn: 'Domestic Sales Head',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },

  // رئيس قسم المبيعات الدولية
  {
    id: 'user-18',
    employeeNumber: 'EMP-0018',
    email: 'intl.sales.head@saudicable.com',
    fullNameAr: 'لمى فيصل الرشيد',
    fullNameEn: 'Lama Faisal Al-Rasheed',
    role: 'section_head',
    departmentId: 'dept-6',
    sectionId: 'sec-12',
    canBeAuditor: false,
    auditableDepartmentIds: [],
    auditableSectionIds: [],
    phone: '+966518901234',
    jobTitleAr: 'رئيسة قسم المبيعات الدولية',
    jobTitleEn: 'International Sales Head',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },

  // مراجعين داخليين (تابعين لإدارة الجودة)
  {
    id: 'user-19',
    employeeNumber: 'EMP-0019',
    email: 'auditor1@saudicable.com',
    fullNameAr: 'عبدالمجيد سعود الشمري',
    fullNameEn: 'Abdulmajeed Saud Al-Shammari',
    role: 'auditor',
    departmentId: 'dept-2',
    sectionId: 'sec-3',
    canBeAuditor: true,
    auditableDepartmentIds: ['dept-1', 'dept-3', 'dept-5'],
    auditableSectionIds: [],
    phone: '+966519012345',
    jobTitleAr: 'مراجع داخلي أول',
    jobTitleEn: 'Senior Internal Auditor',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },

  {
    id: 'user-20',
    employeeNumber: 'EMP-0020',
    email: 'auditor2@saudicable.com',
    fullNameAr: 'منى عبدالله المطيري',
    fullNameEn: 'Mona Abdullah Al-Mutairi',
    role: 'auditor',
    departmentId: 'dept-2',
    sectionId: 'sec-4',
    canBeAuditor: true,
    auditableDepartmentIds: ['dept-4', 'dept-6'],
    auditableSectionIds: [],
    phone: '+966520123456',
    jobTitleAr: 'مراجعة داخلية',
    jobTitleEn: 'Internal Auditor',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },

  // موظفين إضافيين
  {
    id: 'user-21',
    employeeNumber: 'EMP-0021',
    email: 'employee1@saudicable.com',
    fullNameAr: 'حسين علي الدوسري',
    fullNameEn: 'Hussein Ali Al-Dosari',
    role: 'employee',
    departmentId: 'dept-3',
    sectionId: 'sec-5',
    canBeAuditor: false,
    auditableDepartmentIds: [],
    auditableSectionIds: [],
    phone: '+966521234567',
    jobTitleAr: 'فني إنتاج',
    jobTitleEn: 'Production Technician',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },

  {
    id: 'user-22',
    employeeNumber: 'EMP-0022',
    email: 'employee2@saudicable.com',
    fullNameAr: 'أمل محمد الزهراني',
    fullNameEn: 'Amal Mohammed Al-Zahrani',
    role: 'employee',
    departmentId: 'dept-4',
    sectionId: 'sec-7',
    canBeAuditor: false,
    auditableDepartmentIds: [],
    auditableSectionIds: [],
    phone: '+966522345678',
    jobTitleAr: 'محاسبة',
    jobTitleEn: 'Accountant',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
];

// ===========================================
// دوال مساعدة
// ===========================================

// الحصول على الإدارة بالمعرف
export const getDepartmentById = (id: string): Department | undefined => {
  return departments.find((d) => d.id === id);
};

// الحصول على القسم بالمعرف
export const getSectionById = (id: string): Section | undefined => {
  return sections.find((s) => s.id === id);
};

// الحصول على المستخدم بالمعرف
export const getUserById = (id: string): User | undefined => {
  return users.find((u) => u.id === id);
};

// الحصول على أقسام إدارة معينة
export const getSectionsByDepartment = (departmentId: string): Section[] => {
  return sections.filter((s) => s.departmentId === departmentId && s.isActive);
};

// الحصول على موظفي قسم معين
export const getUsersBySection = (sectionId: string): User[] => {
  return users.filter((u) => u.sectionId === sectionId && u.isActive);
};

// الحصول على موظفي إدارة معينة
export const getUsersByDepartment = (departmentId: string): User[] => {
  return users.filter((u) => u.departmentId === departmentId && u.isActive);
};

// الحصول على المراجعين المتاحين
export const getAvailableAuditors = (): User[] => {
  return users.filter((u) => u.canBeAuditor && u.isActive);
};

// الحصول على المراجعين الذين يمكنهم مراجعة إدارة معينة
export const getAuditorsForDepartment = (departmentId: string): User[] => {
  return users.filter(
    (u) =>
      u.canBeAuditor &&
      u.isActive &&
      (u.auditableDepartmentIds.includes(departmentId) ||
        u.role === 'quality_manager' ||
        u.role === 'system_admin')
  );
};

// التحقق من قدرة المستخدم على مراجعة إدارة/قسم معين
export const canUserAudit = (
  userId: string,
  departmentId: string,
  sectionId?: string
): boolean => {
  const user = getUserById(userId);
  if (!user || !user.canBeAuditor || !user.isActive) return false;

  // مدير النظام ومدير الجودة يمكنهم مراجعة أي إدارة
  if (user.role === 'system_admin' || user.role === 'quality_manager') {
    return true;
  }

  // التحقق من الإدارة
  if (user.auditableDepartmentIds.includes(departmentId)) {
    return true;
  }

  // التحقق من القسم
  if (sectionId && user.auditableSectionIds.includes(sectionId)) {
    return true;
  }

  return false;
};

// الحصول على اسم الدور بالعربي
export const getRoleNameAr = (role: UserRole): string => {
  const roleNames: Record<UserRole, string> = {
    system_admin: 'مدير النظام',
    quality_manager: 'مدير إدارة الجودة',
    auditor: 'مراجع داخلي',
    department_manager: 'مدير إدارة',
    section_head: 'رئيس قسم',
    employee: 'موظف',
  };
  return roleNames[role];
};

// الحصول على اسم الدور بالإنجليزي
export const getRoleNameEn = (role: UserRole): string => {
  const roleNames: Record<UserRole, string> = {
    system_admin: 'System Admin',
    quality_manager: 'Quality Manager',
    auditor: 'Internal Auditor',
    department_manager: 'Department Manager',
    section_head: 'Section Head',
    employee: 'Employee',
  };
  return roleNames[role];
};
