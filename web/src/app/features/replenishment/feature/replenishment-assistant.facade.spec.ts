import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { expect, it } from 'vitest';
import type { ProposalResult } from '../../../../../../shared/contracts/ai/index';
import { AssistantApi, AssistantApiError } from '../../../core/assistant-api';
import { SessionFacade } from '../../auth/feature/session.facade';
import { DraftStore } from './draft.store';
import { OrderFacade } from './order.facade';
import { ReplenishmentAssistantFacade } from './replenishment-assistant.facade';

const membership = {
  userId: 'user',
  businessId: 'business',
  role: 'SALON' as const,
  salonIds: ['salon'],
};
const line = (productId = 'matowa', quantity = 2) => ({
  status: 'READY' as const,
  lineId: 'line-0-8',
  productId,
  productName: productId,
  quantity,
  origin: 'assistant' as const,
  hqAvailable: 18,
  salonOnHand: 2,
  hqInventoryVersion: 1,
  salonInventoryVersion: 1,
});
const proposal = (lines: ProposalResult['lines'] = [line()]): ProposalResult => ({
  status: lines.some((l) => l.status === 'NEEDS_CLARIFICATION')
    ? 'NEEDS_CLARIFICATION'
    : 'PROPOSAL',
  lines,
  excluded: [],
  toolEvents: [],
});
const catalog = [
  { productId: 'matowa', productName: 'Matowa' },
  { productId: 'dry', productName: 'Dry Matt' },
  { productId: 'sol', productName: 'Sol' },
];
function setup(request: (input: unknown) => Promise<ProposalResult>) {
  const session = signal<
    { status: 'READY'; membership: typeof membership } | { status: 'SIGNED_OUT' }
  >({ status: 'READY', membership });
  const salonId = signal('salon'),
    locked = signal(false);
  TestBed.configureTestingModule({
    providers: [
      DraftStore,
      ReplenishmentAssistantFacade,
      { provide: AssistantApi, useValue: { prepareReplenishment: request } },
      { provide: SessionFacade, useValue: { state: session } },
      {
        provide: OrderFacade,
        useValue: { salonId, locked, canOrder: () => true, inventory: { rows: () => catalog } },
      },
    ],
  });
  const facade = TestBed.inject(ReplenishmentAssistantFacade),
    draft = TestBed.inject(DraftStore);
  TestBed.flushEffects();
  return { facade, draft, session, salonId, locked };
}
it('merges late proposals into the latest draft, retaining manual edits and origin', async () => {
  let complete!: (r: ProposalResult) => void;
  const { facade, draft } = setup(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  draft.add({ ...line('sol', 5), lineId: 'manual-sol', origin: 'manual' });
  facade.message.set('2 Matowa');
  const pending = facade.prepare();
  draft.add({ ...line('matowa', 5), lineId: 'manual-matowa', origin: 'manual' });
  complete(proposal());
  await pending;
  expect(draft.lines()).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ productId: 'sol', quantity: 5, origin: 'manual' }),
      expect.objectContaining({ productId: 'matowa', quantity: 7, origin: 'manual' }),
    ]),
  );
});
it('discards results from a previous salon, account or submitted draft', async () => {
  let complete!: (r: ProposalResult) => void;
  const { facade, draft, salonId } = setup(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  facade.message.set('2 Matowa');
  const pending = facade.prepare();
  salonId.set('another');
  TestBed.flushEffects();
  complete(proposal());
  await pending;
  expect(draft.lines()).toEqual([]);
  expect(facade.loading()).toBe(false);
  facade.message.set('2 Matowa');
  const submitted = facade.prepare();
  draft.clear();
  complete(proposal());
  await submitted;
  expect(draft.lines()).toEqual([]);
});
it.each([
  ['TIMEOUT', 'replenishment.assistant.errors.TIMEOUT'],
  ['SERVICE_UNAVAILABLE', 'replenishment.assistant.errors.default'],
] as const)('maps assistant error %s to its key', async (code, key) => {
  const { facade } = setup(async () => {
    throw new AssistantApiError(code);
  });
  facade.message.set('2 Matowa');
  await facade.prepare();
  expect(facade.error()).toEqual({ key });
});
it('provider failure preserves the manual draft and offers a manual fallback', async () => {
  const { facade, draft } = setup(async () => {
    throw new AssistantApiError('RATE_LIMITED');
  });
  draft.add({ ...line('matowa', 5), origin: 'manual' });
  facade.message.set('2 Matowa');
  await facade.prepare();
  expect(draft.lines()[0]).toMatchObject({ quantity: 5, origin: 'manual' });
  expect(facade.error()).toEqual({ key: 'replenishment.assistant.errors.RATE_LIMITED' });
  expect(facade.loading()).toBe(false);
});
it('clarifies only the unresolved source line without adding successful lines twice', async () => {
  let calls = 0;
  const unresolved = {
    status: 'NEEDS_CLARIFICATION' as const,
    lineId: 'line-10-17',
    originalWording: '2 matte',
    reason: 'Choose',
    origin: 'assistant' as const,
    quantity: 2,
    candidates: [{ productId: 'dry', productName: 'Dry Matt' }],
  };
  const { facade, draft } = setup(async () =>
    ++calls === 1
      ? proposal([line(), unresolved])
      : proposal([line(), { ...line('dry'), lineId: unresolved.lineId }]),
  );
  facade.message.set('2 Matowa, 2 matte');
  await facade.prepare();
  const id = draft.lines().find((l) => l.status === 'NEEDS_CLARIFICATION')!.lineId;
  await facade.clarify(id, 'dry', 2);
  expect(draft.lines()).toHaveLength(2);
  expect(draft.lines().find((l) => l.status === 'READY' && l.productId === 'matowa')).toMatchObject(
    { quantity: 2 },
  );
  expect(draft.lines().find((l) => l.status === 'READY' && l.productId === 'dry')).toMatchObject({
    quantity: 2,
  });
});
it('refuses a proposal exceeding draft capacity without silently dropping a line', async () => {
  const { facade, draft } = setup(async () =>
    proposal([line('new-one'), { ...line('new-two'), lineId: 'line-10-19' }]),
  );
  for (let i = 0; i < 5; i++)
    draft.add({ ...line(`manual-${i}`), lineId: `manual-${i}`, origin: 'manual' });
  facade.message.set('new items');
  await facade.prepare();
  expect(draft.lines()).toHaveLength(5);
  expect(facade.error()).toEqual({ key: 'replenishment.assistant.errors.maxItems' });
});
it.each([false, true])(
  'clarifies a duplicate product once when the unresolved source comes first: %s',
  async (first) => {
    const unresolved = {
      status: 'NEEDS_CLARIFICATION' as const,
      lineId: 'line-10-17',
      originalWording: '2 matte',
      reason: 'Choose',
      origin: 'assistant' as const,
      quantity: 2,
      candidates: [{ productId: 'matowa', productName: 'Matowa' }],
    };
    let calls = 0;
    const { facade, draft } = setup(async () =>
      ++calls === 1
        ? proposal(first ? [unresolved, line()] : [line(), unresolved])
        : proposal([{ ...line('matowa', 4), lineId: first ? unresolved.lineId : line().lineId }]),
    );
    facade.message.set(first ? '2 matte, 2 Matowa' : '2 Matowa, 2 matte');
    await facade.prepare();
    const id = draft.lines().find((l) => l.status === 'NEEDS_CLARIFICATION')!.lineId;
    await facade.clarify(id, 'matowa', 2);
    expect(draft.lines()).toHaveLength(1);
    expect(draft.lines()[0]).toMatchObject({ productId: 'matowa', quantity: 4 });
  },
);
it('keeps manual quantity edits while successively resolving duplicate source items', async () => {
  const unresolved = (lineId: string) => ({
    status: 'NEEDS_CLARIFICATION' as const,
    lineId,
    originalWording: '2 matte',
    reason: 'Choose',
    origin: 'assistant' as const,
    quantity: 2,
    candidates: [{ productId: 'matowa', productName: 'Matowa' }],
  });
  let calls = 0;
  const { facade, draft } = setup(async () =>
    ++calls === 1
      ? proposal([line(), unresolved('line-10-17'), unresolved('line-19-26')])
      : calls === 2
        ? proposal([line('matowa', 4), unresolved('line-19-26')])
        : proposal([line('matowa', 6)]),
  );
  draft.add({ ...line('matowa', 5), lineId: 'manual', origin: 'manual' });
  facade.message.set('2 Matowa, 2 matte, 2 matte');
  await facade.prepare();
  draft.editQuantity('manual', 10);
  for (const item of draft.lines().filter((l) => l.status === 'NEEDS_CLARIFICATION'))
    await facade.clarify(item.lineId, 'matowa', 2);
  expect(draft.lines()).toHaveLength(1);
  expect(draft.lines()[0]).toMatchObject({ quantity: 14, origin: 'manual' });
});
it('asks for products and quantities when extraction is empty', async () => {
  const { facade } = setup(async () => ({
    status: 'UNAVAILABLE',
    lines: [],
    excluded: [],
    toolEvents: [],
  }));
  facade.message.set('hello');
  await facade.prepare();
  expect(facade.notice()).toEqual({ key: 'replenishment.assistant.notices.specify' });
});
const receiptA = '0f8fad5b-d9cb-469f-a165-70867728950e';
const receiptB = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const ask = (lineId: string, choiceReceiptId?: string) => ({
  status: 'NEEDS_CLARIFICATION' as const,
  lineId,
  originalWording: '2 pasta',
  reason: 'Choose',
  origin: 'assistant' as const,
  quantity: 2,
  candidates: [
    { productId: 'dry', productName: 'Dry Matt' },
    { productId: 'matowa', productName: 'Matowa' },
  ],
  ...(choiceReceiptId ? { choiceReceiptId } : {}),
});
it('sends each repeated span its own receipt and keeps it through a failed retry', async () => {
  const inputs: { clarifications?: { lineId: string; choiceReceiptId?: string }[] }[] = [];
  let fail = true;
  const { facade, draft } = setup(async (input) => {
    inputs.push(input as never);
    if (inputs.length === 1)
      return proposal([ask('line-0-7', receiptA), { ...ask('line-9-16', receiptB) }]);
    if (inputs.length === 2 && fail) {
      fail = false;
      throw new AssistantApiError('SERVICE_UNAVAILABLE');
    }
    return proposal([{ ...line('dry'), lineId: 'line-9-16' }]);
  });
  facade.message.set('2 pasta, 2 pasta');
  await facade.prepare();
  const second = draft.lines().filter((l) => l.status === 'NEEDS_CLARIFICATION')[1].lineId;
  await facade.clarify(second, 'dry', 2);
  expect(facade.error()).not.toBeNull();
  await facade.clarify(second, 'dry', 2);
  expect(inputs[1].clarifications).toEqual([
    expect.objectContaining({ lineId: 'line-9-16', choiceReceiptId: receiptB }),
  ]);
  expect(inputs[2].clarifications).toEqual(inputs[1].clarifications);
});
it('applies a valid choice but says when shorthand was not saved', async () => {
  let calls = 0;
  const { facade, draft } = setup(async () =>
    ++calls === 1
      ? proposal([ask('line-0-7', receiptA)])
      : {
          ...proposal([{ ...line('dry'), lineId: 'line-0-7' }]),
          shorthandLearning: [
            { lineId: 'line-0-7', status: 'NOT_SAVED' as const, reason: 'STALE_STATE' as const },
          ],
        },
  );
  facade.message.set('2 pasta');
  await facade.prepare();
  await facade.clarify(draft.lines()[0].lineId, 'dry', 2);
  expect(draft.lines()).toEqual([expect.objectContaining({ status: 'READY', productId: 'dry' })]);
  expect(facade.shorthandNotice()).toEqual({ key: 'replenishment.assistant.shorthand.notSaved' });
});
it('confirms learned shorthand and forgets sources after a role change', async () => {
  let calls = 0;
  const { facade, draft, session } = setup(async () =>
    ++calls === 1
      ? proposal([ask('line-0-7', receiptA)])
      : {
          ...proposal([{ ...line('dry'), lineId: 'line-0-7' }]),
          shorthandLearning: [{ lineId: 'line-0-7', status: 'LEARNED' as const }],
        },
  );
  facade.message.set('2 pasta');
  await facade.prepare();
  await facade.clarify(draft.lines()[0].lineId, 'dry', 2);
  expect(facade.shorthandNotice()).toEqual({ key: 'replenishment.assistant.shorthand.learned' });
  facade.message.set('2 pasta');
  await facade.prepare();
  session.set({ status: 'READY', membership: { ...membership, role: 'HQ' as never } });
  TestBed.flushEffects();
  expect(facade.shorthandNotice()).toBeNull();
  expect(facade.message()).toBe('');
});
const aiLine = (choiceReceiptId?: string) => ({
  ...line('matowa', 3),
  aiMatch: {
    originalWording: '3 matte paste',
    reason: 'Closest name in the catalog',
    alternatives: [{ productId: 'dry', productName: 'Dry Matt' }],
    ...(choiceReceiptId ? { choiceReceiptId } : {}),
  },
});
it('never sends an untouched AI-matched line back as a clarification choice', async () => {
  const inputs: { clarifications?: { lineId: string }[] }[] = [];
  const { facade, draft } = setup(async (input) => {
    inputs.push(input as never);
    return inputs.length === 1
      ? proposal([aiLine(receiptA), ask('line-9-16', receiptB)])
      : proposal([{ ...line('dry'), lineId: 'line-9-16' }]);
  });
  facade.message.set('3 matte paste, 2 pasta');
  await facade.prepare();
  const id = draft.lines().find((l) => l.status === 'NEEDS_CLARIFICATION')!.lineId;
  await facade.clarify(id, 'dry', 2);
  expect(inputs[1].clarifications).toEqual([
    expect.objectContaining({ lineId: 'line-9-16', choiceReceiptId: receiptB }),
  ]);
  expect(JSON.stringify(inputs)).not.toContain(receiptA);
});
it('change turns an AI match into a choice with alternatives first and sends its receipt', async () => {
  const inputs: { clarifications?: unknown[] }[] = [];
  const { facade, draft } = setup(async (input) => {
    inputs.push(input as never);
    return inputs.length === 1
      ? proposal([aiLine(receiptA)])
      : proposal([{ ...line('sol', 3), lineId: 'line-0-8' }]);
  });
  facade.message.set('3 matte paste');
  await facade.prepare();
  const id = draft.lines()[0].lineId;
  facade.changeMatch(id);
  expect(inputs).toHaveLength(1);
  expect(draft.lines()[0]).toMatchObject({
    status: 'NEEDS_CLARIFICATION',
    lineId: id,
    originalWording: '3 matte paste',
    reasonCode: 'CHOOSE_PRODUCT',
    quantity: 3,
    origin: 'assistant',
  });
  const changed = draft.lines()[0];
  expect(
    changed.status === 'NEEDS_CLARIFICATION' && changed.candidates.map((c) => c.productId),
  ).toEqual(['dry', 'matowa', 'sol']);
  await facade.clarify(id, 'sol', 3);
  expect(inputs[1].clarifications).toEqual([
    {
      lineId: 'line-0-8',
      originalWording: '3 matte paste',
      productId: 'sol',
      quantity: 3,
      choiceReceiptId: receiptA,
    },
  ]);
  expect(draft.lines()).toEqual([
    expect.objectContaining({ status: 'READY', productId: 'sol', quantity: 3 }),
  ]);
  expect(draft.lines()[0]).not.toHaveProperty('aiMatch');
});
it('change ignores lines without an AI match and is blocked while locked', async () => {
  const { facade, draft, locked } = setup(async () => proposal([aiLine(receiptA)]));
  draft.add({ ...line('sol'), lineId: 'manual', origin: 'manual' });
  facade.message.set('3 matte paste');
  await facade.prepare();
  facade.changeMatch('manual');
  locked.set(true);
  facade.changeMatch(draft.lines()[1].lineId);
  expect(draft.lines().every((l) => l.status === 'READY')).toBe(true);
});
it('answers an AI quantity question with the suggested product and the quantity', async () => {
  const inputs: { clarifications?: unknown[] }[] = [];
  const question = {
    ...ask('line-0-7'),
    reasonCode: 'ENTER_QUANTITY' as const,
    quantity: undefined,
    candidates: [
      { productId: 'matowa', productName: 'Matowa', suggested: true as const, reason: 'Closest' },
    ],
  };
  const { facade, draft } = setup(async (input) => {
    inputs.push(input as never);
    return inputs.length === 1
      ? proposal([question])
      : proposal([{ ...line('matowa', 4), lineId: 'line-0-7' }]);
  });
  facade.message.set('some matte paste');
  await facade.prepare();
  await facade.clarify(draft.lines()[0].lineId, 'matowa', 4);
  expect(inputs[1].clarifications).toEqual([
    expect.objectContaining({ lineId: 'line-0-7', productId: 'matowa', quantity: 4 }),
  ]);
});
