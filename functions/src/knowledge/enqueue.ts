import { getFunctions } from 'firebase-admin/functions';
import { z } from 'zod';
import type { EnqueueKnowledge } from './models/enqueue-knowledge.js';

const jobSchema = z
  .strictObject({
    versionId: z.string().min(1).max(200),
    stage: z.enum(['EXTRACT', 'PUBLISH']),
    productKnowledgeReviewedHash: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    productKnowledgeRevision: z.int().min(0).max(2147483647).optional(),
    productKnowledgeCatalogRevision: z.int().min(0).max(2147483647).optional(),
    expectedDocumentRevision: z.int().min(0).max(2_147_483_647),
    extractionHash: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
  })
  .refine((job) => (job.stage === 'PUBLISH') === Boolean(job.extractionHash));

/** Queue identity is the deployed runtime service account, never an operator's email. */
export const enqueueKnowledge: EnqueueKnowledge = async (job) => {
  const safeJob = jobSchema.parse(job);
  await getFunctions()
    .taskQueue('locations/europe-west1/functions/processKnowledgeTask')
    .enqueue(safeJob, { dispatchDeadlineSeconds: 300 });
};
