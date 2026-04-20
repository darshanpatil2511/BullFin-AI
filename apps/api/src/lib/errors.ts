/**
 * Typed error hierarchy used across the API. The global error handler
 * maps each subclass to an HTTP status code + stable machine-readable
 * `code` so the web client can branch on it.
 */

export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;
  readonly expose: boolean;

  constructor(
    message: string,
    opts: {
      status?: number;
      code?: string;
      details?: Record<string, unknown>;
      cause?: unknown;
      expose?: boolean;
    } = {},
  ) {
    super(message);
    this.name = this.constructor.name;
    this.status = opts.status ?? 500;
    this.code = opts.code ?? 'INTERNAL_ERROR';
    this.details = opts.details;
    this.expose = opts.expose ?? this.status < 500;
    if (opts.cause) this.cause = opts.cause;
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Invalid request', details?: Record<string, unknown>) {
    super(message, { status: 400, code: 'VALIDATION_ERROR', details });
  }
}

export class AuthError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, { status: 401, code: 'UNAUTHORIZED' });
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, { status: 403, code: 'FORBIDDEN' });
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, { status: 404, code: 'NOT_FOUND' });
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict', details?: Record<string, unknown>) {
    super(message, { status: 409, code: 'CONFLICT', details });
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, { status: 429, code: 'RATE_LIMITED' });
  }
}

export class UpstreamError extends AppError {
  constructor(message = 'Upstream service failed', details?: Record<string, unknown>) {
    super(message, { status: 502, code: 'UPSTREAM_ERROR', details });
  }
}
