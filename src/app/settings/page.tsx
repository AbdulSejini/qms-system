'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { Button } from '@/components/ui';
import { useTranslation, useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from 'next-themes';
import { getDepartmentById } from '@/data/mock-data';
import {
  User,
  Bell,
  Globe,
  Moon,
  Sun,
  Shield,
  Save,
  Check,
  AlertCircle,
  Trash2,
  Database,
  RefreshCw,
} from 'lucide-react';

export default function SettingsPage() {
  const { t, language, isRTL } = useTranslation();
  const { setLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();
  const { currentUser } = useAuth();
  const [saved, setSaved] = useState(false);

  // بيانات الملف الشخصي
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('');
  const [role, setRole] = useState('');

  // بيانات الأمان
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // حالة مسح البيانات
  const [showClearDataConfirm, setShowClearDataConfirm] = useState(false);
  const [clearDataSuccess, setClearDataSuccess] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  // تحقق من أن المستخدم مدير النظام
  const isSystemAdmin = currentUser?.role === 'system_admin';

  // تحميل بيانات المستخدم
  useEffect(() => {
    if (currentUser) {
      setFullName(language === 'ar' ? currentUser.fullNameAr : currentUser.fullNameEn);
      setEmail(currentUser.email);

      // الحصول على اسم الإدارة
      if (currentUser.departmentId) {
        const dept = getDepartmentById(currentUser.departmentId);
        if (dept) {
          setDepartment(language === 'ar' ? dept.nameAr : dept.nameEn);
        } else {
          // البحث في localStorage
          const storedDepts = localStorage.getItem('qms_departments');
          if (storedDepts) {
            const depts = JSON.parse(storedDepts);
            const foundDept = depts.find((d: any) => d.id === currentUser.departmentId);
            if (foundDept) {
              setDepartment(language === 'ar' ? foundDept.nameAr : foundDept.nameEn);
            }
          }
        }
      } else {
        setDepartment(language === 'ar' ? 'غير محدد' : 'Not specified');
      }

      // الحصول على اسم الدور
      const roleNames: Record<string, { ar: string; en: string }> = {
        system_admin: { ar: 'مدير النظام', en: 'System Administrator' },
        quality_manager: { ar: 'مدير إدارة الجودة', en: 'Quality Manager' },
        auditor: { ar: 'مراجع داخلي', en: 'Internal Auditor' },
        department_manager: { ar: 'مدير إدارة', en: 'Department Manager' },
        section_head: { ar: 'رئيس قسم', en: 'Section Head' },
        employee: { ar: 'موظف', en: 'Employee' },
      };
      const roleName = roleNames[currentUser.role];
      setRole(roleName ? (language === 'ar' ? roleName.ar : roleName.en) : currentUser.role);
    }
  }, [currentUser, language]);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleChangePassword = () => {
    setPasswordError('');
    setPasswordSuccess(false);

    // التحقق من أن المستخدم ليس مدير النظام
    if (currentUser?.role === 'system_admin') {
      setPasswordError(language === 'ar' ? 'لا يمكن تغيير كلمة مرور مدير النظام' : 'Cannot change system admin password');
      return;
    }

    // التحقق من الحقول
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError(language === 'ar' ? 'جميع الحقول مطلوبة' : 'All fields are required');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError(language === 'ar' ? 'كلمة المرور الجديدة غير متطابقة' : 'New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError(language === 'ar' ? 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' : 'Password must be at least 6 characters');
      return;
    }

    // التحقق من كلمة المرور الحالية
    const passwords = JSON.parse(localStorage.getItem('qms_passwords') || '{}');
    if (currentUser && passwords[currentUser.id] !== currentPassword) {
      setPasswordError(language === 'ar' ? 'كلمة المرور الحالية غير صحيحة' : 'Current password is incorrect');
      return;
    }

    // حفظ كلمة المرور الجديدة
    if (currentUser) {
      passwords[currentUser.id] = newPassword;
      localStorage.setItem('qms_passwords', JSON.stringify(passwords));
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(false), 3000);
    }
  };

  // مسح بيانات المراجعات
  const handleClearAuditsData = () => {
    setIsClearing(true);

    // مسح بيانات المراجعات فقط
    localStorage.removeItem('qms_audits');

    setClearDataSuccess(true);
    setShowClearDataConfirm(false);
    setIsClearing(false);

    setTimeout(() => {
      setClearDataSuccess(false);
      // إعادة تحميل الصفحة لتحديث البيانات
      window.location.reload();
    }, 2000);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">
            {t('navigation.settings')}
          </h1>
          <p className="mt-1 text-[var(--foreground-secondary)]">
            {language === 'ar' ? 'إدارة إعدادات حسابك والنظام' : 'Manage your account and system settings'}
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Profile Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-[var(--primary)]" />
                {language === 'ar' ? 'الملف الشخصي' : 'Profile'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">
                  {language === 'ar' ? 'الاسم الكامل' : 'Full Name'}
                </label>
                <input
                  type="text"
                  value={fullName}
                  disabled
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background-tertiary)] px-4 py-2 text-sm text-[var(--foreground)] cursor-not-allowed"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">
                  {language === 'ar' ? 'البريد الإلكتروني' : 'Email'}
                </label>
                <input
                  type="email"
                  value={email}
                  disabled
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background-tertiary)] px-4 py-2 text-sm text-[var(--foreground)] cursor-not-allowed"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">
                  {language === 'ar' ? 'الدور' : 'Role'}
                </label>
                <input
                  type="text"
                  value={role}
                  disabled
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background-tertiary)] px-4 py-2 text-sm text-[var(--foreground)] cursor-not-allowed"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">
                  {language === 'ar' ? 'الإدارة' : 'Department'}
                </label>
                <input
                  type="text"
                  value={department}
                  disabled
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background-tertiary)] px-4 py-2 text-sm text-[var(--foreground-secondary)] cursor-not-allowed"
                />
              </div>
            </CardContent>
          </Card>

          {/* Appearance Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-[var(--primary)]" />
                {language === 'ar' ? 'المظهر واللغة' : 'Appearance & Language'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Language */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">
                  {language === 'ar' ? 'اللغة' : 'Language'}
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setLanguage('ar')}
                    className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                      language === 'ar'
                        ? 'border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary)]'
                        : 'border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] hover:bg-[var(--background-tertiary)]'
                    }`}
                  >
                    العربية
                  </button>
                  <button
                    onClick={() => setLanguage('en')}
                    className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                      language === 'en'
                        ? 'border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary)]'
                        : 'border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] hover:bg-[var(--background-tertiary)]'
                    }`}
                  >
                    English
                  </button>
                </div>
              </div>

              {/* Theme */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">
                  {language === 'ar' ? 'المظهر' : 'Theme'}
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setTheme('light')}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                      theme === 'light'
                        ? 'border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary)]'
                        : 'border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] hover:bg-[var(--background-tertiary)]'
                    }`}
                  >
                    <Sun className="h-4 w-4" />
                    {language === 'ar' ? 'فاتح' : 'Light'}
                  </button>
                  <button
                    onClick={() => setTheme('dark')}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                      theme === 'dark'
                        ? 'border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary)]'
                        : 'border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] hover:bg-[var(--background-tertiary)]'
                    }`}
                  >
                    <Moon className="h-4 w-4" />
                    {language === 'ar' ? 'داكن' : 'Dark'}
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notification Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-[var(--primary)]" />
                {language === 'ar' ? 'الإشعارات' : 'Notifications'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { labelAr: 'إشعارات المستندات الجديدة', labelEn: 'New document notifications' },
                { labelAr: 'إشعارات التدقيقات', labelEn: 'Audit notifications' },
                { labelAr: 'إشعارات الملاحظات', labelEn: 'Finding notifications' },
                { labelAr: 'إشعارات البريد الإلكتروني', labelEn: 'Email notifications' },
              ].map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-sm text-[var(--foreground)]">
                    {language === 'ar' ? item.labelAr : item.labelEn}
                  </span>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input type="checkbox" defaultChecked className="peer sr-only" />
                    <div className="peer h-6 w-11 rounded-full bg-[var(--border)] after:absolute after:start-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-[var(--primary)] peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[var(--primary)] peer-focus:ring-opacity-20 rtl:peer-checked:after:-translate-x-full"></div>
                  </label>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Data Management - لمدير النظام فقط */}
          {isSystemAdmin && (
            <Card className="border-red-200 dark:border-red-800/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-red-500" />
                  {language === 'ar' ? 'إدارة البيانات' : 'Data Management'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4">
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    {language === 'ar'
                      ? 'تحذير: مسح البيانات لا يمكن التراجع عنه. تأكد من حفظ نسخة احتياطية قبل المتابعة.'
                      : 'Warning: Data deletion cannot be undone. Make sure to backup before proceeding.'}
                  </p>
                </div>

                {clearDataSuccess && (
                  <div className="flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3">
                    <Check className="h-4 w-4 text-green-500" />
                    <span className="text-sm text-green-600 dark:text-green-400">
                      {language === 'ar' ? 'تم مسح البيانات بنجاح' : 'Data cleared successfully'}
                    </span>
                  </div>
                )}

                <div className="space-y-3">
                  <button
                    onClick={() => setShowClearDataConfirm(true)}
                    className="flex w-full items-center justify-between rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Trash2 className="h-5 w-5" />
                      <div className="text-start">
                        <p className="font-medium">
                          {language === 'ar' ? 'مسح بيانات المراجعات' : 'Clear Audits Data'}
                        </p>
                        <p className="text-xs opacity-70">
                          {language === 'ar'
                            ? 'حذف جميع المراجعات والملاحظات والمتابعات'
                            : 'Delete all audits, findings, and follow-ups'}
                        </p>
                      </div>
                    </div>
                  </button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Security Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-[var(--primary)]" />
                {language === 'ar' ? 'الأمان' : 'Security'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {currentUser?.role === 'system_admin' ? (
                <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4">
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    {language === 'ar'
                      ? 'كلمة مرور مدير النظام ثابتة ولا يمكن تغييرها من هنا.'
                      : 'System admin password is fixed and cannot be changed here.'}
                  </p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">
                      {language === 'ar' ? 'كلمة المرور الحالية' : 'Current Password'}
                    </label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-opacity-20"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">
                      {language === 'ar' ? 'كلمة المرور الجديدة' : 'New Password'}
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-opacity-20"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">
                      {language === 'ar' ? 'تأكيد كلمة المرور' : 'Confirm Password'}
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-opacity-20"
                    />
                  </div>

                  {passwordError && (
                    <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
                      <AlertCircle className="h-4 w-4 text-red-500" />
                      <span className="text-sm text-red-600 dark:text-red-400">{passwordError}</span>
                    </div>
                  )}

                  {passwordSuccess && (
                    <div className="flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3">
                      <Check className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-green-600 dark:text-green-400">
                        {language === 'ar' ? 'تم تغيير كلمة المرور بنجاح' : 'Password changed successfully'}
                      </span>
                    </div>
                  )}

                  <Button
                    onClick={handleChangePassword}
                    variant="secondary"
                    className="w-full"
                  >
                    {language === 'ar' ? 'تغيير كلمة المرور' : 'Change Password'}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            leftIcon={saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            variant={saved ? 'success' : 'primary'}
          >
            {saved
              ? (language === 'ar' ? 'تم الحفظ' : 'Saved')
              : (language === 'ar' ? 'حفظ التغييرات' : 'Save Changes')}
          </Button>
        </div>

        {/* نافذة تأكيد مسح البيانات */}
        {showClearDataConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowClearDataConfirm(false)}
            />
            <div className="relative w-full max-w-md rounded-2xl bg-[var(--card)] p-6 shadow-xl">
              <div className="flex items-center gap-4 mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                  <Trash2 className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[var(--foreground)]">
                    {language === 'ar' ? 'تأكيد مسح البيانات' : 'Confirm Data Deletion'}
                  </h3>
                  <p className="text-sm text-[var(--foreground-secondary)]">
                    {language === 'ar'
                      ? 'سيتم حذف جميع المراجعات والملاحظات'
                      : 'All audits and findings will be deleted'}
                  </p>
                </div>
              </div>

              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 mb-6">
                <p className="text-sm text-red-700 dark:text-red-300">
                  {language === 'ar'
                    ? 'هذا الإجراء لا يمكن التراجع عنه!'
                    : 'This action cannot be undone!'}
                </p>
              </div>

              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowClearDataConfirm(false)}
                  disabled={isClearing}
                >
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </Button>
                <Button
                  variant="danger"
                  onClick={handleClearAuditsData}
                  disabled={isClearing}
                  leftIcon={isClearing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                >
                  {isClearing
                    ? (language === 'ar' ? 'جاري المسح...' : 'Clearing...')
                    : (language === 'ar' ? 'مسح البيانات' : 'Clear Data')}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
