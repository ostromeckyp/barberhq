import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { expect, it, vi } from 'vitest';
import { SalonContext } from '../core/salon-context';
import { SessionFacade } from '../features/auth/feature/session.facade';
import { PushFacade } from '../features/salon-settings/feature/push.facade';
import { ShellFacade } from './shell.facade';

it('signs out even when push unregister rejects', async () => {
  const signOut = vi.fn(async () => undefined);
  TestBed.configureTestingModule({
    providers: [
      ShellFacade,
      provideRouter([]),
      {
        provide: SessionFacade,
        useValue: { state: signal({ status: 'SIGNED_OUT' }), salons: signal([]), signOut },
      },
      {
        provide: SalonContext,
        useValue: {
          workspace: signal(null),
          home: signal('/'),
          salonId: signal(null),
          selectedWorkspace: signal(null),
        },
      },
      {
        provide: PushFacade,
        useValue: { unregisterOnSignOut: vi.fn(async () => Promise.reject(new Error('x'))) },
      },
    ],
  });
  const facade = TestBed.inject(ShellFacade);
  await facade.signOut();
  expect(signOut).toHaveBeenCalled();
});
