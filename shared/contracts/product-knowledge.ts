/** Version-bound product knowledge. Scope and provenance are assigned by the server. */
export type ProductAliasKind = 'name' | 'type' | 'phonetic';
export type ProductAliasSource = 'generated' | 'hq' | 'salon-confirmed' | 'seed';
export type ProductAliasStatus = 'proposed' | 'active' | 'rejected' | 'retired';
export type KnowledgePassageRef = { chunkId: string; start: number; end: number };
export type KnowledgeProductLink = {
  id: string;
  passage: KnowledgePassageRef;
  productId: string | null;
  candidateProductIds?: string[];
  method: 'code' | 'model' | 'hq';
  confirmed: boolean;
};
export type AliasProposal = {
  id: string;
  productId: string;
  phrase: string;
  kind: ProductAliasKind;
  lang: 'pl' | 'en';
  source: 'generated' | 'hq';
  decision: 'pending' | 'accepted' | 'rejected';
};
export type ProductProfileProposal = {
  productId: string;
  type: string | null;
  aliases: AliasProposal[];
};
export type KnowledgeCatalogProduct = {
  id: string;
  name: string;
  sourceCode: string;
  type: string | null;
  category: string;
  summaryEn: string;
  scentPl: string | null;
};
export type KnowledgePassage = { ref: KnowledgePassageRef; text: string; physicalPage: number };
export type LinkSuggestion = {
  passage: KnowledgePassageRef;
  productIds: string[];
  method: 'code' | 'model';
  confirmed: false;
};
export type AliasImpact = {
  normalized: string;
  beforeProductIds: string[];
  afterProductIds: string[];
  collision: boolean;
};
export type ActiveProductAlias = {
  productId: string;
  normalized: string;
  kind: ProductAliasKind;
  lang: 'pl' | 'en';
  sourceVersionId: string | null;
};
export type KnowledgeProductReview = {
  versionId: string;
  extractionHash: string;
  revision: number;
  catalogRevision: number;
  links: KnowledgeProductLink[];
  profiles: ProductProfileProposal[];
  unlinkedPassages: KnowledgePassageRef[];
  impact: AliasImpact[];
  reviewedHash: string | null;
  acknowledgedUnlinkedPassages: KnowledgePassageRef[];
  emptyKnowledgeAcknowledged: boolean;
};
export type KnowledgeProductLinkEdit = {
  id?: string;
  passage: KnowledgePassageRef;
  productId: string | null;
  confirmed: boolean;
};
export type ProductAliasEdit = Pick<AliasProposal, 'phrase' | 'kind' | 'lang' | 'decision'> & {
  id?: string;
};
export type SaveKnowledgeProductReviewInput = {
  versionId: string;
  extractionHash: string;
  expectedReviewRevision: number;
  idempotencyKey: string;
  links: KnowledgeProductLinkEdit[];
  profiles: { productId: string; type: string | null; aliases: ProductAliasEdit[] }[];
  acknowledgedUnlinkedPassages: KnowledgePassageRef[];
  emptyKnowledgeAcknowledged: boolean;
};
export type AcceptKnowledgeProductReviewInput = {
  versionId: string;
  extractionHash: string;
  expectedReviewRevision: number;
  expectedCatalogRevision: number;
  idempotencyKey: string;
};
export type SuggestKnowledgeProductLinkInput = {
  versionId: string;
  extractionHash: string;
  expectedReviewRevision: number;
  passage: KnowledgePassageRef;
  idempotencyKey: string;
};
export type GenerateKnowledgeProductAliasesInput = {
  versionId: string;
  extractionHash: string;
  expectedReviewRevision: number;
  productId: string;
  idempotencyKey: string;
};
export type ProductAliasGeneration = {
  type: string | null;
  aliases: Pick<AliasProposal, 'phrase' | 'kind' | 'lang'>[];
};

export type KnowledgeProductWorkspace = {
  kind?: 'product-card' | 'product-catalog';
  review: KnowledgeProductReview;
  catalog: KnowledgeCatalogProduct[];
  passages: KnowledgePassage[];
  readOnly: boolean;
};
