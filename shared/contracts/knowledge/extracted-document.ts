import type { ExtractedPage } from './extracted-page.js';
export type ExtractedDocument = {
  title: string;
  pages: ExtractedPage[];
  quality: 'COMPLETE' | 'NEEDS_REVIEW';
  parserVersion: string;
  extractionHash: string;
};
