import { DeliveryRepository } from '../../functions/src/delivery/repository.ts';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createCloudHarness } from '../support/cloud.ts';
import { StockRepository } from '../../functions/src/stock/repository.ts';

let h: Awaited<ReturnType<typeof createCloudHarness>>;
let repo: StockRepository;
beforeEach(async () => {
  h = await createCloudHarness('hq-receive');
  repo = new StockRepository(h.operator);
});
afterEach(async () => {
  if (h) await h.dispose();
});

async function dispatchedRequest(submittedBy: 'hq' | 'legnicka' = 'hq') {
  const created = await repo.execute(h.users[submittedBy], {
    type: 'SUBMIT',
    input: {
      salonId: h.legnickaId,
      items: [{ productId: `${h.businessId}:NBS-MATOWA-100`, quantity: 2 }],
      idempotencyKey: randomUUID(),
    },
  });
  await repo.execute(h.users.hq, {
    type: 'APPROVE',
    input: {
      requestId: created.requestId,
      expectedRevision: 1,
      inventoryVersions: [
        {
          productId: `${h.businessId}:NBS-MATOWA-100`,
          expectedHqInventoryVersion: 1,
        },
      ],
      idempotencyKey: randomUUID(),
    },
  });
  await repo.execute(h.users.hq, {
    type: 'DISPATCH',
    input: {
      requestId: created.requestId,
      expectedRevision: 2,
      idempotencyKey: randomUUID(),
    },
  });
  return created.requestId;
}

const receipt = (requestId: string, idempotencyKey = randomUUID()) => ({
  type: 'RECORD_RECEIPT' as const,
  input: {
    requestId,
    expectedRevision: 3,
    items: [
      {
        productId: `${h.businessId}:NBS-MATOWA-100`,
        goodQuantity: 2,
        damagedQuantity: 0,
        missingQuantity: 0,
      },
    ],
    procedureReferences: [],

    idempotencyKey,
  },
});

it('lets_hq_receive_for_a_salon_and_replay_with_hq_audit', async () => {
  const requestId = await dispatchedRequest();
  const action = receipt(requestId);
  const received = await new DeliveryRepository(h.operator).execute(h.users.hq, action);
  expect(received).toMatchObject({
    requestRevision: 4,
    replayed: false,
  });
  expect(await new DeliveryRepository(h.operator).execute(h.users.hq, action)).toEqual({
    ...received,
    replayed: true,
  });

  const snapshot = await h.operator.executeGraphql<
    {
      deliveryReceipts: { actorUid: string }[];
      stockMovements: { type: string; quantity: number; actorUid: string }[];
      inventories: { locationId: string; onHand: number; reserved: number }[];
    },
    { requestId: string }
  >(
    `query($requestId:String!){
      deliveryReceipts(where:{requestId:{eq:$requestId}}){actorUid}
      stockMovements(where:{transferItem:{transferRequestId:{eq:$requestId}}}){type quantity actorUid}
      inventories(where:{productId:{eq:"${h.businessId}:NBS-MATOWA-100"}}){locationId onHand reserved}
    }`,
    { variables: { requestId } },
  );
  expect(snapshot.data.deliveryReceipts).toEqual([{ actorUid: h.users.hq }]);
  expect(snapshot.data.stockMovements.filter((movement) => movement.type === 'RECEIPT')).toEqual([
    { type: 'RECEIPT', quantity: 2, actorUid: h.users.hq },
  ]);
  expect(snapshot.data.inventories).toContainEqual({
    locationId: `${h.businessId}:hq`,
    onHand: 16,
    reserved: 0,
  });
  expect(snapshot.data.inventories).toContainEqual({
    locationId: h.legnickaId,
    onHand: 4,
    reserved: 0,
  });
});

it('keeps_hq_business_scope_and_salon_receipt_assignment', async () => {
  const requestId = await dispatchedRequest('legnicka');
  const action = receipt(requestId);
  await expect(
    new DeliveryRepository(h.operator).execute(h.users.foreign, action),
  ).rejects.toMatchObject({
    code: 'FORBIDDEN',
  });
  await expect(
    new DeliveryRepository(h.operator).execute(h.users.lodzka, action),
  ).rejects.toMatchObject({
    code: 'FORBIDDEN',
  });
  expect(
    (await new DeliveryRepository(h.operator).execute(h.users.legnicka, action)).requestRevision,
  ).toBe(4);
});
