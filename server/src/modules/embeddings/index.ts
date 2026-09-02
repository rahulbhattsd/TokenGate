import OpenAI from 'openai';
import { logger } from '../../config/logger';
import { countTokens } from '../tokenizer';

export interface EmbeddingResult {
  embedding: number[];
  tokens: number;
  costUsd: number;
  model: string;
}

export interface BatchEmbeddingResult {
  embeddings: number[][];
  tokens: number;
  costUsd: number;
  model: string;
}

let openaiClient: OpenAI | null = null;

const getOpenAIClient = () => {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
};

export const getEmbeddingModel = () => process.env.RAG_EMBEDDING_MODEL || 'text-embedding-3-small';

const getEmbeddingCostPerToken = () => {
  const perMillion = parseFloat(process.env.RAG_EMBEDDING_COST_PER_1M_TOKENS || '0.02');
  return perMillion / 1_000_000;
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const normalizeInputs = (texts: string[]) => texts.map(text => text.trim()).filter(Boolean);

const withRetry = async <T>(operation: () => Promise<T>, label: string): Promise<T> => {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      const status = error?.status || error?.code;
      if (![408, 409, 429, 500, 502, 503, 504].includes(status) || attempt === 3) {
        break;
      }
      await sleep(250 * attempt);
    }
  }
  logger.error({ err: lastError }, `${label} failed`);
  throw lastError;
};

export const estimateEmbeddingTokens = (texts: string[]): number =>
  normalizeInputs(texts).reduce((sum, text) => sum + countTokens(text, getEmbeddingModel()).count, 0);

export const embedTexts = async (texts: string[]): Promise<BatchEmbeddingResult> => {
  const inputs = normalizeInputs(texts);
  const model = getEmbeddingModel();

  if (inputs.length === 0) {
    return { embeddings: [], tokens: 0, costUsd: 0, model };
  }

  const response = await withRetry(
    () => getOpenAIClient().embeddings.create({ model, input: inputs }),
    'Embedding request'
  );

  const usageTokens = response.usage?.total_tokens || estimateEmbeddingTokens(inputs);
  return {
    embeddings: response.data.map(item => item.embedding),
    tokens: usageTokens,
    costUsd: usageTokens * getEmbeddingCostPerToken(),
    model,
  };
};

export const embedText = async (text: string): Promise<EmbeddingResult> => {
  const result = await embedTexts([text]);
  return {
    embedding: result.embeddings[0] || [],
    tokens: result.tokens,
    costUsd: result.costUsd,
    model: result.model,
  };
};
