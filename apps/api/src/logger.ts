import pino from 'pino';
import { env, isProd } from './config.js';

export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: 'bullfin-api' },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-api-key"]',
      '*.password',
      '*.token',
      '*.apiKey',
      '*.SUPABASE_SERVICE_ROLE_KEY',
      '*.GEMINI_API_KEY',
    ],
    censor: '[redacted]',
  },
  transport: isProd
    ? undefined
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss.l',
          ignore: 'pid,hostname,service',
        },
      },
});
