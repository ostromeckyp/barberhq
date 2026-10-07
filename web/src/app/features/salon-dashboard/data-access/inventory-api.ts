import { mapInventory } from './inventory.mapper';
import { Service, inject } from '@angular/core';
import { QueryFetchPolicy } from 'firebase/data-connect';
import { FIREBASE } from '../../../core/firebase.providers';
import { getSalonInventory } from '../../../core/generated';
import type { InventoryRow } from '../../../../../../shared/contracts/business';
@Service()
export class InventoryApi {
  private readonly firebase = inject(FIREBASE);
  async getInventory(salonId: string, abortSignal?: AbortSignal): Promise<InventoryRow[]> {
    const rows: InventoryRow[] = [];
    for (let offset = 0; ; offset += 50) {
      abortSignal?.throwIfAborted();
      const result = (
        await getSalonInventory(
          this.firebase.data,
          { salonId, limit: 50, offset },
          { fetchPolicy: QueryFetchPolicy.SERVER_ONLY },
        )
      ).data.membership?.business;
      // The SDK cannot cancel its HTTP request; discard results after cancellation.
      abortSignal?.throwIfAborted();
      const page = mapInventory(salonId, result);
      rows.push(...page);
      if (page.length < 50) return rows;
    }
  }
}
