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
  await restored.resume();
  expect(keys).toEqual([keys[0], keys[0], keys[2]]);
  expect(keys).toHaveLength(3);
  expect(committed.size).toBe(2);
  await restored.resume();
  expect(keys).toHaveLength(3);
  expect(TestBed.inject(PendingSubmissionStore).load()).toBeUndefined();
  state.set({ status: 'SIGNED_OUT' });
  TestBed.tick();
  expect(restored.rows()).toEqual([]);
});
