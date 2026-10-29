import { afterAll, beforeEach, expect, it } from 'vitest';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getDataConnect } from 'firebase-admin/data-connect';

// This proof can never select a cloud service or use application fixture tables.
process.env.DATA_CONNECT_EMULATOR_HOST = '127.0.0.1:9699';
const app = initializeApp({ projectId: 'demo-delivery-receipt-proof' }, 'delivery-receipt-proof');
const dc = getDataConnect(
  { serviceId: 'delivery-receipt-proof', location: 'europe-west1', connector: 'server' },
  app,
);
const products = ['A', 'B', 'C', 'D', 'E', 'F'];

async function snapshot() {
  return (
    await dc.executeGraphql(`query {
    inventory: probeInventories(orderBy:{id:ASC}) {id onHand version}
    requests: probeRequests(orderBy:{id:ASC}) {id businessId state revision itemCount}
    dispatched: probeDispatchItems(orderBy:{productId:ASC}) {requestId productId quantity}
    receipts: probeReceipts {requestId}
    receiptItems: probeReceiptItems(orderBy:{productId:ASC}) {receiptRequestId productId goodQuantity damagedQuantity missingQuantity}
    movements: probeMovements(orderBy:{productId:ASC}) {receiptRequestId productId quantity}
    issues: probeIssues(orderBy:{id:ASC}) {id rootRequestId businessId revision}
    issueItems: probeIssueItems(orderBy:{productId:ASC}) {issueId productId initialAffectedQuantity}
    replacements: probeReplacements {issueId requestId}
    audits: probeAudits(orderBy:{id:ASC}) {id requestId}
  }`)
  ).data as {
    inventory: { id: string; onHand: number; version: number }[];
    requests: { id: string; state: string; revision: number }[];
    dispatched: unknown[];
    receipts: unknown[];
    receiptItems: {
      productId: string;
      goodQuantity: number;
      damagedQuantity: number;
      missingQuantity: number;
    }[];
    movements: { quantity: number }[];
    issues: { id: string; revision: number }[];
    issueItems: { initialAffectedQuantity: number }[];
    replacements: { issueId: string; requestId: string }[];
    audits: unknown[];
  };
}
async function seed(quantities = [10, 3]) {
  await dc.executeGraphql(`mutation {
    probeAudit_deleteMany(all:true) probeReplacement_deleteMany(all:true)
    probeIssueItem_deleteMany(all:true) probeIssue_deleteMany(all:true)
    probeMovement_deleteMany(all:true) probeReceiptItem_deleteMany(all:true)
    probeReceipt_deleteMany(all:true) probeDispatchItem_deleteMany(all:true)
    probeRequest_deleteMany(all:true) probeInventory_deleteMany(all:true)
  }`);
  await dc.executeGraphql(`mutation {
    probeInventory_insertMany(data:[${products.map((id) => `{id:"${id}",onHand:0,version:1}`).join(',')}])
    probeRequest_insert(data:{id:"original",businessId:"ours",state:"DISPATCHED",revision:3,itemCount:${quantities.length}})
    probeDispatchItem_insertMany(data:[${quantities.map((q, i) => `{requestId:"original",productId:"${products[i]}",quantity:${q}}`).join(',')}])
  }`);
}
async function recordProbe(input: {
  goods: number[];
  damaged: number[];
  missing: number[];
  failLast?: boolean;
  businessId?: string;
  expectedRevision?: number;
}) {
  const vars: Record<string, string | number | boolean> = {
    requestId: 'original',
    businessId: input.businessId ?? 'ours',
    expectedRevision: input.expectedRevision ?? 3,
    issueId: 'issue',
    hasIssue: input.damaged.some(Boolean) || input.missing.some(Boolean),
    itemCount: input.goods.length,
  };
  for (let i = 0; i < 6; i++) {
    Object.assign(vars, {
      [`p${i}`]: products[i],
      [`g${i}`]: input.goods[i] ?? 0,
      [`d${i}`]: input.damaged[i] ?? 0,
      [`m${i}`]: input.missing[i] ?? 0,
      [`a${i}`]: (input.damaged[i] ?? 0) + (input.missing[i] ?? 0),
      [`v${i}`]: input.failLast && i === input.goods.length - 1 ? 99 : 1,
      [`use${i}`]: i < input.goods.length,
      [`move${i}`]: (input.goods[i] ?? 0) > 0,
      [`issue${i}`]: (input.damaged[i] ?? 0) + (input.missing[i] ?? 0) > 0,
    });
  }
  return dc.executeMutation('RecordProbe', vars);
}
async function createReplacementProbe(input: {
  issueId: string;
  expectedRevision: number;
  businessId?: string;
  requestId?: string;
}) {
  return dc.executeMutation('CreateReplacementProbe', {
    ...input,
    businessId: input.businessId ?? 'ours',
    requestId: input.requestId ?? 'replacement',
  });
}
beforeEach(() => seed());
afterAll(() => deleteApp(app));

it('zero_good_line_has_receipt_but_no_stock_movement', async () => {
  await recordProbe({ goods: [8, 0], damaged: [2, 0], missing: [0, 3] });
  const after = await snapshot();
  expect(after.inventory.slice(0, 2).map((row) => row.onHand)).toEqual([8, 0]);
  expect(after.receiptItems).toHaveLength(2);
  expect(after.receiptItems[1]).toMatchObject({
    goodQuantity: 0,
    damagedQuantity: 0,
    missingQuantity: 3,
  });
  expect(after.movements.map((row) => row.quantity)).toEqual([8]);
  expect(after.issueItems.map((row) => row.initialAffectedQuantity)).toEqual([2, 3]);
  expect(after.requests[0]).toMatchObject({ state: 'RECEIVED_WITH_ISSUE', revision: 4 });
  expect(after.audits).toHaveLength(1);
});
it('last_guard_failure_rolls_back_all_effects', async () => {
  const before = await snapshot();
  await expect(
    recordProbe({ goods: [8, 0], damaged: [2, 0], missing: [0, 3], failLast: true }),
  ).rejects.toThrow(/STALE_STATE/);
  expect(await snapshot()).toEqual(before);
});
it('concurrent_replacements_create_one_active_child', async () => {
  await recordProbe({ goods: [8, 0], damaged: [2, 0], missing: [0, 3] });
  const results = await Promise.allSettled([
    createReplacementProbe({ issueId: 'issue', expectedRevision: 1, requestId: 'child-a' }),
    createReplacementProbe({ issueId: 'issue', expectedRevision: 1, requestId: 'child-b' }),
  ]);
  expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  const after = await snapshot();
  expect(after.requests.filter((r) => r.state === 'PENDING_APPROVAL')).toHaveLength(1);
  expect(after.replacements).toHaveLength(1);
  expect(after.issues).toEqual([expect.objectContaining({ id: 'issue', revision: 2 })]);
});
it.each([{ businessId: 'foreign' }, { expectedRevision: 2 }])(
  'invalid_receipt_scope_or_revision_changes_nothing %j',
  async (override) => {
    const before = await snapshot();
    await expect(
      recordProbe({ goods: [8, 0], damaged: [2, 0], missing: [0, 3], ...override }),
    ).rejects.toThrow(/FORBIDDEN|STALE_STATE/);
    expect(await snapshot()).toEqual(before);
  },
);
it.each([{ businessId: 'foreign', expectedRevision: 1 }, { expectedRevision: 0 }])(
  'invalid_replacement_scope_or_revision_changes_nothing %j',
  async (override) => {
    await recordProbe({ goods: [8, 0], damaged: [2, 0], missing: [0, 3] });
    const before = await snapshot();
    await expect(createReplacementProbe({ issueId: 'issue', ...override })).rejects.toThrow(
      /FORBIDDEN|STALE_STATE/,
    );
    expect(await snapshot()).toEqual(before);
  },
);
it('all_six_slots_keep_distinct_quantities_and_zero_good_lines', async () => {
  await seed([10, 3, 4, 5, 6, 7]);
  await recordProbe({
    goods: [8, 0, 4, 0, 5, 7],
    damaged: [2, 0, 0, 5, 0, 0],
    missing: [0, 3, 0, 0, 1, 0],
  });
  const after = await snapshot();
  expect(after.inventory.map((r) => r.onHand)).toEqual([8, 0, 4, 0, 5, 7]);
  expect(after.receiptItems).toHaveLength(6);
  expect(after.movements.map((r) => r.quantity)).toEqual([8, 4, 5, 7]);
  expect(after.issueItems.map((r) => r.initialAffectedQuantity)).toEqual([2, 3, 5, 1]);
});
it('incomplete_classification_changes_nothing', async () => {
  const before = await snapshot();
  await expect(recordProbe({ goods: [8], damaged: [2], missing: [0] })).rejects.toThrow(
    /INVALID_ITEMS/,
  );
  expect(await snapshot()).toEqual(before);
});
it('duplicate_receipt_never_increments_inventory_twice', async () => {
  const input = { goods: [8, 0], damaged: [2, 0], missing: [0, 3] };
  await recordProbe(input);
  const before = await snapshot();
  await expect(recordProbe({ ...input, expectedRevision: 4 })).rejects.toThrow();
  expect(await snapshot()).toEqual(before);
});
