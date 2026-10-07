import { afterEach, beforeEach, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { createCloudHarness } from "../support/cloud.ts";
import { StockRepository } from "../../functions/src/stock/repository.ts";
let h: Awaited<ReturnType<typeof createCloudHarness>>;
beforeEach(async () => {
  h = await createCloudHarness("stock");
});
afterEach(async () => {
  if (h) await h.dispose();
});
it("conserves_twenty", async () => {
  const commands = new StockRepository(h.operator);
  const submitted = await commands.execute(h.users.legnicka, {
    type: "SUBMIT",
    input: {
      salonId: h.legnickaId,
      productId: `${h.businessId}:NBS-MATOWA-100`,
      quantity: 2,
      idempotencyKey: randomUUID(),
    },
  });
  expect(submitted.state).toBe("PENDING_APPROVAL");
  const approved = await commands.execute(h.users.hq, {
    type: "APPROVE",
    input: {
      requestId: submitted.requestId,
      expectedRevision: 1,
      expectedHqInventoryVersion: 1,
      idempotencyKey: randomUUID(),
    },
  });
  expect(approved.state).toBe("RESERVED");
  const dispatched = await commands.execute(h.users.hq, {
    type: "DISPATCH",
    input: {
      requestId: submitted.requestId,
      expectedRevision: 2,
      idempotencyKey: randomUUID(),
    },
  });
  expect(dispatched.state).toBe("DISPATCHED");
  const received = await commands.execute(h.users.legnicka, {
    type: "RECEIVE",
    input: {
      requestId: submitted.requestId,
      expectedRevision: 3,
      receivedQuantity: 2,
      allIntact: true,
      idempotencyKey: randomUUID(),
    },
  });
  expect(received.state).toBe("RECEIVED");
  const snapshot = await h.operator.executeGraphql<
    { inventories: { locationId: string; onHand: number; reserved: number }[] },
    Record<string, string>
  >(
    "query($productId:String!){inventories(where:{productId:{eq:$productId}}){locationId onHand reserved}}",
    { variables: { productId: `${h.businessId}:NBS-MATOWA-100` } },
  );
  expect(
    snapshot.data.inventories.find(
      (r) => r.locationId === `${h.businessId}:hq`,
    ),
  ).toMatchObject({ onHand: 16, reserved: 0 });
  expect(
    snapshot.data.inventories.find((r) => r.locationId === h.legnickaId),
  ).toMatchObject({ onHand: 4 });
});
