import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { expensiveLimiter } from '../middleware/rateLimit.js';
import { AppError, NotFoundError } from '../lib/errors.js';
import { streamChat, type ChatTurn, type PortfolioContext } from '../lib/gemini.js';
import { callMetrics } from '../lib/mlClient.js';
import { logger } from '../logger.js';
import {
  ChatSendSchema,
  RenameSessionSchema,
  SessionIdParam,
} from '../validators/chat.js';

export const chatRouter: Router = Router();

chatRouter.use(requireAuth);

// GET /api/chat/sessions — list all sessions owned by the caller.
chatRouter.get(
  '/sessions',
  asyncHandler(async (req, res) => {
    const { data, error } = await req.supabase!
      .from('chat_sessions')
      .select('*')
      .order('updated_at', { ascending: false });
    if (error) throw new AppError(error.message, { status: 500, code: 'DB_ERROR' });
    res.json({ ok: true, data });
  }),
);

// GET /api/chat/sessions/:id — one session with messages.
chatRouter.get(
  '/sessions/:id',
  validate(SessionIdParam, 'params'),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const { data: session, error } = await req.supabase!
      .from('chat_sessions')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new AppError(error.message, { status: 500, code: 'DB_ERROR' });
    if (!session) throw new NotFoundError('Session not found');

    const { data: messages, error: mErr } = await req.supabase!
      .from('chat_messages')
      .select('*')
      .eq('session_id', id)
      .order('created_at');
    if (mErr) throw new AppError(mErr.message, { status: 500, code: 'DB_ERROR' });

    res.json({ ok: true, data: { session, messages } });
  }),
);

// PATCH /api/chat/sessions/:id — rename.
chatRouter.patch(
  '/sessions/:id',
  validate(SessionIdParam, 'params'),
  validate(RenameSessionSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const { title } = req.body as ReturnType<typeof RenameSessionSchema.parse>;
    const { data, error } = await req.supabase!
      .from('chat_sessions')
      .update({ title })
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw new AppError(error.message, { status: 500, code: 'DB_ERROR' });
    if (!data) throw new NotFoundError('Session not found');
    res.json({ ok: true, data });
  }),
);

// DELETE /api/chat/sessions/:id — remove session + cascade messages.
chatRouter.delete(
  '/sessions/:id',
  validate(SessionIdParam, 'params'),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const { error, count } = await req.supabase!
      .from('chat_sessions')
      .delete({ count: 'exact' })
      .eq('id', id);
    if (error) throw new AppError(error.message, { status: 500, code: 'DB_ERROR' });
    if (!count) throw new NotFoundError('Session not found');
    res.json({ ok: true });
  }),
);

/**
 * POST /api/chat/send
 *
 * Streams the assistant's response back to the browser as Server-Sent
 * Events. Frames:
 *   event: session    data: { sessionId }             (first chunk)
 *   event: delta      data: { text }                  (many chunks)
 *   event: done       data: { messageId }             (terminal)
 *   event: error      data: { code, message }         (on failure)
 */
chatRouter.post(
  '/send',
  expensiveLimiter,
  validate(ChatSendSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as ReturnType<typeof ChatSendSchema.parse>;
    const userId = req.user!.id;

    // ---- Resolve session ----
    let sessionId = input.sessionId;
    if (sessionId) {
      const { data, error } = await req.supabase!
        .from('chat_sessions')
        .select('id')
        .eq('id', sessionId)
        .maybeSingle();
      if (error) throw new AppError(error.message, { status: 500, code: 'DB_ERROR' });
      if (!data) throw new NotFoundError('Session not found');
    } else {
      const title = input.message.slice(0, 80);
      const { data, error } = await req.supabase!
        .from('chat_sessions')
        .insert({
          user_id: userId,
          portfolio_id: input.portfolioId ?? null,
          title,
        })
        .select('id')
        .single();
      if (error) throw new AppError(error.message, { status: 500, code: 'DB_ERROR' });
      sessionId = data.id as string;
    }

    // ---- Load prior history (up to last 20 turns). ----
    const { data: priorMessages, error: histErr } = await req.supabase!
      .from('chat_messages')
      .select('role, content')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(40);
    if (histErr) throw new AppError(histErr.message, { status: 500, code: 'DB_ERROR' });
    const history: ChatTurn[] = (priorMessages ?? [])
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content as string }));

    // ---- Build portfolio context if one is attached ----
    let portfolioCtx: PortfolioContext | undefined;
    if (input.portfolioId) {
      portfolioCtx = await buildPortfolioContext(req.supabase!, input.portfolioId).catch(
        (err) => {
          logger.warn({ err }, 'Failed to build portfolio context for chat');
          return undefined;
        },
      );
    }

    // ---- Persist user message (immediately, so refresh works) ----
    const { error: userMsgErr } = await req.supabase!.from('chat_messages').insert({
      session_id: sessionId,
      role: 'user',
      content: input.message,
    });
    if (userMsgErr) {
      throw new AppError(userMsgErr.message, { status: 500, code: 'DB_ERROR' });
    }

    // ---- Stream back the assistant response ----
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const write = (event: string, payload: unknown): void => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
    };

    write('session', { sessionId });

    let assistantText = '';
    try {
      for await (const chunk of streamChat({
        history,
        userMessage: input.message,
        portfolio: portfolioCtx,
      })) {
        assistantText += chunk;
        write('delta', { text: chunk });
      }
    } catch (err) {
      logger.error({ err }, 'Gemini stream failed');
      write('error', { code: 'GEMINI_ERROR', message: 'The advisor is unavailable right now.' });
      res.end();
      return;
    }

    // ---- Persist the assistant message ----
    const { data: assistantRow, error: assistantErr } = await req.supabase!
      .from('chat_messages')
      .insert({
        session_id: sessionId,
        role: 'assistant',
        content: assistantText,
      })
      .select('id')
      .single();
    if (assistantErr) {
      logger.warn({ err: assistantErr }, 'Could not persist assistant turn');
    }

    // Touch the session so it sorts to top of the list.
    await req.supabase!
      .from('chat_sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', sessionId);

    write('done', { messageId: assistantRow?.id ?? null });
    res.end();
  }),
);

async function buildPortfolioContext(
  supabase: NonNullable<Express.Request['supabase']>,
  portfolioId: string,
): Promise<PortfolioContext | undefined> {
  const { data: portfolio } = await supabase
    .from('portfolios')
    .select('name')
    .eq('id', portfolioId)
    .maybeSingle();
  if (!portfolio) return undefined;

  const { data: rows } = await supabase
    .from('holdings')
    .select('symbol, shares, purchase_price, purchase_date, sector')
    .eq('portfolio_id', portfolioId);
  if (!rows || rows.length === 0) {
    return { portfolioName: portfolio.name as string };
  }

  const holdings = rows.map((r) => ({
    symbol: r.symbol as string,
    shares: Number(r.shares),
    purchasePrice: Number(r.purchase_price),
    purchaseDate: r.purchase_date as string,
    sector: (r.sector as string | null) ?? null,
    notes: null,
  }));

  // Best-effort call to the ML engine so the advisor sees live metrics.
  // We swallow failures — the LLM can still give useful answers from raw holdings.
  let metrics: PortfolioContext['metrics'];
  let totalValue: number | undefined;
  let weighted: Array<{ symbol: string; shares: number; weight: number; sector: string | null }> =
    [];
  try {
    const m = await callMetrics({ holdings });
    metrics = {
      cagr: m.portfolio.cagr,
      volatility: m.portfolio.volatility,
      sharpe: m.portfolio.sharpe,
      sortino: m.portfolio.sortino,
      beta: m.portfolio.beta,
      maxDrawdown: m.portfolio.maxDrawdown,
      riskScore: m.riskScore,
      riskLabel: m.riskLabel,
    };
    totalValue = m.portfolio.totalValue;
    weighted = m.holdings.map((h) => ({
      symbol: h.symbol,
      shares: h.shares,
      weight: h.weight,
      sector: h.sector,
    }));
  } catch {
    const totalCost = holdings.reduce((s, h) => s + h.shares * h.purchasePrice, 0);
    weighted = holdings.map((h) => ({
      symbol: h.symbol,
      shares: h.shares,
      weight: totalCost > 0 ? (h.shares * h.purchasePrice) / totalCost : 0,
      sector: h.sector,
    }));
  }

  return {
    portfolioName: portfolio.name as string,
    totalValue,
    metrics,
    holdings: weighted,
  };
}
