import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { NotFoundError, AppError } from '../lib/errors.js';
import {
  PortfolioCreateSchema,
  PortfolioIdParam,
  PortfolioUpdateSchema,
} from '../validators/portfolio.js';

export const portfoliosRouter: Router = Router();

portfoliosRouter.use(requireAuth);

// GET /api/portfolios — list the caller's portfolios (not archived by default).
portfoliosRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const includeArchived = req.query.archived === 'true';
    let q = req.supabase!
      .from('portfolios')
      .select('*')
      .order('updated_at', { ascending: false });
    if (!includeArchived) q = q.eq('is_archived', false);
    const { data, error } = await q;
    if (error) throw new AppError(error.message, { status: 500, code: 'DB_ERROR' });
    res.json({ ok: true, data });
  }),
);

// GET /api/portfolios/:id — single portfolio with holdings.
portfoliosRouter.get(
  '/:id',
  validate(PortfolioIdParam, 'params'),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const { data: portfolio, error } = await req.supabase!
      .from('portfolios')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new AppError(error.message, { status: 500, code: 'DB_ERROR' });
    if (!portfolio) throw new NotFoundError('Portfolio not found');

    const { data: holdings, error: hErr } = await req.supabase!
      .from('holdings')
      .select('*')
      .eq('portfolio_id', id)
      .order('symbol');
    if (hErr) throw new AppError(hErr.message, { status: 500, code: 'DB_ERROR' });

    res.json({ ok: true, data: { portfolio, holdings } });
  }),
);

// POST /api/portfolios — create.
portfoliosRouter.post(
  '/',
  validate(PortfolioCreateSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as ReturnType<typeof PortfolioCreateSchema.parse>;
    const { data, error } = await req.supabase!
      .from('portfolios')
      .insert({
        user_id: req.user!.id,
        name: input.name,
        description: input.description ?? null,
        base_currency: input.baseCurrency ?? 'USD',
      })
      .select()
      .single();
    if (error) throw new AppError(error.message, { status: 500, code: 'DB_ERROR' });
    res.status(201).json({ ok: true, data });
  }),
);

// PATCH /api/portfolios/:id — partial update.
portfoliosRouter.patch(
  '/:id',
  validate(PortfolioIdParam, 'params'),
  validate(PortfolioUpdateSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const input = req.body as ReturnType<typeof PortfolioUpdateSchema.parse>;
    const update: Record<string, unknown> = {};
    if (input.name !== undefined) update.name = input.name;
    if (input.description !== undefined) update.description = input.description;
    if (input.baseCurrency !== undefined) update.base_currency = input.baseCurrency;
    if (input.isArchived !== undefined) update.is_archived = input.isArchived;
    const { data, error } = await req.supabase!
      .from('portfolios')
      .update(update)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw new AppError(error.message, { status: 500, code: 'DB_ERROR' });
    if (!data) throw new NotFoundError('Portfolio not found');
    res.json({ ok: true, data });
  }),
);

// DELETE /api/portfolios/:id — hard delete cascades to holdings/reports.
portfoliosRouter.delete(
  '/:id',
  validate(PortfolioIdParam, 'params'),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const { error, count } = await req.supabase!
      .from('portfolios')
      .delete({ count: 'exact' })
      .eq('id', id);
    if (error) throw new AppError(error.message, { status: 500, code: 'DB_ERROR' });
    if (!count) throw new NotFoundError('Portfolio not found');
    res.json({ ok: true });
  }),
);
