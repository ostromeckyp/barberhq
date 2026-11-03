import type { LineOrigin } from './line-origin.js';
export type ClarificationLine = {
  status: 'NEEDS_CLARIFICATION';
  lineId: string;
  originalWording: string;
  reason: string;
  /** Stable code for `reason`, so clients can show it in their own language. */
  reasonCode?: 'BATCH_LIMIT' | 'CHOOSE_PRODUCT' | 'ENTER_QUANTITY';
  origin: LineOrigin;
  /** AI suggestions come first and carry `suggested` plus a short `reason`. */
  candidates: { productId: string; productName: string; suggested?: true; reason?: string }[];
  quantity?: number;
  /** Server receipt that lets an explicit choice teach salon shorthand. */
  choiceReceiptId?: string;
};
