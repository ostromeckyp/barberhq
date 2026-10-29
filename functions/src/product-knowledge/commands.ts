import { runWithinBudget } from '../ai/budget.js';
import type { AiBudget } from '../ai/models/ai-budget.js';
import { randomUUID } from 'node:crypto';
import type {
  AcceptKnowledgeProductReviewInput,
  SaveKnowledgeProductReviewInput,
  KnowledgeProductReview,
} from '../../../shared/contracts/product-knowledge/index.js';
import { KnowledgeError, type KnowledgeRepository } from '../knowledge/repository.js';
import { ProductKnowledgeRepository } from './repository.js';
import type { ProductKnowledgeState } from './models/product-knowledge-state.js';
import type { ProductOperation } from './models/product-operation.js';
import {
  validateProductLinks,
  calculateAliasImpact,
  passageKey,
  productKnowledgeHash,
} from './rules.js';
import { parseAcceptKnowledgeProductReview } from './schemas.js';
import { assertProductDraft, productOperationHash, reviewFromState } from './review-state.js';
import { saveProductReview } from './save-review.js';
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
    return saveProductReview(this, uid, raw);
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
