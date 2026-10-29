import type { DocumentSource } from './document-source.js';
import type { VersionStatus } from './version-status.js';
export type DocumentRow = Omit<DocumentSource, 'pageCount'> &
  VersionStatus & {
    pageCount: number | null;
    createdAt: string;
    pdfSha256: string;
    publishedAt: string | null;
    pendingStage: 'EXTRACT' | 'PUBLISH' | null;
    sourceUrls?: string[];
    observedOn?: string | null;
  };
