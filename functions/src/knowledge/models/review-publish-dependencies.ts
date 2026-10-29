import type { KnowledgePipeline } from '../pipeline.js';
import type { EnqueueKnowledge } from './enqueue-knowledge.js';
import type { KnowledgeRepository } from '../repository.js';

export type ReviewPublishDependencies = {
  repo: Pick<KnowledgeRepository, 'dc' | 'version' | 'markPublishStale'>;
  pipeline: Pick<KnowledgePipeline, 'recordReview' | 'publishVersion'> & {
    embedder: KnowledgePipeline['embedder'];
  };
  enqueue?: EnqueueKnowledge;
  now?: () => Date;
};
