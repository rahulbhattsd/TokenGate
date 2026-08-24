import { Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../../config/db';
import { z } from 'zod';

const generateKeySchema = z.object({ label: z.string().min(1).max(255) });

export const generateKey = async (req: Request, res: Response): Promise<void> => {
  try {
    const { label } = generateKeySchema.parse(req.body);
    const userId = req.userId!;
    const rawKey = `tg_${crypto.randomBytes(32).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const apiKey = await prisma.apiKey.create({ data: { userId, label, keyHash } });
    res.status(201).json({ id: apiKey.id, label: apiKey.label, key: rawKey, createdAt: apiKey.createdAt });
  } catch (error) { res.status(500).json({ error: 'Error' }); }
};

export const listKeys = async (req: Request, res: Response): Promise<void> => {
  try {
    const keys = await prisma.apiKey.findMany({
      where: { userId: req.userId! },
      select: { id: true, label: true, revoked: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(keys);
  } catch (error) { res.status(500).json({ error: 'Error' }); }
};

export const revokeKey = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const apiKey = await prisma.apiKey.findFirst({ where: { id, userId: req.userId! } });
    if (!apiKey) { res.status(404).json({ error: 'Not found' }); return; }
    await prisma.apiKey.update({ where: { id }, data: { revoked: true } });
    res.json({ message: 'Revoked' });
  } catch (error) { res.status(500).json({ error: 'Error' }); }
};
