import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default:
          'border-[var(--color-border)] bg-[var(--color-bg-muted)] text-[var(--color-fg-muted)]',
        brand:
          'border-transparent bg-[var(--color-brand-500)]/15 text-[var(--color-brand-300)]',
        warning:
          'border-transparent bg-[var(--color-accent-500)]/15 text-[var(--color-accent-400)]',
        danger:
          'border-transparent bg-[var(--color-danger)]/15 text-[color:#fca5a5]',
        outline:
          'border-[var(--color-border-strong)] bg-transparent text-[var(--color-fg)]',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
