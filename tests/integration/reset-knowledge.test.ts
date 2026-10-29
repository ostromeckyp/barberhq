import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as sql from '@barberhq/server';
import { createKnowledgeHarness } from '../support/knowledge.ts';
import { publishHqCard, seedHqAndProduct } from '../support/product-card-fixture.ts';
import { validateSeed } from '../../scripts/prepare-data/catalog.ts';
import { readKnowledgeSeed, type KnowledgeSeed } from '../../scripts/seed/knowledge-seed.ts';
import { rebuildKnowledge, type RebuildDeps } from '../../scripts/seed/knowledge.ts';
import { extractPdf } from '../../functions/src/knowledge/extract.ts';

type H = Awaited<ReturnType<typeof createKnowledgeHarness>>;
const businessSeed = validateSeed(JSON.parse(readFileSync('data/seed/business.json', 'utf8')));

/** The repo seed; any entry without a receipt gets a test approval (none in the real seed). */
async function seedWithReceipts(): Promise<KnowledgeSeed> {
  const seed = await readKnowledgeSeed();
  for (const e of seed.entries) {
    if (e.receipt) continue;
    const extraction = await extractPdf(e.bytes);
    e.receipt = {
      actor: { kind: 'operator', id: 'test@example.invalid', businessId: e.businessKey },
      review: {
        versionId: `${e.businessKey}:${e.documentId}:${e.version}`,
        pdfSha256: e.sha256,
        extractionHash: extraction.extractionHash,
        reviewedPhysicalPages: extraction.pages.map((p) => p.physicalPage),
        approvalText: 'Test approval',
        approvedAt: '2026-10-29',
      },
    };
  }
  return seed;
}

describe('Feature: full demo reset rebuilds knowledge from the repo', () => {
  let h: H, seed: KnowledgeSeed, embedCalls: number, failOnCall: number | null;
  const deps = (): RebuildDeps => ({
    dc: h.dc,
    repo: h.repo,
    embedder: {
      config: h.config,
      embedTexts: async (texts) => {
        embedCalls++;
        if (failOnCall === embedCalls) throw new Error('provider down');
        return texts.map(() => h.makeVector(0.8, 0.6));
      },
    },
    businessId: h.id,
    businessSeed,
    seed,
  });
  const state = async () =>
    (
      await h.dc.executeGraphql<
        {
          knowledgeDocuments: { documentCode: string; activeVersionId: string | null }[];
          knowledgeVersions: {
            id: string;
            objectPath: string;
            objectGeneration: string;
            pdfSha256: string;
            isActive: boolean;
            publicationStatus: string;
          }[];
          productCardAttachments: {
            productId: string;
            versionId: string;
            status: string;
            suggestions: unknown;
          }[];
          deliveryProcedureBindings: { kind: string; documentId: string | null }[];
        },
        { b: string }
      >(
        `query($b:String!){
          knowledgeDocuments(where:{businessId:{eq:$b}},orderBy:{documentCode:ASC}){documentCode activeVersionId}
          knowledgeVersions(where:{businessId:{eq:$b}},orderBy:{id:ASC}){id objectPath objectGeneration pdfSha256 isActive publicationStatus}
          productCardAttachments(where:{businessId:{eq:$b}},orderBy:{productId:ASC}){productId versionId status suggestions}
          deliveryProcedureBindings(where:{businessId:{eq:$b}},orderBy:{kind:ASC}){kind documentId}
        }`,
        { variables: { b: h.id } },
      )
    ).data;

  const seededBindings = () =>
    seed.entries
      .filter((e) => e.deliveryProblemKind)
      .map((e) => ({ kind: e.deliveryProblemKind, documentId: `${h.id}:${e.documentId}` }))
      .sort((a, b) => a.kind!.localeCompare(b.kind!));
  beforeEach(async () => {
    h = await createKnowledgeHarness();
    seed = await seedWithReceipts();
    embedCalls = 0;
    failOnCall = null;
    for (const p of businessSeed.products)
      await sql.upsertProduct(h.dc, {
        id: `${h.id}:${p.demoId}`,
        businessId: h.id,
        demoId: p.demoId,
        name: p.name,
        brand: p.brand,
        category: p.category,
        summaryEn: p.summaryEn,
        sourceCode: p.sourceCode,
        netContentMl: p.netContent.value,
        retailPriceGrosz: p.retailPriceGrosz,
        sourceUrl: p.sourceUrl,
        observedOn: p.observedOn,
      });
  });
  afterEach(async () => {
    await h?.dispose();
  });

  async function expectBaseline() {
    const s = await state();
    const codes = [...new Set(seed.entries.map((e) => e.documentId))].sort();
    expect(s.knowledgeDocuments.map((d) => d.documentCode)).toEqual(codes);
    expect(s.knowledgeVersions).toHaveLength(seed.entries.length);
    for (const v of s.knowledgeVersions) {
      const entry = seed.entries.find((e) => v.id === `${h.id}:${e.documentId}:${e.version}`)!;
      expect(v.pdfSha256).toBe(entry.sha256);
      expect(
        h.originalBytes(v.objectPath, v.objectGeneration).equals(Buffer.from(entry.bytes)),
      ).toBe(true);
      expect(v.isActive).toBe(entry.publicationStatus === 'demo-current');
    }
    const cards = seed.entries.filter((e) => e.kind === 'product-card');
    expect(s.productCardAttachments).toEqual(
      cards
        .map((e) => ({
          productId: `${h.id}:${e.productDemoId}`,
          versionId: `${h.id}:${e.documentId}:${e.version}`,
          status: 'PUBLISHED',
          suggestions: [],
        }))
        .sort((a, b) => a.productId.localeCompare(b.productId)),
    );
    const hits = await h.repo.search(h.id, h.makeVector(0.8, 0.6), h.config.configHash);
    expect(hits.length).toBeGreaterThan(0);
    return s;
  }

  it('full reset leaves exactly the manifest documents, cards linked to products', async () => {
    const { hq, productId } = await seedHqAndProduct(h, 'extra');
    await publishHqCard(h, hq, productId);
    const result = await rebuildKnowledge(deps(), false);
    expect(result.ingested).toHaveLength(seed.entries.length);
    expect(result.cards).toBe(6);
    await expectBaseline();
    expect(h.objectPaths().filter((p) => p.includes('/CARD-A') || p.includes(productId))).toEqual(
      [],
    );
  });

  it('repairs a manually deleted storage object and binds procedures as seeded', async () => {
    await rebuildKnowledge(deps(), false);
    // HQ rebinds DAMAGED to another procedure; the reset returns to the seeded binding.
    await h.dc.executeGraphql(
      'mutation($b:String!,$d:String!){deliveryProcedureBinding_upsert(data:{businessId:$b,kind:DAMAGED,documentId:$d,revision:7})}',
      { variables: { b: h.id, d: `${h.id}:REP-001` } },
    );
    const victim = (await state()).knowledgeVersions[0];
    await h.bucket.file(victim.objectPath).delete();
    await rebuildKnowledge(deps(), false);
    const s = await expectBaseline();
    expect(s.deliveryProcedureBindings).toEqual(seededBindings());
  });

  it('a failed rebuild completes on rerun', async () => {
    failOnCall = 3;
    await expect(rebuildKnowledge(deps(), false)).rejects.toThrow();
    failOnCall = null;
    await rebuildKnowledge(deps(), false);
    expect((await expectBaseline()).deliveryProcedureBindings).toEqual(seededBindings());
  });

  it('preflight failure deletes nothing', async () => {
    await rebuildKnowledge(deps(), false);
    const before = await state();
    const objects = h.objectPaths();
    seed.entries.find((e) => e.documentId === 'REP-001')!.receipt = null;
    await expect(rebuildKnowledge(deps(), false)).rejects.toThrow(
      'KNOWLEDGE_SEED_INVALID: REP-001 v1: RECEIPT_MISSING',
    );
    expect(await state()).toEqual(before);
    expect(h.objectPaths()).toEqual(objects);
  });

  it('rerun is idempotent in outcome', async () => {
    await rebuildKnowledge(deps(), false);
    const first = await state();
    await rebuildKnowledge(deps(), false);
    const second = await state();
    expect(second.knowledgeDocuments).toEqual(first.knowledgeDocuments);
    expect(second.productCardAttachments).toEqual(first.productCardAttachments);
  });

  it('dry-run reports wipe counts, entries and embedding text count without writes', async () => {
    await rebuildKnowledge(deps(), false);
    const before = await state();
    embedCalls = 0;
    const result = await rebuildKnowledge(deps(), true);
    expect(result.wiped.documents).toBe(before.knowledgeDocuments.length);
    expect(result.ingested).toEqual([]);
    expect(result.planned).toHaveLength(seed.entries.length);
    expect(result.embeddingTexts).toBeGreaterThan(0);
    expect(embedCalls).toBe(0);
    expect(await state()).toEqual(before);
  });
});
