import OpenAI from 'openai';
import { ProviderAdapter, Message, ChatOptions, ProviderResponse } from './types';
export class OpenAIAdapter implements ProviderAdapter {
  private client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  async chat(messages: Message[], model: string, opts?: ChatOptions): Promise<ProviderResponse> {
    const response = await this.client.chat.completions.create({ model, messages: messages as any, temperature: opts?.temperature, max_tokens: opts?.maxTokens });
    return { text: response.choices[0]?.message?.content || '', inputTokens: response.usage?.prompt_tokens || 0, outputTokens: response.usage?.completion_tokens || 0 };
  }
}
