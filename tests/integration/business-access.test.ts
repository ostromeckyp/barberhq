import { it, expect } from "vitest";
import { createCloudHarness } from "../support/cloud.ts";
it("rejects_unassigned_and_foreign_reads", async () => {
  const h = await createCloudHarness("access");
  try {
    for (const role of ["unassigned", "lodzka", "foreign"] as const)
      await expect(
        h.client(role).getSalonInventory(h.legnickaId),
      ).rejects.toThrow();
    expect(
      (await h.client("legnicka").getSalonInventory(h.legnickaId)).inventory,
    ).toHaveLength(6);
    await expect(h.ordinaryOperatorWrite()).rejects.toThrow();
  } finally {
    await h.dispose();
  }
});
