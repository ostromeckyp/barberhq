import type { AliasProposal } from './alias-proposal.js';
export type ProductProfileProposal = {
  productId: string;
  type: string | null;
  aliases: AliasProposal[];
};
