import { GoogleGenerativeAI } from '@google/generative-ai';
import { ProviderAdapter, Message, ChatOptions, ProviderResponse } from './types';
export class GeminiAdapter implements ProviderAdapter {
  private client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
  async chat(messages: Message[], model: string, opts?: ChatOptions): Promise<ProviderResponse> {
    const generativeModel = this.client.getGenerativeModel({ model });
    const systemMessage = messages.find(m => m.role === 'system')?.content;
    const history = messages.filter(m => m.role !== 'system').map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
    const lastMessage = history.pop()?.parts[0].text || '';
    const chat = generativeModel.startChat({ history, systemInstruction: systemMessage, generationConfig: { temperature: opts?.temperature, maxOutputTokens: opts?.maxTokens } });
    const result = await chat.sendMessage(lastMessage);
    const response = await result.response;
    return { text: response.text(), inputTokens: response.usageMetadata?.promptTokenCount || 0, outputTokens: response.usageMetadata?.candidatesTokenCount || 0 };
  }
}
