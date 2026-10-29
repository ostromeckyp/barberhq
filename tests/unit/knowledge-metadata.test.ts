import { expect, it } from 'vitest';
import * as metadata from '../../shared/knowledge-metadata.js';

it('maps only the two exact legacy classifications', () => {
  expect(metadata.metadataFromLegacy('synthetic-procedure')).toEqual({
    kind: 'procedure',
    origin: 'synthetic',
  });
  expect(metadata.metadataFromLegacy('public-product-summary')).toEqual({
    kind: 'product-catalog',
    origin: 'public-compilation',
  });
});
it('reads legacy storage and validates canonical metadata against retained fields', () => {
  expect(
    metadata.metadataFromStorage({ sourceType: 'SYNTHETIC_PROCEDURE', synthetic: true }),
  ).toEqual({ kind: 'procedure', origin: 'synthetic' });
  expect(
    metadata.metadataFromStorage({
      kind: 'PRODUCT_CARD',
      origin: 'OFFICIAL',
      sourceType: null,
      synthetic: false,
    }),
  ).toEqual({ kind: 'product-card', origin: 'official' });
  for (const row of [
    { kind: 'POLICY', synthetic: true, sourceType: 'SYNTHETIC_PROCEDURE' },
    { kind: 'ALIEN', origin: 'OFFICIAL', synthetic: false },
    { kind: 'POLICY', origin: 'OFFICIAL', synthetic: true },
    {
      kind: 'PRODUCT_CARD',
      origin: 'SYNTHETIC',
      sourceType: 'SYNTHETIC_PROCEDURE',
      synthetic: true,
    },
    { sourceType: 'PUBLIC_PRODUCT_SUMMARY', synthetic: true },
    { sourceType: null, synthetic: false },
  ])
    expect(() => metadata.metadataFromStorage(row)).toThrow();
});
it('labels provenance and derives synthetic for each kind independently', () => {
  expect(metadata.knowledgeProvenanceLabel({ kind: 'product-card', origin: 'synthetic' })).toBe(
    'Synthetic demo product card',
  );
  expect(metadata.knowledgeProvenanceLabel({ kind: 'policy', origin: 'official' })).toBe(
    'Official policy',
  );
  expect(
    metadata.knowledgeProvenanceLabel({ kind: 'procedure', origin: 'public-compilation' }),
  ).toBe('Unofficial public procedure compilation');
  expect(metadata.isSyntheticSource({ kind: 'product-catalog', origin: 'synthetic' })).toBe(true);
  expect(metadata.isSyntheticSource({ kind: 'procedure', origin: 'official' })).toBe(false);
});
