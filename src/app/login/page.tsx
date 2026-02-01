'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation, useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Eye, EyeOff, Lock, User, AlertCircle, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { t, isRTL } = useTranslation();
  const { language, setLanguage } = useLanguage();
  const { login, isAuthenticated, currentUser } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // إذا كان المستخدم مسجل دخوله، انتقل للوحة التحكم
  useEffect(() => {
    if (isAuthenticated && currentUser) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, currentUser, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const success = await login(username, password);
      if (success) {
        router.push('/dashboard');
      } else {
        setError(isRTL ? 'اسم المستخدم أو كلمة المرور غير صحيحة' : 'Invalid username or password');
      }
    } catch {
      setError(isRTL ? 'حدث خطأ أثناء تسجيل الدخول' : 'An error occurred during login');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[var(--background)] via-[var(--background-secondary)] to-[var(--background)]" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Language Switcher */}
      <div className="absolute top-4 end-4">
        <button
          onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--card-bg)] border border-[var(--border)] text-sm text-[var(--foreground-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--background-tertiary)] transition-colors"
        >
          {language === 'ar' ? 'English' : 'العربية'}
        </button>
      </div>

      <div className="w-full max-w-md p-8">
        {/* Logo & Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-[var(--primary)] to-[var(--primary-hover)] flex items-center justify-center shadow-lg">
              <svg viewBox="0 0 24 24" className="h-8 w-8 text-white" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M9 12l2 2 4-4" />
                <path d="M12 3c-1.2 0-2.4.6-3 1.7A3.6 3.6 0 004.6 9c-1 .6-1.7 1.8-1.7 3s.7 2.4 1.7 3c-.3 1.8.5 3.7 2.4 4.3 1.9.7 3.9-.2 4.7-2 .8 1.8 2.8 2.7 4.7 2a3.6 3.6 0 002.4-4.3c1-.6 1.7-1.8 1.7-3s-.7-2.4-1.7-3a3.6 3.6 0 00-4.4-4.3A3.6 3.6 0 0012 3z" />
              </svg>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">
            {t('common.companyName')}
          </h1>
          <p className="text-[var(--foreground-secondary)] mt-2">
            {isRTL ? 'نظام إدارة الجودة' : 'Quality Management System'}
          </p>
        </div>

        {/* Login Form */}
        <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--border)] shadow-xl p-6">
          <h2 className="text-lg font-semibold text-[var(--foreground)] mb-6 text-center">
            {isRTL ? 'تسجيل الدخول' : 'Sign In'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username Field */}
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                {isRTL ? 'اسم المستخدم' : 'Username'}
              </label>
              <div className="relative">
                <div className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? 'right-3' : 'left-3'} text-[var(--foreground-secondary)]`}>
                  <User className="h-5 w-5" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={isRTL ? 'أدخل اسم المستخدم أو البريد الإلكتروني' : 'Enter username or email'}
                  className={`w-full ${isRTL ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 rounded-xl border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--foreground-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all`}
                  required
                  autoComplete="username"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                {isRTL ? 'كلمة المرور' : 'Password'}
              </label>
              <div className="relative">
                <div className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? 'right-3' : 'left-3'} text-[var(--foreground-secondary)]`}>
                  <Lock className="h-5 w-5" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isRTL ? 'أدخل كلمة المرور' : 'Enter password'}
                  className={`w-full ${isRTL ? 'pr-10 pl-12' : 'pl-10 pr-12'} py-3 rounded-xl border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--foreground-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all`}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? 'left-3' : 'right-3'} text-[var(--foreground-secondary)] hover:text-[var(--foreground)] transition-colors`}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <AlertCircle className="h-5 w-5 text-red-500" />
                <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || !username || !password}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[var(--primary)] to-[var(--primary-hover)] text-white font-medium transition-all hover:shadow-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {isRTL ? 'جاري تسجيل الدخول...' : 'Signing in...'}
                </>
              ) : (
                isRTL ? 'تسجيل الدخول' : 'Sign In'
              )}
            </button>
          </form>

          {/* Help Text */}
          <p className="text-center text-sm text-[var(--foreground-secondary)] mt-6">
            {isRTL
              ? 'في حالة نسيان كلمة المرور، يرجى التواصل مع مدير النظام'
              : 'If you forgot your password, please contact the system administrator'}
          </p>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-[var(--foreground-secondary)] mt-6">
          © {new Date().getFullYear()} {t('common.companyName')} - QMS
        </p>
      </div>
    </div>
  );
}
