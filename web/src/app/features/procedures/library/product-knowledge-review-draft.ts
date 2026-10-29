import type {
  AliasProposal,
  KnowledgePassageRef,
  KnowledgeProductReview,
  ProductProfileProposal,
  SaveKnowledgeProductReviewInput,
} from '../../../../../../shared/contracts/product-knowledge/index';

/** Edits HQ makes to a local product review draft before saving it. */
export function passageKey(p: KnowledgePassageRef) {
  return JSON.stringify([p.chunkId, p.start, p.end]);
}
export function linkPassage(
  r: KnowledgeProductReview,
  passage: KnowledgePassageRef,
  productId: string,
): void {
  r.links.push({
    id: `draft:${crypto.randomUUID()}`,
    passage,
    productId,
    method: 'hq',
    confirmed: true,
  });
  r.acknowledgedUnlinkedPassages = [];
}
export function changeLink(
  r: KnowledgeProductReview,
  id: string,
  productId: string,
  confirmed: boolean,
): void {
  const l = r.links.find((l) => l.id === id);
  if (l) {
    l.productId = productId || null;
    l.confirmed = confirmed && !!productId;
  }
  const supported = new Set(r.links.filter((link) => link.confirmed).map((link) => link.productId));
  r.profiles = r.profiles.filter((profile) => supported.has(profile.productId));
  r.acknowledgedUnlinkedPassages = [];
}
export function removeLink(r: KnowledgeProductReview, id: string): void {
  r.links = r.links.filter((l) => l.id !== id);
  const ids = new Set(r.links.filter((l) => l.confirmed).map((l) => l.productId));
  r.profiles = r.profiles.filter((p) => ids.has(p.productId));
  r.acknowledgedUnlinkedPassages = [];
}
export function profileOf(r: KnowledgeProductReview, id: string): ProductProfileProposal {
  let p = r.profiles.find((p) => p.productId === id);
  if (!p) {
    p = { productId: id, type: null, aliases: [] };
    r.profiles.push(p);
  }
  return p;
}
export function addAlias(r: KnowledgeProductReview, id: string): void {
  profileOf(r, id).aliases.push({
    id: `draft:${crypto.randomUUID()}`,
    productId: id,
    phrase: '',
    kind: 'name',
    lang: 'pl',
    source: 'hq',
    decision: 'pending',
  });
}
export function editAlias(
  r: KnowledgeProductReview,
  id: string,
  aliasId: string,
  patch: Partial<Pick<AliasProposal, 'phrase' | 'kind' | 'lang' | 'decision'>>,
): void {
  const a = profileOf(r, id).aliases.find((a) => a.id === aliasId);
  if (a) Object.assign(a, patch);
}
export function acknowledgePassage(
  r: KnowledgeProductReview,
  ref: KnowledgePassageRef,
  checked: boolean,
): void {
  r.acknowledgedUnlinkedPassages = r.acknowledgedUnlinkedPassages.filter(
    (p) => passageKey(p) !== passageKey(ref),
  );
  if (checked) r.acknowledgedUnlinkedPassages.push(ref);
}
export function saveReviewInput(r: KnowledgeProductReview): SaveKnowledgeProductReviewInput {
  return {
    versionId: r.versionId,
    extractionHash: r.extractionHash,
    expectedReviewRevision: r.revision,
    idempotencyKey: crypto.randomUUID(),
    links: r.links.map((l) => ({
      ...(!l.id.startsWith('draft:') ? { id: l.id } : {}),
      passage: l.passage,
      productId: l.productId,
      confirmed: l.confirmed,
    })),
    profiles: r.profiles.map((p) => ({
      productId: p.productId,
      type: p.type,
      aliases: p.aliases.map((a) => ({
        ...(!a.id.startsWith('draft:') ? { id: a.id } : {}),
        phrase: a.phrase,
        kind: a.kind,
        lang: a.lang,
        decision: a.decision,
      })),
    })),
    acknowledgedUnlinkedPassages: r.acknowledgedUnlinkedPassages,
    emptyKnowledgeAcknowledged: r.emptyKnowledgeAcknowledged,
  };
}
