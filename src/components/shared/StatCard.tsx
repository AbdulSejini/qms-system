'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
  onClick?: () => void;
}

const colorClasses = {
  primary: {
    bg: 'bg-[var(--primary-light)]',
    icon: 'text-[var(--primary)]',
    trend: 'text-[var(--primary)]',
  },
  success: {
    bg: 'bg-[var(--status-success-bg)]',
    icon: 'text-[var(--status-success)]',
    trend: 'text-[var(--status-success)]',
  },
  warning: {
    bg: 'bg-[var(--status-warning-bg)]',
    icon: 'text-[var(--status-warning)]',
    trend: 'text-[var(--status-warning)]',
  },
  danger: {
    bg: 'bg-[var(--status-error-bg)]',
    icon: 'text-[var(--status-error)]',
    trend: 'text-[var(--status-error)]',
  },
  info: {
    bg: 'bg-[var(--status-info-bg)]',
    icon: 'text-[var(--status-info)]',
    trend: 'text-[var(--status-info)]',
  },
};

export function StatCard({ title, value, icon: Icon, trend, color = 'primary', onClick }: StatCardProps) {
  const colors = colorClasses[color];

  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm transition-all duration-200',
        onClick && 'cursor-pointer hover:shadow-md hover:-translate-y-0.5'
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-[var(--foreground-secondary)]">{title}</p>
          <p className="mt-2 text-3xl font-bold text-[var(--foreground)]">{value}</p>
          {trend && (
            <div className="mt-2 flex items-center gap-1">
              <span className={cn('text-sm font-medium', colors.trend)}>
                {trend.isPositive ? '+' : '-'}{Math.abs(trend.value)}%
              </span>
              <span className="text-xs text-[var(--foreground-muted)]">
                من الشهر الماضي
              </span>
            </div>
          )}
        </div>
        <div className={cn('flex h-12 w-12 items-center justify-center rounded-xl', colors.bg)}>
          <Icon className={cn('h-6 w-6', colors.icon)} />
        </div>
      </div>
    </div>
  );
}
