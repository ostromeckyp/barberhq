import { ApplicationRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { expect, it, vi } from 'vitest';
import type { SalonShorthand } from '../../../../../../shared/contracts/product-lookup';
import { SessionFacade } from '../../auth/feature/session.facade';
import { SalonShorthandApi, ShorthandRemoveError } from '../data-access/salon-shorthand-api';
import { SalonShorthandFacade } from './salon-shorthand.facade';

const row = (
  id: string,
  revision = 1,
  status: SalonShorthand['status'] = 'active',
): SalonShorthand => ({
  id,
  salonId: 'a',
  salonName: 'Salon A',
  productId: `p-${id}`,
  productName: `Product ${id}`,
  phrase: `phrase ${id}`,
  revision,
  status,
  updatedAt: '2026-10-28T10:00:00Z',
});
function setup(role: 'SALON' | 'HQ' = 'SALON') {
  const params = new BehaviorSubject(convertToParamMap({ salonId: 'a' }));
  const list = vi.fn().mockResolvedValue({ rows: [row('1'), row('2')], nextCursor: null });
  const remove = vi.fn();
  const state = signal({
    status: 'READY',
    membership: { userId: 'u', businessId: 'b', role, salonIds: role === 'SALON' ? ['a'] : [] },
  });
  TestBed.configureTestingModule({
    providers: [
      SalonShorthandFacade,
      { provide: ActivatedRoute, useValue: { paramMap: params } },
      { provide: SessionFacade, useValue: { state } },
      { provide: SalonShorthandApi, useValue: { list, remove } },
    ],
  });
  const facade = TestBed.inject(SalonShorthandFacade);
  const settle = async () => {
    TestBed.tick();
    await TestBed.inject(ApplicationRef).whenStable();
    TestBed.tick();
  };
  return { params, list, remove, state, facade, settle };
}

it('loads_pages_and_reports_empty_and_error_states', async () => {
  const h = setup();
  h.list
    .mockResolvedValueOnce({ rows: [row('1')], nextCursor: '1' })
    .mockResolvedValueOnce({ rows: [row('2')], nextCursor: null });
  await h.settle();
  expect(h.facade.rows().map((r) => r.id)).toEqual(['1']);
  expect(h.facade.hasMore()).toBe(true);
  await h.facade.loadMore();
  expect(h.list).toHaveBeenLastCalledWith('a', '1');
  expect(h.facade.rows().map((r) => r.id)).toEqual(['1', '2']);
  expect(h.facade.hasMore()).toBe(false);
  h.list.mockResolvedValueOnce({ rows: [], nextCursor: null });
  h.facade.reload();
  await h.settle();
  expect(h.facade.empty()).toBe(true);
  h.list.mockRejectedValueOnce(new Error('down'));
  h.facade.reload();
  await h.settle();
  expect(h.facade.error()).toBe('Salon shorthand could not be loaded.');
});

it('removes_only_after_the_authoritative_response', async () => {
  const h = setup();
  await h.settle();
  let done!: (value: SalonShorthand) => void;
  h.remove.mockReturnValue(new Promise((resolve) => (done = resolve)));
  const pending = h.facade.remove(h.facade.rows()[0]);
  expect(h.facade.rows().map((r) => r.id)).toEqual(['1', '2']);
  expect(h.facade.removing()).toBe('1');
  done(row('1', 2, 'retired'));
  await pending;
  expect(h.facade.rows().map((r) => r.id)).toEqual(['2']);
  expect(h.remove).toHaveBeenCalledWith({
    salonId: 'a',
    aliasId: '1',
    expectedRevision: 1,
    idempotencyKey: expect.stringMatching(/^[0-9a-f-]{36}$/),
  });
});

it('retries_an_unknown_outcome_with_the_same_key_and_reloads_when_stale', async () => {
  const h = setup();
  await h.settle();
  h.remove.mockRejectedValueOnce(new ShorthandRemoveError('UNKNOWN'));
  await h.facade.remove(h.facade.rows()[0]);
  expect(h.facade.error()).toBe('The removal outcome is unknown. Retry to confirm it.');
  expect(h.facade.rows().map((r) => r.id)).toEqual(['1', '2']);
  h.remove.mockResolvedValueOnce(row('1', 2, 'retired'));
  await h.facade.remove(h.facade.rows()[0]);
  expect(h.remove.mock.calls[1][0].idempotencyKey).toBe(h.remove.mock.calls[0][0].idempotencyKey);
  expect(h.facade.rows().map((r) => r.id)).toEqual(['2']);
  h.remove.mockRejectedValueOnce(new ShorthandRemoveError('STALE_STATE'));
  h.list.mockResolvedValueOnce({ rows: [row('2', 3)], nextCursor: null });
  await h.facade.remove(h.facade.rows()[0]);
  await h.settle();
  expect(h.facade.error()).toBe('This shorthand changed. The list was reloaded.');
  expect(h.facade.rows()).toEqual([row('2', 3)]);
});

it('offers_no_removal_to_hq_and_clears_records_on_role_change', async () => {
  const hq = setup('HQ');
  await hq.settle();
  expect(hq.facade.canRemove()).toBe(false);
  await hq.facade.remove(hq.facade.rows()[0]);
  expect(hq.remove).not.toHaveBeenCalled();
  TestBed.resetTestingModule();
  const h = setup();
  await h.settle();
  expect(h.facade.canRemove()).toBe(true);
  h.state.set({
    status: 'READY',
    membership: { userId: 'u', businessId: 'b', role: 'HQ', salonIds: [] },
  });
  TestBed.tick();
  expect(h.facade.rows()).toEqual([]);
  expect(h.facade.canRemove()).toBe(false);
});
