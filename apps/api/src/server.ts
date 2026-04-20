import { buildApp } from './app.js';
import { env } from './config.js';
import { logger } from './logger.js';

const app = buildApp();

const server = app.listen(env.PORT, () => {
  logger.info(
    { port: env.PORT, env: env.NODE_ENV, origin: env.CLIENT_ORIGIN },
    '🐂 BullFin API listening',
  );
});

// Graceful shutdown so connections finish instead of 502'ing.
function shutdown(signal: string): void {
  logger.info({ signal }, 'Shutdown signal received');
  server.close((err) => {
    if (err) {
      logger.error({ err }, 'Error during server.close');
      process.exit(1);
    }
    logger.info('Server closed cleanly');
    process.exit(0);
  });
  // Hard deadline — don't hang forever.
  setTimeout(() => {
    logger.warn('Force exit after 10s');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled promise rejection');
});
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception — exiting');
  process.exit(1);
});
