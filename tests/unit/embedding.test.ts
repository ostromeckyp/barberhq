import { describe, expect, it, vi } from 'vitest';
import {
  createEmbeddingAdapter,
  createEmbeddingConfig,
  validateEmbeddingVectors,
} from '../../functions/src/knowledge/embedding.js';

const input = {
  projectId: 'barberhq-test',
  modelId: 'text-embedding-005',
  dimension: 3,
  documentMode: 'RETRIEVAL_DOCUMENT' as const,
  queryMode: 'RETRIEVAL_QUERY' as const,
  location: 'europe-west4',
};

describe('server-side embedding adapter validation', () => {
  it('creates a stable config identity including project, region, model, dimension and task modes', () => {
    const config = createEmbeddingConfig(input);
    expect(config).toMatchObject({ ...input, provider: 'vertex' });
    expect(config.configHash).toBe(createEmbeddingConfig({ ...input }).configHash);
    expect(config.configHash).not.toBe(
      createEmbeddingConfig({ ...input, location: 'us-central1' }).configHash,
    );
    expect(config.configHash).not.toBe(
      createEmbeddingConfig({ ...input, dimension: 2 }).configHash,
    );
  });

  it('routes document and query through their distinct retrieval task types', async () => {
    const calls: string[] = [];
    const adapter = createEmbeddingAdapter(
      createEmbeddingConfig(input),
      async (texts, taskType) => {
        calls.push(taskType);
        return texts.map(() => [1, 2, 3]);
      },
    );
    await adapter.embedTexts(['a document'], 'document');
    await adapter.embedTexts(['a query'], 'query');
    expect(calls).toEqual(['RETRIEVAL_DOCUMENT', 'RETRIEVAL_QUERY']);
  });

  it.each([
    ['wrong vector count', [[1, 2, 3]] as number[][], 2, 3, /vectors for 2 inputs/],
    ['wrong vector dimension', [[1, 2]] as number[][], 1, 3, /expected 3/],
    ['non-finite entries', [[1, Number.NaN, 3]] as number[][], 1, 3, /non-finite/],
    ['zero vectors', [[0, 0, 0]] as number[][], 1, 3, /zero or invalid norm/],
  ])('rejects %s', (_case, vectors, count, dimension, error) => {
    expect(() => validateEmbeddingVectors(vectors, count, dimension)).toThrow(error);
  });

  it('rejects empty or oversized text before invoking the provider', async () => {
    const provider = vi.fn(async () => [[1, 2, 3]]);
    const adapter = createEmbeddingAdapter(createEmbeddingConfig(input), provider);
    await expect(adapter.embedTexts(['  '], 'query')).rejects.toThrow(/non-empty/);
    await expect(adapter.embedTexts(['x'.repeat(8_001)], 'document')).rejects.toThrow(/exceeds/);
    expect(provider).not.toHaveBeenCalled();
  });

  it('rejects invalid output dimensions and misconfigured task modes', () => {
    expect(() => createEmbeddingConfig({ ...input, dimension: 0 })).toThrow(/positive integer/);
    expect(() =>
      createEmbeddingConfig({ ...input, queryMode: 'RETRIEVAL_DOCUMENT' as const }),
    ).toThrow(/Embedding modes/);
  });
});
