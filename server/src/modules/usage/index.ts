import prisma from '../../config/db';
export const logRequest = async (apiKeyId: string, provider: string, model: string, inputTokens: number, outputTokens: number, tokensSaved: number, cachedHit: boolean, latencyMs: number, costUsd: number) => {
  try {
    await prisma.requestLog.create({ data: { apiKeyId, provider, model, inputTokens, outputTokens, tokensSaved, cachedHit, latencyMs, costUsd } });
  } catch (error) {}
};
