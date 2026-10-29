import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { it, expect } from 'vitest';
import type { SessionState } from '../../../../../../shared/contracts/business/index';
import { SessionFacade } from '../../auth/feature/session.facade';
import { SalonContext, type Workspace } from '../../../core/salon-context';
import { DeliveryDraftStore } from './delivery-draft.store';
const scope = { userId: 'one', businessId: 'business', salonId: 'salon', targetId: 'request' };
function setup() {
  const session = signal<SessionState>({
      status: 'READY',
      membership: { ...scope, role: 'SALON', salonIds: ['salon', 'other'] },
    }),
    workspace = signal<Workspace | undefined>({ kind: 'SALON', salonId: 'salon' });
  TestBed.configureTestingModule({
    providers: [
      { provide: SessionFacade, useValue: { state: session } },
      { provide: SalonContext, useValue: { workspace } },
    ],
  });
  const store = TestBed.inject(DeliveryDraftStore);
  store.activate(scope, [
    { productId: 'product', goodQuantity: 0, damagedQuantity: 0, missingQuantity: 0 },
  ]);
  store.model.update((v) => ({ ...v, description: 'Keep my draft', batchIdentifier: 'LOT-42' }));
  TestBed.flushEffects();
  return { store, session, workspace };
}
it('keeps an unsent draft in memory across PDF return and transient auth errors', () => {
  const { store, session, workspace } = setup();
  session.set({ status: 'ERROR' });
  workspace.set(undefined);
  TestBed.flushEffects();
  expect(store.model().description).toBe('Keep my draft');
  session.set({ status: 'READY', membership: { ...scope, role: 'SALON', salonIds: ['salon'] } });
  workspace.set({ kind: 'SALON', salonId: 'salon' });
  TestBed.flushEffects();
  store.activate(scope, []);
  expect(store.model().batchIdentifier).toBe('LOT-42');
});
it('clears incompatible unsent fields after a verified workspace switch', () => {
  const { store, workspace } = setup();
  workspace.set({ kind: 'SALON', salonId: 'other' });
  TestBed.flushEffects();
  expect(store.model().description).toBe('');
  expect(store.scope()).toBeNull();
});
it('clears unsent fields on sign out or a new verified account', () => {
  const { store, session } = setup();
  session.set({
    status: 'READY',
    membership: { ...scope, userId: 'two', role: 'SALON', salonIds: ['salon'] },
  });
  TestBed.flushEffects();
  expect(store.model().description).toBe('');
});
