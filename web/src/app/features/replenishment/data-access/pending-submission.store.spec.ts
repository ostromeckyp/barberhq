import {TestBed} from '@angular/core/testing';
import { expect, it } from 'vitest';
import { validPending, PENDING_STORAGE, PendingSubmissionStore } from './pending-submission.store';
it('rejects_untrusted_restored_payloads_and_duplicate_products', () => {
  const row = {
    lineId: '1',
    status: 'UNKNOWN',
    payload: { salonId: 's', productId: 'p', quantity: 2, idempotencyKey: crypto.randomUUID() },
  };
  const batch = { userId: 'u', businessId: 'b', salonId: 's', rows: [row] };
  expect(validPending(batch)).toBe(true);
  expect(
    validPending({ ...batch, rows: [{ ...row, payload: { ...row.payload, quantity: 100 } }] }),
  ).toBe(false);
  expect(
    validPending({ ...batch, rows: [{ ...row, payload: { ...row.payload, salonId: 'other' } }] }),
  ).toBe(false);
  expect(
    validPending({
      ...batch,
      rows: [
        row,
        { ...row, lineId: '2', payload: { ...row.payload, idempotencyKey: crypto.randomUUID() } },
      ],
    }),
  ).toBe(false);
  expect(validPending({ ...batch, rows: [{ ...row, status: 'CREATED' }] })).toBe(false);
});
it('unavailable_browser_storage_does_not_crash_the_page',()=>{
 TestBed.configureTestingModule({providers:[{provide:PENDING_STORAGE,useValue:{getItem(){throw new Error('Denied');},removeItem(){throw new Error('Denied');}}}]});
 expect(()=>TestBed.inject(PendingSubmissionStore).load()).not.toThrow();
});
