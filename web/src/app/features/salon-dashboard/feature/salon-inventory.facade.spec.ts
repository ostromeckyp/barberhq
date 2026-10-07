import { ApplicationRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { BrowserActivity } from '../../../core/browser-activity';
import { SessionFacade } from '../../auth/feature/session.facade';
import { InventoryApi } from '../data-access/inventory-api';
import { SalonInventoryFacade } from './salon-inventory.facade';
import type { InventoryRow, SessionState } from '../../../../../../shared/contracts/business';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const row: InventoryRow = {
  productId: 'p1',
  demoId: 'NBS-MATOWA-100',
  productName: 'Pomada Matowa',
  netContent: { value: 100, unit: 'ml' },
  salonId: 'legnicka',
  salonOnHand: 2,
  salonInventoryVersion: 1,
  hqOnHand: 10,
  hqReserved: 3,
  hqAvailable: 7,
  hqInventoryVersion: 1,
};
function setup() {
  const state = signal<SessionState>({
    status: 'READY',
    membership: { userId: 'u1', businessId: 'demo', role: 'HQ', salonIds: ['legnicka', 'lodzka'] },
  });
  const params = new BehaviorSubject(convertToParamMap({ salonId: 'legnicka' }));
  const online = signal(true),
    refreshTick = signal(0);
  const first = deferred<InventoryRow[]>();
  const getInventory = vi
    .fn<(id: string, abort: AbortSignal) => Promise<InventoryRow[]>>()
    .mockReturnValueOnce(first.promise);
  TestBed.configureTestingModule({
    providers: [
      SalonInventoryFacade,
      { provide: ActivatedRoute, useValue: { paramMap: params } },
      { provide: BrowserActivity, useValue: { online, refreshTick } },
      {
        provide: SessionFacade,
        useValue: {
          state,
          salons: signal([
            { id: 'legnicka', name: 'Legnicka' },
            { id: 'lodzka', name: 'Łódzka' },
          ]),
          canOpen: (id: string) => {
            const s = state();
            return s.status === 'READY' && s.membership.salonIds.includes(id);
          },
        },
      },
      { provide: InventoryApi, useValue: { getInventory } },
    ],
  });
  const facade = TestBed.inject(SalonInventoryFacade);
  TestBed.tick();
  const settled = async () => {
    await TestBed.inject(ApplicationRef).whenStable();
    TestBed.tick();
  };
  return { facade, state, params, online, refreshTick, first, getInventory, settled };
}

describe('SalonInventoryFacade', () => {
  it('loads scoped quantities and distinguishes a failed first read from empty stock', async () => {
    const h = setup();
    expect(h.facade.loading()).toBe(true);
    expect(h.getInventory.mock.calls[0][0]).toBe('legnicka');
    h.first.reject(new Error('offline'));
    await h.settled();
    expect(h.facade.error()).toBe(true);
    expect(h.facade.rows()).toEqual([]);
    expect(h.facade.stale()).toBe(false);
  });
  it('keeps last known quantities after a failed refresh and recovers on retry', async () => {
    const h = setup();
    h.first.resolve([row]);
    await h.settled();
    expect(h.facade.rows()).toEqual([row]);
    h.getInventory.mockRejectedValueOnce(new Error('offline'));
    h.facade.refresh();
    TestBed.tick();
    await h.settled();
    expect(h.facade.rows()).toEqual([row]);
    expect(h.facade.stale()).toBe(true);
    h.getInventory.mockResolvedValueOnce([{ ...row, salonOnHand: 4 }]);
    h.facade.refresh();
    TestBed.tick();
    await h.settled();
    expect(h.facade.rows()[0].salonOnHand).toBe(4);
    expect(h.facade.stale()).toBe(false);
  });
  it('never restores inventory when a response arrives after sign-out', async () => {
    const h = setup();
    h.state.set({ status: 'SIGNED_OUT' });
    TestBed.tick();
    expect(h.facade.rows()).toEqual([]);
    h.first.resolve([row]);
    await h.settled();
    expect(h.facade.rows()).toEqual([]);
  });
  it('clears cached quantities on salon change and ignores the old response', async () => {
    const h = setup();
    const next = deferred<InventoryRow[]>();
    h.getInventory.mockReturnValueOnce(next.promise);
    h.params.next(convertToParamMap({ salonId: 'lodzka' }));
    TestBed.tick();
    expect(h.facade.rows()).toEqual([]);
    expect(h.getInventory.mock.calls[0][1].aborted).toBe(true);
    next.resolve([{ ...row, salonId: 'lodzka', salonOnHand: 5 }]);
    h.first.resolve([row]);
    await h.settled();
    expect(h.facade.name()).toBe('Łódzka');
    expect(h.facade.rows()[0].salonOnHand).toBe(5);
  });
  it('does not carry a successful snapshot into another salon with a failed read', async () => {
    const h = setup();
    h.first.resolve([row]);
    await h.settled();
    expect(h.facade.rows()).toHaveLength(1);
    h.getInventory.mockRejectedValueOnce(new Error('offline'));
    h.params.next(convertToParamMap({ salonId: 'lodzka' }));
    TestBed.tick();
    await h.settled();
    expect(h.facade.error()).toBe(true);
    expect(h.facade.rows()).toEqual([]);
  });
  it('marks offline data stale and refreshes on browser reconnect or focus', async () => {
    const h = setup();
    h.first.resolve([row]);
    await h.settled();
    expect(h.facade.rows()).toHaveLength(1);
    h.online.set(false);
    expect(h.facade.stale()).toBe(true);
    h.getInventory.mockResolvedValueOnce([{ ...row, salonOnHand: 6 }]);
    h.online.set(true);
    h.refreshTick.update((n) => n + 1);
    TestBed.tick();
    await h.settled();
    expect(h.facade.rows()[0].salonOnHand).toBe(6);
    expect(h.facade.stale()).toBe(false);
  });
});
