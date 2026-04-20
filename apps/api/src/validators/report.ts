import { z } from 'zod';

export const ReportCreateSchema = z.object({
  portfolioId: z.string().uuid(),
  title: z.string().trim().min(1).max(200).default('Portfolio Report'),
});

export const ReportIdParam = z.object({
  id: z.string().uuid(),
});

export type ReportCreate = z.infer<typeof ReportCreateSchema>;
