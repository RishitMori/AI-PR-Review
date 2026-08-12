import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { redisConnection } from '../queue/redis.js';

export const healthRouter = Router();

healthRouter.get('/health', async (_req, res) => {
  const dbResult = await prisma.$queryRaw<Array<{ ok: number }>>`SELECT 1 as ok`;
  const redisResult = await redisConnection.ping();

  res.json({
    ok: true,
    db: dbResult[0]?.ok === 1 ? 'ok' : 'unknown',
    redis: redisResult
  });
});
