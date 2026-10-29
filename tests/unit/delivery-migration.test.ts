import { it, expect } from 'vitest';
import {
  planDeliveryBackfill,
  type DeliverySnapshot,
} from '../../scripts/migrations/delivery-receipts.ts';
const target = {
  projectId: 'demo-barberhq',
  serviceId: 'barberhq',
  location: 'europe-west1',
  businessId: 'business',
};
const snapshot = (): DeliverySnapshot => ({
  target,
  requests: [
    {
      id: 'request',
      businessId: 'business',
      salonId: 'salon',
      state: 'RECEIVED',
      revision: 4,
      replacementIssueId: null,
    },
  ],
  items: [{ id: 'item', requestId: 'request', productId: 'product', quantity: 10 }],
  transfers: [
    { requestId: 'request', businessId: 'business', destinationId: 'salon', warehouseId: 'hq' },
  ],
  transferItems: [
    {
      requestItemId: 'item',
      transferRequestId: 'request',
      quantity: 10,
      dispatchedQuantity: 10,
      receivedQuantity: 10,
    },
  ],
  actions: [
    {
      id: 'legacy-action',
      requestId: 'request',
      businessId: 'business',
      actorUid: 'recipient',
      action: 'RECEIVE',
      state: 'RECEIVED',
      revision: 4,
      createdAt: '2026-10-20T10:00:00Z',
    },
  ],
  movements: [
    {
      transferItemRequestItemId: 'item',
      type: 'RECEIPT',
      quantity: 10,
      actorUid: 'recipient',
      createdAt: '2026-10-20T10:00:00Z',
    },
  ],
  receipts: [],
  preservation: {
    products: [{ id: 'product' }],
    inventories: [{ onHand: 12 }],
    keys: [{ key: 'legacy-key' }],
    knowledge: [{ hash: 'original-pdf' }],
  },
});
it('backfills exact good quantities and original actor/time without stock commands', () => {
  const before = snapshot(),
    plan = planDeliveryBackfill(before);
  expect(plan.receipts).toHaveLength(1);
  expect(plan.receipts[0]).toMatchObject({
    origin: 'LEGACY',
    actorUid: 'recipient',
    recordedAt: '2026-10-20T10:00:00Z',
    legacyActionReceiptId: 'legacy-action',
    items: [{ productId: 'product', goodQuantity: 10, damagedQuantity: 0, missingQuantity: 0 }],
  });
  expect(before).toEqual(snapshot());
});
it('does not invent an inspection for an old dispatched parcel', () => {
  const s = snapshot();
  s.requests[0].state = 'DISPATCHED';
  s.requests[0].revision = 3;
  s.actions = [];
  s.movements = [];
  s.transferItems[0].receivedQuantity = 0;
  expect(planDeliveryBackfill(s).receipts).toEqual([]);
});
it.each(['missing-history', 'wrong-quantity', 'wrong-actor', 'duplicate-item'] as const)(
  'refuses inconsistent %s instead of guessing',
  (kind) => {
    const s = snapshot();
    if (kind === 'missing-history') s.actions = [];
    if (kind === 'wrong-quantity') s.transferItems[0].receivedQuantity = 9;
    if (kind === 'wrong-actor') s.movements[0].actorUid = 'other';
    if (kind === 'duplicate-item') s.items.push({ ...s.items[0] });
    expect(() => planDeliveryBackfill(s)).toThrow();
  },
);
it('accepts only exact already-backfilled receipts and treats a second plan as a no-op', () => {
  const s = snapshot(),
    first = planDeliveryBackfill(s);
  s.receipts = structuredClone(first.receipts);
  expect(planDeliveryBackfill(s).receipts).toEqual([]);
  s.receipts[0].items[0].goodQuantity = 9;
  expect(() => planDeliveryBackfill(s)).toThrow(/conflict/i);
});
it('hash covers original balances/history/sources but permits a safe partial restart', () => {
  const s = snapshot(),
    first = planDeliveryBackfill(s);
  s.receipts = first.receipts;
  expect(planDeliveryBackfill(s).snapshotHash).toBe(first.snapshotHash);
  s.preservation.inventories = [{ onHand: 13 }];
  expect(planDeliveryBackfill(s).snapshotHash).not.toBe(first.snapshotHash);
});

it('rejects a historical product outside the snapshotted business catalogue', () => {
  const s = snapshot();
  s.items[0].productId = 'foreign-product';
  expect(() => planDeliveryBackfill(s)).toThrow();
});
