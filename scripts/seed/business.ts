import { z } from "zod";
import {
  initializeApp,
  applicationDefault,
  deleteApp,
} from "firebase-admin/app";
import { getDataConnect, type DataConnect } from "firebase-admin/data-connect";
import * as sdk from "@barberhq/server";
import type { BusinessSeed } from "../../shared/contracts/business.ts";
import { validateSeed } from "../prepare-data/catalog.ts";
export type MembershipSeed = {
  uid: string;
  role: "HQ" | "SALON";
  salonKeys: string[];
};
export type SeedInput = {
  projectId: string;
  businessKey: string;
  dryRun: boolean;
  seed: BusinessSeed;
  memberships: MembershipSeed[];
};
export type SeedReport = {
  created: number;
  updatedMetadata: number;
  preservedInventory: number;
};
type Stock = { locationId: string; productId: string; onHand: number };
export function planSeed(seed: BusinessSeed, existing: Stock[]) {
  validateSeed(seed);
  const existingKeys = new Set(
    existing.map((r) => `${r.locationId}/${r.productId}`),
  );
  const inventory = seed.inventory.map((r) => ({
    locationId: `${seed.businessKey}:${r.locationKey}`,
    productId: `${seed.businessKey}:${r.productDemoId}`,
    onHand: r.onHand,
  }));
  const inventoryToInsert = inventory.filter(
    (r) => !existingKeys.has(`${r.locationId}/${r.productId}`),
  );
  return {
    inventoryToInsert,
    preservedInventory: inventory.length - inventoryToInsert.length,
  };
}
const membershipSchema = z
  .array(
    z.strictObject({
      uid: z.string().min(1).max(128),
      role: z.enum(["HQ", "SALON"]),
      salonKeys: z
        .array(z.enum(["legnicka", "lodzka", "zakladowa"]))
        .refine((a) => new Set(a).size === a.length),
    }),
  )
  .refine((a) => new Set(a.map((m) => m.uid)).size === a.length);
/** Also used by the isolated integration harness with a fresh business key. */
export async function seedRecords(
  dc: DataConnect,
  seed: BusinessSeed,
  businessId: string,
  members: MembershipSeed[],
  dryRun: boolean,
): Promise<SeedReport> {
  validateSeed(seed);
  membershipSchema.parse(members);
  if (members.some((m) => m.role === "SALON" && m.salonKeys.length === 0))
    throw new Error("Salon membership requires at least one salon");
  for (const m of members) {
    const existing = (await sdk.readMembership(dc, { uid: m.uid })).data
      .membership;
    if (existing && existing.businessId !== businessId)
      throw new Error(
        "Refusing to move an existing member to another business",
      );
  }
  const current = (await sdk.readSeedState(dc, { businessId })).data;
  const remap = (id: string) =>
    id.replace(`${seed.businessKey}:`, `${businessId}:`);
  const planned = planSeed(
    seed,
    current.inventories.map((r) => ({
      ...r,
      locationId: r.locationId.replace(
        `${businessId}:`,
        `${seed.businessKey}:`,
      ),
      productId: r.productId.replace(`${businessId}:`, `${seed.businessKey}:`),
    })),
  );
  const missing = planned.inventoryToInsert.map((r) => ({
    ...r,
    locationId: remap(r.locationId),
    productId: remap(r.productId),
  }));
  const report = {
    created:
      (current.business ? 0 : 1) +
      seed.locations.filter(
        (l) => !current.locations.some((x) => x.id === remap(l.id)),
      ).length +
      seed.products.filter(
        (p) => !current.products.some((x) => x.id === remap(p.id)),
      ).length +
      missing.length,
    updatedMetadata:
      (current.business ? 1 : 0) +
      current.locations.length +
      current.products.length,
    preservedInventory: 24 - missing.length,
  };
  if (dryRun) return report;
  await sdk.upsertBusiness(dc, {
    id: businessId,
    name: "Not Bad Stuff — demo",
  });
  for (const l of seed.locations)
    await sdk.upsertLocation(dc, {
      ...l,
      id: remap(l.id),
      businessId,
      kind: l.kind === "HQ" ? sdk.LocationKind.HQ : sdk.LocationKind.SALON,
    });
  for (const p of seed.products) {
    const {
      netContent,
      transferPackSize,
      packageDimensionsMm,
      shippingWeightGrams,
      ...metadata
    } = p;
    await sdk.upsertProduct(dc, {
      ...metadata,
      id: remap(p.id),
      businessId,
      netContentMl: netContent.value,
    });
  }
  // Inserts only: a concurrent seed may conflict, but can never overwrite live stock.
  for (const row of missing) await sdk.insertInventory(dc, row);
  for (const m of members) {
    await sdk.upsertMembership(dc, {
      uid: m.uid,
      businessId,
      role: m.role === "HQ" ? sdk.MemberRole.HQ : sdk.MemberRole.SALON,
    });
    for (const key of m.salonKeys)
      await sdk.upsertSalonAccess(dc, {
        uid: m.uid,
        locationId: `${businessId}:${key}`,
      });
  }
  return report;
}
export async function seedBusiness(input: SeedInput): Promise<SeedReport> {
  if (
    input.projectId !== "notbad-6be95" ||
    input.businessKey !== input.seed.businessKey
  )
    throw new Error(
      "Seed target does not match the approved demo project/business",
    );
  const app = initializeApp(
    { projectId: input.projectId, credential: applicationDefault() },
    `seed-${Date.now()}`,
  );
  try {
    return await seedRecords(
      getDataConnect(sdk.connectorConfig, app),
      input.seed,
      input.businessKey,
      input.memberships,
      input.dryRun,
    );
  } finally {
    await deleteApp(app);
  }
}
