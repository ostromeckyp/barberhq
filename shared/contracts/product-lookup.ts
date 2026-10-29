/** Scoped catalog lookup DTOs shared by repository, tools, model and browser. */
export type LookupAliasKind = 'NAME' | 'TYPE' | 'PHONETIC';
export type LookupAliasSource = 'GENERATED' | 'HQ' | 'SEED' | 'SALON_CONFIRMED';
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
export type LookupProduct = {
  productId: string;
  productName: string;
  sourceCode: string;
  type: string | null;
  category: string;
  summaryEn: string;
  scentPl: string | null;
  keywords: string[];
};
export type LookupMatchTier = 'SALON' | 'NAME' | 'PHONETIC' | 'TYPE' | 'CONTAINS' | 'NONE';
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
export type ProductMatch = {
  query: string;
  match: LookupMatchTier;
  ambiguous: boolean;
  candidates: LookupCandidate[];
};
/** One learned salon phrase; HQ reads every salon read-only, only that salon's staff remove. */
export type SalonShorthand = {
  id: string;
  salonId: string;
  salonName: string;
  productId: string;
  productName: string;
  phrase: string;
  revision: number;
  status: 'active' | 'retired';
  updatedAt: string;
};
