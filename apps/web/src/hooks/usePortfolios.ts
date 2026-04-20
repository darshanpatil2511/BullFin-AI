import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Portfolio, Holding } from '@bullfin/shared';
import { apiFetch } from '@/lib/api';

export const portfolioKeys = {
  all: ['portfolios'] as const,
  detail: (id: string) => ['portfolios', id] as const,
  metrics: (id: string) => ['portfolios', id, 'metrics'] as const,
};

export function usePortfolios() {
  return useQuery({
    queryKey: portfolioKeys.all,
    queryFn: () => apiFetch<Portfolio[]>('/portfolios'),
  });
}

interface PortfolioDetail {
  portfolio: Portfolio;
  holdings: Holding[];
}
export function usePortfolioDetail(id: string | undefined) {
  return useQuery({
    queryKey: id ? portfolioKeys.detail(id) : ['portfolios', 'unknown'],
    enabled: Boolean(id),
    queryFn: () => apiFetch<PortfolioDetail>(`/portfolios/${id}`),
  });
}

export function useCreatePortfolio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; description?: string | null; baseCurrency?: string }) =>
      apiFetch<Portfolio>('/portfolios', { method: 'POST', body }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: portfolioKeys.all });
    },
  });
}

export function useUpdatePortfolio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      apiFetch<Portfolio>(`/portfolios/${id}`, { method: 'PATCH', body }),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: portfolioKeys.all });
      void qc.invalidateQueries({ queryKey: portfolioKeys.detail(vars.id) });
    },
  });
}

export function useDeletePortfolio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/portfolios/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: portfolioKeys.all });
    },
  });
}
