import { z } from 'zod';

const SYMBOL_REGEX = /^[A-Z0-9.\-]{1,12}$/;

const holdingBase = z.object({
  symbol: z
    .string()
    .trim()
    .toUpperCase()
    .regex(SYMBOL_REGEX, 'Symbol must be 1–12 chars of A-Z, 0-9, . or -'),
  shares: z.number().positive().max(1e9),
  purchasePrice: z.number().nonnegative().max(1e9),
  purchaseDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
    .refine((d) => !Number.isNaN(new Date(d).getTime()), { message: 'Invalid date' }),
  sector: z.string().trim().max(100).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const HoldingCreateSchema = holdingBase;

export const HoldingBulkCreateSchema = z.object({
  holdings: z.array(holdingBase).min(1).max(500),
});

export const HoldingUpdateSchema = holdingBase.partial().refine(
  (o) => Object.keys(o).length > 0,
  { message: 'At least one field is required' },
);

export const HoldingIdParam = z.object({
  id: z.string().uuid(),
});

export const PortfolioIdParam = z.object({
  portfolioId: z.string().uuid(),
});

export type HoldingCreate = z.infer<typeof HoldingCreateSchema>;
export type HoldingBulkCreate = z.infer<typeof HoldingBulkCreateSchema>;
export type HoldingUpdate = z.infer<typeof HoldingUpdateSchema>;
