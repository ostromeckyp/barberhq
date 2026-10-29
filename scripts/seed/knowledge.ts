import type { DataConnect } from 'firebase-admin/data-connect';
import type { BusinessSeed } from '../../shared/contracts/business/index.ts';
import {
  KnowledgePipeline,
  knowledgeIds,
  type Embedder,
} from '../../functions/src/knowledge/pipeline.ts';
import type { KnowledgeRepository } from '../../functions/src/knowledge/repository.ts';
import { checkKnowledgeSeed, readKnowledgeSeed, type KnowledgeSeed } from './knowledge-seed.ts';
import { wipeKnowledge, type WipeCounts } from './knowledge-wipe.ts';

export type RebuildDeps = {
  dc: DataConnect;
  repo: KnowledgeRepository;
  embedder: Embedder;
  businessId: string;
  businessSeed: BusinessSeed;
  /** Defaults to the repo manifest and approval receipts. */
  seed?: KnowledgeSeed;
};
export type RebuildResult = {
  wiped: WipeCounts;
  /** Manifest entries the run would rebuild (dry-run) or `<code> <version>` it rebuilt. */
  planned: string[];
  ingested: string[];
  cards: number;
  embeddingTexts: number;
};

/**
 * Brings the business's knowledge to the repo baseline: preflight, wipe (DB + Storage), then
 * stage → extract → owner-approved review → product review → publish for every manifest entry,
 * each card attached to its product and each delivery problem bound to its seeded procedure.
 * A failed run is completed by running it again; preflight fails before anything is deleted.
 */
export async function rebuildKnowledge(deps: RebuildDeps, dryRun: boolean): Promise<RebuildResult> {
  const { dc, repo, businessId } = deps;
  const seed = deps.seed ?? (await readKnowledgeSeed());
  const { problems, embeddingTexts } = await checkKnowledgeSeed(seed, deps.businessSeed);
  if (problems.length) throw new Error(`KNOWLEDGE_SEED_INVALID: ${problems.join('; ')}`);
  const planned = seed.entries.map((e) => `${e.documentId} ${e.version}`);
  const wiped = await wipeKnowledge(dc, repo.bucket as never, businessId, dryRun);
  if (dryRun) return { wiped, planned, ingested: [], cards: 0, embeddingTexts };

  const businessKeys = new Set(seed.entries.map((e) => e.businessKey));
  if (businessKeys.size !== 1) throw new Error('KNOWLEDGE_SEED_INVALID: one business key');
  const pipeline = new KnowledgePipeline(repo, deps.embedder, businessId, [...businessKeys][0]);
  const ingested: string[] = [];
  let cards = 0;
  for (const e of seed.entries) {
    const at = `${e.documentId} ${e.version}`;
    const versionId = await pipeline.stageVersion(e, e.bytes);
    await pipeline.extractVersion(versionId);
    const version = await repo.version(versionId);
    const receipt = e.receipt!;
    if (version?.extractionHash !== receipt.review.extractionHash)
      throw new Error(`KNOWLEDGE_EXTRACTION_CHANGED: ${at}`);
    // The receipt approves this manifest version; it is applied to the target business's copy.
    await pipeline.recordReview({ ...receipt.review, versionId }, { ...receipt.actor, businessId });
    const productId = e.productDemoId ? `${businessId}:${e.productDemoId}` : null;
    if (e.kind === 'product-card' || e.kind === 'product-catalog')
      await pipeline.recordOperatorProductReview({ versionId, productId });
    if (e.publicationStatus === 'demo-current') {
      const { documentId } = knowledgeIds(businessId, e.documentId, e.version);
      const document = await repo.document(documentId);
      await pipeline.publishVersion({
        versionId,
        expectedDocumentRevision: document!.revision,
      });
    }
    if (productId) {
      await dc.executeMutation('SeedProductCardAttachment', {
        businessId,
        productId,
        documentId: version.documentId,
        versionId,
      });
      cards++;
    }
    ingested.push(at);
  }
  // Delivery problem kinds are bound to the seeded procedures (same ids on every run).
  const bindings = seed.entries
    .filter((e) => e.deliveryProblemKind)
    .map((e) => ({
      kind: e.deliveryProblemKind!,
      document_id: knowledgeIds(businessId, e.documentId, e.version).documentId,
    }));
  await dc.executeMutation('SeedDeliveryProcedureBindings', {
    businessId,
    bindingsJson: JSON.stringify(bindings),
    expectedCount: bindings.length,
  });
  return { wiped, planned, ingested, cards, embeddingTexts };
}
