import { beforeEach, afterEach, it, expect } from "vitest";
import { createCloudHarness } from "../support/cloud.ts";
import { QueryFetchPolicy } from "firebase/data-connect";
import * as sdk from "@barberhq/browser";
import { resetRecords } from "../../scripts/seed/reset.ts";
let h: Awaited<ReturnType<typeof createCloudHarness>>;
beforeEach(async () => {
  h = await createCloudHarness("settings");
});
afterEach(async () => {
  if (h) await h.dispose();
});
const read = async (salonId = h.legnickaId) =>
  (
    await sdk.getSalonSettings(
      h.browserClient("hq"),
      { salonId },
      { fetchPolicy: QueryFetchPolicy.SERVER_ONLY },
    )
  ).data.settings!;
const save = (
  threshold: number,
  version: number,
  salonId = h.legnickaId,
  role: "hq" | "legnicka" | "lodzka" | "foreign" | "unassigned" = "legnicka",
) =>
  sdk.saveSalonSettings(h.browserClient(role), {
    salonId,
    lowStockThreshold: threshold,
    expectedVersion: version,
  });
it("guards_salon_settings_and_integer_bounds", async () => {
  expect(await read()).toMatchObject({ lowStockThreshold: 2, version: 1 });
  await save(4, 1);
  expect(await read()).toMatchObject({ lowStockThreshold: 4, version: 2 });
  for (const key of ["lodzka", "zakladowa"])
    expect(await read(`${h.businessId}:${key}`)).toMatchObject({
      lowStockThreshold: 2,
      version: 1,
    });
  await save(0, 2);
  await save(2147483647, 3);
  expect((await read()).lowStockThreshold).toBe(2147483647);
  for (const value of [-1, 1.5, 2147483648])
    await expect(save(value, 4)).rejects.toThrow();
  for (const role of ["lodzka", "foreign", "unassigned"] as const) {
    await expect(save(3, 4, h.legnickaId, role)).rejects.toThrow();
    await expect(
      sdk.getSalonSettings(h.browserClient(role), { salonId: h.legnickaId }),
    ).rejects.toThrow();
  }
  await expect(save(3, 4, `${h.businessId}:hq`, "hq")).rejects.toThrow();
  await expect(save(3, 1)).rejects.toThrow();
  expect((await read()).version).toBe(4);
});
it("one_version_allows_one_save", async () => {
  const results = await Promise.allSettled([save(3, 1), save(4, 1)]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect((await read()).version).toBe(2);
});
it("seed_and_reset_preserve_settings_and_insert_only_missing_defaults", async () => {
  await save(8, 1);
  const before = await read();
  await h.operator.executeGraphql(
    "mutation($id:String!){salonSettings_delete(key:{salonId:$id})}",
    { variables: { id: `${h.businessId}:lodzka` } },
  );
  await expect(read(`${h.businessId}:lodzka`)).rejects.toThrow();
  await h.seedAgain();
  expect(await read()).toEqual(before);
  expect((await read(`${h.businessId}:lodzka`)).lowStockThreshold).toBe(2);
  await resetRecords(h.operator, h.businessId, false);
  expect(await read()).toEqual(before);
});
