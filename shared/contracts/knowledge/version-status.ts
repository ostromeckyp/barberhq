import type { ProcessingResult } from './processing-result.js';
export type VersionStatus = ProcessingResult & {
  documentId: string;
  documentRevision: number;
  versionRevision: number;
  revokedAt: string | null;
};
