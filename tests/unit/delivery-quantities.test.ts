import { expect, it } from 'vitest';
import { deliveryQuantities } from '../../shared/delivery-quantities.ts';
it('unchecked_dispatch_remains_in_transit', () => {
  expect(
    deliveryQuantities({ dispatchedQuantity: 10, receivedQuantity: 0, receiptItem: null }),
  ).toEqual({ inTransit: 10, goodQuantity: 0, damagedQuantity: 0, missingQuantity: 0 });
});
it('inspected_damage_is_not_transit_or_good_stock', () => {
  expect(
    deliveryQuantities({
      dispatchedQuantity: 10,
      receivedQuantity: 8,
      receiptItem: { productId: 'p', goodQuantity: 8, damagedQuantity: 2, missingQuantity: 0 },
    }),
  ).toEqual({ inTransit: 0, goodQuantity: 8, damagedQuantity: 2, missingQuantity: 0 });
});
it('zero_good_missing_receipt_is_terminal_without_inventing_damage', () => {
  expect(
    deliveryQuantities({
      dispatchedQuantity: 10,
      receivedQuantity: 0,
      receiptItem: { productId: 'p', goodQuantity: 0, damagedQuantity: 0, missingQuantity: 10 },
    }),
  ).toEqual({ inTransit: 0, goodQuantity: 0, damagedQuantity: 0, missingQuantity: 10 });
});
it('legacy_full_received_quantities_remain_compatible', () => {
  expect(
    deliveryQuantities({ dispatchedQuantity: 10, receivedQuantity: 10, receiptItem: null }),
  ).toEqual({ inTransit: 0, goodQuantity: 10, damagedQuantity: 0, missingQuantity: 0 });
  expect(
    deliveryQuantities({
      dispatchedQuantity: 10,
      receivedQuantity: 10,
      receiptItem: { productId: 'p', goodQuantity: 10, damagedQuantity: 0, missingQuantity: 0 },
    }),
  ).toEqual({ inTransit: 0, goodQuantity: 10, damagedQuantity: 0, missingQuantity: 0 });
});
