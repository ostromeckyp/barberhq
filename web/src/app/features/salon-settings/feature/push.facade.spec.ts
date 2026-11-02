import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, expect, it, vi } from 'vitest';
import { ApplicationRef } from '@angular/core';
import { Language } from '../../../core/language';
import { PushDeniedError, PushMessaging } from '../../../core/push-messaging';
import { SessionFacade } from '../../auth/feature/session.facade';
import { PushApi } from '../data-access/push-api';
import { PushFacade } from './push.facade';

beforeEach(() => localStorage.clear());

function setup(status = 'default', role = 'SALON') {
  const messaging = {
    status: vi.fn(async () => status),
    enable: vi.fn(async () => 'tok'),
    currentToken: vi.fn(async () => 'tok'),
    disable: vi.fn(async () => undefined),
  };
  const api = {
    register: vi.fn(async () => undefined),
    unregister: vi.fn(async () => undefined),
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: PushMessaging, useValue: messaging },
      { provide: PushApi, useValue: api },
      { provide: Language, useValue: { current: () => 'pl' } },
      {
        provide: SessionFacade,
        useValue: { state: signal({ status: 'READY', membership: { role } }) },
      },
    ],
  });
  return { messaging, api, facade: TestBed.inject(PushFacade) };
}

it('init re-registers the current token once when granted', async () => {
  const h = setup('granted');
  await h.facade.init();
  expect(h.facade.status()).toBe('granted');
  expect(h.api.register).toHaveBeenCalledTimes(1);
  expect(h.api.register).toHaveBeenCalledWith('tok', 'pl');
});

it('init does not register when not granted', async () => {
  const h = setup('default');
  await h.facade.init();
  expect(h.api.register).not.toHaveBeenCalled();
});

it('enable success registers and grants', async () => {
  const h = setup();
  await h.facade.enable();
  expect(h.api.register).toHaveBeenCalledWith('tok', 'pl');
  expect(h.facade.status()).toBe('granted');
  expect(h.facade.busy()).toBe(false);
});

it('enable maps denial and failure', async () => {
  const h = setup();
  h.messaging.enable.mockRejectedValueOnce(new PushDeniedError());
  await h.facade.enable();
  expect(h.facade.status()).toBe('denied');
  h.api.register.mockRejectedValueOnce(new Error('x'));
  await h.facade.enable();
  expect(h.facade.status()).toBe('error');
});

it('disable unregisters then deletes the token', async () => {
  const h = setup('granted');
  await h.facade.disable();
  expect(h.api.unregister).toHaveBeenCalledWith('tok');
  expect(h.api.unregister.mock.invocationCallOrder[0]).toBeLessThan(
    h.messaging.disable.mock.invocationCallOrder[0],
  );
  expect(h.facade.status()).toBe('default');
});

it('unregisterOnSignOut resolves when unregister rejects', async () => {
  const h = setup('granted');
  h.api.unregister.mockRejectedValue(new Error('offline'));
  await expect(h.facade.unregisterOnSignOut()).resolves.toBeUndefined();
});

it('is available for salon staff only', () => {
  expect(setup('granted', 'HQ').facade.available()).toBe(false);
});

it('turn off survives a new visit: no re-register, status default', async () => {
  const first = setup('granted');
  await first.facade.disable();
  TestBed.resetTestingModule();
  const second = setup('granted');
  await second.facade.init();
  expect(second.api.register).not.toHaveBeenCalled();
  expect(second.facade.status()).toBe('default');
});

it('enable clears the opt-out', async () => {
  const h = setup('granted');
  await h.facade.disable();
  await h.facade.enable();
  TestBed.resetTestingModule();
  const next = setup('granted');
  await next.facade.init();
  expect(next.api.register).toHaveBeenCalledTimes(1);
});

it('re-registers on sign-in for salon staff without visiting settings', async () => {
  const h = setup('granted');
  TestBed.tick();
  await TestBed.inject(ApplicationRef).whenStable();
  expect(h.api.register).toHaveBeenCalledTimes(1);
});

it('HQ devices never call getToken or unregister', async () => {
  const h = setup('granted', 'HQ');
  TestBed.tick();
  await TestBed.inject(ApplicationRef).whenStable();
  await h.facade.init();
  await h.facade.unregisterOnSignOut();
  expect(h.messaging.currentToken).not.toHaveBeenCalled();
  expect(h.api.register).not.toHaveBeenCalled();
  expect(h.api.unregister).not.toHaveBeenCalled();
});

it('init never asks for permission', async () => {
  const h = setup('default');
  await h.facade.init();
  expect(h.messaging.enable).not.toHaveBeenCalled();
});

it('a failing silent init keeps the status and shows no error', async () => {
  const h = setup('granted');
  h.messaging.currentToken.mockRejectedValueOnce(new Error('sw'));
  await h.facade.init();
  expect(h.facade.status()).toBe('granted');
  h.messaging.status.mockRejectedValueOnce(new Error('sw'));
  await h.facade.init();
  expect(h.facade.status()).not.toBe('error');
});

it('a failing user-initiated enable shows the error', async () => {
  const h = setup();
  h.messaging.enable.mockRejectedValueOnce(new Error('x'));
  await h.facade.enable();
  expect(h.facade.status()).toBe('error');
});
