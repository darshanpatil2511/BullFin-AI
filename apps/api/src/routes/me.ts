import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { AppError } from '../lib/errors.js';
import { supabaseAdmin } from '../lib/supabase.js';

export const meRouter: Router = Router();

meRouter.use(requireAuth);

// GET /api/me — the authenticated user's profile.
meRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { data, error } = await req.supabase!
      .from('user_profiles')
      .select('*')
      .eq('id', req.user!.id)
      .maybeSingle();
    if (error) throw new AppError(error.message, { status: 500, code: 'DB_ERROR' });
    res.json({ ok: true, data });
  }),
);

const UpdateMeSchema = z
  .object({
    fullName: z.string().trim().min(1).max(120).optional(),
    avatarUrl: z.string().url().max(500).optional().nullable(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: 'At least one field required' });

// PATCH /api/me
meRouter.patch(
  '/',
  validate(UpdateMeSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as z.infer<typeof UpdateMeSchema>;
    const update: Record<string, unknown> = {};
    if (input.fullName !== undefined) update.full_name = input.fullName;
    if (input.avatarUrl !== undefined) update.avatar_url = input.avatarUrl;
    const { data, error } = await req.supabase!
      .from('user_profiles')
      .update(update)
      .eq('id', req.user!.id)
      .select()
      .maybeSingle();
    if (error) throw new AppError(error.message, { status: 500, code: 'DB_ERROR' });
    res.json({ ok: true, data });
  }),
);

// DELETE /api/me
// Permanent self-serve account deletion. Wipes everything the user owns:
//   1. Objects in the `reports` and `portfolio-uploads` storage buckets
//      (their folder convention is `<user_id>/…`).
//   2. The auth user row in `auth.users` via the admin API — this cascades
//      through `user_profiles` → `portfolios` → `holdings` / `reports` /
//      `chat_sessions` / `chat_messages` because every FK is `on delete
//      cascade` in the schema.
// Public (non-cascading) objects like avatar URLs live in a public bucket
// keyed by user_id and are cleared too so no orphaned image remains.
meRouter.delete(
  '/',
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;

    // 1. Bulk-remove storage objects under the user's folder in each bucket.
    //    We use the admin client so RLS on storage.objects doesn't trip us
    //    up mid-deletion. Failures are non-fatal — the auth user delete is
    //    the source of truth and leaves no database remnants.
    for (const bucket of ['reports', 'portfolio-uploads', 'avatars']) {
      try {
        const { data: files } = await supabaseAdmin.storage.from(bucket).list(userId);
        if (files && files.length > 0) {
          const paths = files.map((f) => `${userId}/${f.name}`);
          await supabaseAdmin.storage.from(bucket).remove(paths);
        }
      } catch {
        /* swallow — storage cleanup is best-effort */
      }
    }

    // 2. Delete the auth user. Cascades through every app table.
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) {
      throw new AppError(error.message, { status: 500, code: 'AUTH_DELETE_FAILED' });
    }

    res.json({ ok: true });
  }),
);
