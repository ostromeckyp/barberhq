import type { LookupAlias } from '../../../../shared/contracts/product-lookup/index.js';
import type { ReplenishmentProduct } from './replenishment-product.js';

export type ReplenishmentContext = {
  products: ReplenishmentProduct[];
  aliases: LookupAlias[];
  catalogRevision: number;
  salonAliasRevision: number;
};
