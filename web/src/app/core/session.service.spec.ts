import { TestBed } from '@angular/core/testing';
import { SessionService } from './session.service';
import { SESSION_GATEWAY, type SessionGateway, type ResolvedMember } from './session.gateway';
import { describe, it, expect, vi } from 'vitest';
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
  const session = TestBed.inject(SessionService);
  return { session, changed: (uid: string | null) => changed(uid), resolve, reject };
}
const member: ResolvedMember = {
  membership: { userId: 'one', businessId: 'demo', role: 'SALON', salonIds: ['legnicka'] },
  salons: [{ id: 'legnicka', name: 'Legnicka' }],
};
describe('SessionService', () => {
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
