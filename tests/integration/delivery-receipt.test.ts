import { afterEach, beforeEach, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { DeliveryAction, RecordDeliveryInput } from '../../shared/contracts/delivery.ts';
import { StockRepository } from '../../functions/src/stock/repository.ts';
import { DeliveryRepository } from '../../functions/src/delivery/repository.ts';
import { payloadHash, semanticHash } from '../../functions/src/stock/intent.ts';
import type { StockAction } from '../../shared/contracts/stock.ts';
import {
  createDeliveryHarness,
  executeDelivery,
  readDeliverySnapshot,
  seedDispatchedDelivery,
  type DeliveryHarness,
} from '../support/delivery.ts';
let h: DeliveryHarness;
beforeEach(async () => {
  h = undefined!;
  h = await createDeliveryHarness('delivery-receipt');
});
afterEach(async () => {
  if (h) await h.dispose();
});
async function fixture(quantities = [10]) {
  const request = await seedDispatchedDelivery(h, quantities);
  const input: RecordDeliveryInput = {
    requestId: request.requestId,
    expectedRevision: 3,
    idempotencyKey: randomUUID(),
    items: request.items.map((item) => ({
      productId: item.productId,
      goodQuantity: item.quantity,
      damagedQuantity: 0,
      missingQuantity: 0,
    })),
    procedureReferences: [],
  };
  return { request, input };
}
const record = (input: RecordDeliveryInput, role: keyof DeliveryHarness['users'] = 'legnicka') =>
  executeDelivery(h, role, { type: 'RECORD_RECEIPT', input });
it.each(['damaged', 'missing'] as const)('records_8_good_2_%s', async (kind) => {
  const { input } = await fixture();
  input.items[0] = {
    ...input.items[0],
    goodQuantity: 8,
    damagedQuantity: kind === 'damaged' ? 2 : 0,
    missingQuantity: kind === 'missing' ? 2 : 0,
  };
  input.report = { description: 'Two units are not usable', batchIdentifier: null };
  const result = await record(input),
    after = await readDeliverySnapshot(h);
  expect(after.hqInventory).toMatchObject({ onHand: 8, reserved: 0 });
  expect(after.salonInventory).toMatchObject({ onHand: 10 });
  expect(after.receipts).toHaveLength(1);
  expect(after.receiptItems[0]).toMatchObject(input.items[0]);
  expect(after.issues[0].items[0].initialAffectedQuantity).toBe(2);
  expect(after.requests[0].state).toBe('RECEIVED_WITH_ISSUE');
  expect(after.activeRequests).toEqual([]);
  expect(after.commands).toHaveLength(1);
  expect(after.keys).toHaveLength(1);
  expect(after.events).toHaveLength(1);
  expect(result).toMatchObject({
    requestId: input.requestId,
    requestRevision: 4,
    issueRevision: 1,
    replayed: false,
  });
});
it('complete_good_receipt_has_no_issue', async () => {
  const { input } = await fixture();
  await record(input);
  const after = await readDeliverySnapshot(h);
  expect(after.salonInventory.onHand).toBe(12);
  expect(after.issues).toEqual([]);
  expect(after.requests[0].state).toBe('RECEIVED');
  expect(after.activeRequests).toEqual([]);
});
it('zero_good_receipt_records_problem_without_zero_movement', async () => {
  const { input } = await fixture();
  input.items[0] = { ...input.items[0], goodQuantity: 0, missingQuantity: 10 };
  input.report = { description: 'Parcel missing', batchIdentifier: null };
  await record(input);
  const after = await readDeliverySnapshot(h);
  expect(after.salonInventory.onHand).toBe(2);
  expect(after.receiptItems[0].missingQuantity).toBe(10);
  expect(after.movements.filter((row) => row.type === 'RECEIPT')).toEqual([]);
  expect(after.issues[0].items[0].initialAffectedQuantity).toBe(10);
});
it('swapped_product_quantities_fail_per_item_validation', async () => {
  const { input } = await fixture([10, 3]);
  input.items[0].goodQuantity = 3;
  input.items[1].goodQuantity = 10;
  const before = await readDeliverySnapshot(h);
  await expect(record(input)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  expect(await readDeliverySnapshot(h)).toEqual(before);
});
it.each(['foreign-sku', 'missing-item', 'stale-revision'] as const)(
  'invalid_%s_has_no_effects',
  async (kind) => {
    const { input } = await fixture([10, 3]);
    if (kind === 'foreign-sku') input.items[1].productId = 'foreign-sku';
    if (kind === 'missing-item') input.items.pop();
    if (kind === 'stale-revision') input.expectedRevision = 2;
    const before = await readDeliverySnapshot(h);
    await expect(record(input)).rejects.toThrow();
    expect(await readDeliverySnapshot(h)).toEqual(before);
  },
);
it('last_inventory_guard_failure_rolls_back_first_item_and_receipt', async () => {
  const { input } = await fixture([10, 3]);
  // Remove the last sorted destination row so native SQL must abort after earlier writes.
  const last = [...input.items].sort((a, b) => (a.productId < b.productId ? -1 : 1)).at(-1)!;
  await h.operator.executeGraphql(
    'mutation($salonId:String!,$productId:String!){inventory_delete(key:{locationId:$salonId,productId:$productId})}',
    { variables: { salonId: h.legnickaId, productId: last.productId } },
  );
  const before = await readDeliverySnapshot(h);
  await expect(record(input)).rejects.toMatchObject({ code: 'STALE_STATE' });
  expect(await readDeliverySnapshot(h)).toEqual(before);
});
it('same_key_after_lost_response_replays_only_one_commit', async () => {
  const { input } = await fixture();
  const first = await record(input);
  const before = await readDeliverySnapshot(h);
  expect(await record(input)).toEqual({ ...first, replayed: true });
  expect(await readDeliverySnapshot(h)).toEqual(before);
  await expect(
    record({
      ...input,
      items: [{ ...input.items[0], goodQuantity: 8, damagedQuantity: 2 }],
      report: { description: 'Changed classification', batchIdentifier: null },
    }),
  ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  expect(await readDeliverySnapshot(h)).toEqual(before);
});
it('two_concurrent_receipts_with_distinct_keys_commit_once', async () => {
  const { input } = await fixture();
  const results = await Promise.allSettled([
    record(input),
    record({ ...input, idempotencyKey: randomUUID() }),
  ]);
  expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
  const after = await readDeliverySnapshot(h);
  expect(after.receipts).toHaveLength(1);
  expect(after.movements.filter((row) => row.type === 'RECEIPT')).toHaveLength(1);
  expect(after.commands).toHaveLength(1);
  expect(after.salonInventory.onHand).toBe(12);
});
it('replay_rechecks_current_scope_before_returning_result', async () => {
  const { input } = await fixture();
  await record(input);
  await h.operator.executeGraphql(
    'mutation($uid:String!,$salonId:String!){salonAccess_delete(key:{membershipUid:$uid,locationId:$salonId})}',
    { variables: { uid: h.users.legnicka, salonId: h.legnickaId } },
  );
  const before = await readDeliverySnapshot(h);
  await expect(record(input)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  expect(await readDeliverySnapshot(h)).toEqual(before);
});
it.each(['foreign', 'lodzka', 'unassigned'] as const)(
  'unauthorized_%s_cannot_record_receipt',
  async (role) => {
    const { input } = await fixture();
    const before = await readDeliverySnapshot(h);
    await expect(record(input, role)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(await readDeliverySnapshot(h)).toEqual(before);
  },
);
it('uncommitted_legacy_receive_requires_client_update_without_writes', async () => {
  const { input } = await fixture();
  const before = await readDeliverySnapshot(h);
  await expect(
    new StockRepository(h.operator).execute(h.users.legnicka, {
      type: 'RECEIVE',
      input: {
        requestId: input.requestId,
        expectedRevision: 3,
        idempotencyKey: randomUUID(),
        items: input.items.map((item) => ({
          productId: item.productId,
          receivedQuantity: item.goodQuantity,
        })),
        allIntact: true,
      },
    }),
  ).rejects.toMatchObject({ code: 'CLIENT_UPDATE_REQUIRED' });
  expect(await readDeliverySnapshot(h)).toEqual(before);
});
it('lost_native_response_after_commit_reconciles_the_same_key', async () => {
  const { input } = await fixture();
  let lost = false;
  const transport = new Proxy(h.operator, {
    get(target, property) {
      if (property === 'executeMutation')
        return async (...args: Parameters<typeof target.executeMutation>) => {
          const result = await target.executeMutation(...args);
          if (args[0] === 'RecordDeliveryTransaction' && !lost) {
            lost = true;
            throw new Error('Simulated transport loss after real SQL commit');
          }
          return result;
        };
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  const result = await new DeliveryRepository(transport).execute(h.users.legnicka, {
    type: 'RECORD_RECEIPT',
    input,
  });
  expect(lost).toBe(true);
  expect(result.replayed).toBe(true);
  const after = await readDeliverySnapshot(h);
  expect(after.receipts).toHaveLength(1);
  expect(after.commands).toHaveLength(1);
  expect(after.salonInventory.onHand).toBe(12);
});
it.each(['foreign', 'revoked', 'unpublished'] as const)(
  'unavailable_%s_procedure_rolls_back_the_receipt',
  async (kind) => {
    const { input } = await fixture();
    let businessId = h.businessId;
    if (kind === 'foreign')
      businessId = (
        (
          await h.operator.executeGraphql(
            'query($uid:String!){membership(key:{uid:$uid}){businessId}}',
            { variables: { uid: h.users.foreign } },
          )
        ).data as { membership: { businessId: string } }
      ).membership.businessId;
    const documentId = randomUUID(),
      versionId = randomUUID();
    await h.operator.executeGraphql(
      `mutation($documentId:String!,$versionId:String!,$businessId:String!,$publishedAt:Timestamp,$revokedAt:Timestamp){
    knowledgeDocument_insert(data:{id:$documentId,businessId:$businessId,documentCode:$documentId})
    knowledgeVersion_insert(data:{id:$versionId,documentId:$documentId,businessId:$businessId,versionLabel:"1",title:"Delivery procedure",language:"en",sourceType:SYNTHETIC_PROCEDURE,synthetic:true,sourceUrls:[],status:READY,pdfSha256:"fixture",publishedAt:$publishedAt,revokedAt:$revokedAt})
  }`,
      {
        variables: {
          documentId,
          versionId,
          businessId,
          publishedAt: kind === 'unpublished' ? null : '2026-10-25T00:00:00Z',
          revokedAt: kind === 'revoked' ? '2026-10-25T01:00:00Z' : null,
        },
      },
    );
    input.procedureReferences = [{ kind: 'DAMAGED', versionId }];
    const before = await readDeliverySnapshot(h);
    await expect(record(input)).rejects.toMatchObject({ code: 'SOURCE_CHANGED' });
    expect(await readDeliverySnapshot(h)).toEqual(before);
  },
);
it('all_six_products_keep_their_own_classification_and_stock', async () => {
  const { input } = await fixture([10, 3, 4, 5, 6, 7]);
  input.items = input.items.map((item, i) => ({
    ...item,
    goodQuantity: [8, 0, 1, 0, 5, 7][i],
    damagedQuantity: [2, 0, 0, 5, 0, 0][i],
    missingQuantity: [0, 3, 3, 0, 1, 0][i],
  }));
  input.report = { description: 'Mixed damage and shortages', batchIdentifier: 'B-6' };
  await record(input);
  const after = await readDeliverySnapshot(h);
  for (const item of input.items) {
    expect(after.receiptItems.find((row) => row.productId === item.productId)).toMatchObject(item);
    expect(
      after.inventories.find(
        (row) => row.locationId === h.legnickaId && row.productId === item.productId,
      )?.onHand,
    ).toBe(2 + item.goodQuantity);
  }
  expect(
    after.movements
      .filter((row) => row.type === 'RECEIPT')
      .map((row) => row.quantity)
      .sort((a, b) => a - b),
  ).toEqual([1, 5, 7, 8]);
  expect(after.issues[0].items).toHaveLength(5);
  expect(after.activeRequests).toEqual([]);
});
it('concurrent_same_key_returns_one_immutable_result', async () => {
  const { input } = await fixture();
  const [first, second] = await Promise.all([record(input), record(input)]);
  expect(first.commandId).toBe(second.commandId);
  const after = await readDeliverySnapshot(h);
  expect(after.receipts).toHaveLength(1);
  expect(after.commands).toHaveLength(1);
  expect(after.keys).toHaveLength(1);
});
it('already_committed_legacy_key_reconciles_without_new_stock', async () => {
  const { input } = await fixture();
  const action: StockAction = {
    type: 'RECEIVE',
    input: {
      requestId: input.requestId,
      expectedRevision: 3,
      idempotencyKey: randomUUID(),
      items: input.items.map((item) => ({
        productId: item.productId,
        receivedQuantity: item.goodQuantity,
      })),
      allIntact: true,
    },
  };
  const actionId = randomUUID(),
    before = await readDeliverySnapshot(h),
    itemId = before.requests[0].items[0].id;
  await h.operator.executeGraphql(
    `mutation($requestId:String!,$businessId:String!,$salonId:String!,$productId:String!,$itemId:String!,$actorUid:String!,$receiptId:String!,$key:String!,$payloadHash:String!,$semanticHash:String!) @transaction {
    replenishmentRequest_update(id:$requestId,data:{state:RECEIVED,revision:4})
    inventory_update(key:{locationId:$salonId,productId:$productId},data:{onHand:12,version_update:{inc:1}})
    transferItem_update(key:{requestItemId:$itemId},data:{receivedQuantity:10})
    stockMovement_insert(data:{transferItemRequestItemId:$itemId,businessId:$businessId,type:RECEIPT,quantity:10,actorUid:$actorUid})
    activeRequest_deleteMany(where:{requestId:{eq:$requestId},businessId:{eq:$businessId}})
    actionReceipt_insert(data:{id:$receiptId,businessId:$businessId,actorUid:$actorUid,idempotencyKey:$key,requestId:$requestId,action:RECEIVE,payloadHash:$payloadHash,semanticHash:$semanticHash,state:RECEIVED,revision:4})
    actionKey_insert(data:{businessId:$businessId,actorUid:$actorUid,idempotencyKey:$key,receiptId:$receiptId,payloadHash:$payloadHash})
  }`,
    {
      variables: {
        requestId: input.requestId,
        businessId: h.businessId,
        salonId: h.legnickaId,
        productId: input.items[0].productId,
        itemId,
        actorUid: h.users.legnicka,
        receiptId: actionId,
        key: action.input.idempotencyKey,
        payloadHash: payloadHash(action),
        semanticHash: semanticHash(action),
      },
    },
  );
  const committed = await readDeliverySnapshot(h);
  expect(await new StockRepository(h.operator).execute(h.users.legnicka, action)).toMatchObject({
    actionReceiptId: actionId,
    state: 'RECEIVED',
    revision: 4,
    replayed: true,
  });
  expect(await readDeliverySnapshot(h)).toEqual(committed);
});
it('native_guard_cannot_be_bypassed_by_a_valid_optional_report', async () => {
  const { input } = await fixture([10, 3]);
  input.report = { description: 'Inspection completed', batchIdentifier: null };
  const transport = new Proxy(h.operator, {
    get(target, property) {
      if (property === 'executeMutation')
        return (operation: string, variables: Record<string, unknown>) => {
          if (operation === 'RecordDeliveryTransaction')
            variables = {
              ...variables,
              productIds: [...(variables.productIds as string[])].reverse(),
            };
          return target.executeMutation(operation, variables);
        };
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  const before = await readDeliverySnapshot(h);
  await expect(
    new DeliveryRepository(transport).execute(h.users.legnicka, { type: 'RECORD_RECEIPT', input }),
  ).rejects.toMatchObject({ code: 'STALE_STATE' });
  expect(await readDeliverySnapshot(h)).toEqual(before);
});
