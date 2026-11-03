import { TestBed } from '@angular/core/testing';
import { SessionFacade } from './session.facade';
import { SESSION_GATEWAY, type SessionGateway } from '../data-access/session.gateway';
import type { ResolvedMember } from '../models/resolved-member';
import { describe, it, expect, vi } from 'vitest';
import { ClientLog } from '../../../core/client-log';
function setup() {
  let changed: (uid: string | null) => void = () => undefined;
  let resolve: (value: ResolvedMember | null) => void = () => undefined;
  let reject: (error: Error) => void = () => undefined;
  const deferred = new Promise<ResolvedMember | null>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  const gateway: SessionGateway = {
    observe: (cb) => {
      changed = cb;
      return () => undefined;
    },
    membership: () => deferred,
    signIn: vi.fn(async () => undefined),
    signOut: vi.fn(async () => undefined),
  };
  TestBed.configureTestingModule({ providers: [{ provide: SESSION_GATEWAY, useValue: gateway }] });
  const session = TestBed.inject(SessionFacade);
  return { session, changed: (uid: string | null) => changed(uid), resolve, reject };
}
const member: ResolvedMember = {
  membership: { userId: 'one', businessId: 'demo', role: 'SALON', salonIds: ['legnicka'] },
  salons: [{ id: 'legnicka', name: 'Legnicka' }],
};
describe('SessionFacade', () => {
  it('late_response_does_not_restore_signed_out_data', async () => {
    const h = setup();
    h.changed('one');
    await h.session.signOut();
    h.resolve(member);
    await Promise.resolve();
    await Promise.resolve();
    expect(h.session.state().status).toBe('SIGNED_OUT');
  });
  it('shows no access for authenticated users without membership', async () => {
    const h = setup();
    h.changed('one');
    h.resolve(null);
    await Promise.resolve();
    await Promise.resolve();
    expect(h.session.state().status).toBe('NO_ACCESS');
  });
  it('reports a failed membership read separately from no access', async () => {
    const h = setup();
    h.changed('one');
    h.reject(new Error('offline'));
    await Promise.resolve();
    await Promise.resolve();
    expect(h.session.state().status).toBe('ERROR');
  });
});

it('explicit sign-out removes only the current user delivery recovery data', async () => {
  const h = setup();
  h.changed('one');
  h.resolve(member);
  await Promise.resolve();
  await Promise.resolve();
  const owned =
    'barberhq.delivery.v1.' +
    encodeURIComponent(JSON.stringify(['one', 'demo', 'legnicka', 'request']));
  const other =
    'barberhq.delivery.v1.' +
    encodeURIComponent(JSON.stringify(['two', 'demo', 'legnicka', 'request']));
  localStorage.setItem(owned, 'saved');
  localStorage.setItem(other, 'keep');
  localStorage.setItem('unrelated', 'keep');
  await h.session.signOut();
  expect(localStorage.getItem(owned)).toBeNull();
  expect(localStorage.getItem(other)).toBe('keep');
  expect(localStorage.getItem('unrelated')).toBe('keep');
  localStorage.removeItem(other);
  localStorage.removeItem('unrelated');
});
describe('SessionFacade logging', () => {
  function logged(membership: ResolvedMember | null | Error) {
    let changed: (uid: string | null) => void = () => undefined;
    const log = { record: vi.fn(), setContext: vi.fn() };
    const gateway: SessionGateway = {
      observe: (cb) => {
        changed = cb;
        return () => undefined;
      },
      membership: () =>
        membership instanceof Error ? Promise.reject(membership) : Promise.resolve(membership),
      signIn: vi.fn(async () => {
        throw Object.assign(new Error('x'), { code: 'auth/invalid-credential' });
      }),
      signOut: vi.fn(async () => undefined),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: SESSION_GATEWAY, useValue: gateway },
        { provide: ClientLog, useValue: log },
      ],
    });
    const session = TestBed.inject(SessionFacade);
    return { session, log, changed: (uid: string | null) => changed(uid) };
  }
  const settle = async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve();
  };

  it('sets the log context and records ready', async () => {
    const h = logged(member);
    h.changed('one');
    await settle();
    expect(h.log.setContext).toHaveBeenCalledWith({
      role: 'SALON',
      businessId: 'demo',
      salonId: 'legnicka',
    });
    expect(h.log.record).toHaveBeenCalledWith('session.signedIn');
    expect(h.log.record).toHaveBeenCalledWith('session.ready', 'ok', {
      details: { role: 'SALON' },
    });
  });

  it('records no access and errors', async () => {
    const none = logged(null);
    none.changed('one');
    await settle();
    expect(none.log.record).toHaveBeenCalledWith('session.noAccess', 'error');
    TestBed.resetTestingModule();
    const failed = logged(new Error('down'));
    failed.changed('one');
    await settle();
    expect(failed.log.record).toHaveBeenCalledWith('session.error', 'error');
  });

  it('records a failed sign-in with the auth code and rethrows', async () => {
    const h = logged(member);
    await expect(h.session.signIn('a@b.c', 'pw')).rejects.toBeDefined();
    expect(h.log.record).toHaveBeenCalledWith('session.signIn.failed', 'error', {
      code: 'auth/invalid-credential',
    });
    expect(JSON.stringify(h.log.record.mock.calls)).not.toContain('a@b.c');
  });

  it('clears the context and records sign-out', async () => {
    const h = logged(member);
    h.changed('one');
    await settle();
    await h.session.signOut();
    expect(h.log.record).toHaveBeenCalledWith('session.signedOut');
    expect(h.log.setContext).toHaveBeenLastCalledWith({});
  });
});
