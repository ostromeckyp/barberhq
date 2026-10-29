import { it, expect } from 'vitest';
import { createCloudHarness } from '../support/cloud.ts';
it('preserves_existing_inventory_on_reseed', async () => {
  const h = await createCloudHarness('seed');
  try {
    await h.setInventory('hq', 'NBS-MATOWA-100', 16);
    await h.dryRun();
    expect((await h.inventory()).hqOnHand).toBe(16);
    await h.seedAgain();
    expect((await h.inventory()).hqOnHand).toBe(16);
    expect(await h.inventoryRowCount()).toBe(24);
  } finally {
    await h.dispose();
  }
});
