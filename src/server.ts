import express from 'express';
import { assertRuntimeConfig, config } from './config.js';
import { healthRouter } from './routes/health.js';
import { reviewsRouter } from './routes/reviews.js';
import { webhookRouter } from './routes/webhook.js';
import { disconnectPrisma } from './db/prisma.js';
import { redisConnection } from './queue/redis.js';

assertRuntimeConfig();

const app = express();

app.use('/webhook', express.raw({ type: 'application/json', limit: '5mb' }));
app.use(express.json({ limit: '1mb' }));

app.use(healthRouter);
app.use(reviewsRouter);
app.use(webhookRouter);

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error);
  res.status(500).json({
    error: error instanceof Error ? error.message : 'Internal server error'
  });
});

const server = app.listen(config.PORT, () => {
  console.log(`AI PR Review Bot listening on port ${config.PORT}`);
});

async function shutdown() {
  console.log('Shutting down server...');
  server.close(async () => {
    await redisConnection.quit();
    await disconnectPrisma();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
