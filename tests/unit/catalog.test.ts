import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { buildSeed, validateSeed } from "../../scripts/prepare-data/catalog.ts";
const catalog = JSON.parse(
  readFileSync("docs/not-bad-stuff-products.json", "utf8"),
);
describe("catalog fixtures", () => {
  it("preserves product identity, source facts and unknown packaging", () => {
    const seed = buildSeed(catalog);
    expect(seed.products).toHaveLength(6);
    expect(seed.products[0]).toMatchObject({
      demoId: "NBS-MATOWA-100",
      sourceCode: "5905191055165",
      retailPriceGrosz: 6900,
      packageDimensionsMm: null,
      shippingWeightGrams: null,
      observedOn: "2026-09-22",
    });
    expect(seed.products.map((p) => p.sourceUrl)).toEqual(
      catalog.products.map((p: { sourceUrl: string }) => p.sourceUrl),
    );
    expect(buildSeed(catalog)).toEqual(seed);
  });
  it("creates four locations and 24 initial stock rows including 18/2", () => {
    const seed = buildSeed(catalog);
    expect(seed.locations.map((l) => l.key)).toEqual([
      "hq",
      "legnicka",
      "lodzka",
      "zakladowa",
    ]);
    expect(seed.inventory).toHaveLength(24);
    expect(
      seed.inventory.find(
        (r) => r.locationKey === "hq" && r.productDemoId === "NBS-MATOWA-100",
      )?.onHand,
    ).toBe(18);
    expect(
      seed.inventory.find(
        (r) =>
          r.locationKey === "legnicka" && r.productDemoId === "NBS-MATOWA-100",
      )?.onHand,
    ).toBe(2);
    expect(seed.inventory.every((r) => r.reserved === 0)).toBe(true);
  });
  it("rejects fractional inventory and duplicate products before importing", () => {
    const seed = buildSeed(catalog);
    seed.inventory[0].onHand = 1.5;
    expect(() => validateSeed(seed)).toThrow();
    const changed = structuredClone(catalog);
    changed.products[1].demoId = changed.products[0].demoId;
    expect(() => buildSeed(changed)).toThrow();
  });
  it("validates complete seed metadata and business-scoped IDs", () => {
    const seed = buildSeed(catalog);
    seed.products[0].retailPriceGrosz = -1;
    expect(() => validateSeed(seed)).toThrow();
    const foreign = buildSeed(catalog);
    foreign.locations[0].id = "foreign:hq";
    expect(() => validateSeed(foreign)).toThrow();
  });
  it("rejects invalid prices and a missing product", () => {
    const changed = structuredClone(catalog);
    changed.products[0].displayedRetailPrice.amount = Infinity;
    expect(() => buildSeed(changed)).toThrow();
    changed.products[0].displayedRetailPrice.amount = 69;
    changed.products.pop();
    expect(() => buildSeed(changed)).toThrow();
  });
});
