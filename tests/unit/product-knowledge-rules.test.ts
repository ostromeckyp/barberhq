import { describe, expect, it } from 'vitest';
import { normalizeProduct } from '../../shared/product-normalization.ts';
import type {
  KnowledgeProductReview,
  KnowledgeCatalogProduct,
  AliasProposal,
  ActiveProductAlias,
} from '../../shared/contracts/product-knowledge/index.ts';
import {
  resolveKnowledgePassage,
  suggestProductCodeLinks,
  calculateAliasImpact,
  productKnowledgeHash,
  validateProductLinks,
} from '../../functions/src/product-knowledge/rules.ts';
import {
  parseSaveKnowledgeProductReview,
  parseProductAliasGeneration,
} from '../../functions/src/product-knowledge/schemas.ts';

const passage = { chunkId: 'v:1:0', start: 0, end: 5 };
const chunks = [
  { id: 'v:1:0', text: 'Alpha 😀 Beta', physicalPage: 1 },
  { id: 'v:2:0', text: 'Alpha', physicalPage: 2 },
];
const product = (id: string, sourceCode: string): KnowledgeCatalogProduct => ({
  id,
  name: `Product ${id}`,
  sourceCode,
  type: null,
  category: 'X',
  summaryEn: 'Facts',
  scentPl: null,
});
const alias = (
  productId: string,
  phrase: string,
  kind: AliasProposal['kind'] = 'name',
  decision: AliasProposal['decision'] = 'accepted',
): AliasProposal => ({
  id: `${productId}-${phrase}`,
  productId,
  phrase,
  kind,
  lang: 'pl',
  source: 'hq',
  decision,
});
const active = (
  productId: string,
  normalized: string,
  kind: ActiveProductAlias['kind'] = 'name',
): ActiveProductAlias => ({ productId, normalized, kind, lang: 'pl', sourceVersionId: 'old' });
function review(): KnowledgeProductReview {
  return {
    versionId: 'v',
    extractionHash: 'a'.repeat(64),
    revision: 1,
    catalogRevision: 2,
    links: [{ id: 'l', passage, productId: 'a', method: 'hq', confirmed: true }],
    profiles: [{ productId: 'a', type: 'type X', aliases: [alias('a', 'Alpha')] }],
    unlinkedPassages: [{ chunkId: 'v:2:0', start: 0, end: 5 }],
    impact: [],
    reviewedHash: null,
    acknowledgedUnlinkedPassages: [{ chunkId: 'v:2:0', start: 0, end: 5 }],
    emptyKnowledgeAcknowledged: false,
  };
}

describe('product knowledge source and review rules', () => {
  it('keeps base normalization compatible without suffix stripping', () => {
    expect(normalizeProduct('ŁÓDŹ—A')).toBe('lodz a');
    expect(normalizeProduct('matowe')).toBe('matowe');
  });
  it('binds repeated headings to the exact physical chunk and range', () => {
    expect(resolveKnowledgePassage(passage, chunks)).toEqual({ text: 'Alpha', physicalPage: 1 });
    expect(resolveKnowledgePassage({ ...passage, chunkId: 'v:2:0' }, chunks)).toEqual({
      text: 'Alpha',
      physicalPage: 2,
    });
  });
  it.each([
    { ...passage, end: 0 },
    { ...passage, start: -1 },
    { ...passage, end: 99 },
    { ...passage, start: 7, end: 8 },
    { ...passage, end: 6.5 },
    { ...passage, chunkId: 'foreign' },
  ])('rejects invalid/foreign/split-surrogate passage %j', (ref) => {
    expect(() => resolveKnowledgePassage(ref, chunks)).toThrow();
  });
  it('rejects conflicting overlap while allowing disjoint product facts in one chunk', () => {
    expect(() =>
      validateProductLinks(
        [
          { id: 'a', passage, productId: 'a', method: 'hq', confirmed: true },
          {
            id: 'b',
            passage: { ...passage, start: 3, end: 8 },
            productId: 'b',
            method: 'hq',
            confirmed: true,
          },
        ],
        chunks,
      ),
    ).toThrow();
    expect(() =>
      validateProductLinks(
        [
          { id: 'a', passage, productId: 'a', method: 'hq', confirmed: true },
          {
            id: 'b',
            passage: { ...passage, start: 9, end: 13 },
            productId: 'b',
            method: 'hq',
            confirmed: true,
          },
        ],
        chunks,
      ),
    ).not.toThrow();
  });
  it('matches complete codes only and leaves multiple identities unresolved', () => {
    const p = [product('a', '123'), product('b', '456')];
    expect(
      suggestProductCodeLinks([{ ref: passage, text: 'Code 123', physicalPage: 1 }], p),
    ).toEqual([{ passage, productIds: ['a'], method: 'code', confirmed: false }]);
    expect(suggestProductCodeLinks([{ ref: passage, text: '1234', physicalPage: 1 }], p)).toEqual(
      [],
    );
    expect(
      suggestProductCodeLinks([{ ref: passage, text: '123 456', physicalPage: 1 }], p)[0]
        .productIds,
    ).toEqual(['a', 'b']);
    expect(
      suggestProductCodeLinks(
        [{ ref: passage, text: '123', physicalPage: 1 }],
        [...p, product('c', '123')],
      )[0].productIds,
    ).toEqual(['a', 'c']);
  });
  it('deduplicates provenance per product and exposes distinct name/type collisions', () => {
    expect(
      calculateAliasImpact(
        [alias('a', 'ALPHA'), alias('b', 'Alpha')],
        [active('a', 'alpha'), active('a', 'alpha')],
      ),
    ).toEqual([
      {
        normalized: 'alpha',
        beforeProductIds: ['a'],
        afterProductIds: ['a', 'b'],
        collision: true,
      },
    ]);
    expect(
      calculateAliasImpact([alias('b', 'type X', 'type')], [active('a', 'type x', 'type')])[0],
    ).toMatchObject({ afterProductIds: ['a', 'b'], collision: true });
    expect(
      calculateAliasImpact([alias('b', 'Alpha', 'name', 'rejected')], [active('a', 'alpha')]),
    ).toEqual([]);
  });
  it('hashes review meaning and ignores ordering, transport and derived projections', () => {
    const r = review();
    const h = productKnowledgeHash(r);
    expect(h).toMatch(/^[a-f0-9]{64}$/);
    expect(
      productKnowledgeHash({
        ...r,
        reviewedHash: h,
        impact: [{ normalized: 'x', beforeProductIds: [], afterProductIds: [], collision: false }],
        ...{ idempotencyKey: 'transport', updatedAt: 'now' },
      }),
    ).toBe(h);
    const many = {
      ...r,
      profiles: [...r.profiles, { productId: 'b', type: null, aliases: [alias('b', 'Beta')] }],
    };
    expect(productKnowledgeHash({ ...many, profiles: [...many.profiles].reverse() })).toBe(
      productKnowledgeHash(many),
    );
    for (const change of [
      { versionId: 'v2' },
      { extractionHash: 'b'.repeat(64) },
      { revision: 2 },
      { catalogRevision: 3 },
      { links: [{ ...r.links[0], passage: { ...passage, end: 4 } }] },
      { profiles: [{ ...r.profiles[0], type: null }] },
      { profiles: [{ ...r.profiles[0], aliases: [alias('a', 'Alpha', 'name', 'rejected')] }] },
      { acknowledgedUnlinkedPassages: [] },
      { emptyKnowledgeAcknowledged: true },
    ])
      expect(productKnowledgeHash({ ...r, ...change })).not.toBe(h);
  });
});
const save = () => ({
  versionId: 'v',
  extractionHash: 'a'.repeat(64),
  expectedReviewRevision: 0,
  idempotencyKey: '11111111-1111-4111-8111-111111111111',
  links: [{ passage, productId: 'a', confirmed: true }],
  profiles: [
    {
      productId: 'a',
      type: null,
      aliases: [{ phrase: 'Alpha', kind: 'name', lang: 'pl', decision: 'pending' }],
    },
  ],
  acknowledgedUnlinkedPassages: [],
  emptyKnowledgeAcknowledged: false,
});
describe('strict product review boundaries', () => {
  it('accepts a full manual snapshot and rejects forged authority', () => {
    expect(parseSaveKnowledgeProductReview(save())).toEqual(save());
    for (const extra of [
      { businessId: 'foreign' },
      { normalized: 'forged' },
      { status: 'active' },
      { source: 'generated' },
    ])
      expect(() => parseSaveKnowledgeProductReview({ ...save(), ...extra })).toThrow();
    expect(() =>
      parseSaveKnowledgeProductReview({
        ...save(),
        links: [{ ...save().links[0], method: 'code' }],
      }),
    ).toThrow();
  });
  it('rejects duplicate identities, unsafe revisions, invalid enums and empty normalized values', () => {
    for (const revision of [-1, 1.5, Number.MAX_SAFE_INTEGER])
      expect(() =>
        parseSaveKnowledgeProductReview({ ...save(), expectedReviewRevision: revision }),
      ).toThrow();
    expect(() =>
      parseSaveKnowledgeProductReview({
        ...save(),
        profiles: [...save().profiles, ...save().profiles],
      }),
    ).toThrow();
    for (const bad of [
      { phrase: '😀' },
      { phrase: 'a'.repeat(121) },
      { lang: 'de' },
      { kind: 'NAME' },
      { decision: 'active' },
      { source: 'hq' },
    ])
      expect(() =>
        parseSaveKnowledgeProductReview({
          ...save(),
          profiles: [
            { ...save().profiles[0], aliases: [{ ...save().profiles[0].aliases[0], ...bad }] },
          ],
        }),
      ).toThrow();
  });
  it('bounds structured model output and rejects invented authority', () => {
    expect(
      parseProductAliasGeneration({
        type: null,
        aliases: [{ phrase: 'Alpha', kind: 'phonetic', lang: 'pl' }],
      }),
    ).toEqual({ type: null, aliases: [{ phrase: 'Alpha', kind: 'phonetic', lang: 'pl' }] });
    for (const bad of [
      { type: 'x'.repeat(81), aliases: [] },
      {
        type: null,
        aliases: Array.from({ length: 33 }, () => ({ phrase: 'x', kind: 'name', lang: 'pl' })),
      },
      { type: null, aliases: [], productId: 'foreign' },
    ])
      expect(() => parseProductAliasGeneration(bad)).toThrow();
  });
});
it('shows replacement impact without counting the superseded source as a surviving product', () => {
  expect(calculateAliasImpact([alias('b', 'Alpha')], [active('a', 'alpha')], ['old'])).toEqual([
    { normalized: 'alpha', beforeProductIds: ['a'], afterProductIds: ['b'], collision: false },
  ]);
});
