import { Message } from '../providers/types';
import { countTokens } from '../tokenizer';
import { getProviderAdapter, pricingTable } from '../providers';
import { logRequest } from '../usage';

export const pruneMessages = async (messages: Message[], maxTokens: number, provider: string, model: string, apiKeyId: string) => {
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
  const start = Date.now();
  const summaryRes = await adapter.chat(summaryPrompt as Message[], model, { maxTokens: 256 });
  const latencyMs = Date.now() - start;
  
  const finalInputTokens = summaryRes.inputTokens || countTokens(summaryPrompt.map(m => m.content).join('\n'), model).count;
  const finalOutputTokens = summaryRes.outputTokens || countTokens(summaryRes.text, model).count;
  const costUsd = pricingTable[model] ? (finalInputTokens / 1000) * pricingTable[model].input + (finalOutputTokens / 1000) * pricingTable[model].output : 0;

  await logRequest(apiKeyId, provider, model, finalInputTokens, finalOutputTokens, 0, false, latencyMs, costUsd, 'pruning-summary');


  const tokensSaved = Math.max(0, oldTokens - finalOutputTokens);
  
  const prunedMessages: Message[] = [];
  if (systemMessage) prunedMessages.push(systemMessage);
  prunedMessages.push({ role: 'system', content: `Summary: ${summaryRes.text}` });
  prunedMessages.push(...recentMsgs);
  
  return { prunedMessages, tokensSaved };
};
