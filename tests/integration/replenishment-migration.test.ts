import { beforeEach, afterEach, it, expect } from "vitest";
import fixture from "../fixtures/replenishment-v1.json" with { type: "json" };
import { createCloudHarness } from "../support/cloud.ts";
import {
  parseLegacySnapshot,
  type LegacySnapshot,
} from "../../scripts/migrations/replenishment-items.ts";
import {
  applyItemsSnapshot,
  verifyItemsSnapshot,
} from "../../scripts/migrations/items-import.ts";
let h: Awaited<ReturnType<typeof createCloudHarness>>, snapshot: LegacySnapshot;
beforeEach(async () => {
  h = await createCloudHarness("migration");
  let raw = JSON.stringify(fixture).replaceAll(
    "not-bad-stuff-demo",
    h.businessId,
  );
  for (const [i, id] of [
    "NBS-MATOWA-100",
    "NBS-DRYMATT-100",
    "NBS-CEMENT-100",
    "NBS-SOL-200",
    "NBS-SAVAGE-50",
  ].entries())
    raw = raw.replaceAll(
      `${h.businessId}:${String.fromCharCode(65 + i)}"`,
      `${h.businessId}:${id}"`,
    );
  snapshot = parseLegacySnapshot(JSON.parse(raw));
  await h.operator.upsertMany("inventory", snapshot.inventory);
  snapshot.inventory = (
    await h.operator.executeGraphql<
      { inventories: LegacySnapshot["inventory"] },
      { id: string }
    >(
      "query($id:String!){inventories(where:{location:{businessId:{eq:$id}}},orderBy:[{locationId:ASC},{productId:ASC}]){locationId productId onHand reserved version}}",
      { variables: { id: h.businessId } },
    )
  ).data.inventories;
});
afterEach(async () => {
  if (h) await h.dispose();
});
it("imports_and_verifies_old_history_without_replaying_stock", async () => {
  const first = await applyItemsSnapshot(h.operator, snapshot);
  expect(first.inserted).toBeGreaterThan(0);
  expect(first.verified).toBe(true);
  expect(await applyItemsSnapshot(h.operator, snapshot)).toEqual({
    inserted: 0,
    verified: true,
  });
  expect(await verifyItemsSnapshot(h.operator, snapshot)).toBe(true);
  const rejected = (
    await h.operator.executeGraphql<
      {
        replenishmentRequest: {
          state: string;
          items: unknown[];
          receipts: { reason: string | null }[];
        };
      },
      { id: string }
    >(
      "query($id:String!){replenishmentRequest(id:$id){state items:requestItems_on_request{quantity} receipts:actionReceipts_on_request{reason}}}",
      { variables: { id: "r4" } },
    )
  ).data.replenishmentRequest;
  expect(rejected.state).toBe("REJECTED");
  expect(rejected.items).toHaveLength(1);
  expect(rejected.receipts.some((r) => r.reason === "Broken packaging")).toBe(
    true,
  );
});
it("refuses_conflicting_target_and_changed_inventory", async () => {
  await applyItemsSnapshot(h.operator, snapshot);
  await h.operator.executeGraphql(
    'mutation{replenishmentRequest_update(id:"r0",data:{revision:99})}',
  );
  await expect(applyItemsSnapshot(h.operator, snapshot)).rejects.toThrow(
    /conflict/i,
  );
  await h.setInventory("hq", "NBS-MATOWA-100", 99);
  await expect(verifyItemsSnapshot(h.operator, snapshot)).rejects.toThrow();
});
