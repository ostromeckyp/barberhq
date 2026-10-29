import { randomUUID } from 'node:crypto';
import type {
  SaveKnowledgeProductReviewInput,
  KnowledgeProductReview,
} from '../../../shared/contracts/product-knowledge/index.js';
import { normalizeProduct } from '../../../shared/product-normalization.js';
import { KnowledgeError } from '../knowledge/repository.js';
import type { ProductKnowledgeCommands } from './commands.js';
import type { ProductOperation } from './models/product-operation.js';
import type { KnowledgeAliasRow } from './models/knowledge-alias-row.js';
import type { KnowledgeProfileRow } from './models/knowledge-profile-row.js';
import type { KnowledgeLinkRow } from './models/knowledge-link-row.js';
import {
  resolveKnowledgePassage,
  validateProductLinks,
  calculateAliasImpact,
  passageKey,
} from './rules.js';
import { parseSaveKnowledgeProductReview } from './schemas.js';
import { assertProductDraft, productOperationHash, reviewFromState } from './review-state.js';

export async function saveProductReview(
  commands: ProductKnowledgeCommands,
  uid: string,
  raw: SaveKnowledgeProductReviewInput,
): Promise<KnowledgeProductReview> {
  const input = parseSaveKnowledgeProductReview(raw);
  const hash = productOperationHash('SAVE', input);
  const state = await commands.products.state(uid, input.versionId, input.idempotencyKey);
  const replay = commands.replay(state, 'SAVE', hash);
  if (replay) return replay;
  assertProductDraft(state, input.extractionHash, input.expectedReviewRevision);
  const catalog = await commands.products.catalog(uid, input.versionId);
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
    await commands.products.activeAliases(uid, state.versionId),
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
    await commands.products.save({
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
    const fresh = await commands.products.state(uid, input.versionId, input.idempotencyKey);
    const replay = commands.replay(fresh, 'SAVE', hash);
    if (replay) return replay;
    throw new KnowledgeError('STALE_STATE');
  }
  return result;
}
