/**
 * Sentry is optional — initialization is a no-op if SENTRY_DSN is absent.
 * This file ships as a stub so apps/api builds without the @sentry/node dep.
 * To enable:
 *   pnpm --filter @bullfin/api add @sentry/node
 *   then uncomment the import + init block below and drop the stub.
 */

import { env } from '../config.js';
import { logger } from '../logger.js';

export function initSentry(): void {
  if (!env.SENTRY_DSN) return;
  logger.warn(
    'SENTRY_DSN is set but @sentry/node is not installed. ' +
      'Run `pnpm --filter @bullfin/api add @sentry/node` and enable the import in lib/sentry.ts.',
  );
  // Example wiring once the dep is installed:
  //   import * as Sentry from '@sentry/node';
  //   Sentry.init({
  //     dsn: env.SENTRY_DSN,
  //     environment: env.NODE_ENV,
  //     tracesSampleRate: 0.1,
  //   });
}
