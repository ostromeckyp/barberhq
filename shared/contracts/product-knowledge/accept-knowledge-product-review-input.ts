export type AcceptKnowledgeProductReviewInput = {
  versionId: string;
  extractionHash: string;
  expectedReviewRevision: number;
  expectedCatalogRevision: number;
  idempotencyKey: string;
};
