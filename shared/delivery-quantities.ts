import type { DeliveryQuantities } from './contracts/delivery.js';
export function deliveryQuantities(input: {
  dispatchedQuantity: number;
  receivedQuantity: number;
  receiptItem: DeliveryQuantities | null;
}) {
  const receipt = input.receiptItem;
  return {
    inTransit: receipt ? 0 : Math.max(0, input.dispatchedQuantity - input.receivedQuantity),
    goodQuantity: receipt?.goodQuantity ?? input.receivedQuantity,
    damagedQuantity: receipt?.damagedQuantity ?? 0,
    missingQuantity: receipt?.missingQuantity ?? 0,
  };
}
