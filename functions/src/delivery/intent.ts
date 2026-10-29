import { createHash } from 'node:crypto';
import type { DeliveryAction } from '../../../shared/contracts/delivery.js';
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
export const deliveryReceiptId = (requestId: string) => `delivery-receipt-${hash(requestId)}`;
export const deliveryIssueId = (receiptId: string) => `delivery-issue-${hash(receiptId)}`;
export function canonicalDeliveryPayload(action: DeliveryAction): string {
  const { idempotencyKey, ...input } = action.input;
  if (action.type === 'RECORD_RECEIPT')
    return JSON.stringify({
      type: action.type,
      input: {
        ...input,
        items: [...action.input.items].sort((a, b) => a.productId.localeCompare(b.productId)),
        procedureReferences: [...action.input.procedureReferences].sort((a, b) =>
          a.kind.localeCompare(b.kind),
        ),
      },
    });
  return JSON.stringify({ type: action.type, input });
}
