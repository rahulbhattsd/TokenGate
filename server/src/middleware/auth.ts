import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

declare module 'express-serve-static-core' {
  interface Request { userId?: string; }
}

export const authenticateJWT = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.JWT_SECRET as string, (err, user: any) => {
      if (err) return res.status(403).json({ error: 'Forbidden' });
      req.userId = user.userId;
      next();
    });
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
};
