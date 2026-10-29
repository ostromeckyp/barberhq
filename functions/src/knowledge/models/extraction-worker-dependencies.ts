import type { KnowledgePipeline } from '../pipeline.js';
import type { KnowledgeRepository } from '../repository.js';

export type ExtractionWorkerDependencies = {
  repo: Pick<KnowledgeRepository, 'version' | 'claimExtraction' | 'failExtraction'> & {
    markPublishStale?: KnowledgeRepository['markPublishStale'];
    document?: KnowledgeRepository['document'];
  };
  pipeline: Pick<KnowledgePipeline, 'extractClaimedVersion' | 'publishVersion'>;
  now?: () => Date;
  createLeaseId?: () => string;
};
