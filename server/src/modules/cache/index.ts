import prisma from '../../config/db';
import crypto from 'crypto';
import { logger } from '../../config/logger';
import { embedText } from '../embeddings';

export interface CacheScope {
  ragEnabled?: boolean;
  knowledgeBaseId?: string;
  knowledgeBaseVersion?: number;
  topK?: number;
  similarityThreshold?: number;
  maxContextTokens?: number;
}

export const embedPrompt = async (text: string): Promise<number[]> => {
  const response = await embedText(text);
  return response.embedding;
};

export const buildCacheScopeHash = (scope?: CacheScope): string => {
  if (!scope?.ragEnabled) return 'default';
  return crypto.createHash('sha256').update(JSON.stringify({
    ragEnabled: true,
    knowledgeBaseId: scope.knowledgeBaseId,
    knowledgeBaseVersion: scope.knowledgeBaseVersion,
    topK: scope.topK,
    similarityThreshold: scope.similarityThreshold,
    maxContextTokens: scope.maxContextTokens,
  })).digest('hex');
};

export const findSimilar = async (apiKeyId: string, embedding: number[], provider: string, model: string, userId?: string, scope?: CacheScope) => {
  const threshold = parseFloat(process.env.CACHE_SIMILARITY_THRESHOLD || '0.95');
  const ttlHours = parseInt(process.env.CACHE_TTL_HOURS || '24');

  const resolvedUserId = userId || "";
  const cacheScopeHash = buildCacheScopeHash(scope);

  const result = await prisma.$queryRaw`
    SELECT id, response, "inputTokens", "outputTokens", "ragMetadata", 1 - (embedding <=> ${embedding}::vector) as similarity
    FROM "CacheEntry"
    WHERE "apiKeyId" = ${apiKeyId}
      AND "userId" = ${resolvedUserId}
      AND "cacheScopeHash" = ${cacheScopeHash}
      AND provider = ${provider}
      AND model = ${model}
      AND 1 - (embedding <=> ${embedding}::vector) > ${threshold}
      AND "createdAt" >= NOW() - INTERVAL '1 hour' * ${ttlHours}
    ORDER BY similarity DESC LIMIT 1;
  ` as any[];
  if (result.length > 0) {
    await prisma.cacheEntry.update({ where: { id: result[0].id }, data: { hitCount: { increment: 1 } } });
    return result[0];
  }
  return null;
};

export const storeInCache = async (apiKeyId: string, text: string, embedding: number[], response: string, provider: string, model: string, inputTokens: number, outputTokens: number, userId?: string, scope?: CacheScope, ragMetadata?: unknown) => {
  const promptHash = crypto.createHash('sha256').update(text).digest('hex');
  const resolvedUserId = userId || "";
  const cacheScopeHash = buildCacheScopeHash(scope);
  const serializedRagMetadata = ragMetadata ? JSON.stringify(ragMetadata) : null;
  try {
    await prisma.$executeRaw`
      INSERT INTO "CacheEntry" (
        "id",
        "promptHash",
        "cacheScopeHash",
        "embedding",
        "response",
        "provider",
        "model",
        "apiKeyId",
        "userId",
        "inputTokens",
        "outputTokens",
        "ragEnabled",
        "knowledgeBaseId",
        "knowledgeBaseVersion",
        "ragMetadata",
        "createdAt"
      )
      VALUES (
        gen_random_uuid(),
        ${promptHash},
        ${cacheScopeHash},
        ${embedding}::vector,
        ${response},
        ${provider},
        ${model},
        ${apiKeyId},
        ${resolvedUserId},
        ${inputTokens},
        ${outputTokens},
        ${Boolean(scope?.ragEnabled)},
        ${scope?.knowledgeBaseId || null},
        ${scope?.knowledgeBaseVersion || null},
        ${serializedRagMetadata}::jsonb,
        NOW()
      )
      ON CONFLICT ("promptHash", "apiKeyId", "userId", "cacheScopeHash") DO NOTHING;
    `;
  } catch (error) {
    logger.error({ err: error, apiKeyId, provider, model }, 'Failed to store in cache');
  }
};
