import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BarChart3, FileText, Download, LayoutList, PieChart, Sparkles, Trash2, FilePlus } from 'lucide-react';
import { toast } from 'sonner';
import { TopBar } from '@/components/layout/TopBar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { apiFetch } from '@/lib/api';
import { usePortfolios } from '@/hooks/usePortfolios';
import { useSelectedPortfolio } from '@/contexts/SelectedPortfolioContext';
import { usePortfolioMetrics } from '@/hooks/useMetrics';
import { usePreferences } from '@/hooks/usePreferences';
import { exportReportToPdf, type ReportSections } from '@/lib/pdfGenerator';
import { PerformanceChart } from '@/components/charts/PerformanceChart';
import { formatDate } from '@/lib/utils';

interface ReportRow {
  id: string;
  portfolio_id: string;
  title: string;
  created_at: string;
}

export default function ReportsPage() {
  const [params, setParams] = useSearchParams();
  const preselected = params.get('portfolio') ?? undefined;
  const { selectedId, setSelectedId } = useSelectedPortfolio();
  // URL param wins on first load (deep-links from the portfolio detail page),
  // otherwise the globally-remembered selection does. Either way, any change
  // the user makes on this page propagates both ways so navigation stays in
  // sync.
  const portfolioId = preselected ?? selectedId;
  const setPortfolioId = (id: string) => {
    setSelectedId(id);
    params.set('portfolio', id);
    setParams(params, { replace: true });
  };
  const [generating, setGenerating] = useState(false);
  const performanceRef = useRef<HTMLDivElement>(null);

  // Which sections the user wants in the next PDF. Defaults to everything on.
  const [sections, setSections] = useState<Required<ReportSections>>({
    performance: true,
    holdings: true,
    sectors: true,
    summary: true,
  });

  // Keep the URL in sync when we fell back to the context-remembered value.
  useEffect(() => {
    if (!preselected && selectedId) {
      params.set('portfolio', selectedId);
      setParams(params, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const qc = useQueryClient();
  const portfolios = usePortfolios();
  const { preferences } = usePreferences();
  const metrics = usePortfolioMetrics(portfolioId, {
    benchmark: preferences.defaultBenchmark,
  });
  const reports = useQuery({
    queryKey: ['reports'],
    queryFn: () => apiFetch<ReportRow[]>('/reports'),
  });

  const activePortfolio = useMemo(
    () => portfolios.data?.find((p) => p.id === portfolioId),
    [portfolios.data, portfolioId],
  );

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

  async function handleGenerate() {
    if (!portfolioId || !activePortfolio || !metrics.data) return;
    setGenerating(true);
    try {
      // 1. Only fetch the AI-written executive summary if that section is
      //    actually going to appear in the PDF. Saves a Gemini round-trip
      //    (and token cost) for shorter reports.
      let summary = '';
      if (sections.summary) {
        toast.info('Writing executive summary…');
        const result = await apiFetch<{ summary: string }>('/reports/summary', {
          method: 'POST',
          body: {
            portfolioName: activePortfolio.name,
            totalValue: metrics.data.portfolio.totalValue,
            totalReturnPct: metrics.data.portfolio.totalReturn,
            cagr: metrics.data.portfolio.cagr,
            volatility: metrics.data.portfolio.volatility,
            sharpe: metrics.data.portfolio.sharpe,
            beta: metrics.data.portfolio.beta,
            maxDrawdown: metrics.data.portfolio.maxDrawdown,
            riskScore: metrics.data.riskScore,
            riskLabel: metrics.data.riskLabel,
            topHoldings: metrics.data.holdings
              .slice()
              .sort((a, b) => b.weight - a.weight)
              .slice(0, 10)
              .map((h) => ({
                symbol: h.symbol,
                weight: h.weight,
                sector: h.sector,
              })),
            sectorExposure: metrics.data.sectorExposure.map((s) => ({
              sector: s.sector,
              weight: s.weight,
            })),
          },
        }).catch((err) => {
          // A failed summary shouldn't kill the report; fall back to a static blurb.
          // eslint-disable-next-line no-console
          console.warn('Summary endpoint failed, falling back', err);
          return {
            summary: [
              '## Overview',
              'The AI summary is not available at the moment. This report was generated with computed metrics only.',
              '',
              '## Key observations',
              '- See the KPI grid on page 1 for headline numbers.',
              '- See the holdings table for your position by position breakdown.',
              '- Sector exposure highlights concentration risk.',
            ].join('\n'),
          };
        });
        summary = result.summary;
      }

      // 2. Build the PDF.
      const blob = await exportReportToPdf({
        portfolioName: activePortfolio.name,
        generatedAt: new Date(),
        metrics: metrics.data,
        performanceNode: sections.performance ? performanceRef.current : null,
        summary,
        sections,
      });

      // 3. Upload to Supabase via the gateway.
      const fd = new FormData();
      fd.append('file', blob, `${activePortfolio.name}-report.pdf`);
      fd.append('portfolioId', portfolioId);
      fd.append('title', `${activePortfolio.name} — ${new Date().toLocaleDateString()}`);
      await apiFetch('/reports', { method: 'POST', formData: fd });
      toast.success('Report saved to your library');
      void qc.invalidateQueries({ queryKey: ['reports'] });
    } catch (err) {
      toast.error('Could not generate PDF', {
        description: err instanceof Error ? err.message : 'Try again in a moment.',
      });
    } finally {
      setGenerating(false);
    }
  }

  async function handleDownload(id: string) {
    try {
      const { url } = await apiFetch<{ url: string }>(`/reports/${id}/download`);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      toast.error('Could not open report', {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this report?')) return;
    await apiFetch(`/reports/${id}`, { method: 'DELETE' });
    toast.success('Report deleted');
    void qc.invalidateQueries({ queryKey: ['reports'] });
  }

  return (
    <>
      <TopBar
        title="Reports"
        actions={
          <>
            <Select value={portfolioId ?? ''} onValueChange={(v) => setPortfolioId(v)}>
              <SelectTrigger className="h-9 w-56 text-sm">
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
            <Button
              leftIcon={<FilePlus className="size-4" />}
              loading={generating}
              disabled={!portfolioId || !metrics.data}
              onClick={handleGenerate}
            >
              Generate PDF
            </Button>
          </>
        }
      />
      <div className="flex-1 overflow-y-auto space-y-6 p-6">
        <SectionsCard sections={sections} onChange={setSections} />

        <Card>
          <CardHeader>
            <CardTitle>Your reports</CardTitle>
            <CardDescription>
              Every PDF is a fully-typed, text-based document with an AI-written executive
              summary. Stored privately in your account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {reports.isLoading ? (
              <Skeleton className="h-24 w-full rounded-xl" />
            ) : !reports.data || reports.data.length === 0 ? (
              portfolios.data && portfolios.data.length > 0 ? (
                <EmptyState
                  icon={<FileText className="size-5" />}
                  title="No reports yet"
                  description={
                    'Pick a portfolio from the dropdown in the top bar, then click "Generate PDF" to create your first report.'
                  }
                />
              ) : (
                <EmptyState
                  icon={<FileText className="size-5" />}
                  title="No portfolios to report on"
                  description="You need at least one portfolio with holdings before generating a report."
                  action={
                    <Button asChild variant="secondary">
                      <Link to="/app/portfolios">Create a portfolio</Link>
                    </Button>
                  }
                />
              )
            ) : (
              <ul className="divide-hair overflow-hidden rounded-xl border border-[var(--color-border)]">
                {reports.data.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between gap-3 bg-[var(--color-bg-elevated)] px-4 py-3 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{r.title}</p>
                      <p className="text-xs text-[var(--color-fg-subtle)]">
                        Created {formatDate(r.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="secondary" size="sm" onClick={() => handleDownload(r.id)}>
                        <Download className="size-4" />
                        Open
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(r.id)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Offscreen render target — ONLY the performance chart gets rasterized
            into the PDF. Everything else is typed text via jsPDF. Rendered with
            a light-ish background so the captured image reads well on paper. */}
        <div
          className="pointer-events-none absolute -left-[9999px] top-0 w-[760px] rounded-lg bg-[var(--color-bg-elevated)] p-6"
          aria-hidden
        >
          <div ref={performanceRef}>
            {metrics.data ? (
              <PerformanceChart
                data={chartSeries}
                benchmark={metrics.data.benchmark?.symbol ?? 'SPY'}
              />
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}

/* ──────────────────────────────────────────────── Section picker */
interface SectionOption {
  key: keyof ReportSections;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const SECTION_OPTIONS: SectionOption[] = [
  {
    key: 'performance',
    label: 'Performance chart',
    description: 'Cumulative return vs. your default benchmark.',
    icon: BarChart3,
  },
  {
    key: 'holdings',
    label: 'Holdings table',
    description: 'Position-by-position breakdown with weights and sectors.',
    icon: LayoutList,
  },
  {
    key: 'sectors',
    label: 'Sector exposure & risk',
    description: 'Concentration breakdown and risk score panel.',
    icon: PieChart,
  },
  {
    key: 'summary',
    label: 'AI executive summary',
    description: 'One extra round-trip to the advisor to write a plain-English summary.',
    icon: Sparkles,
  },
];

function SectionsCard({
  sections,
  onChange,
}: {
  sections: Required<ReportSections>;
  onChange: (next: Required<ReportSections>) => void;
}) {
  const enabledCount = Object.values(sections).filter(Boolean).length;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Report sections</CardTitle>
        <CardDescription>
          The cover + KPI grid is always included. Toggle the rest below — unchecked sections
          are skipped entirely, which makes the PDF shorter and the generation faster.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {SECTION_OPTIONS.map((opt) => {
            const checked = sections[opt.key] ?? true;
            return (
              <label
                key={opt.key}
                className={
                  'flex cursor-pointer gap-3 rounded-xl border p-3 transition-colors ' +
                  (checked
                    ? 'border-[var(--color-brand-500)]/50 bg-[var(--color-brand-500)]/[0.04]'
                    : 'border-[var(--color-border)] bg-[var(--color-bg-muted)]/30 hover:border-[var(--color-border-strong)]')
                }
              >
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 shrink-0 accent-[var(--color-brand-500)]"
                  checked={checked}
                  onChange={(e) => onChange({ ...sections, [opt.key]: e.target.checked })}
                />
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    <opt.icon className="size-3.5 text-[var(--color-brand-400)]" />
                    {opt.label}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--color-fg-subtle)]">{opt.description}</p>
                </div>
              </label>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-[var(--color-fg-subtle)]">
          {enabledCount === 0
            ? 'Every optional section is off — you will get a cover-only PDF.'
            : `${enabledCount} of ${SECTION_OPTIONS.length} optional sections will be included.`}
        </p>
      </CardContent>
    </Card>
  );
}
