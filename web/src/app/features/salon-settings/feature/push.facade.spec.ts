import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { expect, it, vi } from 'vitest';
import { Language } from '../../../core/language';
import { PushDeniedError, PushMessaging } from '../../../core/push-messaging';
import { SessionFacade } from '../../auth/feature/session.facade';
import { PushApi } from '../data-access/push-api';
import { PushFacade } from './push.facade';

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
