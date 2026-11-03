import { describe, expect, it, vi } from 'vitest';
import { AiError, consumeModelTurn, createAiBudget } from '../../functions/src/ai/budget.ts';
import { createReplenishmentPreparer } from '../../functions/src/ai/replenishment.ts';
import { productMatchingReserveMs } from '../../functions/src/ai/product-matching.ts';
import { parsePrepareInput } from '../../functions/src/ai/schemas.ts';
import type { AiBudget } from '../../functions/src/ai/models/ai-budget.ts';
import type { ReplenishmentContext } from '../../functions/src/ai/models/replenishment-context.ts';
import type { ReplenishmentDependencies } from '../../functions/src/ai/models/replenishment-dependencies.ts';
import type { MatchRequest } from '../../functions/src/ai/models/match-request.ts';
import type { ShorthandCommands } from '../../functions/src/ai/models/shorthand-commands.ts';
import type { ProposalResult } from '../../shared/contracts/ai/index.ts';

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

describe('AI product matching in prepare', () => {
  const product = (
    productId: string,
    productName: string,
    activeRequestId: string | null = null,
  ) => ({
    ...context.products[0],
    productId,
    productName,
    sourceCode: productId,
    activeRequestId,
  });
  const shorthandRow = (salonId: string, phrase: string) => ({
    id: `${salonId}/${phrase}`,
    productId: 'b',
    phrase,
    normalized: phrase,
    kind: 'NAME' as const,
    source: 'SALON_CONFIRMED' as const,
    salonId,
    sourceVersionId: null,
    ambiguous: false,
    revision: 1,
  });
  const matchContext = (): ReplenishmentContext => ({
    products: [product('a', 'Alfa'), product('b', 'Beta')],
    aliases: [
      { ...shorthandRow('salon', 'betka'), source: 'SEED', salonId: null, kind: 'PHONETIC' },
      shorthandRow('salon', 'nasza beta'),
      shorthandRow('other', 'cudza beta'),
    ],
    catalogRevision: 4,
    salonAliasRevision: 2,
  });
  /** Deterministic extraction: "N phrase" items separated by commas; "?" is a missing quantity. */
  const items = (message: string) =>
    message.split(', ').map((originalWording) => {
      const [n, ...rest] = originalWording.split(' ');
      return {
        originalWording,
        productQuery: rest.join(' '),
        quantity: n === '?' ? null : Number(n),
      };
    });
  function setup(
    options: { matcher?: ReplenishmentDependencies['matchProducts']; budget?: () => AiBudget } = {},
  ) {
    let budget: AiBudget | undefined;
    const log = vi.fn();
    const shorthand = {
      issue: vi.fn(
        async (_a: unknown, _i: unknown, choices: { lineId: string }[]) =>
          new Map(choices.map((c) => [c.lineId, `receipt-${c.lineId}`])),
      ),
      confirm: vi.fn(async (_a: unknown, _i: unknown, choices: { lineId: string }[]) =>
        choices.map((c) => ({ lineId: c.lineId, status: 'LEARNED' as const })),
      ),
    } as ShorthandCommands;
    const prepare = createReplenishmentPreparer({
      resolveActor: async () => actor,
      admitAiCall: async () => {
        budget = options.budget?.() ?? createAiBudget(Date.now());
        return budget;
      },
      repository: { readContext: async () => matchContext() },
      generate: async (_b, input) => ({ items: items(input.message) }),
      shorthand,
      log,
      ...(options.matcher ? { matchProducts: options.matcher } : {}),
    });
    return { prepare, shorthand, log, budget: () => budget! };
  }
  const stable = (result: ProposalResult) => ({
    ...result,
    toolEvents: result.toolEvents.map((e) => ({ ...e, durationMs: 0 })),
  });
  const high = (lineId: string, productIds = ['b']) => ({
    lines: [{ lineId, productIds, confidence: 'HIGH' as const, reason: 'Brzmi jak Beta.' }],
  });

  it('does not call the matcher when every line is resolved', async () => {
    const matcher = vi.fn(async () => high('line-0-6'));
    const s = setup({ matcher });
    const result = await s.prepare('staff', { salonId: 'salon', message: '2 Alfa' });
    expect(result.lines[0]).toMatchObject({ status: 'READY', productId: 'a' });
    expect(result.lines[0]).not.toHaveProperty('aiMatch');
    expect(matcher).not.toHaveBeenCalled();
  });
  it('sends unresolved lines, the salon catalog card and the language to the matcher', async () => {
    const matcher = vi.fn(async (b: AiBudget, _request: MatchRequest) => {
      consumeModelTurn(b);
      return { lines: [] };
    });
    const s = setup({ matcher });
    await s.prepare('staff', {
      salonId: 'salon',
      message: '2 Alfa, 3 Betta',
      language: 'pl',
    });
    expect(matcher).toHaveBeenCalledOnce();
    expect(matcher.mock.calls[0][1]).toEqual({
      language: 'pl',
      lines: [
        {
          lineId: 'line-8-15',
          originalWording: '3 Betta',
          productQuery: 'Betta',
          tier: 'NONE',
          candidateIds: ['a', 'b'],
        },
      ],
      catalog: [
        {
          productId: 'a',
          name: 'Alfa',
          type: '',
          category: 'c',
          keywords: [],
          aliases: [],
          salonShorthand: [],
        },
        {
          productId: 'b',
          name: 'Beta',
          type: '',
          category: 'c',
          keywords: [],
          aliases: ['betka'],
          salonShorthand: ['nasza beta'],
        },
      ],
    });
    // One model turn from the shared budget.
    expect(s.budget().modelTurnsRemaining).toBe(4);
    await s.prepare('staff', { salonId: 'salon', message: '3 Betta' });
    expect(matcher.mock.calls[1][1]).toMatchObject({ language: 'en' });
  });
  it('labels one HIGH match as an AI-matched READY line with a receipt, teaching nothing', async () => {
    const s = setup({ matcher: async () => high('line-0-7') });
    const result = await s.prepare('staff', { salonId: 'salon', message: '3 Betta' });
    expect(result.status).toBe('PROPOSAL');
    expect(result.lines).toEqual([
      expect.objectContaining({
        status: 'READY',
        lineId: 'line-0-7',
        productId: 'b',
        quantity: 3,
        origin: 'assistant',
        aiMatch: {
          originalWording: '3 Betta',
          reason: 'Brzmi jak Beta.',
          alternatives: [{ productId: 'a', productName: 'Alfa' }],
          choiceReceiptId: 'receipt-line-0-7',
        },
      }),
    ]);
    expect(vi.mocked(s.shorthand.issue).mock.calls[0][2]).toEqual([
      { lineId: 'line-0-7', productQuery: 'Betta', allowedProductIds: ['b', 'a'] },
    ]);
    expect(s.shorthand.confirm).not.toHaveBeenCalled();
    expect(result.shorthandLearning).toBeUndefined();
  });
  it('teaches shorthand when the user changes an AI-matched line', async () => {
    const matcher = vi.fn(async () => high('line-0-7'));
    const s = setup({ matcher });
    const result = await s.prepare('staff', {
      salonId: 'salon',
      message: '3 Betta',
      clarifications: [
        {
          lineId: 'line-0-7',
          originalWording: '3 Betta',
          productId: 'a',
          choiceReceiptId: 'receipt-line-0-7',
        },
      ],
    });
    expect(matcher).not.toHaveBeenCalled();
    expect(result.lines[0]).toMatchObject({ status: 'READY', productId: 'a', quantity: 3 });
    expect(result.lines[0]).not.toHaveProperty('aiMatch');
    expect(vi.mocked(s.shorthand.confirm).mock.calls[0][2]).toEqual([
      { lineId: 'line-0-7', productId: 'a', choiceReceiptId: 'receipt-line-0-7' },
    ]);
    expect(result.shorthandLearning).toEqual([{ lineId: 'line-0-7', status: 'LEARNED' }]);
  });
  it('puts AI suggestions first in clarifications and asks for a missing quantity', async () => {
    const s = setup({
      matcher: async () => ({
        lines: [
          { lineId: 'line-0-7', productIds: ['b'], confidence: 'LOW', reason: 'Może Beta.' },
          { lineId: 'line-9-16', productIds: ['b'], confidence: 'HIGH', reason: 'Beta.' },
        ],
      }),
    });
    const result = await s.prepare('staff', { salonId: 'salon', message: '3 Betta, ? Betta' });
    expect(result.status).toBe('NEEDS_CLARIFICATION');
    expect(result.lines).toEqual([
      expect.objectContaining({
        status: 'NEEDS_CLARIFICATION',
        lineId: 'line-0-7',
        reasonCode: 'CHOOSE_PRODUCT',
        quantity: 3,
        choiceReceiptId: 'receipt-line-0-7',
        candidates: [
          { productId: 'b', productName: 'Beta', suggested: true, reason: 'Może Beta.' },
          { productId: 'a', productName: 'Alfa' },
        ],
      }),
      expect.objectContaining({
        lineId: 'line-9-16',
        reasonCode: 'ENTER_QUANTITY',
        candidates: [
          { productId: 'b', productName: 'Beta', suggested: true, reason: 'Beta.' },
          { productId: 'a', productName: 'Alfa' },
        ],
      }),
    ]);
    expect(result.lines[1]).not.toHaveProperty('quantity');
  });
  it('never merges an AI match into another line of the same product', async () => {
    const s = setup({ matcher: async () => high('line-8-15') });
    const result = await s.prepare('staff', { salonId: 'salon', message: '2 Beta, 3 Betta' });
    expect(result.lines.map((l) => [l.lineId, l.status])).toEqual([
      ['line-0-6', 'READY'],
      ['line-8-15', 'NEEDS_CLARIFICATION'],
    ]);
    expect(result.lines[0]).toMatchObject({ quantity: 2 });
  });
  it('returns the result without matching when the matcher fails, logging the code only', async () => {
    const plain = await setup().prepare('staff', { salonId: 'salon', message: '2 Alfa, 3 Betta' });
    const s = setup({
      matcher: async () => {
        throw new AiError('PROVIDER_UNAVAILABLE');
      },
    });
    const failed = await s.prepare('staff', { salonId: 'salon', message: '2 Alfa, 3 Betta' });
    expect(stable(failed)).toEqual(stable(plain));
    expect(s.log).toHaveBeenCalledWith('replenishment.matchProducts.failed', {
      code: 'PROVIDER_UNAVAILABLE',
    });
  });
  it('returns the result without matching when the matcher outlives its deadline', async () => {
    const plain = await setup().prepare('staff', { salonId: 'salon', message: '3 Betta' });
    const s = setup({
      matcher: () => new Promise<never>(() => {}),
      // Leaves the matcher 150 ms before the reserve kept for receipts and learning.
      budget: () => createAiBudget(Date.now() - 25_000 + productMatchingReserveMs + 150),
    });
    const late = await s.prepare('staff', { salonId: 'salon', message: '3 Betta' });
    expect(stable(late)).toEqual(stable(plain));
    expect(late.lines[0]).toMatchObject({ choiceReceiptId: 'receipt-line-0-7' });
    expect(s.log).toHaveBeenCalledWith('replenishment.matchProducts.failed', { code: 'TIMEOUT' });
  });
  it('accepts an optional pl or en language in prepare input', () => {
    expect(parsePrepareInput({ salonId: 's', message: 'm', language: 'pl' }).language).toBe('pl');
    expect(() => parsePrepareInput({ salonId: 's', message: 'm', language: 'de' })).toThrow();
  });
});
