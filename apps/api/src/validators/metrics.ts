import { z } from 'zod';

export const MetricsRequestSchema = z.object({
  portfolioId: z.string().uuid(),
  benchmark: z.string().toUpperCase().regex(/^[A-Z0-9.\-]{1,12}$/).optional(),
  riskFreeRate: z.number().min(0).max(0.5).optional(),
});

export type MetricsRequestInput = z.infer<typeof MetricsRequestSchema>;
