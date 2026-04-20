import { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PlayCircle, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { TopBar } from '@/components/layout/TopBar';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { InfoHint } from '@/components/ui/info-hint';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { apiFetch } from '@/lib/api';
import { usePortfolios } from '@/hooks/usePortfolios';
import { useSelectedPortfolio } from '@/contexts/SelectedPortfolioContext';
import { formatCurrency, formatPercent } from '@/lib/utils';

type HorizonUnit = 'weeks' | 'months' | 'years';

// Conversion to fractional years for the API payload.
const UNIT_TO_YEARS: Record<HorizonUnit, number> = {
  weeks: 1 / 52,
  months: 1 / 12,
  years: 1,
};

const TRADING_DAYS_PER_YEAR = 252;

interface MonteCarloResponse {
  percentiles: { p10: number[]; p50: number[]; p90: number[] };
  sampledDays: number[];
  horizonDays: number;
  medianFinalValue: number;
  probabilityAboveInitial: number;
  years: number;
}

interface FrontierPoint {
  expectedReturn: number;
  volatility: number;
  sharpe: number;
  weights: Record<string, number>;
}
interface FrontierResponse {
  frontier: FrontierPoint[];
  maxSharpe: FrontierPoint;
  minVolatility: FrontierPoint;
}

export default function AnalyzePage() {
  const portfolios = usePortfolios();
  const { selectedId, setSelectedId } = useSelectedPortfolio();
  const portfolioId = selectedId;
  const setPortfolioId = (id: string | undefined) => setSelectedId(id);

  // If the stored selection is no longer a portfolio the user owns (e.g.
  // it was deleted in another tab), fall back to the first one.
  useEffect(() => {
    if (!portfolios.data) return;
    if (portfolioId && !portfolios.data.some((p) => p.id === portfolioId)) {
      setSelectedId(portfolios.data[0]?.id);
    }
  }, [portfolioId, portfolios.data, setSelectedId]);

  // Monte Carlo form state
  const [horizonValue, setHorizonValue] = useState(15);
  const [horizonUnit, setHorizonUnit] = useState<HorizonUnit>('years');
  const [contribution, setContribution] = useState(0);
  const [mc, setMc] = useState<MonteCarloResponse | null>(null);
  const [mcLoading, setMcLoading] = useState(false);

  // Efficient Frontier form state
  const [symbols, setSymbols] = useState('SPY,QQQ,AAPL,MSFT,NVDA');
  const [lookbackYears, setLookbackYears] = useState(3);
  const [frontier, setFrontier] = useState<FrontierResponse | null>(null);
  const [frontierLoading, setFrontierLoading] = useState(false);

  async function runMonteCarlo() {
    if (!portfolioId) return;
    setMcLoading(true);
    try {
      const years = Math.max(0.05, horizonValue * UNIT_TO_YEARS[horizonUnit]);
      const data = await apiFetch<MonteCarloResponse>('/analyze/monte-carlo', {
        method: 'POST',
        body: { portfolioId, years, simulations: 5000, annualContribution: contribution },
      });
      setMc(data);
    } catch (err) {
      toast.error('Monte Carlo failed', {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setMcLoading(false);
    }
  }

  async function runFrontier() {
    setFrontierLoading(true);
    try {
      const list = symbols
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
      if (list.length < 2) throw new Error('Enter at least 2 tickers, comma-separated.');
      const data = await apiFetch<FrontierResponse>('/analyze/efficient-frontier', {
        method: 'POST',
        body: { symbols: list, points: 25, lookbackYears },
      });
      setFrontier(data);
    } catch (err) {
      toast.error('Efficient frontier failed', {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setFrontierLoading(false);
    }
  }

  // Build the MC chart data from the returned percentile arrays, keyed by the
  // explicit day index the ML engine sampled at. This lets us render sensible
  // axis ticks whether the user picked 4 weeks or 30 years.
  const mcChart = useMemo(() => {
    if (!mc) return [];
    return mc.sampledDays.map((day, i) => ({
      day,
      p10: mc.percentiles.p10[i],
      p50: mc.percentiles.p50[i],
      p90: mc.percentiles.p90[i],
    }));
  }, [mc]);

  // Adaptive X-axis ticks + formatter based on the actual horizon length.
  const mcAxis = useMemo(() => mcAxisFor(mc?.horizonDays ?? 0), [mc]);

  return (
    <>
      <TopBar title="Analyze" />
      <div className="flex-1 overflow-y-auto space-y-6 p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-[var(--color-brand-400)]" />
              Monte Carlo projection
            </CardTitle>
            <CardDescription>
              Simulate 5,000 possible futures for a portfolio based on its historical return
              distribution. The cone shows the 10th, 50th (median), and 90th percentile outcomes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.2fr_1fr_1fr_auto]">
              <div className="space-y-1.5">
                <Label>Portfolio</Label>
                <Select value={portfolioId ?? ''} onValueChange={setPortfolioId}>
                  <SelectTrigger>
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
              </div>
              <div className="space-y-1.5">
                <Label>Horizon</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={horizonUnit === 'weeks' ? 520 : horizonUnit === 'months' ? 120 : 50}
                    value={horizonValue}
                    onChange={(e) => setHorizonValue(+e.target.value)}
                    className="flex-1"
                  />
                  <Select
                    value={horizonUnit}
                    onValueChange={(v) => setHorizonUnit(v as HorizonUnit)}
                  >
                    <SelectTrigger className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weeks">Weeks</SelectItem>
                      <SelectItem value="months">Months</SelectItem>
                      <SelectItem value="years">Years</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Label>Annual contribution ($)</Label>
                  <InfoHint ariaLabel="What is annual contribution?">
                    How much you plan to add to the portfolio each year. Leave at{' '}
                    <span className="font-mono">0</span> to simulate your current balance
                    only.
                  </InfoHint>
                </div>
                <Input
                  type="number"
                  min={0}
                  value={contribution}
                  onChange={(e) => setContribution(+e.target.value)}
                />
              </div>
              <Button
                leftIcon={<PlayCircle className="size-4" />}
                loading={mcLoading}
                disabled={!portfolioId}
                onClick={runMonteCarlo}
                className="self-end"
              >
                Run simulation
              </Button>
            </div>

            {mcLoading ? (
              <Skeleton className="h-72 w-full rounded-xl" />
            ) : mc ? (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-6 text-sm">
                  <Stat label="Median final value" value={formatCurrency(mc.medianFinalValue)} />
                  <Stat
                    label="Probability above starting value"
                    value={formatPercent(mc.probabilityAboveInitial)}
                  />
                  <Stat label="Horizon" value={describeHorizon(mc.horizonDays)} />
                </div>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={mcChart}
                      margin={{ top: 8, right: 16, left: 16, bottom: 28 }}
                    >
                      <CartesianGrid
                        stroke="var(--color-border)"
                        strokeDasharray="3 3"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="day"
                        type="number"
                        domain={[0, mc.horizonDays]}
                        stroke="var(--color-fg-subtle)"
                        tick={{ fontSize: 11 }}
                        ticks={mcAxis.ticks}
                        tickFormatter={mcAxis.format}
                        label={{
                          value: 'Time horizon',
                          position: 'insideBottom',
                          offset: -12,
                          style: {
                            fill: 'var(--color-fg-muted)',
                            fontSize: 11,
                            textAnchor: 'middle',
                          },
                        }}
                      />
                      <YAxis
                        stroke="var(--color-fg-subtle)"
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                        label={{
                          value: 'Projected portfolio value',
                          angle: -90,
                          position: 'insideLeft',
                          offset: 0,
                          style: {
                            fill: 'var(--color-fg-muted)',
                            fontSize: 11,
                            textAnchor: 'middle',
                          },
                        }}
                      />
                      <Tooltip
                        contentStyle={{
                          background: 'var(--color-bg-elevated)',
                          border: '1px solid var(--color-border)',
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                        formatter={(v: number) => formatCurrency(v)}
                        labelFormatter={(day: number) =>
                          day === 0 ? 'Today' : mcAxis.labelDetail(day)
                        }
                      />
                      <Line
                        type="monotone"
                        dataKey="p90"
                        stroke="#34d399"
                        strokeWidth={2}
                        dot={false}
                        name="90th pct"
                      />
                      <Line
                        type="monotone"
                        dataKey="p50"
                        stroke="#10b981"
                        strokeWidth={2.5}
                        dot={false}
                        name="Median"
                      />
                      <Line
                        type="monotone"
                        dataKey="p10"
                        stroke="#fbbf24"
                        strokeWidth={2}
                        dot={false}
                        name="10th pct"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <EmptyState
                icon={<PlayCircle className="size-5" />}
                title="Run a simulation"
                description="Select a portfolio and horizon above."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Efficient frontier</CardTitle>
            <CardDescription>
              Modern Portfolio Theory — plots the best-possible return at every risk level for a
              set of candidate tickers, fitted on the lookback window you choose.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.6fr_1fr_auto]">
              <div className="space-y-1.5">
                <Label>Candidate tickers (comma-separated)</Label>
                <Input value={symbols} onChange={(e) => setSymbols(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Lookback period</Label>
                <Select
                  value={String(lookbackYears)}
                  onValueChange={(v) => setLookbackYears(+v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Last 1 year</SelectItem>
                    <SelectItem value="2">Last 2 years</SelectItem>
                    <SelectItem value="3">Last 3 years</SelectItem>
                    <SelectItem value="5">Last 5 years</SelectItem>
                    <SelectItem value="10">Last 10 years</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button loading={frontierLoading} onClick={runFrontier} className="self-end">
                Compute
              </Button>
            </div>
            {frontierLoading ? (
              <Skeleton className="h-72 w-full rounded-xl" />
            ) : frontier ? (
              <div className="space-y-2">
                <p className="text-xs text-[var(--color-fg-subtle)]">
                  Fitted on the last <strong>{lookbackYears}</strong>{' '}
                  {lookbackYears === 1 ? 'year' : 'years'} of prices. Green dots ={' '}
                  frontier points, gold star = max-Sharpe portfolio, mint triangle = min-volatility
                  portfolio.
                </p>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 8, right: 24, left: 16, bottom: 28 }}>
                      <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                      <XAxis
                        type="number"
                        dataKey="volatility"
                        stroke="var(--color-fg-subtle)"
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
                        name="Volatility"
                        label={{
                          value: 'Annualized volatility (risk)',
                          position: 'insideBottom',
                          offset: -12,
                          style: {
                            fill: 'var(--color-fg-muted)',
                            fontSize: 11,
                            textAnchor: 'middle',
                          },
                        }}
                      />
                      <YAxis
                        type="number"
                        dataKey="expectedReturn"
                        stroke="var(--color-fg-subtle)"
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
                        name="Return"
                        label={{
                          value: 'Expected annualized return',
                          angle: -90,
                          position: 'insideLeft',
                          offset: 0,
                          style: {
                            fill: 'var(--color-fg-muted)',
                            fontSize: 11,
                            textAnchor: 'middle',
                          },
                        }}
                      />
                      <Tooltip
                        cursor={{
                          stroke: 'var(--color-brand-400)',
                          strokeWidth: 1,
                          strokeDasharray: '3 3',
                        }}
                        wrapperStyle={{ outline: 'none', zIndex: 10 }}
                        contentStyle={{
                          background: 'var(--color-bg-elevated)',
                          border: '1px solid var(--color-border-strong)',
                          borderRadius: 8,
                          padding: '10px 14px',
                          fontSize: 12,
                          color: 'var(--color-fg)',
                          boxShadow: '0 8px 24px -8px rgba(0,0,0,0.5)',
                        }}
                        labelStyle={{
                          color: 'var(--color-fg-muted)',
                          fontWeight: 500,
                          marginBottom: 6,
                        }}
                        itemStyle={{ color: 'var(--color-fg)', fontWeight: 500 }}
                        formatter={(v: number, name: string) => [
                          `${(v * 100).toFixed(2)}%`,
                          name === 'volatility'
                            ? 'Volatility'
                            : name === 'expectedReturn'
                              ? 'Expected return'
                              : name === 'sharpe'
                                ? 'Sharpe'
                                : name,
                        ]}
                      />
                      {/* Palette matches the Monte Carlo chart: mint (best-upside-ish),
                          emerald (middle), amber (highlight). */}
                      <Scatter name="Frontier" data={frontier.frontier} fill="#10b981" />
                      <Scatter
                        name="Max Sharpe"
                        data={[frontier.maxSharpe]}
                        fill="#fbbf24"
                        shape="star"
                      />
                      <Scatter
                        name="Min Vol"
                        data={[frontier.minVolatility]}
                        fill="#34d399"
                        shape="triangle"
                      />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <EmptyState
                icon={<PlayCircle className="size-5" />}
                title="Compute the frontier"
                description="Enter at least two tickers and click Compute."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.08em] text-[var(--color-fg-subtle)]">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

/* ------------------------------------------------------------------
 * Adaptive MC x-axis — weeks / months / years depending on horizon
 * ------------------------------------------------------------------ */
interface McAxis {
  ticks: number[];
  format: (day: number) => string;
  labelDetail: (day: number) => string;
}

function mcAxisFor(horizonDays: number): McAxis {
  const totalYears = horizonDays / TRADING_DAYS_PER_YEAR;
  // <1 year → show weeks (5 trading days per week)
  if (totalYears < 1) {
    const DAYS_PER_WEEK = 5;
    const step = horizonDays <= 20 ? DAYS_PER_WEEK : Math.max(DAYS_PER_WEEK, Math.floor(horizonDays / 6 / DAYS_PER_WEEK) * DAYS_PER_WEEK);
    return {
      ticks: niceTicks(horizonDays, step),
      format: (d) => (d === 0 ? 'Now' : `W${Math.round(d / DAYS_PER_WEEK)}`),
      labelDetail: (d) => `${Math.round(d / DAYS_PER_WEEK)} week${d / DAYS_PER_WEEK > 1 ? 's' : ''} from now`,
    };
  }
  // 1–3 years → show months (21 trading days per month)
  if (totalYears < 3) {
    const DAYS_PER_MONTH = 21;
    const step = totalYears < 1.5 ? DAYS_PER_MONTH * 3 : DAYS_PER_MONTH * 6;
    return {
      ticks: niceTicks(horizonDays, step),
      format: (d) => (d === 0 ? 'Now' : `${Math.round(d / DAYS_PER_MONTH)}m`),
      labelDetail: (d) => `${Math.round(d / DAYS_PER_MONTH)} months from now`,
    };
  }
  // ≥3 years → show years
  const step = TRADING_DAYS_PER_YEAR * (totalYears <= 10 ? 1 : totalYears <= 25 ? 5 : 10);
  return {
    ticks: niceTicks(horizonDays, step),
    format: (d) => (d === 0 ? 'Now' : `Year ${Math.round(d / TRADING_DAYS_PER_YEAR)}`),
    labelDetail: (d) => `Year ${(d / TRADING_DAYS_PER_YEAR).toFixed(1)} from now`,
  };
}

function niceTicks(horizonDays: number, step: number): number[] {
  const result: number[] = [0];
  let t = step;
  while (t < horizonDays) {
    result.push(t);
    t += step;
  }
  return result;
}

/**
 * Returns "6 weeks" / "18 months" / "15 years" depending on horizon magnitude.
 */
function describeHorizon(horizonDays: number): string {
  const totalYears = horizonDays / TRADING_DAYS_PER_YEAR;
  if (totalYears < 1) {
    const weeks = Math.round(horizonDays / 5);
    return `${weeks} week${weeks === 1 ? '' : 's'}`;
  }
  if (totalYears < 3) {
    const months = Math.round(horizonDays / 21);
    return `${months} month${months === 1 ? '' : 's'}`;
  }
  return `${totalYears.toFixed(totalYears >= 10 ? 0 : 1)} years`;
}
