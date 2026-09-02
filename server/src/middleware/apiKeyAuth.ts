import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import prisma from '../config/db';

declare module 'express-serve-static-core' {
  interface Request { apiKeyId?: string; apiKeyUserId?: string; }
}

export const authenticateApiKey = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) { res.status(401).json({ error: 'Unauthorized' }); return; }
  const rawKey = authHeader.split(' ')[1];
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
  try {
    const apiKey = await prisma.apiKey.findUnique({ where: { keyHash } });
    if (!apiKey || apiKey.revoked) { res.status(401).json({ error: 'Invalid key' }); return; }
    req.apiKeyId = apiKey.id;
    req.apiKeyUserId = apiKey.userId;
    next();
  } catch (error) { res.status(500).json({ error: 'Error' }); }
};
