import { Router } from 'express';
import { z } from 'zod';
import { request } from 'undici';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { expensiveLimiter } from '../middleware/rateLimit.js';
import { AppError, NotFoundError, UpstreamError } from '../lib/errors.js';
import { env } from '../config.js';
import { logger } from '../logger.js';

export const analyzeRouter: Router = Router();

analyzeRouter.use(requireAuth);

const MC_TIMEOUT = 45_000;
// Forecast hits yfinance history + .info + .news sequentially per symbol, so
// a 12-stock portfolio can legitimately take a minute on a cold cache.
const FORECAST_TIMEOUT = 120_000;

const MonteCarloSchema = z.object({
  portfolioId: z.string().uuid(),
  // Fractional years allowed — the client sends `value * unitFactor` where the
  // unit selector is weeks / months / years.
  years: z.number().min(0.05).max(50).default(15),
  simulations: z.number().int().min(500).max(20000).default(5000),
  annualContribution: z.number().nonnegative().default(0),
});

const FrontierSchema = z.object({
  symbols: z.array(z.string().trim().toUpperCase().min(1).max(12)).min(2).max(30),
  points: z.number().int().min(5).max(100).default(25),
  lookbackYears: z.number().int().min(1).max(15).default(3),
});

const ForecastSchema = z.object({
  portfolioId: z.string().uuid(),
  horizonDays: z.number().int().min(5).max(1260).default(252),
  lookbackYears: z.number().int().min(1).max(15).default(5),
});

async function proxyMl<T>(
  path: string,
  body: unknown,
  timeoutMs: number = MC_TIMEOUT,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await request(`${env.ML_ENGINE_URL}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (res.statusCode >= 400) {
      const text = await res.body.text();
      logger.warn({ status: res.statusCode, body: text }, `ML ${path} error`);
      throw new UpstreamError('Analytics engine returned an error.', {
        status: res.statusCode,
        detail: text.slice(0, 400),
      });
    }
    return (await res.body.json()) as T;
  } catch (err) {
    if (err instanceof UpstreamError) throw err;
    if (err instanceof Error && err.name === 'AbortError') {
      throw new UpstreamError('Analytics engine timed out.');
    }
    throw new UpstreamError('Analytics engine unreachable.');
  } finally {
    clearTimeout(timer);
  }
}

/**
 * POST /api/analyze/monte-carlo — loads the caller's holdings under RLS and
 * forwards to the ML engine. Never trusts the client to send holdings directly.
 */
analyzeRouter.post(
  '/monte-carlo',
  expensiveLimiter,
  validate(MonteCarloSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as ReturnType<typeof MonteCarloSchema.parse>;

    const { data: portfolio, error: pErr } = await req.supabase!
      .from('portfolios')
      .select('id')
      .eq('id', input.portfolioId)
      .maybeSingle();
    if (pErr) throw new AppError(pErr.message, { status: 500, code: 'DB_ERROR' });
    if (!portfolio) throw new NotFoundError('Portfolio not found');

    const { data: rows, error: hErr } = await req.supabase!
      .from('holdings')
      .select('symbol, shares, purchase_price, purchase_date, sector')
      .eq('portfolio_id', input.portfolioId);
    if (hErr) throw new AppError(hErr.message, { status: 500, code: 'DB_ERROR' });
    if (!rows?.length) throw new NotFoundError('Portfolio has no holdings yet.');

    const holdings = rows.map((r) => ({
      symbol: r.symbol as string,
      shares: Number(r.shares),
      purchasePrice: Number(r.purchase_price),
      purchaseDate: r.purchase_date as string,
      sector: (r.sector as string | null) ?? null,
      notes: null,
    }));

    const result = await proxyMl<unknown>('/v1/monte-carlo', {
      holdings,
      years: input.years,
      simulations: input.simulations,
      annualContribution: input.annualContribution,
    });

    res.json({ ok: true, data: result });
  }),
);

/**
 * POST /api/analyze/efficient-frontier — purely parameterized by tickers, no
 * portfolio context required. Still gated by auth + rate limit because yfinance
 * is slow and we don't want anonymous callers hammering our ML engine.
 */
analyzeRouter.post(
  '/efficient-frontier',
  expensiveLimiter,
  validate(FrontierSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as ReturnType<typeof FrontierSchema.parse>;
    const result = await proxyMl<unknown>('/v1/efficient-frontier', {
      symbols: input.symbols,
      points: input.points,
      lookbackYears: input.lookbackYears,
    });
    res.json({ ok: true, data: result });
  }),
);

/**
 * POST /api/analyze/forecast — loads the caller's holdings under RLS, pulls
 * unique symbols, and forwards to the ML engine's per-stock forecast. Returns
 * history, a GBM confidence cone, and latest news for every ticker.
 */
analyzeRouter.post(
  '/forecast',
  expensiveLimiter,
  validate(ForecastSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as ReturnType<typeof ForecastSchema.parse>;

    const { data: portfolio, error: pErr } = await req.supabase!
      .from('portfolios')
      .select('id')
      .eq('id', input.portfolioId)
      .maybeSingle();
    if (pErr) throw new AppError(pErr.message, { status: 500, code: 'DB_ERROR' });
    if (!portfolio) throw new NotFoundError('Portfolio not found');

    const { data: rows, error: hErr } = await req.supabase!
      .from('holdings')
      .select('symbol')
      .eq('portfolio_id', input.portfolioId);
    if (hErr) throw new AppError(hErr.message, { status: 500, code: 'DB_ERROR' });
    if (!rows?.length) {
      throw new NotFoundError('Portfolio has no holdings yet.');
    }

    // De-duplicate — a portfolio can legitimately hold multiple lots of the
    // same ticker. We only need one forecast per symbol.
    const symbols = Array.from(
      new Set(rows.map((r) => String(r.symbol ?? '').toUpperCase()).filter(Boolean)),
    );

    const result = await proxyMl<unknown>(
      '/v1/forecast',
      {
        symbols,
        horizonDays: input.horizonDays,
        lookbackYears: input.lookbackYears,
        simulations: 1000,
        includeNews: true,
      },
      FORECAST_TIMEOUT,
    );

    res.json({ ok: true, data: result });
  }),
);
