import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SidebarContent } from './Sidebar';

/**
 * Slide-in drawer that carries the full app sidebar on mobile / tablet.
 * Triggered by the hamburger button in the TopBar. Closes itself whenever
 * the user picks a destination (handled via SidebarContent's onNavigate prop).
 */
export function MobileNav() {
  const [open, setOpen] = React.useState(false);
  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <button
          type="button"
          aria-label="Open navigation menu"
          className={cn(
            'inline-flex size-9 items-center justify-center rounded-md text-[var(--color-fg-muted)]',
            'transition-colors hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-fg)]',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-500)]/60',
            'lg:hidden',
          )}
        >
          <Menu className="size-5" />
        </button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-50 bg-black/70 backdrop-blur-sm lg:hidden',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
          )}
        />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className={cn(
            'fixed left-0 top-0 z-50 h-full w-72 max-w-[85vw] border-r border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-4 shadow-elevated',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left',
            'duration-200 focus:outline-none lg:hidden',
          )}
        >
          <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
          <DialogPrimitive.Close
            className="absolute right-3 top-3 inline-flex size-8 items-center justify-center rounded-md text-[var(--color-fg-muted)] transition-colors hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-fg)]"
            aria-label="Close navigation"
          >
            <X className="size-4" />
          </DialogPrimitive.Close>
          <SidebarContent onNavigate={() => setOpen(false)} />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
