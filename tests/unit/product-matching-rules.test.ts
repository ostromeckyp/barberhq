import { describe, expect, it } from 'vitest';
import { applyMatches } from '../../functions/src/ai/product-matching-rules.ts';
import type { MatchLine } from '../../functions/src/ai/models/match-line.ts';
import type { MatchRequest } from '../../functions/src/ai/models/match-request.ts';
import type { MatchResult } from '../../functions/src/ai/models/match-result.ts';

const card = (productId: string, name: string) => ({
  productId,
  name,
  type: '',
  category: 'c',
  keywords: [],
  aliases: [],
  salonShorthand: [],
});
const catalog: MatchRequest['catalog'] = [
  card('a', 'Alfa'),
  card('b', 'Beta'),
  card('c', 'Gamma'),
  card('d', 'Delta'),
];
const line = (overrides: Partial<MatchLine> = {}): MatchLine => ({
  lineId: 'line-0-7',
  originalWording: '2 Betta',
  productQuery: 'Betta',
  tier: 'NONE',
  candidateIds: ['a', 'b', 'c', 'd'],
  quantity: 2,
  ...overrides,
});
const result = (overrides: Partial<MatchResult['lines'][number]> = {}): MatchResult => ({
  lines: [
    {
      lineId: 'line-0-7',
      productIds: ['b'],
      confidence: 'HIGH',
      reason: 'Sounds like Beta.',
      ...overrides,
    },
  ],
});
const ids = (applied: ReturnType<typeof applyMatches>) =>
  applied[0].candidates.map((c) => `${c.productId}${c.suggested ? '*' : ''}`);

describe('applyMatches', () => {
  it('auto-matches one HIGH product with a quantity on a NONE line', () => {
    const applied = applyMatches([line()], result(), catalog);
    expect(applied).toEqual([
      {
        lineId: 'line-0-7',
        outcome: 'READY',
        reason: 'Sounds like Beta.',
        candidates: [
          { productId: 'b', productName: 'Beta', suggested: true, reason: 'Sounds like Beta.' },
          { productId: 'a', productName: 'Alfa' },
          { productId: 'c', productName: 'Gamma' },
          { productId: 'd', productName: 'Delta' },
        ],
      },
    ]);
  });
  it('auto-matches on a CONTAINS line, even outside the deterministic candidates', () => {
    const applied = applyMatches(
      [line({ tier: 'CONTAINS', candidateIds: ['a', 'c'] })],
      result(),
      catalog,
    );
    expect(applied[0].outcome).toBe('READY');
    expect(ids(applied)).toEqual(['b*', 'a', 'c']);
  });
  it('drops ids outside the catalog before counting', () => {
    const applied = applyMatches([line()], result({ productIds: ['ghost', 'b'] }), catalog);
    expect(applied[0].outcome).toBe('READY');
    expect(applied[0].candidates.map((c) => c.productId)).not.toContain('ghost');
  });
  it('drops results for lines that were not requested', () => {
    expect(applyMatches([line()], result({ lineId: 'line-9-12' }), catalog)).toEqual([]);
  });
  it('asks for the quantity when HIGH has none, AI product first', () => {
    for (const quantity of [null, 0, 120]) {
      const applied = applyMatches([line({ quantity })], result(), catalog);
      expect(applied[0].outcome).toBe('ENTER_QUANTITY');
      expect(ids(applied)).toEqual(['b*', 'a', 'c', 'd']);
    }
  });
  it('keeps an ambiguous exact TYPE line a choice even when HIGH, AI order first', () => {
    const applied = applyMatches(
      [line({ tier: 'TYPE', candidateIds: ['a', 'b', 'c'] })],
      result(),
      catalog,
    );
    expect(applied[0].outcome).toBe('CHOOSE_PRODUCT');
    expect(ids(applied)).toEqual(['b*', 'a', 'c']);
  });
  it('keeps LOW and several HIGH ids a choice', () => {
    expect(applyMatches([line()], result({ confidence: 'LOW' }), catalog)[0].outcome).toBe(
      'CHOOSE_PRODUCT',
    );
    expect(applyMatches([line()], result({ productIds: ['b', 'c'] }), catalog)[0].outcome).toBe(
      'CHOOSE_PRODUCT',
    );
  });
  it('removes duplicates and suggests at most three products', () => {
    expect(ids(applyMatches([line()], result({ productIds: ['c', 'c', 'b'] }), catalog))).toEqual([
      'c*',
      'b*',
      'a',
      'd',
    ]);
    expect(
      ids(applyMatches([line()], result({ productIds: ['d', 'c', 'b', 'a'] }), catalog)),
    ).toEqual(['d*', 'c*', 'b*', 'a']);
  });
  it('leaves a line as today when the model returns no valid product', () => {
    expect(applyMatches([line()], result({ productIds: [] }), catalog)).toEqual([]);
    expect(applyMatches([line()], result({ productIds: ['ghost'] }), catalog)).toEqual([]);
  });
  it('truncates the reason to 120 characters and uses the first result per line', () => {
    const long = 'x'.repeat(200);
    const applied = applyMatches(
      [line()],
      {
        lines: [
          { lineId: 'line-0-7', productIds: ['b'], confidence: 'HIGH', reason: long },
          { lineId: 'line-0-7', productIds: ['c'], confidence: 'HIGH', reason: 'second' },
        ],
      },
      catalog,
    );
    expect(applied).toHaveLength(1);
    expect(applied[0].reason).toHaveLength(120);
    expect(applied[0].candidates[0]).toMatchObject({ productId: 'b', reason: 'x'.repeat(120) });
  });
});
