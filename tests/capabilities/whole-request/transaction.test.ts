import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getDataConnect } from "firebase-admin/data-connect";
process.env.DATA_CONNECT_EMULATOR_HOST = "127.0.0.1:9599";
const app = initializeApp(
  { projectId: "demo-whole-request-proof" },
  "whole-request-proof",
);
const dc = getDataConnect(
  {
    serviceId: "whole-request-proof",
    location: "europe-west1",
    connector: "server",
  },
  app,
);
const products = ["A", "B", "C", "D", "E", "F"];
async function snapshot() {
  return (
    await dc.executeGraphql(`query {
    probeInventories(orderBy:{id:ASC}) {id onHand reserved version}
    probeRequests(orderBy:{id:ASC}) {id state revision}
    probeItems(orderBy:{productId:ASC}) {requestId productId quantity}
    probeAudits(orderBy:{id:ASC}) {id requestId}
  }`)
  ).data;
}
async function approve(
  requestId: string,
  quantities: number[],
  staleLast = false,
  allowed = true,
) {
  const variables: Record<string, string | number | boolean> = {
    requestId,
    allowed,
  };
  for (let i = 0; i < 6; i++) {
    variables[`p${i}`] = products[i];
    variables[`q${i}`] = quantities[i] ?? 0;
    variables[`v${i}`] = staleLast && i === quantities.length - 1 ? 99 : 1;
    variables[`use${i}`] = i < quantities.length;
  }
  return dc.executeMutation("ApproveProbe", variables);
}
beforeAll(async () => {
  await snapshot();
});
beforeEach(async () => {
  await dc.executeGraphql(`mutation {
    probeAudit_deleteMany(all:true) probeItem_deleteMany(all:true)
    probeRequest_deleteMany(all:true) probeInventory_deleteMany(all:true)
  }`);
  await dc.executeGraphql(`mutation {
    probeInventory_insertMany(data:[${products.map((id) => `{id:"${id}",onHand:18,reserved:0,version:1}`).join(",")}])
  }`);
});
afterAll(() => deleteApp(app));
it.each([[2], [2, 3, 1], [2, 3, 1, 4, 2, 1]])(
  "commits heterogeneous quantities %j",
  async (...values) => {
    const quantities = values.filter((v): v is number => typeof v === "number");
    await approve("r1", quantities);
    const data = (await snapshot()) as {
      probeInventories: { reserved: number }[];
      probeItems: unknown[];
      probeAudits: unknown[];
    };
    expect(data.probeInventories.map((i) => i.reserved)).toEqual([
      ...quantities,
      ...Array(6 - quantities.length).fill(0),
    ]);
    expect(data.probeItems).toHaveLength(quantities.length);
    expect(data.probeAudits).toHaveLength(1);
  },
);
it("rolls_back_first_item_when_last_item_guard_fails", async () => {
  const before = await snapshot();
  await expect(approve("r1", [2, 3], true)).rejects.toThrow(/STALE_STATE/);
  expect(await snapshot()).toEqual(before);
});
it("overlapping_approvals_do_not_oversell", async () => {
  const results = await Promise.allSettled([
    approve("r1", [12, 2]),
    approve("r2", [12, 3]),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  const data = (await snapshot()) as {
    probeInventories: { reserved: number }[];
    probeAudits: unknown[];
  };
  expect(data.probeInventories[0].reserved).toBe(12);
  expect(data.probeAudits).toHaveLength(1);
});
it("rejects_unauthorized_transaction_without_changes", async () => {
  const before = await snapshot();
  await expect(approve("r1", [2, 3], false, false)).rejects.toThrow(
    /FORBIDDEN/,
  );
  expect(await snapshot()).toEqual(before);
});

it("counts_existing_reservations_with_a_fresh_version", async () => {
  await dc.executeGraphql(
    'mutation {probeInventory_update(id:"A",data:{reserved:12})}',
  );
  const before = await snapshot();
  await expect(approve("r1", [12])).rejects.toThrow(/STALE_STATE/);
  expect(await snapshot()).toEqual(before);
});
