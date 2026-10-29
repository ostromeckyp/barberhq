import type { GetKnowledgeProductReviewData } from '../../../core/generated';
import type {
  KnowledgeProductWorkspace,
  KnowledgeProductReview,
  KnowledgeProductLink,
  KnowledgePassageRef,
  ActiveProductAlias,
  ProductAliasKind,
} from '../../../../../../shared/contracts/product-knowledge';
import { normalizeProduct } from '../../../../../../shared/product-normalization';
export function mapProductKnowledgeWorkspace(
  data: GetKnowledgeProductReviewData,
  versionId: string,
): KnowledgeProductWorkspace {
  const business = data.membership?.business;
  const v = business?.versions[0];
  if (
    !business ||
    !v ||
    v.id !== versionId ||
    !v.extractionHash ||
    business.products.length > 200 ||
    v.links.length > 200 ||
    v.profiles.length > 200 ||
    v.aliases.length > 6400 ||
    v.chunks.length > 300 ||
    !Array.isArray(data.activeAliases) ||
    data.activeAliases.length > 5000
  )
    throw new Error('The complete product review could not be loaded.');
  const state = (v.productKnowledgeState ?? {}) as {
    acknowledgedUnlinkedPassages?: KnowledgePassageRef[];
    emptyKnowledgeAcknowledged?: boolean;
  };
  const links: KnowledgeProductLink[] = v.links.map((l) => ({
    id: l.id,
    passage: { chunkId: l.chunkId, start: l.start, end: l.end },
    productId: l.productId ?? null,
    candidateProductIds: Array.isArray(l.candidateProductIds)
      ? (l.candidateProductIds as string[])
      : [],
    method: l.method as 'hq' | 'code' | 'model',
    confirmed: l.confirmed,
  }));
  const unlinked: KnowledgePassageRef[] = v.chunks.flatMap((c) => {
    const ranges = links
      .filter((l) => l.confirmed && l.productId && l.passage.chunkId === c.id)
      .map((l) => l.passage)
      .sort((a, b) => a.start - b.start);
    let start = 0;
    const refs: KnowledgePassageRef[] = [];
    for (const ref of ranges) {
      if (ref.start > start && c.text.slice(start, ref.start).trim())
        refs.push({ chunkId: c.id, start, end: ref.start });
      start = Math.max(start, ref.end);
    }
    if (start < c.text.length && c.text.slice(start).trim())
      refs.push({ chunkId: c.id, start, end: c.text.length });
    return refs;
  });
  const profiles = v.profiles.map((p) => ({
    productId: p.productId,
    type: p.proposedType ?? null,
    aliases: v.aliases
      .filter((a) => a.productId === p.productId)
      .map((a) => ({
        id: a.id,
        productId: a.productId,
        phrase: a.phrase,
        kind: a.kind.toLowerCase() as ProductAliasKind,
        lang: a.lang as 'pl' | 'en',
        source: a.source.toLowerCase() as 'generated' | 'hq',
        decision:
          a.status === 'REJECTED'
            ? ('rejected' as const)
            : a.reviewedAt
              ? ('accepted' as const)
              : ('pending' as const),
      })),
  }));
  const proposed = profiles.flatMap((p) => p.aliases).filter((a) => a.decision === 'accepted');
  const active = data.activeAliases as ActiveProductAlias[];
  const impact = [...new Set(proposed.map((a) => normalizeProduct(a.phrase)))]
    .sort()
    .map((normalized) => {
      const beforeProductIds = [
        ...new Set(active.filter((a) => a.normalized === normalized).map((a) => a.productId)),
      ].sort();
      const surviving = active
        .filter(
          (a) => a.normalized === normalized && a.sourceVersionId !== v.document.activeVersionId,
        )
        .map((a) => a.productId);
      const afterProductIds = [
        ...new Set([
          ...surviving,
          ...proposed
            .filter((a) => normalizeProduct(a.phrase) === normalized)
            .map((a) => a.productId),
        ]),
      ].sort();
      return {
        normalized,
        beforeProductIds,
        afterProductIds,
        collision: afterProductIds.length > 1,
      };
    });
  const review: KnowledgeProductReview = {
    versionId,
    extractionHash: v.extractionHash,
    revision: v.productKnowledgeRevision,
    catalogRevision: business.productKnowledgeRevision,
    links,
    profiles,
    unlinkedPassages: unlinked,
    impact,
    reviewedHash:
      v.productKnowledgeCatalogRevision === business.productKnowledgeRevision
        ? (v.productKnowledgeReviewedHash ?? null)
        : null,
    acknowledgedUnlinkedPassages: state.acknowledgedUnlinkedPassages ?? [],
    emptyKnowledgeAcknowledged: state.emptyKnowledgeAcknowledged ?? false,
  };
  return {
    kind: v.kind === 'PRODUCT_CARD' ? 'product-card' : 'product-catalog',
    review,
    catalog: business.products.map((p) => ({
      ...p,
      type: p.type ?? null,
      scentPl: p.scentPl ?? null,
    })),
    passages: v.chunks.map((c) => ({
      ref: { chunkId: c.id, start: 0, end: c.text.length },
      text: c.text,
      physicalPage: c.physicalPage,
    })),
    readOnly: !!v.publishedAt || !!v.revokedAt || v.pendingStage === 'PUBLISH',
  };
}
