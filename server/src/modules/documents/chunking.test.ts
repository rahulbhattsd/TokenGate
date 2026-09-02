import { describe, expect, it } from 'vitest';
import { chunkTextParts } from './chunking';

describe('chunkTextParts', () => {
  it('creates token-aware chunks with metadata and overlap', () => {
    const chunks = chunkTextParts([
      { text: 'alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu' },
      { text: 'nu xi omicron pi rho sigma tau upsilon phi chi psi omega' },
    ], {
      chunkSize: 8,
      overlap: 2,
      baseMetadata: { documentName: 'greek.md', source: 'greek.md' },
    });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every(chunk => chunk.tokenCount <= 8)).toBe(true);
    expect(chunks[0].metadata.documentName).toBe('greek.md');
    expect(chunks[0].chunkIndex).toBe(0);
  });
});
