import type { NextFunction, Request, Response } from 'express';
import { refreshSession, verifyAuthToken } from '../services/auth.service.js';

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const user = verifyAuthToken(token);
    const sessionActive = await refreshSession(user.userId);

    if (!sessionActive) {
      return res.status(401).json({ error: 'Session expired' });
    }

    req.user = user;
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
