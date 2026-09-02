import { describe, expect, it } from 'vitest';
import { CandidateChunk, injectRagContext, selectChunksWithinBudget } from './index';
import { Message } from '../providers/types';

const chunk = (id: string, tokenCount: number, similarity: number): CandidateChunk => ({
  documentId: id,
  documentName: `${id}.md`,
  chunkIndex: 0,
  tokenCount,
  content: `${id} content`,
  metadata: null,
  similarity,
});

describe('selectChunksWithinBudget', () => {
  it('keeps relevant chunks in order while respecting max context tokens', () => {
    const result = selectChunksWithinBudget([
      chunk('a', 600, 0.95),
      chunk('b', 500, 0.9),
      chunk('c', 800, 0.85),
      chunk('d', 700, 0.8),
    ], 1500);

    expect(result.selected.map(item => item.documentId)).toEqual(['a', 'b']);
    expect(result.tokensUsed).toBe(1100);
    expect(result.tokensDiscarded).toBe(1500);
  });
});

describe('injectRagContext', () => {
  it('preserves the first system message and adds RAG context inside it', () => {
    const messages: Message[] = [
      { role: 'system', content: 'Original system.' },
      { role: 'user', content: 'Question?' },
    ];

    const result = injectRagContext(messages, {
      enabled: true,
      knowledgeBaseId: 'kb-1',
      knowledgeBaseVersion: 3,
      chunksRetrieved: 1,
      chunksUsed: 1,
      tokensUsed: 20,
      tokensDiscarded: 0,
      retrievalLatencyMs: 5,
      embeddingTokens: 4,
      embeddingCostUsd: 0.001,
      context: '[Source: a.md]\nAnswer source',
      sources: [],
    });

    expect(result).toHaveLength(2);
    expect(result[0].role).toBe('system');
    expect(result[0].content).toContain('Original system.');
    expect(result[0].content).toContain('Knowledge context:');
    expect(result[1]).toEqual(messages[1]);
  });
});
