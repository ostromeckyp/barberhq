import { createHash } from 'node:crypto';
import type {
  KnowledgeProductReview,
  KnowledgeProductLink,
  ProductProfileProposal,
  KnowledgePassageRef,
} from '../../../shared/contracts/product-knowledge/index.js';
import { KnowledgeError } from '../knowledge/repository.js';
import type { ProductKnowledgeState } from './models/product-knowledge-state.js';

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
