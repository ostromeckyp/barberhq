import type { DocumentSource } from './document-source.js';
import type { GeometryStatus } from './geometry-status.js';
import type { PdfPageGeometry } from './pdf-page-geometry.js';
import type { PdfRect } from './pdf-rect.js';
export type SourceSection = DocumentSource & {
  chunkId: string;
  sourceSectionId: string;
  sectionId: string;
  physicalPage: number;
  excerpt: string;
  geometry: PdfPageGeometry;
  rects: PdfRect[];
  geometryStatus: GeometryStatus;
};
