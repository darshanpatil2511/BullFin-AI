import { GoogleGenerativeAI, type Content } from '@google/generative-ai';
import { env } from '../config.js';

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);

const SYSTEM_PROMPT = `You are BullFin-AI, a professional AI portfolio advisor.

Your job:
- Answer questions about the user's portfolio in plain, friendly English.
- Explain metrics (Sharpe, Beta, Volatility, Max Drawdown, etc.) when asked, at an appropriate depth.
- Offer concrete observations and trade-offs — never prescriptive "buy/sell" advice.
- Always end with a clear disclaimer that this is educational analysis, not licensed financial advice.

Formatting:
- Use short paragraphs and bullet points. Avoid walls of text.
- Quote numbers with 2 decimals and percentage signs (e.g. "Sharpe: 1.25", "Return: 8.40%").
- When the user asks for a recommendation, offer 2–3 perspectives with pros and cons rather than a single "do this" answer.

Safety:
- If asked about specific illegal activity, refuse politely.
- If the user shares personally identifying information beyond email/name, do not repeat it back.`;

export interface PortfolioContext {
  portfolioName?: string;
  totalValue?: number;
  holdings?: Array<{ symbol: string; shares: number; weight: number; sector?: string | null }>;
  metrics?: {
    cagr?: number;
    volatility?: number;
    sharpe?: number;
    sortino?: number;
    beta?: number | null;
    maxDrawdown?: number;
    riskScore?: number;
    riskLabel?: string;
  };
}

function renderPortfolioContext(ctx: PortfolioContext | undefined): string {
  if (!ctx || (!ctx.holdings?.length && !ctx.metrics)) {
    return 'The user has not attached a portfolio to this conversation yet.';
  }
  const lines: string[] = [];
  if (ctx.portfolioName) lines.push(`Portfolio: ${ctx.portfolioName}`);
  if (ctx.totalValue !== undefined) lines.push(`Total value: $${ctx.totalValue.toFixed(2)}`);
  if (ctx.metrics) {
    const m = ctx.metrics;
    lines.push('Metrics:');
    if (m.cagr !== undefined) lines.push(`  - CAGR: ${(m.cagr * 100).toFixed(2)}%`);
    if (m.volatility !== undefined) lines.push(`  - Volatility: ${(m.volatility * 100).toFixed(2)}%`);
    if (m.sharpe !== undefined) lines.push(`  - Sharpe: ${m.sharpe.toFixed(2)}`);
    if (m.sortino !== undefined) lines.push(`  - Sortino: ${m.sortino.toFixed(2)}`);
    if (m.beta !== null && m.beta !== undefined) lines.push(`  - Beta: ${m.beta.toFixed(2)}`);
    if (m.maxDrawdown !== undefined)
      lines.push(`  - Max Drawdown: ${(m.maxDrawdown * 100).toFixed(2)}%`);
    if (m.riskScore !== undefined)
      lines.push(`  - Risk Score: ${m.riskScore}/100 (${m.riskLabel ?? 'n/a'})`);
  }
  if (ctx.holdings?.length) {
    lines.push('Holdings (weight shown as % of portfolio):');
    for (const h of ctx.holdings) {
      const sector = h.sector ? ` — ${h.sector}` : '';
      lines.push(`  - ${h.symbol}: ${h.shares} shares, ${(h.weight * 100).toFixed(1)}%${sector}`);
    }
  }
  return lines.join('\n');
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Streams Gemini chat completions for a single user turn. History is
 * replayed into the model so responses stay coherent within a session.
 * Returns an AsyncIterable of text chunks.
 */
export async function* streamChat(params: {
  history: ChatTurn[];
  userMessage: string;
  portfolio?: PortfolioContext;
}): AsyncGenerator<string, void, unknown> {
  const model = genAI.getGenerativeModel({
    model: env.GEMINI_MODEL,
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      temperature: 0.6,
      maxOutputTokens: 2048,
    },
  });

  const contents: Content[] = [
    {
      role: 'user',
      parts: [
        {
          text: `Context (not from the user — injected by the platform):\n${renderPortfolioContext(
            params.portfolio,
          )}\n\nRespond to subsequent user messages using this context.`,
        },
      ],
    },
    { role: 'model', parts: [{ text: 'Understood. I will use this portfolio context for my answers.' }] },
    ...params.history.map<Content>((turn) => ({
      role: turn.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: turn.content }],
    })),
    { role: 'user', parts: [{ text: params.userMessage }] },
  ];

  const result = await model.generateContentStream({ contents });
  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) yield text;
  }
}

/**
 * Non-streaming variant used for short, fire-and-forget generations like
 * the executive summary that ships inside the PDF report.
 */
export async function generateSummary(prompt: string): Promise<string> {
  const model = genAI.getGenerativeModel({
    model: env.GEMINI_MODEL,
    generationConfig: { temperature: 0.4, maxOutputTokens: 600 },
  });
  const result = await model.generateContent(prompt);
  return result.response.text();
}
