import { z } from 'zod';

const name = z.string().trim().min(1).max(120);
const description = z.string().trim().max(2000).optional().nullable();
const baseCurrency = z
  .string()
  .length(3)
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, 'Currency must be a 3-letter ISO code')
  .default('USD');

export const PortfolioCreateSchema = z.object({
  name,
  description,
  baseCurrency: baseCurrency.optional(),
});

export const PortfolioUpdateSchema = z
  .object({
    name: name.optional(),
    description,
    baseCurrency: baseCurrency.optional(),
    isArchived: z.boolean().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: 'At least one field is required' });

export const PortfolioIdParam = z.object({
  id: z.string().uuid(),
});

export type PortfolioCreate = z.infer<typeof PortfolioCreateSchema>;
export type PortfolioUpdate = z.infer<typeof PortfolioUpdateSchema>;
