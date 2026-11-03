import type { ClarificationLine } from '../../../../shared/contracts/draft/index.js';

/** Server-validated outcome of an AI match for one unresolved line. */
export type AppliedMatch = {
  lineId: string;
  outcome: 'READY' | 'ENTER_QUANTITY' | 'CHOOSE_PRODUCT';
  reason: string;
  /** AI suggestions first (`suggested`), then the remaining offers; the first is the READY product. */
  candidates: ClarificationLine['candidates'];
};
