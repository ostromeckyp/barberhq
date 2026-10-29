import type { GetSalonInventoryData } from '../../../core/generated';
import type { InventoryRow } from '../../../../../../shared/contracts/business/index';

type InventoryBusiness = NonNullable<GetSalonInventoryData['membership']>['business'];

export function mapInventory(
  salonId: string,
  result: InventoryBusiness | undefined,
): InventoryRow[] {
  if (!result || !result.salon[0] || !result.hq[0]) throw new Error('Inventory is not available.');
  const stock = result.salon[0].inventory;
  const rows: InventoryRow[] = [];
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
  return rows;
}
