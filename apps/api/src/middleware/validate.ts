import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny, z } from 'zod';
import { ValidationError } from '../lib/errors.js';

type Source = 'body' | 'query' | 'params';

/**
 * Parses and replaces a request slice with its Zod-validated counterpart.
 * If validation fails, produces a structured 400 that includes the field
 * path + message for each issue.
 *
 * Usage: router.post('/x', validate(Schema), handler)  — for body
 *        router.get('/x',  validate(Schema, 'query'), handler)
 */
export function validate<Schema extends ZodTypeAny>(schema: Schema, source: Source = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = {
        issues: result.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
          code: i.code,
        })),
      };
      return next(new ValidationError('Request failed validation', details));
    }
    // Re-assign the parsed (and coerced) value back onto the request.
    (req as unknown as Record<Source, z.infer<Schema>>)[source] = result.data;
    next();
  };
}
