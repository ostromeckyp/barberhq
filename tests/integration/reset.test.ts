import { beforeEach, afterEach, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { createCloudHarness } from "../support/cloud.ts";
import { StockRepository } from "../../functions/src/stock/repository.ts";
import { resetDemo, resetRecords } from "../../scripts/seed/reset.ts";
let h: Awaited<ReturnType<typeof createCloudHarness>>;
beforeEach(async () => {
  h = await createCloudHarness("reset");
});
afterEach(async () => {
  if (h) await h.dispose();
});
async function snapshot() {
  return (
    await h.operator.executeGraphql(
      "query($id:String!){inventories(where:{location:{businessId:{eq:$id}}},orderBy:[{locationId:ASC},{productId:ASC}]){locationId productId onHand reserved version}memberships(where:{businessId:{eq:$id}}){uid}products(where:{businessId:{eq:$id}}){id}replenishmentRequests(where:{businessId:{eq:$id}}){id}activeRequests(where:{businessId:{eq:$id}}){requestId}}",
      { variables: { id: h.businessId } },
    )
  ).data;
}
it("reset_refuses_foreign_target_and_restores_seed", async () => {
  await new StockRepository(h.operator).execute(h.users.legnicka, {
    type: "SUBMIT",
    input: {
      salonId: h.legnickaId,
      items: [{ productId: `${h.businessId}:NBS-MATOWA-100`, quantity: 2 }],
      idempotencyKey: randomUUID(),
    },
  });
  await h.setInventory("hq", "NBS-MATOWA-100", 7);
  const before = await snapshot();
  await expect(
    resetDemo({
      projectId: "foreign",
      businessKey: h.businessId,
      confirmBusinessKey: h.businessId,
      dryRun: false,
      quiescent: true,
    }),
  ).rejects.toThrow();
  expect(await snapshot()).toEqual(before);
  await resetRecords(h.operator, h.businessId, true);
  expect(await snapshot()).toEqual(before);
  await h.seedAgain();
  expect((await h.inventory()).hqOnHand).toBe(7);
  await resetRecords(h.operator, h.businessId, false);
  expect((await h.inventory()).hqOnHand).toBe(18);
  const after = (await snapshot()) as {
    memberships: unknown[];
    products: unknown[];
    activeRequests: unknown[];
    replenishmentRequests: unknown[];
  };
  expect(after.activeRequests).toEqual([]);
  expect(after.replenishmentRequests).toEqual([]);
  expect(after.memberships).toEqual((before as typeof after).memberships);
  expect(after.products).toEqual((before as typeof after).products);
});
