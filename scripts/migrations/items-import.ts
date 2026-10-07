import type { DataConnect } from "firebase-admin/data-connect";
import {
  convertLegacySnapshot,
  type LegacySnapshot,
} from "./replenishment-items.ts";
// All table/type/filter names are fixed here, never supplied by the operator.
const tables = [
  [
    "requests",
    "replenishmentRequest",
    "replenishmentRequests",
    "ReplenishmentRequest_Data",
    "id businessId salonId state revision createdAt",
    "businessId",
    "id",
  ],
  [
    "items",
    "requestItem",
    "requestItems",
    "RequestItem_Data",
    "id requestId productId quantity",
    "request",
    "id",
  ],
  [
    "active",
    "activeRequest",
    "activeRequests",
    "ActiveRequest_Data",
    "businessId salonId productId requestId",
    "businessId",
    "salonId,productId",
  ],
  [
    "transfers",
    "transfer",
    "transfers",
    "Transfer_Data",
    "requestId businessId warehouseId destinationId",
    "businessId",
    "requestId",
  ],
  [
    "transferItems",
    "transferItem",
    "transferItems",
    "TransferItem_Data",
    "requestItemId transferRequestId quantity dispatchedQuantity receivedQuantity",
    "transfer",
    "requestItemId",
  ],
  [
    "movements",
    "stockMovement",
    "stockMovements",
    "StockMovement_Data",
    "transferItemRequestItemId businessId type quantity actorUid createdAt",
    "businessId",
    "transferItemRequestItemId,type",
  ],
  [
    "receipts",
    "actionReceipt",
    "actionReceipts",
    "ActionReceipt_Data",
    "id businessId actorUid idempotencyKey requestId action payloadHash semanticHash state revision reason createdAt",
    "businessId",
    "id",
  ],
  [
    "actionKeys",
    "actionKey",
    "actionKeys",
    "ActionKey_Data",
    "businessId actorUid idempotencyKey receiptId payloadHash",
    "businessId",
    "actorUid,idempotencyKey",
  ],
  [
    "inventory",
    "inventory",
    "inventories",
    "Inventory_Data",
    "locationId productId onHand reserved version",
    "location",
    "locationId,productId",
  ],
] as const;
type Row = Record<string, unknown>;
function normalized(row: Row) {
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(row)
        .map(
          ([key, value]) =>
            [
              key,
              key.endsWith("At") && typeof value === "string"
                ? value
                    .replace(/(\.\d*?[1-9])0+Z$/, "$1Z")
                    .replace(/\.0+Z$/, "Z")
                : value,
            ] as const,
        )
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
    ),
  );
}
const same = (a: Row[], b: Row[]) =>
  JSON.stringify(a.map(normalized).sort()) ===
  JSON.stringify(b.map(normalized).sort());
async function read(
  dc: DataConnect,
  businessId: string,
  table: (typeof tables)[number],
): Promise<Row[]> {
  const [, , plural, , fields, scope, keys] = table,
    all: Row[] = [];
  const where =
    scope === "businessId"
      ? "{businessId:{eq:$businessId}}"
      : `{${scope}:{businessId:{eq:$businessId}}}`;
  const order =
    "[" +
    keys
      .split(",")
      .map((k) => `{${k}:ASC}`)
      .join(",") +
    "]";
  for (let offset = 0; ; offset += 100) {
    const { data } = await dc.executeGraphql<
      { rows: Row[] },
      { businessId: string; offset: number }
    >(
      `query($businessId:String!,$offset:Int!){rows:${plural}(where:${where},orderBy:${order},limit:100,offset:$offset){${fields}}}`,
      { variables: { businessId, offset } },
    );
    all.push(...data.rows);
    if (data.rows.length < 100) return all;
  }
}
export async function verifyItemsSnapshot(
  dc: DataConnect,
  legacy: LegacySnapshot,
): Promise<true> {
  const target = convertLegacySnapshot(legacy);
  for (const table of tables)
    if (!same(await read(dc, target.businessId, table), target[table[0]]))
      throw new Error(`Migration verification mismatch: ${table[0]}`);
  return true;
}
/** Writers must be quiescent. Insert missing rows atomically; never overwrite a conflict. */
export async function applyItemsSnapshot(
  dc: DataConnect,
  legacy: LegacySnapshot,
): Promise<{ inserted: number; verified: true }> {
  const target = convertLegacySnapshot(legacy),
    variables: Record<string, Row[]> = {},
    args: string[] = [],
    operations: string[] = [];
  let inserted = 0;
  for (const table of tables) {
    const [name, singular, , type, , , keys] = table,
      desired: Row[] = target[name],
      existing = await read(dc, target.businessId, table);
    const identity = (r: Row) =>
      JSON.stringify(keys.split(",").map((k) => r[k]));
    const wanted = new Map(desired.map((r) => [identity(r), r]));
    for (const row of existing) {
      const expected = wanted.get(identity(row));
      if (!expected || normalized(row) !== normalized(expected))
        throw new Error(`Target conflict: ${name}`);
    }
    if (name === "inventory") {
      if (!same(existing, desired))
        throw new Error("Inventory conflict; migration cannot alter stock");
      continue;
    }
    const present = new Set(existing.map(identity)),
      missing = desired.filter((r) => !present.has(identity(r)));
    if (missing.length) {
      variables[name] = missing;
      args.push(`$${name}:[${type}!]!`);
      operations.push(`${name}:${singular}_insertMany(data:$${name})`);
      inserted += missing.length;
    }
  }
  if (operations.length)
    await dc.executeGraphql(
      `mutation ImportItems(${args.join(",")}) @transaction {${operations.join("\n")}}`,
      { variables },
    );
  return { inserted, verified: await verifyItemsSnapshot(dc, legacy) };
}
