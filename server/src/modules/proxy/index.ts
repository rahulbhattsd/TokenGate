import { Request, Response } from 'express';
import { z } from 'zod';
import { findSimilar, storeInCache, CacheScope } from '../cache';
import { embedText } from '../embeddings';
import { pruneMessages } from '../pruning';
import { countTokens } from '../tokenizer';
import { getProviderAdapter, pricingTable, calculateCost } from '../providers';
import { logRequest } from '../usage';
import { logger } from '../../config/logger';
import prisma from '../../config/db';
import redis from '../../config/redis';
import { ensureKnowledgeBaseOwner } from '../documents';
import { getLastUserQuestion, injectRagContext, RagRetrievalResult, retrieveRagContext } from '../rag';

const ragSchema = z.object({
  enabled: z.boolean().optional(),
  knowledgeBaseId: z.string().optional(),
  topK: z.number().int().min(1).max(20).optional(),
  similarityThreshold: z.number().min(0).max(1).optional(),
  maxContextTokens: z.number().int().min(1).max(20000).optional(),
}).optional();

const schema = z.object({
  provider: z.enum(['openai', 'anthropic', 'gemini']),
  model: z.string(),
  messages: z.array(z.object({ role: z.enum(['system', 'user', 'assistant']), content: z.string() })).min(1),
  temperature: z.number().optional(),
  maxTokens: z.number().optional(),
  userId: z.string().optional(),
  rag: ragSchema,
});

const buildRagResponseMetadata = (retrieval: RagRetrievalResult) => ({
  enabled: true,
  knowledgeBaseId: retrieval.knowledgeBaseId,
  knowledgeBaseVersion: retrieval.knowledgeBaseVersion,
  chunksRetrieved: retrieval.chunksRetrieved,
  chunksUsed: retrieval.chunksUsed,
  tokensUsed: retrieval.tokensUsed,
  tokensDiscarded: retrieval.tokensDiscarded,
  retrievalLatencyMs: retrieval.retrievalLatencyMs,
  sources: retrieval.sources,
});

export const handleProxyRequest = async (req: Request, res: Response): Promise<void> => {
  const start = Date.now();
  try {
    const { provider, model, messages, temperature, maxTokens, userId, rag } = schema.parse(req.body);
    const apiKeyId = req.apiKeyId!;
    const apiKeyUserId = req.apiKeyUserId!;
    const ragEnabled = Boolean(rag?.enabled);

    const limit = parseInt(process.env.RATE_LIMIT_PER_MINUTE || '60');
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

    let cacheScope: CacheScope | undefined;
    if (ragEnabled) {
      if (!rag?.knowledgeBaseId) {
        res.status(400).json({ error: 'rag.knowledgeBaseId is required when RAG is enabled' });
        return;
      }
      const knowledgeBase = await ensureKnowledgeBaseOwner(rag.knowledgeBaseId, apiKeyUserId);
      cacheScope = {
        ragEnabled: true,
        knowledgeBaseId: knowledgeBase.id,
        knowledgeBaseVersion: knowledgeBase.version,
        topK: rag.topK || parseInt(process.env.RAG_TOP_K || '5'),
        similarityThreshold: rag.similarityThreshold ?? parseFloat(process.env.RAG_SIMILARITY_THRESHOLD || '0.75'),
        maxContextTokens: rag.maxContextTokens || parseInt(process.env.RAG_MAX_CONTEXT_TOKENS || '2000'),
      };
    }

    const text = messages.map(m => `${m.role}: ${m.content}`).join('\n');
    const promptEmbedding = await embedText(text);
    const cached = await findSimilar(apiKeyId, promptEmbedding.embedding, provider, model, userId, cacheScope);
    
    if (cached) {
      const realTokensSaved = cached.inputTokens + cached.outputTokens;
      const cachedRagMetadata = cached.ragMetadata || undefined;
      const cachedCostUsd = ragEnabled ? promptEmbedding.costUsd : 0;
      await logRequest(apiKeyId, provider, model, 0, 0, realTokensSaved, true, Date.now() - start, cachedCostUsd, ragEnabled ? 'rag-cache-hit' : undefined, {
        ragEnabled,
        knowledgeBaseId: cacheScope?.knowledgeBaseId,
        chunksRetrieved: cachedRagMetadata?.chunksRetrieved || 0,
        chunksUsed: cachedRagMetadata?.chunksUsed || 0,
        ragTokens: cachedRagMetadata?.tokensUsed || 0,
        tokensDiscarded: cachedRagMetadata?.tokensDiscarded || 0,
        embeddingTokens: ragEnabled ? promptEmbedding.tokens : 0,
        embeddingCostUsd: ragEnabled ? promptEmbedding.costUsd : 0,
        llmCostUsd: 0,
      });
      res.json({
        text: cached.response,
        cached: true,
        tokensSaved: realTokensSaved,
        inputTokens: 0,
        outputTokens: 0,
        costUsd: cachedCostUsd,
        latencyMs: Date.now() - start,
        ...(ragEnabled ? { rag: cachedRagMetadata } : {}),
      });
      return;
    }

    let providerMessages = messages;
    let ragResult: RagRetrievalResult | undefined;
    if (ragEnabled && rag?.knowledgeBaseId) {
      ragResult = await retrieveRagContext(apiKeyUserId, {
        enabled: true,
        knowledgeBaseId: rag.knowledgeBaseId,
        topK: cacheScope?.topK,
        similarityThreshold: cacheScope?.similarityThreshold,
        maxContextTokens: cacheScope?.maxContextTokens,
      }, getLastUserQuestion(messages));
      if (cacheScope) {
        cacheScope.knowledgeBaseVersion = ragResult.knowledgeBaseVersion;
      }

      if (ragResult.chunksUsed === 0 && process.env.RAG_REQUIRE_CONTEXT === 'true') {
        const ragMetadata = buildRagResponseMetadata(ragResult);
        const costUsd = promptEmbedding.costUsd + ragResult.embeddingCostUsd;
        await logRequest(apiKeyId, provider, model, 0, 0, 0, false, Date.now() - start, costUsd, 'rag-no-context', {
          ragEnabled: true,
          knowledgeBaseId: ragResult.knowledgeBaseId,
          chunksRetrieved: ragResult.chunksRetrieved,
          chunksUsed: 0,
          ragTokens: 0,
          tokensDiscarded: ragResult.tokensDiscarded,
          retrievalLatencyMs: ragResult.retrievalLatencyMs,
          embeddingTokens: promptEmbedding.tokens + ragResult.embeddingTokens,
          embeddingCostUsd: promptEmbedding.costUsd + ragResult.embeddingCostUsd,
          llmCostUsd: 0,
        });
        res.json({
          text: 'No relevant knowledge base context found.',
          cached: false,
          tokensSaved: 0,
          inputTokens: 0,
          outputTokens: 0,
          costUsd,
          latencyMs: Date.now() - start,
          rag: ragMetadata,
        });
        return;
      }

      providerMessages = injectRagContext(messages, ragResult);
    }

    const maxContext = pricingTable[model]?.maxContext || 4096;
    const { prunedMessages, tokensSaved } = await pruneMessages(providerMessages, maxContext, provider, model, apiKeyId);
    const inputTokens = prunedMessages.reduce((sum, msg) => sum + countTokens(msg.content, model).count, 0);
    const adapter = getProviderAdapter(provider);
    const response = await adapter.chat(prunedMessages, model, { temperature, maxTokens });
    
    const finalInputTokens = response.inputTokens || inputTokens;
    const finalOutputTokens = response.outputTokens || countTokens(response.text, model).count;
    const llmCostUsd = calculateCost(model, finalInputTokens, finalOutputTokens);
    const ragEmbeddingCostUsd = ragEnabled ? promptEmbedding.costUsd + (ragResult?.embeddingCostUsd || 0) : 0;
    const ragEmbeddingTokens = ragEnabled ? promptEmbedding.tokens + (ragResult?.embeddingTokens || 0) : 0;
    const costUsd = llmCostUsd + ragEmbeddingCostUsd;
    if (!pricingTable[model]) {
      logger.warn(`Warning: pricing not found for model ${model}`);
    }
    
    const ragMetadata = ragResult ? buildRagResponseMetadata(ragResult) : undefined;
    await storeInCache(apiKeyId, text, promptEmbedding.embedding, response.text, provider, model, finalInputTokens, finalOutputTokens, userId, cacheScope, ragMetadata);
    await logRequest(apiKeyId, provider, model, finalInputTokens, finalOutputTokens, tokensSaved, false, Date.now() - start, costUsd, ragEnabled ? 'rag' : undefined, {
      ragEnabled,
      knowledgeBaseId: ragResult?.knowledgeBaseId,
      chunksRetrieved: ragResult?.chunksRetrieved || 0,
      chunksUsed: ragResult?.chunksUsed || 0,
      ragTokens: ragResult?.tokensUsed || 0,
      tokensDiscarded: ragResult?.tokensDiscarded || 0,
      retrievalLatencyMs: ragResult?.retrievalLatencyMs || 0,
      embeddingTokens: ragEmbeddingTokens,
      embeddingCostUsd: ragEmbeddingCostUsd,
      llmCostUsd,
    });
    
    res.json({
      text: response.text,
      cached: false,
      tokensSaved,
      inputTokens: finalInputTokens,
      outputTokens: finalOutputTokens,
      costUsd,
      latencyMs: Date.now() - start,
      prunedMessages,
      ...(ragMetadata ? { rag: ragMetadata } : {}),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    if ((error as any)?.statusCode === 404) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    logger.error({ err: error }, 'Proxy request failed');
    res.status(500).json({ error: 'Error' });
  }
};
