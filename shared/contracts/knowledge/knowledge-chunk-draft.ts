import type { GeometryStatus } from './geometry-status.js';
import type { PdfRect } from './pdf-rect.js';
export type KnowledgeChunkDraft = {
  page: number;
  ordinal: number;
  sectionId: string;
  heading: string;
  text: string;
  start: number;
  end: number;
  rects: PdfRect[];
  geometryStatus: GeometryStatus;
};
