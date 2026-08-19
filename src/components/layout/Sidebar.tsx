'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { SaudiCableMark } from '@/components/shared/SaudiCableMark';
import { useTranslation } from '@/contexts/LanguageContext';
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
  CalendarRange,
  ListChecks,
  TrendingUp,
  History,
} from 'lucide-react';

// The "who is online" list that used to sit at the bottom of this sidebar is gone, together
// with its Firestore subscription. What people DID is recorded permanently instead - see the
// system activity log at /activity, reachable from the entry below.

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
    // الخطة السنوية للمراجعة - يبنيها مدير الجودة ويعتمدها المدير الذي يختاره
    href: '/plans',
    labelKey: 'navigation.plans',
    icon: CalendarRange,
    requiresRole: ['system_admin', 'quality_manager', 'auditor', 'department_manager', 'section_head'],
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
    // سجل نشاط النظام - مدير النظام فقط. الصفحة نفسها ترفض غيره أيضاً
    href: '/activity',
    labelKey: 'navigation.activity',
    icon: History,
    requiresRole: ['system_admin'],
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
  const { currentUser } = useAuth();

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
          {/* شعار الشركة - الشعار الرسمي من ترويسة المراسلات، لا أيقونة عامة.
              What used to sit here was a generic "verified" tick in an amber gradient
              square: a decoration, not the company's mark. */}
          <SaudiCableMark size={40} className="shrink-0" />
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
