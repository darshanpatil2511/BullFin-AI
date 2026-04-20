import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { uploadLimiter } from '../middleware/rateLimit.js';
import { AppError, NotFoundError, ValidationError } from '../lib/errors.js';
import { parseHoldingsCsv } from '../lib/csv.js';
import {
  HoldingBulkCreateSchema,
  HoldingCreateSchema,
  HoldingIdParam,
  HoldingUpdateSchema,
  PortfolioIdParam,
} from '../validators/holding.js';

export const holdingsRouter: Router = Router();

holdingsRouter.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB — matches Supabase bucket cap
});

async function assertOwnsPortfolio(
  supabase: NonNullable<Express.Request['supabase']>,
  portfolioId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('portfolios')
    .select('id')
    .eq('id', portfolioId)
    .maybeSingle();
  if (error) throw new AppError(error.message, { status: 500, code: 'DB_ERROR' });
  if (!data) throw new NotFoundError('Portfolio not found');
}

// GET /api/portfolios/:portfolioId/holdings
holdingsRouter.get(
  '/portfolios/:portfolioId/holdings',
  validate(PortfolioIdParam, 'params'),
  asyncHandler(async (req, res) => {
    const { portfolioId } = req.params as { portfolioId: string };
    await assertOwnsPortfolio(req.supabase!, portfolioId);
    const { data, error } = await req.supabase!
      .from('holdings')
      .select('*')
      .eq('portfolio_id', portfolioId)
      .order('symbol');
    if (error) throw new AppError(error.message, { status: 500, code: 'DB_ERROR' });
    res.json({ ok: true, data });
  }),
);

// POST /api/portfolios/:portfolioId/holdings — single.
holdingsRouter.post(
  '/portfolios/:portfolioId/holdings',
  validate(PortfolioIdParam, 'params'),
  validate(HoldingCreateSchema),
  asyncHandler(async (req, res) => {
    const { portfolioId } = req.params as { portfolioId: string };
    await assertOwnsPortfolio(req.supabase!, portfolioId);
    const input = req.body as ReturnType<typeof HoldingCreateSchema.parse>;
    const { data, error } = await req.supabase!
      .from('holdings')
      .insert({
        portfolio_id: portfolioId,
        symbol: input.symbol,
        shares: input.shares,
        purchase_price: input.purchasePrice,
        purchase_date: input.purchaseDate,
        sector: input.sector ?? null,
        notes: input.notes ?? null,
      })
      .select()
      .single();
    if (error) throw new AppError(error.message, { status: 500, code: 'DB_ERROR' });
    res.status(201).json({ ok: true, data });
  }),
);

// POST /api/portfolios/:portfolioId/holdings/bulk — JSON array.
holdingsRouter.post(
  '/portfolios/:portfolioId/holdings/bulk',
  validate(PortfolioIdParam, 'params'),
  validate(HoldingBulkCreateSchema),
  asyncHandler(async (req, res) => {
    const { portfolioId } = req.params as { portfolioId: string };
    await assertOwnsPortfolio(req.supabase!, portfolioId);
    const { holdings } = req.body as ReturnType<typeof HoldingBulkCreateSchema.parse>;
    const rows = holdings.map((h) => ({
      portfolio_id: portfolioId,
      symbol: h.symbol,
      shares: h.shares,
      purchase_price: h.purchasePrice,
      purchase_date: h.purchaseDate,
      sector: h.sector ?? null,
      notes: h.notes ?? null,
    }));
    const { data, error } = await req.supabase!.from('holdings').insert(rows).select();
    if (error) throw new AppError(error.message, { status: 500, code: 'DB_ERROR' });
    res.status(201).json({ ok: true, data, inserted: data?.length ?? 0 });
  }),
);

// POST /api/portfolios/:portfolioId/holdings/upload — CSV upload.
holdingsRouter.post(
  '/portfolios/:portfolioId/holdings/upload',
  uploadLimiter,
  validate(PortfolioIdParam, 'params'),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const { portfolioId } = req.params as { portfolioId: string };
    if (!req.file) throw new ValidationError('No file attached. Use field name "file".');
    if (!req.file.mimetype.includes('csv') && !req.file.originalname.endsWith('.csv')) {
      throw new ValidationError('Only CSV files are accepted.');
    }
    await assertOwnsPortfolio(req.supabase!, portfolioId);

    const holdings = parseHoldingsCsv(req.file.buffer);

    const rows = holdings.map((h) => ({
      portfolio_id: portfolioId,
      symbol: h.symbol,
      shares: h.shares,
      purchase_price: h.purchasePrice,
      purchase_date: h.purchaseDate,
      sector: h.sector ?? null,
      notes: h.notes ?? null,
    }));

    const { data, error } = await req.supabase!.from('holdings').insert(rows).select();
    if (error) throw new AppError(error.message, { status: 500, code: 'DB_ERROR' });
    res.status(201).json({ ok: true, data, inserted: data?.length ?? 0 });
  }),
);

// PATCH /api/holdings/:id
holdingsRouter.patch(
  '/holdings/:id',
  validate(HoldingIdParam, 'params'),
  validate(HoldingUpdateSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const input = req.body as ReturnType<typeof HoldingUpdateSchema.parse>;
    const update: Record<string, unknown> = {};
    if (input.symbol !== undefined) update.symbol = input.symbol;
    if (input.shares !== undefined) update.shares = input.shares;
    if (input.purchasePrice !== undefined) update.purchase_price = input.purchasePrice;
    if (input.purchaseDate !== undefined) update.purchase_date = input.purchaseDate;
    if (input.sector !== undefined) update.sector = input.sector;
    if (input.notes !== undefined) update.notes = input.notes;
    const { data, error } = await req.supabase!
      .from('holdings')
      .update(update)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw new AppError(error.message, { status: 500, code: 'DB_ERROR' });
    if (!data) throw new NotFoundError('Holding not found');
    res.json({ ok: true, data });
  }),
);

// DELETE /api/holdings/:id
holdingsRouter.delete(
  '/holdings/:id',
  validate(HoldingIdParam, 'params'),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const { error, count } = await req.supabase!
      .from('holdings')
      .delete({ count: 'exact' })
      .eq('id', id);
    if (error) throw new AppError(error.message, { status: 500, code: 'DB_ERROR' });
    if (!count) throw new NotFoundError('Holding not found');
    res.json({ ok: true });
  }),
);
