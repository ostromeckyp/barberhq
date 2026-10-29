import type { PrepareInput } from '../../../shared/contracts/ai/index.js';
import { AiError } from './budget.js';

export type RequestedLine = {
  originalWording: string;
  productQuery: string;
  quantity: number | null;
};
export type SourceLine = RequestedLine & {
  lineId: string;
  start: number;
  end: number;
  selectedProductId?: string;
  choiceReceiptId?: string;
};
import { normalizeProduct } from '../../../shared/product-normalization.js';
export { normalizeProduct } from '../../../shared/product-normalization.js';

/** Keep choices stateless and tied to exact source spans, including repeated wording. */
export function bindSourceLines(input: PrepareInput, items: RequestedLine[]): SourceLine[] {
  const selected: SourceLine[] = [];
  for (const choice of input.clarifications ?? []) {
    const match = /^line-(\d+)-(\d+)$/.exec(choice.lineId);
    if (!match) throw new AiError('VALIDATION_ERROR');
    const start = Number(match[1]),
      end = Number(match[2]);
    if (
      start >= end ||
      end > input.message.length ||
      input.message.slice(start, end) !== choice.originalWording ||
      selected.some((l) => start < l.end && end > l.start)
    )
      throw new AiError('VALIDATION_ERROR');
    selected.push({
      ...choice,
      start,
      end,
      productQuery: choice.originalWording,
      quantity: choice.quantity ?? null,
      selectedProductId: choice.productId,
    });
  }
  const parsed: SourceLine[] = [];
  const consumed: { start: number; end: number }[] = [];
  for (const item of items) {
    if (!item.originalWording || !item.productQuery || !Number.isFinite(item.quantity ?? 0))
      throw new AiError('INVALID_MODEL_OUTPUT');
    let start = input.message.indexOf(item.originalWording);
    while (
      start >= 0 &&
      consumed.some((l) => start < l.end && start + item.originalWording.length > l.start)
    )
      start = input.message.indexOf(item.originalWording, start + 1);
    if (
      start < 0 ||
      !normalizeProduct(item.originalWording).includes(normalizeProduct(item.productQuery))
    )
      throw new AiError('INVALID_MODEL_OUTPUT');
    const end = start + item.originalWording.length;
    consumed.push({ start, end });
    const choice = selected.find((l) => start < l.end && end > l.start);
    if (choice) {
      if (start < choice.start || end > choice.end) throw new AiError('INVALID_MODEL_OUTPUT');
      if (choice.quantity === null) choice.quantity = item.quantity;
      // The explicit choice owns the source span; never add its model interpretation again.
      continue;
    }
    parsed.push({ ...item, start, end, lineId: `line-${start}-${end}` });
  }
  return [...selected, ...parsed].sort((a, b) => a.start - b.start);
}
