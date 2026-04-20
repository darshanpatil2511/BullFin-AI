import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { pingMlEngine } from '../lib/mlClient.js';
import { supabaseAdmin } from '../lib/supabase.js';

export const healthRouter: Router = Router();

// Shallow — liveness. Used by load balancers.
healthRouter.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'bullfin-api', status: 'alive' });
});

// Deep — readiness. Hits Supabase + ML engine; slower but thorough.
healthRouter.get(
  '/health/deep',
  asyncHandler(async (_req, res) => {
    const [mlOk, supabaseRes] = await Promise.all([
      pingMlEngine(),
      supabaseAdmin.from('user_profiles').select('id', { head: true, count: 'exact' }),
    ]);
    const supabaseOk = !supabaseRes.error;
    res.status(mlOk && supabaseOk ? 200 : 503).json({
      ok: mlOk && supabaseOk,
      checks: {
        ml_engine: mlOk,
        supabase: supabaseOk,
      },
    });
  }),
);
