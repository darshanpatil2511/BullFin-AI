import { useMutation } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

export interface ForecastPricePoint {
  date: string;
  price: number;
}
export interface ForecastNewsItem {
  title: string;
  publisher: string | null;
  url: string;
  publishedAt: string | null;
}
export interface StockForecast {
  symbol: string;
  companyName: string | null;
  sector: string | null;
  currency: string | null;
  currentPrice: number;
  oneYearChangePct: number | null;
  cagr: number;
  volatility: number;
  sharpe: number;
  history: ForecastPricePoint[];
  forecastDates: string[];
  forecastP10: number[];
  forecastP50: number[];
  forecastP90: number[];
  projectedMedianPrice: number;
  projectedRangeLow: number;
  projectedRangeHigh: number;
  probabilityAboveCurrent: number;
  news: ForecastNewsItem[];
}
export interface ForecastResponse {
  asOf: string;
  horizonDays: number;
  lookbackYears: number;
  forecasts: StockForecast[];
}

export function useForecast() {
  return useMutation({
    mutationFn: (vars: { portfolioId: string; horizonDays: number; lookbackYears?: number }) =>
      apiFetch<ForecastResponse>('/analyze/forecast', {
        method: 'POST',
        body: {
          portfolioId: vars.portfolioId,
          horizonDays: vars.horizonDays,
          lookbackYears: vars.lookbackYears ?? 5,
        },
      }),
  });
}
