import { Redis } from 'ioredis';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

export const redisConnection = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: null
});

redisConnection.on('error', (error) => {
  logger.error('Redis connection error.', error);
});
