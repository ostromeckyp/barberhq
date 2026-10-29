import { afterEach, beforeEach, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { StockRepository } from '../../functions/src/stock/repository.ts';
import type { DeliveryAction } from '../../shared/contracts/delivery.ts';
import {
  createDeliveryHarness,
  executeDelivery,
  readDeliverySnapshot,
  openDeliveryIssue,
  dispatchDeliveryRequest,
  receiveDeliveryRequest,
  seedDispatchedDelivery,
  type DeliveryHarness,
} from '../support/delivery.ts';
let h: DeliveryHarness;
beforeEach(async () => {
  h = undefined!;
  h = await createDeliveryHarness('delivery-replacement');
});
afterEach(async () => {
  if (h) await h.dispose();
});
const create = (issueId: string, expectedRevision = 1, idempotencyKey = randomUUID()) =>
  executeDelivery(h, 'hq', {
    type: 'CREATE_REPLACEMENT',
    input: { issueId, expectedRevision, idempotencyKey },
  });
it('creates_exact_outstanding_then_resolves_after_good_receipt', async () => {
  const { issueId, rootRequestId, productId } = await openDeliveryIssue(h),
    before = await readDeliverySnapshot(h);
  const child = await create(issueId),
    created = await readDeliverySnapshot(h),
    request = created.requests.find((row) => row.id === child.replacementRequestId)!;
  expect(request).toMatchObject({
    salonId: h.legnickaId,
    state: 'PENDING_APPROVAL',
    replacementIssueId: issueId,
    items: [expect.objectContaining({ productId, quantity: 2 })],
  });
  expect(created.inventories).toEqual(before.inventories);
  expect(created.movements).toEqual(before.movements);
  await dispatchDeliveryRequest(h, request.id);
  expect((await readDeliverySnapshot(h)).issues[0]).toMatchObject({
    status: 'REPLACEMENT_IN_PROGRESS',
    activeReplacementRequestId: request.id,
  });
  await receiveDeliveryRequest(h, request.id);
  const after = await readDeliverySnapshot(h);
  expect(after.receipts.find((row) => row.requestId === rootRequestId)?.items[0].goodQuantity).toBe(
    8,
  );
  expect(after.receipts.find((row) => row.requestId === request.id)?.items[0].goodQuantity).toBe(2);
  expect(after.issues).toHaveLength(1);
  expect(after.issues[0]).toMatchObject({
    status: 'RESOLVED',
    revision: 3,
    activeReplacementRequestId: null,
    items: [
      expect.objectContaining({ initialAffectedQuantity: 2, replacementAcceptedQuantity: 2 }),
    ],
  });
  expect(after.requests.find((row) => row.id === rootRequestId)?.state).toBe('RECEIVED_WITH_ISSUE');
  expect(
    after.movements
      .filter((row) => row.type === 'DISPATCH')
      .reduce((sum, row) => sum + row.quantity, 0),
  ).toBe(12);
  expect(after.salonInventory.onHand).toBe(12);
  expect(after.hqInventory.onHand).toBe(6);
});
it('second_defect_reduces_remaining_from_two_to_one_without_new_entitlement', async () => {
  const { issueId } = await openDeliveryIssue(h),
    child = await create(issueId);
  await dispatchDeliveryRequest(h, child.replacementRequestId!);
  await receiveDeliveryRequest(h, child.replacementRequestId!, 1, 1);
  const partial = await readDeliverySnapshot(h);
  expect(partial.issues).toHaveLength(1);
  expect(partial.issues[0]).toMatchObject({
    status: 'IN_REVIEW',
    revision: 3,
    activeReplacementRequestId: null,
    items: [
      expect.objectContaining({ initialAffectedQuantity: 2, replacementAcceptedQuantity: 1 }),
    ],
  });
  const next = await create(issueId, 3),
    created = await readDeliverySnapshot(h);
  expect(
    created.requests.find((row) => row.id === next.replacementRequestId)?.items[0].quantity,
  ).toBe(1);
  await dispatchDeliveryRequest(h, next.replacementRequestId!);
  await receiveDeliveryRequest(h, next.replacementRequestId!);
  const after = await readDeliverySnapshot(h);
  expect(after.issues).toHaveLength(1);
  expect(after.issues[0]).toMatchObject({
    status: 'RESOLVED',
    revision: 5,
    items: [
      expect.objectContaining({ initialAffectedQuantity: 2, replacementAcceptedQuantity: 2 }),
    ],
  });
  expect(after.events.map((row) => row.revision)).toEqual([1, 2, 3, 4, 5]);
  expect(after.salonInventory.onHand).toBe(12);
});
it('review_and_note_retry_keep_one_event_and_stock_unchanged', async () => {
  const { issueId } = await openDeliveryIssue(h),
    before = await readDeliverySnapshot(h);
  const review: DeliveryAction = {
    type: 'START_REVIEW',
    input: { issueId, expectedRevision: 1, idempotencyKey: randomUUID() },
  };
  const first = await executeDelivery(h, 'hq', review);
  expect(await executeDelivery(h, 'hq', review)).toEqual({ ...first, replayed: true });
  const note: DeliveryAction = {
    type: 'ADD_NOTE',
    input: {
      issueId,
      expectedRevision: 2,
      idempotencyKey: randomUUID(),
      text: 'HQ is organizing a replacement.',
    },
  };
  const saved = await executeDelivery(h, 'hq', note);
  expect(await executeDelivery(h, 'hq', note)).toEqual({ ...saved, replayed: true });
  const after = await readDeliverySnapshot(h);
  expect(after.issues[0]).toMatchObject({ status: 'IN_REVIEW', revision: 3 });
  expect(after.events.map((row) => row.type)).toEqual(['OPENED', 'REVIEW_STARTED', 'NOTE_ADDED']);
  expect(after.inventories).toEqual(before.inventories);
  expect(after.movements).toEqual(before.movements);
  for (const role of ['legnicka', 'foreign'] as const)
    await expect(
      executeDelivery(h, role, {
        ...note,
        input: { ...note.input, expectedRevision: 3, idempotencyKey: randomUUID() },
      } as DeliveryAction),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
});
it('rejected_child_clears_active_pointer_without_satisfying_issue', async () => {
  const { issueId } = await openDeliveryIssue(h),
    child = await create(issueId),
    before = await readDeliverySnapshot(h);
  await new StockRepository(h.operator).execute(h.users.hq, {
    type: 'REJECT',
    input: {
      requestId: child.replacementRequestId!,
      expectedRevision: 1,
      idempotencyKey: randomUUID(),
      reason: 'Await new stock',
    },
  });
  const after = await readDeliverySnapshot(h);
  expect(after.issues[0]).toMatchObject({
    status: 'IN_REVIEW',
    revision: 3,
    activeReplacementRequestId: null,
    items: [expect.objectContaining({ replacementAcceptedQuantity: 0 })],
  });
  expect(after.activeRequests).toEqual([]);
  expect(after.events.at(-1)?.type).toBe('REPLACEMENT_REJECTED');
  expect(after.inventories).toEqual(before.inventories);
  expect((await create(issueId, 3)).replacementRequestId).toBeTruthy();
});
it('zero_good_child_keeps_original_two_units_outstanding', async () => {
  const { issueId } = await openDeliveryIssue(h),
    child = await create(issueId);
  await dispatchDeliveryRequest(h, child.replacementRequestId!);
  await receiveDeliveryRequest(h, child.replacementRequestId!, 0, 0, 2);
  const after = await readDeliverySnapshot(h);
  expect(after.issues).toHaveLength(1);
  expect(after.issues[0]).toMatchObject({
    status: 'IN_REVIEW',
    activeReplacementRequestId: null,
    items: [
      expect.objectContaining({ initialAffectedQuantity: 2, replacementAcceptedQuantity: 0 }),
    ],
  });
  expect(after.movements.filter((row) => row.type === 'RECEIPT')).toHaveLength(1);
  expect(after.salonInventory.onHand).toBe(10);
});
it('ordinary_active_order_blocks_replacement_without_bypass', async () => {
  const { issueId, productId } = await openDeliveryIssue(h);
  const ordinary = await new StockRepository(h.operator).execute(h.users.legnicka, {
    type: 'SUBMIT',
    input: {
      salonId: h.legnickaId,
      items: [{ productId, quantity: 1 }],
      idempotencyKey: randomUUID(),
    },
  });
  const before = await readDeliverySnapshot(h);
  await expect(create(issueId)).rejects.toMatchObject({
    code: 'ALREADY_ACTIVE',
    conflicts: [{ productId, requestId: ordinary.requestId }],
  });
  expect(await readDeliverySnapshot(h)).toEqual(before);
});
it('ordinary_unlinked_receipt_does_not_resolve_root_issue', async () => {
  const { issueId, productId } = await openDeliveryIssue(h);
  const ordinary = await new StockRepository(h.operator).execute(h.users.legnicka, {
    type: 'SUBMIT',
    input: {
      salonId: h.legnickaId,
      items: [{ productId, quantity: 2 }],
      idempotencyKey: randomUUID(),
    },
  });
  await dispatchDeliveryRequest(h, ordinary.requestId);
  await receiveDeliveryRequest(h, ordinary.requestId);
  const after = await readDeliverySnapshot(h);
  expect(after.issues[0]).toMatchObject({
    id: issueId,
    status: 'OPEN',
    revision: 1,
    items: [expect.objectContaining({ replacementAcceptedQuantity: 0 })],
  });
});
it('shortage_leaves_child_pending_and_issue_active', async () => {
  const { issueId } = await openDeliveryIssue(h),
    child = await create(issueId);
  await h.setInventory('hq', 'NBS-MATOWA-100', 1);
  const before = await readDeliverySnapshot(h);
  await expect(dispatchDeliveryRequest(h, child.replacementRequestId!)).rejects.toMatchObject({
    code: 'INSUFFICIENT_STOCK',
  });
  expect(await readDeliverySnapshot(h)).toEqual(before);
  expect(before.issues[0].status).toBe('REPLACEMENT_IN_PROGRESS');
});
it('replacement_quantities_and_salon_cannot_come_from_client', async () => {
  const { issueId } = await openDeliveryIssue(h),
    before = await readDeliverySnapshot(h);
  for (const extra of [{ quantity: 99 }, { salonId: 'foreign' }, { productId: 'foreign' }])
    await expect(
      executeDelivery(h, 'hq', {
        type: 'CREATE_REPLACEMENT',
        input: { issueId, expectedRevision: 1, idempotencyKey: randomUUID(), ...extra },
      } as DeliveryAction),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  await expect(
    new StockRepository(h.operator).execute(h.users.legnicka, {
      type: 'SUBMIT',
      input: {
        salonId: h.legnickaId,
        items: [{ productId: `${h.businessId}:NBS-MATOWA-100`, quantity: 2 }],
        idempotencyKey: randomUUID(),
        replacementIssueId: issueId,
      },
    } as never),
  ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  expect(await readDeliverySnapshot(h)).toEqual(before);
});
it('foreign_actor_and_stale_issue_have_no_effects', async () => {
  const { issueId } = await openDeliveryIssue(h),
    before = await readDeliverySnapshot(h);
  await expect(
    executeDelivery(h, 'foreign', {
      type: 'CREATE_REPLACEMENT',
      input: { issueId, expectedRevision: 1, idempotencyKey: randomUUID() },
    }),
  ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  expect(await readDeliverySnapshot(h)).toEqual(before);
  await executeDelivery(h, 'hq', {
    type: 'START_REVIEW',
    input: { issueId, expectedRevision: 1, idempotencyKey: randomUUID() },
  });
  const reviewed = await readDeliverySnapshot(h);
  await expect(create(issueId, 1)).rejects.toMatchObject({ code: 'STALE_STATE' });
  expect(await readDeliverySnapshot(h)).toEqual(reviewed);
});
it('next_replacement_contains_only_the_still_outstanding_product', async () => {
  const original = await seedDispatchedDelivery(h, [10, 3]);
  const opened = await executeDelivery(h, 'legnicka', {
    type: 'RECORD_RECEIPT',
    input: {
      requestId: original.requestId,
      expectedRevision: 3,
      idempotencyKey: randomUUID(),
      items: [
        {
          productId: original.items[0].productId,
          goodQuantity: 8,
          damagedQuantity: 2,
          missingQuantity: 0,
        },
        {
          productId: original.items[1].productId,
          goodQuantity: 0,
          damagedQuantity: 0,
          missingQuantity: 3,
        },
      ],
      report: { description: 'Damage and shortage', batchIdentifier: null },
      procedureReferences: [],
    },
  });
  const child = await create(opened.issueId!);
  await dispatchDeliveryRequest(h, child.replacementRequestId!);
  const childRequest = (await readDeliverySnapshot(h)).requests.find(
    (row) => row.id === child.replacementRequestId,
  )!;
  await executeDelivery(h, 'legnicka', {
    type: 'RECORD_RECEIPT',
    input: {
      requestId: childRequest.id,
      expectedRevision: 3,
      idempotencyKey: randomUUID(),
      items: childRequest.items.map((item) => ({
        productId: item.productId,
        goodQuantity: 2,
        damagedQuantity: item.productId === original.items[1].productId ? 1 : 0,
        missingQuantity: 0,
      })),
      report: { description: 'One replacement unit damaged', batchIdentifier: null },
      procedureReferences: [],
    },
  });
  const next = await create(opened.issueId!, 3),
    snapshot = await readDeliverySnapshot(h);
  expect(snapshot.requests.find((row) => row.id === next.replacementRequestId)?.items).toEqual([
    expect.objectContaining({ productId: original.items[1].productId, quantity: 1 }),
  ]);
  await dispatchDeliveryRequest(h, next.replacementRequestId!);
  await receiveDeliveryRequest(h, next.replacementRequestId!);
  const after = await readDeliverySnapshot(h);
  expect(after.issues).toHaveLength(1);
  expect(after.issues[0].status).toBe('RESOLVED');
  expect(
    after.issues[0].items.find((row) => row.productId === original.items[0].productId),
  ).toMatchObject({ initialAffectedQuantity: 2, replacementAcceptedQuantity: 2 });
  expect(
    after.issues[0].items.find((row) => row.productId === original.items[1].productId),
  ).toMatchObject({ initialAffectedQuantity: 3, replacementAcceptedQuantity: 3 });
});
it('hq_replay_rechecks_role_before_returning_old_result', async () => {
  const { issueId } = await openDeliveryIssue(h),
    key = randomUUID();
  await create(issueId, 1, key);
  await h.operator.executeGraphql(
    'mutation($uid:String!){membership_update(key:{uid:$uid},data:{role:SALON})}',
    { variables: { uid: h.users.hq } },
  );
  const before = await readDeliverySnapshot(h);
  await expect(create(issueId, 1, key)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  expect(await readDeliverySnapshot(h)).toEqual(before);
});
