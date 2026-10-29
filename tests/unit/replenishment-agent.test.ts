import { expect, it } from 'vitest';
import { createAiBudget } from '../../functions/src/ai/budget.ts';
import { createReplenishmentPreparer } from '../../functions/src/ai/replenishment.ts';
import type { ReplenishmentContext } from '../../functions/src/ai/replenishment-tools.ts';

const noLearning = { issue: async () => new Map<string, string>(), confirm: async () => [] };
const actor = { uid: 'staff', businessId: 'business', role: 'SALON' as const, salonIds: ['salon'] };
const context: ReplenishmentContext = {
  aliases: [],
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
      hqInventoryVersion: 1,
      salonInventoryVersion: 1,
      activeRequestId: null,
    },
  ],
};
it('uses verified read tools and rebuilds final data after generation', async () => {
  let reads = 0;
  const prepare = createReplenishmentPreparer({
    shorthand: noLearning,
    resolveActor: async () => actor,
    admitAiCall: async () => createAiBudget(Date.now()),
    repository: {
      readContext: async () => {
        reads++;
        return {
          ...context,
          products: context.products.map((p) => ({ ...p, hqAvailable: reads > 3 ? 16 : 18 })),
        };
      },
    },
    generate: async (_budget, _input, tools) => {
      await tools.findProduct(['Matowa']);
      await tools.getStockContext(['matowa']);
      return { items: [{ originalWording: '2 Matowa', productQuery: 'Matowa', quantity: 2 }] };
    },
  });
  const result = await prepare('staff', { salonId: 'salon', message: '2 Matowa' });
  expect(result.lines[0]).toMatchObject({
    status: 'READY',
    productId: 'matowa',
    quantity: 2,
    hqAvailable: 16,
  });
  expect(result.toolEvents.map((e) => e.name)).toEqual([
    'findProduct',
    'getStockContext',
    'calculateProposal',
  ]);
});
it('denies foreign salon and malformed clarification before charging quota or invoking model', async () => {
  let admitted = 0,
    generations = 0;
  const prepare = createReplenishmentPreparer({
    shorthand: noLearning,
    resolveActor: async () => actor,
    admitAiCall: async () => {
      admitted++;
      return createAiBudget(Date.now());
    },
    repository: { readContext: async () => context },
    generate: async () => {
      generations++;
      return { items: [] };
    },
  });
  await expect(prepare('staff', { salonId: 'foreign', message: '2 Matowa' })).rejects.toMatchObject(
    { code: 'FORBIDDEN' },
  );
  await expect(
    prepare('staff', {
      salonId: 'salon',
      message: '2 Matowa',
      clarifications: [{ lineId: 'line-0-9', originalWording: 'other', productId: 'matowa' }],
    }),
  ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  expect([admitted, generations]).toEqual([0, 0]);
});
it('rejects invented products and stock fields in structured model output', async () => {
  const prepare = createReplenishmentPreparer({
    shorthand: noLearning,
    resolveActor: async () => actor,
    admitAiCall: async () => createAiBudget(Date.now()),
    repository: { readContext: async () => context },
    generate: async () => ({
      items: [
        { originalWording: '2 Matowa', productQuery: 'Matowa', quantity: 2, hqAvailable: 999 },
      ],
    }),
  });
  await expect(prepare('staff', { salonId: 'salon', message: '2 Matowa' })).rejects.toMatchObject({
    code: 'INVALID_MODEL_OUTPUT',
  });
});
