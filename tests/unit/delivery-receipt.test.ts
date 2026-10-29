import { expect, it } from 'vitest';
import { classifyReceipt } from '../../functions/src/delivery/receipt.ts';
const dispatched = [
  { productId: 'a', dispatchedQuantity: 10 },
  { productId: 'b', dispatchedQuantity: 3 },
];
const items = [
  { productId: 'a', goodQuantity: 8, damagedQuantity: 2, missingQuantity: 0 },
  { productId: 'b', goodQuantity: 0, damagedQuantity: 0, missingQuantity: 3 },
];
it('aligns_classification_with_actual_transfer_items', () => {
  expect(classifyReceipt([...items].reverse(), dispatched)).toEqual(items);
});
it('rejects_swapped_quantities_even_when_global_sum_matches', () => {
  expect(() =>
    classifyReceipt(
      [
        { ...items[0], goodQuantity: 1 },
        { ...items[1], missingQuantity: 10 },
      ],
      dispatched,
    ),
  ).toThrow();
});
it('requires_every_dispatched_product_exactly_once', () => {
  for (const invalid of [
    [items[0]],
    [items[0], items[0]],
    [items[0], { ...items[1], productId: 'foreign' }],
  ])
    expect(() => classifyReceipt(invalid, dispatched)).toThrow();
});
it('zero_good_is_valid_but_incomplete_or_over_receipt_is_not', () => {
  expect(classifyReceipt(items, dispatched)[1].goodQuantity).toBe(0);
  expect(() => classifyReceipt([{ ...items[0], goodQuantity: 7 }, items[1]], dispatched)).toThrow();
  expect(() => classifyReceipt([{ ...items[0], goodQuantity: 9 }, items[1]], dispatched)).toThrow();
});
