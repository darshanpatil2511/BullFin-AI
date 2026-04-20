import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Fail loudly in dev so the user remembers to set their env vars.
  // In prod the build will still run but auth will throw on first call.
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.error(
      '[BullFin-AI] Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. See apps/web/.env.example.',
    );
  }
}

export const supabase: SupabaseClient = createClient(url ?? '', anonKey ?? '', {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
