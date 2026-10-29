import { readFileSync } from 'node:fs';
import { it, expect } from 'vitest';
import { planSeed } from '../../scripts/seed/business.ts';
import type { BusinessSeed } from '../../shared/contracts/business/index.ts';
const seed: BusinessSeed = JSON.parse(readFileSync('data/seed/business.json', 'utf8'));
it('plans only missing stock rows and preserves changed quantities', () => {
  const plan = planSeed(seed, [
    {
      locationId: seed.locations[0].id,
      productId: seed.products[0].id,
      onHand: 16,
    },
  ]);
  expect(plan.inventoryToInsert).toHaveLength(23);
  expect(plan.preservedInventory).toBe(1);
  expect(
    plan.inventoryToInsert.some(
      (r) => r.locationId === seed.locations[0].id && r.productId === seed.products[0].id,
    ),
  ).toBe(false);
});
