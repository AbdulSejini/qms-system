'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

// الصفحات العامة التي لا تحتاج تسجيل دخول
const publicPaths = ['/login'];

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading, currentUser, canAccessUsersPage, canAccessDepartmentsPage } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    // إذا لم يكن مسجل دخول وليست صفحة عامة
    if (!isAuthenticated && !publicPaths.includes(pathname)) {
      router.replace('/login');
      return;
    }

    // إذا كان مسجل دخول وفي صفحة تسجيل الدخول
    if (isAuthenticated && pathname === '/login') {
      router.replace('/dashboard');
      return;
    }

    // التحقق من صلاحيات الوصول للصفحات المحمية
    if (isAuthenticated && currentUser) {
      // صفحة المستخدمين
      if (pathname.startsWith('/users') && !canAccessUsersPage) {
        router.replace('/dashboard');
        return;
      }

      // صفحة الإدارات
      if (pathname.startsWith('/departments') && !canAccessDepartmentsPage) {
        router.replace('/dashboard');
        return;
      }
    }
  }, [isAuthenticated, isLoading, pathname, router, currentUser, canAccessUsersPage, canAccessDepartmentsPage]);

  // إظهار شاشة التحميل
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[var(--primary)] to-[var(--primary-hover)] flex items-center justify-center">
            <Loader2 className="h-6 w-6 text-white animate-spin" />
          </div>
          <p className="text-[var(--foreground-secondary)]">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  // إذا كانت صفحة عامة
  if (publicPaths.includes(pathname)) {
    return <>{children}</>;
  }

  // إذا لم يكن مسجل دخول
  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
