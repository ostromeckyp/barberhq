import type { DeliveryQuantities } from '../../../shared/contracts/delivery/index.js';
import { StockError } from '../stock/errors.js';
export function classifyReceipt(
  items: DeliveryQuantities[],
  expected: { productId: string; dispatchedQuantity: number }[],
): DeliveryQuantities[] {
  const indexed = new Map(items.map((item) => [item.productId, item]));
  if (
    expected.length < 1 ||
    expected.length > 6 ||
    items.length !== expected.length ||
    indexed.size !== items.length
  )
    throw new StockError('VALIDATION_ERROR', 'Classify every expected product exactly once.');
  return expected.map((line) => {
    const item = indexed.get(line.productId);
    if (
      !item ||
      [item.goodQuantity, item.damagedQuantity, item.missingQuantity].some(
        (q) => !Number.isInteger(q) || q < 0 || q > 99,
      ) ||
      item.goodQuantity + item.damagedQuantity + item.missingQuantity !== line.dispatchedQuantity
    )
      throw new StockError(
        'VALIDATION_ERROR',
        'Good, damaged and missing units must match each dispatched product.',
      );
    return item;
  });
}
