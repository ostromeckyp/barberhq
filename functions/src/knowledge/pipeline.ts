import { validateKnowledgeProvenance } from './schemas.js';
import { createHash, randomUUID } from 'node:crypto';
import * as sql from '@barberhq/server';
import {
  metadataFromStorage,
  isSyntheticSource,
  legacySourceType,
  storageKind,
  storageOrigin,
} from '../../../shared/knowledge-metadata.js';
import type { KnowledgeMetadata, ProcessingResult } from '../../../shared/contracts/knowledge.js';
import { chunkPages } from './chunk.js';
import { extractPdf, validatePdf } from './extract.js';
import type { EmbeddingConfig, EmbeddingMode } from './embedding.js';
import { KnowledgeError, KnowledgeRepository } from './repository.js';
import { unlinkedPassages } from './product-knowledge-commands.js';
import { productKnowledgeHash } from './product-knowledge-rules.js';
import type { KnowledgeProductReview } from '../../../shared/contracts/product-knowledge.js';

export type ManifestEntry = {
  documentId: string;
  version: string;
  title: string;
  language: string;
  businessKey: string;
  kind: KnowledgeMetadata['kind'];
  origin: KnowledgeMetadata['origin'];
  publicationStatus: 'demo-current' | 'retired';
  /** Product cards only: the seeded product this card belongs to. */
  productDemoId?: string;
  /** Procedures only: the delivery problem kind the demo binds to this document. */
  deliveryProblemKind?: 'DAMAGED' | 'MISSING';
  inputPdf: string;
  sha256: string;
  sourceUrls: string[];
  observedOn: string | null;
};
export type ReviewInput = {
  versionId: string;
  pdfSha256: string;
  extractionHash: string;
  reviewedPhysicalPages: number[];
  approvalText: string;
  approvedAt: string;
};
export type OperatorActor = { kind: 'operator'; id: string; businessId: string };
export type HqActor = { kind: 'hq'; uid: string; businessId: string };
export type ReviewActor = OperatorActor | HqActor;
export type PublishInput = {
  versionId: string;
  expectedDocumentRevision: number;
  expectedVersionRevision?: number;
  extractionHash?: string;
};
export type Embedder = {
  config: EmbeddingConfig;
  embedTexts(texts: string[], mode: EmbeddingMode): Promise<number[][]>;
};

export function knowledgeIds(businessId: string, documentCode: string, version: string) {
  if (!/^[A-Z0-9-]{3,64}$/.test(documentCode) || !/^v(?:0|[1-9][0-9]*)$/.test(version))
    throw new KnowledgeError('INVALID_ID');
  const documentId = `${businessId}:${documentCode}`;
  return { documentId, versionId: `${documentId}:${version}` };
}

export class KnowledgePipeline {
  constructor(
    readonly repo: KnowledgeRepository,
    readonly embedder: Embedder,
    readonly businessId: string,
    readonly businessKey: string,
  ) {
    if (!businessId || !businessKey || embedder.config.dimension !== 768)
      throw new KnowledgeError('INVALID_CONFIG');
  }

  async stageVersion(input: ManifestEntry, bytes: Uint8Array): Promise<string> {
    if (
      (input.publicationStatus !== 'demo-current' && input.publicationStatus !== 'retired') ||
      input.businessKey !== this.businessKey ||
      !/^[a-f0-9]{64}$/.test(input.sha256)
    )
      throw new KnowledgeError('INVALID_MANIFEST');
    if (input.version === 'v0' && input.publicationStatus !== 'retired')
      throw new KnowledgeError('INVALID_MANIFEST');
    const metadata = metadataFromStorage({ ...input, synthetic: isSyntheticSource(input) });
    try {
      validateKnowledgeProvenance({
        origin: metadata.origin,
        sourceUrls: input.sourceUrls,
        observedOn: input.observedOn,
      });
    } catch {
      throw new KnowledgeError('INVALID_MANIFEST');
    }
    const hash = createHash('sha256').update(bytes).digest('hex');
    if (hash !== input.sha256) throw new KnowledgeError('PDF_HASH_MISMATCH');
    const { pageCount } = await validatePdf(bytes);
    const ids = knowledgeIds(this.businessId, input.documentId, input.version);
    const document = await this.repo.document(ids.documentId);
    if (document && document.nextVersionNumber == null)
      throw new KnowledgeError('VERSION_CONFLICT', 'Version cursor is uninitialized');
    const existing = await this.repo.version(ids.versionId);
    if (existing) {
      const classification = metadataFromStorage(existing);
      if (
        classification.kind !== metadata.kind ||
        classification.origin !== metadata.origin ||
        existing.pdfSha256 !== hash ||
        existing.byteSize !== bytes.length ||
        existing.pageCount !== pageCount ||
        existing.businessId !== this.businessId ||
        existing.documentId !== ids.documentId ||
        existing.publicationStatus !==
          (input.publicationStatus === 'retired' ? 'RETIRED' : 'DEMO_CURRENT')
      )
        throw new KnowledgeError('VERSION_CONFLICT');
      return ids.versionId;
    }
    const path = `knowledge/${this.businessId}/${input.documentId}/${input.version}/${hash}.pdf`;
    const original = await this.repo.putOriginal(path, bytes, hash);
    try {
      await this.repo.stage({
        businessId: this.businessId,
        documentId: ids.documentId,
        documentCode: input.documentId,
        versionId: ids.versionId,
        versionLabel: input.version,
        nextVersionNumber: Number(input.version.slice(1)) + 1,
        newDocument: !document,
        existingDocument: !!document,
        title: input.title,
        language: input.language,
        kind: storageKind(metadata.kind) as sql.KnowledgeDocumentKind,
        origin: storageOrigin(metadata.origin) as sql.KnowledgeOrigin,
        sourceType:
          (legacySourceType(metadata)
            ?.replaceAll('-', '_')
            .toUpperCase() as sql.KnowledgeSourceType) ?? null,
        publicationStatus:
          input.publicationStatus === 'retired'
            ? sql.KnowledgePublicationStatus.RETIRED
            : sql.KnowledgePublicationStatus.DEMO_CURRENT,
        synthetic: isSyntheticSource(metadata),
        sourceUrls: input.sourceUrls,
        observedOn: input.observedOn,
        bucket: original.bucket,
        objectPath: original.path,
        objectGeneration: original.generation,
        pdfSha256: hash,
        contentType: 'application/pdf',
        byteSize: bytes.length,
        pageCount,
      });
    } catch (error) {
      const raced = await this.repo.version(ids.versionId);
      if (
        raced?.pdfSha256 === hash &&
        metadataFromStorage(raced).kind === metadata.kind &&
        metadataFromStorage(raced).origin === metadata.origin &&
        raced.byteSize === bytes.length &&
        raced.publicationStatus ===
          (input.publicationStatus === 'retired' ? 'RETIRED' : 'DEMO_CURRENT')
      ) {
        const racedDocument = await this.repo.document(ids.documentId);
        if (racedDocument?.nextVersionNumber == null)
          throw new KnowledgeError('VERSION_CONFLICT', 'Version cursor is uninitialized');
        return ids.versionId;
      }
      if (raced) throw new KnowledgeError('VERSION_CONFLICT');
      throw error;
    }
    return ids.versionId;
  }

  async extractVersion(versionId: string): Promise<ProcessingResult> {
    const version = await this.scopedVersion(versionId);
    if (version.publishedAt || version.revokedAt) throw new KnowledgeError('IMMUTABLE_VERSION');
    if (!['STAGED', 'FAILED', 'NEEDS_REVIEW'].includes(version.status))
      throw new KnowledgeError('INVALID_TRANSITION');
    await this.repo.begin(versionId, version.revision, version.pdfSha256);
    return this.extractClaimedVersion(versionId, { revision: version.revision + 1, leaseId: null });
  }

  /** Runs extraction only after the caller has atomically begun or claimed this revision. */
  async extractClaimedVersion(
    versionId: string,
    claim: { revision: number; leaseId: string | null },
  ): Promise<ProcessingResult> {
    const version = await this.scopedVersion(versionId);
    if (
      version.revision !== claim.revision ||
      version.status !== 'STAGED' ||
      version.publishedAt ||
      version.revokedAt ||
      version.processingLeaseId !== claim.leaseId ||
      (claim.leaseId !== null && version.pdfSha256.length !== 64)
    )
      throw new KnowledgeError('STALE_STATE');
    const bytes = await this.repo.original(version);
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
          ...(await this.embedder.embedTexts(
            chunks.slice(index, index + 100).map((c) => c.text),
            'document',
          )),
        );
      }
      if (vectors.length !== chunks.length) throw new KnowledgeError('EMBEDDING_COUNT_MISMATCH');
    }
    const attemptRevision = claim.revision;
    for (const page of doc.pages)
      await this.repo.page({
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
      await this.repo.chunk({
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
        embeddingModel: this.embedder.config.modelId,
        embeddingDimension: this.embedder.config.dimension,
        embeddingConfigHash: this.embedder.config.configHash,
      });
    }
    const status = doc.quality === 'COMPLETE' ? 'EXTRACTED' : 'NEEDS_REVIEW';
    await this.repo.save({
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

  async recordReview(input: ReviewInput, actor: ReviewActor): Promise<void> {
    const version = await this.scopedVersion(input.versionId);
    if (
      actor.businessId !== this.businessId ||
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
        if (version.embeddingConfigHash !== this.embedder.config.configHash)
          throw new KnowledgeError('EMBEDDING_CONFIG_MISMATCH');
        return;
      }
      await this.repo.ready(
        input.versionId,
        version.revision,
        this.embedder.config.configHash,
        version.expectedChunkCount ?? 0,
      );
      return;
    }
    for (const physicalPage of actual) {
      if (!version.pages.find((p) => p.physicalPage === physicalPage)?.reviewed)
        await this.repo.reviewPage(input.versionId, physicalPage, input.extractionHash);
    }
    await this.repo.recordReview(
      input.versionId,
      version.revision,
      input.extractionHash,
      version.pageCount,
      reviewedBy,
    );
    await this.repo.ready(
      input.versionId,
      version.revision + 1,
      this.embedder.config.configHash,
      version.expectedChunkCount ?? 0,
    );
  }

  async publishVersion(input: PublishInput): Promise<ProcessingResult> {
    let version = await this.scopedVersion(input.versionId);
    if (version.publicationStatus === 'RETIRED') throw new KnowledgeError('RETIRED_VERSION');
    if (
      version.isActive &&
      version.publishedAt &&
      !version.revokedAt &&
      version.embeddingConfigHash === this.embedder.config.configHash &&
      version.document?.activeVersionId === input.versionId
    )
      return { versionId: input.versionId, status: 'READY', retryable: false };
    if (
      version.status !== 'READY' ||
      !version.reviewedAt ||
      !version.reviewedBy ||
      version.revokedAt ||
      version.publishedAt ||
      version.embeddingConfigHash !== this.embedder.config.configHash
    )
      throw new KnowledgeError('NOT_READY');
    if (
      version.pages.length !== version.pageCount ||
      version.pages.some((p) => !p.reviewed || p.quality !== 'COMPLETE') ||
      version.chunks.length !== version.expectedChunkCount
    )
      throw new KnowledgeError('NOT_READY');
    if (version.pendingStage === null && version.reviewedBy.startsWith('operator:')) {
      await this.repo.setOperatorPublishIntent({
        businessId: this.businessId,
        versionId: version.id,
        revision: version.revision,
        expectedDocumentRevision: input.expectedDocumentRevision,
        extractionHash: version.extractionHash!,
        configHash: this.embedder.config.configHash,
        productKnowledgeReviewedHash: version.productKnowledgeReviewedHash ?? null,
        productKnowledgeRevision: version.productKnowledgeReviewedHash
          ? version.productKnowledgeRevision
          : null,
        productKnowledgeCatalogRevision: version.productKnowledgeCatalogRevision ?? null,
      });
      version = await this.scopedVersion(input.versionId);
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
      await this.repo.publish({
        versionId: input.versionId,
        documentId: version.documentId,
        businessId: this.businessId,
        expectedDocumentRevision: input.expectedDocumentRevision,
        versionRevision: version.revision,
        extractionHash,
        configHash: this.embedder.config.configHash,
      });
    } catch (error) {
      if (String(error).includes('STALE_STATE')) throw new KnowledgeError('STALE_STATE');
      throw error;
    }
    return { versionId: input.versionId, status: 'READY', retryable: false };
  }

  /**
   * Product review from an operator receipt (demo reset): a card links its whole first passage
   * to its product, a catalog acknowledges empty knowledge. Every other passage is acknowledged.
   */
  async recordOperatorProductReview(input: {
    versionId: string;
    productId: string | null;
  }): Promise<{ reviewedHash: string }> {
    const version = await this.scopedVersion(input.versionId);
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
            business_id: this.businessId,
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
    const catalogRevision = await this.repo.businessProductKnowledgeRevision(this.businessId);
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
    await this.repo.recordOperatorProductReview({
      businessId: this.businessId,
      versionId: version.id,
      extractionHash: version.extractionHash,
      catalogRevision,
      reviewedHash,
      stateJson: JSON.stringify(state),
      linksJson: JSON.stringify(rows),
    });
    return { reviewedHash };
  }

  private async scopedVersion(id: string) {
    const version = await this.repo.version(id);
    if (!version || version.businessId !== this.businessId) throw new KnowledgeError('NOT_FOUND');
    return version;
  }
}
