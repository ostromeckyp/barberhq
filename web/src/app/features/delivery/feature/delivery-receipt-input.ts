import type {
  DeliveryReceiptContextDto,
  RecordDeliveryInput,
} from '../../../../../../shared/contracts/delivery/index';
import type { TranslatedText } from '../../../core/models/translated-text';
import type { DeliveryScope } from '../models/delivery-scope';
import type { ReceiptDraft } from '../models/receipt-draft';

export function receiptProcedureProblem(items: ReceiptDraft['items']) {
  const damaged = items.some((item) => item.damagedQuantity > 0);
  const missing = items.some((item) => item.missingQuantity > 0);
  return damaged && missing ? 'BOTH' : damaged ? 'DAMAGED' : missing ? 'MISSING' : null;
}

/** First problem that blocks recording the inspection, or null when the draft is valid. */
export function receiptValidation(
  ctx: DeliveryReceiptContextDto | undefined,
  draft: ReceiptDraft,
  affected: () => number,
): TranslatedText | null {
  if (!ctx) return { key: 'delivery.validation.unavailable' };
  if (draft.items.length !== ctx.request.items.length)
    return { key: 'delivery.validation.checkAll' };
  for (const item of ctx.request.items) {
    const row = draft.items.find((r) => r.productId === item.productId);
    if (
      !row ||
      [row.goodQuantity, row.damagedQuantity, row.missingQuantity].some(
        (q) => !Number.isInteger(q) || q < 0 || q > 99,
      )
    )
      return { key: 'delivery.validation.wholeQuantities', params: { product: item.productName } };
    if (row.goodQuantity + row.damagedQuantity + row.missingQuantity !== item.dispatchedQuantity)
      return {
        key: 'delivery.validation.mustAddUp',
        params: { product: item.productName, total: item.dispatchedQuantity },
      };
  }
  if (affected() && (!draft.description.trim() || draft.description.trim().length > 1000))
    return { key: 'delivery.validation.describe' };
  if (draft.batchIdentifier.trim().length > 120) return { key: 'delivery.validation.batchLength' };
  return null;
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
