import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { expect, it } from 'vitest';
import { SalonContext } from './salon-context';
import { SessionFacade } from '../features/auth/feature/session.facade';
import type { SessionState } from '../../../../shared/contracts/business';
@Component({ template: '' })
class Empty {}
it('derives_workspace_from_url_and_always_switches_to_inventory', async () => {
  const state = signal<SessionState>({
    status: 'READY',
    membership: { userId: 'u', businessId: 'b', role: 'SALON', salonIds: ['a', 'b'] },
  });
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'salons/:salonId/requests', component: Empty },
        { path: 'salons/:salonId', component: Empty },
        { path: 'salons/:salonId/requests/:requestId', component: Empty },
        { path: 'hq', component: Empty },
        { path: 'hq/requests/:requestId', component: Empty },
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
  expect(router.url).toBe('/salons/b');
  await router.navigateByUrl('/salons/a/requests/r1');
  expect(context.salonId()).toBe('a');
  expect(await context.switchWorkspace('HQ')).toBe(false);
  state.set({
    status: 'READY',
    membership: { userId: 'hq', businessId: 'b', role: 'HQ', salonIds: ['a', 'b'] },
  });
  await context.switchWorkspace('HQ');
  expect(router.url).toBe('/hq');
  expect(context.salonId()).toBeUndefined();
  await router.navigateByUrl('/hq/requests/r1');
  expect(context.workspace()).toEqual({ kind: 'HQ' });
  await context.switchWorkspace('SALON:a');
  expect(router.url).toBe('/salons/a');
  expect(await context.switchSalon('foreign')).toBe(false);
  state.set({ status: 'SIGNED_OUT' });
  expect(context.salonId()).toBeUndefined();
});
