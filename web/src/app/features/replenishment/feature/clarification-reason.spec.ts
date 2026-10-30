import { expect, it } from 'vitest';
import type { ClarificationLine } from '../../../../../../shared/contracts/draft/index';
import { clarificationReasonKey } from './clarification-reason';
import { INVENTORY_UNAVAILABLE_REASON } from './draft.store';

const line = (extra: Partial<ClarificationLine>): ClarificationLine => ({
  status: 'NEEDS_CLARIFICATION',
  lineId: 'l',
  originalWording: '2 pasta',
  reason: 'Choose a catalog product.',
  origin: 'assistant',
  candidates: [],
  ...extra,
});

it.each([
  ['BATCH_LIMIT', 'replenishment.assistant.reasons.BATCH_LIMIT'],
  ['CHOOSE_PRODUCT', 'replenishment.assistant.reasons.CHOOSE_PRODUCT'],
  ['ENTER_QUANTITY', 'replenishment.assistant.reasons.ENTER_QUANTITY'],
] as const)('maps reason code %s to its key', (reasonCode, key) => {
  expect(clarificationReasonKey(line({ reasonCode }))).toBe(key);
});

it('falls back to the raw reason text without a code', () => {
  expect(clarificationReasonKey(line({}))).toBeUndefined();
});

it('keys the reason the web writes when restoring a draft', () => {
  expect(clarificationReasonKey(line({ reason: INVENTORY_UNAVAILABLE_REASON }))).toBe(
    INVENTORY_UNAVAILABLE_REASON,
  );
});
