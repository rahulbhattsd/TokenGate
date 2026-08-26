import prisma from '../../config/db';
import { logger } from '../../config/logger';

export const logRequest = async (apiKeyId: string, provider: string, model: string, inputTokens: number, outputTokens: number, tokensSaved: number, cachedHit: boolean, latencyMs: number, costUsd: number, purpose?: string) => {
  try {
    await prisma.$transaction([
      prisma.requestLog.create({ data: { apiKeyId, provider, model, inputTokens, outputTokens, tokensSaved, cachedHit, latencyMs, costUsd, purpose } }),
      prisma.apiKey.update({ where: { id: apiKeyId }, data: { spendUsd: { increment: costUsd } } })
    ]);
  } catch (error) {
    logger.error({ err: error, apiKeyId, provider, model }, 'Failed to log request');
  }
};
