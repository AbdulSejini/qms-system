'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout';
import { Card, CardContent, Skeleton } from '@/components/ui';
import { Button, Badge } from '@/components/ui';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui';
import { useTranslation } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { subscribeToActivityLog } from '@/lib/activity-log';
import { getRoleNameAr, getRoleNameEn } from '@/data/mock-data';
import type { ActivityEntry, UserRole } from '@/types';
import {
  Search,
  ShieldAlert,
  History,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  ArrowLeft,
  X,
} from 'lucide-react';

// The activity log grows without bound, so the page never asks for all of it. It starts with
// one page and grows the window on demand - the reader who needs last year has to say so.
const PAGE_SIZE = 50;

// The action types recorded by src/lib/activity-log.ts (ActivityAction in @/types)
const ACTION_TYPES = [
  'login',
  'logout',
  'login_failed',
  'create',
  'update',
  'delete',
  'approve',
  'reject',
  'submit',
  'password_change',
] as const;

// The entity kinds the log names. Kept as plain strings because ActivityEntry.entity is a
// string - an entry written for something not listed here still displays, it is just not
// offered as a filter option.
const ENTITY_TYPES = [
  'audit',
  'finding',
  'annualPlan',
  'user',
  'department',
  'section',
  'session',
] as const;

// Roles that have a translated display name; anything else is shown as stored
const ROLE_KEYS: UserRole[] = [
  'system_admin',
  'quality_manager',
  'auditor',
  'department_manager',
  'section_head',
  'employee',
];

// Colour per action so a page of entries can be scanned rather than read
const ACTION_VARIANT: Record<string, 'success' | 'info' | 'danger' | 'warning' | 'primary' | 'approved' | 'rejected' | 'draft'> = {
  login: 'info',
  logout: 'draft',
  login_failed: 'danger',
  create: 'success',
  update: 'info',
  delete: 'danger',
  approve: 'approved',
  reject: 'rejected',
  submit: 'primary',
  password_change: 'warning',
};

// One actor as offered in the "by person" filter
interface ActorOption {
  id: string;
  name: string;
  role: string;
}

export default function ActivityPage() {
  const router = useRouter();
  const { t, language, isRTL } = useTranslation();
  const { currentUser } = useAuth();

  // The log is the system administrator's record of everyone else. firestore.rules denies the
  // read to anybody else regardless, but the page must refuse rather than show an empty table.
  const isSystemAdmin = currentUser?.role === 'system_admin';

  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [limitTo, setLimitTo] = useState(PAGE_SIZE);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedActor, setSelectedActor] = useState('all');
  const [selectedAction, setSelectedAction] = useState('all');
  const [selectedEntity, setSelectedEntity] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Rows whose field-level changes are open
  const [expandedIds, setExpandedIds] = useState<string[]>([]);

  // Everyone ever seen in the log, accumulated across snapshots. Built from the entries rather
  // than from the users list on purpose: it then also offers people whose user document has
  // since been deleted, and it does not collapse to one name while a person filter is applied.
  const [actors, setActors] = useState<ActorOption[]>([]);

  // A person or entity filter is pushed down to Firestore (see buildQuery in activity-log.ts);
  // everything else is applied below, over the loaded window.
  useEffect(() => {
    if (!isSystemAdmin) return;

    // `loading` is only ever cleared, never re-raised: a widened window or a changed filter
    // keeps the rows already on screen until the new snapshot lands, instead of flashing the
    // skeleton over a table the reader is in the middle of scanning.
    const unsubscribe = subscribeToActivityLog(
      (rows) => {
        setEntries(rows);
        setLoading(false);

        // Merge, never replace - a filtered snapshot must not shrink the person list
        setActors((previous) => {
          const known = new Map(previous.map(a => [a.id, a]));
          let added = false;

          rows.forEach((row) => {
            if (!row.actorUserId || known.has(row.actorUserId)) return;
            known.set(row.actorUserId, {
              id: row.actorUserId,
              name: row.actorName || row.actorEmail || row.actorUserId,
              role: row.actorRole || '',
            });
            added = true;
          });

          if (!added) return previous;
          return Array.from(known.values()).sort((a, b) => a.name.localeCompare(b.name));
        });
      },
      {
        limitTo,
        actorUserId: selectedActor !== 'all' ? selectedActor : undefined,
        entity: selectedEntity !== 'all' ? selectedEntity : undefined,
      }
    );

    return () => unsubscribe();
  }, [isSystemAdmin, limitTo, selectedActor, selectedEntity]);

  // A translated label, falling back to the stored value for anything the locales do not name
  const labelFor = (key: string, fallback: string) => {
    const translated = t(key);
    return translated === key ? fallback : translated;
  };

  const actionLabel = (action: string) => labelFor(`activity.actions.${action}`, action);
  const entityLabel = (entity: string) => labelFor(`activity.entities.${entity}`, entity);

  const roleLabel = (role: string) => {
    if (ROLE_KEYS.includes(role as UserRole)) {
      return language === 'ar' ? getRoleNameAr(role as UserRole) : getRoleNameEn(role as UserRole);
    }
    return role;
  };

  const formatWhen = (iso: string) => {
    const date = new Date(iso ?? '');
    if (Number.isNaN(date.getTime())) return iso || '-';
    return date.toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const summaryOf = (entry: ActivityEntry) =>
    (language === 'ar' ? entry.summaryAr : entry.summaryEn) || entry.summaryEn || entry.summaryAr || '';

  // Action, dates and free text are filtered here - the query already applied person/entity
  const filteredEntries = useMemo(() => {
    const search = searchQuery.trim().toLowerCase();
    // Inclusive bounds: "to 12 Aug" means everything that happened on 12 Aug
    const fromTime = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
    const toTime = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null;

    return entries.filter((entry) => {
      if (selectedAction !== 'all' && entry.action !== selectedAction) return false;

      if (fromTime !== null || toTime !== null) {
        const at = Date.parse(entry.at ?? '');
        if (Number.isNaN(at)) return false;
        if (fromTime !== null && at < fromTime) return false;
        if (toTime !== null && at > toTime) return false;
      }

      if (search) {
        const haystack = [
          entry.summaryAr,
          entry.summaryEn,
          entry.entityLabel,
          entry.actorName,
        ].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(search)) return false;
      }

      return true;
    });
  }, [entries, selectedAction, dateFrom, dateTo, searchQuery]);

  // The reader asked for `limitTo` and got exactly that many - there is probably more behind it
  const hasMore = entries.length >= limitTo;

  const hasActiveFilters =
    searchQuery !== '' ||
    selectedActor !== 'all' ||
    selectedAction !== 'all' ||
    selectedEntity !== 'all' ||
    dateFrom !== '' ||
    dateTo !== '';

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedActor('all');
    setSelectedAction('all');
    setSelectedEntity('all');
    setDateFrom('');
    setDateTo('');
    setLimitTo(PAGE_SIZE);
  };

  const toggleExpanded = (id: string) => {
    setExpandedIds((previous) =>
      previous.includes(id) ? previous.filter(x => x !== id) : [...previous, id]
    );
  };

  // Changing a pushed-down filter changes the query - start its window from the top again
  const changeActor = (value: string) => {
    setSelectedActor(value);
    setLimitTo(PAGE_SIZE);
  };

  const changeEntity = (value: string) => {
    setSelectedEntity(value);
    setLimitTo(PAGE_SIZE);
  };

  const inputClass =
    'w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-opacity-20';

  // Anyone other than the system administrator is refused here, before a read is attempted
  if (!isSystemAdmin) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 mb-6">
            <ShieldAlert className="h-10 w-10 text-red-600 dark:text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--foreground)] mb-2">
            {t('activity.accessDeniedTitle')}
          </h1>
          <p className="text-[var(--foreground-secondary)] mb-6 max-w-md">
            {t('activity.accessDenied')}
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[var(--primary-hover)]"
          >
            {t('activity.backToDashboard')}
          </button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-[var(--foreground)]">
              <History className="h-6 w-6 text-[var(--primary)]" />
              {t('activity.title')}
            </h1>
            <p className="mt-1 text-[var(--foreground-secondary)]">
              {t('activity.subtitle')}
            </p>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                {/* Free-text search over the summary */}
                <div className="relative flex-1">
                  <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--foreground-muted)]" />
                  <input
                    type="text"
                    placeholder={t('activity.searchPlaceholder')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] py-2 ps-10 pe-4 text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-muted)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-opacity-20"
                  />
                </div>

                {/* By person */}
                <select
                  value={selectedActor}
                  onChange={(e) => changeActor(e.target.value)}
                  title={t('activity.person')}
                  className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-opacity-20"
                >
                  <option value="all">{t('activity.allPeople')}</option>
                  {actors.map((actor) => (
                    <option key={actor.id} value={actor.id}>{actor.name}</option>
                  ))}
                </select>

                {/* By action */}
                <select
                  value={selectedAction}
                  onChange={(e) => setSelectedAction(e.target.value)}
                  title={t('activity.action')}
                  className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-opacity-20"
                >
                  <option value="all">{t('activity.allActions')}</option>
                  {ACTION_TYPES.map((action) => (
                    <option key={action} value={action}>{actionLabel(action)}</option>
                  ))}
                </select>

                {/* By entity */}
                <select
                  value={selectedEntity}
                  onChange={(e) => changeEntity(e.target.value)}
                  title={t('activity.entity')}
                  className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-opacity-20"
                >
                  <option value="all">{t('activity.allEntities')}</option>
                  {ENTITY_TYPES.map((entity) => (
                    <option key={entity} value={entity}>{entityLabel(entity)}</option>
                  ))}
                </select>
              </div>

              {/* Date range */}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                <div className="sm:w-48">
                  <label className="block text-xs font-medium text-[var(--foreground-secondary)] mb-1">
                    {t('activity.dateFrom')}
                  </label>
                  <input
                    type="date"
                    value={dateFrom}
                    max={dateTo || undefined}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="sm:w-48">
                  <label className="block text-xs font-medium text-[var(--foreground-secondary)] mb-1">
                    {t('activity.dateTo')}
                  </label>
                  <input
                    type="date"
                    value={dateTo}
                    min={dateFrom || undefined}
                    onChange={(e) => setDateTo(e.target.value)}
                    className={inputClass}
                  />
                </div>
                {hasActiveFilters && (
                  <Button variant="outline" leftIcon={<X className="h-4 w-4" />} onClick={clearFilters}>
                    {t('activity.clearFilters')}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <Card>
            <div className="p-4 space-y-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="flex items-center justify-between">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-48" />
                </div>
              ))}
            </div>
          </Card>
        ) : (
          <>
            {/* Result count - says what is on screen, not what exists in the collection */}
            <p className="text-sm text-[var(--foreground-secondary)]">
              {`${filteredEntries.length} ${t('activity.entriesShown')} · ${entries.length} ${t('activity.entriesLoaded')}`}
            </p>

            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">{t('activity.when')}</TableHead>
                    <TableHead>{t('activity.who')}</TableHead>
                    <TableHead>{t('activity.action')}</TableHead>
                    <TableHead>{t('activity.entity')}</TableHead>
                    <TableHead>{t('activity.summary')}</TableHead>
                    <TableHead className="text-center">{t('activity.details')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEntries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-[var(--foreground-secondary)]">
                        <p className="text-sm">{t('activity.empty')}</p>
                        {hasMore && (
                          <p className="mt-1 text-xs text-[var(--foreground-muted)]">{t('activity.emptyHint')}</p>
                        )}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredEntries.map((entry) => {
                      const isExpanded = expandedIds.includes(entry.id);
                      const changes = entry.changes ?? [];

                      return (
                        <React.Fragment key={entry.id}>
                          <TableRow>
                            <TableCell className="py-2 whitespace-nowrap font-mono text-xs text-[var(--foreground-secondary)]">
                              {formatWhen(entry.at)}
                            </TableCell>
                            <TableCell className="py-2">
                              <p className="text-sm font-medium">{entry.actorName || entry.actorEmail || '-'}</p>
                              <p className="text-xs text-[var(--foreground-muted)]">{roleLabel(entry.actorRole)}</p>
                            </TableCell>
                            <TableCell className="py-2">
                              <Badge variant={ACTION_VARIANT[entry.action] ?? 'default'}>
                                {actionLabel(entry.action)}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-2">
                              <p className="text-sm">{entityLabel(entry.entity)}</p>
                              {entry.entityLabel && (
                                <p className="text-xs text-[var(--foreground-muted)] max-w-[16rem] truncate" title={entry.entityLabel}>
                                  {entry.entityLabel}
                                </p>
                              )}
                            </TableCell>
                            <TableCell className="py-2">
                              <p className="text-sm text-[var(--foreground-secondary)]">{summaryOf(entry)}</p>
                            </TableCell>
                            <TableCell className="py-2 text-center">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                disabled={changes.length === 0}
                                title={changes.length === 0
                                  ? t('activity.noChanges')
                                  : (isExpanded ? t('activity.collapse') : t('activity.expand'))}
                                onClick={() => toggleExpanded(entry.id)}
                              >
                                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </Button>
                            </TableCell>
                          </TableRow>

                          {isExpanded && changes.length > 0 && (
                            <TableRow>
                              <TableCell colSpan={6} className="bg-[var(--background-secondary)] py-3">
                                <p className="mb-2 text-xs font-semibold text-[var(--foreground-secondary)]">
                                  {t('activity.changes')}
                                </p>
                                <div className="space-y-2">
                                  {changes.map((change, index) => (
                                    <div
                                      key={`${entry.id}-${change.field}-${index}`}
                                      className="flex flex-col gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)] p-2 sm:flex-row sm:items-center"
                                    >
                                      <span className="font-mono text-xs font-medium text-[var(--foreground)] sm:w-48 sm:shrink-0">
                                        {change.field}
                                      </span>
                                      <div className="flex flex-1 items-center gap-2 min-w-0">
                                        <span className="flex-1 truncate rounded bg-[var(--status-error-bg)] px-2 py-1 text-xs text-[var(--status-error)]" title={change.from || ''}>
                                          {change.from || t('activity.emptyValue')}
                                        </span>
                                        {isRTL
                                          ? <ArrowLeft className="h-3.5 w-3.5 shrink-0 text-[var(--foreground-muted)]" />
                                          : <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[var(--foreground-muted)]" />}
                                        <span className="flex-1 truncate rounded bg-[var(--status-success-bg)] px-2 py-1 text-xs text-[var(--status-success)]" title={change.to || ''}>
                                          {change.to || t('activity.emptyValue')}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </Card>

            {/* Load more - the collection grows forever, so the window grows only on request */}
            {hasMore && (
              <div className="flex justify-center">
                <Button variant="outline" onClick={() => setLimitTo(limitTo + PAGE_SIZE)}>
                  {t('activity.loadMore')}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
