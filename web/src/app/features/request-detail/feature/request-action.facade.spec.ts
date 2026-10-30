import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { it, expect, vi } from 'vitest';
import { RequestActionFacade } from './request-action.facade';
import { ReplenishmentApi } from '../../replenishment/data-access/replenishment-api';
import { CommandError } from '../../replenishment/data-access/command-error';
it('keeps the original legacy unknown command when the retired writer requests an update', async () => {
  let calls = 0;
  const runAction = vi.fn(async (_input: unknown) => {
      throw new CommandError(
        ++calls === 1 ? 'UNKNOWN' : 'CLIENT_UPDATE_REQUIRED',
        'Reload the app to inspect this delivery.',
      );
    }),
    close = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      RequestActionFacade,
      {
        provide: MAT_DIALOG_DATA,
        useValue: {
          type: 'RECEIVE',
          request: {
            id: 'request',
            salonId: 'salon',
            state: 'DISPATCHED',
            revision: 3,
            items: [{ productId: 'product', quantity: 2 }],
          },
        },
      },
      { provide: MatDialogRef, useValue: { close, disableClose: false } },
      { provide: ReplenishmentApi, useValue: { runAction } },
    ],
  });
  const f = TestBed.inject(RequestActionFacade);
  f.model.update((v) => ({ ...v, allIntact: true }));
  await f.confirm();
  await f.confirm();
  expect(runAction.mock.calls[1]).toEqual(runAction.mock.calls[0]);
  expect(close).not.toHaveBeenCalled();
  expect(f.unknown()).toBe(true);
  expect(f.error()).toEqual({ key: 'requests.action.errors.clientUpdate' });
});
