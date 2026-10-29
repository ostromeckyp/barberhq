import { createHash } from 'node:crypto';
import * as sql from '@barberhq/server';
import type { ProcessingResult } from '../../../shared/contracts/knowledge/index.js';
import { chunkPages } from './chunk.js';
import { extractPdf } from './extract.js';
import { KnowledgeError } from './repository.js';
import { scopedVersion } from './pipeline-scope.js';
import type { KnowledgePipeline } from './pipeline.js';

export async function extractVersion(
  p: KnowledgePipeline,
  versionId: string,
): Promise<ProcessingResult> {
  const version = await scopedVersion(p, versionId);
  if (version.publishedAt || version.revokedAt) throw new KnowledgeError('IMMUTABLE_VERSION');
  if (!['STAGED', 'FAILED', 'NEEDS_REVIEW'].includes(version.status))
    throw new KnowledgeError('INVALID_TRANSITION');
  await p.repo.begin(versionId, version.revision, version.pdfSha256);
  return extractClaimedVersion(p, versionId, { revision: version.revision + 1, leaseId: null });
}

/** Runs extraction only after the caller has atomically begun or claimed this revision. */
export async function extractClaimedVersion(
  p: KnowledgePipeline,
  versionId: string,
  claim: { revision: number; leaseId: string | null },
): Promise<ProcessingResult> {
  const version = await scopedVersion(p, versionId);
  if (
    version.revision !== claim.revision ||
    version.status !== 'STAGED' ||
    version.publishedAt ||
    version.revokedAt ||
    version.processingLeaseId !== claim.leaseId ||
    (claim.leaseId !== null && version.pdfSha256.length !== 64)
  )
    throw new KnowledgeError('STALE_STATE');
  const bytes = await p.repo.original(version);
  if (createHash('sha256').update(bytes).digest('hex') !== version.pdfSha256)
    throw new KnowledgeError('PDF_HASH_MISMATCH');
  const doc = await extractPdf(bytes);
  if (doc.pages.length !== version.pageCount) throw new KnowledgeError('PAGE_COUNT_MISMATCH');
  const chunks = chunkPages(doc);
  if (chunks.length < 1 || chunks.length > 300) throw new KnowledgeError('CHUNK_COUNT_INVALID');
  const vectors: number[][] = [];
  if (doc.quality === 'COMPLETE') {
    for (let index = 0; index < chunks.length; index += 100) {
      vectors.push(
        ...(await p.embedder.embedTexts(
          chunks.slice(index, index + 100).map((c) => c.text),
          'document',
        )),
      );
    }
    if (vectors.length !== chunks.length) throw new KnowledgeError('EMBEDDING_COUNT_MISMATCH');
  }
  const attemptRevision = claim.revision;
  for (const page of doc.pages)
    await p.repo.page({
      versionId,
      revision: attemptRevision,
      pdfSha256: version.pdfSha256,
      leaseId: claim.leaseId,
      physicalPage: page.physicalPage,
      text: page.text,
      markdown: page.markdown,
      spans: page.spans,
      quality:
        page.quality === 'COMPLETE'
          ? sql.KnowledgePageQuality.COMPLETE
          : sql.KnowledgePageQuality.NEEDS_REVIEW,
      viewBox: page.viewBox,
      userUnit: page.userUnit,
      rotation: page.rotation,
    });
  for (const [index, chunk] of chunks.entries()) {
    if (doc.quality !== 'COMPLETE') break;
    await p.repo.chunk({
      id: `${versionId}:${chunk.page}:${chunk.ordinal}`,
      versionId,
      revision: attemptRevision,
      pdfSha256: version.pdfSha256,
      leaseId: claim.leaseId,
      physicalPage: chunk.page,
      ordinal: chunk.ordinal,
      sectionId: chunk.sectionId,
      heading: chunk.heading,
      text: chunk.text,
      start: chunk.start,
      end: chunk.end,
      rects: chunk.rects,
      geometryStatus: chunk.geometryStatus,
      embedding: vectors[index],
      embeddingModel: p.embedder.config.modelId,
      embeddingDimension: p.embedder.config.dimension,
      embeddingConfigHash: p.embedder.config.configHash,
    });
  }
  const status = doc.quality === 'COMPLETE' ? 'EXTRACTED' : 'NEEDS_REVIEW';
  await p.repo.save({
    versionId,
    revision: attemptRevision,
    pdfSha256: version.pdfSha256,
    leaseId: claim.leaseId,
    parserVersion: doc.parserVersion,
    extractionHash: doc.extractionHash,
    expectedPageCount: doc.pages.length,
    expectedChunkCount: status === 'EXTRACTED' ? chunks.length : 0,
    status:
      status === 'EXTRACTED'
        ? sql.KnowledgeProcessingStatus.EXTRACTED
        : sql.KnowledgeProcessingStatus.NEEDS_REVIEW,
  });
  return { versionId, status, retryable: status === 'NEEDS_REVIEW' };
}
