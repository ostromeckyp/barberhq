import { expect, it, vi } from 'vitest';
import { createAiRuntime } from '../../functions/src/ai/runtime.ts';
import { createAiBudget } from '../../functions/src/ai/budget.ts';
import { createReplenishmentGenerator } from '../../functions/src/ai/replenishment-model.ts';
import { createReplenishmentTools } from '../../functions/src/ai/replenishment-tools.ts';

it('uses Flash-Lite by default while returning a verified proposal in one model turn', async () => {
  const ai = createAiRuntime({
    provider: 'vertex',
    projectId: 'notbad-6be95',
    location: 'eu',
    modelId: 'gemini-3.8-flash',
  });
  // Replace only the external inference boundary; run the real scoped read tools below.
  const generate = vi.spyOn(ai, 'generate').mockResolvedValue({
    toolRequests: [
      {
        toolRequest: {
          name: 'calculateProposal',
          input: {
            items: [{ originalWording: '2 Matowa', productQuery: 'Matowa', quantity: 2 }],
          },
        },
      },
    ],
  } as never);
  const input = { salonId: 'salon', message: '2 Matowa' },
    budget = createAiBudget(Date.now());
  const tools = createReplenishmentTools({
    actor: { uid: 'u', businessId: 'b', role: 'SALON', salonIds: ['salon'] },
    input,
    budget,
    repository: {
      readContext: async () => ({
        aliases: [],
        catalogRevision: 1,
        salonAliasRevision: 0,
        products: [
          {
            productId: 'matowa',
            productName: 'Matowa',
            type: null,
            category: 'c',
            summaryEn: '',
            scentPl: null,
            keywords: [],
            sourceCode: '123',
            hqAvailable: 18,
            salonOnHand: 2,
            hqInventoryVersion: 1,
            salonInventoryVersion: 1,
            activeRequestId: null,
          },
        ],
      }),
    },
  });
  const output = await createReplenishmentGenerator(ai)(budget, input, tools);
  expect(generate).toHaveBeenCalledOnce();
  expect(generate.mock.calls[0][0]).toMatchObject({
    model: { name: 'vertexai/gemini-3.5-flash-lite' },
    maxTurns: 1,
  });
  const result = await tools.calculateProposal(
    (output as { items: { originalWording: string; productQuery: string; quantity: number }[] })
      .items,
  );
  expect(result.lines).toMatchObject([
    { productId: 'matowa', quantity: 2, status: 'READY', hqAvailable: 18, salonOnHand: 2 },
  ]);
  expect(budget.modelTurnsRemaining).toBe(4);
});

it('executes the verified read tools after one model call without a redundant answer turn', async () => {
  const ai = createAiRuntime({
    provider: 'vertex',
    projectId: 'notbad-6be95',
    location: 'eu',
    modelId: 'gemini-3.8-flash',
  });
  let calls = 0;
  const model = ai.defineModel({ name: 'fixture/replenishment' }, async () => {
    calls++;
    return {
      message: {
        role: 'model',
        content: [
          {
            toolRequest: {
              name: 'calculateProposal',
              ref: 'proposal',
              input: {
                items: [{ originalWording: '2 Matowa', productQuery: 'Matowa', quantity: 2 }],
              },
            },
          },
        ],
      },
      finishReason: 'stop',
      usage: { inputTokens: 1, outputTokens: 1 },
    };
  });
  const input = { salonId: 'salon', message: '2 Matowa' },
    budget = createAiBudget(Date.now());
  const tools = createReplenishmentTools({
    actor: { uid: 'u', businessId: 'b', role: 'SALON', salonIds: ['salon'] },
    input,
    budget,
    repository: {
      readContext: async () => ({
        aliases: [],
        catalogRevision: 1,
        salonAliasRevision: 0,
        products: [
          {
            productId: 'matowa',
            productName: 'Matowa',
            type: null,
            category: 'c',
            summaryEn: '',
            scentPl: null,
            keywords: [],
            sourceCode: '123',
            hqAvailable: 18,
            salonOnHand: 2,
            hqInventoryVersion: 1,
            salonInventoryVersion: 1,
            activeRequestId: null,
          },
        ],
      }),
    },
  });
  const output = await createReplenishmentGenerator(ai, model)(budget, input, tools);
  expect(output).toEqual({
    items: [{ originalWording: '2 Matowa', productQuery: 'Matowa', quantity: 2 }],
  });
  expect(calls).toBe(1);
  expect(budget.modelTurnsRemaining).toBe(4);
  const result = await tools.calculateProposal(
    (output as { items: { originalWording: string; productQuery: string; quantity: number }[] })
      .items,
  );
  expect(result.toolEvents.map((e) => e.name)).toEqual([
    'findProduct',
    'getStockContext',
    'calculateProposal',
    'calculateProposal',
  ]);
});
