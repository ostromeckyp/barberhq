import type { ProductAliasKind } from './product-alias-kind.js';
export type ProductAliasRow = {
  id: string;
  phrase: string;
  kind: ProductAliasKind;
  source: 'HQ' | 'SEED' | 'DOCUMENT';
  editable: boolean;
  revision: number;
};
