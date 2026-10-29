import type { KnowledgeProductReview } from '../../../../shared/contracts/product-knowledge/index.js';
import type { PassageChunk } from './passage-chunk.js';
import type { KnowledgeAliasRow } from './knowledge-alias-row.js';
import type { KnowledgeLinkRow } from './knowledge-link-row.js';
import type { KnowledgeProfileRow } from './knowledge-profile-row.js';
import type { ProductOperation } from './product-operation.js';

export type ProductKnowledgeState = {
  versionId: string;
  documentId: string;
  replacesVersionId: string | null;
  businessId: string;
  extractionHash: string | null;
  revision: number;
  catalogRevision: number;
  reviewedHash: string | null;
  state: {
    acknowledgedUnlinkedPassages?: KnowledgeProductReview['acknowledgedUnlinkedPassages'];
    emptyKnowledgeAcknowledged?: boolean;
  } | null;
  kind: string | null;
  status: string;
  pendingStage: string | null;
  publishedAt: string | null;
  revokedAt: string | null;
  links: KnowledgeLinkRow[];
  profiles: KnowledgeProfileRow[];
  aliases: KnowledgeAliasRow[];
  chunks: PassageChunk[];
  operation: ProductOperation | null;
};
