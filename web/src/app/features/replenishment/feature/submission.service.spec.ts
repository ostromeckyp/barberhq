import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { expect, it, vi } from 'vitest';
import { SubmissionService } from './submission.service';
import { SessionFacade } from '../../auth/feature/session.facade';
import { ReplenishmentApi } from '../data-access/replenishment-api';
import { PENDING_STORAGE, PendingSubmissionStore } from '../data-access/pending-submission.store';
import { CommandError } from '../data-access/command-error';
import type { SessionState } from '../../../../../../shared/contracts/business/index';
import type { ReadyDraftLine } from '../../../../../../shared/contracts/draft/index';
import type { StockAction, CommandResult } from '../../../../../../shared/contracts/stock/index';
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
const result: CommandResult = {
  requestId: 'one',
  actionReceiptId: 'receipt',
  state: 'PENDING_APPROVAL',
  revision: 1,
  replayed: false,
};
function setup(
  runAction: (a: StockAction) => Promise<CommandResult>,
  storage: Storage = sessionStorage,
) {
  const ready: SessionState = {
    status: 'READY',
    membership: { userId: 'u', businessId: 'b', role: 'SALON', salonIds: ['salon', 'other'] },
  };
  const state = signal<SessionState>(ready);
  const providers = [
    { provide: SessionFacade, useValue: { state } },
    { provide: ReplenishmentApi, useValue: { runAction } },
    { provide: PENDING_STORAGE, useValue: storage },
  ];
  TestBed.configureTestingModule({ providers });
  return {
    state,
    ready,
    providers,
    service: TestBed.inject(SubmissionService),
    store: TestBed.inject(PendingSubmissionStore),
  };
}
it('allows_hq_submission_and_recovers_its_original_payload_without_impersonation', async () => {
  sessionStorage.clear();
  const sent: StockAction[] = [];
  const h = setup(async (action) => {
    sent.push(structuredClone(action));
    if (sent.length === 1) throw new CommandError('UNKNOWN', 'Lost');
    return result;
  });
  h.state.set({
    status: 'READY',
    membership: { userId: 'hq', businessId: 'b', role: 'HQ', salonIds: ['salon'] },
  });
  TestBed.tick();
  await h.service.submit('salon', [line('a')]);
  expect(sent).toHaveLength(1);
  expect(h.store.load()).toMatchObject({ kind: 'PENDING', value: { userId: 'hq' } });
  await h.service.resume('salon');
  expect(sent).toEqual([sent[0], sent[0]]);
  expect(h.service.outcome()?.status).toBe('CREATED');
  await h.service.submit('foreign', [line('a')]);
  expect(sent).toHaveLength(2);
});
it('recovers_one_frozen_payload_and_key_after_reload', async () => {
  sessionStorage.clear();
  const sent: StockAction[] = [];
  let lost = true;
  const h = setup(async (action) => {
    sent.push(structuredClone(action));
    if (lost) {
      lost = false;
      throw new CommandError('UNKNOWN', 'Lost');
    }
    return result;
  });
  await h.service.submit('salon', [line('c'), line('a'), line('b')]);
  expect(sent).toHaveLength(1);
  expect(h.service.outcome()?.status).toBe('UNKNOWN');
  const first = sent[0];
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: h.providers });
  const restored = TestBed.inject(SubmissionService);
  await restored.resume('salon');
  expect(sent).toEqual([first, first]);
  expect(restored.outcome()).toEqual({ status: 'CREATED', requestId: 'one' });
  expect(TestBed.inject(PendingSubmissionStore).load()).toEqual({ kind: 'EMPTY' });
  await restored.resume('salon');
  expect(sent).toHaveLength(2);
});
it('preserves_unknown_on_session_error_and_only_resumes_in_saved_salon', async () => {
  sessionStorage.clear();
  const send = vi
    .fn()
    .mockRejectedValueOnce(new CommandError('UNKNOWN', 'lost'))
    .mockResolvedValue(result);
  const h = setup(send);
  await h.service.submit('salon', [line('a'), line('b')]);
  const pending = h.store.load();
  h.state.set({ status: 'ERROR' });
  TestBed.tick();
  expect(h.store.load()).toEqual(pending);
  await h.service.resume('salon');
  expect(send).toHaveBeenCalledTimes(1);
  h.state.set(h.ready);
  TestBed.tick();
  await h.service.resume('other');
  expect(send).toHaveBeenCalledTimes(1);
  await h.service.resume('salon');
  expect(send).toHaveBeenCalledTimes(2);
});
it('double_click_sends_once_and_late_response_cannot_leak_to_new_identity', async () => {
  sessionStorage.clear();
  let finish!: (r: CommandResult) => void;
  const send = vi.fn(() => new Promise<CommandResult>((resolve) => (finish = resolve)));
  const h = setup(send);
  const saving = h.service.submit('salon', [line('a')]);
  await h.service.submit('salon', [line('b')]);
  expect(send).toHaveBeenCalledTimes(1);
  h.state.set({ status: 'SIGNED_OUT' });
  TestBed.tick();
  finish(result);
  await saving;
  expect(h.service.outcome()).toBeUndefined();
  expect(h.store.load()).toEqual({ kind: 'EMPTY' });
});
it('definitive_conflict_keeps_all_items_available_for_correction', async () => {
  sessionStorage.clear();
  const h = setup(async () => {
    throw new CommandError('ALREADY_ACTIVE', 'conflict', [
      { productId: 'a', requestId: 'existing' },
    ]);
  });
  await h.service.submit('salon', [line('a'), line('b')]);
  expect(h.service.outcome()?.status).toBe('FAILED');
  expect(h.service.submittedItems().map((i) => i.productId)).toEqual(['a', 'b']);
  expect(h.store.load()).toEqual({ kind: 'EMPTY' });
});
it('blocked_journal_or_storage_failure_prevents_writes', async () => {
  sessionStorage.clear();
  sessionStorage.setItem('barberhq.pending.v1', '{}');
  const send = vi.fn().mockResolvedValue(result);
  const h = setup(send);
  await h.service.submit('salon', [line('a')]);
  expect(send).not.toHaveBeenCalled();
  expect(sessionStorage.getItem('barberhq.pending.v1')).toBe('{}');
  TestBed.resetTestingModule();
  const broken = setup(send, {
    getItem: () => null,
    setItem() {
      throw Error('Denied');
    },
    removeItem() {},
  } as unknown as Storage);
  await broken.service.submit('salon', [line('a')]);
  expect(send).not.toHaveBeenCalled();
  expect(broken.service.error()).toContain('storage');
});

it('clears_completed_result_when_ready_identity_changes_directly', async () => {
  sessionStorage.clear();
  const h = setup(async () => result);
  TestBed.tick();
  await h.service.submit('salon', [line('a')]);
  expect(h.service.outcome()?.status).toBe('CREATED');
  h.state.set({
    status: 'READY',
    membership: { userId: 'new', businessId: 'b', role: 'SALON', salonIds: ['salon'] },
  });
  TestBed.tick();
  expect(h.service.outcome()).toBeUndefined();
  expect(h.service.submittedItems()).toEqual([]);
});
