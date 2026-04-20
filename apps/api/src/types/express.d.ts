import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Ambient augmentation of Express's Request so authenticated routes get
 * `req.user` and a Supabase client scoped to that user's JWT (so RLS
 * policies still apply even though the call comes through our gateway).
 */
declare global {
  namespace Express {
    interface AuthUser {
      id: string;
      email: string;
      role: 'investor' | 'advisor' | 'admin';
      fullName: string | null;
    }

    interface Request {
      user?: AuthUser;
      accessToken?: string;
      /**
       * Supabase client whose auth header is the caller's JWT. Queries made
       * with this client go through RLS exactly as if the browser called
       * Supabase directly. Available only after `requireAuth`.
       */
      supabase?: SupabaseClient;
      id?: string;
    }
  }
}

export {};
