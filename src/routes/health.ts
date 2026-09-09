import { Router } from 'express';
import { config } from '../config.js';
import { prisma } from '../db/prisma.js';
import { getRedisConnection } from '../queue/redis.js';

export const healthRouter = Router();

healthRouter.get('/health', async (_req, res) => {
  const dbResult = await prisma.$queryRaw<Array<{ ok: number }>>`SELECT 1 as ok`;
  const redisConnection = getRedisConnection();
  const redisResult = redisConnection ? await redisConnection.ping() : 'disabled';

  res.json({
    ok: true,
    db: dbResult[0]?.ok === 1 ? 'ok' : 'unknown',
    redis: redisResult,
    redis_enabled: config.USE_REDIS
  });
});
