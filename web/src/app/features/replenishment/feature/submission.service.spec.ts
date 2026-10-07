import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { expect, it, vi } from 'vitest';
import { SubmissionService } from './submission.service';
import { SessionFacade } from '../../auth/feature/session.facade';
import { ReplenishmentApi } from '../data-access/replenishment-api';
import { PENDING_STORAGE, PendingSubmissionStore } from '../data-access/pending-submission.store';
import { CommandError } from '../data-access/command-error';
import type { SessionState } from '../../../../../../shared/contracts/business';
import type { ReadyDraftLine } from '../../../../../../shared/contracts/draft';
import type { StockAction } from '../../../../../../shared/contracts/stock';
const line = (id: string): ReadyDraftLine => ({
  status: 'READY',
  lineId: id,
  productId: id,
  productName: id,
  quantity: 2,
  origin: 'manual',
  hqAvailable: 18,
  salonOnHand: 2,
  hqInventoryVersion: 1,
  salonInventoryVersion: 1,
});
it('stops_on_unknown_and_refresh_reconciles_same_key_without_resending_confirmed_rows', async () => {
  sessionStorage.clear();
  const state = signal<SessionState>({
    status: 'READY',
    membership: { userId: 'u', businessId: 'b', role: 'SALON', salonIds: ['salon'] },
  });
  const keys: string[] = [];
  const committed = new Map<string, string>();
  let lose = true;
  const runAction = vi.fn(async (action: StockAction) => {
    const key = action.input.idempotencyKey;
    keys.push(key);
    const id = committed.get(key) ?? String(committed.size + 1);
    committed.set(key, id);
    if (lose) {
      lose = false;
      throw new CommandError('UNKNOWN', 'Lost response');
    }
    return { requestId: id };
  });
  const providers = [
    { provide: SessionFacade, useValue: { state } },
    { provide: ReplenishmentApi, useValue: { runAction } },
    { provide: PENDING_STORAGE, useValue: sessionStorage },
  ];
  TestBed.configureTestingModule({ providers });
  const service = TestBed.inject(SubmissionService);
  await service.submit('salon', [line('1'), line('2')]);
  expect(keys).toHaveLength(1);
  expect(service.rows()[0].status).toBe('UNKNOWN');
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers });
  const restored = TestBed.inject(SubmissionService);
  await restored.resume('salon');
  expect(keys).toEqual([keys[0], keys[0], keys[2]]);
  expect(keys).toHaveLength(3);
  expect(committed.size).toBe(2);
  await restored.resume('salon');
  expect(keys).toHaveLength(3);
  expect(TestBed.inject(PendingSubmissionStore).load()).toBeUndefined();
  state.set({ status: 'SIGNED_OUT' });
  TestBed.tick();
  expect(restored.rows()).toEqual([]);
});
function recoveryFixture() {
  sessionStorage.clear();
  const ready: SessionState = {
    status: 'READY',
    membership: { userId: 'u', businessId: 'b', role: 'SALON', salonIds: ['salon', 'other'] },
  };
  const state = signal<SessionState>(ready);
  const keys: string[] = [];
  let lose = true;
  const runAction = vi.fn(async (action: StockAction) => {
    keys.push(action.input.idempotencyKey);
    if (lose) {
      lose = false;
      throw new CommandError('UNKNOWN', 'Lost response');
    }
    return { requestId: action.input.idempotencyKey };
  });
  TestBed.configureTestingModule({
    providers: [
      { provide: SessionFacade, useValue: { state } },
      { provide: ReplenishmentApi, useValue: { runAction } },
      { provide: PENDING_STORAGE, useValue: sessionStorage },
    ],
  });
  return {
    state,
    ready,
    keys,
    service: TestBed.inject(SubmissionService),
    storage: TestBed.inject(PendingSubmissionStore),
  };
}
it('transient_session_error_preserves_unknown_and_unsent_rows_until_access_recovers', async () => {
  const h = recoveryFixture();
  await h.service.submit('salon', [line('1'), line('2')]);
  const pending = h.storage.load();
  h.state.set({ status: 'ERROR' });
  TestBed.tick();
  expect(h.storage.load()).toEqual(pending);
  await h.service.resume('salon');
  expect(h.keys).toHaveLength(1);
  h.state.set(h.ready);
  TestBed.tick();
  await h.service.resume('salon');
  expect(h.keys).toEqual([
    pending!.rows[0].payload.idempotencyKey,
    pending!.rows[0].payload.idempotencyKey,
    pending!.rows[1].payload.idempotencyKey,
  ]);
});
it('reconciliation_cannot_send_a_saved_batch_from_a_different_salon_page', async () => {
  const h = recoveryFixture();
  await h.service.submit('salon', [line('1'), line('2')]);
  const pending = h.storage.load();
  await h.service.resume('other');
  expect(h.keys).toHaveLength(1);
  expect(h.storage.load()).toEqual(pending);
  await h.service.resume('salon');
  expect(h.keys).toHaveLength(3);
});
