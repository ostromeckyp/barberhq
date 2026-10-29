import type { LineOrigin } from './line-origin.js';
export type ClarificationLine = {
  status: 'NEEDS_CLARIFICATION';
  lineId: string;
  originalWording: string;
  reason: string;
  origin: LineOrigin;
  candidates: { productId: string; productName: string }[];
  quantity?: number;
  /** Server receipt that lets an explicit choice teach salon shorthand. */
  choiceReceiptId?: string;
};
