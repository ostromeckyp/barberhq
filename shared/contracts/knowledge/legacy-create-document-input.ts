export type LegacyCreateDocumentInput = {
  title: string;
  language: 'en' | 'pl';
  sourceType: 'synthetic-procedure' | 'public-product-summary';
  sourceUrls: string[];
  observedOn: string | null;
  sha256: string;
  idempotencyKey: string;
  documentId?: string;
  expectedDocumentRevision?: number;
};
