import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import {
  initializeApp,
  deleteApp,
  applicationDefault,
} from "firebase-admin/app";
import { getDataConnect, type DataConnect } from "firebase-admin/data-connect";
import * as sdk from "@barberhq/server";
import { validateSeed } from "../prepare-data/catalog.ts";
export type ResetInput = {
  projectId: string;
  businessKey: string;
  confirmBusinessKey: string;
  dryRun: boolean;
  quiescent: boolean;
};
const BUSINESS = "not-bad-stuff-demo";
export async function resetDemo(input: ResetInput) {
  if (
    !["notbad-6be95", "demo-barberhq"].includes(input.projectId) ||
    input.businessKey !== BUSINESS ||
    input.confirmBusinessKey !== BUSINESS ||
    !input.quiescent
  )
    throw new Error(
      "Reset requires the approved demo target, exact business confirmation and --quiescent.",
    );
  const local = input.projectId === "demo-barberhq";
  if (local) {
    if (process.env.DATA_CONNECT_EMULATOR_HOST !== "127.0.0.1:9399")
      throw new Error(
        "Local reset requires DATA_CONNECT_EMULATOR_HOST=127.0.0.1:9399.",
      );
  } else if (process.env.DATA_CONNECT_EMULATOR_HOST)
    throw new Error("Cloud reset refuses emulator configuration.");
  const app = initializeApp(
    {
      projectId: input.projectId,
      ...(!local ? { credential: applicationDefault() } : {}),
    },
    `reset-${Date.now()}`,
  );
  try {
    return await resetRecords(
      getDataConnect(sdk.connectorConfig, app),
      input.businessKey,
      input.dryRun,
    );
  } finally {
    await deleteApp(app);
  }
}
/** Same transaction for CLI and isolated test fixtures; never exposed as a callable. */
export async function resetRecords(
  dc: DataConnect,
  businessId: string,
  dryRun: boolean,
) {
  const seed = validateSeed(
    JSON.parse(
      readFileSync(
        new URL("../../data/seed/business.json", import.meta.url),
        "utf8",
      ),
    ),
  );
  if (
    seed.inventory.some((r) => r.onHand !== (r.locationKey === "hq" ? 18 : 2))
  )
    throw new Error("Reset operation must be updated for this seed.");
  if (dryRun) {
    const { data } = await sdk.readResetCounts(dc, { businessId });
    return {
      deletedOperationalRows: [
        data.requests,
        data.active,
        data.transfers,
        data.movements,
        data.receipts,
        data.keys,
      ].reduce((total, rows) => total + (rows[0]?._count ?? 0), 0),
      resetInventoryRows: data.inventories[0]?._count ?? 0,
    };
  }
  const { data } = await sdk.resetDemoStock(dc, {
    businessId,
    productIds: seed.products.map((p) => `${businessId}:${p.demoId}`),
  });
  return {
    deletedOperationalRows:
      data.keys +
      data.receipts +
      data.movements +
      data.transfers +
      data.active +
      data.requests,
    resetInventoryRows: data.hq + data.salons,
  };
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
      apply: { type: "boolean" },
      "dry-run": { type: "boolean" },
    },
  });
  if (Boolean(v.apply) === Boolean(v["dry-run"]))
    throw new Error(
      "Choose exactly one of --dry-run / --apply. Close demo sessions before reset.",
    );
  const input: ResetInput = {
    projectId: v.project ?? "",
    businessKey: v.business ?? "",
    confirmBusinessKey: v.confirm ?? "",
    quiescent: !!v.quiescent,
    dryRun: true,
  };
  console.log({
    projectId: input.projectId,
    businessKey: input.businessKey,
    dryRun: await resetDemo(input),
  });
  if (v.apply)
    console.log({ applied: await resetDemo({ ...input, dryRun: false }) });
}
