import type { InventoryRow } from '../business/inventory-row.js';
import type { RequestItemSummary } from './request-item-summary.js';
export type RequestDetailItem = RequestItemSummary & {
  dispatchedQuantity: number;
  receivedQuantity: number;
  stock: InventoryRow;
  delivery?: {
    inTransit: number;
    goodQuantity: number;
    damagedQuantity: number;
    missingQuantity: number;
  };
};
