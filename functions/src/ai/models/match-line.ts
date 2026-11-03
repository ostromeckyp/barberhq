import type { LookupMatchTier } from '../../../../shared/contracts/product-lookup/index.js';

/** A model-extracted line the deterministic lookup left unresolved. */
export type MatchLine = {
  lineId: string;
  originalWording: string;
  productQuery: string;
  tier: LookupMatchTier;
  /** Deterministic candidates in offer order; the whole catalog for tier NONE. */
  candidateIds: string[];
  /** Quantity from turn 1 only; never sent to the matcher. */
  quantity: number | null;
};
