import type { KnowledgeDocumentKind } from '../../../../shared/contracts/knowledge/index.js';
import type { RetrievedChunk } from './retrieved-chunk.js';

export type RetrievalRepository = {
  /** Authorization and every corpus filter run inside SQL before ORDER BY/LIMIT. */
  search(input: {
    uid: string;
    businessId: string;
    vector: number[];
    embeddingConfigHash: string;
    embeddingModel: string;
    limit: 3;
    kinds: readonly KnowledgeDocumentKind[];
  }): Promise<RetrievedChunk[]>;
};
