import { randomUUID } from 'node:crypto';
import type { DeliveryAction, DeliveryQuantities } from '../../shared/contracts/delivery.ts';
import type { RequestState } from '../../shared/contracts/stock.ts';
import { StockRepository } from '../../functions/src/stock/repository.ts';
import { DeliveryRepository } from '../../functions/src/delivery/repository.ts';
import { createCloudHarness } from './cloud.ts';
export type DeliveryHarness = Awaited<ReturnType<typeof createCloudHarness>>;
export function requireDeliveryEmulator() {
  if (process.env.BARBERHQ_TEST_MODE !== 'emulator' || process.env.BARBERHQ_TEST_CONFIG)
    throw new Error('Delivery fixtures require emulator mode without cloud config.');
}
export async function createDeliveryHarness(name: string) {
  requireDeliveryEmulator();
  return createCloudHarness(name);
}
export async function seedDispatchedDelivery(h: DeliveryHarness, quantities: number[] = [10]) {
  requireDeliveryEmulator();
  const ids = [
    'NBS-MATOWA-100',
    'NBS-DRYMATT-100',
    'NBS-CEMENT-100',
    'NBS-SOL-200',
    'NBS-SAVAGE-50',
    'NBS-MATTIFIER-100',
  ];
  const items = quantities.map((quantity, i) => ({
    productId: `${h.businessId}:${ids[i]}`,
    quantity,
  }));
  const repo = new StockRepository(h.operator);
  const request = await repo.execute(h.users.legnicka, {
    type: 'SUBMIT',
    input: { salonId: h.legnickaId, items, idempotencyKey: randomUUID() },
  });
  const stock = await readDeliverySnapshot(h);
  await repo.execute(h.users.hq, {
    type: 'APPROVE',
    input: {
      requestId: request.requestId,
      expectedRevision: 1,
      idempotencyKey: randomUUID(),
      inventoryVersions: items.map((item) => ({
        productId: item.productId,
        expectedHqInventoryVersion: stock.inventories.find(
          (row) => row.locationId === `${h.businessId}:hq` && row.productId === item.productId,
        )!.version,
      })),
    },
  });
  await repo.execute(h.users.hq, {
    type: 'DISPATCH',
    input: { requestId: request.requestId, expectedRevision: 2, idempotencyKey: randomUUID() },
  });
  return { requestId: request.requestId, items };
}
export function executeDelivery(
  h: DeliveryHarness,
  role: keyof DeliveryHarness['users'],
  action: DeliveryAction,
) {
  requireDeliveryEmulator();
  return new DeliveryRepository(h.operator).execute(h.users[role], action);
}
export async function openDeliveryIssue(h: DeliveryHarness) {
  const { requestId, items } = await seedDispatchedDelivery(h);
  const result = await executeDelivery(h, 'legnicka', {
    type: 'RECORD_RECEIPT',
    input: {
      requestId,
      expectedRevision: 3,
      idempotencyKey: randomUUID(),
      items: [
        { productId: items[0].productId, goodQuantity: 8, damagedQuantity: 2, missingQuantity: 0 },
      ],
      report: { description: 'Two damaged units', batchIdentifier: null },
      procedureReferences: [],
    },
  });
  if (!result.issueId) throw new Error('Fixture receipt did not create an issue');
  return { issueId: result.issueId, rootRequestId: requestId, productId: items[0].productId };
}
export async function dispatchDeliveryRequest(h: DeliveryHarness, requestId: string) {
  const snapshot = await readDeliverySnapshot(h),
    request = snapshot.requests.find((row) => row.id === requestId)!;
  const repo = new StockRepository(h.operator);
  await repo.execute(h.users.hq, {
    type: 'APPROVE',
    input: {
      requestId,
      expectedRevision: request.revision,
      idempotencyKey: randomUUID(),
      inventoryVersions: request.items.map((item) => ({
        productId: item.productId,
        expectedHqInventoryVersion: snapshot.inventories.find(
          (row) => row.locationId === `${h.businessId}:hq` && row.productId === item.productId,
        )!.version,
      })),
    },
  });
  return repo.execute(h.users.hq, {
    type: 'DISPATCH',
    input: { requestId, expectedRevision: request.revision + 1, idempotencyKey: randomUUID() },
  });
}
export async function receiveDeliveryRequest(
  h: DeliveryHarness,
  requestId: string,
  good?: number,
  damaged = 0,
  missing = 0,
) {
  const request = (await readDeliverySnapshot(h)).requests.find((row) => row.id === requestId)!;
  return executeDelivery(h, 'legnicka', {
    type: 'RECORD_RECEIPT',
    input: {
      requestId,
      expectedRevision: request.revision,
      idempotencyKey: randomUUID(),
      items: request.items.map((item) => ({
        productId: item.productId,
        goodQuantity: good ?? item.quantity,
        damagedQuantity: damaged,
        missingQuantity: missing,
      })),
      ...(damaged + missing > 0
        ? { report: { description: 'Replacement inspection problem', batchIdentifier: null } }
        : {}),
      procedureReferences: [],
    },
  });
}
type Inventory = {
  locationId: string;
  productId: string;
  onHand: number;
  reserved: number;
  version: number;
};
export type DeliverySnapshot = {
  inventories: Inventory[];
  requests: {
    id: string;
    state: RequestState;
    revision: number;
    replacementIssueId: string | null;
    salonId: string;
    items: { id: string; productId: string; quantity: number }[];
  }[];
  transferItems: { requestItemId: string; dispatchedQuantity: number; receivedQuantity: number }[];
  receipts: {
    id: string;
    requestId: string;
    rootIssueId: string | null;
    origin: string;
    items: DeliveryQuantities[];
    actorUid: string;
    description: string | null;
  }[];
  receiptItems: (DeliveryQuantities & { receiptId: string })[];
  issues: {
    id: string;
    rootRequestId: string;
    status: string;
    revision: number;
    activeReplacementRequestId: string | null;
    items: {
      productId: string;
      initialAffectedQuantity: number;
      replacementAcceptedQuantity: number;
    }[];
  }[];
  movements: {
    transferItemRequestItemId: string;
    type: 'DISPATCH' | 'RECEIPT';
    quantity: number;
  }[];
  events: {
    id: string;
    issueId: string;
    revision: number;
    type: string;
    requestId: string | null;
    status: string;
    note: string | null;
    quantities: unknown;
  }[];
  commands: { id: string; actorUid: string; type: string; payloadHash: string; result: unknown }[];
  keys: { commandId: string; actorUid: string; idempotencyKey: string; payloadHash: string }[];
  actionReceipts: { id: string; requestId: string; action: string }[];
  actionKeys: { receiptId: string; idempotencyKey: string }[];
  activeRequests: { requestId: string; productId: string }[];
  hqInventory: Inventory;
  salonInventory: Inventory;
};
export async function readDeliverySnapshot(h: DeliveryHarness): Promise<DeliverySnapshot> {
  requireDeliveryEmulator();
  const data = (
    await h.operator.executeGraphql(
      `query($businessId:String!){
    inventories(where:{location:{businessId:{eq:$businessId}}},orderBy:[{locationId:ASC},{productId:ASC}],limit:100){locationId productId onHand reserved version}
    requests:replenishmentRequests(where:{businessId:{eq:$businessId}},orderBy:{id:ASC},limit:100){id state revision salonId replacementIssueId items:requestItems_on_request(orderBy:{productId:ASC}){id productId quantity}}
    transferItems(where:{transfer:{businessId:{eq:$businessId}}},orderBy:{requestItemId:ASC},limit:100){requestItemId dispatchedQuantity receivedQuantity}
    receipts:deliveryReceipts(where:{businessId:{eq:$businessId}},orderBy:{id:ASC},limit:100){id requestId rootIssueId origin actorUid description items:deliveryReceiptItems_on_receipt(orderBy:{productId:ASC}){productId goodQuantity damagedQuantity missingQuantity}}
    receiptItems:deliveryReceiptItems(where:{receipt:{businessId:{eq:$businessId}}},orderBy:[{receiptId:ASC},{productId:ASC}],limit:100){receiptId productId goodQuantity damagedQuantity missingQuantity}
    issues:deliveryIssues(where:{businessId:{eq:$businessId}},orderBy:{id:ASC},limit:100){id rootRequestId status revision activeReplacementRequestId items:deliveryIssueItems_on_issue(orderBy:{productId:ASC}){productId initialAffectedQuantity replacementAcceptedQuantity}}
    movements:stockMovements(where:{businessId:{eq:$businessId}},orderBy:[{transferItemRequestItemId:ASC},{type:ASC}],limit:100){transferItemRequestItemId type quantity}
    events:deliveryIssueEvents(where:{issue:{businessId:{eq:$businessId}}},orderBy:[{issueId:ASC},{revision:ASC}],limit:100){id issueId revision type status requestId note quantities}
    commands:deliveryCommandReceipts(where:{businessId:{eq:$businessId}},orderBy:{id:ASC},limit:100){id actorUid type payloadHash result}
    keys:deliveryActionKeys(where:{businessId:{eq:$businessId}},orderBy:[{actorUid:ASC},{idempotencyKey:ASC}],limit:100){commandId actorUid idempotencyKey payloadHash}
    actionReceipts(where:{businessId:{eq:$businessId}},orderBy:{id:ASC},limit:100){id requestId action}
    actionKeys(where:{businessId:{eq:$businessId}},orderBy:[{actorUid:ASC},{idempotencyKey:ASC}],limit:100){receiptId idempotencyKey}
    activeRequests(where:{businessId:{eq:$businessId}},orderBy:[{salonId:ASC},{productId:ASC}],limit:100){requestId productId}
  }`,
      { variables: { businessId: h.businessId } },
    )
  ).data as Omit<DeliverySnapshot, 'hqInventory' | 'salonInventory'>;
  const productId = `${h.businessId}:NBS-MATOWA-100`;
  return {
    ...data,
    hqInventory: data.inventories.find(
      (row) => row.locationId === `${h.businessId}:hq` && row.productId === productId,
    )!,
    salonInventory: data.inventories.find(
      (row) => row.locationId === h.legnickaId && row.productId === productId,
    )!,
  };
}

/** Historical committed RECEIVE fixture; never a production writer. */
export async function seedLegacyReceivedDelivery(h: DeliveryHarness, quantity = 10) {
  requireDeliveryEmulator();
  const delivery = await seedDispatchedDelivery(h, [quantity]),
    before = await readDeliverySnapshot(h),
    item = before.requests.find((r) => r.id === delivery.requestId)!.items[0];
  const action = {
    type: 'RECEIVE' as const,
    input: {
      requestId: delivery.requestId,
      expectedRevision: 3,
      idempotencyKey: randomUUID(),
      items: [{ productId: item.productId, receivedQuantity: quantity }],
      allIntact: true as const,
    },
  };
  const { payloadHash, semanticHash } = await import('../../functions/src/stock/intent.ts');
  const receiptId = randomUUID();
  await h.operator.executeGraphql(
    `mutation($requestId:String!,$businessId:String!,$salonId:String!,$productId:String!,$itemId:String!,$actorUid:String!,$receiptId:String!,$key:String!,$payloadHash:String!,$semanticHash:String!,$quantity:Int!) @transaction {
  replenishmentRequest_update(id:$requestId,data:{state:RECEIVED,revision:4})
  inventory_update(key:{locationId:$salonId,productId:$productId},data:{onHand_update:{inc:$quantity},version_update:{inc:1}})
  transferItem_update(key:{requestItemId:$itemId},data:{receivedQuantity:$quantity})
  stockMovement_insert(data:{transferItemRequestItemId:$itemId,businessId:$businessId,type:RECEIPT,quantity:$quantity,actorUid:$actorUid,createdAt:"2026-10-20T10:00:00Z"})
  activeRequest_deleteMany(where:{requestId:{eq:$requestId},businessId:{eq:$businessId}})
  actionReceipt_insert(data:{id:$receiptId,businessId:$businessId,actorUid:$actorUid,idempotencyKey:$key,requestId:$requestId,action:RECEIVE,payloadHash:$payloadHash,semanticHash:$semanticHash,state:RECEIVED,revision:4,createdAt:"2026-10-20T10:00:00Z"})
  actionKey_insert(data:{businessId:$businessId,actorUid:$actorUid,idempotencyKey:$key,receiptId:$receiptId,payloadHash:$payloadHash})
 }`,
    {
      variables: {
        requestId: delivery.requestId,
        businessId: h.businessId,
        salonId: h.legnickaId,
        productId: item.productId,
        itemId: item.id,
        actorUid: h.users.legnicka,
        receiptId,
        key: action.input.idempotencyKey,
        payloadHash: payloadHash(action),
        semanticHash: semanticHash(action),
        quantity,
      },
    },
  );
  return { action, receiptId, requestId: delivery.requestId };
}
