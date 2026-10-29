export type DeleteVersionInput = {
  versionId: string;
  expectedDocumentRevision: number;
  expectedVersionRevision: number;
  idempotencyKey: string;
};
