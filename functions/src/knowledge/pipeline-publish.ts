import type { ProcessingResult } from '../../../shared/contracts/knowledge/index.js';
import { KnowledgeError } from './repository.js';
import { scopedVersion } from './pipeline-scope.js';
import type { KnowledgePipeline } from './pipeline.js';
import type { PublishInput } from './models/publish-input.js';

export async function publishVersion(
  p: KnowledgePipeline,
  input: PublishInput,
): Promise<ProcessingResult> {
  let version = await scopedVersion(p, input.versionId);
  if (version.publicationStatus === 'RETIRED') throw new KnowledgeError('RETIRED_VERSION');
  if (
    version.isActive &&
    version.publishedAt &&
    !version.revokedAt &&
    version.embeddingConfigHash === p.embedder.config.configHash &&
    version.document?.activeVersionId === input.versionId
  )
    return { versionId: input.versionId, status: 'READY', retryable: false };
  if (
    version.status !== 'READY' ||
    !version.reviewedAt ||
    !version.reviewedBy ||
    version.revokedAt ||
    version.publishedAt ||
    version.embeddingConfigHash !== p.embedder.config.configHash
  )
    throw new KnowledgeError('NOT_READY');
  if (
    version.pages.length !== version.pageCount ||
    version.pages.some((p) => !p.reviewed || p.quality !== 'COMPLETE') ||
    version.chunks.length !== version.expectedChunkCount
  )
    throw new KnowledgeError('NOT_READY');
  if (version.pendingStage === null && version.reviewedBy.startsWith('operator:')) {
    await p.repo.setOperatorPublishIntent({
      businessId: p.businessId,
      versionId: version.id,
      revision: version.revision,
      expectedDocumentRevision: input.expectedDocumentRevision,
      extractionHash: version.extractionHash!,
      configHash: p.embedder.config.configHash,
      productKnowledgeReviewedHash: version.productKnowledgeReviewedHash ?? null,
      productKnowledgeRevision: version.productKnowledgeReviewedHash
        ? version.productKnowledgeRevision
        : null,
      productKnowledgeCatalogRevision: version.productKnowledgeCatalogRevision ?? null,
    });
    version = await scopedVersion(p, input.versionId);
  }
  if (
    input.expectedVersionRevision !== undefined &&
    version.revision !== input.expectedVersionRevision
  )
    throw new KnowledgeError('STALE_STATE');
  const extractionHash = input.extractionHash ?? version.extractionHash;
  if (!extractionHash || extractionHash !== version.extractionHash)
    throw new KnowledgeError('REVIEW_IDENTITY_MISMATCH');
  try {
    await p.repo.publish({
      versionId: input.versionId,
      documentId: version.documentId,
      businessId: p.businessId,
      expectedDocumentRevision: input.expectedDocumentRevision,
      versionRevision: version.revision,
      extractionHash,
      configHash: p.embedder.config.configHash,
    });
  } catch (error) {
    if (String(error).includes('STALE_STATE')) throw new KnowledgeError('STALE_STATE');
    throw error;
  }
  return { versionId: input.versionId, status: 'READY', retryable: false };
}
