import { Request, Response } from 'express';
import { z } from 'zod';
import { embedPrompt, findSimilar, storeInCache } from '../cache';
import { pruneMessages } from '../pruning';
import { countTokens } from '../tokenizer';
import { getProviderAdapter, pricingTable } from '../providers';
import { logRequest } from '../usage';
import { logger } from '../../config/logger';

const schema = z.object({ provider: z.enum(['openai', 'anthropic', 'gemini']), model: z.string(), messages: z.array(z.object({ role: z.enum(['system', 'user', 'assistant']), content: z.string() })), temperature: z.number().optional(), maxTokens: z.number().optional() });

export const handleProxyRequest = async (req: Request, res: Response): Promise<void> => {
  const start = Date.now();
  try {
    const { provider, model, messages, temperature, maxTokens } = schema.parse(req.body);
    const apiKeyId = req.apiKeyId!;
    const text = messages.map(m => `${m.role}: ${m.content}`).join('\n');
    const embedding = await embedPrompt(text);
    const cached = await findSimilar(apiKeyId, embedding, provider, model);
    
    if (cached) {
      const realTokensSaved = cached.inputTokens + cached.outputTokens;
      await logRequest(apiKeyId, provider, model, 0, 0, realTokensSaved, true, Date.now() - start, 0);
      res.json({ text: cached.response, cached: true, tokensSaved: realTokensSaved, inputTokens: 0, outputTokens: 0, costUsd: 0, latencyMs: Date.now() - start });
      return;
    }

    const { prunedMessages, tokensSaved } = await pruneMessages(messages, 4096, provider, model, apiKeyId);
    const inputTokens = prunedMessages.reduce((sum, msg) => sum + countTokens(msg.content, model).count, 0);
    const adapter = getProviderAdapter(provider);
    const response = await adapter.chat(prunedMessages, model, { temperature, maxTokens });
    
    const finalInputTokens = response.inputTokens || inputTokens;
    const finalOutputTokens = response.outputTokens || countTokens(response.text, model).count;
    const costUsd = pricingTable[model] ? (finalInputTokens / 1000) * pricingTable[model].input + (finalOutputTokens / 1000) * pricingTable[model].output : 0;
    if (!pricingTable[model]) {
      logger.warn(`Warning: pricing not found for model ${model}`);
    }
    
    await storeInCache(apiKeyId, text, embedding, response.text, provider, model, finalInputTokens, finalOutputTokens);
    await logRequest(apiKeyId, provider, model, finalInputTokens, finalOutputTokens, tokensSaved, false, Date.now() - start, costUsd);
    
    res.json({ text: response.text, cached: false, tokensSaved, inputTokens: finalInputTokens, outputTokens: finalOutputTokens, costUsd, latencyMs: Date.now() - start });
  } catch (error) {
    logger.error({ err: error }, 'Proxy request failed');
    res.status(500).json({ error: 'Error' });
  }
};
