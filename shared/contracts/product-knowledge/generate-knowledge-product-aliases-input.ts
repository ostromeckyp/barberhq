export type GenerateKnowledgeProductAliasesInput = {
  versionId: string;
  extractionHash: string;
  expectedReviewRevision: number;
  productId: string;
  idempotencyKey: string;
};
