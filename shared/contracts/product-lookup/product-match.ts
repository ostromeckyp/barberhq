import type { LookupCandidate } from './lookup-candidate.js';
import type { LookupMatchTier } from './lookup-match-tier.js';
export type ProductMatch = {
  query: string;
  match: LookupMatchTier;
  ambiguous: boolean;
  candidates: LookupCandidate[];
};
/** One learned salon phrase; HQ reads every salon read-only, only that salon's staff remove. */
