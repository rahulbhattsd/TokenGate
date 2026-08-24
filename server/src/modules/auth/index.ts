import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma from '../../config/db';

const signupSchema = z.object({ email: z.string().email(), password: z.string().min(6) });
const loginSchema = z.object({ email: z.string().email(), password: z.string() });
const refreshSchema = z.object({ refreshToken: z.string() });

const generateTokens = (userId: string) => {
  const accessToken = jwt.sign({ userId }, process.env.JWT_SECRET as string, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET as string, { expiresIn: '7d' });
  return { accessToken, refreshToken };
};

export const signup = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = signupSchema.parse(req.body);
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) { res.status(400).json({ error: 'User already exists' }); return; }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { email, password: hashedPassword } });
    res.status(201).json(generateTokens(user.id));
  } catch (error) { res.status(400).json({ error: 'Error' }); }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      res.status(401).json({ error: 'Invalid credentials' }); return;
    }
    res.json(generateTokens(user.id));
  } catch (error) { res.status(400).json({ error: 'Error' }); }
};

export const refresh = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET as string) as { userId: string };
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) { res.status(401).json({ error: 'Invalid token' }); return; }
    res.json(generateTokens(user.id));
  } catch (error) { res.status(401).json({ error: 'Invalid token' }); }
};
