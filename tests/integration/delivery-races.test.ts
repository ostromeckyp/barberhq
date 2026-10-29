import { afterEach, beforeEach, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { StockRepository } from '../../functions/src/stock/repository.ts';
import {
  createDeliveryHarness,
  executeDelivery,
  readDeliverySnapshot,
  openDeliveryIssue,
  dispatchDeliveryRequest,
  receiveDeliveryRequest,
  type DeliveryHarness,
} from '../support/delivery.ts';
let h: DeliveryHarness;
beforeEach(async () => {
  h = undefined!;
  h = await createDeliveryHarness('delivery-races');
});
afterEach(async () => {
  if (h) await h.dispose();
});
const create = (issueId: string, key = randomUUID()) =>
  executeDelivery(h, 'hq', {
    type: 'CREATE_REPLACEMENT',
    input: { issueId, expectedRevision: 1, idempotencyKey: key },
  });
it('concurrent_distinct_keys_create_only_one_active_replacement', async () => {
  const { issueId } = await openDeliveryIssue(h);
  const results = await Promise.allSettled([create(issueId), create(issueId)]);
  expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
  const after = await readDeliverySnapshot(h);
  expect(after.requests.filter((row) => row.replacementIssueId === issueId)).toHaveLength(1);
  expect(after.activeRequests).toHaveLength(1);
  expect(after.issues[0].revision).toBe(2);
  expect(after.commands).toHaveLength(2);
});
it('replacement_retry_and_concurrent_same_key_reuse_child', async () => {
  const { issueId } = await openDeliveryIssue(h),
    key = randomUUID();
  const [first, second] = await Promise.all([create(issueId, key), create(issueId, key)]);
  expect(first.replacementRequestId).toBe(second.replacementRequestId);
  expect((await create(issueId, key)).replayed).toBe(true);
  const after = await readDeliverySnapshot(h);
  expect(after.requests).toHaveLength(2);
  expect(after.events).toHaveLength(2);
  expect(after.keys).toHaveLength(2);
});
it('review_note_and_replacement_revision_race_has_one_winner', async () => {
  const { issueId } = await openDeliveryIssue(h),
    before = await readDeliverySnapshot(h);
  const results = await Promise.allSettled([
    create(issueId),
    executeDelivery(h, 'hq', {
      type: 'ADD_NOTE',
      input: {
        issueId,
        expectedRevision: 1,
        idempotencyKey: randomUUID(),
        text: 'Checking the replacement.',
      },
    }),
  ]);
  expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
  const after = await readDeliverySnapshot(h);
  expect(after.issues[0].revision).toBe(2);
  expect(after.events).toHaveLength(2);
  expect(after.inventories).toEqual(before.inventories);
});
it('two_receipts_cannot_satisfy_one_replacement_twice', async () => {
  const { issueId } = await openDeliveryIssue(h),
    child = await create(issueId);
  await dispatchDeliveryRequest(h, child.replacementRequestId!);
  const results = await Promise.allSettled([
    receiveDeliveryRequest(h, child.replacementRequestId!),
    receiveDeliveryRequest(h, child.replacementRequestId!),
  ]);
  expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
  const after = await readDeliverySnapshot(h);
  expect(after.issues[0]).toMatchObject({
    status: 'RESOLVED',
    revision: 3,
    items: [
      expect.objectContaining({ initialAffectedQuantity: 2, replacementAcceptedQuantity: 2 }),
    ],
  });
  expect(after.salonInventory.onHand).toBe(12);
  expect(after.events).toHaveLength(3);
});
it.each([false, true])('rejection_vs_receipt_is_atomic_dispatched_%s', async (dispatched) => {
  const { issueId } = await openDeliveryIssue(h),
    child = await create(issueId);
  if (dispatched) await dispatchDeliveryRequest(h, child.replacementRequestId!);
  const results = await Promise.allSettled([
    new StockRepository(h.operator).execute(h.users.hq, {
      type: 'REJECT',
      input: {
        requestId: child.replacementRequestId!,
        expectedRevision: dispatched ? 3 : 1,
        idempotencyKey: randomUUID(),
        reason: 'Replan replacement',
      },
    }),
    receiveDeliveryRequest(h, child.replacementRequestId!),
  ]);
  expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
  const after = await readDeliverySnapshot(h);
  expect(after.issues[0]).toMatchObject({
    status: dispatched ? 'RESOLVED' : 'IN_REVIEW',
    revision: 3,
    activeReplacementRequestId: null,
  });
  expect(after.activeRequests).toEqual([]);
  expect(after.issues[0].items[0].replacementAcceptedQuantity).toBe(dispatched ? 2 : 0);
});
