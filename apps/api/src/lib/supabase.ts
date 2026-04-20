import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config.js';

/**
 * Admin client — uses the service-role key and bypasses RLS. Use ONLY for
 * operations that legitimately need to (e.g. a webhook handler that edits
 * records on behalf of a user whose JWT we don't have). Never pass user
 * input through this client without explicit user_id filtering.
 */
export const supabaseAdmin: SupabaseClient = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { 'X-Client-Info': 'bullfin-api/admin' } },
  },
);

/**
 * Builds a Supabase client scoped to a specific user's JWT. Queries made
 * with this client respect the RLS policies defined in the SQL migrations,
 * so even a bug in a route handler can't leak another user's data.
 */
export function supabaseForUser(accessToken: string): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-Client-Info': 'bullfin-api/user',
      },
    },
  });
}
