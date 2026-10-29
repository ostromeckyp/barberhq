import type { LookupAliasKind } from './lookup-alias-kind.js';
import type { LookupAliasSource } from './lookup-alias-source.js';
export type LookupCandidate = {
  productId: string;
  productName: string;
  /** Null only for `match:'NONE'` catalog fallback candidates, which carry no evidence. */
  via: {
    phrase: string;
    kind: LookupAliasKind;
    source: 'CATALOG' | LookupAliasSource;
  } | null;
};
