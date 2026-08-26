import { Request, Response } from 'express';
import prisma from '../../config/db';
import { Prisma } from '@prisma/client';
import { logger } from '../../config/logger';

export const getSummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const apiKeys = await prisma.apiKey.findMany({ where: { userId: req.userId } });
    const keyIds = apiKeys.map((k: any) => k.id);
    
    const aggregate = await prisma.requestLog.aggregate({
      where: { apiKeyId: { in: keyIds } },
      _count: { id: true },
      _sum: { costUsd: true, tokensSaved: true },
    });

    const totalRequests = aggregate._count.id;
    const totalCost = aggregate._sum.costUsd || 0;
    const tokensSaved = aggregate._sum.tokensSaved || 0;

    const cacheHitsCount = await prisma.requestLog.count({
      where: { apiKeyId: { in: keyIds }, cachedHit: true }
    });
    const cacheHitRate = totalRequests ? cacheHitsCount / totalRequests : 0;
    
    res.json({ totalRequests, totalCost, tokensSaved, cacheHitRate });
  } catch (error) {
    logger.error({ err: error }, 'Failed to get summary');
    res.status(500).json({ error: 'Error' });
  }
};

export const getCostTrend = async (req: Request, res: Response): Promise<void> => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - days);

    const apiKeys = await prisma.apiKey.findMany({ where: { userId: req.userId } });
    const keyIds = apiKeys.map((k: any) => k.id);

    if (keyIds.length === 0) {
      res.json([]);
      return;
    }

    const grouped = await prisma.$queryRaw`
      SELECT DATE("createdAt") as date, SUM("costUsd") as cost
      FROM "RequestLog"
      WHERE "apiKeyId" IN (${Prisma.join(keyIds)})
        AND "createdAt" >= ${dateLimit}
      GROUP BY DATE("createdAt")
      ORDER BY DATE("createdAt") ASC
    ` as any[];

    const result = grouped.map((row: any) => ({
      date: row.date.toISOString().split('T')[0],
      cost: row.cost || 0
    }));

    res.json(result);
  } catch (error) {
    logger.error({ err: error }, 'Failed to get cost trend');
    res.status(500).json({ error: 'Error' });
  }
};

export const getByModel = async (req: Request, res: Response): Promise<void> => {
  try {
    const apiKeys = await prisma.apiKey.findMany({ where: { userId: req.userId } });
    const keyIds = apiKeys.map((k: any) => k.id);

    const grouped = await prisma.requestLog.groupBy({
      by: ['provider', 'model'],
      where: { apiKeyId: { in: keyIds } },
      _sum: { costUsd: true }
    });

    const result = grouped.map((row: any) => ({
      provider: row.provider,
      model: row.model,
      cost: row._sum.costUsd || 0
    })).sort((a: any, b: any) => b.cost - a.cost);

    res.json(result);
  } catch (error) {
    logger.error({ err: error }, 'Failed to get by model');
    res.status(500).json({ error: 'Error' });
  }
};

export const getLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const page = parseInt(req.query.page as string) || 1;
    const skip = (page - 1) * limit;

    const apiKeys = await prisma.apiKey.findMany({ where: { userId: req.userId } });
    const logs = await prisma.requestLog.findMany({
      where: { apiKeyId: { in: apiKeys.map((k: any) => k.id) } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip
    });
    res.json(logs);
  } catch (error) {
    logger.error({ err: error }, 'Failed to get logs');
    res.status(500).json({ error: 'Error' });
  }
};
