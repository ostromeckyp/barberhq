import type { DraftLine } from '../../../../../../shared/contracts/draft/index';
import { INVENTORY_UNAVAILABLE_REASON } from './draft.store';

type ReasonCode = NonNullable<Extract<DraftLine, { status: 'NEEDS_CLARIFICATION' }>['reasonCode']>;

const REASON_KEYS: Record<ReasonCode, string> = {
  BATCH_LIMIT: 'replenishment.assistant.reasons.BATCH_LIMIT',
  CHOOSE_PRODUCT: 'replenishment.assistant.reasons.CHOOSE_PRODUCT',
  ENTER_QUANTITY: 'replenishment.assistant.reasons.ENTER_QUANTITY',
};

/** Translation key for a clarification line's reason; `undefined` means show the raw `reason` text. */
export function clarificationReasonKey(line: DraftLine): string | undefined {
  if (line.status === 'READY') return undefined;
  if (line.reason === INVENTORY_UNAVAILABLE_REASON) return INVENTORY_UNAVAILABLE_REASON;
  return line.reasonCode ? REASON_KEYS[line.reasonCode] : undefined;
}
