'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useTranslation, useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard,
  ClipboardCheck,
  AlertCircle,
  FileBarChart,
  Settings,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Users,
  Building2,
  Calendar,
  ListChecks,
  TrendingUp,
  Wifi,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';

// Types for active sessions
interface ActiveSession {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  loginAt: string;
  lastActivity?: string;
}

interface NavItem {
  href: string;
  labelKey: string;
  icon: React.ElementType;
  badge?: number;
  requiresRole?: string[]; // الأدوار المطلوبة للوصول
}

const navItems: NavItem[] = [
  {
    href: '/dashboard',
    labelKey: 'navigation.dashboard',
    icon: LayoutDashboard,
  },
  {
    href: '/audits',
    labelKey: 'navigation.audits',
    icon: ClipboardCheck,
  },
  {
    href: '/findings',
    labelKey: 'navigation.findings',
    icon: AlertCircle,
  },
  {
    href: '/calendar',
    labelKey: 'navigation.calendar',
    icon: Calendar,
  },
  {
    href: '/followup',
    labelKey: 'navigation.followup',
    icon: ListChecks,
  },
  {
    href: '/performance',
    labelKey: 'navigation.performance',
    icon: TrendingUp,
  },
  {
    href: '/reports',
    labelKey: 'navigation.reports',
    icon: FileBarChart,
  },
  {
    href: '/users',
    labelKey: 'navigation.users',
    icon: Users,
    requiresRole: ['system_admin', 'quality_manager'],
  },
  {
    href: '/departments',
    labelKey: 'navigation.departments',
    icon: Building2,
  },
  {
    href: '/settings',
    labelKey: 'navigation.settings',
    icon: Settings,
  },
];

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  isMobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({ isCollapsed, onToggle, isMobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const { t, isRTL } = useTranslation();
  const { language } = useLanguage();
  const { currentUser } = useAuth();

  // State للمستخدمين المتصلين
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [showActiveSessions, setShowActiveSessions] = useState(true);
  const isSystemAdmin = currentUser?.role === 'system_admin';

  // تحميل الجلسات النشطة
  useEffect(() => {
    if (!isSystemAdmin) return;

    const loadActiveSessions = () => {
      const sessions: ActiveSession[] = [];
      const storedUsers = localStorage.getItem('qms_users');
      // إخفاء حسابات النظام
      const users = storedUsers ? JSON.parse(storedUsers).filter((u: any) => !u.isSystemAccount) : [];

      // الجلسة الحالية
      const currentSession = localStorage.getItem('qms_session');
      if (currentSession) {
        const sessionData = JSON.parse(currentSession);
        sessions.push({
          id: 'current',
          userId: currentUser?.id || 'user-1',
          userName: language === 'ar' ? (currentUser?.fullNameAr || 'مدير النظام') : (currentUser?.fullNameEn || 'System Admin'),
          userRole: 'system_admin',
          loginAt: sessionData.loginAt,
          lastActivity: new Date().toISOString(),
        });
      }

      // جلسات المستخدمين الآخرين
      const allSessions = localStorage.getItem('qms_active_sessions');
      if (allSessions) {
        const parsedSessions = JSON.parse(allSessions);
        parsedSessions.forEach((session: any) => {
          if (session.userId !== currentUser?.id) {
            const user = users.find((u: any) => u.id === session.userId);
            if (user) {
              sessions.push({
                id: session.id || session.userId,
                userId: session.userId,
                userName: language === 'ar' ? user.fullNameAr : user.fullNameEn,
                userRole: user.role,
                loginAt: session.loginAt,
                lastActivity: session.lastActivity,
              });
            }
          }
        });
      }

      setActiveSessions(sessions);
    };

    loadActiveSessions();
    const interval = setInterval(loadActiveSessions, 30000);
    return () => clearInterval(interval);
  }, [isSystemAdmin, currentUser, language]);

  // تصفية عناصر القائمة بناءً على صلاحيات المستخدم
  const filteredNavItems = useMemo(() => {
    return navItems.filter(item => {
      if (!item.requiresRole) return true; // إذا لم يكن هناك قيود
      if (!currentUser) return false; // إذا لم يكن مسجل دخول
      return item.requiresRole.includes(currentUser.role);
    });
  }, [currentUser]);

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 z-50 flex h-full flex-col bg-[var(--sidebar-bg)] border-e border-[var(--border)] shadow-sm transition-all duration-300 lg:relative lg:z-auto',
          isCollapsed ? 'w-20' : 'w-64',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          isRTL && isMobileOpen ? 'translate-x-0' : isRTL && 'translate-x-full lg:translate-x-0'
        )}
      >
        {/* Logo Section */}
        <div className={cn(
          'flex items-center h-16 px-4 border-b border-[var(--border)]',
          isCollapsed ? 'justify-center' : 'gap-3'
        )}>
          {/* Logo */}
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--primary)] to-[var(--primary-hover)] shadow-md shrink-0">
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M9 12l2 2 4-4" />
              <path d="M12 3c-1.2 0-2.4.6-3 1.7A3.6 3.6 0 004.6 9c-1 .6-1.7 1.8-1.7 3s.7 2.4 1.7 3c-.3 1.8.5 3.7 2.4 4.3 1.9.7 3.9-.2 4.7-2 .8 1.8 2.8 2.7 4.7 2a3.6 3.6 0 002.4-4.3c1-.6 1.7-1.8 1.7-3s-.7-2.4-1.7-3a3.6 3.6 0 00-4.4-4.3A3.6 3.6 0 0012 3z" />
            </svg>
          </div>
          {!isCollapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold text-[var(--foreground)] truncate">
                {t('common.companyName')}
              </span>
              <span className="text-xs text-[var(--primary)] font-semibold tracking-wide">
                QMS
              </span>
            </div>
          )}

          {/* Mobile Close Button */}
          {isMobileOpen && (
            <button
              onClick={onMobileClose}
              className="ms-auto lg:hidden p-1.5 rounded-lg text-[var(--foreground-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--background-tertiary)] transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <ul className="space-y-1">
            {filteredNavItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onMobileClose}
                    className={cn(
                      'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 relative',
                      isActive
                        ? 'bg-[var(--primary-light)] text-[var(--primary)]'
                        : 'text-[var(--foreground-secondary)] hover:bg-[var(--background-tertiary)] hover:text-[var(--foreground)]',
                      isCollapsed && 'justify-center px-2'
                    )}
                    title={isCollapsed ? t(item.labelKey) : undefined}
                  >
                    {/* Active Indicator */}
                    {isActive && (
                      <div className={cn(
                        'absolute top-1/2 -translate-y-1/2 w-1 h-6 bg-[var(--primary)] rounded-full',
                        isRTL ? '-end-0' : '-start-0'
                      )} />
                    )}

                    {/* Icon Container */}
                    <div className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-200 shrink-0',
                      isActive
                        ? 'bg-[var(--primary)] text-white shadow-sm'
                        : 'bg-[var(--background-tertiary)] text-[var(--foreground-secondary)] group-hover:bg-[var(--border)] group-hover:text-[var(--foreground)]'
                    )}>
                      <Icon className="h-[18px] w-[18px]" />
                    </div>

                    {!isCollapsed && (
                      <span className="truncate">{t(item.labelKey)}</span>
                    )}

                    {!isCollapsed && item.badge && (
                      <span className="ms-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--primary)] px-1.5 text-xs text-white font-bold">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Active Users - لمدير النظام فقط */}
        {isSystemAdmin && !isCollapsed && (
          <div className="px-3 pb-2 border-t border-[var(--border)] pt-2">
            <button
              onClick={() => setShowActiveSessions(!showActiveSessions)}
              className="flex items-center justify-between w-full px-2 py-1.5 text-xs font-medium text-[var(--foreground-secondary)] hover:text-[var(--foreground)] transition-colors"
            >
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Wifi className="h-3.5 w-3.5 text-green-500" />
                  <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                </div>
                <span>{language === 'ar' ? 'المتصلين' : 'Online'}</span>
                <span className="text-[10px] text-green-600 dark:text-green-400">({activeSessions.length})</span>
              </div>
              {showActiveSessions ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </button>

            {showActiveSessions && (
              <div className="mt-1 space-y-1 max-h-32 overflow-y-auto">
                {activeSessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-[var(--background-tertiary)]"
                  >
                    <div className="relative shrink-0">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[10px] font-semibold">
                        {session.userName.charAt(0)}
                      </div>
                      <span className="absolute bottom-0 right-0 h-1.5 w-1.5 rounded-full bg-green-500 ring-1 ring-[var(--background-tertiary)]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-medium text-[var(--foreground)] truncate">
                        {session.userName}
                        {session.id === 'current' && (
                          <span className="text-[9px] text-green-600 dark:text-green-400 ms-1">
                            ({language === 'ar' ? 'أنت' : 'You'})
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Active Users Icon - للوضع المصغر */}
        {isSystemAdmin && isCollapsed && (
          <div className="px-3 pb-2 border-t border-[var(--border)] pt-2 flex justify-center">
            <div className="relative" title={language === 'ar' ? `${activeSessions.length} متصل` : `${activeSessions.length} online`}>
              <Wifi className="h-5 w-5 text-green-500" />
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-[9px] text-white font-bold">
                {activeSessions.length}
              </span>
            </div>
          </div>
        )}

        {/* Collapse Toggle */}
        <div className="p-3 border-t border-[var(--border)]">
          <button
            onClick={onToggle}
            className={cn(
              'hidden w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm text-[var(--foreground-secondary)] transition-all duration-200 hover:bg-[var(--background-tertiary)] hover:text-[var(--foreground)] lg:flex',
              isCollapsed ? 'px-2' : 'px-3'
            )}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--background-tertiary)]">
              {isRTL ? (
                isCollapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
              ) : (
                isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />
              )}
            </div>
            {!isCollapsed && (
              <span>{isRTL ? 'طي القائمة' : 'Collapse'}</span>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}

export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-xl p-2 text-[var(--foreground-secondary)] hover:bg-[var(--background-tertiary)] hover:text-[var(--foreground)] lg:hidden transition-colors"
    >
      <Menu className="h-6 w-6" />
    </button>
  );
}
