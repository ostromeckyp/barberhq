import type { ProductAliasChange } from './product-alias-change.js';
export type SaveProductAliasesInput = {
  productId: string;
  changes: ProductAliasChange[];
  idempotencyKey: string;
};
