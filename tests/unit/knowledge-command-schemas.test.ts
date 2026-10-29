import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import {
  knowledgePayloadHash,
  parseCreateDocument,
  parseDeleteVersion,
} from '../../functions/src/knowledge/schemas.ts';

const valid = () => ({
  title: '  Procedure  ',
  language: 'en',
  sourceType: 'synthetic-procedure',
  sourceUrls: ['https://example.invalid/a', 'https://example.invalid/b'],
  observedOn: null,
  sha256: 'a'.repeat(64),
  idempotencyKey: randomUUID(),
});

it('rejects client authority fields, uppercase hashes, and mismatched document revision inputs', () => {
  const input = valid();
  for (const extra of [
    { businessId: 'another' },
    { actorUid: 'attacker' },
    { synthetic: false },
    { objectPath: 'chosen.pdf' },
    { versionLabel: 'v99' },
    { status: 'READY' },
  ])
    expect(() => parseCreateDocument({ ...input, ...extra })).toThrow();
  expect(() => parseCreateDocument({ ...input, sha256: 'A'.repeat(64) })).toThrow();
  expect(() => parseCreateDocument({ ...input, documentId: 'existing' })).toThrow();
  expect(() => parseCreateDocument({ ...input, expectedDocumentRevision: 0 })).toThrow();
  expect(() =>
    parseCreateDocument({
      ...input,
      documentId: 'existing',
      expectedDocumentRevision: 2_147_483_648,
    }),
  ).toThrow();
  expect(() =>
    parseDeleteVersion({
      versionId: 'v1',
      expectedDocumentRevision: 0,
      expectedVersionRevision: 2_147_483_648,
      idempotencyKey: randomUUID(),
    }),
  ).toThrow();
});

it('canonical create hashes ignore the operation key but preserve ordered source URLs', () => {
  const a = parseCreateDocument(valid());
  const b = parseCreateDocument({ ...valid(), idempotencyKey: randomUUID() });
  expect(knowledgePayloadHash('CREATE', a)).toBe(knowledgePayloadHash('CREATE', b));
  const reordered = parseCreateDocument({ ...valid(), sourceUrls: [...a.sourceUrls].reverse() });
  expect(knowledgePayloadHash('CREATE', reordered)).not.toBe(knowledgePayloadHash('CREATE', a));
});

it('preserves the measured pre-upgrade hash and original legacy payload', async () => {
  const { parseCreateDocumentRequest, normalizeCreateDocument } =
    await import('../../functions/src/knowledge/schemas.js');
  const old = parseCreateDocumentRequest(valid());
  const snapshot = structuredClone(old);
  expect(knowledgePayloadHash('CREATE', old)).toBe(
    '2b15679262e07f5ed045cc25add21686fd8e6ca4cc70a1643b8de52311b192d1',
  );
  expect(normalizeCreateDocument(old)).toMatchObject({ kind: 'procedure', origin: 'synthetic' });
  expect(old).toEqual(snapshot);
});
it('accepts all twelve independent metadata combinations and validates public provenance', async () => {
  const { parseCreateDocumentRequest } = await import('../../functions/src/knowledge/schemas.js');
  const { sourceType: _legacy, ...base } = valid();
  for (const kind of ['procedure', 'policy', 'product-card', 'product-catalog']) {
    for (const origin of ['synthetic', 'official', 'public-compilation']) {
      const request = { ...base, kind, origin, observedOn: '2026-10-27' };
      expect(parseCreateDocumentRequest(request)).toMatchObject({ kind, origin });
      if (origin === 'public-compilation') {
        for (const invalid of [
          { sourceUrls: [] },
          { observedOn: null },
          { observedOn: '2026-02-30' },
          { sourceUrls: ['ftp://example.invalid/a'] },
        ])
          expect(() => parseCreateDocumentRequest({ ...request, ...invalid })).toThrow();
      }
    }
  }
});
it('rejects partial, unknown, mixed and client-authority metadata requests', async () => {
  const { parseCreateDocumentRequest } = await import('../../functions/src/knowledge/schemas.js');
  const { sourceType: _legacy, ...base } = valid();
  for (const extra of [
    { kind: 'policy' },
    { origin: 'official' },
    { kind: 'alien', origin: 'official' },
    { kind: 'policy', origin: 'alien' },
    { kind: 'policy', origin: 'official', sourceType: 'synthetic-procedure' },
    { kind: 'policy', origin: 'official', synthetic: false },
    { kind: 'policy', origin: 'official', businessId: 'foreign' },
  ])
    expect(() => parseCreateDocumentRequest({ ...base, ...extra })).toThrow();
});
it('separates V2 hashes by kind and origin without changing legacy retry semantics', async () => {
  const { parseCreateDocumentRequest } = await import('../../functions/src/knowledge/schemas.js');
  const { sourceType: _legacy, ...base } = valid();
  const hash = (kind: string, origin: string) =>
    knowledgePayloadHash('CREATE', parseCreateDocumentRequest({ ...base, kind, origin }));
  expect(hash('policy', 'official')).not.toBe(hash('procedure', 'official'));
  expect(hash('policy', 'official')).not.toBe(hash('policy', 'synthetic'));
  expect(
    parseCreateDocumentRequest({
      ...valid(),
      sourceType: 'public-product-summary',
      sourceUrls: [],
      observedOn: null,
    }),
  ).toMatchObject({ sourceType: 'public-product-summary' });
});
