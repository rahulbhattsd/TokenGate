export interface Message { role: 'system' | 'user' | 'assistant'; content: string; }
export interface ChatOptions { temperature?: number; maxTokens?: number; }
export interface ProviderResponse { text: string; inputTokens: number; outputTokens: number; }
export interface ProviderAdapter { chat(messages: Message[], model: string, opts?: ChatOptions): Promise<ProviderResponse>; }
