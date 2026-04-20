import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { expensiveLimiter } from '../middleware/rateLimit.js';
import { AppError, NotFoundError } from '../lib/errors.js';
import { callMetrics } from '../lib/mlClient.js';
import { MetricsRequestSchema } from '../validators/metrics.js';

export const metricsRouter: Router = Router();

metricsRouter.use(requireAuth);

/**
 * POST /api/metrics
 * Body: { portfolioId, benchmark?, riskFreeRate? }
 *
 * Loads the caller's holdings under RLS, forwards to the FastAPI engine,
 * and returns the full MetricsResponse.
 */
metricsRouter.post(
  '/',
  expensiveLimiter,
  validate(MetricsRequestSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as ReturnType<typeof MetricsRequestSchema.parse>;

    const { data: portfolio, error: pErr } = await req.supabase!
      .from('portfolios')
      .select('id')
      .eq('id', input.portfolioId)
      .maybeSingle();
    if (pErr) throw new AppError(pErr.message, { status: 500, code: 'DB_ERROR' });
    if (!portfolio) throw new NotFoundError('Portfolio not found');

    const { data: rows, error: hErr } = await req.supabase!
      .from('holdings')
      .select('symbol, shares, purchase_price, purchase_date, sector, notes')
      .eq('portfolio_id', input.portfolioId);
    if (hErr) throw new AppError(hErr.message, { status: 500, code: 'DB_ERROR' });
    if (!rows || rows.length === 0) {
      throw new NotFoundError('Portfolio has no holdings yet.');
    }

    const holdings = rows.map((r) => ({
      symbol: r.symbol as string,
      shares: Number(r.shares),
      purchasePrice: Number(r.purchase_price),
      purchaseDate: r.purchase_date as string,
      sector: (r.sector as string | null) ?? null,
      notes: (r.notes as string | null) ?? null,
    }));

    const metrics = await callMetrics({
      holdings,
      benchmark: input.benchmark,
      riskFreeRate: input.riskFreeRate,
    });

    res.json({ ok: true, data: metrics });
  }),
);
