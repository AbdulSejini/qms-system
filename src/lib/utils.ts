import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { DocumentStatus, AuditStatus, FindingSeverity, FindingStatus } from '@/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string, locale: 'ar' | 'en' = 'ar'): string {
  const d = new Date(date);
  return d.toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(date: Date | string, locale: 'ar' | 'en' = 'ar'): string {
  const d = new Date(date);
  return d.toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function generateDocumentNumber(): string {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `DOC-${year}-${random}`;
}

export function generateAuditNumber(): string {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `AUD-${year}-${random}`;
}

export function generateFindingNumber(auditNumber: string): string {
  const random = Math.floor(Math.random() * 100).toString().padStart(2, '0');
  return `${auditNumber}-F${random}`;
}

export function getDocumentStatusColor(status: DocumentStatus): string {
  switch (status) {
    case 'approved':
      return 'var(--status-success)';
    case 'pending_review':
      return 'var(--status-warning)';
    case 'rejected':
      return 'var(--status-error)';
    case 'draft':
      return 'var(--foreground-secondary)';
    case 'archived':
      return 'var(--foreground-muted)';
    default:
      return 'var(--foreground-muted)';
  }
}

export function getAuditStatusColor(status: AuditStatus): string {
  switch (status) {
    case 'completed':
      return 'var(--status-success)';
    case 'in_progress':
      return 'var(--status-info)';
    case 'planned':
      return 'var(--status-warning)';
    case 'cancelled':
      return 'var(--status-error)';
    default:
      return 'var(--foreground-muted)';
  }
}

export function getFindingSeverityColor(severity: FindingSeverity): string {
  switch (severity) {
    case 'critical':
      return 'var(--risk-critical)';
    case 'major':
      return 'var(--risk-high)';
    case 'minor':
      return 'var(--risk-medium)';
    case 'observation':
      return 'var(--risk-low)';
    default:
      return 'var(--foreground-muted)';
  }
}

export function getFindingStatusColor(status: FindingStatus): string {
  switch (status) {
    case 'closed':
    case 'verified':
      return 'var(--status-success)';
    case 'in_progress':
      return 'var(--status-info)';
    case 'open':
      return 'var(--status-warning)';
    default:
      return 'var(--foreground-muted)';
  }
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

export function debounce<T extends (...args: Parameters<T>) => ReturnType<T>>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function calculateProgress(completed: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((completed / total) * 100);
}

export function isOverdue(dueDate: Date | string): boolean {
  return new Date(dueDate) < new Date();
}

export function getDaysUntilDue(dueDate: Date | string): number {
  const due = new Date(dueDate);
  const now = new Date();
  const diffTime = due.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}
