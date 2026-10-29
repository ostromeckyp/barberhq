import type { AliasImpact } from './alias-impact.js';
import type { KnowledgePassageRef } from './knowledge-passage-ref.js';
import type { KnowledgeProductLink } from './knowledge-product-link.js';
import type { ProductProfileProposal } from './product-profile-proposal.js';
export type KnowledgeProductReview = {
  versionId: string;
  extractionHash: string;
  revision: number;
  catalogRevision: number;
  links: KnowledgeProductLink[];
  profiles: ProductProfileProposal[];
  unlinkedPassages: KnowledgePassageRef[];
  impact: AliasImpact[];
  reviewedHash: string | null;
  acknowledgedUnlinkedPassages: KnowledgePassageRef[];
  emptyKnowledgeAcknowledged: boolean;
};
