import { expect, it } from 'vitest';
import { DraftStore } from './draft.store';
import type { ReadyDraftLine } from '../../../../../../shared/contracts/draft/index';
const line = (quantity: number, origin: 'manual' | 'assistant' = 'manual'): ReadyDraftLine => ({
  status: 'READY',
  lineId: '1',
  productId: 'p1',
  productName: 'Matowa',
  quantity,
  origin,
  hqAvailable: 0,
  salonOnHand: 2,
  hqInventoryVersion: 1,
  salonInventoryVersion: 1,
});
it('overflow_is_editable_and_retains_origin', () => {
  const store = new DraftStore();
  store.add(line(98));
  store.add({ ...line(2, 'assistant'), lineId: '2' });
  expect(store.lines()[0]).toMatchObject({ quantity: 100, origin: 'manual' });
  expect(store.canSubmit()).toBe(false);
  store.editQuantity('1', 3);
  expect(store.canSubmit()).toBe(true); // shortage warns, does not block
});
it('clarification_blocks_and_six_distinct_products_is_the_limit', () => {
  const store = new DraftStore();
  store.merge([
    {
      status: 'NEEDS_CLARIFICATION',
      lineId: 'x',
      originalWording: 'pomade',
      reason: 'Choose',
      origin: 'assistant',
      candidates: [],
    },
  ]);
  expect(store.canSubmit()).toBe(false);
  store.remove('x');
  for (let i = 0; i < 7; i++) store.add({ ...line(1), lineId: String(i), productId: String(i) });
  expect(store.lines()).toHaveLength(6);
});
it('recovery_preserves_products_that_cannot_be_resolved_from_inventory', () => {
  const store = new DraftStore();
  store.restore([{ productId: 'missing-product', quantity: 3 }], []);
  expect(store.lines()).toHaveLength(1);
  expect(store.lines()[0]).toMatchObject({ status: 'NEEDS_CLARIFICATION', quantity: 3 });
  expect(store.canSubmit()).toBe(false);
});
it('assistant_merge_is_atomic_when_there_is_no_room_for_all_lines', () => {
  const store = new DraftStore();
  for (let i = 0; i < 5; i++) store.add({ ...line(1), lineId: String(i), productId: String(i) });
  const before = store.lines();
  expect(
    store.mergeProposal([
      { ...line(2), productId: 'new-1' },
      { ...line(3), productId: 'new-2' },
    ]),
  ).toBe(false);
  expect(store.lines()).toEqual(before);
});
const aiMatch = {
  originalWording: 'matte',
  reason: 'Closest name',
  alternatives: [{ productId: 'dry', productName: 'Dry' }],
};
it('merging_an_ai_match_into_an_existing_line_does_not_label_that_line', () => {
  const store = new DraftStore();
  store.add(line(2));
  expect(store.mergeProposal([{ ...line(1, 'assistant'), lineId: 'ai', aiMatch }])).toBe(true);
  expect(store.lines()).toHaveLength(1);
  expect(store.lines()[0]).toMatchObject({ quantity: 3, origin: 'manual' });
  expect(store.lines()[0]).not.toHaveProperty('aiMatch');
});
it('replace_swaps_one_line_in_place', () => {
  const store = new DraftStore();
  store.add(line(2));
  store.add({ ...line(1), lineId: '2', productId: 'p2' });
  store.replace('1', {
    status: 'NEEDS_CLARIFICATION',
    lineId: '1',
    originalWording: 'matte',
    reason: 'CHOOSE_PRODUCT',
    origin: 'assistant',
    candidates: [],
    quantity: 2,
  });
  expect(store.lines().map((l) => [l.lineId, l.status])).toEqual([
    ['1', 'NEEDS_CLARIFICATION'],
    ['2', 'READY'],
  ]);
});
