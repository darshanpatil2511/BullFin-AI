import 'dotenv/config';
import { z } from 'zod';

/**
 * Validates process.env at startup. Any missing or malformed variable
 * crashes the server immediately with a readable message — cheaper than
 * a mysterious 500 three hours into production.
 */
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Supabase — service role is server-only and never shipped to the browser.
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),

  // Google Gemini (AI advisor).
  GEMINI_API_KEY: z.string().min(10),
  GEMINI_MODEL: z.string().default('gemini-2.0-flash'),

  // FastAPI ML engine base URL. Expected endpoints live under /v1/*.
  ML_ENGINE_URL: z.string().url().default('http://127.0.0.1:5000'),

  // CORS — single explicit origin, never `*`.
  CLIENT_ORIGIN: z.string().url().default('http://localhost:5173'),

  // Optional integrations.
  REDIS_URL: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  console.error(`\n❌ Invalid environment variables:\n${issues}\n`);
  process.exit(1);
}

export const env: Env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
export const isDev = env.NODE_ENV === 'development';
export const isTest = env.NODE_ENV === 'test';
