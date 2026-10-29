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

it('keeps an HQ user in an authorized salon while viewing a source, then returns there', async () => {
  const state = signal<SessionState>({
    status: 'READY',
    membership: { userId: 'hq', businessId: 'business', role: 'HQ', salonIds: ['salon-a'] },
  });
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'salons/:salonId', component: Empty },
        { path: 'hq', component: Empty },
        { path: 'procedures/sources/:versionId', component: Empty },
      ]),
      { provide: SessionFacade, useValue: { state, home: () => '/hq' } },
    ],
  });
  const router = TestBed.inject(Router);
  const context = TestBed.inject(SalonContext);
  await router.navigateByUrl('/salons/salon-a');
  expect(context.workspace()).toEqual({ kind: 'SALON', salonId: 'salon-a' });
  await router.navigateByUrl('/procedures/sources/version-1');
  expect(context.workspace()).toEqual({ kind: 'SALON', salonId: 'salon-a' });
  expect(router.serializeUrl(context.home())).toBe('/salons/salon-a');
});

it('preserves the selected workspace across every procedures route', async () => {
  const state = signal<SessionState>({
    status: 'READY',
    membership: { userId: 'hq', businessId: 'business', role: 'HQ', salonIds: ['salon-a'] },
  });
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'salons/:salonId', component: Empty },
        { path: 'hq', component: Empty },
        { path: 'procedures', component: Empty },
        { path: 'procedures/review/:versionId', component: Empty },
        { path: 'procedures/sources/:versionId', component: Empty },
      ]),
      { provide: SessionFacade, useValue: { state, home: () => '/hq' } },
    ],
  });
  const router = TestBed.inject(Router);
  const context = TestBed.inject(SalonContext);
  await router.navigateByUrl('/salons/salon-a');
  await router.navigateByUrl('/procedures?tab=documents');
  expect(context.workspace()).toEqual({ kind: 'SALON', salonId: 'salon-a' });
  await router.navigateByUrl('/procedures/review/doc:v2');
  expect(context.workspace()).toEqual({ kind: 'SALON', salonId: 'salon-a' });
  expect(router.serializeUrl(context.home())).toBe('/salons/salon-a');
});

it('defaults a direct source URL to the first authorized salon for a salon user', async () => {
  const state = signal<SessionState>({
    status: 'READY',
    membership: {
      userId: 'salon-user',
      businessId: 'business',
      role: 'SALON',
      salonIds: ['salon-b'],
    },
  });
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: 'procedures/sources/:versionId', component: Empty }]),
      { provide: SessionFacade, useValue: { state, home: () => '/salons/salon-b' } },
    ],
  });
  const router = TestBed.inject(Router);
  const context = TestBed.inject(SalonContext);
  await router.navigateByUrl('/procedures/sources/version-1');
  expect(context.workspace()).toEqual({ kind: 'SALON', salonId: 'salon-b' });
  expect(router.serializeUrl(context.home())).toBe('/salons/salon-b');
});

it('drops remembered workspace on sign-out and never gives it to another account', async () => {
  const state = signal<SessionState>({
    status: 'READY',
    membership: { userId: 'hq-one', businessId: 'business-one', role: 'HQ', salonIds: ['salon-a'] },
  });
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'salons/:salonId', component: Empty },
        { path: 'procedures/sources/:versionId', component: Empty },
      ]),
      { provide: SessionFacade, useValue: { state, home: () => '/hq' } },
    ],
  });
  const router = TestBed.inject(Router);
  const context = TestBed.inject(SalonContext);
  await router.navigateByUrl('/salons/salon-a');
  expect(context.workspace()).toEqual({ kind: 'SALON', salonId: 'salon-a' });
  await router.navigateByUrl('/procedures/sources/version-1');
  state.set({ status: 'SIGNED_OUT' });
  expect(context.workspace()).toBeUndefined();
  state.set({
    status: 'READY',
    membership: { userId: 'hq-two', businessId: 'business-two', role: 'HQ', salonIds: ['salon-a'] },
  });
  expect(context.workspace()).toEqual({ kind: 'HQ' });
  expect(router.serializeUrl(context.home())).toBe('/hq');
});

it('forgets the workspace after leaving the source flow for another global route', async () => {
  const state = signal<SessionState>({
    status: 'READY',
    membership: { userId: 'hq', businessId: 'business', role: 'HQ', salonIds: ['salon-a'] },
  });
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'salons/:salonId', component: Empty },
        { path: 'other', component: Empty },
        { path: 'procedures/sources/:versionId', component: Empty },
      ]),
      { provide: SessionFacade, useValue: { state, home: () => '/hq' } },
    ],
  });
  const router = TestBed.inject(Router);
  const context = TestBed.inject(SalonContext);
  await router.navigateByUrl('/salons/salon-a');
  expect(context.workspace()).toEqual({ kind: 'SALON', salonId: 'salon-a' });
  await router.navigateByUrl('/other');
  await router.navigateByUrl('/procedures/sources/version-1');
  expect(context.workspace()).toEqual({ kind: 'HQ' });
});
