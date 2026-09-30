import { Service, inject } from '@angular/core';
import { FIREBASE } from './firebase.providers';
import { getSalonInventory } from './generated';
import type { InventoryRow } from '../../../../shared/contracts/business';
@Service()
export class StockApi {
  private readonly firebase = inject(FIREBASE);
  async getInventory(salonId: string): Promise<InventoryRow[]> {
    const rows: InventoryRow[] = [];
    for (let offset = 0; ; offset += 50) {
      const result = (await getSalonInventory(this.firebase.data, { salonId, limit: 50, offset }))
        .data.membership?.business;
      if (!result || !result.salon[0] || !result.hq[0])
        throw new Error('Inventory is not available.');
      const stock = result.salon[0].inventory;
      for (const row of stock) {
        const hq = result.hq[0].inventory.find((r) => r.productId === row.product.id);
        if (!hq) throw new Error('HQ inventory is incomplete.');
        rows.push({
          productId: row.product.id,
          demoId: row.product.demoId,
          productName: row.product.name,
          netContent: { value: row.product.netContentMl, unit: 'ml' },
          salonId,
          salonOnHand: row.onHand,
          salonInventoryVersion: row.version,
          hqOnHand: hq.onHand,
          hqReserved: hq.reserved,
          hqAvailable: hq.onHand - hq.reserved,
          hqInventoryVersion: hq.version,
        });
      }
      if (stock.length < 50) return rows;
    }
  }
}
