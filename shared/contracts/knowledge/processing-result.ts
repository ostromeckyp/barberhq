import type { ProcessingStatus } from './processing-status.js';
export type ProcessingResult = {
  versionId: string;
  status: ProcessingStatus;
  retryable: boolean;
  errorCode?: string;
};
