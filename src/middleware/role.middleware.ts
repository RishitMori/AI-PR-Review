import type { NextFunction, Request, Response } from 'express';

export function requireOwner(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== 'owner') {
    return res.status(403).json({ error: 'Owner access required' });
  }

  return next();
}
