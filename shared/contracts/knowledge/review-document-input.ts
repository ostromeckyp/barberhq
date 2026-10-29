export type ReviewDocumentInput = {
  versionId: string;
  extractionHash: string;
  reviewedPhysicalPages: number[];
  expectedDocumentRevision: number;
  idempotencyKey: string;
  productKnowledgeReviewedHash?: string;
};
