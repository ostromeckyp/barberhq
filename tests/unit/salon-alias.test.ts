import { describe, expect, it, vi } from 'vitest';
import { createAiBudget, type AiBudget } from '../../functions/src/ai/budget.ts';
import { createReplenishmentPreparer } from '../../functions/src/ai/replenishment.ts';
import { parsePrepareInput } from '../../functions/src/ai/schemas.ts';
import type { ReplenishmentContext } from '../../functions/src/ai/replenishment-tools.ts';
import type { ShorthandCommands } from '../../functions/src/ai/salon-alias-commands.ts';

const salonActor = { uid: 'staff', businessId: 'b', role: 'SALON' as const, salonIds: ['salon'] };
const hqActor = { uid: 'hq', businessId: 'b', role: 'HQ' as const, salonIds: [] };
const product = (productId: string, productName: string) => ({
  productId,
  productName,
  sourceCode: productId,
  type: null,
  category: 'c',
  summaryEn: '',
  scentPl: null,
  keywords: [],
  hqAvailable: 9,
  salonOnHand: 1,
  hqInventoryVersion: 1,
  salonInventoryVersion: 1,
  activeRequestId: null,
});
const context = (): ReplenishmentContext => ({
  products: [product('a', 'Alfa'), product('b', 'Beta')],
  aliases: [],
  catalogRevision: 4,
  salonAliasRevision: 2,
});
/** Deterministic extraction: "N phrase" items separated by commas. */
function items(message: string) {
  return message.split(', ').map((originalWording) => {
    const [n, ...rest] = originalWording.split(' ');
    return { originalWording, productQuery: rest.join(' '), quantity: Number(n) };
  });
}
function setup(
  actor: typeof salonActor | typeof hqActor = salonActor,
  overrides: Partial<ShorthandCommands> = {},
) {
  let budget: AiBudget | undefined;
  const shorthand = {
    issue: vi.fn(
      async (_a: unknown, _i: unknown, choices: { lineId: string }[]) =>
        new Map(choices.map((c) => [c.lineId, `receipt-${c.lineId}`])),
    ),
    confirm: vi.fn(async (_a: unknown, _i: unknown, choices: { lineId: string }[]) =>
      choices.map((c) => ({ lineId: c.lineId, status: 'LEARNED' as const })),
    ),
    ...overrides,
  } as ShorthandCommands;
  const generate = vi.fn(
    async (
      b: AiBudget,
      input: { message: string },
      tools: { calculateProposal: (i: unknown) => Promise<unknown> },
    ) => {
      budget = b;
      await tools.calculateProposal(items(input.message));
      return { items: items(input.message) };
    },
  );
  const prepare = createReplenishmentPreparer({
    resolveActor: async () => actor,
    admitAiCall: async () => createAiBudget(Date.now()),
    repository: { readContext: async () => context() },
    generate: generate as never,
    shorthand,
  });
  return { prepare, shorthand, generate, budget: () => budget! };
}

describe('salon shorthand learning orchestration', () => {
  it('issues one batch of receipts for final product clarifications only', async () => {
    const s = setup();
    const result = await s.prepare('staff', { salonId: 'salon', message: '2 Alfa, 3 coś' });
    expect(result.lines[0]).toMatchObject({ status: 'READY', productId: 'a' });
    expect(result.lines[1]).toMatchObject({
      status: 'NEEDS_CLARIFICATION',
      lineId: 'line-8-13',
      choiceReceiptId: 'receipt-line-8-13',
    });
    expect(s.shorthand.issue).toHaveBeenCalledTimes(1);
    expect(vi.mocked(s.shorthand.issue).mock.calls[0][2]).toEqual([
      { lineId: 'line-8-13', productQuery: 'coś', allowedProductIds: ['a', 'b'] },
    ]);
    expect(s.shorthand.confirm).not.toHaveBeenCalled();
    expect(result.shorthandLearning).toBeUndefined();
    expect(s.generate).toHaveBeenCalledTimes(1);
    expect(s.budget().toolCallsRemaining).toBeGreaterThanOrEqual(0);
    expect(s.budget().modelTurnsRemaining).toBe(5);
  });
  it('confirms only explicit validated choices, once, after final validation', async () => {
    const s = setup();
    const result = await s.prepare('staff', {
      salonId: 'salon',
      message: '2 Alfa, 3 coś, 0 inne',
      clarifications: [
        { lineId: 'line-8-13', originalWording: '3 coś', productId: 'b', choiceReceiptId: 'r1' },
        { lineId: 'line-15-21', originalWording: '0 inne', productId: 'a', choiceReceiptId: 'r2' },
      ],
    } as never);
    expect(result.lines.map((l) => l.status)).toEqual(['READY', 'READY', 'NEEDS_CLARIFICATION']);
    expect(result.lines[2]).toMatchObject({ choiceReceiptId: 'r2' });
    expect(s.shorthand.confirm).toHaveBeenCalledTimes(1);
    expect(vi.mocked(s.shorthand.confirm).mock.calls[0][2]).toEqual([
      { lineId: 'line-8-13', productId: 'b', choiceReceiptId: 'r1' },
    ]);
    expect(result.shorthandLearning).toEqual([{ lineId: 'line-8-13', status: 'LEARNED' }]);
  });
  it('keeps a valid draft and reports NOT_SAVED when learning fails', async () => {
    const s = setup(salonActor, {
      confirm: vi.fn(async () => {
        throw new Error('unknown outcome');
      }),
    });
    const result = await s.prepare('staff', {
      salonId: 'salon',
      message: '3 coś',
      clarifications: [
        { lineId: 'line-0-5', originalWording: '3 coś', productId: 'b', choiceReceiptId: 'r1' },
      ],
    });
    expect(result.lines[0]).toMatchObject({ status: 'READY', productId: 'b', quantity: 3 });
    expect(result.shorthandLearning).toEqual([
      { lineId: 'line-0-5', status: 'NOT_SAVED', reason: 'UNAVAILABLE' },
    ]);
  });
  it('reports NO_RECEIPT for an explicit salon choice without a receipt', async () => {
    const s = setup();
    const result = await s.prepare('staff', {
      salonId: 'salon',
      message: '3 coś',
      clarifications: [{ lineId: 'line-0-5', originalWording: '3 coś', productId: 'b' }],
    });
    expect(result.lines[0]).toMatchObject({ status: 'READY' });
    expect(s.shorthand.confirm).not.toHaveBeenCalled();
    expect(result.shorthandLearning).toEqual([
      { lineId: 'line-0-5', status: 'NOT_SAVED', reason: 'NO_RECEIPT' },
    ]);
  });
  it('issues and learns for HQ acting for the salon', async () => {
    const s = setup(hqActor);
    const first = await s.prepare('hq', { salonId: 'salon', message: '3 coś' });
    expect(first.lines[0]).toMatchObject({ choiceReceiptId: 'receipt-line-0-5' });
    const second = await s.prepare('hq', {
      salonId: 'salon',
      message: '3 coś',
      clarifications: [
        { lineId: 'line-0-5', originalWording: '3 coś', productId: 'b', choiceReceiptId: 'r' },
      ],
    });
    expect(second.lines[0]).toMatchObject({ status: 'READY' });
    expect(s.shorthand.confirm).toHaveBeenCalledTimes(1);
    expect(second.shorthandLearning).toEqual([{ lineId: 'line-0-5', status: 'LEARNED' }]);
  });
  it('issues no receipt for a product phrase longer than 120 characters', async () => {
    const s = setup();
    const long = `1 ${'x'.repeat(121)}`;
    const result = await s.prepare('staff', { salonId: 'salon', message: long });
    expect(result.lines[0]).toMatchObject({ status: 'NEEDS_CLARIFICATION' });
    expect(result.lines[0]).not.toHaveProperty('choiceReceiptId');
    expect(s.shorthand.issue).not.toHaveBeenCalled();
  });
  it('keeps clarifications usable when receipt issuance fails', async () => {
    const s = setup(salonActor, { issue: vi.fn(async () => Promise.reject(new Error('down'))) });
    const result = await s.prepare('staff', { salonId: 'salon', message: '3 coś' });
    expect(result.lines[0]).toMatchObject({ status: 'NEEDS_CLARIFICATION' });
    expect(result.lines[0]).not.toHaveProperty('choiceReceiptId');
  });
});

describe('prepare input', () => {
  it('accepts an opaque receipt identity but never a client productQuery', () => {
    const base = { lineId: 'line-0-5', originalWording: '3 coś', productId: 'b' };
    expect(
      parsePrepareInput({
        salonId: 's',
        message: '3 coś',
        clarifications: [{ ...base, choiceReceiptId: '0f8fad5b-d9cb-469f-a165-70867728950e' }],
      }).clarifications![0].choiceReceiptId,
    ).toBe('0f8fad5b-d9cb-469f-a165-70867728950e');
    expect(() =>
      parsePrepareInput({
        salonId: 's',
        message: '3 coś',
        clarifications: [{ ...base, productQuery: 'coś' }],
      }),
    ).toThrow();
    expect(() =>
      parsePrepareInput({
        salonId: 's',
        message: '3 coś',
        clarifications: [{ ...base, choiceReceiptId: 'x'.repeat(65) }],
      }),
    ).toThrow();
  });
});

describe('removeSalonShorthand input', () => {
  it('requires salon, alias, expected revision and a UUID key, and nothing else', async () => {
    const { parseRemoveShorthandInput } =
      await import('../../functions/src/ai/salon-alias-callables.ts');
    const ok = {
      salonId: 's',
      aliasId: 'salon:x',
      expectedRevision: 1,
      idempotencyKey: '0f8fad5b-d9cb-469f-a165-70867728950e',
    };
    expect(parseRemoveShorthandInput(ok)).toEqual(ok);
    for (const bad of [
      { ...ok, idempotencyKey: 'k' },
      { ...ok, expectedRevision: 0 },
      { ...ok, productId: 'p' },
      { salonId: 's', aliasId: 'a', expectedRevision: 1 },
    ])
      expect(() => parseRemoveShorthandInput(bad)).toThrow();
  });
});
