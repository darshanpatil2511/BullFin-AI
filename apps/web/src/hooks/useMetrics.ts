import { useQuery } from '@tanstack/react-query';
import type { MetricsResponse } from '@bullfin/shared';
import { apiFetch } from '@/lib/api';
import { portfolioKeys } from './usePortfolios';

export function usePortfolioMetrics(
  portfolioId: string | undefined,
  opts?: { benchmark?: string; riskFreeRate?: number },
) {
  return useQuery({
    // Include benchmark in the key so changing the default benchmark
    // in Settings re-fetches immediately instead of using cached beta.
    queryKey: portfolioId
      ? [...portfolioKeys.metrics(portfolioId), opts?.benchmark ?? 'SPY']
      : ['metrics', 'unknown'],
    enabled: Boolean(portfolioId),
    // Metrics are expensive upstream — give them time and cache for 5 min.
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
    queryFn: () =>
      apiFetch<MetricsResponse>('/metrics', {
        method: 'POST',
        body: {
          portfolioId,
          benchmark: opts?.benchmark,
          riskFreeRate: opts?.riskFreeRate,
        },
      }),
  });
}
