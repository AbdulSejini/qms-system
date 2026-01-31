'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:
          'bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] focus-visible:ring-[var(--primary)]',
        secondary:
          'bg-[var(--secondary)] text-white hover:bg-[var(--secondary-hover)] focus-visible:ring-[var(--secondary)]',
        outline:
          'border-2 border-[var(--border)] bg-transparent text-[var(--foreground)] hover:bg-[var(--background-secondary)] hover:border-[var(--border-hover)]',
        ghost:
          'bg-transparent text-[var(--foreground)] hover:bg-[var(--background-secondary)]',
        danger:
          'bg-[var(--status-error)] text-white hover:opacity-90 focus-visible:ring-[var(--status-error)]',
        success:
          'bg-[var(--status-success)] text-white hover:opacity-90 focus-visible:ring-[var(--status-success)]',
        warning:
          'bg-[var(--status-warning)] text-white hover:opacity-90 focus-visible:ring-[var(--status-warning)]',
        link:
          'text-[var(--primary)] underline-offset-4 hover:underline bg-transparent',
      },
      size: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-base',
        icon: 'h-10 w-10',
        'icon-sm': 'h-8 w-8',
        'icon-lg': 'h-12 w-12',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, isLoading, leftIcon, rightIcon, children, disabled, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <svg
            className="h-4 w-4 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : (
          leftIcon
        )}
        {children}
        {!isLoading && rightIcon}
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button, buttonVariants };
