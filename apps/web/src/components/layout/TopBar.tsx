import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { LogOut, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '@/lib/api';
import { cn, initialsOf } from '@/lib/utils';
import { MobileNav } from './MobileNav';

interface MeProfile {
  full_name: string | null;
  avatar_url: string | null;
}

export function TopBar({ title, actions }: { title: string; actions?: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  // Shares the same `me` cache used by the Settings page — no extra network
  // round trip unless we render before Settings has loaded once.
  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => apiFetch<MeProfile>('/me'),
    enabled: Boolean(user?.id),
    staleTime: 60_000,
  });
  const displayName =
    me.data?.full_name ??
    (user?.user_metadata?.full_name as string | undefined) ??
    user?.email;
  const avatarUrl = me.data?.avatar_url ?? null;

  async function handleSignOut() {
    await signOut();
    toast.success('Signed out');
    navigate('/login', { replace: true });
  }

  return (
    <header
      className={cn(
        'sticky top-0 z-20 flex min-h-16 items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-bg)]/80 px-4 py-3 backdrop-blur',
        'md:gap-4 md:px-6',
      )}
    >
      <div className="flex min-w-0 items-center gap-2 md:gap-3">
        <MobileNav />
        <h1 className="truncate text-base font-semibold tracking-tight md:text-lg">{title}</h1>
        <span className="hidden shrink-0 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-muted)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-fg-muted)] md:inline-flex">
          <Sparkles className="mr-1 size-3 text-[var(--color-brand-400)]" />
          AI-augmented
        </span>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2 md:flex-nowrap md:gap-3">
        {actions}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              aria-label="Open account menu"
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-elevated)] py-1 pl-1 pr-1 text-sm md:pr-3',
                'hover:border-[var(--color-border-strong)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-500)]/60',
              )}
            >
              <span className="grid size-7 place-items-center overflow-hidden rounded-full bg-[var(--color-brand-500)]/15 text-xs font-semibold text-[var(--color-brand-300)]">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="size-full object-cover" />
                ) : (
                  initialsOf(displayName)
                )}
              </span>
              <span className="hidden max-w-[12ch] truncate text-[var(--color-fg-muted)] md:inline">
                {displayName}
              </span>
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={6}
              className="z-50 w-56 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-1 text-sm shadow-elevated"
            >
              <div className="border-b border-[var(--color-border)] px-3 py-2">
                <p className="truncate text-xs text-[var(--color-fg-subtle)]">Signed in as</p>
                <p className="truncate text-sm font-medium">{user?.email}</p>
              </div>
              <DropdownMenu.Item
                onSelect={() => navigate('/app/settings')}
                className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 outline-none data-[highlighted]:bg-[var(--color-bg-muted)]"
              >
                Settings
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onSelect={handleSignOut}
                className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-[var(--color-danger)] outline-none data-[highlighted]:bg-[var(--color-danger)]/10"
              >
                <LogOut className="size-4" />
                Sign out
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  );
}

export function TopBarActions({ children }: { children?: React.ReactNode }) {
  return <div className="flex items-center gap-2">{children}</div>;
}

export { Button };
