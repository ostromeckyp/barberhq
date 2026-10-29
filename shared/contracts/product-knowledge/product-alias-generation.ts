import type { AliasProposal } from './alias-proposal.js';
export type ProductAliasGeneration = {
  type: string | null;
  aliases: Pick<AliasProposal, 'phrase' | 'kind' | 'lang'>[];
};
