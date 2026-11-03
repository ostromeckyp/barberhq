import { ApplicationRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { expect, it, vi } from 'vitest';
import { BrowserActivity } from '../../../core/browser-activity';
import { ClientLog } from '../../../core/client-log';
import { SessionFacade } from '../../auth/feature/session.facade';
import { HqStockApi } from '../data-access/hq-stock-api';
import { HqStockFacade } from './hq-stock.facade';

it('logs the HQ stock load', async () => {
  const record = vi.spyOn(ClientLog.prototype, 'record');
  TestBed.configureTestingModule({
    providers: [
      HqStockFacade,
      {
        provide: SessionFacade,
        useValue: {
          state: signal({
            status: 'READY',
            membership: { userId: 'u', businessId: 'b', role: 'HQ', salonIds: [] },
          }),
        },
      },
      { provide: BrowserActivity, useValue: { refreshTick: signal(0) } },
      { provide: HqStockApi, useValue: { load: vi.fn(async () => []) } },
    ],
  });
  const facade = TestBed.inject(HqStockFacade);
  TestBed.tick();
  await TestBed.inject(ApplicationRef).whenStable();
  expect(facade.rows()).toEqual([]);
  expect(record).toHaveBeenCalledWith('hq.stock.load', 'ok', expect.anything());
  record.mockRestore();
});
