import { TestBed } from '@angular/core/testing';
import { expect, it } from 'vitest';
import { validPending, PENDING_STORAGE, PendingSubmissionStore } from './pending-submission.store';
const pending = () => ({
  version: 2,
  userId: 'u',
  businessId: 'b',
  salonId: 's',
  payload: {
    salonId: 's',
    items: [{ productId: 'p', quantity: 2 }],
    idempotencyKey: crypto.randomUUID(),
  },
});
it('validates_the_complete_frozen_request', () => {
  const p = pending();
  expect(validPending(p)).toBe(true);
  for (const items of [
    [],
    [{ productId: 'p', quantity: 100 }],
    [...p.payload.items, ...p.payload.items],
  ])
    expect(validPending({ ...p, payload: { ...p.payload, items } })).toBe(false);
  expect(validPending({ ...p, payload: { ...p.payload, salonId: 'other' } })).toBe(false);
  expect(validPending({ ...p, payload: { ...p.payload, businessId: 'injected' } })).toBe(false);
});
it('preserves_legacy_and_unknown_journals_and_blocks_new_submission', () => {
  sessionStorage.clear();
  TestBed.configureTestingModule({
    providers: [{ provide: PENDING_STORAGE, useValue: sessionStorage }],
  });
  const store = TestBed.inject(PendingSubmissionStore);
  sessionStorage.setItem('barberhq.pending.v1', '{"rows":[]}');
  expect(store.load()).toEqual({ kind: 'BLOCKED', reason: 'LEGACY' });
  expect(sessionStorage.getItem('barberhq.pending.v1')).toBe('{"rows":[]}');
  sessionStorage.removeItem('barberhq.pending.v1');
  sessionStorage.setItem('barberhq.pending.v2', '{"version":9}');
  expect(store.load()).toEqual({ kind: 'BLOCKED', reason: 'INVALID' });
  expect(sessionStorage.getItem('barberhq.pending.v2')).toBe('{"version":9}');
});
it('reports_unavailable_storage_without_crashing', () => {
  TestBed.configureTestingModule({
    providers: [
      {
        provide: PENDING_STORAGE,
        useValue: {
          getItem() {
            throw Error('Denied');
          },
        },
      },
    ],
  });
  expect(TestBed.inject(PendingSubmissionStore).load()).toEqual({
    kind: 'BLOCKED',
    reason: 'STORAGE_UNAVAILABLE',
  });
});
