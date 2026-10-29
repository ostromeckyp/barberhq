import type { ProductAliasKind } from './product-alias-kind.js';
export type AliasProposal = {
  id: string;
  productId: string;
  phrase: string;
  kind: ProductAliasKind;
  lang: 'pl' | 'en';
  source: 'generated' | 'hq';
  decision: 'pending' | 'accepted' | 'rejected';
};
