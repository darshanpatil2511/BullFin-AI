/**
 * Shared metric types returned by the ML engine and consumed by the web client.
 * Keep field names in sync with apps/ml/app/models.
 */

import type { HoldingInput } from './types/index.js';

export type ReturnPeriod = '1W' | '1M' | '3M' | '6M' | '1Y' | '3Y' | '5Y' | 'ALL';

export interface PortfolioMetrics {
  // Core risk/return
  cagr: number; // compound annual growth rate (decimal, e.g. 0.12 = 12%)
  volatility: number; // annualized std dev of returns (decimal)
  sharpe: number; // risk-adjusted return
  sortino: number; // downside-risk-adjusted return
  beta: number | null; // vs. benchmark (SPY)
  alpha: number | null; // Jensen's alpha
  maxDrawdown: number; // largest peak-to-trough drop (decimal, negative)
  valueAtRisk95: number; // 1-day 95% VaR (decimal, negative)
  diversificationIndex: number; // 1 - HHI; 0 = concentrated, 1 = diversified

  // Snapshot
  totalValue: number;
  totalCost: number;
  totalReturn: number; // decimal
  totalReturnAmount: number;
  asOfDate: string; // ISO date
}

export interface ShareMetric {
  symbol: string;
  shares: number;
  purchasePrice: number;
  currentPrice: number;
  currentValue: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  sector: string | null;
  weight: number; // fraction of portfolio
  returnsByPeriod: Partial<Record<ReturnPeriod, number>>;
}

export interface SectorExposure {
  sector: string;
  weight: number;
  value: number;
}

export interface BenchmarkComparison {
  symbol: string; // e.g. 'SPY'
  portfolioCumulative: Array<{ date: string; value: number }>;
  benchmarkCumulative: Array<{ date: string; value: number }>;
}

export interface MetricsResponse {
  portfolio: PortfolioMetrics;
  holdings: ShareMetric[];
  sectorExposure: SectorExposure[];
  benchmark: BenchmarkComparison | null;
  riskScore: number; // 0-100 plain-English risk indicator
  riskLabel: 'Conservative' | 'Moderate' | 'Balanced' | 'Aggressive' | 'Speculative';
}

export interface MetricsRequest {
  holdings: HoldingInput[];
  benchmark?: string; // default 'SPY'
  riskFreeRate?: number; // annualized decimal; default pulled from 10Y Treasury
}
