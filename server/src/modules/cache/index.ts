import OpenAI from 'openai';
import prisma from '../../config/db';
import crypto from 'crypto';
import { logger } from '../../config/logger';

let openaiClient: OpenAI | null = null;
const getOpenAIClient = () => {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
};

export const embedPrompt = async (text: string): Promise<number[]> => {
  const openai = getOpenAIClient();
  const response = await openai.embeddings.create({ model: 'text-embedding-3-small', input: text });
  return response.data[0].embedding;
};

export const findSimilar = async (apiKeyId: string, embedding: number[], provider: string, model: string) => {
  const threshold = parseFloat(process.env.CACHE_SIMILARITY_THRESHOLD || '0.95');
  const ttlHours = parseInt(process.env.CACHE_TTL_HOURS || '24');

  const result = await prisma.$queryRaw`
    SELECT id, response, "inputTokens", "outputTokens", 1 - (embedding <=> ${embedding}::vector) as similarity
    FROM "CacheEntry" WHERE "apiKeyId" = ${apiKeyId} AND provider = ${provider} AND model = ${model} AND 1 - (embedding <=> ${embedding}::vector) > ${threshold} AND "createdAt" >= NOW() - INTERVAL '1 hour' * ${ttlHours}
    ORDER BY similarity DESC LIMIT 1;
  ` as any[];
  if (result.length > 0) {
    await prisma.cacheEntry.update({ where: { id: result[0].id }, data: { hitCount: { increment: 1 } } });
    return result[0];
  }
  return null;
};

export const storeInCache = async (apiKeyId: string, text: string, embedding: number[], response: string, provider: string, model: string, inputTokens: number, outputTokens: number) => {
  const promptHash = crypto.createHash('sha256').update(text).digest('hex');
  try {
    await prisma.$executeRaw`
      INSERT INTO "CacheEntry" ("id", "promptHash", "embedding", "response", "provider", "model", "apiKeyId", "inputTokens", "outputTokens", "createdAt")
      VALUES (gen_random_uuid(), ${promptHash}, ${embedding}::vector, ${response}, ${provider}, ${model}, ${apiKeyId}, ${inputTokens}, ${outputTokens}, NOW())
      ON CONFLICT ("promptHash", "apiKeyId") DO NOTHING;
    `;
  } catch (error) {
    logger.error({ err: error, apiKeyId, provider, model }, 'Failed to store in cache');
  }
};
