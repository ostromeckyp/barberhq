import { expect, it } from 'vitest';
import { deliveryCommandError } from './delivery-command-error';
import { receiptValidation } from './delivery-receipt-input';

it('maps server error codes to translation keys', () => {
  expect(deliveryCommandError('ALREADY_ACTIVE')).toEqual({ key: 'delivery.errors.ALREADY_ACTIVE' });
  expect(deliveryCommandError('STALE_STATE')).toEqual({ key: 'delivery.errors.STALE_STATE' });
  expect(deliveryCommandError('OTHER')).toEqual({
    key: 'delivery.errors.default',
    params: { code: 'OTHER' },
  });
});

it('reports receipt validation as translation keys', () => {
  const draft = { items: [], description: '', batchIdentifier: '', procedureReferences: [] };
  expect(receiptValidation(undefined, draft, () => 0)).toEqual({
    key: 'delivery.validation.unavailable',
  });
});
