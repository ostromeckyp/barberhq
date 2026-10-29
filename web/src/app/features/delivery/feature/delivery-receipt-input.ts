import type {
  DeliveryReceiptContextDto,
  RecordDeliveryInput,
} from '../../../../../../shared/contracts/delivery/index';
import type { DeliveryScope } from '../models/delivery-scope';
import type { ReceiptDraft } from '../models/receipt-draft';

export function receiptProcedureProblem(items: ReceiptDraft['items']) {
  const damaged = items.some((item) => item.damagedQuantity > 0);
  const missing = items.some((item) => item.missingQuantity > 0);
  return damaged && missing ? 'BOTH' : damaged ? 'DAMAGED' : missing ? 'MISSING' : null;
}

/** First problem that blocks recording the inspection, or '' when the draft is valid. */
export function receiptValidation(
  ctx: DeliveryReceiptContextDto | undefined,
  draft: ReceiptDraft,
  affected: () => number,
): string {
  if (!ctx) return 'Delivery information unavailable.';
  if (draft.items.length !== ctx.request.items.length) return 'Check all products.';
  for (const item of ctx.request.items) {
    const row = draft.items.find((r) => r.productId === item.productId);
    if (
      !row ||
      [row.goodQuantity, row.damagedQuantity, row.missingQuantity].some(
        (q) => !Number.isInteger(q) || q < 0 || q > 99,
      )
    )
      return `${item.productName}: enter whole quantities from 0 to 99.`;
    if (row.goodQuantity + row.damagedQuantity + row.missingQuantity !== item.dispatchedQuantity)
      return `${item.productName}: quantities must add up to ${item.dispatchedQuantity}.`;
  }
  if (affected() && (!draft.description.trim() || draft.description.trim().length > 1000))
    return 'Describe the problem in 1–1000 characters.';
  if (draft.batchIdentifier.trim().length > 120)
    return 'Batch number must be 120 characters or fewer.';
  return '';
}

export function receiptInput(
  scope: DeliveryScope,
  context: DeliveryReceiptContextDto,
  draft: ReceiptDraft,
  affected: number,
): RecordDeliveryInput {
  return {
    requestId: scope.targetId,
    expectedRevision: context.request.revision,
    idempotencyKey: crypto.randomUUID(),
    items: draft.items.map((row) => ({ ...row })),
    ...(affected
      ? {
          report: {
            description: draft.description.trim(),
            batchIdentifier: draft.batchIdentifier.trim() || null,
          },
        }
      : {}),
    procedureReferences: draft.procedureReferences.map((ref) => ({ ...ref })),
  };
}
