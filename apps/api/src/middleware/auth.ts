import type { NextFunction, Request, Response } from 'express';
import type { UserRole } from '@bullfin/shared';
import { AuthError, ForbiddenError } from '../lib/errors.js';
import { supabaseAdmin, supabaseForUser } from '../lib/supabase.js';

function extractBearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}

/**
 * Verifies a Supabase JWT on incoming requests. On success, populates
 * `req.user`, `req.accessToken`, and `req.supabase` (a per-request client
 * scoped to this user's JWT so RLS applies to any query made through it).
 */
export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const token = extractBearer(req);
  if (!token) return next(new AuthError('Missing or malformed Authorization header'));

  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) return next(new AuthError('Invalid or expired session'));

    // Pull the app-level profile (role, full_name) from user_profiles.
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('user_profiles')
      .select('role, full_name')
      .eq('id', data.user.id)
      .maybeSingle();

    if (profileErr) return next(new AuthError('Failed to load user profile'));

    req.user = {
      id: data.user.id,
      email: data.user.email ?? '',
      role: (profile?.role as UserRole | undefined) ?? 'investor',
      fullName: profile?.full_name ?? null,
    };
    req.accessToken = token;
    req.supabase = supabaseForUser(token);
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Gate a route by role. Use after `requireAuth`.
 */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(new AuthError());
    if (!roles.includes(req.user.role)) return next(new ForbiddenError('Insufficient role'));
    next();
  };
}
