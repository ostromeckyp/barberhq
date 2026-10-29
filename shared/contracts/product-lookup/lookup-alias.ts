import type { LookupAliasKind } from './lookup-alias-kind.js';
import type { LookupAliasSource } from './lookup-alias-source.js';
export type LookupAlias = {
  id: string;
  productId: string;
  phrase: string;
  normalized: string;
  /** SALON_CONFIRMED rows are always NAME; their tier comes from `source`. */
  kind: LookupAliasKind;
  source: LookupAliasSource;
  salonId: string | null;
  sourceVersionId: string | null;
  ambiguous: boolean;
  revision: number;
};
