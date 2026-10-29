import { afterAll, beforeAll, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  executeQuery,
  queryRef,
  executeMutation,
  mutationRef,
  getDataConnect,
  connectDataConnectEmulator,
} from 'firebase/data-connect';
import { createCloudHarness } from '../support/cloud.ts';
import { StockRepository } from '../../functions/src/stock/repository.ts';

if (process.env.BARBERHQ_TEST_MODE !== 'emulator' || process.env.BARBERHQ_TEST_CONFIG)
  throw new Error('Delivery tests require emulator mode without cloud config.');
let h: Awaited<ReturnType<typeof createCloudHarness>>;
let requestId: string;
const receiptId = randomUUID(),
  issueId = randomUUID();
beforeAll(async () => {
  h = await createCloudHarness('delivery-access');
  const stock = new StockRepository(h.operator);
  const result = await stock.execute(h.users.legnicka, {
    type: 'SUBMIT',
    input: {
      salonId: h.legnickaId,
      items: [{ productId: `${h.businessId}:NBS-MATOWA-100`, quantity: 10 }],
      idempotencyKey: randomUUID(),
    },
  });
  requestId = result.requestId;
  await stock.execute(h.users.hq, {
    type: 'APPROVE',
    input: {
      requestId,
      expectedRevision: 1,
      idempotencyKey: randomUUID(),
      inventoryVersions: [
        { productId: `${h.businessId}:NBS-MATOWA-100`, expectedHqInventoryVersion: 1 },
      ],
    },
  });
  await stock.execute(h.users.hq, {
    type: 'DISPATCH',
    input: { requestId, expectedRevision: 2, idempotencyKey: randomUUID() },
  });
  await h.operator.executeGraphql(
    `mutation($id:String!,$receiptId:String!,$issueId:String!,$businessId:String!,$salonId:String!,$actor:String!,$productId:String!){
    deliveryReceipt_insert(data:{id:$receiptId,businessId:$businessId,requestId:$id,transferRequestId:$id,salonId:$salonId,actorUid:$actor,origin:RECORDED,description:"Broken seal"})
    deliveryReceiptItem_insert(data:{receiptId:$receiptId,productId:$productId,goodQuantity:8,damagedQuantity:2,missingQuantity:0})
    deliveryIssue_insert(data:{id:$issueId,businessId:$businessId,salonId:$salonId,rootReceiptId:$receiptId,rootRequestId:$id,status:OPEN,revision:1})
    deliveryIssueItem_insert(data:{issueId:$issueId,productId:$productId,initialAffectedQuantity:2})
    deliveryReceipt_update(id:$receiptId,data:{rootIssueId:$issueId})
  }`,
    {
      variables: {
        id: requestId,
        receiptId,
        issueId,
        businessId: h.businessId,
        salonId: h.legnickaId,
        actor: h.users.legnicka,
        productId: `${h.businessId}:NBS-MATOWA-100`,
      },
    },
  );
});
afterAll(async () => {
  if (h) await h.dispose();
});
async function read(
  role: 'hq' | 'legnicka' | 'lodzka' | 'foreign' | 'unassigned',
  name: string,
  variables: Record<string, unknown>,
) {
  try {
    return await executeQuery(
      queryRef<Record<string, unknown>, Record<string, unknown>>(
        h.browserClient(role),
        name,
        variables,
      ),
    );
  } catch (error) {
    throw new Error(`${role}/${name}: ${String(error).slice(0, 400)}`);
  }
}
it.each(['hq', 'legnicka'] as const)('authorized_%s_can_read_issue_and_receipt', async (role) => {
  const scope = (
    await h.operator.executeGraphql(
      `query($uid:String!,$requestId:String!){membership(key:{uid:$uid}){role business {requests:replenishmentRequests_on_business(where:{id:{eq:$requestId}}){id salonId}}}}`,
      { variables: { uid: h.users[role], requestId } },
    )
  ).data;
  expect(scope).toMatchObject({
    membership: { business: { requests: [{ id: requestId, salonId: h.legnickaId }] } },
  });
  expect((await read(role, 'GetMyMembership', {})).data).toMatchObject({
    membership: { businessId: h.businessId, role: role === 'hq' ? 'HQ' : 'SALON' },
  });
  expect((await read(role, 'GetRequestDetail', { requestId })).data).toMatchObject({
    membership: { business: { requests: [{ id: requestId }] } },
  });
  const result = await read(role, 'GetDeliveryReceipt', { requestId });
  expect(JSON.stringify(result.data)).toContain(receiptId);
  expect(
    JSON.stringify(
      (
        await read(role, 'GetDeliveryIssue', {
          issueId,
          eventLimit: 50,
          eventOffset: 0,
          replacementLimit: 50,
          replacementOffset: 0,
        })
      ).data,
    ),
  ).toContain(issueId);
});
it('foreign_salon_cannot_read_issue_or_receipt', async () => {
  for (const role of ['lodzka', 'foreign', 'unassigned'] as const) {
    await expect(read(role, 'GetDeliveryReceipt', { requestId })).rejects.toThrow(/FORBIDDEN/);
    await expect(
      read(role, 'GetDeliveryIssue', {
        issueId,
        eventLimit: 50,
        eventOffset: 0,
        replacementLimit: 50,
        replacementOffset: 0,
      }),
    ).rejects.toThrow(/FORBIDDEN/);
  }
});
it('browser_cannot_write_delivery_rows', async () => {
  for (const role of ['hq', 'legnicka'] as const) {
    const client = getDataConnect(h.browserClient(role).app, {
      connector: 'server',
      service: 'barberhq',
      location: 'europe-west1',
    });
    connectDataConnectEmulator(client, '127.0.0.1', 9399);
    await expect(
      executeMutation(
        mutationRef(client, 'InsertLegacyDeliveryReceipt', {
          id: randomUUID(),
          businessId: h.businessId,
          requestId,
          transferRequestId: requestId,
          salonId: h.legnickaId,
          actorUid: h.users[role],
          recordedAt: '2026-10-25T00:00:00Z',
          legacyActionReceiptId: 'forged',
        }),
      ),
    ).rejects.toThrow(/permission|NO_ACCESS|unauthorized|PERMISSION_DENIED/i);
  }
});
it('list_scope_and_pagination_are_authorized_before_rows', async () => {
  const vars = {
    allSalons: false,
    salonId: h.legnickaId,
    statuses: ['OPEN'],
    limit: 50,
    offset: 0,
  };
  const salonList = await read('legnicka', 'ListDeliveryIssues', vars);
  expect(salonList.data).toMatchObject({
    membership: { business: { salonOpenCounts: [{ _count: 1 }] } },
  });
  expect((await read('hq', 'ListDeliveryIssues', { ...vars, allSalons: true })).data).toMatchObject(
    { membership: { business: { openCounts: [{ _count: 1 }] } } },
  );
  expect(JSON.stringify(salonList.data)).toContain(issueId);
  for (const invalid of [
    { ...vars, limit: 51 },
    { ...vars, offset: -1 },
    { ...vars, allSalons: true },
  ])
    await expect(read('legnicka', 'ListDeliveryIssues', invalid)).rejects.toThrow(
      /FORBIDDEN|INVALID_ARGUMENT/,
    );
  await expect(read('lodzka', 'ListDeliveryIssues', vars)).rejects.toThrow(/FORBIDDEN/);
  await expect(read('legnicka', 'GetDeliveryProcedureBindings', {})).rejects.toThrow(/FORBIDDEN/);
  expect((await read('hq', 'GetDeliveryProcedureBindings', {})).data).toBeDefined();
});
