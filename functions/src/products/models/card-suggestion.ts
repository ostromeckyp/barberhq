import type { ProductAliasKind } from '../../../../shared/contracts/product-admin/index.js';

export type CardSuggestion = { phrase: string; kind: ProductAliasKind; collisions: string[] };
