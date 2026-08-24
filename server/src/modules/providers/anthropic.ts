import Anthropic from '@anthropic-ai/sdk';
import { ProviderAdapter, Message, ChatOptions, ProviderResponse } from './types';
export class AnthropicAdapter implements ProviderAdapter {
  private client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  async chat(messages: Message[], model: string, opts?: ChatOptions): Promise<ProviderResponse> {
    const systemMessage = messages.find(m => m.role === 'system')?.content;
    const chatMessages = messages.filter(m => m.role !== 'system').map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
    const response = await this.client.messages.create({ model, system: systemMessage, messages: chatMessages, temperature: opts?.temperature, max_tokens: opts?.maxTokens || 1024 });
    return { text: response.content[0].type === 'text' ? response.content[0].text : '', inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens };
  }
}
