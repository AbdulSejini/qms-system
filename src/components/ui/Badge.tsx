'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';

const badgeVariants = cva(
  'inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-[var(--background-secondary)] text-[var(--foreground)]',
        primary: 'bg-[var(--primary)] text-white',
        secondary: 'bg-[var(--secondary)] text-white',
        success: 'bg-[var(--status-success)] text-white',
        warning: 'bg-[var(--status-warning)] text-white',
        danger: 'bg-[var(--status-error)] text-white',
        info: 'bg-[var(--status-info)] text-white',
        outline: 'border border-[var(--border)] bg-transparent text-[var(--foreground)]',
        // Document Statuses
        draft: 'bg-[var(--background-tertiary)] text-[var(--foreground-secondary)]',
        pending: 'bg-[var(--status-warning-bg)] text-[var(--status-warning)]',
        approved: 'bg-[var(--status-success-bg)] text-[var(--status-success)]',
        rejected: 'bg-[var(--status-error-bg)] text-[var(--status-error)]',
        archived: 'bg-[var(--foreground-tertiary)] text-[var(--foreground-secondary)]',
        // Finding Severities
        critical: 'bg-[var(--risk-critical-bg)] text-[var(--risk-critical)]',
        major: 'bg-[var(--risk-high-bg)] text-[var(--risk-high)]',
        minor: 'bg-[var(--risk-medium-bg)] text-[var(--risk-medium)]',
        observation: 'bg-[var(--risk-low-bg)] text-[var(--risk-low)]',
      },
      size: {
        sm: 'px-2 py-0.5 text-xs',
        md: 'px-2.5 py-0.5 text-xs',
        lg: 'px-3 py-1 text-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(badgeVariants({ variant, size, className }))}
        {...props}
      />
    );
  }
);

Badge.displayName = 'Badge';

export { Badge, badgeVariants };
