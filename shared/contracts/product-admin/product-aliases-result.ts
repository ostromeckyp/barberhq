import type { ProductAliasRow } from './product-alias-row.js';
export type ProductAliasesResult = {
  aliases: ProductAliasRow[];
  collisions: { phrase: string; productNames: string[] }[];
};
