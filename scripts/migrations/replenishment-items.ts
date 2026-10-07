import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { z } from "zod";
import {
  initializeApp,
  deleteApp,
  applicationDefault,
} from "firebase-admin/app";
import { getDataConnect, type DataConnect } from "firebase-admin/data-connect";
const id = z.string().min(1),
  integer = z.number().int().nonnegative(),
  qty = z.number().int().min(1).max(99);
const state = z.enum([
  "PENDING_APPROVAL",
  "RESERVED",
  "DISPATCHED",
  "RECEIVED",
  "REJECTED",
]);
const timestamp = z.string().refine((v) => Number.isFinite(Date.parse(v)));
const scope = { businessId: id };
const request = z.strictObject({
  id,
  ...scope,
  salonId: id,
  productId: id,
  quantity: qty,
  state,
  revision: integer.min(1),
  createdAt: timestamp,
});
const transfer = z.strictObject({
  requestId: id,
  ...scope,
  warehouseId: id,
  destinationId: id,
  productId: id,
  quantity: qty,
  dispatchedQuantity: integer,
  receivedQuantity: integer,
});
const movement = z.strictObject({
  transferRequestId: id,
  ...scope,
  type: z.enum(["DISPATCH", "RECEIPT"]),
  quantity: qty,
  actorUid: id,
  createdAt: timestamp,
});
const receipt = z.strictObject({
  id,
  ...scope,
  actorUid: id,
  idempotencyKey: id,
  requestId: id,
  action: z.enum(["SUBMIT", "APPROVE", "REJECT", "DISPATCH", "RECEIVE"]),
  payloadHash: id,
  semanticHash: id,
  state,
  revision: integer.min(1),
  reason: z.string().nullable(),
  createdAt: timestamp,
});
const key = z.strictObject({
  ...scope,
  actorUid: id,
  idempotencyKey: id,
  receiptId: id,
  payloadHash: id,
});
const snapshotSchema = z.strictObject({
  format: z.literal(1),
  projectId: id,
  businessId: id,
  schemaCommit: id,
  quiescent: z.boolean(),
  complete: z.boolean(),
  exportedAt: timestamp,
  requests: z.array(request),
  active: z.array(
    z.strictObject({ ...scope, salonId: id, productId: id, requestId: id }),
  ),
  transfers: z.array(transfer),
  movements: z.array(movement),
  receipts: z.array(receipt),
  actionKeys: z.array(key),
  inventory: z.array(
    z.strictObject({
      locationId: id,
      productId: id,
      onHand: integer,
      reserved: integer,
      version: integer.min(1),
    }),
  ),
});
export type LegacySnapshot = z.infer<typeof snapshotSchema>;
export function parseLegacySnapshot(input: unknown): LegacySnapshot {
  return snapshotSchema.parse(input);
}
const digest = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
export const requestItemId = (requestId: string, productId: string) =>
  `item:${digest([requestId, productId])}`;
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
function unique<T>(rows: T[], keyOf: (row: T) => string) {
  const keys = rows.map(keyOf);
  assert(new Set(keys).size === keys.length, "Duplicate record in snapshot");
}
export function validateLegacySnapshot(s: LegacySnapshot): void {
  assert(s.complete && s.quiescent, "Complete quiescent snapshot required");
  for (const rows of [
    s.requests,
    s.active,
    s.transfers,
    s.movements,
    s.receipts,
    s.actionKeys,
  ])
    for (const r of rows)
      assert(r.businessId === s.businessId, "Mixed-business snapshot");
  unique(s.requests, (r) => r.id);
  unique(s.active, (r) => JSON.stringify([r.salonId, r.productId]));
  unique(s.transfers, (r) => r.requestId);
  unique(s.movements, (r) => JSON.stringify([r.transferRequestId, r.type]));
  unique(s.receipts, (r) => r.id);
  unique(s.receipts, (r) => JSON.stringify([r.requestId, r.action]));
  unique(s.actionKeys, (r) => JSON.stringify([r.actorUid, r.idempotencyKey]));
  unique(s.inventory, (r) => JSON.stringify([r.locationId, r.productId]));
  const requests = new Map(s.requests.map((r) => [r.id, r]));
  const receipts = new Map(s.receipts.map((r) => [r.id, r]));
  for (const r of s.requests) {
    const active = s.active.filter((a) => a.requestId === r.id),
      t = s.transfers.find((t) => t.requestId === r.id);
    assert(
      active.length ===
        (["PENDING_APPROVAL", "RESERVED", "DISPATCHED"].includes(r.state)
          ? 1
          : 0),
      "Incorrect active slots",
    );
    assert(
      active.every(
        (a) => a.productId === r.productId && a.salonId === r.salonId,
      ),
      "Active slot mismatch",
    );
    assert(
      Boolean(t) === ["RESERVED", "DISPATCHED", "RECEIVED"].includes(r.state),
      "Transfer missing or unexpected",
    );
    if (t) {
      assert(
        t.productId === r.productId &&
          t.quantity === r.quantity &&
          t.destinationId === r.salonId,
        "Transfer mismatch",
      );
      assert(
        t.dispatchedQuantity ===
          (["DISPATCHED", "RECEIVED"].includes(r.state) ? r.quantity : 0),
        "Dispatch quantity mismatch",
      );
      assert(
        t.receivedQuantity === (r.state === "RECEIVED" ? r.quantity : 0),
        "Receipt quantity mismatch",
      );
    }
    const audits = s.receipts
      .filter((a) => a.requestId === r.id)
      .sort((a, b) => a.revision - b.revision);
    const actions =
      r.state === "REJECTED"
        ? ["SUBMIT", "REJECT"]
        : ["SUBMIT", "APPROVE", "DISPATCH", "RECEIVE"].slice(0, r.revision);
    assert(
      audits.length === r.revision &&
        audits.every((a, i) => a.revision === i + 1 && a.action === actions[i]),
      "Incomplete audit sequence",
    );
    assert(audits.at(-1)?.state === r.state, "Audit state mismatch");
    if (r.state === "REJECTED")
      assert(audits.at(-1)?.reason?.trim(), "Missing rejection reason");
    for (const type of ["DISPATCH", "RECEIPT"] as const) {
      const moves = s.movements.filter(
        (m) => m.transferRequestId === r.id && m.type === type,
      );
      const expected =
        type === "DISPATCH"
          ? ["DISPATCHED", "RECEIVED"].includes(r.state)
          : r.state === "RECEIVED";
      assert(
        moves.length === (expected ? 1 : 0) &&
          moves.every((m) => m.quantity === r.quantity),
        "Movement mismatch",
      );
    }
    assert(
      s.inventory.some(
        (i) => i.locationId === r.salonId && i.productId === r.productId,
      ),
      "Missing salon inventory",
    );
  }
  for (const a of [...s.active, ...s.transfers, ...s.receipts])
    assert(requests.has(a.requestId), "Orphan request reference");
  for (const m of s.movements)
    assert(
      s.transfers.some((t) => t.requestId === m.transferRequestId),
      "Orphan movement",
    );
  for (const k of s.actionKeys) {
    const r = receipts.get(k.receiptId);
    assert(r && r.businessId === k.businessId, "Orphan action key");
  }
  for (const r of s.receipts)
    assert(
      s.actionKeys.some(
        (k) =>
          k.actorUid === r.actorUid &&
          k.idempotencyKey === r.idempotencyKey &&
          k.receiptId === r.id &&
          k.payloadHash === r.payloadHash,
      ),
      "Missing original action key",
    );
  for (const i of s.inventory) {
    const reserved = s.transfers
      .filter(
        (t) =>
          t.warehouseId === i.locationId &&
          t.productId === i.productId &&
          requests.get(t.requestId)?.state === "RESERVED",
      )
      .reduce((sum, t) => sum + t.quantity, 0);
    assert(
      i.reserved === reserved && i.onHand >= i.reserved,
      "Inventory reservation mismatch",
    );
  }
}
export function convertLegacySnapshot(input: LegacySnapshot) {
  const s = parseLegacySnapshot(input);
  validateLegacySnapshot(s);
  return {
    ...s,
    format: 2 as const,
    requests: s.requests.map(({ productId, quantity, ...header }) => header),
    items: s.requests.map((r) => ({
      id: requestItemId(r.id, r.productId),
      requestId: r.id,
      productId: r.productId,
      quantity: r.quantity,
    })),
    transfers: s.transfers.map(
      ({
        productId,
        quantity,
        dispatchedQuantity,
        receivedQuantity,
        ...header
      }) => header,
    ),
    transferItems: s.transfers.map((t) => ({
      requestItemId: requestItemId(t.requestId, t.productId),
      transferRequestId: t.requestId,
      quantity: t.quantity,
      dispatchedQuantity: t.dispatchedQuantity,
      receivedQuantity: t.receivedQuantity,
    })),
    movements: s.movements.map(({ transferRequestId, ...m }) => ({
      ...m,
      transferItemRequestItemId: requestItemId(
        transferRequestId,
        s.requests.find((r) => r.id === transferRequestId)!.productId,
      ),
    })),
  };
}
export type ItemsSnapshot = ReturnType<typeof convertLegacySnapshot>;
export function assertMigrationTarget(v: {
  projectId: string;
  businessId: string;
  confirm: string;
  quiescent: boolean;
}) {
  assert(
    ["demo-barberhq", "notbad-6be95"].includes(v.projectId) &&
      v.businessId === "not-bad-stuff-demo" &&
      v.confirm === v.businessId &&
      v.quiescent,
    "Explicit approved target, confirmation and quiescence required",
  );
}
const counts = (s: LegacySnapshot) =>
  Object.fromEntries(
    [
      "requests",
      "active",
      "transfers",
      "movements",
      "receipts",
      "actionKeys",
      "inventory",
    ].map((k) => [k, (s[k as keyof LegacySnapshot] as unknown[]).length]),
  );
export function encodeBackup(input: LegacySnapshot) {
  const snapshot = parseLegacySnapshot(input);
  validateLegacySnapshot(snapshot);
  return { checksum: digest(snapshot), counts: counts(snapshot), snapshot };
}
export function decodeBackup(input: unknown): LegacySnapshot {
  const envelope = z
    .strictObject({
      checksum: id,
      counts: z.record(z.string(), integer),
      snapshot: snapshotSchema,
    })
    .parse(input);
  assert(
    digest(envelope.snapshot) === envelope.checksum,
    "Backup checksum mismatch",
  );
  assert(
    JSON.stringify(counts(envelope.snapshot)) ===
      JSON.stringify(envelope.counts),
    "Backup counts mismatch",
  );
  validateLegacySnapshot(envelope.snapshot);
  return envelope.snapshot;
}
const selections = {
  requests: [
    "replenishmentRequests",
    "id businessId salonId productId quantity state revision createdAt",
    "{id:ASC}",
  ],
  active: [
    "activeRequests",
    "businessId salonId productId requestId",
    "[{salonId:ASC},{productId:ASC}]",
  ],
  transfers: [
    "transfers",
    "requestId businessId warehouseId destinationId productId quantity dispatchedQuantity receivedQuantity",
    "{requestId:ASC}",
  ],
  movements: [
    "stockMovements",
    "transferRequestId businessId type quantity actorUid createdAt",
    "[{transferRequestId:ASC},{type:ASC}]",
  ],
  receipts: [
    "actionReceipts",
    "id businessId actorUid idempotencyKey requestId action payloadHash semanticHash state revision reason createdAt",
    "{id:ASC}",
  ],
  actionKeys: [
    "actionKeys",
    "businessId actorUid idempotencyKey receiptId payloadHash",
    "[{actorUid:ASC},{idempotencyKey:ASC}]",
  ],
  inventory: [
    "inventories",
    "locationId productId onHand reserved version",
    "[{locationId:ASC},{productId:ASC}]",
  ],
} as const;
export async function exportLegacySnapshot(
  dc: DataConnect,
  projectId: string,
  businessId: string,
): Promise<LegacySnapshot> {
  const tables: Record<string, unknown[]> = {};
  for (const [key, [table, fields, order]] of Object.entries(selections)) {
    const rows: unknown[] = [];
    for (let offset = 0; ; offset += 100) {
      const where =
        key === "inventory"
          ? "{location:{businessId:{eq:$businessId}}}"
          : "{businessId:{eq:$businessId}}";
      const response = await dc.executeGraphql<
        { rows: unknown[] },
        { businessId: string; offset: number }
      >(
        `query Export($businessId:String!,$offset:Int!){ rows:${table}(where:${where},orderBy:${order},limit:100,offset:$offset){${fields}}}`,
        { variables: { businessId, offset } },
      );
      rows.push(...response.data.rows);
      if (response.data.rows.length < 100) break;
    }
    tables[key] = rows;
  }
  return parseLegacySnapshot({
    format: 1,
    projectId,
    businessId,
    schemaCommit: "197f93c",
    quiescent: true,
    complete: true,
    exportedAt: new Date().toISOString(),
    ...tables,
  });
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const { values: v } = parseArgs({
    options: {
      project: { type: "string" },
      business: { type: "string" },
      confirm: { type: "string" },
      quiescent: { type: "boolean" },
      backup: { type: "string" },
      export: { type: "boolean" },
      verify: { type: "boolean" },
    },
  });
  const target = {
    projectId: v.project ?? "",
    businessId: v.business ?? "",
    confirm: v.confirm ?? "",
    quiescent: !!v.quiescent,
  };
  assertMigrationTarget(target);
  assert(
    v.backup && Boolean(v.export) !== Boolean(v.verify),
    "Choose --export or --verify and an explicit --backup file",
  );
  if (v.verify) {
    const s = decodeBackup(JSON.parse(readFileSync(v.backup, "utf8")));
    assert(
      s.projectId === target.projectId && s.businessId === target.businessId,
      "Backup target mismatch",
    );
    console.log({ verified: true, counts: counts(s) });
  } else {
    const local = target.projectId === "demo-barberhq";
    assert(
      local
        ? process.env.DATA_CONNECT_EMULATOR_HOST === "127.0.0.1:9399"
        : !process.env.DATA_CONNECT_EMULATOR_HOST,
      "Emulator configuration must match target",
    );
    const app = initializeApp(
      {
        projectId: target.projectId,
        ...(!local ? { credential: applicationDefault() } : {}),
      },
      "replenishment-export",
    );
    try {
      const dc = getDataConnect(
        { serviceId: "barberhq", location: "europe-west1" },
        app,
      );
      const s = await exportLegacySnapshot(
        dc,
        target.projectId,
        target.businessId,
      );
      const envelope = encodeBackup(s);
      writeFileSync(v.backup, JSON.stringify(envelope, null, 2) + "\n", {
        flag: "wx",
        mode: 0o600,
      });
      console.log({ exported: true, counts: envelope.counts });
    } finally {
      await deleteApp(app);
    }
  }
}
