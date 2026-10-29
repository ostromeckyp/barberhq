import type { AliasProposal } from './alias-proposal.js';
export type ProductAliasEdit = Pick<AliasProposal, 'phrase' | 'kind' | 'lang' | 'decision'> & {
  id?: string;
};
