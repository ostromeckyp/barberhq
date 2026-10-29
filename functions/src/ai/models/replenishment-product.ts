import type { StockContext } from '../../../../shared/contracts/ai/index.js';
import type { LookupProduct } from '../../../../shared/contracts/product-lookup/index.js';

export type ReplenishmentProduct = LookupProduct & StockContext;
