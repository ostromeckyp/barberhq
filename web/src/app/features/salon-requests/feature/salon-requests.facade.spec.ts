import { ApplicationRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { expect, it, vi } from 'vitest';
import { SalonRequestsFacade } from './salon-requests.facade';
import { ReplenishmentApi } from '../../replenishment/data-access/replenishment-api';
import { SessionFacade } from '../../auth/feature/session.facade';
import { BrowserActivity } from '../../../core/browser-activity';
it('loads_server_filter_and_resets_page_without_leaking_delayed_results', async () => {
  const params = new BehaviorSubject(convertToParamMap({ salonId: 'a' })),
    query = new BehaviorSubject(convertToParamMap({ filter: 'REJECTED', offset: '50' }));
  let finish!: (v: { items: []; nextOffset: null }) => void;
  const listRequests = vi
    .fn()
    .mockImplementationOnce(() => new Promise((r) => (finish = r)))
    .mockResolvedValue({ items: [], nextOffset: null });
  const navigate = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      SalonRequestsFacade,
      { provide: ActivatedRoute, useValue: { paramMap: params, queryParamMap: query } },
      { provide: Router, useValue: { navigate } },
      {
        provide: SessionFacade,
        useValue: {
          state: signal({
            status: 'READY',
            membership: { userId: 'u', businessId: 'b', role: 'SALON', salonIds: ['a', 'b'] },
          }),
        },
      },
      { provide: BrowserActivity, useValue: { refreshTick: signal(0) } },
      { provide: ReplenishmentApi, useValue: { listRequests } },
    ],
  });
  const f = TestBed.inject(SalonRequestsFacade);
  TestBed.tick();
  expect(listRequests).toHaveBeenCalledWith('a', 'REJECTED', { limit: 50, offset: 50 });
  f.setFilter('ACTIVE');
  expect(navigate).toHaveBeenCalledWith(
    [],
    expect.objectContaining({ queryParams: { filter: 'ACTIVE', offset: 0 } }),
  );
  params.next(convertToParamMap({ salonId: 'b' }));
  TestBed.tick();
  finish({ items: [], nextOffset: null });
  await TestBed.inject(ApplicationRef).whenStable();
  TestBed.tick();
  expect(f.context().salonId).toBe('b');
  expect(f.items()).toEqual([]);
});
