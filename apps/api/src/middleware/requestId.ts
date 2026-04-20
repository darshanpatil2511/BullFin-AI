import type { RequestHandler } from 'express';
import { randomUUID } from 'node:crypto';

/**
 * Tags every request with a correlation id so logs line up end-to-end.
 * Honors an incoming `x-request-id` header (handy when we sit behind a
 * proxy that already issues them), otherwise generates a UUID.
 */
export const requestId: RequestHandler = (req, res, next) => {
  const incoming = req.headers['x-request-id'];
  const id = (typeof incoming === 'string' && incoming) || randomUUID();
  req.id = id;
  res.setHeader('x-request-id', id);
  next();
};
