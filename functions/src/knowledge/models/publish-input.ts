export type PublishInput = {
  versionId: string;
  expectedDocumentRevision: number;
  expectedVersionRevision?: number;
  extractionHash?: string;
};
