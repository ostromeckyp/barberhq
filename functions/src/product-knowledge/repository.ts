import { runWithinBudget } from '../ai/budget.js';
import type { AiBudget } from '../ai/models/ai-budget.js';
import * as sql from '@barberhq/server';
import type { DataConnect } from 'firebase-admin/data-connect';
import type {
  ActiveProductAlias,
  KnowledgeCatalogProduct,
} from '../../../shared/contracts/product-knowledge/index.js';
import { KnowledgeError } from '../knowledge/repository.js';
import type { ProductKnowledgeState } from './models/product-knowledge-state.js';
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
