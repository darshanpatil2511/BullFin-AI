import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import type { MetricsResponse } from '@bullfin/shared';

/**
 * Build a proper text-based investor report using jsPDF's text API:
 * - Cover page with branded header, KPI grid, and risk profile
 * - Performance page with one rasterized chart
 * - Holdings table (typed text, not a screenshot)
 * - Sector exposure as a clean text list
 * - AI-written executive summary (passed in as Markdown-lite)
 *
 * Only the performance chart is rasterized because Recharts SVGs can't be
 * cleanly embedded as vectors; everything else is real text.
 */

/**
 * Which optional sections to include. The cover page is always rendered.
 * Defaults to all sections on when not specified (backwards compatible).
 */
export interface ReportSections {
  performance?: boolean;
  holdings?: boolean;
  sectors?: boolean;
  summary?: boolean;
}

export interface ReportInput {
  portfolioName: string;
  generatedAt: Date;
  metrics: MetricsResponse;
  /** Optional HTMLElement of the performance chart to embed as an image. */
  performanceNode?: HTMLElement | null;
  /** AI-authored executive summary (Markdown-lite: headings, lists). */
  summary: string;
  /** Opt-in / opt-out per section. All sections default to ON. */
  sections?: ReportSections;
}

// ---- Palette ----------------------------------------------------------------
const COLOR_BRAND: RGB = [16, 185, 129]; // emerald-500
const COLOR_BRAND_DARK: RGB = [4, 120, 87]; // emerald-700
const COLOR_FG: RGB = [15, 23, 42]; // slate-900
const COLOR_MUTED: RGB = [71, 85, 105]; // slate-600
const COLOR_SUBTLE: RGB = [148, 163, 184]; // slate-400
const COLOR_BG: RGB = [248, 250, 252]; // slate-50
const COLOR_BORDER: RGB = [226, 232, 240]; // slate-200
const COLOR_POS: RGB = [22, 163, 74]; // green-600
const COLOR_NEG: RGB = [220, 38, 38]; // red-600
const COLOR_AMBER: RGB = [217, 119, 6]; // amber-600

type RGB = [number, number, number];

// ============================================================================
// Public entrypoint
// ============================================================================
export async function exportReportToPdf(input: ReportInput): Promise<Blob> {
  const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
  const ctx: Ctx = {
    pdf,
    pageWidth: pdf.internal.pageSize.getWidth(),
    pageHeight: pdf.internal.pageSize.getHeight(),
    margin: 40,
  };

  // Default every section ON so existing callers keep their old behavior.
  const s: Required<ReportSections> = {
    performance: input.sections?.performance ?? true,
    holdings: input.sections?.holdings ?? true,
    sectors: input.sections?.sectors ?? true,
    summary: input.sections?.summary ?? true,
  };

  drawHeader(ctx);
  drawCover(ctx, input);

  if (s.performance) {
    pdf.addPage();
    drawHeader(ctx);
    await drawPerformance(ctx, input);
  }

  if (s.holdings) {
    pdf.addPage();
    drawHeader(ctx);
    drawHoldings(ctx, input.metrics);
  }

  if (s.sectors) {
    pdf.addPage();
    drawHeader(ctx);
    drawSectors(ctx, input.metrics);
  }

  if (s.summary) {
    pdf.addPage();
    drawHeader(ctx);
    drawSummary(ctx, input.summary);
  }

  // Page numbers across the whole document.
  const total = pdf.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    pdf.setPage(p);
    drawFooter(ctx, p, total);
  }

  return pdf.output('blob');
}

// ============================================================================
// Low-level helpers
// ============================================================================

interface Ctx {
  pdf: jsPDF;
  pageWidth: number;
  pageHeight: number;
  margin: number;
}

function setFill(pdf: jsPDF, [r, g, b]: RGB): void {
  pdf.setFillColor(r, g, b);
}
function setDraw(pdf: jsPDF, [r, g, b]: RGB): void {
  pdf.setDrawColor(r, g, b);
}
function setText(pdf: jsPDF, [r, g, b]: RGB): void {
  pdf.setTextColor(r, g, b);
}

function fmtCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value);
}

function fmtPercent(value: number, digits = 2): string {
  const pct = value * 100;
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(digits)}%`;
}

function fmtNumber(value: number, digits = 2): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

// ============================================================================
// Header / Footer
// ============================================================================
function drawHeader(ctx: Ctx): void {
  const { pdf, pageWidth } = ctx;
  // Thin green bar at the very top.
  setFill(pdf, COLOR_BRAND);
  pdf.rect(0, 0, pageWidth, 6, 'F');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  setText(pdf, COLOR_BRAND_DARK);
  pdf.text('BullFin', ctx.margin, 28);
  pdf.setFont('helvetica', 'normal');
  setText(pdf, COLOR_MUTED);
  pdf.text('.AI', ctx.margin + pdf.getTextWidth('BullFin'), 28);

  setText(pdf, COLOR_SUBTLE);
  pdf.setFontSize(9);
  pdf.text('Portfolio Intelligence Report', pageWidth - ctx.margin, 28, { align: 'right' });

  setDraw(pdf, COLOR_BORDER);
  pdf.setLineWidth(0.5);
  pdf.line(ctx.margin, 38, pageWidth - ctx.margin, 38);
}

function drawFooter(ctx: Ctx, page: number, total: number): void {
  const { pdf, pageWidth, pageHeight, margin } = ctx;
  setDraw(pdf, COLOR_BORDER);
  pdf.setLineWidth(0.5);
  pdf.line(margin, pageHeight - 30, pageWidth - margin, pageHeight - 30);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  setText(pdf, COLOR_SUBTLE);
  pdf.text(`BullFin-AI`, margin, pageHeight - 16);
  pdf.text(`Page ${page} / ${total}`, pageWidth - margin, pageHeight - 16, {
    align: 'right',
  });
}

// ============================================================================
// Page 1 — Cover + KPIs
// ============================================================================
function drawCover(ctx: Ctx, input: ReportInput): void {
  const { pdf, pageWidth, margin } = ctx;
  let y = 70;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  setText(pdf, COLOR_BRAND);
  pdf.text(
    'PORTFOLIO REPORT'.split('').join(' '), // letter-spaced feel
    margin,
    y,
  );
  y += 26;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(26);
  setText(pdf, COLOR_FG);
  pdf.text(input.portfolioName, margin, y);
  y += 20;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  setText(pdf, COLOR_MUTED);
  pdf.text(
    `Generated on ${input.generatedAt.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })}`,
    margin,
    y,
  );
  y += 22;

  // Brand underline.
  setDraw(pdf, COLOR_BRAND);
  pdf.setLineWidth(2);
  pdf.line(margin, y, margin + 42, y);
  y += 30;

  // KPI grid — 2 rows × 4 columns
  const m = input.metrics.portfolio;
  const kpis: Array<{ label: string; value: string; tone?: 'pos' | 'neg' | 'amber' }> = [
    { label: 'Total value', value: fmtCurrency(m.totalValue) },
    {
      label: 'Total return',
      value: fmtPercent(m.totalReturn),
      tone: m.totalReturn >= 0 ? 'pos' : 'neg',
    },
    { label: 'CAGR', value: fmtPercent(m.cagr) },
    { label: 'Sharpe', value: fmtNumber(m.sharpe) },
    { label: 'Volatility', value: fmtPercent(m.volatility, 1) },
    { label: 'Max drawdown', value: fmtPercent(m.maxDrawdown, 1), tone: 'neg' },
    { label: 'Beta vs SPY', value: m.beta !== null ? fmtNumber(m.beta) : 'n/a' },
    {
      label: 'Diversification',
      value: fmtNumber(m.diversificationIndex),
    },
  ];
  const colW = (pageWidth - margin * 2) / 4;
  const rowH = 70;
  kpis.forEach((kpi, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const x = margin + col * colW;
    const yTop = y + row * rowH;

    // Card background
    setFill(pdf, COLOR_BG);
    setDraw(pdf, COLOR_BORDER);
    pdf.setLineWidth(0.5);
    pdf.roundedRect(x, yTop, colW - 10, rowH - 10, 6, 6, 'FD');

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    setText(pdf, COLOR_SUBTLE);
    pdf.text(kpi.label.toUpperCase(), x + 10, yTop + 18);

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    const valueColor =
      kpi.tone === 'pos' ? COLOR_POS : kpi.tone === 'neg' ? COLOR_NEG : kpi.tone === 'amber' ? COLOR_AMBER : COLOR_FG;
    setText(pdf, valueColor);
    pdf.text(kpi.value, x + 10, yTop + 42);
  });
  y += rowH * 2 + 10;

  // Risk profile bar
  drawRiskProfile(ctx, input.metrics, y);
}

function drawRiskProfile(ctx: Ctx, metrics: MetricsResponse, y: number): void {
  const { pdf, pageWidth, margin } = ctx;
  const score = metrics.riskScore;
  const label = metrics.riskLabel;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12);
  setText(pdf, COLOR_FG);
  pdf.text('Risk profile', margin, y);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  setText(pdf, scoreColor(score));
  pdf.text(`${score} / 100`, pageWidth - margin, y, { align: 'right' });

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  setText(pdf, COLOR_MUTED);
  pdf.text(label, pageWidth - margin, y + 14, { align: 'right' });

  // Track
  const trackY = y + 22;
  const trackH = 8;
  const trackX = margin;
  const trackW = pageWidth - margin * 2;
  setFill(pdf, COLOR_BORDER);
  pdf.roundedRect(trackX, trackY, trackW, trackH, 4, 4, 'F');

  // Fill — width scales with score.
  setFill(pdf, scoreColor(score));
  const fillW = Math.max(6, (trackW * score) / 100);
  pdf.roundedRect(trackX, trackY, fillW, trackH, 4, 4, 'F');

  // Tick marks at quartiles
  setDraw(pdf, COLOR_SUBTLE);
  pdf.setLineWidth(0.3);
  [25, 50, 75].forEach((t) => {
    const tx = trackX + (trackW * t) / 100;
    pdf.line(tx, trackY - 2, tx, trackY + trackH + 2);
  });

  pdf.setFontSize(8);
  setText(pdf, COLOR_SUBTLE);
  pdf.text('Conservative', trackX, trackY + trackH + 16);
  pdf.text('Speculative', trackX + trackW, trackY + trackH + 16, { align: 'right' });
}

function scoreColor(score: number): RGB {
  if (score < 25) return COLOR_POS;
  if (score < 50) return [132, 204, 22]; // lime-500
  if (score < 75) return COLOR_AMBER;
  return COLOR_NEG;
}

// ============================================================================
// Page 2 — Performance chart (one rasterized image)
// ============================================================================
async function drawPerformance(ctx: Ctx, input: ReportInput): Promise<void> {
  const { pdf, pageWidth, margin } = ctx;
  let y = 70;

  sectionHeader(ctx, 'Performance vs Benchmark', y);
  y += 32;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  setText(pdf, COLOR_MUTED);
  const benchmark = input.metrics.benchmark?.symbol ?? 'SPY';
  pdf.text(
    `Cumulative growth of $1 invested, portfolio vs. ${benchmark}.`,
    margin,
    y,
  );
  y += 24;

  if (input.performanceNode) {
    // The chart renders with dark-theme CSS variables, so capture on its native
    // dark background. It reads nicely as a contrast accent on the light PDF.
    const canvas = await html2canvas(input.performanceNode, {
      scale: 2,
      backgroundColor: '#17171a',
      useCORS: true,
    });
    const img = canvas.toDataURL('image/jpeg', 0.88);
    const ratio = canvas.width / canvas.height;
    const renderWidth = pageWidth - margin * 2;
    const renderHeight = renderWidth / ratio;
    pdf.addImage(img, 'JPEG', margin, y, renderWidth, renderHeight);
    y += renderHeight + 16;
  }

  // Short commentary below the chart.
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  setText(pdf, COLOR_FG);
  const m = input.metrics.portfolio;
  const commentary = [
    `Total return since earliest purchase: ${fmtPercent(m.totalReturn)} (${fmtCurrency(
      m.totalReturnAmount,
    )}).`,
    `Annualized growth rate (CAGR): ${fmtPercent(m.cagr)}.`,
    `Sharpe ratio: ${fmtNumber(m.sharpe)} — higher means better risk-adjusted return.`,
    `Max drawdown (largest peak-to-trough loss): ${fmtPercent(m.maxDrawdown, 1)}.`,
  ];
  commentary.forEach((line) => {
    pdf.text(`•  ${line}`, margin, y);
    y += 16;
  });
}

// ============================================================================
// Page 3 — Holdings table
// ============================================================================
function drawHoldings(ctx: Ctx, metrics: MetricsResponse): void {
  const { pdf, pageWidth, margin } = ctx;
  let y = 70;
  sectionHeader(ctx, 'Holdings', y);
  y += 36;

  const cols = [
    { header: 'Symbol', width: 60, align: 'left' as const },
    { header: 'Shares', width: 60, align: 'right' as const },
    { header: 'Cost', width: 70, align: 'right' as const },
    { header: 'Price', width: 70, align: 'right' as const },
    { header: 'Value', width: 85, align: 'right' as const },
    { header: 'P&L', width: 75, align: 'right' as const },
    { header: 'Weight', width: 60, align: 'right' as const },
  ];
  const tableX = margin;
  const tableW = pageWidth - margin * 2;
  const colWidths = cols.map((c) => (c.width / 480) * tableW);

  // Header row
  setFill(pdf, COLOR_BG);
  pdf.rect(tableX, y - 14, tableW, 20, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  setText(pdf, COLOR_MUTED);
  let cx = tableX;
  cols.forEach((col, i) => {
    const w = colWidths[i]!;
    const textX = col.align === 'right' ? cx + w - 8 : cx + 8;
    pdf.text(col.header.toUpperCase(), textX, y, { align: col.align });
    cx += w;
  });
  y += 12;

  setDraw(pdf, COLOR_BORDER);
  pdf.setLineWidth(0.5);
  pdf.line(tableX, y, tableX + tableW, y);
  y += 6;

  // Body
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  const rowHeight = 18;
  metrics.holdings.forEach((h) => {
    cx = tableX;
    const values: Array<{ text: string; color?: RGB; weight?: 'bold' | 'normal' }> = [
      { text: h.symbol, weight: 'bold' },
      { text: fmtNumber(h.shares, 4) },
      { text: fmtCurrency(h.purchasePrice) },
      { text: fmtCurrency(h.currentPrice) },
      { text: fmtCurrency(h.currentValue) },
      {
        text: fmtPercent(h.unrealizedPnlPct / 100, 2),
        color: h.unrealizedPnl >= 0 ? COLOR_POS : COLOR_NEG,
      },
      { text: `${(h.weight * 100).toFixed(1)}%` },
    ];
    cols.forEach((col, i) => {
      const w = colWidths[i]!;
      const v = values[i]!;
      pdf.setFont('helvetica', v.weight ?? 'normal');
      setText(pdf, v.color ?? COLOR_FG);
      const textX = col.align === 'right' ? cx + w - 8 : cx + 8;
      pdf.text(v.text, textX, y, { align: col.align });
      cx += w;
    });
    y += rowHeight;
  });

  // Summary row
  y += 4;
  setDraw(pdf, COLOR_BORDER);
  pdf.line(tableX, y, tableX + tableW, y);
  y += 14;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  setText(pdf, COLOR_FG);
  pdf.text('Totals', tableX + 8, y);
  setText(pdf, COLOR_FG);
  pdf.text(fmtCurrency(metrics.portfolio.totalCost), tableX + tableW * (60 + 60 + 70) / 480, y, {
    align: 'right',
  });
  pdf.text(
    fmtCurrency(metrics.portfolio.totalValue),
    tableX + tableW * (60 + 60 + 70 + 70 + 85) / 480,
    y,
    { align: 'right' },
  );
  setText(
    pdf,
    metrics.portfolio.totalReturn >= 0 ? COLOR_POS : COLOR_NEG,
  );
  pdf.text(
    fmtPercent(metrics.portfolio.totalReturn),
    tableX + tableW * (60 + 60 + 70 + 70 + 85 + 75) / 480,
    y,
    { align: 'right' },
  );
}

// ============================================================================
// Page 4 — Sector exposure + risk explanation
// ============================================================================
function drawSectors(ctx: Ctx, metrics: MetricsResponse): void {
  const { pdf, pageWidth, margin } = ctx;
  let y = 70;

  sectionHeader(ctx, 'Sector Exposure', y);
  y += 36;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  setText(pdf, COLOR_MUTED);
  pdf.text('Where your money lives, grouped by GICS-style sector.', margin, y);
  y += 20;

  const barMaxWidth = pageWidth - margin * 2 - 140;
  const totalValue = metrics.portfolio.totalValue || 1;
  metrics.sectorExposure.slice(0, 10).forEach((s) => {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    setText(pdf, COLOR_FG);
    pdf.text(s.sector || 'Unknown', margin, y);

    // Bar
    const barW = Math.max(4, (s.value / totalValue) * barMaxWidth);
    setFill(pdf, COLOR_BRAND);
    pdf.roundedRect(margin + 130, y - 9, barW, 10, 2, 2, 'F');

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    setText(pdf, COLOR_MUTED);
    pdf.text(
      `${(s.weight * 100).toFixed(1)}%`,
      pageWidth - margin,
      y,
      { align: 'right' },
    );
    y += 18;
  });

  y += 14;
  sectionHeader(ctx, 'Risk signals', y);
  y += 32;

  const m = metrics.portfolio;
  const rows: Array<[string, string, string]> = [
    [
      'Annualized volatility',
      fmtPercent(m.volatility, 1),
      'How much day-to-day bumpiness to expect.',
    ],
    [
      'Beta vs SPY',
      m.beta !== null ? fmtNumber(m.beta) : 'n/a',
      'Sensitivity to the broader market. 1.0 tracks SPY exactly.',
    ],
    [
      'Jensen\'s alpha',
      m.alpha !== null ? fmtPercent(m.alpha) : 'n/a',
      'Excess return after controlling for market exposure.',
    ],
    [
      'Value-at-Risk (95%)',
      fmtPercent(m.valueAtRisk95, 1),
      '1-day worst-case loss under typical conditions.',
    ],
    [
      'Diversification index',
      fmtNumber(m.diversificationIndex),
      '1.0 = perfectly diversified. Lower = more concentrated.',
    ],
  ];
  rows.forEach(([label, val, desc]) => {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    setText(pdf, COLOR_FG);
    pdf.text(label, margin, y);

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    setText(pdf, COLOR_BRAND_DARK);
    pdf.text(val, margin + 170, y);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    setText(pdf, COLOR_MUTED);
    pdf.text(desc, margin + 240, y);
    y += 20;
  });
}

// ============================================================================
// Page 5 — AI Executive Summary
// ============================================================================
function drawSummary(ctx: Ctx, summary: string): void {
  const { pdf, pageWidth, margin } = ctx;
  let y = 70;
  sectionHeader(ctx, 'Executive Summary', y);
  y += 36;

  pdf.setFont('helvetica', 'italic');
  pdf.setFontSize(9);
  setText(pdf, COLOR_SUBTLE);
  pdf.text('Generated by BullFin-AI using Google Gemini.', margin, y);
  y += 22;

  y = renderMarkdownLite(ctx, summary, y);
}

// Renders the Gemini output's light Markdown — `## heading`, `- bullets`, paragraphs.
function renderMarkdownLite(ctx: Ctx, text: string, startY: number): number {
  const { pdf, pageWidth, pageHeight, margin } = ctx;
  const maxWidth = pageWidth - margin * 2;
  const bottomLimit = pageHeight - 60;
  let y = startY;

  const ensure = (nextHeight: number): void => {
    if (y + nextHeight > bottomLimit) {
      pdf.addPage();
      drawHeader(ctx);
      y = 70;
    }
  };

  const lines = text.split('\n');
  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/g, '');
    if (!line) {
      y += 6;
      continue;
    }
    if (line.startsWith('## ')) {
      ensure(30);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(14);
      setText(pdf, COLOR_FG);
      pdf.text(line.slice(3), margin, y);
      y += 20;
      continue;
    }
    if (line.startsWith('# ')) {
      ensure(34);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(16);
      setText(pdf, COLOR_FG);
      pdf.text(line.slice(2), margin, y);
      y += 24;
      continue;
    }
    if (line === '---') {
      ensure(14);
      setDraw(pdf, COLOR_BORDER);
      pdf.setLineWidth(0.5);
      pdf.line(margin, y - 4, pageWidth - margin, y - 4);
      y += 6;
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const body = line.replace(/^[-*]\s+/, '');
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      setText(pdf, COLOR_FG);
      const wrapped = pdf.splitTextToSize(body, maxWidth - 18) as string[];
      wrapped.forEach((w, i) => {
        ensure(15);
        if (i === 0) {
          setText(pdf, COLOR_BRAND);
          pdf.text('•', margin, y);
          setText(pdf, COLOR_FG);
        }
        pdf.text(w, margin + 14, y);
        y += 14;
      });
      y += 2;
      continue;
    }

    // Paragraph — emit inline bold and italic.
    renderInlineParagraph(ctx, line, maxWidth, {
      get y() {
        return y;
      },
      set y(v) {
        y = v;
      },
      ensure,
    });
  }

  return y;
}

interface ParagraphCursor {
  y: number;
  ensure: (nextHeight: number) => void;
}

function renderInlineParagraph(
  ctx: Ctx,
  line: string,
  maxWidth: number,
  cursor: ParagraphCursor,
): void {
  const { pdf, margin } = ctx;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  setText(pdf, COLOR_FG);
  // Split into bold segments using **bold** pattern.
  const parts = line.split(/(\*\*[^*]+\*\*|_[^_]+_)/g).filter(Boolean);

  // Build word-level segments with style so we can wrap manually.
  type Token = { text: string; bold: boolean; italic: boolean };
  const tokens: Token[] = [];
  for (const p of parts) {
    if (p.startsWith('**') && p.endsWith('**')) {
      p.slice(2, -2)
        .split(/\s+/)
        .filter(Boolean)
        .forEach((w) => tokens.push({ text: w, bold: true, italic: false }));
    } else if (p.startsWith('_') && p.endsWith('_')) {
      p.slice(1, -1)
        .split(/\s+/)
        .filter(Boolean)
        .forEach((w) => tokens.push({ text: w, bold: false, italic: true }));
    } else {
      p.split(/\s+/)
        .filter(Boolean)
        .forEach((w) => tokens.push({ text: w, bold: false, italic: false }));
    }
  }

  let x = margin;
  const lineHeight = 14;
  cursor.ensure(lineHeight);

  const spaceWidth = pdf.getTextWidth(' ');

  tokens.forEach((t, i) => {
    const style = t.bold ? 'bold' : t.italic ? 'italic' : 'normal';
    pdf.setFont('helvetica', style);
    const w = pdf.getTextWidth(t.text);
    if (x + w > margin + maxWidth) {
      cursor.y += lineHeight;
      cursor.ensure(lineHeight);
      x = margin;
    }
    pdf.text(t.text, x, cursor.y);
    x += w;
    if (i < tokens.length - 1) {
      x += spaceWidth;
    }
  });

  cursor.y += lineHeight + 2;
}

// ============================================================================
// Shared
// ============================================================================
function sectionHeader(ctx: Ctx, title: string, y: number): void {
  const { pdf, margin } = ctx;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  setText(pdf, COLOR_FG);
  pdf.text(title, margin, y);

  setDraw(pdf, COLOR_BRAND);
  pdf.setLineWidth(2);
  pdf.line(margin, y + 6, margin + 28, y + 6);
}
