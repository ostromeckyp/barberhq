import { createHash } from 'node:crypto';
import { normalizeProduct } from '../../../shared/product-normalization.js';
import type {
  KnowledgePassageRef,
  KnowledgeProductLink,
  KnowledgePassage,
  KnowledgeCatalogProduct,
  LinkSuggestion,
  AliasProposal,
  ActiveProductAlias,
  AliasImpact,
  KnowledgeProductReview,
} from '../../../shared/contracts/product-knowledge.js';
import { KnowledgeError } from './repository.js';
export type PassageChunk = { id: string; text: string; physicalPage: number };
const invalid = (message: string): never => {
  throw new KnowledgeError('VALIDATION_ERROR', message);
};
export const passageKey = (ref: KnowledgePassageRef): string =>
  JSON.stringify([ref.chunkId, ref.start, ref.end]);
export function resolveKnowledgePassage(
  ref: KnowledgePassageRef,
  chunks: PassageChunk[],
): { text: string; physicalPage: number } {
  const matches = chunks.filter((c) => c.id === ref.chunkId);
  if (matches.length !== 1) return invalid('Passage is not in this extraction');
  const chunk = matches[0];
  const splits = (i: number) =>
    i > 0 &&
    i < chunk.text.length &&
    /[\uD800-\uDBFF]/.test(chunk.text[i - 1]) &&
    /[\uDC00-\uDFFF]/.test(chunk.text[i]);
  if (
    !Number.isSafeInteger(ref.start) ||
    !Number.isSafeInteger(ref.end) ||
    ref.start < 0 ||
    ref.end <= ref.start ||
    ref.end > chunk.text.length ||
    splits(ref.start) ||
    splits(ref.end)
  )
    return invalid('Invalid passage range');
  const text = chunk.text.slice(ref.start, ref.end);
  if (!text.trim()) return invalid('Empty passage');
  return { text, physicalPage: chunk.physicalPage };
}
export function validateProductLinks(links: KnowledgeProductLink[], chunks: PassageChunk[]): void {
  for (const link of links) {
    resolveKnowledgePassage(link.passage, chunks);
    if (link.confirmed && !link.productId) invalid('Confirmed link requires a product');
  }
  for (let i = 0; i < links.length; i++)
    for (let j = i + 1; j < links.length; j++) {
      const a = links[i],
        b = links[j];
      if (
        a.confirmed &&
        b.confirmed &&
        a.productId !== b.productId &&
        a.passage.chunkId === b.passage.chunkId &&
        Math.max(a.passage.start, b.passage.start) < Math.min(a.passage.end, b.passage.end)
      )
        invalid('Overlapping passages need an unambiguous product');
    }
}
export function suggestProductCodeLinks(
  passages: KnowledgePassage[],
  products: KnowledgeCatalogProduct[],
): LinkSuggestion[] {
  if (products.length > 200 || passages.length > 200) invalid('Product knowledge limit exceeded');
  return passages.flatMap(({ ref, text }) => {
    const tokens = new Set(normalizeProduct(text).split(' '));
    const productIds = [
      ...new Set(
        products
          .filter((p) => {
            const code = normalizeProduct(p.sourceCode);
            return (
              code.length > 0 &&
              (code.includes(' ')
                ? ` ${normalizeProduct(text)} `.includes(` ${code} `)
                : tokens.has(code))
            );
          })
          .map((p) => p.id),
      ),
    ].sort();
    return productIds.length
      ? [{ passage: ref, productIds, method: 'code' as const, confirmed: false as const }]
      : [];
  });
}
export function calculateAliasImpact(
  proposed: AliasProposal[],
  active: ActiveProductAlias[],
  retiringSourceVersionIds: string[] = [],
): AliasImpact[] {
  const accepted = proposed.filter((p) => p.decision === 'accepted');
  return [...new Set(accepted.map((p) => normalizeProduct(p.phrase)))].sort().map((normalized) => {
    if (!normalized) invalid('Empty normalized alias');
    const beforeProductIds = [
      ...new Set(active.filter((a) => a.normalized === normalized).map((a) => a.productId)),
    ].sort();
    const surviving = active
      .filter(
        (a) =>
          a.normalized === normalized &&
          !retiringSourceVersionIds.includes(a.sourceVersionId ?? ''),
      )
      .map((a) => a.productId);
    const afterProductIds = [
      ...new Set([
        ...surviving,
        ...accepted
          .filter((a) => normalizeProduct(a.phrase) === normalized)
          .map((a) => a.productId),
      ]),
    ].sort();
    return { normalized, beforeProductIds, afterProductIds, collision: afterProductIds.length > 1 };
  });
}
/** Sort semantic rows rather than trusting caller order. Transport/derived fields are excluded. */
export function productKnowledgeHash(review: KnowledgeProductReview): string {
  const sorted = (rows: unknown[]) => rows.map((r) => JSON.stringify(r)).sort();
  const canonical = [
    'PRODUCT_KNOWLEDGE_REVIEW_V1',
    review.versionId,
    review.extractionHash,
    review.revision,
    review.catalogRevision,
    sorted(
      review.links.map((l) => [
        l.id,
        l.passage.chunkId,
        l.passage.start,
        l.passage.end,
        l.productId,
        l.confirmed,
        [...(l.candidateProductIds ?? [])].sort(),
      ]),
    ),
    sorted(
      review.profiles.map((p) => [
        p.productId,
        p.type,
        sorted(
          p.aliases.map((a) => [a.id, a.productId, a.phrase, a.kind, a.lang, a.source, a.decision]),
        ),
      ]),
    ),
    sorted(review.unlinkedPassages.map(passageKey)),
    sorted(review.acknowledgedUnlinkedPassages.map(passageKey)),
    review.emptyKnowledgeAcknowledged,
  ];
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}
