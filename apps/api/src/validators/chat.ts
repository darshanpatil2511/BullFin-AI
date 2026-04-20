import { z } from 'zod';

export const ChatSendSchema = z.object({
  portfolioId: z.string().uuid().optional().nullable(),
  sessionId: z.string().uuid().optional(),
  message: z.string().trim().min(1).max(4000),
});

export const SessionIdParam = z.object({
  id: z.string().uuid(),
});

export const RenameSessionSchema = z.object({
  title: z.string().trim().min(1).max(160),
});

export type ChatSend = z.infer<typeof ChatSendSchema>;
