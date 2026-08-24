import { Message } from '../providers/types';
import { countTokens } from '../tokenizer';
import { getProviderAdapter } from '../providers';

export const pruneMessages = async (messages: Message[], maxTokens: number, provider: string, model: string) => {
  const totalTokens = messages.reduce((sum, msg) => sum + countTokens(msg.content, model).count, 0);
  if (totalTokens <= maxTokens || messages.length <= 3) return { prunedMessages: messages, tokensSaved: 0 };
  
  const systemMessage = messages.find(m => m.role === 'system');
  const chatHistory = messages.filter(m => m.role !== 'system');
  if (chatHistory.length <= 4) return { prunedMessages: messages, tokensSaved: 0 };
  
  const oldMsgs = chatHistory.slice(0, chatHistory.length - 4);
  const recentMsgs = chatHistory.slice(chatHistory.length - 4);
  const oldTokens = oldMsgs.reduce((sum, msg) => sum + countTokens(msg.content, model).count, 0);
  
  const summaryPrompt = [{ role: 'system', content: 'Summarize context.' }, ...oldMsgs];
  const adapter = getProviderAdapter(provider);
  const summaryRes = await adapter.chat(summaryPrompt as Message[], model, { maxTokens: 256 });
  
  const summaryTokens = countTokens(summaryRes.text, model).count;
  const tokensSaved = Math.max(0, oldTokens - summaryTokens);
  
  const prunedMessages: Message[] = [];
  if (systemMessage) prunedMessages.push(systemMessage);
  prunedMessages.push({ role: 'system', content: `Summary: ${summaryRes.text}` });
  prunedMessages.push(...recentMsgs);
  
  return { prunedMessages, tokensSaved };
};
