import { ProviderAdapter } from './types';
import { OpenAIAdapter } from './openai';
import { AnthropicAdapter } from './anthropic';
import { GeminiAdapter } from './gemini';

export const pricingTable: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 5.0, output: 15.0 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'claude-3-5-sonnet-20240620': { input: 3.0, output: 15.0 },
  'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
  'gemini-1.5-pro': { input: 3.5, output: 10.5 },
  'gemini-1.5-flash': { input: 0.35, output: 1.05 },
};

export const getProviderAdapter = (provider: string): ProviderAdapter => {
  if (provider === 'openai') return new OpenAIAdapter();
  if (provider === 'anthropic') return new AnthropicAdapter();
  if (provider === 'gemini') return new GeminiAdapter();
  throw new Error(`Unsupported provider: ${provider}`);
};
