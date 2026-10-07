import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { expect, it } from 'vitest';
import { SalonContext } from './salon-context';
import { SessionFacade } from '../features/auth/feature/session.facade';
import type { SessionState } from '../../../../shared/contracts/business';
@Component({ template: '' })
class Empty {}
it('switches_activity_without_scope_leaks', async () => {
  const state = signal<SessionState>({
    status: 'READY',
    membership: { userId: 'u', businessId: 'b', role: 'SALON', salonIds: ['a', 'b'] },
  });
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'salons/:salonId/requests', component: Empty },
        { path: 'salons/:salonId', component: Empty },
        { path: 'requests/:requestId', component: Empty },
      ]),
      {
        provide: SessionFacade,
        useValue: {
          state,
          salons: signal([
            { id: 'a', name: 'A' },
            { id: 'b', name: 'B' },
          ]),
        },
      },
    ],
  });
  const router = TestBed.inject(Router),
    context = TestBed.inject(SalonContext);
  await router.navigateByUrl('/salons/a/requests');
  expect(context.salonId()).toBe('a');
  await context.switchSalon('b');
  expect(router.url).toBe('/salons/b/requests');
  await router.navigateByUrl('/requests/r1');
  expect(context.salonId()).toBeUndefined();
  context.setDetailSalon('r1', 'a');
  expect(context.salonId()).toBe('a');
  await router.navigateByUrl('/requests/r2');
  context.setDetailSalon('r1', 'a');
  expect(context.salonId()).toBeUndefined();
  context.setDetailSalon('r2', 'b');
  await context.switchSalon('a');
  expect(router.url).toBe('/salons/a/requests');
  expect(await context.switchSalon('foreign')).toBe(false);
  state.set({ status: 'SIGNED_OUT' });
  expect(context.salonId()).toBeUndefined();
});
