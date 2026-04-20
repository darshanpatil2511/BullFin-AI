import { request } from 'undici';
import type { HoldingInput, MetricsRequest, MetricsResponse } from '@bullfin/shared';
import { env } from '../config.js';
import { UpstreamError } from './errors.js';
import { logger } from '../logger.js';

const ML_TIMEOUT_MS = 30_000;

interface MlEngineCallOpts {
  holdings: HoldingInput[];
  benchmark?: string;
  riskFreeRate?: number;
  signal?: AbortSignal;
}

/**
 * Calls the FastAPI ML engine's /v1/metrics endpoint with the caller's
 * holdings and returns the typed response. Raises UpstreamError on any
 * failure so the error handler can surface a clean 502 to the browser.
 */
export async function callMetrics(opts: MlEngineCallOpts): Promise<MetricsResponse> {
  const body: MetricsRequest = {
    holdings: opts.holdings,
    benchmark: opts.benchmark,
    riskFreeRate: opts.riskFreeRate,
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ML_TIMEOUT_MS);
  const signal = opts.signal ?? controller.signal;

  try {
    const res = await request(`${env.ML_ENGINE_URL}/v1/metrics`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });

    if (res.statusCode >= 400) {
      const errText = await res.body.text();
      logger.error({ status: res.statusCode, body: errText }, 'ML engine returned error');
      throw new UpstreamError('The analytics engine could not process this portfolio.', {
        status: res.statusCode,
        detail: tryJson(errText) ?? errText.slice(0, 500),
      });
    }

    const data = (await res.body.json()) as MetricsResponse;
    return data;
  } catch (err) {
    if (err instanceof UpstreamError) throw err;
    if (err instanceof Error && err.name === 'AbortError') {
      throw new UpstreamError('Analytics engine timed out. Try again in a moment.');
    }
    logger.error({ err }, 'Failed to reach ML engine');
    throw new UpstreamError('Analytics engine unreachable.');
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Hits the ML engine health endpoint. Used by the gateway's /health/deep.
 */
export async function pingMlEngine(): Promise<boolean> {
  try {
    const res = await request(`${env.ML_ENGINE_URL}/health`, { method: 'GET' });
    return res.statusCode === 200;
  } catch {
    return false;
  }
}

function tryJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
