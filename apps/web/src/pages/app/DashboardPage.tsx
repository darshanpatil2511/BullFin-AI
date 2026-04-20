import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, LineChart, Plus, Sparkles } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { KpiCard } from '@/components/charts/KpiCard';
import { AllocationDonut } from '@/components/charts/AllocationDonut';
import { PerformanceChart } from '@/components/charts/PerformanceChart';
import { SectorBar } from '@/components/charts/SectorBar';
import { RiskScoreGauge } from '@/components/charts/RiskScoreGauge';
import { usePortfolios } from '@/hooks/usePortfolios';
import { useSelectedPortfolio } from '@/contexts/SelectedPortfolioContext';
import { usePortfolioMetrics } from '@/hooks/useMetrics';
import { useFormatters } from '@/hooks/useFormatters';
import { usePreferences } from '@/hooks/usePreferences';
import { formatNumber, formatPercent } from '@/lib/utils';

export default function DashboardPage() {
  const { selectedId, setSelectedId } = useSelectedPortfolio();
  const portfolios = usePortfolios();

  // Fall back to the first portfolio when nothing is selected yet — but the
  // moment the user picks one, the context + localStorage remember it and
  // every other feature page (Analyze / Forecast / Reports / Advisor)
  // reads the same value.
  const effectiveId = selectedId ?? portfolios.data?.[0]?.id;
  const { preferences } = usePreferences();
  const metrics = usePortfolioMetrics(effectiveId, { benchmark: preferences.defaultBenchmark });

  const chartSeries = useMemo(() => {
    if (!metrics.data?.benchmark) return [];
    const { portfolioCumulative, benchmarkCumulative } = metrics.data.benchmark;
    const bMap = new Map(benchmarkCumulative.map((p) => [p.date, p.value]));
    return portfolioCumulative.map((p) => ({
      date: p.date as string,
      portfolio: p.value as number,
      benchmark: (bMap.get(p.date) as number | undefined) ?? 1,
    }));
  }, [metrics.data]);

  const sectorData = useMemo(
    () =>
      (metrics.data?.sectorExposure ?? [])
        .filter((s) => s.value > 0)
        .slice(0, 8)
        .map((s) => ({ sector: s.sector, value: s.value, weight: s.weight })),
    [metrics.data],
  );

  const allocationSlices = useMemo(
    () =>
      (metrics.data?.holdings ?? []).map((h) => ({ label: h.symbol, value: h.currentValue })),
    [metrics.data],
  );

  return (
    <>
      <TopBar
        title="Dashboard"
        actions={
          <>
            {portfolios.data && portfolios.data.length > 0 ? (
              <Select
                value={effectiveId}
                onValueChange={(v) => setSelectedId(v)}
              >
                <SelectTrigger className="h-9 w-56 text-sm">
                  <SelectValue placeholder="Select portfolio" />
                </SelectTrigger>
                <SelectContent>
                  {portfolios.data.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            <Button asChild leftIcon={<Plus className="size-4" />}>
              <Link to="/app/portfolios">New portfolio</Link>
            </Button>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto space-y-6 p-6">
        {portfolios.isLoading ? (
          <LoadingSkeleton />
        ) : !portfolios.data || portfolios.data.length === 0 ? (
          <EmptyState
            icon={<LineChart className="size-5" />}
            title="No portfolios yet"
            description="Create a portfolio and add holdings to see metrics, allocation, and AI insights."
            action={
              <Button asChild leftIcon={<Plus className="size-4" />}>
                <Link to="/app/portfolios">Create portfolio</Link>
              </Button>
            }
          />
        ) : metrics.isLoading ? (
          <LoadingSkeleton />
        ) : metrics.error ? (
          <EmptyState
            icon={<Sparkles className="size-5" />}
            title="Could not compute metrics"
            description={
              metrics.error instanceof Error
                ? metrics.error.message
                : 'The ML engine is unreachable.'
            }
            action={
              <Button variant="secondary" onClick={() => metrics.refetch()}>
                Try again
              </Button>
            }
          />
        ) : metrics.data ? (
          <Dashboard metrics={metrics.data} benchmarkSymbol={metrics.data.benchmark?.symbol ?? 'SPY'}>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Performance vs. {metrics.data.benchmark?.symbol ?? 'SPY'}</CardTitle>
                  <CardDescription>
                    Cumulative growth of $1 invested across the held period.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {chartSeries.length > 0 ? (
                    <PerformanceChart
                      data={chartSeries}
                      benchmark={metrics.data.benchmark?.symbol ?? 'SPY'}
                    />
                  ) : (
                    <Skeleton className="h-80 w-full" />
                  )}
                </CardContent>
              </Card>
              <Card className="flex flex-col">
                <CardHeader>
                  <CardTitle>Allocation</CardTitle>
                  <CardDescription>Current market-value breakdown.</CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  {allocationSlices.length > 0 ? (
                    <AllocationDonut data={allocationSlices} />
                  ) : (
                    <Skeleton className="h-64 w-full" />
                  )}
                </CardContent>
              </Card>
            </div>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Sector exposure</CardTitle>
                  <CardDescription>Concentration by GICS-style sector.</CardDescription>
                </CardHeader>
                <CardContent>
                  {sectorData.length > 0 ? (
                    <SectorBar data={sectorData} />
                  ) : (
                    <Skeleton className="h-72 w-full" />
                  )}
                </CardContent>
              </Card>
              <AdvisorTeaser portfolioId={effectiveId!} />
            </div>
          </Dashboard>
        ) : null}
      </div>
    </>
  );
}

function Dashboard({
  metrics,
  children,
}: {
  metrics: NonNullable<ReturnType<typeof usePortfolioMetrics>['data']>;
  benchmarkSymbol: string;
  children: React.ReactNode;
}) {
  const { portfolio, riskScore, riskLabel } = metrics;
  const { formatCurrency } = useFormatters();
  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total value"
          value={formatCurrency(portfolio.totalValue)}
          sublabel={`${formatCurrency(portfolio.totalReturnAmount)} unrealized`}
          delta={portfolio.totalReturn}
        />
        <KpiCard
          label="CAGR"
          value={formatPercent(portfolio.cagr)}
          sublabel="Annualized growth rate"
        />
        <KpiCard
          label="Sharpe ratio"
          value={formatNumber(portfolio.sharpe)}
          sublabel={`Sortino ${formatNumber(portfolio.sortino)}`}
        />
        <KpiCard
          label="Max drawdown"
          value={formatPercent(portfolio.maxDrawdown)}
          sublabel={`VaR (95%) ${formatPercent(portfolio.valueAtRisk95)}`}
          tone="negative"
        />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Risk profile</CardTitle>
            <CardDescription>Plain-English score derived from 5 signals.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center py-6">
            <RiskScoreGauge score={riskScore} label={riskLabel} />
          </CardContent>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Risk signals</CardTitle>
            <CardDescription>
              The underlying metrics that combine into the risk score.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
              <SignalStat label="Volatility" value={formatPercent(portfolio.volatility)} />
              <SignalStat
                label="Beta"
                value={portfolio.beta !== null ? formatNumber(portfolio.beta) : 'n/a'}
              />
              <SignalStat
                label="Alpha"
                value={portfolio.alpha !== null ? formatPercent(portfolio.alpha) : 'n/a'}
              />
              <SignalStat
                label="Diversification"
                value={formatNumber(portfolio.diversificationIndex)}
                hint="1 - HHI"
              />
            </dl>
          </CardContent>
        </Card>
      </div>
      {children}
    </>
  );
}

function SignalStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-[0.08em] text-[var(--color-fg-subtle)]">
        {label}
        {hint ? <span className="ml-1 text-[var(--color-fg-subtle)]">({hint})</span> : null}
      </dt>
      <dd className="mt-1 text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function AdvisorTeaser({ portfolioId }: { portfolioId: string }) {
  return (
    <Card className="relative overflow-hidden">
      <div className="absolute inset-0 bg-aurora" aria-hidden />
      <CardHeader className="relative">
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-elevated)]/80 px-2.5 py-1 text-xs font-medium backdrop-blur">
          <Sparkles className="size-3 text-[var(--color-brand-400)]" />
          BullFin Advisor
        </div>
        <CardTitle className="mt-3">Ask your portfolio anything.</CardTitle>
        <CardDescription>
          A Gemini-powered advisor that sees your live metrics and answers in plain English.
        </CardDescription>
      </CardHeader>
      <CardContent className="relative">
        <Button asChild rightIcon={<ArrowUpRight className="size-4" />}>
          <Link to={`/app/advisor?portfolio=${portfolioId}`}>Start a conversation</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Skeleton className="h-80 w-full rounded-2xl lg:col-span-2" />
        <Skeleton className="h-80 w-full rounded-2xl" />
      </div>
    </div>
  );
}
