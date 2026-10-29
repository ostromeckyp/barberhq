import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createKnowledgeHarness } from '../support/knowledge.ts';
import { publishHqCard, seedHqAndProduct } from '../support/product-card-fixture.ts';
import { wipeKnowledge } from '../../scripts/seed/knowledge-wipe.ts';

type H = Awaited<ReturnType<typeof createKnowledgeHarness>>;
const ROWS = `query($b:String!,$v:[String!]){
  knowledgeDocuments(where:{businessId:{eq:$b}}){id}
  knowledgeVersions(where:{businessId:{eq:$b}}){id}
  knowledgePages(where:{versionId:{in:$v}}){physicalPage}
  knowledgeChunks(where:{versionId:{in:$v}}){id}
  knowledgeOperations(where:{businessId:{eq:$b}}){id}
  knowledgeProductLinks(where:{businessId:{eq:$b}}){id}
  knowledgeProductProfiles(where:{businessId:{eq:$b}}){productId}
  productKnowledgeOperations(where:{businessId:{eq:$b}}){id}
  productCardAttachments(where:{businessId:{eq:$b}}){productId}
  productAliases(where:{businessId:{eq:$b}},orderBy:{id:ASC}){id source revision status}
  products(where:{businessId:{eq:$b}}){type typeSourceVersionId seedType}
  business(id:$b){productKnowledgeRevision}
}`;
type Rows = Record<string, unknown[]> & {
  productAliases: { id: string; source: string; revision: number; status: string }[];
  products: { type: string | null; typeSourceVersionId: string | null; seedType: string | null }[];
  business: { productKnowledgeRevision: number };
};

describe('Feature: knowledge wipe for the demo reset', () => {
  let h: H, versionIds: string[], foreignVersion: string;
  const rows = async (businessId: string, v = versionIds) =>
    (
      await h.dc.executeGraphql<Rows, { b: string; v: string[] }>(ROWS, {
        variables: { b: businessId, v },
      })
    ).data;
  beforeEach(async () => {
    h = await createKnowledgeHarness();
    const { hq, productId } = await seedHqAndProduct(h);
    // A procedure published by the operator pipeline.
    const pipeline = h.pipeline(h.id);
    const procedure = await pipeline.stageVersion(
      { ...h.entry, businessKey: 'not-bad-stuff-demo' },
      h.bytes,
    );
    await pipeline.extractVersion(procedure);
    // A card HQ attached in the UI, plus a document-sourced alias and type assertion.
    const card = await publishHqCard(h, hq, productId);
    versionIds = [procedure, card];
    for (const [source, sourceDocumentVersionId, phrase] of [
      ['SEED', null, 'seeded'],
      ['GENERATED', card, 'from card'],
    ] as const)
      await h.dc.executeGraphql(`mutation($d:ProductAlias_Data!){productAlias_insert(data:$d)}`, {
        variables: {
          d: {
            id: randomUUID(),
            businessId: h.id,
            productId,
            phrase,
            normalized: phrase,
            kind: 'NAME',
            lang: 'pl',
            source,
            status: 'ACTIVE',
            ambiguous: false,
            sourceDocumentVersionId,
            createdBy: 'test',
            createdAt: new Date().toISOString(),
          },
        },
      });
    await h.dc.executeGraphql(
      'mutation($id:String!,$v:String!){product_update(id:$id,data:{type:"from card",typeSourceVersionId:$v,seedType:"seeded type"})}',
      { variables: { id: productId, v: card } },
    );
    // Another business keeps its knowledge.
    const foreign = h.pipeline(h.foreignId);
    foreignVersion = await foreign.stageVersion(h.entry, h.bytes).catch(async () => {
      throw new Error('foreign fixture failed');
    });
  });
  afterEach(async () => {
    await h?.dispose();
  });

  it('wipes every knowledge row of the business and keeps seed aliases', async () => {
    const before = await rows(h.id);
    const seedBefore = before.productAliases.filter((a) => a.source === 'SEED');
    expect(before.knowledgeVersions).toHaveLength(2);
    expect(before.productCardAttachments).toHaveLength(1);
    expect(before.knowledgeProductLinks.length).toBeGreaterThan(0);

    const counts = await wipeKnowledge(h.dc, h.bucket as never, h.id, false);

    expect(counts).toMatchObject({
      documents: 2,
      versions: 2,
      cardAttachments: 1,
      documentAliases: 1,
    });
    expect(counts.storageObjects).toBe(2);
    const after = await rows(h.id);
    for (const key of [
      'knowledgeDocuments',
      'knowledgeVersions',
      'knowledgePages',
      'knowledgeChunks',
      'knowledgeOperations',
      'knowledgeProductLinks',
      'knowledgeProductProfiles',
      'productKnowledgeOperations',
      'productCardAttachments',
    ])
      expect(after[key], key).toEqual([]);
    expect(after.productAliases).toEqual(seedBefore);
    expect(after.products).toEqual([
      { type: 'seeded type', typeSourceVersionId: null, seedType: 'seeded type' },
    ]);
    expect(after.business.productKnowledgeRevision).toBe(
      before.business.productKnowledgeRevision + 1,
    );
    expect(h.objectPaths().filter((p) => p.startsWith(`knowledge/${h.id}/`))).toEqual([]);
    expect(h.objectPaths().some((p) => p.startsWith(`knowledge/${h.foreignId}/`))).toBe(true);
    expect((await rows(h.foreignId, [foreignVersion])).knowledgeVersions).toHaveLength(1);
  });

  it('dry-run counts without deleting', async () => {
    const before = await rows(h.id);
    const objects = h.objectPaths();
    const counts = await wipeKnowledge(h.dc, h.bucket as never, h.id, true);
    expect(counts).toMatchObject({
      documents: 2,
      versions: 2,
      cardAttachments: 1,
      storageObjects: 2,
    });
    expect(await rows(h.id)).toEqual(before);
    expect(h.objectPaths()).toEqual(objects);
  });
});
