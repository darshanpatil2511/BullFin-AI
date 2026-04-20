import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { expensiveLimiter, uploadLimiter } from '../middleware/rateLimit.js';
import { AppError, NotFoundError, ValidationError } from '../lib/errors.js';
import { generateSummary } from '../lib/gemini.js';
import { logger } from '../logger.js';
import { ReportCreateSchema, ReportIdParam } from '../validators/report.js';

export const reportsRouter: Router = Router();

reportsRouter.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

/**
 * POST /api/reports/summary — Gemini-written executive summary for the PDF.
 * The client sends the already-computed metrics so we don't re-run the ML
 * engine just for the summary.
 */
const SummarySchema = z.object({
  portfolioName: z.string().trim().min(1).max(200),
  totalValue: z.number(),
  totalReturnPct: z.number(),
  cagr: z.number(),
  volatility: z.number(),
  sharpe: z.number(),
  beta: z.number().nullable(),
  maxDrawdown: z.number(),
  riskScore: z.number().int().min(0).max(100),
  riskLabel: z.string(),
  topHoldings: z
    .array(
      z.object({
        symbol: z.string(),
        weight: z.number(),
        sector: z.string().nullable(),
      }),
    )
    .max(10),
  sectorExposure: z
    .array(z.object({ sector: z.string(), weight: z.number() }))
    .max(15),
});

reportsRouter.post(
  '/summary',
  expensiveLimiter,
  validate(SummarySchema),
  asyncHandler(async (req, res) => {
    const input = req.body as z.infer<typeof SummarySchema>;
    const topHoldingsText = input.topHoldings
      .slice(0, 5)
      .map(
        (h) =>
          `  - ${h.symbol}: ${(h.weight * 100).toFixed(1)}%${
            h.sector ? ` (${h.sector})` : ''
          }`,
      )
      .join('\n');
    const sectorText = input.sectorExposure
      .slice(0, 6)
      .map((s) => `  - ${s.sector}: ${(s.weight * 100).toFixed(1)}%`)
      .join('\n');

    const prompt = [
      'You are BullFin-AI writing a one-page executive summary for an investor\'s portfolio report.',
      '',
      `Portfolio name: ${input.portfolioName}`,
      `Total value: $${input.totalValue.toFixed(2)}`,
      `Total return since inception: ${(input.totalReturnPct * 100).toFixed(2)}%`,
      `CAGR: ${(input.cagr * 100).toFixed(2)}%`,
      `Annualized volatility: ${(input.volatility * 100).toFixed(2)}%`,
      `Sharpe ratio: ${input.sharpe.toFixed(2)}`,
      `Beta vs SPY: ${input.beta === null ? 'n/a' : input.beta.toFixed(2)}`,
      `Max drawdown: ${(input.maxDrawdown * 100).toFixed(2)}%`,
      `Risk score: ${input.riskScore}/100 (${input.riskLabel})`,
      '',
      'Top 5 holdings by weight:',
      topHoldingsText,
      '',
      'Sector exposure (top 6):',
      sectorText,
      '',
      'Write the summary in this exact structure, using Markdown:',
      '',
      '## Overview',
      '[3-4 sentences describing what kind of portfolio this is, the standout numbers, and overall character.]',
      '',
      '## Key observations',
      '- [First observation about concentration or weighting]',
      '- [Second observation about diversification or sector tilt]',
      '- [Third observation about the risk profile or drawdown]',
      '',
      '## Things to watch',
      '[2-3 sentences naming specific risk factors this portfolio carries.]',
      '',
      '---',
      '_Educational analysis only — not licensed financial advice._',
      '',
      'Constraints:',
      '- Stay under 280 words total.',
      '- Quote numbers with two decimals and percent signs.',
      '- Educational tone. Never say "buy", "sell", "should invest", or make price predictions.',
      '- Do NOT wrap the whole response in a code block.',
    ].join('\n');

    try {
      const text = await generateSummary(prompt);
      res.json({ ok: true, data: { summary: text } });
    } catch (err) {
      logger.error({ err }, 'Summary generation failed');
      throw new AppError('The AI summary is unavailable right now.', {
        status: 502,
        code: 'GEMINI_ERROR',
      });
    }
  }),
);

// GET /api/reports — list the caller's saved reports.
reportsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { data, error } = await req.supabase!
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new AppError(error.message, { status: 500, code: 'DB_ERROR' });
    res.json({ ok: true, data });
  }),
);

/**
 * POST /api/reports  (multipart)
 * Fields:
 *   file        — the PDF generated in the browser
 *   portfolioId — which portfolio the report is for
 *   title       — friendly name
 *
 * Stores the PDF under `reports/<userId>/<reportId>.pdf` so the Storage
 * RLS policy (which matches by leading path segment) allows it through.
 */
reportsRouter.post(
  '/',
  uploadLimiter,
  upload.single('file'),
  validate(ReportCreateSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as ReturnType<typeof ReportCreateSchema.parse>;
    if (!req.file) throw new ValidationError('Missing PDF. Attach under field "file".');
    if (!req.file.mimetype.includes('pdf')) {
      throw new ValidationError('Only PDF reports are accepted.');
    }

    // Confirm the portfolio belongs to the caller (RLS backstops this too).
    const { data: portfolio, error: pErr } = await req.supabase!
      .from('portfolios')
      .select('id')
      .eq('id', input.portfolioId)
      .maybeSingle();
    if (pErr) throw new AppError(pErr.message, { status: 500, code: 'DB_ERROR' });
    if (!portfolio) throw new NotFoundError('Portfolio not found');

    // Insert the metadata row first so we have an id for the storage path.
    const { data: report, error: insErr } = await req.supabase!
      .from('reports')
      .insert({
        user_id: req.user!.id,
        portfolio_id: input.portfolioId,
        title: input.title,
        storage_path: 'pending',
      })
      .select()
      .single();
    if (insErr) throw new AppError(insErr.message, { status: 500, code: 'DB_ERROR' });

    const path = `${req.user!.id}/${report.id}.pdf`;

    const { error: uploadErr } = await req.supabase!.storage
      .from('reports')
      .upload(path, req.file.buffer, {
        contentType: 'application/pdf',
        upsert: true,
      });
    if (uploadErr) {
      await req.supabase!.from('reports').delete().eq('id', report.id);
      throw new AppError(uploadErr.message, { status: 500, code: 'STORAGE_ERROR' });
    }

    const { data: updated, error: updErr } = await req.supabase!
      .from('reports')
      .update({ storage_path: path })
      .eq('id', report.id)
      .select()
      .single();
    if (updErr) throw new AppError(updErr.message, { status: 500, code: 'DB_ERROR' });

    res.status(201).json({ ok: true, data: updated });
  }),
);

// GET /api/reports/:id/download — signed URL, 5-minute TTL.
reportsRouter.get(
  '/:id/download',
  validate(ReportIdParam, 'params'),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const { data: report, error } = await req.supabase!
      .from('reports')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new AppError(error.message, { status: 500, code: 'DB_ERROR' });
    if (!report) throw new NotFoundError('Report not found');

    const { data, error: sErr } = await req.supabase!.storage
      .from('reports')
      .createSignedUrl(report.storage_path as string, 300);
    if (sErr) throw new AppError(sErr.message, { status: 500, code: 'STORAGE_ERROR' });

    res.json({ ok: true, data: { url: data.signedUrl, expiresIn: 300 } });
  }),
);

// DELETE /api/reports/:id
reportsRouter.delete(
  '/:id',
  validate(ReportIdParam, 'params'),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const { data: report, error } = await req.supabase!
      .from('reports')
      .select('storage_path')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new AppError(error.message, { status: 500, code: 'DB_ERROR' });
    if (!report) throw new NotFoundError('Report not found');

    await req.supabase!.storage.from('reports').remove([report.storage_path as string]);
    const { error: delErr } = await req.supabase!.from('reports').delete().eq('id', id);
    if (delErr) throw new AppError(delErr.message, { status: 500, code: 'DB_ERROR' });

    res.json({ ok: true });
  }),
);
