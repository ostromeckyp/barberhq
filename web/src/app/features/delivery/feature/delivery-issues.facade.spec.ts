import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { it, expect, vi } from 'vitest';
import { SessionFacade } from '../../auth/feature/session.facade';
import { SalonContext } from '../../../core/salon-context';
import { DeliveryApi } from '../data-access/delivery-api';
import { DeliveryIssuesFacade } from './delivery-issues.facade';
it('uses independent authorized open count and bounded URL status and offset', async () => {
  const query = new BehaviorSubject(
    convertToParamMap({ view: 'delivery-issues', issueStatus: 'ALL', issueOffset: '20' }),
  );
  const listIssues = vi.fn(async () => ({ items: [], openCount: 27, offset: 20, hasMore: true }));
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      DeliveryIssuesFacade,
      {
        provide: SessionFacade,
        useValue: {
          state: signal({
            status: 'READY',
            membership: { userId: 'one', businessId: 'business', role: 'HQ', salonIds: ['salon'] },
          }),
        },
      },
      { provide: SalonContext, useValue: { workspace: signal({ kind: 'HQ' }) } },
      { provide: ActivatedRoute, useValue: { queryParamMap: query } },
      { provide: DeliveryApi, useValue: { listIssues } },
    ],
  });
  const f = TestBed.inject(DeliveryIssuesFacade);
  TestBed.flushEffects();
  await new Promise((r) => setTimeout(r, 0));
  TestBed.flushEffects();
  expect(f.openCount()).toBe(27);
  expect(f.rows()).toEqual([]);
  expect(f.status()).toBe('ALL');
  expect(listIssues).toHaveBeenCalledWith({ offset: 20, limit: 20, status: 'ALL' });
  query.next(convertToParamMap({ issueStatus: 'INVALID', issueOffset: '-3' }));
  TestBed.flushEffects();
  expect(f.status()).toBe('OPEN');
  expect(f.offset()).toBe(0);
});
