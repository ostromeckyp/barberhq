export type KnowledgeJob = {
  versionId: string;
  stage: 'EXTRACT' | 'PUBLISH';
  expectedDocumentRevision: number;
  extractionHash?: string;
  productKnowledgeReviewedHash?: string;
  productKnowledgeRevision?: number;
  productKnowledgeCatalogRevision?: number;
};
