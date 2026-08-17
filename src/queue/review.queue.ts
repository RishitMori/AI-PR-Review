import { Queue } from 'bullmq';
import { redisConnection } from './redis.js';
import type { ReviewJobData } from '../types/index.js';
import { logger } from '../utils/logger.js';

export const reviewQueue = new Queue<ReviewJobData>('review-pr', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000
    },
    removeOnComplete: {
      age: 60 * 60 * 24 * 7
    },
    removeOnFail: {
      age: 60 * 60 * 24 * 14
    }
  }
});

reviewQueue.on('error', (error) => {
  logger.error('Review queue error.', error);
});

export function reviewJobId(data: Pick<ReviewJobData, 'repoFullName' | 'prNumber' | 'headSha'>) {
  return `${data.repoFullName}#${data.prNumber}#${data.headSha}`;
}
