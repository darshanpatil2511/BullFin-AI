import rateLimit from 'express-rate-limit';

/**
 * Broad limit for anonymous and authenticated traffic. Tuned generously —
 * the web client makes several requests per dashboard load.
 */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { ok: false, error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
});

/**
 * Stricter limit for endpoints that burn money/latency — Gemini chat and
 * metric recomputations hit paid or slow upstreams.
 */
export const expensiveLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { ok: false, error: { code: 'RATE_LIMITED', message: 'Slow down a moment' } },
});

/**
 * File-upload limiter — a CSV parse is cheap but the storage write is not.
 */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { ok: false, error: { code: 'RATE_LIMITED', message: 'Too many uploads' } },
});
