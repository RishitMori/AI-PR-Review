import { Worker } from 'bullmq';
import { assertRuntimeConfig } from '../config.js';
import { redisConnection } from '../queue/redis.js';
import type { ReviewJobData } from '../types/index.js';
import { processReviewJob } from '../services/review.service.js';
import { disconnectPrisma } from '../db/prisma.js';
import { logger } from '../utils/logger.js';

assertRuntimeConfig();

const worker = new Worker<ReviewJobData>(
  'review-pr',
  async (job) => {
    logger.info(`Processing review job ${job.id}`);
    const result = await processReviewJob(job.data);
    logger.info(`Finished review job ${job.id}`, result);
    return result;
  },
  {
    connection: redisConnection,
    concurrency: 2,
    stalledInterval: 120000
  }
);

worker.on('failed', (job, error) => {
  logger.error(`Review job ${job?.id ?? 'unknown'} failed:`, error);
});

async function shutdown() {
  logger.info('Shutting down review worker...');
  await worker.close();
  await redisConnection.quit();
  await disconnectPrisma();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
