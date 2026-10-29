import type { SourceSection } from '../../../../shared/contracts/knowledge/index.js';

export type RetrievedChunk = SourceSection & {
  cosineDistance: number;
  documentRevision: number;
  embeddingConfigHash: string;
};
