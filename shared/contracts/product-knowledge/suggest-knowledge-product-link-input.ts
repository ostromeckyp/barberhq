import type { KnowledgePassageRef } from './knowledge-passage-ref.js';
export type SuggestKnowledgeProductLinkInput = {
  versionId: string;
  extractionHash: string;
  expectedReviewRevision: number;
  passage: KnowledgePassageRef;
  idempotencyKey: string;
};
