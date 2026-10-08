import { Service, inject } from '@angular/core';
import { QueryFetchPolicy } from 'firebase/data-connect';
import { FIREBASE } from '../../../core/firebase.providers';
import { getHqInventory } from '../../../core/generated';

export interface HqStockRow {
  productId: string;
  demoId: string;
  name: string;
  netContentMl: number;
  onHand: number;
  reserved: number;
  available: number;
}
@Service()
export class HqStockApi {
  private readonly firebase = inject(FIREBASE);
  async load(signal: AbortSignal): Promise<HqStockRow[]> {
    const rows: HqStockRow[] = [];
    for (let offset = 0; ; offset += 50) {
      signal.throwIfAborted();
      const result = await getHqInventory(
        this.firebase.data,
        { limit: 50, offset },
        { fetchPolicy: QueryFetchPolicy.SERVER_ONLY },
      );
      signal.throwIfAborted();
      const hq = result.data.membership?.business.hq[0];
      if (!hq) throw new Error('HQ inventory unavailable');
      rows.push(
        ...hq.inventory.map((row) => ({
          productId: row.product.id,
          demoId: row.product.demoId,
          name: row.product.name,
          netContentMl: row.product.netContentMl,
          onHand: row.onHand,
          reserved: row.reserved,
          available: row.onHand - row.reserved,
        })),
      );
      if (hq.inventory.length < 50) return rows;
    }
  }
}
