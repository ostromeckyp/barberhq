import type { KnowledgePassageRef } from './knowledge-passage-ref.js';
import type { KnowledgeProductLinkEdit } from './knowledge-product-link-edit.js';
import type { ProductAliasEdit } from './product-alias-edit.js';
export type SaveKnowledgeProductReviewInput = {
  versionId: string;
  extractionHash: string;
  expectedReviewRevision: number;
  idempotencyKey: string;
  links: KnowledgeProductLinkEdit[];
  profiles: { productId: string; type: string | null; aliases: ProductAliasEdit[] }[];
  acknowledgedUnlinkedPassages: KnowledgePassageRef[];
  emptyKnowledgeAcknowledged: boolean;
};
