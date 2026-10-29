import type { KnowledgeJob } from './knowledge-job.js';

export type EnqueueKnowledge = (job: KnowledgeJob) => Promise<void>;
