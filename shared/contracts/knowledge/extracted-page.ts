import type { PdfPageGeometry } from './pdf-page-geometry.js';
import type { PdfRect } from './pdf-rect.js';
export type ExtractedPage = PdfPageGeometry & {
  physicalPage: number;
  text: string;
  markdown: string;
  spans: { start: number; end: number; rect: PdfRect }[];
  quality: 'COMPLETE' | 'NEEDS_REVIEW';
};
