import { Router } from 'express';
import { healthRouter } from './health.js';
import { meRouter } from './me.js';
import { portfoliosRouter } from './portfolios.js';
import { holdingsRouter } from './holdings.js';
import { metricsRouter } from './metrics.js';
import { chatRouter } from './chat.js';
import { reportsRouter } from './reports.js';
import { analyzeRouter } from './analyze.js';

/**
 * Mounts every versioned route under /api.
 */
export function buildApiRouter(): Router {
  const router: Router = Router();

  // Public
  router.use('/', healthRouter);

  // Authenticated
  router.use('/me', meRouter);
  router.use('/portfolios', portfoliosRouter);
  router.use('/', holdingsRouter); // routes are namespaced internally
  router.use('/metrics', metricsRouter);
  router.use('/chat', chatRouter);
  router.use('/reports', reportsRouter);
  router.use('/analyze', analyzeRouter);

  return router;
}
