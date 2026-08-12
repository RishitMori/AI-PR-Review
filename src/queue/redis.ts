import { Redis } from 'ioredis';
import { config } from '../config.js';

export const redisConnection = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: null
});
