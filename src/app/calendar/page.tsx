'use client';

import { useState, useMemo, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { Button, Badge } from '@/components/ui';
import { useTranslation } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  users as allUsers,
  departments as allDepartments,
  sections as allSections,
} from '@/data/mock-data';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  AlertCircle,
  Clock,
  MapPin,
  Users,
  Eye,
  Filter,
  List,
  Grid3X3,
  Bell,
  FileText,
  CheckCircle,
  AlertTriangle,
  X,
} from 'lucide-react';

// Types
interface CalendarEvent {
  id: string;
  title: string;
  titleEn: string;
  type: 'audit' | 'finding_due' | 'meeting' | 'deadline';
  date: string;
  endDate?: string;
  departmentId?: string;
  description?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status?: string;
  relatedId?: string;
}

// Helper functions
const getDaysInMonth = (year: number, month: number) => {
  return new Date(year, month + 1, 0).getDate();
};

const getFirstDayOfMonth = (year: number, month: number) => {
  return new Date(year, month, 1).getDay();
};

const formatDate = (date: Date) => {
  return date.toISOString().split('T')[0];
};

// Sample events data - in real app, this would come from audits and findings
const generateEvents = (): CalendarEvent[] => {
  return [
    // Audits
    {
      id: 'evt-1',
      title: 'مراجعة قسم الإنتاج',
      titleEn: 'Production Department Audit',
      type: 'audit',
      date: '2026-02-03',
      endDate: '2026-02-05',
      departmentId: 'dept-3',
      description: 'مراجعة عمليات التصنيع والجودة',
      priority: 'high',
      status: 'execution',
      relatedId: '1',
    },
    {
      id: 'evt-2',
      title: 'مراجعة الموارد البشرية',
      titleEn: 'Human Resources Audit',
      type: 'audit',
      date: '2026-02-10',
      endDate: '2026-02-12',
      departmentId: 'dept-1',
      description: 'مراجعة عمليات التوظيف والتدريب',
      priority: 'medium',
      status: 'planning',
      relatedId: '2',
    },
    {
      id: 'evt-3',
      title: 'مراجعة ISO الخارجية',
      titleEn: 'External ISO Audit',
      type: 'audit',
      date: '2026-02-20',
      endDate: '2026-02-22',
      departmentId: 'dept-2',
      description: 'تجديد شهادة ISO 9001:2015',
      priority: 'critical',
      status: 'planning',
      relatedId: '3',
    },
    // Finding due dates
    {
      id: 'evt-4',
      title: 'موعد إغلاق ملاحظة - توثيق الصيانة',
      titleEn: 'Finding Due - Maintenance Documentation',
      type: 'finding_due',
      date: '2026-02-15',
      departmentId: 'dept-3',
      description: 'عدم توثيق بعض إجراءات الصيانة الوقائية',
      priority: 'high',
      status: 'open',
      relatedId: 'f1',
    },
    {
      id: 'evt-5',
      title: 'موعد إغلاق ملاحظة - السجلات',
      titleEn: 'Finding Due - Records',
      type: 'finding_due',
      date: '2026-02-08',
      departmentId: 'dept-1',
      description: 'نقص في سجلات التدريب',
      priority: 'medium',
      status: 'in_progress',
      relatedId: 'f2',
    },
    {
      id: 'evt-6',
      title: 'اجتماع مراجعة الإدارة',
      titleEn: 'Management Review Meeting',
      type: 'meeting',
      date: '2026-02-25',
      description: 'اجتماع مراجعة الإدارة الربع سنوي',
      priority: 'high',
    },
    {
      id: 'evt-7',
      title: 'موعد تجديد الشهادة',
      titleEn: 'Certificate Renewal Deadline',
      type: 'deadline',
      date: '2026-03-01',
      description: 'آخر موعد لتجديد شهادة ISO 9001',
      priority: 'critical',
    },
    // More events for February
    {
      id: 'evt-8',
      title: 'مراجعة المشتريات',
      titleEn: 'Procurement Audit',
      type: 'audit',
      date: '2026-02-17',
      endDate: '2026-02-18',
      departmentId: 'dept-4',
      description: 'مراجعة عمليات الشراء والموردين',
      priority: 'medium',
      status: 'planning',
    },
    {
      id: 'evt-9',
      title: 'موعد تسليم تقرير الجودة',
      titleEn: 'Quality Report Deadline',
      type: 'deadline',
      date: '2026-02-28',
      description: 'تسليم تقرير الجودة الشهري',
      priority: 'medium',
    },
  ];
};

export default function CalendarPage() {
  const { t, language, isRTL } = useTranslation();
  const { currentUser, hasPermission } = useAuth();

  // State
  const [currentDate, setCurrentDate] = useState(new Date(2026, 1, 1)); // February 2026
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'month' | 'list'>('month');
  const [filterType, setFilterType] = useState<string>('all');
  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  // Load events
  useEffect(() => {
    // In real app, load from localStorage or API
    const storedAudits = localStorage.getItem('qms_audits');
    let loadedEvents = generateEvents();

    if (storedAudits) {
      try {
        const audits = JSON.parse(storedAudits);
        // Add audits as events
        audits.forEach((audit: any) => {
          if (audit.startDate) {
            loadedEvents.push({
              id: `audit-${audit.id}`,
              title: audit.titleAr,
              titleEn: audit.titleEn,
              type: 'audit',
              date: audit.startDate,
              endDate: audit.endDate,
              departmentId: audit.departmentId,
              description: audit.scope || audit.objective,
              priority: audit.type === 'external' ? 'critical' : 'high',
              status: audit.status,
              relatedId: audit.id,
            });
          }
        });
      } catch (e) {
        console.error('Error loading audits for calendar');
      }
    }

    setEvents(loadedEvents);
  }, []);

  // Filter events based on user role and permissions
  const filteredEvents = useMemo(() => {
    let filtered = events;

    // Filter by type
    if (filterType !== 'all') {
      filtered = filtered.filter(e => e.type === filterType);
    }

    // Role-based filtering
    if (!hasPermission('canViewAllData')) {
      // Non-admin users see only their department's events
      filtered = filtered.filter(e =>
        !e.departmentId || e.departmentId === currentUser?.departmentId
      );
    }

    return filtered;
  }, [events, filterType, currentUser, hasPermission]);

  // Get events for a specific date
  const getEventsForDate = (dateStr: string) => {
    return filteredEvents.filter(e => {
      if (e.date === dateStr) return true;
      if (e.endDate) {
        const start = new Date(e.date);
        const end = new Date(e.endDate);
        const check = new Date(dateStr);
        return check >= start && check <= end;
      }
      return false;
    });
  };

  // Calendar navigation
  const goToPrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date(2026, 1, 1)); // For demo, using Feb 2026
  };

  // Calendar data
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const monthNames = language === 'ar'
    ? ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
    : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const dayNames = language === 'ar'
    ? ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Event type styles
  const getEventStyle = (type: string) => {
    switch (type) {
      case 'audit':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700';
      case 'finding_due':
        return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700';
      case 'meeting':
        return 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700';
      case 'deadline':
        return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700';
      default:
        return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300';
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'audit':
        return ClipboardCheck;
      case 'finding_due':
        return AlertCircle;
      case 'meeting':
        return Users;
      case 'deadline':
        return Clock;
      default:
        return CalendarIcon;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'critical':
        return <Badge variant="danger">{language === 'ar' ? 'حرج' : 'Critical'}</Badge>;
      case 'high':
        return <Badge className="bg-orange-500">{language === 'ar' ? 'عالي' : 'High'}</Badge>;
      case 'medium':
        return <Badge className="bg-yellow-500">{language === 'ar' ? 'متوسط' : 'Medium'}</Badge>;
      case 'low':
        return <Badge variant="secondary">{language === 'ar' ? 'منخفض' : 'Low'}</Badge>;
      default:
        return null;
    }
  };

  // Get department name
  const getDepartmentName = (deptId?: string) => {
    if (!deptId) return '';
    const dept = allDepartments.find(d => d.id === deptId);
    return dept ? (language === 'ar' ? dept.nameAr : dept.nameEn) : '';
  };

  // Upcoming events (next 7 days from Feb 1, 2026)
  const upcomingEvents = useMemo(() => {
    const today = new Date(2026, 1, 1);
    const nextWeek = new Date(2026, 1, 8);
    return filteredEvents
      .filter(e => {
        const eventDate = new Date(e.date);
        return eventDate >= today && eventDate <= nextWeek;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [filteredEvents]);

  // Event type filter options
  const eventTypes = [
    { value: 'all', labelAr: 'الكل', labelEn: 'All' },
    { value: 'audit', labelAr: 'المراجعات', labelEn: 'Audits' },
    { value: 'finding_due', labelAr: 'مواعيد الملاحظات', labelEn: 'Finding Due Dates' },
    { value: 'meeting', labelAr: 'الاجتماعات', labelEn: 'Meetings' },
    { value: 'deadline', labelAr: 'المواعيد النهائية', labelEn: 'Deadlines' },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--foreground)]">
              {language === 'ar' ? 'التقويم' : 'Calendar'}
            </h1>
            <p className="text-sm text-[var(--foreground-secondary)] mt-1">
              {language === 'ar'
                ? 'عرض المراجعات والمواعيد والأحداث المهمة'
                : 'View audits, deadlines and important events'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* View Toggle */}
            <div className="flex items-center rounded-lg border border-[var(--border)] p-1">
              <button
                onClick={() => setViewMode('month')}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === 'month'
                    ? 'bg-[var(--primary)] text-white'
                    : 'text-[var(--foreground-secondary)] hover:bg-[var(--background-secondary)]'
                }`}
              >
                <Grid3X3 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === 'list'
                    ? 'bg-[var(--primary)] text-white'
                    : 'text-[var(--foreground-secondary)] hover:bg-[var(--background-secondary)]'
                }`}
              >
                <List className="h-4 w-4" />
              </button>
            </div>

            {/* Filter */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            >
              {eventTypes.map(type => (
                <option key={type.value} value={type.value}>
                  {language === 'ar' ? type.labelAr : type.labelEn}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Calendar / List View */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon-sm" onClick={goToPrevMonth}>
                      {isRTL ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                    </Button>
                    <h2 className="text-lg font-semibold min-w-[150px] text-center">
                      {monthNames[month]} {year}
                    </h2>
                    <Button variant="outline" size="icon-sm" onClick={goToNextMonth}>
                      {isRTL ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </Button>
                  </div>
                  <Button variant="outline" size="sm" onClick={goToToday}>
                    {language === 'ar' ? 'اليوم' : 'Today'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {viewMode === 'month' ? (
                  // Calendar Grid View
                  <div>
                    {/* Day Headers */}
                    <div className="grid grid-cols-7 mb-2">
                      {dayNames.map(day => (
                        <div key={day} className="p-2 text-center text-sm font-medium text-[var(--foreground-secondary)]">
                          {day}
                        </div>
                      ))}
                    </div>

                    {/* Calendar Days */}
                    <div className="grid grid-cols-7 gap-1">
                      {/* Empty cells for days before first day of month */}
                      {Array.from({ length: firstDay }).map((_, i) => (
                        <div key={`empty-${i}`} className="h-24 p-1 bg-[var(--background-secondary)] rounded-lg opacity-50" />
                      ))}

                      {/* Days of the month */}
                      {Array.from({ length: daysInMonth }).map((_, i) => {
                        const day = i + 1;
                        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        const dayEvents = getEventsForDate(dateStr);
                        const isToday = dateStr === '2026-02-01'; // Demo: Feb 1 is "today"
                        const isSelected = dateStr === selectedDate;

                        return (
                          <div
                            key={day}
                            onClick={() => setSelectedDate(dateStr)}
                            className={`h-24 p-1 rounded-lg border cursor-pointer transition-all overflow-hidden ${
                              isToday
                                ? 'border-[var(--primary)] bg-[var(--primary-light)]'
                                : isSelected
                                  ? 'border-[var(--primary)] bg-[var(--background)]'
                                  : 'border-transparent bg-[var(--background)] hover:bg-[var(--background-secondary)]'
                            }`}
                          >
                            <div className={`text-sm font-medium mb-1 ${
                              isToday ? 'text-[var(--primary)]' : 'text-[var(--foreground)]'
                            }`}>
                              {day}
                            </div>
                            <div className="space-y-0.5 overflow-hidden">
                              {dayEvents.slice(0, 2).map(event => {
                                const Icon = getEventIcon(event.type);
                                return (
                                  <div
                                    key={event.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedEvent(event);
                                      setShowEventModal(true);
                                    }}
                                    className={`text-xs px-1.5 py-0.5 rounded truncate flex items-center gap-1 border ${getEventStyle(event.type)}`}
                                  >
                                    <Icon className="h-3 w-3 shrink-0" />
                                    <span className="truncate">{language === 'ar' ? event.title : event.titleEn}</span>
                                  </div>
                                );
                              })}
                              {dayEvents.length > 2 && (
                                <div className="text-xs text-[var(--foreground-secondary)] px-1">
                                  +{dayEvents.length - 2} {language === 'ar' ? 'أخرى' : 'more'}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  // List View
                  <div className="space-y-3">
                    {filteredEvents
                      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                      .map(event => {
                        const Icon = getEventIcon(event.type);
                        return (
                          <div
                            key={event.id}
                            onClick={() => {
                              setSelectedEvent(event);
                              setShowEventModal(true);
                            }}
                            className={`p-4 rounded-xl border cursor-pointer transition-all hover:shadow-md ${getEventStyle(event.type)}`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-start gap-3">
                                <div className="p-2 rounded-lg bg-white/50 dark:bg-black/20">
                                  <Icon className="h-5 w-5" />
                                </div>
                                <div>
                                  <h3 className="font-medium">{language === 'ar' ? event.title : event.titleEn}</h3>
                                  <p className="text-sm opacity-80 mt-0.5">{event.description}</p>
                                  <div className="flex items-center gap-3 mt-2 text-xs opacity-70">
                                    <span className="flex items-center gap-1">
                                      <CalendarIcon className="h-3 w-3" />
                                      {event.date}
                                      {event.endDate && ` - ${event.endDate}`}
                                    </span>
                                    {event.departmentId && (
                                      <span className="flex items-center gap-1">
                                        <MapPin className="h-3 w-3" />
                                        {getDepartmentName(event.departmentId)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              {getPriorityBadge(event.priority)}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - Upcoming Events */}
          <div className="space-y-6">
            {/* Upcoming Events */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Bell className="h-4 w-4 text-[var(--primary)]" />
                  {language === 'ar' ? 'الأحداث القادمة' : 'Upcoming Events'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {upcomingEvents.length > 0 ? (
                  upcomingEvents.map(event => {
                    const Icon = getEventIcon(event.type);
                    return (
                      <div
                        key={event.id}
                        onClick={() => {
                          setSelectedEvent(event);
                          setShowEventModal(true);
                        }}
                        className="p-3 rounded-lg bg-[var(--background-secondary)] cursor-pointer hover:bg-[var(--background-tertiary)] transition-colors"
                      >
                        <div className="flex items-start gap-2">
                          <Icon className={`h-4 w-4 mt-0.5 ${
                            event.type === 'audit' ? 'text-blue-500' :
                            event.type === 'finding_due' ? 'text-orange-500' :
                            event.type === 'deadline' ? 'text-red-500' : 'text-purple-500'
                          }`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {language === 'ar' ? event.title : event.titleEn}
                            </p>
                            <p className="text-xs text-[var(--foreground-secondary)]">
                              {event.date}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-[var(--foreground-secondary)] text-center py-4">
                    {language === 'ar' ? 'لا توجد أحداث قادمة' : 'No upcoming events'}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Legend */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {language === 'ar' ? 'دليل الألوان' : 'Legend'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-blue-500" />
                  <span className="text-sm">{language === 'ar' ? 'مراجعات' : 'Audits'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-orange-500" />
                  <span className="text-sm">{language === 'ar' ? 'مواعيد الملاحظات' : 'Finding Due Dates'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-purple-500" />
                  <span className="text-sm">{language === 'ar' ? 'اجتماعات' : 'Meetings'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-red-500" />
                  <span className="text-sm">{language === 'ar' ? 'مواعيد نهائية' : 'Deadlines'}</span>
                </div>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {language === 'ar' ? 'إحصائيات الشهر' : 'Month Stats'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--foreground-secondary)]">
                    {language === 'ar' ? 'المراجعات' : 'Audits'}
                  </span>
                  <span className="font-semibold">
                    {filteredEvents.filter(e => e.type === 'audit').length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--foreground-secondary)]">
                    {language === 'ar' ? 'الملاحظات المستحقة' : 'Due Findings'}
                  </span>
                  <span className="font-semibold text-orange-500">
                    {filteredEvents.filter(e => e.type === 'finding_due').length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--foreground-secondary)]">
                    {language === 'ar' ? 'المواعيد النهائية' : 'Deadlines'}
                  </span>
                  <span className="font-semibold text-red-500">
                    {filteredEvents.filter(e => e.type === 'deadline').length}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Event Detail Modal */}
        {showEventModal && selectedEvent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowEventModal(false)} />
            <div className="relative w-full max-w-lg rounded-2xl bg-[var(--card)] p-6 shadow-xl">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  {(() => {
                    const Icon = getEventIcon(selectedEvent.type);
                    return (
                      <div className={`p-3 rounded-xl ${getEventStyle(selectedEvent.type)}`}>
                        <Icon className="h-6 w-6" />
                      </div>
                    );
                  })()}
                  <div>
                    <h2 className="text-lg font-bold">
                      {language === 'ar' ? selectedEvent.title : selectedEvent.titleEn}
                    </h2>
                    <p className="text-sm text-[var(--foreground-secondary)]">
                      {eventTypes.find(t => t.value === selectedEvent.type)?.[language === 'ar' ? 'labelAr' : 'labelEn']}
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="icon-sm" onClick={() => setShowEventModal(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-4">
                {selectedEvent.description && (
                  <div>
                    <h4 className="text-sm font-medium text-[var(--foreground-secondary)] mb-1">
                      {language === 'ar' ? 'الوصف' : 'Description'}
                    </h4>
                    <p className="text-sm">{selectedEvent.description}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-[var(--foreground-secondary)] mb-1">
                      {language === 'ar' ? 'التاريخ' : 'Date'}
                    </h4>
                    <p className="text-sm flex items-center gap-1">
                      <CalendarIcon className="h-4 w-4" />
                      {selectedEvent.date}
                      {selectedEvent.endDate && ` - ${selectedEvent.endDate}`}
                    </p>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-[var(--foreground-secondary)] mb-1">
                      {language === 'ar' ? 'الأولوية' : 'Priority'}
                    </h4>
                    {getPriorityBadge(selectedEvent.priority)}
                  </div>

                  {selectedEvent.departmentId && (
                    <div>
                      <h4 className="text-sm font-medium text-[var(--foreground-secondary)] mb-1">
                        {language === 'ar' ? 'الإدارة' : 'Department'}
                      </h4>
                      <p className="text-sm flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {getDepartmentName(selectedEvent.departmentId)}
                      </p>
                    </div>
                  )}

                  {selectedEvent.status && (
                    <div>
                      <h4 className="text-sm font-medium text-[var(--foreground-secondary)] mb-1">
                        {language === 'ar' ? 'الحالة' : 'Status'}
                      </h4>
                      <Badge variant="secondary">{selectedEvent.status}</Badge>
                    </div>
                  )}
                </div>

                {selectedEvent.relatedId && (
                  <div className="pt-4 border-t border-[var(--border)]">
                    <Button variant="outline" className="w-full">
                      <Eye className="h-4 w-4 me-2" />
                      {language === 'ar' ? 'عرض التفاصيل' : 'View Details'}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
