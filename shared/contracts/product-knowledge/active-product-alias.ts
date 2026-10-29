import type { ProductAliasKind } from './product-alias-kind.js';
export type ActiveProductAlias = {
  productId: string;
  normalized: string;
  kind: ProductAliasKind;
  lang: 'pl' | 'en';
  sourceVersionId: string | null;
};
