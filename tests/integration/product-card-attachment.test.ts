import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as sql from '@barberhq/server';
import { createKnowledgeHarness } from '../support/knowledge.ts';
import { createAiAdmission } from '../../functions/src/ai/admission.ts';
import { createSqlAiRepository } from '../../functions/src/ai/repository.ts';
import { consumeModelTurn } from '../../functions/src/ai/budget.ts';
import { DocumentCommandService } from '../../functions/src/knowledge/document-commands.ts';
import { ProductKnowledgeCommands } from '../../functions/src/product-knowledge/commands.ts';
import { ProductKnowledgeGeneration } from '../../functions/src/product-knowledge/generation.ts';
import { ReviewPublishService } from '../../functions/src/knowledge/review-publish.ts';
import { processKnowledge } from '../../functions/src/knowledge/worker.ts';
import type { KnowledgeJob } from '../../functions/src/knowledge/queue.ts';
import { createProductAliasCommands } from '../../functions/src/products/aliases.ts';
import { createProductCardService } from '../../functions/src/products/card-attachment.ts';

type H = Awaited<ReturnType<typeof createKnowledgeHarness>>;
describe('Feature: product card attached from the product screen', () => {
  let h: H, hq: string, salon: string, productId: string, jobs: KnowledgeJob[], modelCalls: number;
  beforeEach(async () => {
    h = await createKnowledgeHarness();
    hq = randomUUID();
    salon = randomUUID();
    jobs = [];
    modelCalls = 0;
    await sql.upsertMembership(h.dc, { uid: hq, businessId: h.id, role: sql.MemberRole.HQ });
    await sql.upsertMembership(h.dc, { uid: salon, businessId: h.id, role: sql.MemberRole.SALON });
    await sql.upsertLocation(h.dc, {
      id: `${h.id}:hq`,
      businessId: h.id,
      key: 'hq',
      name: 'HQ',
      kind: sql.LocationKind.HQ,
    });
    productId = `${h.id}:a`;
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
  });
  afterEach(async () => {
    for (const uid of [hq, salon])
      await h?.dc.executeGraphql('mutation($uid:String!){membership_delete(key:{uid:$uid})}', {
        variables: { uid },
      });
    await h?.dispose();
  });
  function service() {
    const products = new ProductKnowledgeCommands(h.repo);
    const pipeline = h.pipeline(h.id);
    return createProductCardService({
      dc: h.dc,
      repo: h.repo,
      documents: new DocumentCommandService(h.repo),
      products,
      generation: new ProductKnowledgeGeneration(
        products,
        createAiAdmission(createSqlAiRepository(h.dc)),
        async (budget, _prompt, kind) => {
          consumeModelTurn(budget);
          modelCalls++;
          if (kind === 'link') return { productIds: [] };
          return {
            type: 'type Y',
            aliases: [
              { phrase: 'akaa', kind: 'phonetic', lang: 'pl' },
              { phrase: 'istniejąca', kind: 'name', lang: 'pl' },
            ],
          };
        },
      ),
      review: new ReviewPublishService({
        repo: h.repo,
        pipeline,
        enqueue: async (job) => void jobs.push(job),
      }),
    });
  }
  /** Stands in for the browser upload + Cloud Tasks extraction of the registered version. */
  async function upload(versionId: string) {
    const sha256 = h.hash(h.bytes);
    const label = versionId.slice(versionId.lastIndexOf(':') + 1);
    const code = versionId.slice(versionId.indexOf(':') + 1, versionId.lastIndexOf(':'));
    const objectPath = `knowledge/${h.id}/${code}/${label}/${sha256}.pdf`;
    await h.repo.bucket
      .file(objectPath)
      .save(Buffer.from(h.bytes), { metadata: { metadata: { sha256 } } } as never);
    await sql.bindKnowledgeOriginal(h.dc, {
      uid: hq,
      businessId: h.id,
      versionId,
      pdfSha256: sha256,
      bucket: 'test-knowledge-bucket',
      objectPath,
      objectGeneration: '1',
      byteSize: h.bytes.length,
      pageCount: 1,
    });
    await h.pipeline(h.id).extractVersion(versionId);
  }
  const attach = () =>
    service().attach(hq, { productId, sha256: h.hash(h.bytes), idempotencyKey: randomUUID() });
  const productRow = async () =>
    (
      await h.dc.executeGraphql<
        { product: { type: string | null }; productAliases: { phrase: string; status: string }[] },
        { id: string }
      >(
        'query($id:String!){product(id:$id){type} productAliases(where:{productId:{eq:$id}}){phrase status}}',
        { variables: { id: productId } },
      )
    ).data;

  it('suggests aliases, publishes a clean card with only a product link, and keeps accepted aliases on withdrawal', async () => {
    await createProductAliasCommands(h.dc).save(hq, {
      productId,
      changes: [{ op: 'add', phrase: 'istniejąca', kind: 'NAME' }],
      idempotencyKey: randomUUID(),
    });
    const attached = await attach();
    expect(attached).toMatchObject({ status: 'UPLOADING' });
    await upload(attached.versionId);
    const processed = await service().process(hq, {
      productId,
      versionId: attached.versionId,
      idempotencyKey: randomUUID(),
    });
    expect(modelCalls).toBe(1);
    expect(processed.status).toBe('PUBLISHING');
    expect(processed.suggestions).toEqual([{ phrase: 'akaa', kind: 'PHONETIC', collisions: [] }]);
    await processKnowledge(jobs.at(-1)!, { repo: h.repo, pipeline: h.pipeline(h.id) });
    expect((await service().state(hq, productId)).status).toBe('PUBLISHED');
    expect(await productRow()).toEqual({
      product: { type: null },
      productAliases: [{ phrase: 'istniejąca', status: 'ACTIVE' }],
    });
    await createProductAliasCommands(h.dc).save(hq, {
      productId,
      changes: [{ op: 'add', phrase: 'akaa', kind: 'PHONETIC' }],
      idempotencyKey: randomUUID(),
    });
    const v = (await h.repo.version(attached.versionId))!;
    await new DocumentCommandService(h.repo).delete(hq, {
      versionId: attached.versionId,
      expectedDocumentRevision: v.document.revision,
      expectedVersionRevision: v.revision,
      idempotencyKey: randomUUID(),
    });
    expect(
      (await productRow()).productAliases
        .filter((a) => a.status === 'ACTIVE')
        .map((a) => a.phrase)
        .sort(),
    ).toEqual(['akaa', 'istniejąca']);
  });

  it('marks a poorly extracted card for review and a second card becomes v2 of the same document', async () => {
    const first = await attach();
    await upload(first.versionId);
    await h.dc.executeGraphql(
      'mutation($v:String!){knowledgePage_updateMany(where:{versionId:{eq:$v}},data:{quality:NEEDS_REVIEW})}',
      {
        variables: { v: first.versionId },
      },
    );
    const processed = await service().process(hq, {
      productId,
      versionId: first.versionId,
      idempotencyKey: randomUUID(),
    });
    expect(processed).toMatchObject({
      status: 'NEEDS_REVIEW',
      suggestions: expect.arrayContaining([expect.objectContaining({ phrase: 'akaa' })]),
    });
    expect(jobs).toEqual([]);
    const second = await attach();
    expect(second.documentId).toBe(first.documentId);
    expect(second.versionId).toBe(`${first.documentId}:v2`);
  });

  it('reports a failed extraction as a terminal card state and resumes a stale generation', async () => {
    const failed = await attach();
    await h.dc.executeGraphql(
      'mutation($v:String!){knowledgeVersion_update(id:$v,data:{status:FAILED,processingError:"EXTRACTION_FAILED"})}',
      { variables: { v: failed.versionId } },
    );
    expect(
      await service().process(hq, {
        productId,
        versionId: failed.versionId,
        idempotencyKey: randomUUID(),
      }),
    ).toMatchObject({ status: 'FAILED', suggestions: [] });
    const second = await attach();
    await upload(second.versionId);
    await h.dc.executeGraphql(
      'mutation($p:String!){productCardAttachment_update(key:{productId:$p},data:{status:"GENERATING",updatedAt:"2020-01-01T00:00:00Z"})}',
      { variables: { p: productId } },
    );
    const resumed = await service().process(hq, {
      productId,
      versionId: second.versionId,
      idempotencyKey: randomUUID(),
    });
    expect(resumed.status).toBe('PUBLISHING');
    expect(modelCalls).toBe(1);
  });
  it('denies salon staff', async () => {
    await expect(
      service().attach(salon, { productId, sha256: h.hash(h.bytes), idempotencyKey: randomUUID() }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(service().state(salon, productId)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
