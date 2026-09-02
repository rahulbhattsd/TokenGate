import prisma from '../../config/db';
import { logger } from '../../config/logger';

export interface UsageLogMetadata {
  ragEnabled?: boolean;
  knowledgeBaseId?: string;
  chunksRetrieved?: number;
  chunksUsed?: number;
  ragTokens?: number;
  tokensDiscarded?: number;
  retrievalLatencyMs?: number;
  embeddingTokens?: number;
  embeddingCostUsd?: number;
  llmCostUsd?: number;
}

export const logRequest = async (
  apiKeyId: string,
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  tokensSaved: number,
  cachedHit: boolean,
  latencyMs: number,
  costUsd: number,
  purpose?: string,
  metadata?: UsageLogMetadata
) => {
  try {
    await prisma.$transaction([
      prisma.requestLog.create({
        data: {
          apiKeyId,
          provider,
          model,
          inputTokens,
          outputTokens,
          tokensSaved,
          cachedHit,
          latencyMs,
          costUsd,
          purpose,
          ragEnabled: metadata?.ragEnabled || false,
          knowledgeBaseId: metadata?.knowledgeBaseId,
          chunksRetrieved: metadata?.chunksRetrieved || 0,
          chunksUsed: metadata?.chunksUsed || 0,
          ragTokens: metadata?.ragTokens || 0,
          tokensDiscarded: metadata?.tokensDiscarded || 0,
          retrievalLatencyMs: metadata?.retrievalLatencyMs || 0,
          embeddingTokens: metadata?.embeddingTokens || 0,
          embeddingCostUsd: metadata?.embeddingCostUsd || 0,
          llmCostUsd: metadata?.llmCostUsd ?? costUsd,
        },
      }),
      prisma.apiKey.update({ where: { id: apiKeyId }, data: { spendUsd: { increment: costUsd } } })
    ]);
  } catch (error) {
    logger.error({ err: error, apiKeyId, provider, model }, 'Failed to log request');
  }
};
