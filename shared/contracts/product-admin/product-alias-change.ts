import type { ProductAliasKind } from './product-alias-kind.js';
export type ProductAliasChange =
  | { op: 'add'; phrase: string; kind: ProductAliasKind }
  | {
      op: 'edit';
      aliasId: string;
      expectedRevision: number;
      phrase: string;
      kind: ProductAliasKind;
    }
  | { op: 'remove'; aliasId: string; expectedRevision: number };
