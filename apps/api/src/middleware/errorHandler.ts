import type { ErrorRequestHandler, RequestHandler } from 'express';
import multer from 'multer';
import { ZodError } from 'zod';
import { AppError, NotFoundError } from '../lib/errors.js';
import { isProd } from '../config.js';
import { logger } from '../logger.js';

/**
 * Terminal 404 — only reached if no route matched.
 */
export const notFound: RequestHandler = (req, _res, next) => {
  next(new NotFoundError(`Route not found: ${req.method} ${req.path}`));
};

/**
 * Global error handler. Maps domain errors to HTTP status codes, logs
 * unexpected failures with a request id, and never leaks internals in
 * production responses.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  // Zod failures surface here if a route forgot to use `validate`.
  if (err instanceof ZodError) {
    res.status(400).json({
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request failed validation',
        details: {
          issues: err.issues.map((i) => ({
            path: i.path.join('.'),
            message: i.message,
            code: i.code,
          })),
        },
      },
    });
    return;
  }

  // Multer surfaces upload problems (size, count, field name). Map them to a
  // clean 413/400 instead of the generic 500 fallthrough.
  if (err instanceof multer.MulterError) {
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'File is too large — the server accepts PDFs up to 10 MB.'
        : err.message;
    logger.warn({ reqId: req.id, path: req.path, code: err.code }, message);
    res.status(status).json({
      ok: false,
      error: { code: err.code, message },
    });
    return;
  }

  if (err instanceof AppError) {
    if (err.status >= 500) {
      logger.error({ err, reqId: req.id, path: req.path }, err.message);
    } else {
      logger.warn({ reqId: req.id, path: req.path, code: err.code }, err.message);
    }
    res.status(err.status).json({
      ok: false,
      error: {
        code: err.code,
        message: err.expose ? err.message : 'Internal server error',
        ...(err.expose && err.details ? { details: err.details } : {}),
      },
    });
    return;
  }

  // Unexpected — something threw that we didn't wrap.
  logger.error({ err, reqId: req.id, path: req.path }, 'Unhandled error');
  res.status(500).json({
    ok: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: isProd ? 'Internal server error' : (err as Error)?.message ?? 'Unknown error',
    },
  });
};
