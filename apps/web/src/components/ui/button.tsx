import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium',
    'transition-[background,color,box-shadow,transform] duration-150 ease-[var(--ease-swift)]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-500)]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)]',
    'disabled:pointer-events-none disabled:opacity-50',
    'select-none active:translate-y-px',
  ].join(' '),
  {
    variants: {
      variant: {
        primary:
          'bg-[var(--color-brand-500)] text-[var(--color-brand-950)] hover:bg-[var(--color-brand-400)] shadow-[0_1px_0_0_rgba(255,255,255,0.15)_inset,0_6px_20px_-8px_rgba(16,185,129,0.6)]',
        secondary:
          'bg-[var(--color-bg-raised)] text-[var(--color-fg)] border border-[var(--color-border)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-bg-muted)]',
        outline:
          'bg-transparent text-[var(--color-fg)] border border-[var(--color-border)] hover:bg-[var(--color-bg-muted)]',
        ghost:
          'bg-transparent text-[var(--color-fg)] hover:bg-[var(--color-bg-muted)]',
        danger:
          'bg-[var(--color-danger)] text-white hover:brightness-110',
        link:
          'text-[var(--color-brand-400)] underline-offset-4 hover:underline bg-transparent h-auto p-0',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4',
        lg: 'h-12 px-6 text-base',
        icon: 'h-10 w-10 p-0',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, asChild, loading, leftIcon, rightIcon, children, disabled, ...props },
    ref,
  ) => {
    const classes = cn(buttonVariants({ variant, size, className }));
    const leading = loading ? <Loader2 className="size-4 animate-spin" /> : leftIcon;

    // Radix's `Slot` requires exactly ONE React element child, so when asChild
    // is set we inject the icon(s) INSIDE the wrapped element (typically a
    // <Link>) rather than rendering them as siblings of the Slot.
    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<{ children?: React.ReactNode }>;
      const cloned = React.cloneElement(
        child,
        undefined,
        <>
          {leading}
          {child.props.children}
          {rightIcon}
        </>,
      );
      return (
        <Slot ref={ref} className={classes} {...props}>
          {cloned}
        </Slot>
      );
    }

    return (
      <button ref={ref} className={classes} disabled={disabled ?? loading} {...props}>
        {leading}
        {children}
        {rightIcon}
      </button>
    );
  },
);
Button.displayName = 'Button';
