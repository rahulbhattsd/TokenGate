import { Request, Response, NextFunction } from 'express';
import redis from '../config/redis';

export const rateLimiter = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const apiKeyId = req.apiKeyId;
  if (!apiKeyId) { res.status(401).json({ error: 'Unauthorized' }); return; }
  
  const limit = 60;
  const key = `rate_limit:${apiKeyId}`;
  
  try {
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, 60);
    }
    if (current > limit) {
      res.status(429).json({ error: 'Too many requests' });
      return;
    }
    next();
  } catch (error) {
    next();
  }
};
