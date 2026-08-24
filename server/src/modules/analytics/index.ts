import { Request, Response } from 'express';
import prisma from '../../config/db';

export const getSummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const apiKeys = await prisma.apiKey.findMany({ where: { userId: req.userId } });
    const keyIds = apiKeys.map(k => k.id);
    
    const logs = await prisma.requestLog.findMany({ where: { apiKeyId: { in: keyIds } } });
    const totalRequests = logs.length;
    const totalCost = logs.reduce((sum, l) => sum + l.costUsd, 0);
    const tokensSaved = logs.reduce((sum, l: any) => sum + (l.tokensSaved || 0), 0);
    const cacheHits = logs.filter(l => l.cachedHit).length;
    const cacheHitRate = totalRequests ? cacheHits / totalRequests : 0;
    
    res.json({ totalRequests, totalCost, tokensSaved, cacheHitRate });
  } catch (error) { res.status(500).json({ error: 'Error' }); }
};

export const getCostTrend = async (req: Request, res: Response): Promise<void> => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - days);

    const apiKeys = await prisma.apiKey.findMany({ where: { userId: req.userId } });
    const keyIds = apiKeys.map(k => k.id);

    const logs = await prisma.requestLog.findMany({
      where: { apiKeyId: { in: keyIds }, createdAt: { gte: dateLimit } },
      select: { createdAt: true, costUsd: true }
    });

    const trendMap: Record<string, number> = {};
    for (const log of logs) {
      const dateStr = log.createdAt.toISOString().split('T')[0];
      trendMap[dateStr] = (trendMap[dateStr] || 0) + log.costUsd;
    }

    const result = Object.entries(trendMap).map(([date, cost]) => ({ date, cost })).sort((a, b) => a.date.localeCompare(b.date));
    res.json(result);
  } catch (error) { res.status(500).json({ error: 'Error' }); }
};

export const getByModel = async (req: Request, res: Response): Promise<void> => {
  try {
    const apiKeys = await prisma.apiKey.findMany({ where: { userId: req.userId } });
    const keyIds = apiKeys.map(k => k.id);

    const logs = await prisma.requestLog.findMany({
      where: { apiKeyId: { in: keyIds } },
      select: { provider: true, model: true, costUsd: true }
    });

    const modelMap: Record<string, number> = {};
    for (const log of logs) {
      const key = `${log.provider}:${log.model}`;
      modelMap[key] = (modelMap[key] || 0) + log.costUsd;
    }

    const result = Object.entries(modelMap).map(([key, cost]) => {
      const [provider, model] = key.split(':');
      return { provider, model, cost };
    }).sort((a, b) => b.cost - a.cost);

    res.json(result);
  } catch (error) { res.status(500).json({ error: 'Error' }); }
};

export const getLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const apiKeys = await prisma.apiKey.findMany({ where: { userId: req.userId } });
    const logs = await prisma.requestLog.findMany({
      where: { apiKeyId: { in: apiKeys.map(k => k.id) } },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    res.json(logs);
  } catch (error) { res.status(500).json({ error: 'Error' }); }
};
