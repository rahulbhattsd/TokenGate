import { ProviderAdapter } from './types';
import { OpenAIAdapter } from './openai';
import { AnthropicAdapter } from './anthropic';
import { GeminiAdapter } from './gemini';

export const pricingTable: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 5.0, output: 15.0 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'claude-3-5-sonnet-20241022': { input: 3.0, output: 15.0 },
  'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
  'gemini-1.5-pro': { input: 1.25, output: 5.0 },
  'gemini-1.5-flash': { input: 0.075, output: 0.3 },
};

const adapters: Record<string, ProviderAdapter> = {};

export const getProviderAdapter = (provider: string): ProviderAdapter => {
  if (!adapters[provider]) {
    if (provider === 'openai') adapters[provider] = new OpenAIAdapter();
    else if (provider === 'anthropic') adapters[provider] = new AnthropicAdapter();
    else if (provider === 'gemini') adapters[provider] = new GeminiAdapter();
    else throw new Error(`Unsupported provider: ${provider}`);
  }
  return adapters[provider];
};
