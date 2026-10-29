import { DeliveryRepository } from '../../functions/src/delivery/repository.ts';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createCloudHarness } from '../support/cloud.ts';
import { StockRepository } from '../../functions/src/stock/repository.ts';
let h: Awaited<ReturnType<typeof createCloudHarness>>;
beforeEach(async () => {
  h = await createCloudHarness('stock');
});
afterEach(async () => {
  if (h) await h.dispose();
});
it('conserves_twenty', async () => {
  const commands = new StockRepository(h.operator);
  const submitted = await commands.execute(h.users.legnicka, {
    type: 'SUBMIT',
    input: {
      salonId: h.legnickaId,
      items: [{ productId: `${h.businessId}:NBS-MATOWA-100`, quantity: 2 }],
      idempotencyKey: randomUUID(),
    },
  });
  expect(submitted.state).toBe('PENDING_APPROVAL');
  const approved = await commands.execute(h.users.hq, {
    type: 'APPROVE',
    input: {
      requestId: submitted.requestId,
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
  expect(approved.state).toBe('RESERVED');
  const dispatched = await commands.execute(h.users.hq, {
    type: 'DISPATCH',
    input: {
      requestId: submitted.requestId,
      expectedRevision: 2,
      idempotencyKey: randomUUID(),
    },
  });
  expect(dispatched.state).toBe('DISPATCHED');
  const received = await new DeliveryRepository(h.operator).execute(h.users.legnicka, {
    type: 'RECORD_RECEIPT',
    input: {
      requestId: submitted.requestId,
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

      idempotencyKey: randomUUID(),
    },
  });
  expect(received.requestRevision).toBe(4);
  const snapshot = await h.operator.executeGraphql<
    { inventories: { locationId: string; onHand: number; reserved: number }[] },
    Record<string, string>
  >(
    'query($productId:String!){inventories(where:{productId:{eq:$productId}}){locationId onHand reserved}}',
    { variables: { productId: `${h.businessId}:NBS-MATOWA-100` } },
  );
  expect(
    snapshot.data.inventories.find((r) => r.locationId === `${h.businessId}:hq`),
  ).toMatchObject({ onHand: 16, reserved: 0 });
  expect(snapshot.data.inventories.find((r) => r.locationId === h.legnickaId)).toMatchObject({
    onHand: 4,
  });
});

it('lets_hq_submit_for_its_business_and_replay_with_hq_audit', async () => {
  const commands = new StockRepository(h.operator);
  const input = {
    salonId: h.legnickaId,
    items: [{ productId: `${h.businessId}:NBS-MATOWA-100`, quantity: 2 }],
    idempotencyKey: randomUUID(),
  };
  const first = await commands.execute(h.users.hq, { type: 'SUBMIT', input });
  expect(first.state).toBe('PENDING_APPROVAL');
  expect(first.replayed).toBe(false);
  const replay = await commands.execute(h.users.hq, { type: 'SUBMIT', input });
  expect(replay).toEqual({ ...first, replayed: true });
  const audit = await h.operator.executeGraphql<
    { actionReceipts: { actorUid: string; action: string; requestId: string }[] },
    { requestId: string }
  >(
    'query($requestId:String!){actionReceipts(where:{requestId:{eq:$requestId},action:{eq:SUBMIT}}){actorUid action requestId}}',
    { variables: { requestId: first.requestId } },
  );
  expect(audit.data.actionReceipts).toEqual([
    { actorUid: h.users.hq, action: 'SUBMIT', requestId: first.requestId },
  ]);
});

it('denies_unassigned_and_foreign_business_submitters', async () => {
  const commands = new StockRepository(h.operator);
  const input = {
    salonId: h.legnickaId,
    items: [{ productId: `${h.businessId}:NBS-MATOWA-100`, quantity: 2 }],
    idempotencyKey: randomUUID(),
  };
  await expect(
    commands.execute(h.users.unassigned, { type: 'SUBMIT', input }),
  ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  await expect(commands.execute(h.users.foreign, { type: 'SUBMIT', input })).rejects.toMatchObject({
    code: 'FORBIDDEN',
  });
});

it('keeps_submit_approval_with_hq_and_exposes_hq_inventory_only_to_hq', async () => {
  const commands = new StockRepository(h.operator);
  const created = await commands.execute(h.users.legnicka, {
    type: 'SUBMIT',
    input: {
      salonId: h.legnickaId,
      items: [{ productId: `${h.businessId}:NBS-MATOWA-100`, quantity: 2 }],
      idempotencyKey: randomUUID(),
    },
  });
  await expect(
    commands.execute(h.users.legnicka, {
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
    }),
  ).rejects.toMatchObject({ code: 'FORBIDDEN' });

  const browser = await import('@barberhq/browser');
  await expect(browser.getHqInventory(h.browserClient('legnicka'), {})).rejects.toThrow();
  const result = await browser.getHqInventory(h.browserClient('hq'), {});
  const hq = result.data.membership?.business.hq[0];
  expect(hq?.id).toBe(`${h.businessId}:hq`);
  expect(hq?.inventory.find((row) => row.product.demoId === 'NBS-MATOWA-100')).toMatchObject({
    onHand: 18,
    reserved: 0,
    version: 1,
    product: {
      id: `${h.businessId}:NBS-MATOWA-100`,
      demoId: 'NBS-MATOWA-100',
      name: expect.any(String),
      netContentMl: 100,
    },
  });
});
