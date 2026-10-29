import { runWithinBudget, type AiBudget } from '../ai/budget.js';
import * as sql from '@barberhq/server';
import type { DataConnect } from 'firebase-admin/data-connect';
import type {
  ActiveProductAlias,
  KnowledgeCatalogProduct,
  KnowledgeProductReview,
} from '../../../shared/contracts/product-knowledge/index.js';
import { KnowledgeError } from './repository.js';
import type { PassageChunk } from './product-knowledge-rules.js';
export type KnowledgeLinkRow = {
  id: string;
  version_id: string;
  business_id: string;
  product_id: string | null;
  chunk_id: string;
  start: number;
  end: number;
  extraction_hash: string;
  candidate_product_ids: string[];
  method: 'hq' | 'code' | 'model';
  confirmed: boolean;
  created_by: string;
  created_at: string;
};
export type KnowledgeProfileRow = {
  version_id: string;
  business_id: string;
  product_id: string;
  proposed_type: string | null;
  approved_type: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
};
export type KnowledgeAliasRow = {
  id: string;
  business_id: string;
  product_id: string;
  salon_id: null;
  phrase: string;
  normalized: string;
  kind: 'NAME' | 'TYPE' | 'PHONETIC';
  lang: 'pl' | 'en';
  source: 'GENERATED' | 'HQ';
  status: 'PROPOSED' | 'REJECTED' | 'ACTIVE' | 'RETIRED';
  ambiguous: boolean;
  source_document_version_id: string;
  created_by: string;
  created_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  generation_id: string | null;
};
export type ProductOperation = {
  id: string;
  business_id: string;
  version_id: string;
  actor_uid: string;
  idempotency_key: string;
  action: string;
  payload_hash: string;
  result: KnowledgeProductReview | null;
  generation_id: string | null;
  lease_expires_at: string | null;
  completed_at: string | null;
  created_at: string;
};
export type ProductKnowledgeState = {
  versionId: string;
  documentId: string;
  replacesVersionId: string | null;
  businessId: string;
  extractionHash: string | null;
  revision: number;
  catalogRevision: number;
  reviewedHash: string | null;
  state: {
    acknowledgedUnlinkedPassages?: KnowledgeProductReview['acknowledgedUnlinkedPassages'];
    emptyKnowledgeAcknowledged?: boolean;
  } | null;
  kind: string | null;
  status: string;
  pendingStage: string | null;
  publishedAt: string | null;
  revokedAt: string | null;
  links: KnowledgeLinkRow[];
  profiles: KnowledgeProfileRow[];
  aliases: KnowledgeAliasRow[];
  chunks: PassageChunk[];
  operation: ProductOperation | null;
};
export class ProductKnowledgeRepository {
  constructor(readonly dc: DataConnect) {}
  async state(
    uid: string,
    versionId: string,
    key = '',
    budget?: AiBudget,
  ): Promise<ProductKnowledgeState> {
    if (!uid) throw new KnowledgeError('UNAUTHENTICATED');
    const result = (
      await this.bounded(budget, () => sql.productKnowledgeState(this.dc, { uid, versionId, key }))
    ).data.result as ProductKnowledgeState | null;
    if (!result) throw new KnowledgeError('FORBIDDEN');
    if (
      result.links.length > 200 ||
      result.profiles.length > 200 ||
      result.aliases.length > 6400 ||
      result.chunks.length > 300
    )
      throw new KnowledgeError('VALIDATION_ERROR', 'Product knowledge exceeds review limits');
    return result;
  }
  async catalog(
    uid: string,
    versionId: string,
    budget?: AiBudget,
  ): Promise<KnowledgeCatalogProduct[]> {
    const rows: KnowledgeCatalogProduct[] = [];
    let after = '';
    for (;;) {
      const page = (
        await this.bounded(budget, () =>
          sql.productKnowledgeCatalogPage(this.dc, { uid, versionId, after, limit: 100 }),
        )
      ).data.rows as KnowledgeCatalogProduct[];
      rows.push(...page);
      if (rows.length > 200)
        throw new KnowledgeError('VALIDATION_ERROR', 'Catalog exceeds 200 products');
      if (page.length < 100) break;
      after = page.at(-1)!.id;
    }
    return rows;
  }
  async activeAliases(
    uid: string,
    versionId: string,
    budget?: AiBudget,
  ): Promise<ActiveProductAlias[]> {
    const rows: (ActiveProductAlias & { id: string })[] = [];
    let after = '';
    for (;;) {
      const page = (
        await this.bounded(budget, () =>
          sql.productKnowledgeActiveAliasPage(this.dc, { uid, versionId, after, limit: 1000 }),
        )
      ).data.rows as (ActiveProductAlias & { id: string })[];
      rows.push(...page);
      if (rows.length > 5000)
        throw new KnowledgeError('VALIDATION_ERROR', 'Alias provenance exceeds 5000 rows');
      if (page.length < 1000) break;
      after = page.at(-1)!.id;
    }
    return rows;
  }
  async bounded<T>(budget: AiBudget | undefined, work: () => Promise<T>): Promise<T> {
    return budget ? runWithinBudget(budget, work) : work();
  }
  async accept(input: sql.AcceptProductKnowledgeSnapshotVariables): Promise<void> {
    await sql.acceptProductKnowledgeSnapshot(this.dc, input);
  }
  async claim(input: sql.ClaimProductKnowledgeGenerationVariables): Promise<void> {
    await sql.claimProductKnowledgeGeneration(this.dc, input);
  }
  async release(uid: string, generationId: string): Promise<void> {
    await sql.releaseProductKnowledgeGeneration(this.dc, { uid, generationId });
  }
  async save(input: sql.SaveProductKnowledgeSnapshotVariables): Promise<void> {
    await sql.saveProductKnowledgeSnapshot(this.dc, input);
  }
}
