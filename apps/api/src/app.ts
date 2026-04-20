import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { env } from './config.js';
import { logger } from './logger.js';
import { requestId } from './middleware/requestId.js';
import { globalLimiter } from './middleware/rateLimit.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { buildApiRouter } from './routes/index.js';

/**
 * Builds the Express application. Pure function so tests can spin up an
 * app without binding to a port.
 */
export function buildApp(): Express {
  const app: Express = express();

  // If deployed behind a proxy (Render, Vercel edge, etc.), trust the first
  // hop so `req.ip` and rate-limit keys are correct.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(requestId);

  app.use(
    pinoHttp({
      logger,
      customProps: (req) => ({ reqId: req.id }),
      customLogLevel: (_req, res, err) => {
        if (err) return 'error';
        if (res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
      serializers: {
        req: (req) => ({ id: req.id, method: req.method, url: req.url }),
        res: (res) => ({ statusCode: res.statusCode }),
      },
    }),
  );

  app.use(
    helmet({
      contentSecurityPolicy: false, // API serves JSON, no HTML to protect
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.use(
    cors({
      origin: env.CLIENT_ORIGIN,
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    }),
  );

  app.use(express.json({ limit: '1mb' }));

  app.use(globalLimiter);

  app.use('/api', buildApiRouter());

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
