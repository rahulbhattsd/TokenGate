import { countTokens } from '../tokenizer';

export interface TextPart {
  text: string;
  metadata?: Record<string, unknown>;
}

export interface DocumentChunkInput {
  content: string;
  chunkIndex: number;
  tokenCount: number;
  metadata: Record<string, unknown>;
}

const splitLongSegment = (text: string, model: string, maxTokens: number): string[] => {
  const words = text.split(/\s+/).filter(Boolean);
  const segments: string[] = [];
  let current: string[] = [];

  for (const word of words) {
    const candidate = [...current, word].join(' ');
    if (current.length > 0 && countTokens(candidate, model).count > maxTokens) {
      segments.push(current.join(' '));
      current = [word];
    } else {
      current.push(word);
    }
  }

  if (current.length > 0) segments.push(current.join(' '));
  return segments;
};

const splitIntoTokenAwareSegments = (parts: TextPart[], model: string, maxTokens: number) => {
  const segments: Array<{ text: string; tokenCount: number; metadata: Record<string, unknown> }> = [];

  for (const part of parts) {
    const paragraphs = part.text
      .split(/\n{2,}/)
      .map(paragraph => paragraph.trim())
      .filter(Boolean);

    for (const paragraph of paragraphs) {
      const tokenCount = countTokens(paragraph, model).count;
      const metadata = part.metadata || {};
      if (tokenCount <= maxTokens) {
        segments.push({ text: paragraph, tokenCount, metadata });
        continue;
      }

      for (const segment of splitLongSegment(paragraph, model, maxTokens)) {
        segments.push({ text: segment, tokenCount: countTokens(segment, model).count, metadata });
      }
    }
  }

  return segments;
};

export const chunkTextParts = (
  parts: TextPart[],
  options?: { model?: string; chunkSize?: number; overlap?: number; baseMetadata?: Record<string, unknown> }
): DocumentChunkInput[] => {
  const model = options?.model || 'gpt-4o-mini';
  const chunkSize = options?.chunkSize || parseInt(process.env.RAG_CHUNK_SIZE || '500');
  const overlap = Math.max(0, Math.min(options?.overlap ?? parseInt(process.env.RAG_CHUNK_OVERLAP || '75'), chunkSize - 1));
  const segments = splitIntoTokenAwareSegments(parts, model, chunkSize);
  const chunks: DocumentChunkInput[] = [];
  let current: typeof segments = [];
  let currentTokens = 0;

  const pushCurrent = () => {
    if (current.length === 0) return;
    const content = current.map(segment => segment.text).join('\n\n').trim();
    if (!content) return;
    chunks.push({
      content,
      chunkIndex: chunks.length,
      tokenCount: countTokens(content, model).count,
      metadata: {
        ...(options?.baseMetadata || {}),
        ...(current[0].metadata || {}),
        chunkIndex: chunks.length,
      },
    });
  };

  const setOverlap = () => {
    if (overlap === 0) {
      current = [];
      currentTokens = 0;
      return;
    }

    const overlapSegments: typeof segments = [];
    let overlapTokens = 0;
    for (let index = current.length - 1; index >= 0; index -= 1) {
      const segment = current[index];
      if (overlapTokens + segment.tokenCount > overlap) break;
      overlapSegments.unshift(segment);
      overlapTokens += segment.tokenCount;
    }
    current = overlapSegments;
    currentTokens = overlapTokens;
  };

  for (const segment of segments) {
    if (segment.tokenCount === 0) continue;
    if (current.length > 0 && currentTokens + segment.tokenCount > chunkSize) {
      pushCurrent();
      setOverlap();
    }
    current.push(segment);
    currentTokens += segment.tokenCount;
  }

  pushCurrent();
  return chunks;
};
