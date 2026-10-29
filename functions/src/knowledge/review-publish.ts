import { validateProductPublication } from './product-knowledge-publication.js';
import { randomUUID } from 'node:crypto';
import * as sql from '@barberhq/server';
import type { ReviewDocumentInput, VersionStatus } from '../../../shared/contracts/knowledge.js';
import { KnowledgeError, type KnowledgeRepository, type VersionState } from './repository.js';
import type { KnowledgePipeline } from './pipeline.js';
import { knowledgePayloadHash, parseReviewDocument } from './schemas.js';
import { status } from './document-commands.js';
import { enqueueKnowledge, type EnqueueKnowledge } from './queue.js';

type Context = sql.KnowledgeCommandContextData;

export type ReviewPublishDependencies = {
  repo: Pick<KnowledgeRepository, 'dc' | 'version' | 'markPublishStale'>;
  pipeline: Pick<KnowledgePipeline, 'recordReview' | 'publishVersion'> & {
    embedder: KnowledgePipeline['embedder'];
  };
  enqueue?: EnqueueKnowledge;
  now?: () => Date;
};

function pagesAreExact(
  version: VersionState,
  input: ReviewDocumentInput,
  requireReviewed = false,
): boolean {
  const expected = Array.from({ length: version.pageCount ?? 0 }, (_, index) => index + 1);
  const actual = [...input.reviewedPhysicalPages].sort((a, b) => a - b);
  const extractedPages = version.pages.map((page) => page.physicalPage).sort((a, b) => a - b);
  return (
    version.extractionHash === input.extractionHash &&
    actual.length === input.reviewedPhysicalPages.length &&
    JSON.stringify(actual) === JSON.stringify(expected) &&
    version.pages.length === expected.length &&
    JSON.stringify(extractedPages) === JSON.stringify(expected) &&
    version.pages.every(
      (page) => page.quality === 'COMPLETE' && (!requireReviewed || page.reviewed),
    )
  );
}

function sameOperation(
  context: Context,
  uid: string,
  key: string,
  hash: string,
  versionId: string,
) {
  const operation = context.membership?.business.operations[0];
  if (
    operation &&
    (operation.actorUid !== uid ||
      operation.idempotencyKey !== key ||
      operation.action !== 'REVIEW' ||
      operation.payloadHash !== hash ||
      operation.versionId !== versionId)
  )
    throw new KnowledgeError('IDEMPOTENCY_CONFLICT');
  return operation;
}

/** HQ review receipt and publication intent orchestration. All durable transitions are SQL guarded. */
export class ReviewPublishService {
  private readonly enqueue: EnqueueKnowledge;
  private readonly now: () => Date;
  constructor(private readonly deps: ReviewPublishDependencies) {
    this.enqueue = deps.enqueue ?? enqueueKnowledge;
    this.now = deps.now ?? (() => new Date());
  }

  private async context(uid: string, input: ReviewDocumentInput): Promise<Context> {
    if (!uid) throw new KnowledgeError('UNAUTHENTICATED');
    const member = (await sql.readMembership(this.deps.repo.dc, { uid })).data.membership;
    if (member?.role !== 'HQ') throw new KnowledgeError('FORBIDDEN');
    const context = (
      await sql.knowledgeCommandContext(this.deps.repo.dc, {
        uid,
        key: input.idempotencyKey,
        documentId: '',
        versionId: input.versionId,
      })
    ).data;
    if (context.membership?.role !== 'HQ' || context.membership.businessId !== member.businessId)
      throw new KnowledgeError('FORBIDDEN');
    return context;
  }

  private async startReceipt(
    uid: string,
    businessId: string,
    version: VersionState,
    input: ReviewDocumentInput,
    payloadHash: string,
  ): Promise<void> {
    const operationId = randomUUID();
    try {
      await sql.startKnowledgeReview(this.deps.repo.dc, {
        uid,
        businessId,
        documentId: version.documentId,
        versionId: version.id,
        operationId,
        key: input.idempotencyKey,
        payloadHash,
        extractionHash: input.extractionHash,
        expectedDocumentRevision: input.expectedDocumentRevision,
      });
    } catch (error) {
      const context = await this.context(uid, input);
      const operation = sameOperation(
        context,
        uid,
        input.idempotencyKey,
        payloadHash,
        input.versionId,
      );
      if (!operation) throw error;
      return;
    }
  }

  private async completeReceipt(
    uid: string,
    businessId: string,
    operationId: string,
    versionId: string,
    key: string,
    payloadHash: string,
  ): Promise<void> {
    try {
      await sql.completeKnowledgeReview(this.deps.repo.dc, {
        uid,
        businessId,
        operationId,
        versionId,
      });
    } catch {
      const input = {
        versionId,
        extractionHash: '0'.repeat(64),
        reviewedPhysicalPages: [1],
        expectedDocumentRevision: 0,
        idempotencyKey: key,
      };
      const context = await this.context(uid, input);
      const operation = sameOperation(context, uid, key, payloadHash, versionId);
      if (operation?.completedAt) return;
      throw new KnowledgeError('OUTCOME_UNKNOWN', 'Retry with the same operation key');
    }
  }

  async reviewAndPublishDocument(uid: string, raw: unknown): Promise<VersionStatus> {
    const input = parseReviewDocument(raw);
    const payloadHash = knowledgePayloadHash('REVIEW', input);
    let context = await this.context(uid, input);
    let operation = sameOperation(context, uid, input.idempotencyKey, payloadHash, input.versionId);
    let version = await this.deps.repo.version(input.versionId);
    if (!version || version.businessId !== context.membership!.businessId)
      throw new KnowledgeError('FORBIDDEN');
    if (version.revokedAt) throw new KnowledgeError('SOURCE_REVOKED');
    if (version.publishedAt) return status(version);
    if (input.extractionHash !== version.extractionHash)
      throw new KnowledgeError('REVIEW_IDENTITY_MISMATCH');
    if (version.status === 'EXTRACTED' && !pagesAreExact(version, input))
      throw new KnowledgeError('REVIEW_INCOMPLETE');
    await validateProductPublication(
      this.deps.repo.dc,
      uid,
      version,
      input.productKnowledgeReviewedHash,
      !!operation,
    );
    if (!operation) {
      const freshReview = version.status === 'EXTRACTED' && pagesAreExact(version, input);
      const refreshedStaleReview =
        version.status === 'READY' &&
        version.processingError === 'STALE_STATE' &&
        version.pendingStage === null &&
        version.reviewedBy === `hq:${uid}` &&
        pagesAreExact(version, input, true);
      if (!freshReview && !refreshedStaleReview) throw new KnowledgeError('INVALID_TRANSITION');
      await this.startReceipt(uid, version.businessId, version, input, payloadHash);
      context = await this.context(uid, input);
      operation = sameOperation(context, uid, input.idempotencyKey, payloadHash, input.versionId);
      if (!operation)
        throw new KnowledgeError('OUTCOME_UNKNOWN', 'Retry with the same operation key');
      version = (await this.deps.repo.version(input.versionId))!;
    }
    const actor = { kind: 'hq' as const, uid, businessId: version.businessId };
    const reviewInput = {
      versionId: version.id,
      pdfSha256: version.pdfSha256,
      extractionHash: input.extractionHash,
      reviewedPhysicalPages: input.reviewedPhysicalPages,
      approvalText: 'HQ reviewed every physical page',
      approvedAt: this.now().toISOString(),
    };
    if (
      version.status === 'EXTRACTED' ||
      version.status === 'REVIEWED' ||
      version.status === 'READY'
    )
      await this.deps.pipeline.recordReview(reviewInput, actor);
    version = (await this.deps.repo.version(input.versionId))!;
    if (!version || version.revokedAt) throw new KnowledgeError('SOURCE_REVOKED');
    if (
      version.status !== 'READY' ||
      version.reviewedBy !== `hq:${uid}` ||
      version.extractionHash !== input.extractionHash
    )
      throw new KnowledgeError('NOT_READY');
    if (version.pendingStage === 'PUBLISH') {
      if (
        version.pendingDocumentRevision !== input.expectedDocumentRevision ||
        version.pendingExtractionHash !== input.extractionHash
      )
        throw new KnowledgeError('VERSION_CONFLICT');
    } else {
      if (version.pendingStage !== null) throw new KnowledgeError('VERSION_CONFLICT');
      await sql.setKnowledgePublishIntent(this.deps.repo.dc, {
        uid,
        businessId: version.businessId,
        versionId: version.id,
        revision: version.revision,
        expectedDocumentRevision: input.expectedDocumentRevision,
        extractionHash: input.extractionHash,
        configHash: this.deps.pipeline.embedder.config.configHash,
        productKnowledgeReviewedHash: input.productKnowledgeReviewedHash ?? null,
        productKnowledgeRevision: input.productKnowledgeReviewedHash
          ? version.productKnowledgeRevision
          : null,
        productKnowledgeCatalogRevision: input.productKnowledgeReviewedHash
          ? version.productKnowledgeCatalogRevision
          : null,
      });
      version = (await this.deps.repo.version(input.versionId))!;
    }
    if (!operation.completedAt)
      await this.completeReceipt(
        uid,
        version.businessId,
        operation.id,
        version.id,
        input.idempotencyKey,
        payloadHash,
      );
    const expectedDocumentRevision = version.pendingDocumentRevision;
    const expectedExtractionHash = version.pendingExtractionHash;
    if (
      version.pendingStage !== 'PUBLISH' ||
      expectedDocumentRevision == null ||
      expectedExtractionHash !== input.extractionHash
    )
      throw new KnowledgeError('OUTCOME_UNKNOWN', 'Retry with the same operation key');
    try {
      await sql.setKnowledgeDispatchPending(this.deps.repo.dc, {
        uid,
        businessId: version.businessId,
        versionId: version.id,
        revision: version.revision,
        stage: sql.KnowledgePendingStage.PUBLISH,
        expectedDocumentRevision,
        extractionHash: expectedExtractionHash,
      });
    } catch {
      const current = await this.deps.repo.version(version.id);
      if (current?.publishedAt || current?.revokedAt) return status(current);
      throw new KnowledgeError('OUTCOME_UNKNOWN', 'Retry with the same operation key');
    }
    version = (await this.deps.repo.version(version.id))!;
    const job = {
      versionId: version.id,
      stage: 'PUBLISH' as const,
      expectedDocumentRevision,
      extractionHash: expectedExtractionHash,
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
        await sql.setKnowledgeDispatchFailure(this.deps.repo.dc, {
          versionId: version.id,
          revision: version.revision,
          stage: sql.KnowledgePendingStage.PUBLISH,
          status: sql.KnowledgeProcessingStatus.READY,
          errorCode: 'QUEUE_UNAVAILABLE',
          expectedDocumentRevision,
          extractionHash: expectedExtractionHash,
        });
      } catch {
        throw new KnowledgeError('OUTCOME_UNKNOWN', 'Retry with the same operation key');
      }
      version = (await this.deps.repo.version(version.id))!;
      return status(version);
    }
    version = (await this.deps.repo.version(version.id))!;
    return status(version);
  }
}
