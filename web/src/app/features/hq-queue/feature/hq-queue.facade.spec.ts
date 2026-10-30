import { ApplicationRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { expect, it, vi } from 'vitest';
import { BrowserActivity } from '../../../core/browser-activity';
import { SessionFacade } from '../../auth/feature/session.facade';
import { ReplenishmentApi } from '../../replenishment/data-access/replenishment-api';
import { HqQueueFacade } from './hq-queue.facade';

it('keeps loaded and the last rows across a focus refresh that restarts the load', async () => {
  const tick = signal(0);
  const listHQQueue = vi
    .fn()
    .mockResolvedValueOnce({ items: [{ id: 'r1', state: 'PENDING_APPROVAL' }], nextOffset: null })
    .mockReturnValue(new Promise(() => undefined));
  TestBed.configureTestingModule({
    providers: [
      HqQueueFacade,
      {
        provide: ActivatedRoute,
        useValue: { queryParamMap: new BehaviorSubject(convertToParamMap({})) },
      },
      { provide: Router, useValue: { navigate: vi.fn() } },
      {
        provide: SessionFacade,
        useValue: {
          state: signal({
            status: 'READY',
            membership: { userId: 'u', businessId: 'b', role: 'HQ' },
          }),
        },
      },
      { provide: BrowserActivity, useValue: { refreshTick: tick } },
      { provide: ReplenishmentApi, useValue: { listHQQueue } },
    ],
  });
  const f = TestBed.inject(HqQueueFacade);
  TestBed.tick();
  expect(f.loaded()).toBe(false);
  await TestBed.inject(ApplicationRef).whenStable();
  TestBed.tick();
  expect(f.loaded()).toBe(true);
  expect(f.pending().map((r) => r.id)).toEqual(['r1']);
  tick.set(1);
  TestBed.tick();
  expect(f.loading()).toBe(true);
  expect(f.loaded()).toBe(true);
  expect(f.pending().map((r) => r.id)).toEqual(['r1']);
});
