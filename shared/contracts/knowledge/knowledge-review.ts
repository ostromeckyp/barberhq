import type { DocumentRow } from './document-row.js';
import type { ExtractedPage } from './extracted-page.js';
export type KnowledgeReview = {
  version: DocumentRow;
  extractionHash: string;
  pages: (ExtractedPage & { reviewed: boolean })[];
  publicationAllowed: boolean;
};
