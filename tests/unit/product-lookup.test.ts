import { describe, expect, it } from 'vitest';
import { normalizeProduct } from '../../shared/product-normalization.ts';
import { lookupProducts, normalizeProductForMatch } from '../../functions/src/ai/product-lookup.ts';
import type { LookupAlias, LookupProduct } from '../../shared/contracts/product-lookup/index.ts';

function product(productId: string, productName: string, extra: Partial<LookupProduct> = {}) {
  return {
    productId,
    productName,
    sourceCode: `code-${productId}`,
    type: null,
    category: 'styling',
    summaryEn: '',
    scentPl: null,
    keywords: [],
    ...extra,
  } satisfies LookupProduct;
}
let aliasSeq = 0;
function alias(productId: string, phrase: string, extra: Partial<LookupAlias> = {}): LookupAlias {
  return {
    id: `alias-${++aliasSeq}`,
    productId,
    phrase,
    normalized: normalizeProduct(phrase),
    kind: 'NAME',
    source: 'SEED',
    salonId: null,
    sourceVersionId: null,
    ambiguous: false,
    revision: 1,
    ...extra,
  };
}
const ids = (r: ReturnType<typeof lookupProducts>) => r.candidates.map((c) => c.productId);

describe('normalizeProductForMatch', () => {
  it('keeps the persisted base normalization byte-compatible', () => {
    expect(normalizeProduct('ŁÓDŹ—A')).toBe('lodz a');
  });
  it.each([
    ['olejek', 'olejki'],
    ['olejek', 'olejków'],
    ['cement', 'cementy'],
    ['matowa', 'matowe'],
    ['matowa', 'matowej'],
    ['sól morska', 'soli morskiej'],
    ['dramat', 'dramaty'],
  ])('equates %s and %s', (a, b) => {
    expect(normalizeProductForMatch(a)).toBe(normalizeProductForMatch(b));
  });
  it('leaves digits and short words intact', () => {
    expect(normalizeProductForMatch('5905191055165')).toBe('5905191055165');
    expect(normalizeProductForMatch('do')).toBe('do');
    expect(normalizeProductForMatch('a')).toBe('a');
    expect(normalizeProductForMatch('!!!')).toBe('');
  });
});

describe('lookupProducts', () => {
  const salon = 'salon-a';
  const catalog = [
    product('p-mat', 'Pomada Matowa'),
    product('p-mattifier', 'Mattifier', { sourceCode: '5905191055165' }),
    product('p-oil', 'Olejek do brody Las', { type: 'olejek do brody' }),
    product('p-cement', 'Cement'),
  ];

  it('matches inflected names on both sides', () => {
    const r = lookupProducts('olejki do brody las', catalog, [], salon);
    expect(r).toMatchObject({ match: 'NAME', ambiguous: false });
    expect(ids(r)).toEqual(['p-oil']);
  });
  it('matches exact product codes with base normalization', () => {
    const r = lookupProducts('5905191055165', catalog, [], salon);
    expect(r.match).toBe('NAME');
    expect(ids(r)).toEqual(['p-mattifier']);
  });
  it('never matches a short word inside another token', () => {
    const r = lookupProducts('mat', catalog, [], salon);
    expect(r.match).toBe('NONE');
  });
  it('uses whole-token containment in both directions', () => {
    expect(ids(lookupProducts('cementy', catalog, [], salon))).toEqual(['p-cement']);
    const into = lookupProducts('2 cementy proszę', catalog, [], salon);
    expect(into.match).toBe('CONTAINS');
    expect(ids(into)).toEqual(['p-cement']);
    const from = lookupProducts('matowa', catalog, [], salon);
    expect(from.match).toBe('CONTAINS');
    expect(ids(from)).toEqual(['p-mat']);
  });
  it('resolves product type in the TYPE tier', () => {
    const r = lookupProducts('olejek do brody', catalog, [], salon);
    expect(r).toMatchObject({ match: 'TYPE', ambiguous: false });
    expect(r.candidates[0].via).toEqual({
      phrase: 'olejek do brody',
      kind: 'TYPE',
      source: 'CATALOG',
    });
  });
  it('lets the first nonempty tier win: SALON over NAME over PHONETIC over TYPE', () => {
    const aliases = [
      alias('p-cement', 'pasta', { kind: 'TYPE' }),
      alias('p-oil', 'pasta', { kind: 'PHONETIC' }),
      alias('p-mattifier', 'pasta', { kind: 'NAME' }),
      alias('p-mat', 'pasta', { source: 'SALON_CONFIRMED', salonId: salon }),
    ];
    expect(lookupProducts('pasta', catalog, aliases, salon)).toMatchObject({
      match: 'SALON',
      candidates: [{ productId: 'p-mat', via: { kind: 'NAME', source: 'SALON_CONFIRMED' } }],
    });
    expect(lookupProducts('pasta', catalog, aliases.slice(0, 3), salon)).toMatchObject({
      match: 'NAME',
      candidates: [{ productId: 'p-mattifier' }],
    });
    expect(lookupProducts('pasta', catalog, aliases.slice(0, 2), salon)).toMatchObject({
      match: 'PHONETIC',
      candidates: [{ productId: 'p-oil' }],
    });
    expect(lookupProducts('pasta', catalog, aliases.slice(0, 1), salon)).toMatchObject({
      match: 'TYPE',
      candidates: [{ productId: 'p-cement' }],
    });
  });
  it('ignores another salon shorthand and salon rows without a salon', () => {
    const aliases = [alias('p-mat', 'pasta', { source: 'SALON_CONFIRMED', salonId: 'salon-b' })];
    expect(lookupProducts('pasta', catalog, aliases, salon).match).toBe('NONE');
  });
  it('ignores aliases of products outside the scoped catalog', () => {
    expect(lookupProducts('pasta', catalog, [alias('foreign', 'pasta')], salon).match).toBe('NONE');
  });
  it('dedupes duplicate provenance for one product', () => {
    const aliases = [
      alias('p-cement', 'beton'),
      alias('p-cement', 'beton', { source: 'GENERATED', sourceVersionId: 'v1' }),
    ];
    const r = lookupProducts('beton', catalog, aliases, salon);
    expect(r).toMatchObject({ match: 'NAME', ambiguous: false });
    expect(ids(r)).toEqual(['p-cement']);
  });
  it('keeps a flagged alias ambiguous even with one product', () => {
    const r = lookupProducts(
      'beton',
      catalog,
      [alias('p-cement', 'beton', { ambiguous: true })],
      salon,
    );
    expect(r).toMatchObject({ match: 'NAME', ambiguous: true });
  });
  it('keeps one phrase for several products ambiguous, sorted by name then id', () => {
    const aliases = [alias('p-mattifier', 'matte'), alias('p-mat', 'matte')];
    const r = lookupProducts('matte', catalog, aliases, salon);
    expect(r).toMatchObject({ match: 'NAME', ambiguous: true });
    expect(ids(r)).toEqual(['p-mattifier', 'p-mat']);
  });
  it('treats a stem collision between products as ambiguous, not a choice', () => {
    const twins = [product('p-1', 'Dramat'), product('p-2', 'Dramaty')];
    const r = lookupProducts('dramatu', twins, [], salon);
    expect(r.ambiguous).toBe(true);
    expect(ids(r)).toEqual(['p-1', 'p-2']);
  });
  it('offers the whole catalog for unknown wording, with no evidence', () => {
    const r = lookupProducts('coś zupełnie innego', catalog, [], salon);
    expect(r.match).toBe('NONE');
    expect(r.ambiguous).toBe(true);
    expect(ids(r)).toEqual(['p-cement', 'p-mattifier', 'p-oil', 'p-mat']);
    expect(r.candidates.every((c) => c.via === null)).toBe(true);
  });
  it('returns NONE with no candidates for an empty catalog', () => {
    expect(lookupProducts('cement', [], [], salon)).toEqual({
      query: 'cement',
      match: 'NONE',
      ambiguous: false,
      candidates: [],
    });
  });
});
