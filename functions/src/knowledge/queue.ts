import { randomUUID } from 'node:crypto';
import { getFunctions } from 'firebase-admin/functions';
import * as sql from '@barberhq/server';
import { z } from 'zod';
import type {
  RetryDocumentInput,
  VersionStatus,
} from '../../../shared/contracts/knowledge/index.js';
import { status } from './document-commands.js';
import { KnowledgeError, type KnowledgeRepository } from './repository.js';
import type { VersionState } from './models/version-state.js';
import { knowledgePayloadHash, parseRetryDocument } from './schemas.js';
import type { KnowledgeJob } from './models/knowledge-job.js';
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

function completeOriginal(version: VersionState): boolean {
  return (
    Boolean(
      version.bucket &&
      version.objectPath &&
      version.objectGeneration &&
      /^[1-9][0-9]*$/.test(version.objectGeneration) &&
      Number.isSafeInteger(Number(version.objectGeneration)) &&
      Number(version.objectGeneration) > 0,
    ) &&
    version.contentType === 'application/pdf' &&
    Number.isSafeInteger(version.byteSize) &&
    version.byteSize! >= 5 &&
    version.byteSize! <= 10 * 1024 * 1024 &&
    Number.isSafeInteger(version.pageCount) &&
    version.pageCount! >= 1 &&
    version.pageCount! <= 30
  );
}

export class DispatchService {
  constructor(
    private readonly repo: Pick<KnowledgeRepository, 'dc' | 'version'>,
    private readonly enqueue: EnqueueKnowledge = enqueueKnowledge,
  ) {}

  private async authorize(uid: string, versionId: string): Promise<VersionState> {
    if (!uid) throw new KnowledgeError('UNAUTHENTICATED');
    const member = (await sql.readMembership(this.repo.dc, { uid })).data.membership;
    if (member?.role !== 'HQ') throw new KnowledgeError('FORBIDDEN');
    const version = await this.repo.version(versionId);
    if (!version || version.businessId !== member.businessId) throw new KnowledgeError('FORBIDDEN');
    return version;
  }

  private async completeRetry(
    uid: string,
    businessId: string,
    operationId: string,
    versionId: string,
    key: string,
  ): Promise<void> {
    try {
      await sql.completeKnowledgeRetry(this.repo.dc, { uid, businessId, operationId, versionId });
    } catch {
      const context = (
        await sql.knowledgeCommandContext(this.repo.dc, { uid, key, documentId: '', versionId })
      ).data;
      if (context.membership?.role !== 'HQ' || context.membership.businessId !== businessId)
        throw new KnowledgeError('FORBIDDEN');
      const fresh = context.membership.business.operations[0];
      if (fresh?.id === operationId && fresh.completedAt) return;
      throw new KnowledgeError('OUTCOME_UNKNOWN', 'Retry with the same operation key');
    }
  }

  /** Persist an intent with revision CAS before delivery. A stale failure cannot change a later attempt. */
  async dispatch(
    uid: string,
    versionId: string,
    expectedStage?: 'EXTRACT' | 'PUBLISH',
  ): Promise<VersionStatus> {
    const version = await this.authorize(uid, versionId);
    if (
      version.revokedAt ||
      version.publishedAt ||
      !completeOriginal(version) ||
      version.processingLeaseId
    )
      throw new KnowledgeError('VERSION_CONFLICT');
    const stage = version.pendingStage;
    if (expectedStage && stage !== expectedStage) throw new KnowledgeError('STALE_STATE');
    if (stage === 'EXTRACT' && !['STAGED', 'FAILED'].includes(version.status))
      throw new KnowledgeError('VERSION_CONFLICT');
    if (
      stage === 'PUBLISH' &&
      (version.status !== 'READY' ||
        !version.reviewedAt ||
        !version.extractionHash ||
        version.pendingExtractionHash !== version.extractionHash ||
        version.pendingDocumentRevision == null)
    )
      throw new KnowledgeError('VERSION_CONFLICT');
    if (stage !== 'EXTRACT' && stage !== 'PUBLISH') throw new KnowledgeError('VERSION_CONFLICT');
    const expectedDocumentRevision =
      stage === 'PUBLISH' ? version.pendingDocumentRevision : version.document.revision;
    const extractionHash = stage === 'PUBLISH' ? version.pendingExtractionHash : null;
    try {
      await sql.setKnowledgeDispatchPending(this.repo.dc, {
        uid,
        businessId: version.businessId,
        versionId,
        revision: version.revision,
        stage:
          stage === 'EXTRACT'
            ? sql.KnowledgePendingStage.EXTRACT
            : sql.KnowledgePendingStage.PUBLISH,
        expectedDocumentRevision,
        extractionHash,
      });
    } catch {
      const current = await this.authorize(uid, versionId);
      if (current.revision !== version.revision || current.revokedAt || current.publishedAt)
        throw new KnowledgeError('STALE_STATE');
      throw new KnowledgeError('OUTCOME_UNKNOWN', 'Retry with the same operation key');
    }
    const pending = await this.repo.version(versionId);
    if (!pending || pending.revision !== version.revision + 1)
      throw new KnowledgeError('OUTCOME_UNKNOWN', 'Retry with the same operation key');
    const job: KnowledgeJob =
      stage === 'EXTRACT'
        ? { versionId, stage, expectedDocumentRevision: expectedDocumentRevision! }
        : {
            versionId,
            stage,
            expectedDocumentRevision: expectedDocumentRevision!,
            extractionHash: extractionHash!,
            ...(version.pendingProductKnowledgeReviewedHash
              ? {
                  productKnowledgeReviewedHash: version.pendingProductKnowledgeReviewedHash,
                  productKnowledgeRevision: version.pendingProductKnowledgeRevision!,
                  productKnowledgeCatalogRevision: version.pendingProductKnowledgeCatalogRevision!,
                }
              : {}),
          };
    try {
      await this.enqueue(job);
    } catch {
      try {
        await sql.setKnowledgeDispatchFailure(this.repo.dc, {
          versionId,
          revision: pending.revision,
          stage:
            stage === 'EXTRACT'
              ? sql.KnowledgePendingStage.EXTRACT
              : sql.KnowledgePendingStage.PUBLISH,
          status:
            stage === 'EXTRACT'
              ? sql.KnowledgeProcessingStatus.FAILED
              : sql.KnowledgeProcessingStatus.READY,
          errorCode: 'QUEUE_UNAVAILABLE',
          expectedDocumentRevision,
          extractionHash,
        });
      } catch {
        throw new KnowledgeError('OUTCOME_UNKNOWN', 'Retry with the same operation key');
      }
      throw new KnowledgeError('QUEUE_UNAVAILABLE');
    }
    const result = await this.repo.version(versionId);
    if (!result) throw new KnowledgeError('OUTCOME_UNKNOWN', 'Retry with the same operation key');
    return status(result);
  }

  async retry(uid: string, raw: unknown): Promise<VersionStatus> {
    const input: RetryDocumentInput = parseRetryDocument(raw);
    const hash = knowledgePayloadHash('RETRY', input);
    if (!uid) throw new KnowledgeError('UNAUTHENTICATED');
    const member = (await sql.readMembership(this.repo.dc, { uid })).data.membership;
    if (member?.role !== 'HQ') throw new KnowledgeError('FORBIDDEN');
    const context = await sql.knowledgeCommandContext(this.repo.dc, {
      uid,
      key: input.idempotencyKey,
      documentId: '',
      versionId: input.versionId,
    });
    if (
      context.data.membership?.businessId !== member.businessId ||
      context.data.membership.role !== 'HQ'
    )
      throw new KnowledgeError('FORBIDDEN');
    const op = context.data.membership?.business.operations[0];
    if (
      op &&
      (op.action !== 'RETRY' ||
        op.payloadHash !== hash ||
        op.versionId !== input.versionId ||
        op.actorUid !== uid)
    )
      throw new KnowledgeError('IDEMPOTENCY_CONFLICT');
    let version = await this.authorize(uid, input.versionId);
    if (version.pdfSha256 !== input.sha256 || version.revokedAt || !completeOriginal(version))
      throw new KnowledgeError('VERSION_CONFLICT');
    if (op?.completedAt) return status(version);
    if (op && !op.retryStage)
      throw new KnowledgeError('OUTCOME_UNKNOWN', 'Retry with the same operation key');
    const dispatchable =
      (version.pendingStage === 'EXTRACT' && ['STAGED', 'FAILED'].includes(version.status)) ||
      (version.pendingStage === 'PUBLISH' &&
        version.status === 'READY' &&
        Boolean(version.reviewedAt) &&
        version.pendingDocumentRevision != null &&
        version.pendingExtractionHash === version.extractionHash);
    const earlierExtractComplete =
      op?.retryStage === 'EXTRACT' &&
      version.pendingStage === 'PUBLISH' &&
      version.status === 'READY' &&
      Boolean(version.reviewedAt);
    const progressed =
      Boolean(version.processingLeaseId || version.publishedAt) ||
      (['EXTRACTED', 'REVIEWED', 'EMBEDDED', 'READY', 'NEEDS_REVIEW'].includes(version.status) &&
        !dispatchable);
    if (op && (earlierExtractComplete || progressed)) {
      await this.completeRetry(uid, version.businessId, op.id, version.id, input.idempotencyKey);
      return status(version);
    }
    if (op && op.retryStage !== version.pendingStage) throw new KnowledgeError('VERSION_CONFLICT');
    if (version.publishedAt || version.processingLeaseId || !dispatchable)
      throw new KnowledgeError('VERSION_CONFLICT');
    let operationId = op?.id;
    let operationStage = op?.retryStage;
    if (!operationId) {
      operationId = randomUUID();
      operationStage = version.pendingStage;
      try {
        await sql.startKnowledgeRetry(this.repo.dc, {
          uid,
          businessId: version.businessId,
          versionId: version.id,
          documentId: version.documentId,
          operationId,
          key: input.idempotencyKey,
          payloadHash: hash,
          pdfSha256: input.sha256,
          retryStage: operationStage!,
        });
      } catch {
        const raced = (
          await sql.knowledgeCommandContext(this.repo.dc, {
            uid,
            key: input.idempotencyKey,
            documentId: '',
            versionId: input.versionId,
          })
        ).data.membership?.business.operations[0];
        if (!raced)
          throw new KnowledgeError('OUTCOME_UNKNOWN', 'Retry with the same operation key');
        if (
          raced.action !== 'RETRY' ||
          raced.payloadHash !== hash ||
          raced.versionId !== input.versionId
        )
          throw new KnowledgeError('IDEMPOTENCY_CONFLICT');
        return this.retry(uid, input);
      }
    }
    if (!operationStage)
      throw new KnowledgeError('OUTCOME_UNKNOWN', 'Retry with the same operation key');
    try {
      const result = await this.dispatch(uid, version.id, operationStage);
      await this.completeRetry(
        uid,
        version.businessId,
        operationId!,
        version.id,
        input.idempotencyKey,
      );
      return result;
    } catch (error) {
      if (error instanceof KnowledgeError && error.code === 'QUEUE_UNAVAILABLE') {
        version = (await this.repo.version(version.id))!;
        return status(version);
      }
      throw error;
    }
  }
}
