import { runWithinBudget } from '../ai/budget.js';
import type { AiBudget } from '../ai/models/ai-budget.js';
import { createHash, randomUUID } from 'node:crypto';
import type {
  AcceptKnowledgeProductReviewInput,
  SaveKnowledgeProductReviewInput,
  KnowledgeProductReview,
  KnowledgeProductLink,
  ProductProfileProposal,
  KnowledgePassageRef,
} from '../../../shared/contracts/product-knowledge/index.js';
import { normalizeProduct } from '../../../shared/product-normalization.js';
import { KnowledgeError, type KnowledgeRepository } from '../knowledge/repository.js';
import { ProductKnowledgeRepository } from './repository.js';
import type { ProductKnowledgeState } from './models/product-knowledge-state.js';
import type { ProductOperation } from './models/product-operation.js';
import type { KnowledgeAliasRow } from './models/knowledge-alias-row.js';
import type { KnowledgeProfileRow } from './models/knowledge-profile-row.js';
import type { KnowledgeLinkRow } from './models/knowledge-link-row.js';
import {
  resolveKnowledgePassage,
  validateProductLinks,
  calculateAliasImpact,
  passageKey,
  productKnowledgeHash,
} from './rules.js';
import { parseSaveKnowledgeProductReview, parseAcceptKnowledgeProductReview } from './schemas.js';
export function productOperationHash(action: string, input: unknown): string {
  const canonical = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(canonical)
      : v && typeof v === 'object'
        ? Object.fromEntries(
            Object.entries(v)
              .filter(([k]) => k !== 'idempotencyKey')
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([k, x]) => [k, canonical(x)]),
          )
        : v;
  return createHash('sha256')
    .update(JSON.stringify([action, canonical(input)]))
    .digest('hex');
}
export function assertProductDraft(
  state: ProductKnowledgeState,
  hash: string,
  revision: number,
): void {
  if (
    state.extractionHash !== hash ||
    state.revision !== revision ||
    state.revision >= 2147483647 ||
    state.publishedAt ||
    state.revokedAt ||
    state.pendingStage === 'PUBLISH' ||
    !['EXTRACTED', 'REVIEWED', 'READY'].includes(state.status)
  )
    throw new KnowledgeError('STALE_STATE');
  if (!['PRODUCT_CARD', 'PRODUCT_CATALOG'].includes(state.kind ?? ''))
    throw new KnowledgeError('VALIDATION_ERROR', 'This document has no product review');
}
export function unlinkedPassages(
  chunks: ProductKnowledgeState['chunks'],
  links: KnowledgeProductLink[],
): KnowledgePassageRef[] {
  return chunks.flatMap((chunk) => {
    const ranges = links
      .filter((l) => l.confirmed && l.productId && l.passage.chunkId === chunk.id)
      .map((l) => l.passage)
      .sort((a, b) => a.start - b.start);
    let start = 0;
    const missing: KnowledgePassageRef[] = [];
    for (const range of ranges) {
      if (range.start > start && chunk.text.slice(start, range.start).trim())
        missing.push({ chunkId: chunk.id, start, end: range.start });
      start = Math.max(start, range.end);
    }
    if (start < chunk.text.length && chunk.text.slice(start).trim())
      missing.push({ chunkId: chunk.id, start, end: chunk.text.length });
    return missing;
  });
}
export function reviewFromState(state: ProductKnowledgeState): KnowledgeProductReview {
  const links: KnowledgeProductLink[] = state.links.map((l) => ({
    id: l.id,
    passage: { chunkId: l.chunk_id, start: l.start, end: l.end },
    productId: l.product_id,
    candidateProductIds: l.candidate_product_ids,
    method: l.method,
    confirmed: l.confirmed,
  }));
  const profiles: ProductProfileProposal[] = state.profiles.map((p) => ({
    productId: p.product_id,
    type: p.proposed_type,
    aliases: state.aliases
      .filter((a) => a.product_id === p.product_id)
      .map((a) => ({
        id: a.id,
        productId: a.product_id,
        phrase: a.phrase,
        kind: a.kind.toLowerCase() as 'name' | 'type' | 'phonetic',
        lang: a.lang,
        source: a.source.toLowerCase() as 'generated' | 'hq',
        decision: a.status === 'REJECTED' ? 'rejected' : a.reviewed_at ? 'accepted' : 'pending',
      })),
  }));
  return {
    versionId: state.versionId,
    extractionHash: state.extractionHash ?? '',
    revision: state.revision,
    catalogRevision: state.catalogRevision,
    links,
    profiles,
    unlinkedPassages: unlinkedPassages(state.chunks, links),
    impact: [],
    reviewedHash: state.reviewedHash,
    acknowledgedUnlinkedPassages: state.state?.acknowledgedUnlinkedPassages ?? [],
    emptyKnowledgeAcknowledged: state.state?.emptyKnowledgeAcknowledged ?? false,
  };
}
export class ProductKnowledgeCommands {
  readonly products: ProductKnowledgeRepository;
  constructor(repo: Pick<KnowledgeRepository, 'dc'>) {
    this.products = new ProductKnowledgeRepository(repo.dc);
  }
  async accept(
    uid: string,
    raw: AcceptKnowledgeProductReviewInput,
  ): Promise<KnowledgeProductReview> {
    const input = parseAcceptKnowledgeProductReview(raw);
    const hash = productOperationHash('ACCEPT', input);
    const state = await this.products.state(uid, input.versionId, input.idempotencyKey);
    const replay = this.replay(state, 'ACCEPT', hash);
    if (replay) return replay;
    assertProductDraft(state, input.extractionHash, input.expectedReviewRevision);
    if (state.catalogRevision !== input.expectedCatalogRevision)
      throw new KnowledgeError('STALE_STATE');
    const review = reviewFromState(state);
    validateProductLinks(review.links, state.chunks);
    const products = new Set(
      review.links.filter((l) => l.confirmed && l.productId).map((l) => l.productId),
    );
    if (
      (state.kind === 'PRODUCT_CARD' && products.size !== 1) ||
      (state.kind === 'PRODUCT_CATALOG' &&
        products.size === 0 &&
        !review.emptyKnowledgeAcknowledged) ||
      review.links.some((l) => !l.confirmed) ||
      review.profiles.some(
        (p) => !products.has(p.productId) || p.aliases.some((a) => a.decision === 'pending'),
      ) ||
      review.unlinkedPassages.some(
        (p) => !review.acknowledgedUnlinkedPassages.some((a) => passageKey(a) === passageKey(p)),
      )
    )
      throw new KnowledgeError('REVIEW_INCOMPLETE');
    review.impact = calculateAliasImpact(
      review.profiles.flatMap((p) => p.aliases),
      await this.products.activeAliases(uid, state.versionId),
      state.replacesVersionId ? [state.replacesVersionId] : [],
    );
    review.reviewedHash = productKnowledgeHash(review);
    const now = new Date().toISOString();
    const operation: ProductOperation = {
      id: randomUUID(),
      business_id: state.businessId,
      version_id: state.versionId,
      actor_uid: uid,
      idempotency_key: input.idempotencyKey,
      action: 'ACCEPT',
      payload_hash: hash,
      result: review,
      generation_id: null,
      lease_expires_at: null,
      completed_at: now,
      created_at: now,
    };
    try {
      await this.products.accept({
        uid,
        businessId: state.businessId,
        versionId: state.versionId,
        extractionHash: input.extractionHash,
        revision: state.revision,
        catalogRevision: state.catalogRevision,
        reviewedHash: review.reviewedHash,
        operationJson: JSON.stringify([operation]),
      });
    } catch {
      const fresh = await this.products.state(uid, input.versionId, input.idempotencyKey);
      const replay = this.replay(fresh, 'ACCEPT', hash);
      if (replay) return replay;
      throw new KnowledgeError('STALE_STATE');
    }
    return review;
  }
  async read(uid: string, versionId: string): Promise<KnowledgeProductReview> {
    const state = await this.products.state(uid, versionId);
    const active = await this.products.activeAliases(uid, versionId);
    const fresh = await this.products.state(uid, versionId);
    if (
      fresh.revision !== state.revision ||
      fresh.catalogRevision !== state.catalogRevision ||
      fresh.extractionHash !== state.extractionHash
    )
      throw new KnowledgeError('STALE_STATE');
    const result = reviewFromState(state);
    result.impact = calculateAliasImpact(
      result.profiles.flatMap((p) => p.aliases),
      active,
      state.replacesVersionId ? [state.replacesVersionId] : [],
    );
    return result;
  }
  async save(uid: string, raw: SaveKnowledgeProductReviewInput): Promise<KnowledgeProductReview> {
    const input = parseSaveKnowledgeProductReview(raw);
    const hash = productOperationHash('SAVE', input);
    const state = await this.products.state(uid, input.versionId, input.idempotencyKey);
    const replay = this.replay(state, 'SAVE', hash);
    if (replay) return replay;
    assertProductDraft(state, input.extractionHash, input.expectedReviewRevision);
    const catalog = await this.products.catalog(uid, input.versionId);
    const products = new Set(catalog.map((p) => p.id));
    const now = new Date().toISOString();
    const links: KnowledgeLinkRow[] = input.links.map((edit) => {
      const old = edit.id ? state.links.find((l) => l.id === edit.id) : undefined;
      if (edit.id && !old) throw new KnowledgeError('VALIDATION_ERROR', 'Unknown link identity');
      if (edit.productId && !products.has(edit.productId)) throw new KnowledgeError('FORBIDDEN');
      resolveKnowledgePassage(edit.passage, state.chunks);
      return {
        id: old?.id ?? randomUUID(),
        version_id: state.versionId,
        business_id: state.businessId,
        product_id: edit.productId,
        chunk_id: edit.passage.chunkId,
        start: edit.passage.start,
        end: edit.passage.end,
        extraction_hash: input.extractionHash,
        candidate_product_ids: old?.candidate_product_ids ?? [],
        method:
          old &&
          old.chunk_id === edit.passage.chunkId &&
          old.start === edit.passage.start &&
          old.end === edit.passage.end &&
          (old.product_id === edit.productId ||
            (!old.confirmed &&
              !!edit.productId &&
              old.candidate_product_ids.includes(edit.productId)))
            ? old.method
            : 'hq',
        confirmed: edit.confirmed,
        created_by: old?.created_by ?? uid,
        created_at: old?.created_at ?? now,
      };
    });
    const publicLinks = links.map((l) => ({
      id: l.id,
      passage: { chunkId: l.chunk_id, start: l.start, end: l.end },
      productId: l.product_id,
      method: l.method,
      confirmed: l.confirmed,
      candidateProductIds: l.candidate_product_ids,
    }));
    validateProductLinks(publicLinks, state.chunks);
    const confirmed = new Set(links.filter((l) => l.confirmed).map((l) => l.product_id!));
    if (state.kind === 'PRODUCT_CARD' && confirmed.size > 1)
      throw new KnowledgeError('VALIDATION_ERROR', 'A product card may link only one product');
    const profiles: KnowledgeProfileRow[] = input.profiles.map((p) => {
      if (!products.has(p.productId) || !confirmed.has(p.productId))
        throw new KnowledgeError('VALIDATION_ERROR', 'Profile needs a confirmed product passage');
      return {
        version_id: state.versionId,
        business_id: state.businessId,
        product_id: p.productId,
        proposed_type: p.type,
        approved_type: null,
        reviewed_by: null,
        reviewed_at: null,
      };
    });
    const aliases: KnowledgeAliasRow[] = input.profiles.flatMap((p) =>
      p.aliases.map((edit) => {
        const old = edit.id
          ? state.aliases.find((a) => a.id === edit.id && a.product_id === p.productId)
          : undefined;
        if (edit.id && !old) throw new KnowledgeError('VALIDATION_ERROR', 'Unknown alias identity');
        return {
          id: old?.id ?? randomUUID(),
          business_id: state.businessId,
          product_id: p.productId,
          salon_id: null,
          phrase: edit.phrase,
          normalized: normalizeProduct(edit.phrase),
          kind: edit.kind.toUpperCase() as KnowledgeAliasRow['kind'],
          lang: edit.lang,
          source: old?.source ?? 'HQ',
          status: edit.decision === 'rejected' ? 'REJECTED' : 'PROPOSED',
          ambiguous: false,
          source_document_version_id: state.versionId,
          created_by: old?.created_by ?? uid,
          created_at: old?.created_at ?? now,
          reviewed_by: edit.decision === 'pending' ? null : uid,
          reviewed_at: edit.decision === 'pending' ? null : now,
          generation_id: old?.generation_id ?? null,
        };
      }),
    );
    const nextState = {
      ...state,
      revision: state.revision + 1,
      reviewedHash: null,
      links,
      profiles,
      aliases,
      state: {
        acknowledgedUnlinkedPassages: input.acknowledgedUnlinkedPassages,
        emptyKnowledgeAcknowledged: input.emptyKnowledgeAcknowledged,
      },
    };
    const result = reviewFromState(nextState);
    const missing = new Set(result.unlinkedPassages.map(passageKey));
    for (const ref of input.acknowledgedUnlinkedPassages)
      if (!missing.has(passageKey(ref)))
        throw new KnowledgeError(
          'VALIDATION_ERROR',
          'Acknowledgement does not match an unlinked passage',
        );
    result.impact = calculateAliasImpact(
      result.profiles.flatMap((p) => p.aliases),
      await this.products.activeAliases(uid, state.versionId),
      state.replacesVersionId ? [state.replacesVersionId] : [],
    );
    const operation: ProductOperation = {
      id: randomUUID(),
      business_id: state.businessId,
      version_id: state.versionId,
      actor_uid: uid,
      idempotency_key: input.idempotencyKey,
      action: 'SAVE',
      payload_hash: hash,
      result,
      generation_id: null,
      lease_expires_at: null,
      completed_at: now,
      created_at: now,
    };
    try {
      await this.products.save({
        uid,
        businessId: state.businessId,
        versionId: state.versionId,
        extractionHash: input.extractionHash,
        revision: state.revision,
        catalogRevision: state.catalogRevision,
        stateJson: JSON.stringify(nextState.state),
        linksJson: JSON.stringify(links),
        profilesJson: JSON.stringify(profiles),
        aliasesJson: JSON.stringify(aliases),
        operationJson: JSON.stringify([operation]),
      });
    } catch {
      const fresh = await this.products.state(uid, input.versionId, input.idempotencyKey);
      const replay = this.replay(fresh, 'SAVE', hash);
      if (replay) return replay;
      throw new KnowledgeError('STALE_STATE');
    }
    return result;
  }
  async persistGenerated(
    uid: string,
    state: ProductKnowledgeState,
    next: ProductKnowledgeState,
    action: string,
    key: string,
    hash: string,
    generationId: string,
    budget: AiBudget,
  ): Promise<KnowledgeProductReview> {
    const result = reviewFromState(next);
    result.impact = calculateAliasImpact(
      result.profiles.flatMap((p) => p.aliases),
      await this.products.activeAliases(uid, state.versionId, budget),
      state.replacesVersionId ? [state.replacesVersionId] : [],
    );
    const now = new Date().toISOString();
    const operation: ProductOperation = {
      id: state.operation?.id ?? randomUUID(),
      business_id: state.businessId,
      version_id: state.versionId,
      actor_uid: uid,
      idempotency_key: key,
      action,
      payload_hash: hash,
      result,
      generation_id: generationId,
      lease_expires_at: null,
      completed_at: now,
      created_at: state.operation?.created_at ?? now,
    };
    try {
      await runWithinBudget(budget, () =>
        this.products.save({
          uid,
          businessId: state.businessId,
          versionId: state.versionId,
          extractionHash: state.extractionHash!,
          revision: state.revision,
          catalogRevision: state.catalogRevision,
          stateJson: JSON.stringify(next.state),
          linksJson: JSON.stringify(next.links),
          profilesJson: JSON.stringify(next.profiles),
          aliasesJson: JSON.stringify(next.aliases),
          operationJson: JSON.stringify([operation]),
          generationId,
        }),
      );
    } catch {
      const fresh = await this.products.state(uid, state.versionId, key, budget);
      if (fresh.operation?.completed_at) {
        const replay = this.replay(fresh, action, hash);
        if (replay) return replay;
      }
      throw new KnowledgeError('STALE_STATE');
    }
    return result;
  }
  replay(
    state: ProductKnowledgeState,
    action: string,
    hash: string,
  ): KnowledgeProductReview | undefined {
    const op = state.operation;
    if (!op) return;
    if (op.action !== action || op.payload_hash !== hash)
      throw new KnowledgeError('IDEMPOTENCY_CONFLICT');
    if (op.completed_at && op.result) return op.result;
    throw new KnowledgeError('IN_PROGRESS');
  }
}
