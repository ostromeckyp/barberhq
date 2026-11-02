import { TestBed } from '@angular/core/testing';
import { httpsCallable } from 'firebase/functions';
import { expect, it, vi } from 'vitest';
import { FIREBASE } from '../../../core/firebase.providers';
import { PushApi } from './push-api';

vi.mock('firebase/functions', () => ({ httpsCallable: vi.fn() }));

it('calls the register and unregister ops on the commands callable', async () => {
  const callable = vi.fn(async () => ({ data: { ok: true } }));
  vi.mocked(httpsCallable).mockReturnValue(callable as never);
  const functions = {};
  TestBed.configureTestingModule({
    providers: [{ provide: FIREBASE, useValue: { functions, appCheck: async () => null } }],
  });
  const api = TestBed.inject(PushApi);
  await api.register('t', 'pl');
  await api.unregister('t');
  expect(httpsCallable).toHaveBeenCalledWith(functions, 'commands');
  expect(callable).toHaveBeenCalledWith({
    op: 'registerPushToken',
    input: { token: 't', locale: 'pl' },
  });
  expect(callable).toHaveBeenCalledWith({ op: 'unregisterPushToken', input: { token: 't' } });
});
