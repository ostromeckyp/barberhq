import { describe, expect, it } from 'vitest';
import { validateCitations } from '../../functions/src/ai/citations.ts';
import type { RetrievedChunk } from '../../functions/src/ai/retrieval.ts';

const source = {
  businessId: 'business',
  documentId: 'document',
  versionId: 'version',
  version: 'v1',
  title: 'SQL title',
  language: 'en',
  synthetic: true,
  kind: 'procedure',
  origin: 'synthetic',
  superseded: false,
  pageCount: 2,
  chunkId: 'page-local-chunk',
  sourceSectionId: 'page-local-chunk',
  sectionId: 'logical-section',
  physicalPage: 2,
  excerpt: 'Verified procedure.',
  geometry: { viewBox: [0, 0, 100, 100], userUnit: 1, rotation: 0 },
  rects: [],
  geometryStatus: 'UNAVAILABLE',
  cosineDistance: 0.1,
  documentRevision: 4,
  embeddingConfigHash: 'a'.repeat(64),
} as RetrievedChunk;

describe('citation validation', () => {
  it('invented_citation_rejected', () => {
    expect(() =>
      validateCitations([{ text: 'Do X', sourceSectionIds: ['invented'] }], [source]),
    ).toThrow();
  });
  it('uses page-local SQL source metadata and deduplicates cited sources', () => {
    const sources = validateCitations(
      [
        { text: 'First step', sourceSectionIds: ['page-local-chunk'] },
        { text: 'Second step', sourceSectionIds: ['page-local-chunk'] },
      ],
      [source],
    );
    expect(sources).toEqual(
      [
        {
          ...source,
          cosineDistance: undefined,
          documentRevision: undefined,
          embeddingConfigHash: undefined,
        },
      ].map(({ cosineDistance, documentRevision, embeddingConfigHash, ...item }) => item),
    );
    expect(sources[0].sourceSectionId).toBe('page-local-chunk');
    expect(sources[0].sectionId).toBe('logical-section');
  });
  it('rejects empty citation lists and duplicate chunk identities', () => {
    expect(() => validateCitations([{ text: 'Step', sourceSectionIds: [] }], [source])).toThrow();
    expect(() =>
      validateCitations(
        [{ text: 'Step', sourceSectionIds: ['page-local-chunk'] }],
        [source, source],
      ),
    ).toThrow();
  });
});
