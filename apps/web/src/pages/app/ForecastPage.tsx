import {
  tooltipContentStyle,
  tooltipCrosshair,
  tooltipItemStyle,
  tooltipLabelStyle,
  tooltipWrapperStyle,
} from '@/components/charts/tooltip';
import { TopBar } from '@/components/layout/TopBar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useSelectedPortfolio } from '@/contexts/SelectedPortfolioContext';
import { useForecast, type StockForecast } from '@/hooks/useForecast';
import { usePortfolios } from '@/hooks/usePortfolios';
import { cn, formatCurrency, formatDate, formatNumber, formatPercent } from '@/lib/utils';
import { motion } from 'framer-motion';
import {
  ArrowUpRight,
  CircleDashed,
  ExternalLink,
  Newspaper,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { toast } from 'sonner';

interface HorizonOption {
  label: string;
  days: number;
}

const HORIZONS: HorizonOption[] = [
  { label: '1 Week', days: 5 },
  { label: '1 Month', days: 21 },
  { label: '3 Months', days: 63 },
  { label: '6 Months', days: 126 },
  { label: '1 Year', days: 252 },
  { label: '3 Years', days: 756 },
  { label: '5 Years', days: 1260 },
];

export default function ForecastPage() {
  const portfolios = usePortfolios();
  const forecast = useForecast();
  const { selectedId, setSelectedId } = useSelectedPortfolio();
  const portfolioId = selectedId;
  const setPortfolioId = (id: string | undefined) => setSelectedId(id);

  const [horizonDays, setHorizonDays] = useState(252);
  const [lookbackYears, setLookbackYears] = useState(5);

  // Fall back to the first portfolio if nothing is selected, or if the stored
  // selection no longer exists (e.g. it was deleted in another tab).
  useEffect(() => {
    if (!portfolios.data || portfolios.data.length === 0) return;
    const stillExists = portfolioId && portfolios.data.some((p) => p.id === portfolioId);
    if (!stillExists) setSelectedId(portfolios.data[0]!.id);
  }, [portfolios.data, portfolioId, setSelectedId]);

  useEffect(() => {
    if (!portfolioId) return;
    forecast.mutate({ portfolioId, horizonDays, lookbackYears });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portfolioId, horizonDays, lookbackYears]);

  const data = forecast.data;

  return (
    <>
      <TopBar
        title="Forecast"
        actions={
          <>
            <Select
              value={portfolioId ?? ''}
              onValueChange={(v) => setPortfolioId(v)}
            >
              <SelectTrigger className="h-9 w-40 text-sm sm:w-56">
                <SelectValue placeholder="Pick a portfolio" />
              </SelectTrigger>
              <SelectContent>
                {portfolios.data?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={String(horizonDays)}
              onValueChange={(v) => setHorizonDays(Number(v))}
            >
              <SelectTrigger className="h-9 w-28 text-sm sm:w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HORIZONS.map((h) => (
                  <SelectItem key={h.days} value={String(h.days)}>
                    {h.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
          <IntroCard
            lookbackYears={lookbackYears}
            onLookbackChange={setLookbackYears}
            horizon={HORIZONS.find((h) => h.days === horizonDays)?.label ?? ''}
            loading={forecast.isPending}
            error={forecast.error instanceof Error ? forecast.error.message : null}
            onRetry={() =>
              portfolioId &&
              forecast.mutate({ portfolioId, horizonDays, lookbackYears })
            }
          />

          {forecast.isPending && !data ? (
            <SkeletonGrid />
          ) : data ? (
            data.forecasts.length === 0 ? (
              <EmptyState
                icon={<CircleDashed className="size-5" />}
                title="No forecastable holdings"
                description="None of your portfolio tickers returned usable price history from Yahoo Finance."
              />
            ) : (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {data.forecasts.map((f) => (
                  <ForecastCard key={f.symbol} forecast={f} horizonDays={horizonDays} />
                ))}
              </div>
            )
          ) : !portfolios.data || portfolios.data.length === 0 ? (
            <EmptyState
              icon={<Sparkles className="size-5" />}
              title="Nothing to forecast yet"
              description="Create a portfolio and add holdings to project each position 5 years forward."
              action={
                <Button asChild>
                  <Link to="/app/portfolios">Create a portfolio</Link>
                </Button>
              }
            />
          ) : null}
        </div>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────── Intro card */
interface IntroCardProps {
  lookbackYears: number;
  onLookbackChange: (years: number) => void;
  horizon: string;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

function IntroCard({
  lookbackYears,
  onLookbackChange,
  horizon,
  loading,
  error,
  onRetry,
}: IntroCardProps) {
  return (
    <Card className="relative overflow-hidden">
      <div className="absolute inset-0 bg-aurora opacity-60" aria-hidden />
      <CardHeader className="relative">
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-elevated)]/80 px-2.5 py-1 text-xs font-medium backdrop-blur">
          <Sparkles className="size-3 text-[var(--color-brand-400)]" />
          Real-time forecast · powered by yfinance + GBM
        </div>
        <CardTitle className="mt-3 text-xl md:text-2xl">
          Every stock in your portfolio, projected <span className="text-gradient">{horizon}</span> forward.
        </CardTitle>
        <CardDescription>
          We pull up to {lookbackYears} years of real-time prices from Yahoo Finance, fit a
          Geometric Brownian Motion model to the log-return distribution, and simulate 1,000
          forward paths per stock. The green cone is the 10th–90th percentile band and the
          middle line is the median. The latest headlines are fetched live for context.
        </CardDescription>
      </CardHeader>
      <CardContent className="relative flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-[var(--color-fg-muted)]">Training window</span>
          <Select value={String(lookbackYears)} onValueChange={(v) => onLookbackChange(Number(v))}>
            <SelectTrigger className="h-9 w-36 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 5, 10, 15].map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y} year{y === 1 ? '' : 's'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {loading ? (
          <span className="inline-flex items-center gap-2 text-xs text-[var(--color-fg-muted)]">
            <span className="inline-block size-2 animate-pulse rounded-full bg-[var(--color-brand-500)]" />
            Fetching live prices and projecting…
          </span>
        ) : null}
        {error ? (
          <div className="flex items-center gap-2 text-xs text-[var(--color-danger)]">
            <span>{error}</span>
            <Button variant="secondary" size="sm" onClick={onRetry}>
              Retry
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/* ─────────────────────────────────────────────── Per-stock card */

function ForecastCard({ forecast, horizonDays }: { forecast: StockForecast; horizonDays: number }) {
  const up = (forecast.oneYearChangePct ?? 0) >= 0;
  const projectedDeltaPct =
    (forecast.projectedMedianPrice - forecast.currentPrice) / forecast.currentPrice;
  const projectedUp = projectedDeltaPct >= 0;

  const chartData = useMemo(() => {
    const rows: Array<{
      date: string;
      history?: number | null;
      median?: number | null;
      low?: number | null;
      high?: number | null;
      cone?: [number, number] | null;
    }> = [];

    forecast.history.forEach((p) => {
      rows.push({ date: p.date, history: p.price });
    });
    // Join point — last history value seeds the median at t0 so the lines connect.
    if (forecast.history.length > 0) {
      const last = forecast.history[forecast.history.length - 1]!;
      rows[rows.length - 1] = { ...rows[rows.length - 1]!, median: last.price, low: last.price, high: last.price, cone: [last.price, last.price] };
    }
    forecast.forecastDates.forEach((d, i) => {
      const low = forecast.forecastP10[i] ?? 0;
      const high = forecast.forecastP90[i] ?? 0;
      rows.push({
        date: d,
        median: forecast.forecastP50[i] ?? null,
        low,
        high,
        cone: [low, high],
      });
    });
    return rows;
  }, [forecast]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <Card className="h-full overflow-hidden">
        <CardHeader className="gap-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-mono text-lg font-semibold tracking-wide">{forecast.symbol}</h3>
                {forecast.sector ? (
                  <Badge variant="outline" className="text-[10px]">
                    {forecast.sector}
                  </Badge>
                ) : null}
              </div>
              {forecast.companyName ? (
                <p className="truncate text-sm text-[var(--color-fg-muted)]">
                  {forecast.companyName}
                </p>
              ) : null}
            </div>
            <div className="text-right">
              <p className="text-xl font-semibold tabular-nums">
                {formatCurrency(forecast.currentPrice, forecast.currency ?? 'USD')}
              </p>
              {forecast.oneYearChangePct !== null ? (
                <p
                  className={cn(
                    'inline-flex items-center gap-1 text-xs font-medium',
                    up ? 'text-[var(--color-brand-300)]' : 'text-[color:#fca5a5]',
                  )}
                >
                  {up ? (
                    <TrendingUp className="size-3" />
                  ) : (
                    <TrendingDown className="size-3" />
                  )}
                  {formatPercent(forecast.oneYearChangePct)} · 1Y
                </p>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-52 w-full">
            <ResponsiveContainer>
              <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={`cone-${forecast.symbol}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.32} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  stroke="var(--color-border)"
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  stroke="var(--color-fg-subtle)"
                  tick={{ fontSize: 10 }}
                  tickMargin={6}
                  minTickGap={48}
                  tickFormatter={(d: string) => {
                    const dt = new Date(d);
                    return Number.isNaN(dt.getTime())
                      ? d
                      : dt.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
                  }}
                />
                <YAxis
                  stroke="var(--color-fg-subtle)"
                  tick={{ fontSize: 10 }}
                  tickMargin={4}
                  domain={['dataMin', 'dataMax']}
                  tickFormatter={(v: number) => `$${v.toFixed(0)}`}
                />
                <Tooltip
                  cursor={tooltipCrosshair}
                  wrapperStyle={tooltipWrapperStyle}
                  contentStyle={tooltipContentStyle}
                  labelStyle={tooltipLabelStyle}
                  itemStyle={tooltipItemStyle}
                  labelFormatter={(d: string) => formatDate(d)}
                  formatter={(v: unknown, name: string) => {
                    if (v === null || v === undefined) return ['—', name];
                    if (Array.isArray(v)) {
                      const [lo, hi] = v as [number, number];
                      return [`${formatCurrency(lo)} – ${formatCurrency(hi)}`, 'Cone'];
                    }
                    return [
                      formatCurrency(Number(v)),
                      name === 'history'
                        ? 'History'
                        : name === 'median'
                          ? 'Median forecast'
                          : name,
                    ];
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="cone"
                  stroke="none"
                  fill={`url(#cone-${forecast.symbol})`}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="history"
                  stroke="#6ee7b7"
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="median"
                  stroke="#fbbf24"
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  dot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <Stat label={`${forecastLookbackLabel(forecast)} CAGR`} value={formatPercent(forecast.cagr)} />
            <Stat label="Ann. volatility" value={formatPercent(forecast.volatility, 1)} />
            <Stat label="Sharpe" value={formatNumber(forecast.sharpe)} />
            <Stat
              label="Projected median"
              value={formatCurrency(forecast.projectedMedianPrice)}
              tone={projectedUp ? 'positive' : 'negative'}
              sub={`${formatPercent(projectedDeltaPct)} vs now`}
            />
          </div>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-muted)]/40 p-3 text-xs text-[var(--color-fg-muted)]">
            At the {horizonLabel(horizonDays)} horizon, simulations put this between{' '}
            <strong className="text-[var(--color-fg)]">
              {formatCurrency(forecast.projectedRangeLow)}
            </strong>{' '}
            and{' '}
            <strong className="text-[var(--color-fg)]">
              {formatCurrency(forecast.projectedRangeHigh)}
            </strong>{' '}
            (10th–90th percentile).{' '}
            <span className="font-medium text-[var(--color-brand-300)]">
              {(forecast.probabilityAboveCurrent * 100).toFixed(0)}%
            </span>{' '}
            chance of finishing above today&apos;s price.
          </div>

          <NewsSection symbol={forecast.symbol} news={forecast.news} />
        </CardContent>
      </Card>
    </motion.div>
  );
}

function Stat({
  label,
  value,
  tone,
  sub,
}: {
  label: string;
  value: string;
  tone?: 'positive' | 'negative';
  sub?: string;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)]">
        {label}
      </p>
      <p
        className={cn(
          'mt-1 text-sm font-semibold tabular-nums',
          tone === 'positive' && 'text-[var(--color-brand-300)]',
          tone === 'negative' && 'text-[color:#fca5a5]',
        )}
      >
        {value}
      </p>
      {sub ? <p className="mt-0.5 text-[10px] text-[var(--color-fg-subtle)]">{sub}</p> : null}
    </div>
  );
}

function NewsSection({ symbol, news }: { symbol: string; news: StockForecast['news'] }) {
  if (!news || news.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-dashed border-[var(--color-border)] px-3 py-2 text-xs text-[var(--color-fg-subtle)]">
        <Newspaper className="size-3.5" />
        No recent headlines from Yahoo Finance for {symbol}.
      </div>
    );
  }
  return (
    <div>
      <p className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.08em] text-[var(--color-fg-subtle)]">
        <Newspaper className="size-3.5" />
        Latest news
      </p>
      <ul className="space-y-1.5">
        {news.map((item, i) => (
          <li key={i}>
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                try {
                  // Hard guard — in case yfinance ever returns a garbage URL.
                  if (!/^https?:\/\//.test(item.url)) {
                    e.preventDefault();
                    toast.error('That article link looks malformed.');
                  }
                } catch {
                  /* noop */
                }
              }}
              className="group flex items-start gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-[var(--color-bg-muted)]"
            >
              <ArrowUpRight className="mt-1 size-3.5 shrink-0 text-[var(--color-fg-subtle)] group-hover:text-[var(--color-brand-400)]" />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm leading-snug">{item.title}</p>
                <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[var(--color-fg-subtle)]">
                  {item.publisher ? <span>{item.publisher}</span> : null}
                  {item.publishedAt ? (
                    <>
                      {item.publisher ? <span>·</span> : null}
                      <span>{formatRelativeTime(item.publishedAt)}</span>
                    </>
                  ) : null}
                  <ExternalLink className="size-3 opacity-60" />
                </div>
              </div>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ─────────────────────────────────────────────── Helpers */

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-[420px] w-full rounded-2xl" />
      ))}
    </div>
  );
}

function horizonLabel(days: number): string {
  const opt = HORIZONS.find((h) => h.days === days);
  return opt ? opt.label.toLowerCase() : `${days}-day`;
}

function forecastLookbackLabel(forecast: StockForecast): string {
  // Rough label for the CAGR stat — reflects how much history we actually fit.
  const spanDays = forecast.history.length > 1 ? forecast.history.length : 0;
  if (spanDays === 0) return '';
  const yrs = spanDays / 252;
  return yrs >= 1 ? `${Math.round(yrs)}Y` : '';
}

function formatRelativeTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diffMs = Date.now() - d.getTime();
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
