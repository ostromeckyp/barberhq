import { expect, it } from 'vitest';
import { canConfirm } from './action-input';
import type { RequestDetail } from '../../../../../../shared/contracts/stock';
const request = { quantity: 2, state: 'DISPATCHED', stock: { hqAvailable: 1 } } as RequestDetail;
it('damaged_receipt_is_blocked', () => {
  expect(
    canConfirm('RECEIVE', request, { receivedQuantity: 2, allIntact: false, reason: '' }),
  ).toBe(false);
  expect(canConfirm('RECEIVE', request, { receivedQuantity: 1, allIntact: true, reason: '' })).toBe(
    false,
  );
  expect(canConfirm('RECEIVE', request, { receivedQuantity: 2, allIntact: true, reason: '' })).toBe(
    true,
  );
});
it('rejection_requires_reason_and_approval_requires_available_stock', () => {
  expect(
    canConfirm(
      'REJECT',
      { ...request, state: 'PENDING_APPROVAL' },
      { receivedQuantity: 2, allIntact: true, reason: '   ' },
    ),
  ).toBe(false);
  expect(
    canConfirm(
      'APPROVE',
      { ...request, state: 'PENDING_APPROVAL' },
      { receivedQuantity: 2, allIntact: true, reason: '' },
    ),
  ).toBe(false);
});
