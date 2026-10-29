export type LegacyDocumentSource = {
  businessId: string;
  documentId: string;
  versionId: string;
  version: string;
  title: string;
  language: string;
  synthetic: boolean;
  sourceType: 'synthetic-procedure' | 'public-product-summary';
  superseded: boolean;
  pageCount: number;
  pageTexts?: { physicalPage: number; text: string }[];
};
