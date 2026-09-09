import { Redis } from 'ioredis';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

let redisConnection: Redis | null = null;

export function getRedisConnection() {
  if (!config.USE_REDIS) return null;

  if (!redisConnection) {
    redisConnection = new Redis(config.REDIS_URL, {
      maxRetriesPerRequest: null
    });

    redisConnection.on('error', (error) => {
      logger.error('Redis connection error.', error);
    });
  }

  return redisConnection;
}

export async function quitRedisConnection() {
  if (!redisConnection) return;

  await redisConnection.quit();
  redisConnection = null;
}
