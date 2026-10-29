import { randomUUID } from 'node:crypto';
import * as sql from '@barberhq/server';
import { createKnowledgeHarness } from './knowledge.ts';
import { ProductKnowledgeCommands } from '../../functions/src/product-knowledge/commands.ts';
export async function createProductKnowledgeHarness() {
  const h = await createKnowledgeHarness();
  const hq = randomUUID();
  await sql.upsertMembership(h.dc, { uid: hq, businessId: h.id, role: sql.MemberRole.HQ });
  const productId = `${h.id}:a`;
  await sql.upsertProduct(h.dc, {
    id: productId,
    businessId: h.id,
    demoId: 'a',
    name: 'Product A',
    brand: 'X',
    category: 'type X',
    summaryEn: 'Facts',
    sourceCode: '123',
    netContentMl: 1,
    retailPriceGrosz: 1,
    sourceUrl: 'https://example.com',
    observedOn: '2026-10-27',
  });
  const pipeline = h.pipeline(h.id);
  const versionId = await pipeline.stageVersion(
    { ...h.entry, kind: 'product-catalog', origin: 'synthetic', sourceType: undefined } as never,
    h.bytes,
  );
  await pipeline.extractVersion(versionId);
  await h.dc.executeGraphql(
    'mutation($id:String!){knowledgeVersion_update(id:$id,data:{uploadedAt_expr:"request.time"})}',
    { variables: { id: versionId } },
  );
  const v = (await h.repo.version(versionId))!;
  const passage = { chunkId: v.chunks[0].id, start: 0, end: Math.min(25, v.chunks[0].text.length) };
  const commands = new ProductKnowledgeCommands(h.repo);
  const input = {
    versionId,
    extractionHash: v.extractionHash!,
    expectedReviewRevision: 0,
    idempotencyKey: randomUUID(),
    links: [{ passage, productId, confirmed: true }],
    profiles: [],
    acknowledgedUnlinkedPassages: [],
    emptyKnowledgeAcknowledged: false,
  };
  return {
    ...h,
    hq,
    productId,
    versionId,
    passage,
    input,
    commands,
    async dispose() {
      await h.dc.executeGraphql('mutation($uid:String!){membership_delete(key:{uid:$uid})}', {
        variables: { uid: hq },
      });
      await h.dispose();
    },
  };
}
