import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Holding, HoldingInput } from '@bullfin/shared';
import { apiFetch } from '@/lib/api';
import { portfolioKeys } from './usePortfolios';

export function useAddHolding(portfolioId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: HoldingInput) =>
      apiFetch<Holding>(`/portfolios/${portfolioId}/holdings`, { method: 'POST', body }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: portfolioKeys.detail(portfolioId) });
      void qc.invalidateQueries({ queryKey: portfolioKeys.metrics(portfolioId) });
    },
  });
}

export function useBulkAddHoldings(portfolioId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (holdings: HoldingInput[]) =>
      apiFetch<Holding[]>(`/portfolios/${portfolioId}/holdings/bulk`, {
        method: 'POST',
        body: { holdings },
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: portfolioKeys.detail(portfolioId) });
      void qc.invalidateQueries({ queryKey: portfolioKeys.metrics(portfolioId) });
    },
  });
}

export function useUploadHoldings(portfolioId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      return apiFetch<Holding[]>(`/portfolios/${portfolioId}/holdings/upload`, {
        method: 'POST',
        formData: fd,
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: portfolioKeys.detail(portfolioId) });
      void qc.invalidateQueries({ queryKey: portfolioKeys.metrics(portfolioId) });
    },
  });
}

export function useDeleteHolding(portfolioId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (holdingId: string) =>
      apiFetch<void>(`/holdings/${holdingId}`, { method: 'DELETE' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: portfolioKeys.detail(portfolioId) });
      void qc.invalidateQueries({ queryKey: portfolioKeys.metrics(portfolioId) });
    },
  });
}
