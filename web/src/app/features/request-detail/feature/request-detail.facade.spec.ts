import { ApplicationRef, signal } from '@angular/core';
import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { afterEach, expect, it, vi } from 'vitest';
import { BrowserActivity } from '../../../core/browser-activity';
import { ClientLog } from '../../../core/client-log';
import { SessionFacade } from '../../auth/feature/session.facade';
import { ReplenishmentApi } from '../../replenishment/data-access/replenishment-api';
import { RequestActions } from './request-actions';
import { RequestDetailFacade } from './request-detail.facade';

afterEach(() => vi.restoreAllMocks());

function setup(getRequest: () => Promise<unknown>) {
  TestBed.configureTestingModule({
    providers: [
      RequestDetailFacade,
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: { data: { workspace: 'SALON' } },
          paramMap: new BehaviorSubject(convertToParamMap({ salonId: 's', requestId: 'r1' })),
        },
      },
      { provide: Router, useValue: { navigate: vi.fn() } },
      { provide: Location, useValue: { getState: () => null } },
      {
        provide: SessionFacade,
        useValue: {
          state: signal({
            status: 'READY',
            membership: { userId: 'u', businessId: 'b', role: 'SALON', salonIds: ['s'] },
          }),
        },
      },
      { provide: BrowserActivity, useValue: { refreshTick: signal(0) } },
      { provide: ReplenishmentApi, useValue: { getRequest } },
      { provide: RequestActions, useValue: {} },
    ],
  });
  return TestBed.inject(RequestDetailFacade);
}

it('logs a loaded request and a failed load', async () => {
  const record = vi.spyOn(ClientLog.prototype, 'record');
  setup(async () => ({ id: 'r1', salonId: 's' }));
  TestBed.tick();
  await TestBed.inject(ApplicationRef).whenStable();
  expect(record).toHaveBeenCalledWith('request.detail.load', 'ok', expect.anything());
  TestBed.resetTestingModule();
  setup(async () => {
    throw Object.assign(new Error('x'), { code: 'NOT_FOUND' });
  });
  TestBed.tick();
  await TestBed.inject(ApplicationRef).whenStable();
  expect(record).toHaveBeenCalledWith(
    'request.detail.load',
    'error',
    expect.objectContaining({ code: 'NOT_FOUND' }),
  );
});
