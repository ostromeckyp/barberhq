import { describe, expect, it } from 'vitest';
import { createAiBudget } from '../../functions/src/ai/budget.ts';
import {
  createReplenishmentTools,
  type ReplenishmentContext,
} from '../../functions/src/ai/replenishment-tools.ts';
import type { LookupAlias } from '../../shared/contracts/product-lookup.ts';

const actor = { uid: 'staff', businessId: 'business', role: 'SALON' as const, salonIds: ['salon'] };
const message = '2 Matowa, 3 Sól Morska, 1 Savage';
// Product words live in fixtures only; application logic never names products.
const alias = (productId: string, phrase: string, kind: LookupAlias['kind']): LookupAlias => ({
  id: `${productId}/${phrase}`,
  productId,
  phrase,
  normalized: phrase,
  kind,
  source: 'SEED',
  salonId: null,
  sourceVersionId: null,
  ambiguous: false,
  revision: 1,
});
function context(): ReplenishmentContext {
  return {
    aliases: [
      alias('matowa', 'matte', 'TYPE'),
      alias('dry', 'matte', 'TYPE'),
      alias('mattifier', 'matte', 'TYPE'),
      alias('sol', 'sea salt', 'NAME'),
      alias('dry', 'dry matt', 'NAME'),
    ],
    catalogRevision: 1,
    salonAliasRevision: 0,
    products: [
      {
        productId: 'matowa',
        productName: 'Pomada Matowa',
        type: null,
        category: 'c',
        summaryEn: '',
        scentPl: null,
        keywords: [],
        sourceCode: '5905191055165',
        hqAvailable: 18,
        salonOnHand: 2,
        hqInventoryVersion: 4,
        salonInventoryVersion: 3,
        activeRequestId: null,
      },
      {
        productId: 'sol',
        productName: 'Sól Morska',
        type: null,
        category: 'c',
        summaryEn: '',
        scentPl: null,
        keywords: [],
        sourceCode: '5905191055080',
        hqAvailable: 18,
        salonOnHand: 2,
        hqInventoryVersion: 1,
        salonInventoryVersion: 1,
        activeRequestId: null,
      },
      {
        productId: 'savage',
        productName: 'Olejek do brody | Savage',
        type: 'olejek do brody',
        category: 'c',
        summaryEn: '',
        scentPl: null,
        keywords: [],
        sourceCode: '5905191055974',
        hqAvailable: 18,
        salonOnHand: 2,
        hqInventoryVersion: 1,
        salonInventoryVersion: 1,
        activeRequestId: null,
      },
      {
        productId: 'dry',
        productName: 'Pomada Dry Matt',
        type: null,
        category: 'c',
        summaryEn: '',
        scentPl: null,
        keywords: [],
        sourceCode: '5905191055035',
        hqAvailable: 1,
        salonOnHand: 2,
        hqInventoryVersion: 2,
        salonInventoryVersion: 1,
        activeRequestId: null,
      },
      {
        productId: 'mattifier',
        productName: 'Mattifier',
        type: null,
        category: 'c',
        summaryEn: '',
        scentPl: null,
        keywords: [],
        sourceCode: '5905191055479',
        hqAvailable: 18,
        salonOnHand: 2,
        hqInventoryVersion: 1,
        salonInventoryVersion: 1,
        activeRequestId: null,
      },
    ],
  };
}
function tools(text = message, data = context()) {
  return createReplenishmentTools({
    actor,
    input: { salonId: 'salon', message: text },
    budget: createAiBudget(Date.now()),
    repository: { readContext: async () => structuredClone(data) },
  });
}
const requested = [
  { originalWording: '2 Matowa', productQuery: 'Matowa', quantity: 2 },
  { originalWording: '3 Sól Morska', productQuery: 'Sól Morska', quantity: 3 },
  { originalWording: '1 Savage', productQuery: 'Savage', quantity: 1 },
];
describe('verified replenishment tools', () => {
  it('resolves through tiers and offers the whole catalog for unknown wording', async () => {
    const found = await tools().findProduct([
      'ŁÓDŹ—A',
      'olejek do brody',
      'matowe',
      '5905191055165',
      'NBS-MATOWA-100',
    ]);
    expect(found.map((m) => [m.match, m.candidates.map((c) => c.productId)])).toEqual([
      ['NONE', ['mattifier', 'savage', 'dry', 'matowa', 'sol']],
      ['TYPE', ['savage']],
      ['CONTAINS', ['matowa']],
      ['NAME', ['matowa']],
      ['NONE', ['mattifier', 'savage', 'dry', 'matowa', 'sol']],
    ]);
  });
  it('makes a sole type match READY', async () => {
    const result = await tools('4 olejek do brody').calculateProposal([
      { originalWording: '4 olejek do brody', productQuery: 'olejek do brody', quantity: 4 },
    ]);
    expect(result.status).toBe('PROPOSAL');
    expect(result.lines[0]).toMatchObject({ status: 'READY', productId: 'savage', quantity: 4 });
  });
  it('keeps a flagged alias a clarification even for one product', async () => {
    const data = context();
    data.aliases.push({ ...alias('cement', 'beton', 'NAME'), productId: 'sol', ambiguous: true });
    const result = await tools('2 beton', data).calculateProposal([
      { originalWording: '2 beton', productQuery: 'beton', quantity: 2 },
    ]);
    expect(result.lines[0]).toMatchObject({
      status: 'NEEDS_CLARIFICATION',
      candidates: [{ productId: 'sol', productName: 'Sól Morska' }],
    });
  });
  it('offers every product of a catalog larger than six without choosing one', async () => {
    const data = context();
    for (let i = 0; i < 4; i++)
      data.products.push({
        ...data.products[0],
        productId: `extra-${i}`,
        productName: `Extra ${i}`,
        sourceCode: `x${i}`,
      });
    const result = await tools('2 szampon', data).calculateProposal([
      { originalWording: '2 szampon', productQuery: 'szampon', quantity: 2 },
    ]);
    expect(result.status).toBe('NEEDS_CLARIFICATION');
    expect(result.lines[0]).toMatchObject({ status: 'NEEDS_CLARIFICATION', quantity: 2 });
    if (result.lines[0].status === 'NEEDS_CLARIFICATION')
      expect(result.lines[0].candidates).toHaveLength(9);
  });
  it('returns UNAVAILABLE for an empty catalog instead of inventing candidates', async () => {
    const data = context();
    data.products = [];
    data.aliases = [];
    const result = await tools('2 szampon', data).calculateProposal([
      { originalWording: '2 szampon', productQuery: 'szampon', quantity: 2 },
    ]);
    expect(result).toMatchObject({ status: 'UNAVAILABLE', lines: [], excluded: [] });
  });
  it('reports only explicit validated choices and final product clarifications to the preparer', async () => {
    const text = '2 matte, 1 Savage, 3 szampon';
    const t = createReplenishmentTools({
      actor,
      input: {
        salonId: 'salon',
        message: text,
        clarifications: [
          {
            lineId: 'line-0-7',
            originalWording: '2 matte',
            productId: 'dry',
            choiceReceiptId: 'r-1',
          },
        ],
      },
      budget: createAiBudget(Date.now()),
      repository: { readContext: async () => context() },
    });
    const final = await t.finalProposal([
      { originalWording: '2 matte', productQuery: 'matte', quantity: 2 },
      { originalWording: '1 Savage', productQuery: 'Savage', quantity: 1 },
      { originalWording: '3 szampon', productQuery: 'szampon', quantity: 3 },
    ]);
    expect(final.result.lines.map((l) => l.status)).toEqual([
      'READY',
      'READY',
      'NEEDS_CLARIFICATION',
    ]);
    expect(final.choices).toEqual([
      { lineId: 'line-0-7', productId: 'dry', choiceReceiptId: 'r-1' },
    ]);
    expect(final.clarifications).toEqual([
      {
        lineId: 'line-19-28',
        productQuery: 'szampon',
        allowedProductIds: ['mattifier', 'savage', 'dry', 'matowa', 'sol'],
      },
    ]);
  });
  it('rebuilds three proposal lines from live stock rather than model numbers', async () => {
    const t = tools();
    const result = await t.calculateProposal(requested);
    expect(result.status).toBe('PROPOSAL');
    expect(
      result.lines.map((l) =>
        l.status === 'READY' ? [l.productId, l.quantity, l.hqAvailable, l.salonOnHand] : null,
      ),
    ).toEqual([
      ['matowa', 2, 18, 2],
      ['sol', 3, 18, 2],
      ['savage', 1, 18, 2],
    ]);
    expect(result.lines[0]).toMatchObject({
      origin: 'assistant',
      hqInventoryVersion: 4,
      salonInventoryVersion: 3,
    });
    expect(result.toolEvents.map((e) => e.name)).toContain('calculateProposal');
  });
  it('resolves exact codes and aliases but asks about generic matte products', async () => {
    const t = tools();
    expect(
      (await t.findProduct(['5905191055165', 'sea salt', 'matte'])).map((m) =>
        m.candidates.map((c) => c.productId),
      ),
    ).toEqual([['matowa'], ['sol'], ['mattifier', 'dry', 'matowa']]);
    const result = await tools('2 matte').calculateProposal([
      { originalWording: '2 matte', productQuery: 'matte', quantity: 2 },
    ]);
    expect(result.status).toBe('NEEDS_CLARIFICATION');
    expect(result.lines[0]).toMatchObject({
      status: 'NEEDS_CLARIFICATION',
      quantity: 2,
      candidates: expect.arrayContaining([{ productId: 'matowa', productName: 'Pomada Matowa' }]),
    });
  });
  it('retains unresolved products, invalid quantities and editable duplicate overflow', async () => {
    for (const quantity of [null, 0, -1, 1.5, 100]) {
      const result = await tools('Matowa').calculateProposal([
        { originalWording: 'Matowa', productQuery: 'Matowa', quantity },
      ]);
      expect(result.lines[0].status).toBe('NEEDS_CLARIFICATION');
    }
    const unknown = await tools('2 shampoo').calculateProposal([
      { originalWording: '2 shampoo', productQuery: 'shampoo', quantity: 2 },
    ]);
    expect(unknown.lines[0]).toMatchObject({ status: 'NEEDS_CLARIFICATION' });
    if (unknown.lines[0].status === 'NEEDS_CLARIFICATION')
      expect(unknown.lines[0].candidates.map((c) => c.productId)).toEqual([
        'mattifier',
        'savage',
        'dry',
        'matowa',
        'sol',
      ]);
    const overflow = await tools('50 Matowa and 50 Matowa').calculateProposal([
      { originalWording: '50 Matowa', productQuery: 'Matowa', quantity: 50 },
      { originalWording: '50 Matowa', productQuery: 'Matowa', quantity: 50 },
    ]);
    expect(overflow.lines).toHaveLength(1);
    expect(overflow.lines[0]).toMatchObject({ status: 'READY', quantity: 100 });
  });
  it('excludes active requests and preserves shortage as a proposal', async () => {
    const data = context();
    data.products[0].activeRequestId = 'existing';
    const active = await tools('2 Matowa', data).calculateProposal([requested[0]]);
    expect(active.lines).toEqual([]);
    expect(active.excluded[0]).toMatchObject({
      productId: 'matowa',
      requestId: 'existing',
      reason: 'ALREADY_ACTIVE',
    });
    const short = await tools('3 Dry Matt').calculateProposal([
      { originalWording: '3 Dry Matt', productQuery: 'Dry Matt', quantity: 3 },
    ]);
    expect(short.lines[0]).toMatchObject({ status: 'READY', quantity: 3, hqAvailable: 1 });
  });
  it('cannot select a product absent from the source wording or read another salon', async () => {
    await expect(
      tools('2 shampoo').calculateProposal([
        { originalWording: '2 shampoo', productQuery: 'Matowa', quantity: 2 },
      ]),
    ).rejects.toMatchObject({ code: 'INVALID_MODEL_OUTPUT' });
    const t = createReplenishmentTools({
      actor,
      input: { salonId: 'foreign', message: '2 Matowa' },
      budget: createAiBudget(Date.now()),
      repository: {
        readContext: async () => {
          throw Error('must not access repository');
        },
      },
    });
    await expect(t.findProduct(['Matowa'])).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
  it('binds clarification choices to the original message and resolves a line only once', async () => {
    const text = '2 matte and 1 Savage';
    const initial = await tools(text).calculateProposal([
      { originalWording: '2 matte', productQuery: 'matte', quantity: 2 },
      { originalWording: '1 Savage', productQuery: 'Savage', quantity: 1 },
    ]);
    const unresolved = initial.lines[0];
    if (unresolved.status !== 'NEEDS_CLARIFICATION') throw Error('expected clarification');
    const t = createReplenishmentTools({
      actor,
      input: {
        salonId: 'salon',
        message: text,
        clarifications: [
          {
            lineId: unresolved.lineId,
            originalWording: unresolved.originalWording,
            productId: 'matowa',
            quantity: 2,
          },
        ],
      },
      budget: createAiBudget(Date.now()),
      repository: { readContext: async () => context() },
    });
    const result = await t.calculateProposal([
      { originalWording: '2 matte', productQuery: 'matte', quantity: 2 },
      { originalWording: '1 Savage', productQuery: 'Savage', quantity: 1 },
    ]);
    expect(result.lines).toHaveLength(2);
    expect(result.lines[0]).toMatchObject({
      lineId: unresolved.lineId,
      status: 'READY',
      productId: 'matowa',
      quantity: 2,
    });
  });
  it('does not silently truncate more than six requested items', async () => {
    const text = Array.from({ length: 7 }, (_, i) => `${i + 1} Matowa`).join(', ');
    const result = await tools(text).calculateProposal(
      Array.from({ length: 7 }, (_, i) => ({
        originalWording: `${i + 1} Matowa`,
        productQuery: 'Matowa',
        quantity: i + 1,
      })),
    );
    expect(result.status).toBe('NEEDS_CLARIFICATION');
    expect(result.lines[0]).toMatchObject({ status: 'NEEDS_CLARIFICATION', originalWording: text });
  });
  it('preserves a second occurrence when only the first identical wording was clarified', async () => {
    const text = '2 matte and 2 matte';
    const t = createReplenishmentTools({
      actor,
      input: {
        salonId: 'salon',
        message: text,
        clarifications: [
          { lineId: 'line-0-7', originalWording: '2 matte', productId: 'matowa', quantity: 2 },
        ],
      },
      budget: createAiBudget(Date.now()),
      repository: { readContext: async () => context() },
    });
    const result = await t.calculateProposal([
      { originalWording: '2 matte', productQuery: 'matte', quantity: 2 },
      { originalWording: '2 matte', productQuery: 'matte', quantity: 2 },
    ]);
    expect(result.lines).toHaveLength(2);
    expect(result.lines[1]).toMatchObject({
      status: 'NEEDS_CLARIFICATION',
      originalWording: '2 matte',
    });
  });
});
