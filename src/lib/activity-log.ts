// System activity log - سجل نشاط النظام
//
// A permanent, append-only record of who signed in and who created, changed or deleted
// anything in the system. It replaces the old "who is online" feature: a list of open tabs
// answered no question anyone had, whereas an auditor's system is expected to be able to
// say who did what, and when, long after the fact.
//
// Readable by the SYSTEM ADMINISTRATOR ONLY - that restriction lives in firestore.rules
// (activityLog: `allow list, get: if isAdmin()`), not here, so it holds no matter which
// screen calls these functions.
//
// APPEND-ONLY: this file exports no update and no delete helper, on purpose. A log that the
// application can rewrite is not evidence of anything. Entries are written once, by
// recordActivity, and read back by getActivityLog / subscribeToActivityLog.
import {
  collection,
  doc,
  getDocs,
  setDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  QueryConstraint,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import { logger } from './logger';
import { COLLECTIONS } from './firestore';
import { ActivityEntry } from '@/types';

// How many entries the readers return when the caller does not say
const DEFAULT_LIMIT = 200;

// Options accepted by both readers
export interface ActivityLogOptions {
  limitTo?: number;
  actorUserId?: string;
  entity?: string;
}

// ===========================================
// Helpers
// ===========================================

// Firestore rejects undefined at any depth, and ActivityEntry has four optional fields.
// Only the top level and the `changes` entries can carry one, so a shallow pass is enough.
const stripUndefined = (data: Record<string, unknown>): Record<string, unknown> => {
  const cleaned: Record<string, unknown> = {};

  Object.keys(data).forEach(key => {
    const value = data[key];
    if (value === undefined) return;

    if (key === 'changes' && Array.isArray(value)) {
      cleaned[key] = value.map(change =>
        stripUndefined(change as Record<string, unknown>)
      );
      return;
    }

    cleaned[key] = value;
  });

  return cleaned;
};

// Render any stored value as a string a human can read in a diff. Never throws: a log entry
// is worth having even when one of its fields is something unexpected.
const stringifyValue = (value: unknown): string => {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();

  // Firestore Timestamps arrive as class instances with toDate()
  const maybeTimestamp = value as { toDate?: () => Date };
  if (typeof maybeTimestamp.toDate === 'function') {
    try {
      return maybeTimestamp.toDate().toISOString();
    } catch {
      // fall through to JSON below
    }
  }

  try {
    return JSON.stringify(value) ?? '';
  } catch {
    // Circular structure, or a value JSON cannot represent
    return '[unreadable value]';
  }
};

// Sort newest first. Entries whose `at` is missing or unparseable sort last rather than
// throwing the whole list into an arbitrary order.
const byNewestFirst = (a: ActivityEntry, b: ActivityEntry): number => {
  const aTime = Date.parse(a.at ?? '');
  const bTime = Date.parse(b.at ?? '');
  return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime);
};

// Build the Firestore query for the given options.
//
// At most ONE equality filter is pushed down, and orderBy is never combined with it: an
// equality filter plus an orderBy on a different field needs a composite index, and this
// project is on the Spark plan with no deployment step that creates one - the query would
// simply fail in production. So a filtered read is sorted and cut in JavaScript instead
// (see readEntries), exactly as subscribeToNotifications already does.
const buildQuery = (options?: ActivityLogOptions) => {
  const logRef = collection(db, COLLECTIONS.ACTIVITY_LOG);
  const constraints: QueryConstraint[] = [];

  if (options?.actorUserId) {
    constraints.push(where('actorUserId', '==', options.actorUserId));
  } else if (options?.entity) {
    constraints.push(where('entity', '==', options.entity));
  } else {
    // Unfiltered: the common case (the administrator opening the log), and the one that
    // can be served straight from the automatic single-field index on `at`.
    constraints.push(orderBy('at', 'desc'));
    constraints.push(limit(options?.limitTo ?? DEFAULT_LIMIT));
  }

  return query(logRef, ...constraints);
};

// Turn a snapshot into the finished list: apply whichever filter was not pushed down,
// sort newest first, then cut to the requested size.
const readEntries = (
  docs: { id: string; data: () => Record<string, unknown> }[],
  options?: ActivityLogOptions
): ActivityEntry[] => {
  let entries = docs.map(d => ({ ...d.data(), id: d.id }) as ActivityEntry);

  if (options?.actorUserId) {
    entries = entries.filter(e => e.actorUserId === options.actorUserId);
  }
  if (options?.entity) {
    entries = entries.filter(e => e.entity === options.entity);
  }

  return entries.sort(byNewestFirst).slice(0, options?.limitTo ?? DEFAULT_LIMIT);
};

// ===========================================
// Writing
// ===========================================

// Record one thing that happened.
//
// Fire-and-forget by construction: the Firestore write is started and NOT awaited, so this
// returns to the caller immediately, and any failure is swallowed after being logged to the
// console. That is the whole contract - an audit-log write that failed must never break, delay
// or report an error on the operation it was describing. Callers may `await` it if that reads
// better at the call site; it resolves either way and never rejects.
export const recordActivity = async (entry: Omit<ActivityEntry, 'id' | 'at'>): Promise<void> => {
  try {
    const id = `act-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const at = new Date().toISOString();

    const payload = stripUndefined({ ...entry, id, at });

    // Deliberately not awaited - see above
    void setDoc(doc(db, COLLECTIONS.ACTIVITY_LOG, id), payload).catch(error => {
      logger.error('Could not record activity log entry:', entry.action, entry.entity, error);
    });
  } catch (error) {
    // Something threw before the write was even started (a value that could not be
    // prepared, an unavailable db). Still nothing the user should ever see.
    logger.error('Could not record activity log entry:', error);
  }
};

// ===========================================
// Reading - system administrator only (enforced in firestore.rules)
// ===========================================

// Read the log once. Returns [] on failure - including the permission-denied that anyone
// other than the system administrator receives.
export const getActivityLog = async (options?: ActivityLogOptions): Promise<ActivityEntry[]> => {
  try {
    const snapshot = await getDocs(buildQuery(options));
    return readEntries(snapshot.docs, options);
  } catch (error) {
    console.error('Error getting activity log:', error);
    return [];
  }
};

// Watch the log in real time. Same options as getActivityLog.
export const subscribeToActivityLog = (
  callback: (entries: ActivityEntry[]) => void,
  options?: ActivityLogOptions
): Unsubscribe => {
  return onSnapshot(buildQuery(options), (snapshot) => {
    callback(readEntries(snapshot.docs, options));
  }, (error) => {
    console.error('Error listening to activity log:', error);
    callback([]);
  });
};

// ===========================================
// Diffing
// ===========================================

// Produce the field-level diff for an 'update' entry: for each named field, what it was and
// what it became. Unchanged fields are skipped, so the log says what actually changed rather
// than restating the whole record.
//
// Returns undefined when nothing in `fields` changed - a caller can then either skip logging
// or log an update with no `changes` key, and Firestore is never handed an empty array.
// Values are compared as their rendered strings, so a Date and its ISO string, or 2 and "2",
// count as equal - which matches what a reader of the log would conclude anyway.
export const buildChangeList = (
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fields: string[]
): ActivityEntry['changes'] => {
  const changes: NonNullable<ActivityEntry['changes']> = [];

  fields.forEach(field => {
    const from = stringifyValue(before?.[field]);
    const to = stringifyValue(after?.[field]);

    if (from === to) return;

    changes.push({ field, from, to });
  });

  return changes.length > 0 ? changes : undefined;
};
