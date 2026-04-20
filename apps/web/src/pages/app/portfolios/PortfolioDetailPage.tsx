import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, FileText, LineChart, MessageSquare, Plus, Upload } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { usePortfolioDetail } from '@/hooks/usePortfolios';
import { useSelectedPortfolio } from '@/contexts/SelectedPortfolioContext';
import { usePortfolioMetrics } from '@/hooks/useMetrics';
import { usePreferences } from '@/hooks/usePreferences';
import { formatCurrency, formatNumber, formatPercent } from '@/lib/utils';
import { CsvDropzone } from './CsvDropzone';
import { ManualEntryForm } from './ManualEntryForm';
import { HoldingsTable } from './HoldingsTable';

type DetailTab = 'holdings' | 'import' | 'add';

export default function PortfolioDetailPage() {
  const { id } = useParams<{ id: string }>();
  const detail = usePortfolioDetail(id);
  const { preferences } = usePreferences();
  const metrics = usePortfolioMetrics(id, { benchmark: preferences.defaultBenchmark });
  const { setSelectedId } = useSelectedPortfolio();
  const [activeTab, setActiveTab] = useState<DetailTab>('holdings');

  // Viewing a portfolio's detail page makes it the "current" one — jumping
  // to Analyze / Forecast / Reports / Advisor from here should keep it.
  useEffect(() => {
    if (id) setSelectedId(id);
  }, [id, setSelectedId]);

  const holdings = detail.data?.holdings ?? [];

  return (
    <>
      <TopBar
        title={detail.data?.portfolio.name ?? 'Portfolio'}
        actions={
          <>
            <Button asChild variant="secondary" leftIcon={<ArrowLeft className="size-4" />}>
              <Link to="/app/portfolios">All portfolios</Link>
            </Button>
            <Button asChild leftIcon={<MessageSquare className="size-4" />}>
              <Link to={`/app/advisor?portfolio=${id}`}>Ask AI advisor</Link>
            </Button>
          </>
        }
      />
      <div className="flex-1 overflow-y-auto space-y-6 p-6">
        {detail.isLoading ? (
          <Skeleton className="h-24 w-full rounded-2xl" />
        ) : detail.error || !detail.data ? (
          <EmptyState
            icon={<LineChart className="size-5" />}
            title="Portfolio not found"
            description="It may have been deleted or belong to another account."
            action={
              <Button asChild>
                <Link to="/app/portfolios">Back to portfolios</Link>
              </Button>
            }
          />
        ) : (
          <>
            <SummaryStrip
              isLoading={metrics.isLoading}
              value={metrics.data?.portfolio.totalValue}
              cost={metrics.data?.portfolio.totalCost}
              ret={metrics.data?.portfolio.totalReturn}
              sharpe={metrics.data?.portfolio.sharpe}
              holdings={holdings.length}
            />

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as DetailTab)}>
              <TabsList>
                <TabsTrigger value="holdings">Holdings</TabsTrigger>
                <TabsTrigger value="import">Import CSV</TabsTrigger>
                <TabsTrigger value="add">Add manually</TabsTrigger>
              </TabsList>

              <TabsContent value="holdings">
                {holdings.length === 0 ? (
                  <EmptyState
                    icon={<Plus className="size-5" />}
                    title="No holdings yet"
                    description="Upload a CSV or add them manually to see your metrics light up."
                    action={
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        <Button
                          leftIcon={<Upload className="size-4" />}
                          onClick={() => setActiveTab('import')}
                        >
                          Import CSV
                        </Button>
                        <Button
                          variant="secondary"
                          leftIcon={<Plus className="size-4" />}
                          onClick={() => setActiveTab('add')}
                        >
                          Add manually
                        </Button>
                      </div>
                    }
                  />
                ) : (
                  <HoldingsTable portfolioId={id!} holdings={holdings} />
                )}
              </TabsContent>

              <TabsContent value="import">
                <Card>
                  <CardHeader>
                    <CardTitle>Import from CSV</CardTitle>
                    <CardDescription>
                      Max 500 rows, up to 5 MB. Column order doesn't matter — we match on name.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <CsvDropzone portfolioId={id!} />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="add">
                <Card>
                  <CardHeader>
                    <CardTitle>Add holdings</CardTitle>
                    <CardDescription>
                      One row per lot. You can add multiple rows in a single save.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ManualEntryForm portfolioId={id!} />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle>What's next?</CardTitle>
                  <CardDescription>Turn this portfolio into a report or ask questions.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button asChild variant="secondary" className="w-full justify-start" leftIcon={<FileText className="size-4" />}>
                    <Link to={`/app/reports?portfolio=${id}`}>Generate PDF report</Link>
                  </Button>
                  <Button asChild variant="secondary" className="w-full justify-start" leftIcon={<MessageSquare className="size-4" />}>
                    <Link to={`/app/advisor?portfolio=${id}`}>Ask the AI advisor</Link>
                  </Button>
                </CardContent>
              </Card>
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Key numbers</CardTitle>
                  <CardDescription>
                    Most-important metrics for a glance. Full analysis on the dashboard.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {metrics.isLoading ? (
                    <Skeleton className="h-24 w-full" />
                  ) : metrics.data ? (
                    <dl className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
                      <Stat label="CAGR" value={formatPercent(metrics.data.portfolio.cagr)} />
                      <Stat label="Volatility" value={formatPercent(metrics.data.portfolio.volatility)} />
                      <Stat label="Sharpe" value={formatNumber(metrics.data.portfolio.sharpe)} />
                      <Stat
                        label="Beta"
                        value={
                          metrics.data.portfolio.beta !== null
                            ? formatNumber(metrics.data.portfolio.beta)
                            : 'n/a'
                        }
                      />
                    </dl>
                  ) : (
                    <p className="text-sm text-[var(--color-fg-muted)]">
                      Add at least one holding to see metrics.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function SummaryStrip({
  isLoading,
  value,
  cost,
  ret,
  sharpe,
  holdings,
}: {
  isLoading: boolean;
  value?: number;
  cost?: number;
  ret?: number;
  sharpe?: number;
  holdings: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-4 md:grid-cols-5">
      <Summary label="Holdings" value={String(holdings)} />
      <Summary
        label="Value"
        value={isLoading ? '—' : value !== undefined ? formatCurrency(value) : 'n/a'}
      />
      <Summary
        label="Cost"
        value={isLoading ? '—' : cost !== undefined ? formatCurrency(cost) : 'n/a'}
      />
      <Summary
        label="Return"
        value={isLoading ? '—' : ret !== undefined ? formatPercent(ret) : 'n/a'}
        tone={ret !== undefined ? (ret >= 0 ? 'positive' : 'negative') : undefined}
      />
      <Summary
        label="Sharpe"
        value={isLoading ? '—' : sharpe !== undefined ? formatNumber(sharpe) : 'n/a'}
      />
    </div>
  );
}

function Summary({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'positive' | 'negative';
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)]">{label}</p>
      <p
        className={`mt-0.5 text-base font-semibold tabular-nums ${
          tone === 'positive' ? 'text-[var(--color-brand-300)]' : ''
        } ${tone === 'negative' ? 'text-[color:#fca5a5]' : ''}`}
      >
        {value}
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-[0.08em] text-[var(--color-fg-subtle)]">{label}</dt>
      <dd className="mt-1 text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
