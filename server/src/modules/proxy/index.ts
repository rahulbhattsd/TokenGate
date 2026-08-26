import { Request, Response } from 'express';
import { z } from 'zod';
import { embedPrompt, findSimilar, storeInCache } from '../cache';
import { pruneMessages } from '../pruning';
import { countTokens } from '../tokenizer';
import { getProviderAdapter, pricingTable, calculateCost } from '../providers';
import { logRequest } from '../usage';
import { logger } from '../../config/logger';
import prisma from '../../config/db';
import redis from '../../config/redis';

const schema = z.object({ provider: z.enum(['openai', 'anthropic', 'gemini']), model: z.string(), messages: z.array(z.object({ role: z.enum(['system', 'user', 'assistant']), content: z.string() })), temperature: z.number().optional(), maxTokens: z.number().optional(), userId: z.string().optional() });

export const handleProxyRequest = async (req: Request, res: Response): Promise<void> => {
  const start = Date.now();
  try {
    const { provider, model, messages, temperature, maxTokens, userId } = schema.parse(req.body);
    const apiKeyId = req.apiKeyId!;

    const limit = 60;
    const key = `rate_limit:${apiKeyId}`;
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, 60);
    }
    if (current > limit) {
      res.status(429).json({ error: 'Too many requests' });
      return;
    }

    // Check quota
    const apiKey = await prisma.apiKey.findUnique({ where: { id: apiKeyId } });
    if (!apiKey) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const SPEND_LIMIT = 10.0; // Configurable limit
    if (apiKey.spendUsd >= SPEND_LIMIT) {
      res.status(402).json({ error: 'Spend quota exceeded' });
      return;
    }

    const text = messages.map(m => `${m.role}: ${m.content}`).join('\n');
    const embedding = await embedPrompt(text);
    const cached = await findSimilar(apiKeyId, embedding, provider, model, userId);
    
    if (cached) {
      const realTokensSaved = cached.inputTokens + cached.outputTokens;
      await logRequest(apiKeyId, provider, model, 0, 0, realTokensSaved, true, Date.now() - start, 0);
      res.json({ text: cached.response, cached: true, tokensSaved: realTokensSaved, inputTokens: 0, outputTokens: 0, costUsd: 0, latencyMs: Date.now() - start });
      return;
    }

    const maxContext = pricingTable[model]?.maxContext || 4096;
    const { prunedMessages, tokensSaved } = await pruneMessages(messages, maxContext, provider, model, apiKeyId);
    const inputTokens = prunedMessages.reduce((sum, msg) => sum + countTokens(msg.content, model).count, 0);
    const adapter = getProviderAdapter(provider);
    const response = await adapter.chat(prunedMessages, model, { temperature, maxTokens });
    
    const finalInputTokens = response.inputTokens || inputTokens;
    const finalOutputTokens = response.outputTokens || countTokens(response.text, model).count;
    const costUsd = calculateCost(model, finalInputTokens, finalOutputTokens);
    if (!pricingTable[model]) {
      logger.warn(`Warning: pricing not found for model ${model}`);
    }
    
    await storeInCache(apiKeyId, text, embedding, response.text, provider, model, finalInputTokens, finalOutputTokens, userId);
    await logRequest(apiKeyId, provider, model, finalInputTokens, finalOutputTokens, tokensSaved, false, Date.now() - start, costUsd);
    
    res.json({ text: response.text, cached: false, tokensSaved, inputTokens: finalInputTokens, outputTokens: finalOutputTokens, costUsd, latencyMs: Date.now() - start, prunedMessages });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    logger.error({ err: error }, 'Proxy request failed');
    res.status(500).json({ error: 'Error' });
  }
};
