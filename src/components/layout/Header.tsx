'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation, useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import {
  Sun,
  Moon,
  User,
  LogOut,
  Settings,
  ChevronDown,
  Languages,
  UserCog,
  Shield,
  Bell,
  Check,
  X,
  ClipboardCheck,
  AlertCircle,
  Clock,
  Edit3,
  Send,
  Users,
  Calendar,
  FileWarning,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { MobileMenuButton } from './Sidebar';
import { getRoleNameAr, getRoleNameEn } from '@/data/mock-data';
import { useRouter } from 'next/navigation';
import {
  subscribeToNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification as deleteNotificationFromFirestore,
  Notification,
} from '@/lib/firestore';

interface HeaderProps {
  onMobileMenuClick: () => void;
}

export function Header({ onMobileMenuClick }: HeaderProps) {
  const { t, isRTL } = useTranslation();
  const { language, setLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();
  const { currentUser, switchUser, availableUsers, permissions, logout } = useAuth();
  const router = useRouter();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showUserSwitcher, setShowUserSwitcher] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [bellAnimating, setBellAnimating] = useState(false);

  // Load notifications from Firestore in real-time
  useEffect(() => {
    if (!currentUser?.id) {
      console.log('No current user, skipping notifications subscription');
      return;
    }

    console.log('Subscribing to notifications for user:', currentUser.id, currentUser.fullNameEn);

    // Subscribe to real-time notifications from Firestore
    const unsubscribe = subscribeToNotifications(currentUser.id, (firestoreNotifications) => {
      console.log('Received notifications:', firestoreNotifications.length, firestoreNotifications);
      setNotifications(firestoreNotifications);
    });

    return () => {
      console.log('Unsubscribing from notifications');
      unsubscribe();
    };
  }, [currentUser?.id]);

  // Count unread notifications
  const unreadCount = useMemo(() => {
    return notifications.filter(n => !n.read).length;
  }, [notifications]);

  // Animate bell when there are unread notifications
  useEffect(() => {
    if (unreadCount > 0) {
      setBellAnimating(true);
      const timeout = setTimeout(() => setBellAnimating(false), 1000);
      return () => clearTimeout(timeout);
    }
  }, [unreadCount]);

  // Mark notification as read (Firestore)
  const markAsRead = async (notificationId: string) => {
    await markNotificationAsRead(notificationId);
  };

  // Mark all as read (Firestore)
  const markAllAsRead = async () => {
    if (currentUser?.id) {
      await markAllNotificationsAsRead(currentUser.id);
    }
  };

  // Delete notification (Firestore)
  const deleteNotification = async (notificationId: string) => {
    await deleteNotificationFromFirestore(notificationId);
  };

  // Handle notification click
  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);
    if (notification.auditId) {
      router.push(`/audits/${notification.auditId}`);
      setShowNotifications(false);
    }
  };

  const toggleLanguage = () => {
    setLanguage(language === 'ar' ? 'en' : 'ar');
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  // استخدام المستخدم الحالي من السياق
  const user = currentUser
    ? {
        name: language === 'ar' ? currentUser.fullNameAr : currentUser.fullNameEn,
        role: language === 'ar' ? getRoleNameAr(currentUser.role) : getRoleNameEn(currentUser.role),
      }
    : {
        name: language === 'ar' ? 'زائر' : 'Guest',
        role: language === 'ar' ? 'غير مسجل' : 'Not logged in',
      };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[var(--border)] bg-[var(--card)] px-4 lg:px-6 shadow-sm">
      {/* Left Section */}
      <div className="flex items-center gap-4">
        <MobileMenuButton onClick={onMobileMenuClick} />
        <div className="hidden lg:block">
          <h1 className="text-lg font-semibold text-[var(--foreground)]">
            {t('common.appName')}
          </h1>
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-1.5">
        {/* Language Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleLanguage}
          title={language === 'ar' ? 'Switch to English' : 'التبديل للعربية'}
          className="rounded-xl text-[var(--foreground-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--background-tertiary)]"
        >
          <Languages className="h-5 w-5" />
        </Button>

        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          title={theme === 'dark' ? t('common.lightMode') : t('common.darkMode')}
          className="rounded-xl text-[var(--foreground-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--background-tertiary)]"
        >
          {theme === 'dark' ? (
            <Sun className="h-5 w-5" />
          ) : (
            <Moon className="h-5 w-5" />
          )}
        </Button>

        {/* Notifications Bell */}
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowNotifications(!showNotifications)}
            title={language === 'ar' ? 'التنبيهات' : 'Notifications'}
            className={cn(
              'rounded-xl text-[var(--foreground-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--background-tertiary)] relative',
              bellAnimating && 'animate-bounce'
            )}
          >
            <Bell className={cn(
              'h-5 w-5 transition-transform',
              bellAnimating && 'animate-[ring_0.5s_ease-in-out_infinite]'
            )} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex items-center justify-center h-5 w-5 rounded-full bg-red-500 text-[10px] font-bold text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              </span>
            )}
          </Button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowNotifications(false)}
              />
              <div className={cn(
                'absolute top-full z-50 mt-2 w-80 md:w-96 rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-xl overflow-hidden',
                isRTL ? 'left-0' : 'right-0'
              )}>
                {/* Header */}
                <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3 bg-[var(--background-secondary)]">
                  <h3 className="font-semibold text-[var(--foreground)]">
                    {language === 'ar' ? 'التنبيهات' : 'Notifications'}
                  </h3>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-xs text-[var(--primary)] hover:underline"
                    >
                      {language === 'ar' ? 'تحديد الكل كمقروء' : 'Mark all as read'}
                    </button>
                  )}
                </div>

                {/* Notifications List */}
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-[var(--foreground-secondary)]">
                      <Bell className="h-12 w-12 mb-3 opacity-30" />
                      <p className="text-sm">
                        {language === 'ar' ? 'لا توجد تنبيهات' : 'No notifications'}
                      </p>
                    </div>
                  ) : (
                    notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={cn(
                          'relative flex items-start gap-3 px-4 py-3 border-b border-[var(--border)] last:border-b-0 cursor-pointer transition-colors hover:bg-[var(--background-tertiary)]',
                          !notification.read && 'bg-[var(--primary)]/5'
                        )}
                        onClick={() => handleNotificationClick(notification)}
                      >
                        {/* Icon */}
                        <div className={cn(
                          'flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-full',
                          notification.type === 'audit_approval_request' && 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
                          notification.type === 'audit_approved' && 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
                          notification.type === 'audit_rejected' && 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
                          notification.type === 'audit_postponed' && 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
                          notification.type === 'audit_modification_requested' && 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
                          notification.type === 'audit_modification_submitted' && 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400',
                          notification.type === 'audit_team_assignment' && 'bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400',
                          notification.type === 'audit_scheduled' && 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400',
                          notification.type === 'corrective_action_response_required' && 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
                          notification.type === 'new_finding' && 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
                          notification.type === 'general' && 'bg-gray-100 dark:bg-gray-900/30 text-gray-600 dark:text-gray-400'
                        )}>
                          {notification.type === 'audit_approval_request' && <ClipboardCheck className="h-5 w-5" />}
                          {notification.type === 'audit_approved' && <Check className="h-5 w-5" />}
                          {notification.type === 'audit_rejected' && <AlertCircle className="h-5 w-5" />}
                          {notification.type === 'audit_postponed' && <Clock className="h-5 w-5" />}
                          {notification.type === 'audit_modification_requested' && <Edit3 className="h-5 w-5" />}
                          {notification.type === 'audit_modification_submitted' && <Send className="h-5 w-5" />}
                          {notification.type === 'audit_team_assignment' && <Users className="h-5 w-5" />}
                          {notification.type === 'audit_scheduled' && <Calendar className="h-5 w-5" />}
                          {notification.type === 'corrective_action_response_required' && <AlertCircle className="h-5 w-5" />}
                          {notification.type === 'new_finding' && <FileWarning className="h-5 w-5" />}
                          {notification.type === 'general' && <Bell className="h-5 w-5" />}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            'text-sm',
                            !notification.read ? 'font-semibold text-[var(--foreground)]' : 'text-[var(--foreground)]'
                          )}>
                            {notification.title}
                          </p>
                          <p className="text-xs text-[var(--foreground-secondary)] mt-0.5 line-clamp-2">
                            {notification.message}
                          </p>
                          <p className="text-xs text-[var(--foreground-muted)] mt-1">
                            {new Date(notification.createdAt).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>

                        {/* Unread indicator */}
                        {!notification.read && (
                          <div className="absolute top-3 end-3 h-2 w-2 rounded-full bg-[var(--primary)]" />
                        )}

                        {/* Delete button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(notification.id);
                          }}
                          className="absolute top-3 end-8 p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 text-[var(--foreground-muted)] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* User Menu */}
        <div className="relative ms-2">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 rounded-xl p-2 transition-colors hover:bg-[var(--background-tertiary)]"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--primary)] to-[var(--primary-hover)] text-sm font-semibold text-white shadow-sm">
              {user.name.charAt(0)}
            </div>
            <div className="hidden text-start md:block">
              <p className="text-sm font-medium text-[var(--foreground)]">
                {user.name}
              </p>
              <p className="text-xs text-[var(--foreground-secondary)]">
                {user.role}
              </p>
            </div>
            <ChevronDown className="hidden h-4 w-4 text-[var(--foreground-muted)] md:block" />
          </button>

          {showUserMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowUserMenu(false)}
              />
              <div className={cn(
                'absolute top-full z-50 mt-2 w-56 rounded-2xl border border-[var(--border)] bg-[var(--card)] py-2 shadow-xl',
                isRTL ? 'left-0' : 'right-0'
              )}>
                <div className="border-b border-[var(--border)] px-4 py-3">
                  <p className="text-sm font-semibold text-[var(--foreground)]">
                    {user.name}
                  </p>
                  <p className="text-xs text-[var(--foreground-secondary)]">
                    {user.role}
                  </p>
                </div>
                <div className="py-1">
                  <button
                    onClick={() => setShowUserMenu(false)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-[var(--foreground)] transition-colors hover:bg-[var(--background-tertiary)]"
                  >
                    <User className="h-4 w-4 text-[var(--foreground-secondary)]" />
                    {t('navigation.profile')}
                  </button>
                  <button
                    onClick={() => setShowUserMenu(false)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-[var(--foreground)] transition-colors hover:bg-[var(--background-tertiary)]"
                  >
                    <Settings className="h-4 w-4 text-[var(--foreground-secondary)]" />
                    {t('navigation.settings')}
                  </button>
                </div>
                {/* User Switcher - فقط لمدير النظام */}
                {currentUser?.role === 'system_admin' && (
                  <div className="border-t border-[var(--border)] py-1">
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        setShowUserSwitcher(true);
                      }}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-[var(--foreground)] transition-colors hover:bg-[var(--background-tertiary)]"
                    >
                      <UserCog className="h-4 w-4 text-[var(--foreground-secondary)]" />
                      {language === 'ar' ? 'تبديل المستخدم' : 'Switch User'}
                    </button>
                  </div>
                )}

                <div className="border-t border-[var(--border)] py-1">
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      logout();
                      router.push('/login');
                    }}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-[var(--status-error)] transition-colors hover:bg-[var(--status-error-bg)]"
                  >
                    <LogOut className="h-4 w-4" />
                    {t('auth.logout')}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* User Switcher Modal (للتطوير) */}
        {showUserSwitcher && (
          <>
            <div
              className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowUserSwitcher(false)}
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="w-full max-w-md rounded-2xl bg-[var(--card)] p-6 shadow-xl max-h-[80vh] overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-[var(--foreground)]">
                    {language === 'ar' ? 'تبديل المستخدم' : 'Switch User'}
                  </h2>
                  <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-1 rounded-full">
                    {language === 'ar' ? 'وضع التطوير' : 'Dev Mode'}
                  </span>
                </div>
                <p className="text-sm text-[var(--foreground-secondary)] mb-4">
                  {language === 'ar'
                    ? 'اختر مستخدم لتجربة الصلاحيات المختلفة:'
                    : 'Select a user to test different permissions:'}
                </p>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {availableUsers.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => {
                        switchUser(u.id);
                        setShowUserSwitcher(false);
                      }}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl p-3 text-start transition-colors',
                        currentUser?.id === u.id
                          ? 'bg-[var(--primary-light)] border-2 border-[var(--primary)]'
                          : 'border border-[var(--border)] hover:bg-[var(--background-tertiary)]'
                      )}
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--primary-light)] text-[var(--primary)] font-semibold shrink-0">
                        {(language === 'ar' ? u.fullNameAr : u.fullNameEn).charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-[var(--foreground)] truncate">
                          {language === 'ar' ? u.fullNameAr : u.fullNameEn}
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-[var(--foreground-secondary)]">
                            {language === 'ar' ? getRoleNameAr(u.role) : getRoleNameEn(u.role)}
                          </span>
                          {u.canBeAuditor && (
                            <span className="inline-flex items-center gap-0.5 text-xs text-green-600 dark:text-green-400">
                              <Shield className="h-3 w-3" />
                            </span>
                          )}
                        </div>
                      </div>
                      {currentUser?.id === u.id && (
                        <span className="text-xs text-[var(--primary)] font-medium">
                          {language === 'ar' ? 'الحالي' : 'Current'}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setShowUserSwitcher(false)}
                  className="mt-4 w-full rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--foreground-secondary)] transition-colors hover:bg-[var(--background-secondary)]"
                >
                  {t('common.close')}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
