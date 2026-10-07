import { beforeEach, afterEach, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { createCloudHarness } from "../support/cloud.ts";
import { StockRepository } from "../../functions/src/stock/repository.ts";
let h: Awaited<ReturnType<typeof createCloudHarness>>, repo: StockRepository;
beforeEach(async () => {
  h = await createCloudHarness("items");
  repo = new StockRepository(h.operator);
});
afterEach(async () => {
  if (h) await h.dispose();
});
const items = () =>
  ["NBS-MATOWA-100", "NBS-DRYMATT-100", "NBS-CEMENT-100"].map((id, i) => ({
    productId: `${h.businessId}:${id}`,
    quantity: [2, 3, 1][i],
  }));
const submitInput = () => ({
  salonId: h.legnickaId,
  items: items(),
  idempotencyKey: randomUUID(),
});
const submit = () =>
  repo.execute(h.users.legnicka, { type: "SUBMIT", input: submitInput() });
const approve = (requestId: string) =>
  repo.execute(h.users.hq, {
    type: "APPROVE",
    input: {
      requestId,
      expectedRevision: 1,
      idempotencyKey: randomUUID(),
      inventoryVersions: items().map((i) => ({
        productId: i.productId,
        expectedHqInventoryVersion: 1,
      })),
    },
  });
const transition = (requestId: string, expectedRevision: number) => ({
  requestId,
  expectedRevision,
  idempotencyKey: randomUUID(),
});
async function snapshot() {
  return (
    await h.operator.executeGraphql(
      `query($id:String!){
 inventories(where:{location:{businessId:{eq:$id}}},orderBy:[{locationId:ASC},{productId:ASC}]){locationId productId onHand reserved version}
 replenishmentRequests(where:{businessId:{eq:$id}},orderBy:{id:ASC}){id state revision}
 requestItems(where:{request:{businessId:{eq:$id}}},orderBy:{id:ASC}){id requestId productId quantity}
 transfers(where:{businessId:{eq:$id}},orderBy:{requestId:ASC}){requestId}
 transferItems(where:{transfer:{businessId:{eq:$id}}},orderBy:{requestItemId:ASC}){requestItemId quantity dispatchedQuantity receivedQuantity}
 stockMovements(where:{businessId:{eq:$id}},orderBy:[{transferItemRequestItemId:ASC},{type:ASC}]){transferItemRequestItemId type quantity}
 actionReceipts(where:{businessId:{eq:$id}},orderBy:{id:ASC}){id}
 actionKeys(where:{businessId:{eq:$id}},orderBy:[{actorUid:ASC},{idempotencyKey:ASC}]){receiptId idempotencyKey}
 activeRequests(where:{businessId:{eq:$id}},orderBy:[{salonId:ASC},{productId:ASC}]){requestId productId}
}`,
      { variables: { id: h.businessId } },
    )
  ).data as {
    inventories: {
      locationId: string;
      productId: string;
      onHand: number;
      reserved: number;
    }[];
    replenishmentRequests: unknown[];
    requestItems: unknown[];
    stockMovements: unknown[];
    actionReceipts: unknown[];
    actionKeys: unknown[];
    activeRequests: unknown[];
  };
}
it("submits_one_request_with_three_items", async () => {
  const r = await submit();
  const s = await snapshot();
  expect(s.replenishmentRequests).toHaveLength(1);
  expect(s.requestItems).toHaveLength(3);
  expect(s.activeRequests).toHaveLength(3);
  expect(s.actionReceipts).toHaveLength(1);
  expect(s.actionKeys).toHaveLength(1);
  await approve(r.requestId);
  await repo.execute(h.users.hq, {
    type: "DISPATCH",
    input: transition(r.requestId, 2),
  });
  await repo.execute(h.users.legnicka, {
    type: "RECEIVE",
    input: {
      ...transition(r.requestId, 3),
      items: items().map((i) => ({
        productId: i.productId,
        receivedQuantity: i.quantity,
      })),
      allIntact: true,
    },
  });
  const end = await snapshot();
  expect(end.stockMovements).toHaveLength(6);
  expect(end.activeRequests).toEqual([]);
  for (const i of items()) {
    expect(
      end.inventories.find(
        (r) => r.locationId === h.legnickaId && r.productId === i.productId,
      )?.onHand,
    ).toBe(2 + i.quantity);
    expect(
      end.inventories.find(
        (r) =>
          r.locationId === `${h.businessId}:hq` && r.productId === i.productId,
      ),
    ).toMatchObject({ onHand: 18 - i.quantity, reserved: 0 });
  }
});
it("canonicalizes_item_intent_and_refuses_conflicting_key_reuse", async () => {
  const input = submitInput();
  const first = await repo.execute(h.users.legnicka, { type: "SUBMIT", input });
  expect(
    await repo.execute(h.users.legnicka, {
      type: "SUBMIT",
      input: { ...input, items: [...input.items].reverse() },
    }),
  ).toEqual({ ...first, replayed: true });
  await expect(
    repo.execute(h.users.legnicka, {
      type: "SUBMIT",
      input: {
        ...input,
        items: input.items.map((i) => ({ ...i, quantity: 5 })),
      },
    }),
  ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
});
it("any_active_conflict_rejects_the_complete_submission", async () => {
  const first = await repo.execute(h.users.legnicka, {
    type: "SUBMIT",
    input: { ...submitInput(), items: [items()[1]] },
  });
  const before = await snapshot();
  await expect(submit()).rejects.toMatchObject({
    code: "ALREADY_ACTIVE",
    conflicts: [
      { productId: items()[1].productId, requestId: first.requestId },
    ],
  });
  expect(await snapshot()).toEqual(before);
});
it.each(["shortage", "stale", "missing"] as const)(
  "rolls_back_every_item_for_%s",
  async (kind) => {
    const r = await submit();
    const last = [...items()]
      .sort((a, b) => (a.productId < b.productId ? -1 : 1))
      .at(-1)!;
    await h.operator.executeGraphql(
      kind === "missing"
        ? "mutation($l:String!,$p:String!){inventory_delete(key:{locationId:$l,productId:$p})}"
        : `mutation($l:String!,$p:String!){inventory_update(key:{locationId:$l,productId:$p},data:{${kind === "shortage" ? "onHand:0" : "version:99"}})}`,
      { variables: { l: `${h.businessId}:hq`, p: last.productId } },
    );
    const before = await snapshot();
    await expect(approve(r.requestId)).rejects.toThrow();
    expect(await snapshot()).toEqual(before);
  },
);
it("later_transfer_failure_rolls_back_earlier_product_writes", async () => {
  const r = await submit();
  await approve(r.requestId);
  await h.operator.executeGraphql(
    "mutation($r:String!,$p:String!){transferItem_updateMany(where:{requestItem:{requestId:{eq:$r},productId:{eq:$p}}},data:{dispatchedQuantity:1})}",
    {
      variables: {
        r: r.requestId,
        p: [...items()]
          .sort((a, b) => (a.productId < b.productId ? -1 : 1))
          .at(-1)!.productId,
      },
    },
  );
  const before = await snapshot();
  await expect(
    repo.execute(h.users.hq, {
      type: "DISPATCH",
      input: transition(r.requestId, 2),
    }),
  ).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
  expect(await snapshot()).toEqual(before);
});
it("missing_damaged_or_partial_receipt_changes_no_product", async () => {
  const r = await submit();
  await approve(r.requestId);
  await repo.execute(h.users.hq, {
    type: "DISPATCH",
    input: transition(r.requestId, 2),
  });
  const before = await snapshot();
  const quantities = items().map((i) => ({
    productId: i.productId,
    receivedQuantity: i.quantity,
  }));
  for (const received of [
    quantities.slice(1),
    quantities.map((i) => ({ ...i, receivedQuantity: 99 })),
  ])
    await expect(
      repo.execute(h.users.legnicka, {
        type: "RECEIVE",
        input: {
          ...transition(r.requestId, 3),
          items: received,
          allIntact: true,
        },
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  await expect(
    repo.execute(h.users.legnicka, {
      type: "RECEIVE",
      input: {
        ...transition(r.requestId, 3),
        items: quantities,
        allIntact: false,
      } as never,
    }),
  ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  expect(await snapshot()).toEqual(before);
});
it("foreign_items_and_incomplete_approval_sets_are_rejected", async () => {
  await expect(
    repo.execute(h.users.legnicka, {
      type: "SUBMIT",
      input: {
        ...submitInput(),
        items: [...items(), { productId: "foreign-product", quantity: 1 }],
      },
    }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  const r = await submit();
  const before = await snapshot();
  await expect(
    repo.execute(h.users.hq, {
      type: "APPROVE",
      input: {
        ...transition(r.requestId, 1),
        inventoryVersions: [
          { productId: items()[0].productId, expectedHqInventoryVersion: 1 },
        ],
      },
    }),
  ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  expect(await snapshot()).toEqual(before);
});
it("overlapping_multi_item_requests_cannot_oversell_with_reversed_input", async () => {
  await h.setInventory("hq", "NBS-MATOWA-100", 3);
  const first = await submit();
  const second = await repo.execute(h.users.lodzka, {
    type: "SUBMIT",
    input: {
      ...submitInput(),
      salonId: `${h.businessId}:lodzka`,
      items: [...items()].reverse(),
    },
  });
  const results = await Promise.allSettled([
    approve(first.requestId),
    approve(second.requestId),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  const s = await snapshot();
  for (const i of items())
    expect(
      s.inventories.find(
        (r) =>
          r.locationId === `${h.businessId}:hq` && r.productId === i.productId,
      )?.reserved,
    ).toBe(i.quantity);
});
it("six_items_complete_one_lifecycle", async () => {
  const all = [
    "NBS-MATOWA-100",
    "NBS-DRYMATT-100",
    "NBS-CEMENT-100",
    "NBS-SOL-200",
    "NBS-SAVAGE-50",
    "NBS-MATTIFIER-100",
  ].map((id) => ({ productId: `${h.businessId}:${id}`, quantity: 2 }));
  const r = await repo.execute(h.users.legnicka, {
    type: "SUBMIT",
    input: { ...submitInput(), items: all },
  });
  await repo.execute(h.users.hq, {
    type: "APPROVE",
    input: {
      ...transition(r.requestId, 1),
      inventoryVersions: all.map((i) => ({
        productId: i.productId,
        expectedHqInventoryVersion: 1,
      })),
    },
  });
  await repo.execute(h.users.hq, {
    type: "DISPATCH",
    input: transition(r.requestId, 2),
  });
  await repo.execute(h.users.legnicka, {
    type: "RECEIVE",
    input: {
      ...transition(r.requestId, 3),
      items: all.map((i) => ({ productId: i.productId, receivedQuantity: 2 })),
      allIntact: true,
    },
  });
  expect((await snapshot()).stockMovements).toHaveLength(12);
});
