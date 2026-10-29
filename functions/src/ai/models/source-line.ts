import type { RequestedLine } from './requested-line.js';

export type SourceLine = RequestedLine & {
  lineId: string;
  start: number;
  end: number;
  selectedProductId?: string;
  choiceReceiptId?: string;
};
