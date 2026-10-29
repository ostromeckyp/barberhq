import { randomUUID } from 'node:crypto';
import type { ProcessingResult } from '../../../shared/contracts/knowledge/index.js';
import { z } from 'zod';
import { KnowledgeError } from './repository.js';
import { onTaskDispatched } from 'firebase-functions/v2/tasks';
import { createEmbeddingConfig, createVertexEmbeddingAdapter } from './embedding.js';
import { KnowledgePipeline as RuntimePipeline } from './pipeline.js';
import { KnowledgeRepository as RuntimeRepository } from './repository.js';
import { knowledgeBucket, knowledgeDataConnectors, knowledgeRuntimeConfig } from './runtime.js';
import type { KnowledgeProcessingJob } from './models/knowledge-processing-job.js';
import type { ExtractionWorkerDependencies } from './models/extraction-worker-dependencies.js';

export const jobSchema = z.discriminatedUnion('stage', [
  z.strictObject({
    versionId: z.string().min(1).max(200),
    stage: z.literal('EXTRACT'),
    expectedDocumentRevision: z.int().min(0).max(2_147_483_647),
  }),
  z.strictObject({
    versionId: z.string().min(1).max(200),
    stage: z.literal('PUBLISH'),
    expectedDocumentRevision: z.int().min(0).max(2_147_483_647),
    extractionHash: z.string().regex(/^[a-f0-9]{64}$/),
    productKnowledgeReviewedHash: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    productKnowledgeRevision: z.int().min(0).max(2147483647).optional(),
    productKnowledgeCatalogRevision: z.int().min(0).max(2147483647).optional(),
  }),
]);
export const EXTRACTION_LEASE_MS = 6 * 60 * 1000;

/** Pure orchestration around injected SQL/pipeline dependencies; task payloads carry IDs only. */
export async function processKnowledge(
  rawJob: unknown,
  deps: ExtractionWorkerDependencies,
): Promise<ProcessingResult> {
  const job = jobSchema.parse(rawJob);
  if (job.stage === 'PUBLISH') return processPublish(job, deps);
  const now = (deps.now ?? (() => new Date()))();
  if (!Number.isFinite(now.getTime())) throw new KnowledgeError('INVALID_CLOCK');
  const version = await deps.repo.version(job.versionId);
  if (
    !version ||
    version.revokedAt ||
    version.publishedAt ||
    version.pendingStage !== 'EXTRACT' ||
    version.pendingDocumentRevision !== job.expectedDocumentRevision ||
    !['STAGED', 'FAILED'].includes(version.status)
  ) {
    return { versionId: job.versionId, status: version?.status ?? 'STAGED', retryable: false };
  }
  if (version.processingLeaseId) {
    const leaseExpiry = version.processingLeaseExpiresAt
      ? Date.parse(version.processingLeaseExpiresAt)
      : NaN;
    if (!Number.isFinite(leaseExpiry) || leaseExpiry > now.getTime())
      throw new KnowledgeError('LEASE_ACTIVE', 'Another extraction attempt owns the active lease');
  }
  const leaseId = (deps.createLeaseId ?? randomUUID)();
  const claim = await deps.repo.claimExtraction({
    versionId: version.id,
    revision: version.revision,
    expectedDocumentRevision: job.expectedDocumentRevision,
    pdfSha256: version.pdfSha256,
    leaseId,
    now,
    expiresAt: new Date(now.getTime() + EXTRACTION_LEASE_MS),
  });
  try {
    const result = await deps.pipeline.extractClaimedVersion(job.versionId, claim);
    return { ...result, retryable: result.status === 'NEEDS_REVIEW' ? false : result.retryable };
  } catch (error) {
    const errorCode =
      error instanceof KnowledgeError && /^[A-Z][A-Z0-9_]{0,63}$/.test(error.code)
        ? error.code
        : error instanceof Error && error.message.toLowerCase().includes('embed')
          ? 'EMBEDDING_FAILED'
          : 'EXTRACTION_FAILED';
    await deps.repo.failExtraction({
      versionId: version.id,
      revision: claim.revision,
      pdfSha256: version.pdfSha256,
      leaseId,
      errorCode,
    });
    throw error;
  }
}

async function processPublish(
  job: Extract<KnowledgeProcessingJob, { stage: 'PUBLISH' }>,
  deps: ExtractionWorkerDependencies,
): Promise<ProcessingResult> {
  const version = await deps.repo.version(job.versionId);
  if (
    !version ||
    version.revokedAt ||
    version.publishedAt ||
    version.pendingStage !== 'PUBLISH' ||
    version.pendingDocumentRevision !== job.expectedDocumentRevision ||
    version.pendingExtractionHash !== job.extractionHash ||
    (version.pendingProductKnowledgeReviewedHash ?? undefined) !==
      job.productKnowledgeReviewedHash ||
    (version.pendingProductKnowledgeRevision ?? undefined) !== job.productKnowledgeRevision ||
    (version.pendingProductKnowledgeCatalogRevision ?? undefined) !==
      job.productKnowledgeCatalogRevision ||
    version.extractionHash !== job.extractionHash ||
    version.status !== 'READY'
  )
    return { versionId: job.versionId, status: version?.status ?? 'STAGED', retryable: false };
  const markStale = async () => {
    let writeError: unknown;
    try {
      if (!deps.repo.markPublishStale) throw new KnowledgeError('STALE_STATE');
      await deps.repo.markPublishStale({
        versionId: version.id,
        revision: version.revision,
        expectedDocumentRevision: job.expectedDocumentRevision,
        extractionHash: job.extractionHash,
      });
    } catch (error) {
      writeError = error;
    }
    const current = await deps.repo.version(version.id);
    if (!current || current.revokedAt || current.publishedAt)
      return {
        versionId: version.id,
        status: current?.status ?? version.status,
        retryable: false,
        ...(current?.processingError ? { errorCode: current.processingError } : {}),
      };
    const sameIntent =
      current.pendingStage === 'PUBLISH' &&
      current.pendingDocumentRevision === job.expectedDocumentRevision &&
      current.pendingExtractionHash === job.extractionHash &&
      current.extractionHash === job.extractionHash;
    if (sameIntent)
      throw (
        writeError ??
        new KnowledgeError('STALE_STATE', 'Stale PUBLISH intent still needs terminalization')
      );
    return current.processingError === 'STALE_STATE'
      ? {
          versionId: version.id,
          status: current.status,
          retryable: false,
          errorCode: 'STALE_STATE',
        }
      : {
          versionId: version.id,
          status: current.status,
          retryable: false,
          ...(current.processingError ? { errorCode: current.processingError } : {}),
        };
  };
  const document = deps.repo.document
    ? await deps.repo.document(version.documentId)
    : version.document;
  if (document?.revision !== job.expectedDocumentRevision) return markStale();
  try {
    return await deps.pipeline.publishVersion({
      versionId: version.id,
      expectedDocumentRevision: job.expectedDocumentRevision,
      expectedVersionRevision: version.revision,
      extractionHash: job.extractionHash,
    });
  } catch (error) {
    const latest = await deps.repo.version(version.id);
    if (!latest || latest.revokedAt || latest.publishedAt)
      return { versionId: version.id, status: latest?.status ?? version.status, retryable: false };
    if (
      (error instanceof KnowledgeError && error.code === 'STALE_STATE') ||
      String(error).includes('STALE_STATE')
    )
      return markStale();
    throw error;
  }
}

const RUNTIME_INVOKER = 'baberhq-runtime@notbad-6be95.iam.gserviceaccount.com';

/** Cloud Tasks IAM is the authentication boundary; request headers are never inspected. */
export function processKnowledgeTaskFunction() {
  return onTaskDispatched(
    {
      region: 'europe-west1',
      timeoutSeconds: 300,
      retryConfig: { maxAttempts: 3, minBackoffSeconds: 360 },
      rateLimits: { maxConcurrentDispatches: 2 },
      invoker: [RUNTIME_INVOKER],
    },
    async (request) => {
      const job = jobSchema.parse(request.data);
      const config = knowledgeRuntimeConfig();
      const connectors = knowledgeDataConnectors(config);
      const repo = new RuntimeRepository(
        connectors.server,
        connectors.vector,
        knowledgeBucket(config),
      );
      const version = await repo.version(job.versionId);
      const businessId = version?.businessId ?? 'missing';
      const embedder = createVertexEmbeddingAdapter(
        createEmbeddingConfig({
          projectId: config.vertexProject,
          modelId: config.vertexModel,
          dimension: config.vertexDimension,
          documentMode: 'RETRIEVAL_DOCUMENT',
          queryMode: 'RETRIEVAL_QUERY',
          location: config.vertexLocation,
        }),
      );
      const pipeline = new RuntimePipeline(repo, embedder, businessId, businessId);
      await processKnowledge(job, { repo, pipeline });
    },
  );
}
