import express from 'express';
import cookieParser from 'cookie-parser';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { assertRuntimeConfig, config } from './config.js';
import { authRouter } from './routes/auth.js';
import { healthRouter } from './routes/health.js';
import { reviewsRouter } from './routes/reviews.js';
import { webhookRouter } from './routes/webhook.js';
import { disconnectPrisma } from './db/prisma.js';
import { redisConnection } from './queue/redis.js';
import { logger } from './utils/logger.js';

assertRuntimeConfig();

const app = express();

app.use('/webhook', express.raw({ type: 'application/json', limit: '5mb' }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.use(healthRouter);
app.use(authRouter);
app.use(reviewsRouter);
app.use(webhookRouter);
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'API route not found.' });
});
app.use('/auth', (_req, res) => {
  res.status(404).json({ error: 'Auth route not found.' });
});

const dashboardDist = join(process.cwd(), 'dashboard', 'dist');
if (existsSync(dashboardDist)) {
  const sendApp = (_req: express.Request, res: express.Response) => {
    res.sendFile(join(dashboardDist, 'index.html'));
  };

  app.use(express.static(dashboardDist));
  app.use('/dashboard', express.static(dashboardDist));
  app.get(['/dashboard', '/dashboard/*', '/terms', '/terms/*', '/privacy', '/privacy/*', '/contact', '/contact/*', '/switch-github', '/switch-github/*'], sendApp);
  app.get('/', sendApp);
  app.get('*', sendApp);
}

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error(error);
  res.status(500).json({
    error: error instanceof Error ? error.message : 'Internal server error'
  });
});

const server = app.listen(config.PORT, () => {
  logger.info(`AI PR Review Bot listening on port ${config.PORT}`);
});

async function shutdown() {
  logger.info('Shutting down server...');
  server.close(async () => {
    await redisConnection.quit();
    await disconnectPrisma();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
