import * as React from 'react';
import { cn } from '@/lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          'flex h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-raised)] px-3 py-2 text-sm',
          'text-[var(--color-fg)] placeholder:text-[var(--color-fg-subtle)]',
          'transition-[border-color,box-shadow] duration-150 ease-[var(--ease-swift)]',
          'focus:outline-none focus:border-[var(--color-brand-500)]/70 focus:ring-4 focus:ring-[var(--color-brand-500)]/15',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'file:border-0 file:bg-transparent file:text-sm file:font-medium',
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';
