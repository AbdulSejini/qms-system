'use client';

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { Button } from '@/components/ui';
import { useTranslation, useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from 'next-themes';
import {
  User,
  Bell,
  Globe,
  Moon,
  Sun,
  Shield,
  Save,
  Check,
} from 'lucide-react';

export default function SettingsPage() {
  const { t, language, isRTL } = useTranslation();
  const { setLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
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
                  defaultValue={language === 'ar' ? 'أحمد محمد' : 'Ahmed Mohammed'}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-opacity-20"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">
                  {language === 'ar' ? 'البريد الإلكتروني' : 'Email'}
                </label>
                <input
                  type="email"
                  defaultValue="ahmed@saudicable.com"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-opacity-20"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">
                  {language === 'ar' ? 'القسم' : 'Department'}
                </label>
                <input
                  type="text"
                  defaultValue={language === 'ar' ? 'إدارة الجودة' : 'Quality Department'}
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

          {/* Security Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-[var(--primary)]" />
                {language === 'ar' ? 'الأمان' : 'Security'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">
                  {language === 'ar' ? 'كلمة المرور الحالية' : 'Current Password'}
                </label>
                <input
                  type="password"
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
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-opacity-20"
                />
              </div>
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
      </div>
    </DashboardLayout>
  );
}
