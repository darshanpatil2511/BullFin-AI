import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';

export function OAuthButtons() {
  const [busy, setBusy] = React.useState(false);

  async function signInWithGoogle(): Promise<void> {
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/app`,
        },
      });
      if (error) throw error;
      // Supabase does a full-page redirect to Google; the navigation clears `busy`.
    } catch (err) {
      setBusy(false);
      toast.error('Google sign-in failed', {
        description:
          err instanceof Error
            ? err.message
            : 'Enable Google under Supabase → Authentication → Providers first.',
      });
    }
  }

  return (
    <Button
      type="button"
      variant="secondary"
      size="lg"
      className="w-full"
      loading={busy}
      leftIcon={<GoogleIcon />}
      onClick={() => void signInWithGoogle()}
    >
      Continue with Google
    </Button>
  );
}

export function OrDivider({ label = 'OR CONTINUE WITH EMAIL' }: { label?: string }) {
  return (
    <div className="relative my-5 flex items-center" aria-hidden>
      <span className="h-px flex-1 bg-[var(--color-border)]" />
      <span className="mx-3 text-[10px] uppercase tracking-[0.14em] text-[var(--color-fg-subtle)]">
        {label}
      </span>
      <span className="h-px flex-1 bg-[var(--color-border)]" />
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="size-4" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.1H24v8h11.3c-1.6 4.5-5.9 7.6-11.3 7.6-6.7 0-12.2-5.4-12.2-12.1S17.3 11.5 24 11.5c3 0 5.7 1.1 7.8 2.9l5.7-5.7C33.8 5.4 29.2 3.5 24 3.5 12.7 3.5 3.5 12.7 3.5 24S12.7 44.5 24 44.5c11.8 0 19.7-8.3 19.7-20 0-1.5-.1-2.9-.1-4.4z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.3l6.6 4.8c1.8-4.4 6-7.6 11.1-7.6 3 0 5.7 1.1 7.8 2.9l5.7-5.7C33.8 5.4 29.2 3.5 24 3.5 16.2 3.5 9.5 8 6.3 14.3z"
      />
      <path
        fill="#4CAF50"
        d="M24 44.5c5.1 0 9.7-1.7 13.2-4.7l-6.1-5c-2 1.4-4.4 2.2-7.1 2.2-5.3 0-9.7-3.1-11.3-7.6l-6.6 5.1C9.3 40 16 44.5 24 44.5z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.1H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.5l6.1 5c4.1-3.7 6.7-9.3 6.7-16.1 0-1.5-.1-2.9-.1-4.4z"
      />
    </svg>
  );
}
