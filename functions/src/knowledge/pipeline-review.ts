import { randomUUID } from 'node:crypto';
import { KnowledgeError } from './repository.js';
import { unlinkedPassages } from '../product-knowledge/review-state.js';
import { productKnowledgeHash } from '../product-knowledge/rules.js';
import type { KnowledgeProductReview } from '../../../shared/contracts/product-knowledge/index.js';
import { scopedVersion } from './pipeline-scope.js';
import type { KnowledgePipeline } from './pipeline.js';
import type { ReviewInput } from './models/review-input.js';
import type { ReviewActor } from './models/review-actor.js';

export async function recordReview(
  p: KnowledgePipeline,
  input: ReviewInput,
  actor: ReviewActor,
): Promise<void> {
  const version = await scopedVersion(p, input.versionId);
  if (
    actor.businessId !== p.businessId ||
    (actor.kind === 'operator' ? !actor.id.trim() : !actor.uid.trim())
  )
    throw new KnowledgeError('FORBIDDEN');
  if (
    !['EXTRACTED', 'REVIEWED', 'READY'].includes(version.status) ||
    version.revokedAt ||
    version.publishedAt
  )
    throw new KnowledgeError('INVALID_TRANSITION');
  if (input.pdfSha256 !== version.pdfSha256 || input.extractionHash !== version.extractionHash)
    throw new KnowledgeError('REVIEW_IDENTITY_MISMATCH');
  if (!input.approvalText.trim() || !Number.isFinite(Date.parse(input.approvedAt)))
    throw new KnowledgeError('REVIEW_RECEIPT_REQUIRED');
  const expected = Array.from({ length: version.pageCount ?? 0 }, (_, i) => i + 1);
  const actual = [...new Set(input.reviewedPhysicalPages)].sort((a, b) => a - b);
  if (
    actual.length !== input.reviewedPhysicalPages.length ||
    JSON.stringify(actual) !== JSON.stringify(expected) ||
    version.pages.length !== version.pageCount ||
    version.pages.some((p) => p.quality !== 'COMPLETE')
  )
    throw new KnowledgeError('REVIEW_INCOMPLETE');
  const reviewedBy = actor.kind === 'hq' ? `hq:${actor.uid}` : `operator:${actor.id}`;
  if (version.status !== 'EXTRACTED') {
    if (version.reviewedBy !== reviewedBy || version.reviewedPageCount !== version.pageCount)
      throw new KnowledgeError('REVIEW_IDENTITY_MISMATCH');
    if (version.status === 'READY') {
      if (version.embeddingConfigHash !== p.embedder.config.configHash)
        throw new KnowledgeError('EMBEDDING_CONFIG_MISMATCH');
      return;
    }
    await p.repo.ready(
      input.versionId,
      version.revision,
      p.embedder.config.configHash,
      version.expectedChunkCount ?? 0,
    );
    return;
  }
  for (const physicalPage of actual) {
    if (!version.pages.find((p) => p.physicalPage === physicalPage)?.reviewed)
      await p.repo.reviewPage(input.versionId, physicalPage, input.extractionHash);
  }
  await p.repo.recordReview(
    input.versionId,
    version.revision,
    input.extractionHash,
    version.pageCount,
    reviewedBy,
  );
  await p.repo.ready(
    input.versionId,
    version.revision + 1,
    p.embedder.config.configHash,
    version.expectedChunkCount ?? 0,
  );
}

export async function recordOperatorProductReview(
  p: KnowledgePipeline,
  input: {
    versionId: string;
    productId: string | null;
  },
): Promise<{ reviewedHash: string }> {
  const version = await scopedVersion(p, input.versionId);
  const card = version.kind === 'PRODUCT_CARD';
  if (
    (!card && version.kind !== 'PRODUCT_CATALOG') ||
    card !== !!input.productId ||
    !version.chunks.length
  )
    throw new KnowledgeError('VALIDATION_ERROR');
  if (
    !version.reviewedBy?.startsWith('operator:') ||
    !version.extractionHash ||
    version.productKnowledgeRevision !== 0 ||
    version.publishedAt ||
    version.revokedAt
  )
    throw new KnowledgeError('STALE_STATE');
  const chunk = version.chunks[0];
  const rows = card
    ? [
        {
          id: randomUUID(),
          version_id: version.id,
          business_id: p.businessId,
          product_id: input.productId,
          chunk_id: chunk.id,
          start: 0,
          end: chunk.text.length,
          extraction_hash: version.extractionHash,
          candidate_product_ids: [],
          method: 'hq' as const,
          confirmed: true,
          created_by: version.reviewedBy,
          created_at: new Date().toISOString(),
        },
      ]
    : [];
  const links = rows.map((l) => ({
    id: l.id,
    passage: { chunkId: l.chunk_id, start: l.start, end: l.end },
    productId: l.product_id,
    candidateProductIds: [],
    method: l.method,
    confirmed: true,
  }));
  const unlinked = unlinkedPassages(version.chunks, links);
  const state = { acknowledgedUnlinkedPassages: unlinked, emptyKnowledgeAcknowledged: !card };
  const catalogRevision = await p.repo.businessProductKnowledgeRevision(p.businessId);
  const review: KnowledgeProductReview = {
    versionId: version.id,
    extractionHash: version.extractionHash,
    revision: 1,
    catalogRevision,
    links,
    profiles: [],
    unlinkedPassages: unlinked,
    impact: [],
    reviewedHash: null,
    ...state,
  };
  const reviewedHash = productKnowledgeHash(review);
  await p.repo.recordOperatorProductReview({
    businessId: p.businessId,
    versionId: version.id,
    extractionHash: version.extractionHash,
    catalogRevision,
    reviewedHash,
    stateJson: JSON.stringify(state),
    linksJson: JSON.stringify(rows),
  });
  return { reviewedHash };
}
