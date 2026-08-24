import OpenAI from 'openai';
import prisma from '../../config/db';
import crypto from 'crypto';

export const embedPrompt = async (text: string): Promise<number[]> => {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await openai.embeddings.create({ model: 'text-embedding-3-small', input: text });
  return response.data[0].embedding;
};

export const findSimilar = async (embedding: number[], provider: string, model: string) => {
  const threshold = parseFloat(process.env.CACHE_SIMILARITY_THRESHOLD || '0.95');
  const result = await prisma.$queryRaw`
    SELECT id, response, 1 - (embedding <=> ${embedding}::vector) as similarity
    FROM "CacheEntry" WHERE provider = ${provider} AND model = ${model} AND 1 - (embedding <=> ${embedding}::vector) > ${threshold}
    ORDER BY similarity DESC LIMIT 1;
  ` as any[];
  if (result.length > 0) {
    await prisma.cacheEntry.update({ where: { id: result[0].id }, data: { hitCount: { increment: 1 } } });
    return result[0].response;
  }
  return null;
};

export const storeInCache = async (text: string, embedding: number[], response: string, provider: string, model: string) => {
  const promptHash = crypto.createHash('sha256').update(text).digest('hex');
  try {
    await prisma.$executeRaw`
      INSERT INTO "CacheEntry" ("id", "promptHash", "embedding", "response", "provider", "model", "createdAt")
      VALUES (gen_random_uuid(), ${promptHash}, ${embedding}::vector, ${response}, ${provider}, ${model}, NOW())
      ON CONFLICT ("promptHash") DO NOTHING;
    `;
  } catch (error) {}
};
