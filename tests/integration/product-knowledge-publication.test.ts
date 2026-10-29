import { randomUUID } from 'node:crypto';
import { beforeEach, afterEach, it, expect } from 'vitest';
import { createProductKnowledgeHarness } from '../support/product-knowledge.ts';
import { ReviewPublishService } from '../../functions/src/knowledge/review-publish.ts';
import { DocumentCommandService } from '../../functions/src/knowledge/document-commands.ts';
import { processKnowledge } from '../../functions/src/knowledge/worker.ts';
import type { KnowledgeJob } from '../../functions/src/knowledge/models/knowledge-job.ts';
let h: Awaited<ReturnType<typeof createProductKnowledgeHarness>>, jobs: KnowledgeJob[];
beforeEach(async () => {
  h = await createProductKnowledgeHarness();
  jobs = [];
});
afterEach(async () => {
  await h?.dispose();
});
async function saved(versionId = h.versionId, phrase = 'Alpha', type: string | null = 'type X') {
  await h.dc.executeGraphql(
    'mutation($id:String!){knowledgeVersion_update(id:$id,data:{uploadedAt_expr:"request.time"})}',
    { variables: { id: versionId } },
  );
  const v = (await h.repo.version(versionId))!;
  const ref = { chunkId: v.chunks[0].id, start: 0, end: v.chunks[0].text.length };
  const first = await h.commands.save(h.hq, {
    ...h.input,
    idempotencyKey: randomUUID(),
    versionId,
    extractionHash: v.extractionHash!,
    links: [{ passage: ref, productId: h.productId, confirmed: true }],
    profiles: [
      {
        productId: h.productId,
        type,
        aliases: [{ phrase, kind: 'name', lang: 'pl', decision: 'accepted' }],
      },
    ],
  });
  return await h.commands.save(h.hq, {
    ...h.input,
    versionId,
    extractionHash: v.extractionHash!,
    expectedReviewRevision: first.revision,
    idempotencyKey: randomUUID(),
    links: first.links.map(({ id, passage, productId, confirmed }) => ({
      id,
      passage,
      productId,
      confirmed,
    })),
    profiles: first.profiles.map((p) => ({
      ...p,
      aliases: p.aliases.map((a) => ({
        id: a.id,
        phrase: a.phrase,
        kind: a.kind,
        lang: a.lang,
        decision: a.decision,
      })),
    })),
    acknowledgedUnlinkedPassages: first.unlinkedPassages,
  });
}
async function accepted(versionId = h.versionId, phrase = 'Alpha', type: string | null = 'type X') {
  const review = await saved(versionId, phrase, type);
  return h.commands.accept(h.hq, {
    versionId,
    extractionHash: review.extractionHash,
    expectedReviewRevision: review.revision,
    expectedCatalogRevision: review.catalogRevision,
    idempotencyKey: randomUUID(),
  });
}
async function publish(versionId: string, productHash?: string) {
  const v = (await h.repo.version(versionId))!;
  const service = new ReviewPublishService({
    repo: h.repo,
    pipeline: h.pipeline(h.id),
    enqueue: async (job) => {
      jobs.push(job);
    },
  });
  await service.reviewAndPublishDocument(h.hq, {
    versionId,
    extractionHash: v.extractionHash!,
    reviewedPhysicalPages: v.pages.map((p) => p.physicalPage),
    expectedDocumentRevision: v.document.revision,
    idempotencyKey: randomUUID(),
    ...(productHash ? { productKnowledgeReviewedHash: productHash } : {}),
  });
  return service;
}
async function runJob() {
  const job = jobs.at(-1)!;
  return processKnowledge(job, { repo: h.repo, pipeline: h.pipeline(h.id) });
}
async function aliases() {
  return (
    await h.dc.executeGraphql<
      {
        productAliases: { phrase: string; status: string; sourceDocumentVersionId: string }[];
        product: { type: string | null; typeSourceVersionId: string | null };
      },
      { id: string; productId: string }
    >(
      'query($id:String!,$productId:String!){productAliases(where:{businessId:{eq:$id}}){phrase status sourceDocumentVersionId}product(id:$productId){type typeSourceVersionId}}',
      { variables: { id: h.id, productId: h.productId } },
    )
  ).data;
}
it('activates only through accepted review plus atomic document publication and preserves PDF evidence', async () => {
  const before = (await h.repo.version(h.versionId))!;
  const review = await accepted();
  expect(review.reviewedHash).toMatch(/^[a-f0-9]{64}$/);
  expect((await aliases()).productAliases[0].status).toBe('PROPOSED');
  await publish(h.versionId, review.reviewedHash!);
  await runJob();
  expect(await aliases()).toMatchObject({
    productAliases: [{ phrase: 'Alpha', status: 'ACTIVE', sourceDocumentVersionId: h.versionId }],
    product: { type: 'type X', typeSourceVersionId: h.versionId },
  });
  const after = (await h.repo.version(h.versionId))!;
  expect(after.chunks).toEqual(before.chunks);
  expect(after.objectGeneration).toBe(before.objectGeneration);
  expect(after.pdfSha256).toBe(before.pdfSha256);
  expect(after.document.activeVersionId).toBe(h.versionId);
  await runJob();
  expect((await aliases()).productAliases).toHaveLength(1);
});
it('rejects fresh PDF-only product reviews without allocating a receipt', async () => {
  await expect(publish(h.versionId)).rejects.toMatchObject({ code: 'PRODUCT_REVIEW_REQUIRED' });
  const result = await h.dc.executeGraphql<
    { knowledgeOperations: { id: string }[] },
    { id: string }
  >('query($id:String!){knowledgeOperations(where:{versionId:{eq:$id},action:{eq:REVIEW}}){id}}', {
    variables: { id: h.versionId },
  });
  expect(result.data.knowledgeOperations).toEqual([]);
});
it('invalidates accepted knowledge after manual changes', async () => {
  const acceptedReview = await accepted();
  await h.commands.save(h.hq, {
    ...h.input,
    expectedReviewRevision: acceptedReview.revision,
    idempotencyKey: randomUUID(),
    links: [],
    profiles: [],
  });
  await expect(publish(h.versionId, acceptedReview.reviewedHash!)).rejects.toMatchObject({
    code: 'STALE_STATE',
  });
  expect((await aliases()).product?.type).toBeNull();
});
it('requires complete decisions and unlinked acknowledgements, but permits explicit empty catalogs', async () => {
  const partial = await h.commands.save(h.hq, h.input);
  await expect(
    h.commands.accept(h.hq, {
      versionId: h.versionId,
      extractionHash: partial.extractionHash,
      expectedReviewRevision: 1,
      expectedCatalogRevision: partial.catalogRevision,
      idempotencyKey: randomUUID(),
    }),
  ).rejects.toMatchObject({ code: 'REVIEW_INCOMPLETE' });
  const empty = await h.commands.save(h.hq, {
    ...h.input,
    expectedReviewRevision: 1,
    idempotencyKey: randomUUID(),
    links: [],
    profiles: [],
    emptyKnowledgeAcknowledged: true,
  });
  const ack = await h.commands.save(h.hq, {
    ...h.input,
    expectedReviewRevision: 2,
    idempotencyKey: randomUUID(),
    links: [],
    profiles: [],
    emptyKnowledgeAcknowledged: true,
    acknowledgedUnlinkedPassages: empty.unlinkedPassages,
  });
  expect(
    (
      await h.commands.accept(h.hq, {
        versionId: h.versionId,
        extractionHash: ack.extractionHash,
        expectedReviewRevision: 3,
        expectedCatalogRevision: ack.catalogRevision,
        idempotencyKey: randomUUID(),
      })
    ).reviewedHash,
  ).not.toBeNull();
});
it('keeps other source provenance and falls back to its approved type after withdrawal', async () => {
  const first = await accepted();
  await publish(h.versionId, first.reviewedHash!);
  await runJob();
  const secondId = await h.pipeline(h.id).stageVersion(
    {
      ...h.entry,
      documentId: 'SECOND',
      kind: 'product-catalog',
      origin: 'synthetic',
      sourceType: undefined,
    } as never,
    h.bytes,
  );
  await h.pipeline(h.id).extractVersion(secondId);
  const second = await accepted(secondId, 'Alpha', 'type Y');
  await publish(secondId, second.reviewedHash!);
  await runJob();
  expect((await aliases()).product?.type).toBe('type Y');
  const v = (await h.repo.version(secondId))!;
  await new DocumentCommandService(h.repo).delete(h.hq, {
    versionId: secondId,
    expectedDocumentRevision: v.document.revision,
    expectedVersionRevision: v.revision,
    idempotencyKey: randomUUID(),
  });
  expect(await aliases()).toMatchObject({
    productAliases: expect.arrayContaining([
      { phrase: 'Alpha', status: 'ACTIVE', sourceDocumentVersionId: h.versionId },
      { phrase: 'Alpha', status: 'RETIRED', sourceDocumentVersionId: secondId },
    ]),
    product: { type: 'type X', typeSourceVersionId: h.versionId },
  });
});
it('rejects a fresh operator PDF-only product intent but can finish a previously committed one', async () => {
  const v = (await h.repo.version(h.versionId))!;
  await h.pipeline(h.id).recordReview(
    {
      versionId: h.versionId,
      pdfSha256: v.pdfSha256,
      extractionHash: v.extractionHash!,
      reviewedPhysicalPages: v.pages.map((p) => p.physicalPage),
      approvalText: 'Legacy fixture',
      approvedAt: new Date().toISOString(),
    },
    { kind: 'operator', id: 'fixture', businessId: h.id },
  );
  await expect(
    h
      .pipeline(h.id)
      .publishVersion({ versionId: h.versionId, expectedDocumentRevision: v.document.revision }),
  ).rejects.toBeDefined();
  const ready = (await h.repo.version(h.versionId))!;
  await h.dc.executeGraphql(
    'mutation($id:String!,$hash:String!,$revision:Int!){knowledgeVersion_update(id:$id,data:{pendingStage:PUBLISH,pendingDocumentRevision:$revision,pendingExtractionHash:$hash})}',
    {
      variables: {
        id: h.versionId,
        hash: ready.extractionHash!,
        revision: ready.document.revision,
      },
    },
  );
  await h
    .pipeline(h.id)
    .publishVersion({ versionId: h.versionId, expectedDocumentRevision: ready.document.revision });
  expect((await aliases()).productAliases).toEqual([]);
  expect((await h.repo.version(h.versionId))!.publishedAt).not.toBeNull();
});
it('refreshes stale collision review when another source publishes the same phrase for another product', async () => {
  const first = await accepted();
  const sql = await import('@barberhq/server');
  const secondProduct = `${h.id}:b`;
  await sql.upsertProduct(h.dc, {
    id: secondProduct,
    businessId: h.id,
    demoId: 'b',
    name: 'Product B',
    brand: 'X',
    category: 'X',
    summaryEn: 'Facts B',
    sourceCode: '456',
    netContentMl: 1,
    retailPriceGrosz: 1,
    sourceUrl: 'https://example.com',
    observedOn: '2026-10-27',
  });
  const secondId = await h.pipeline(h.id).stageVersion(
    {
      ...h.entry,
      documentId: 'COLLISION',
      kind: 'product-catalog',
      origin: 'synthetic',
      sourceType: undefined,
    } as never,
    h.bytes,
  );
  await h.pipeline(h.id).extractVersion(secondId);
  const original = h.productId;
  h.productId = secondProduct;
  const second = await accepted(secondId);
  h.productId = original;
  await publish(secondId, second.reviewedHash!);
  await runJob();
  await expect(publish(h.versionId, first.reviewedHash!)).rejects.toMatchObject({
    code: 'STALE_STATE',
  });
  const fresh = await h.commands.read(h.hq, h.versionId);
  expect(fresh.impact[0]).toMatchObject({
    beforeProductIds: [secondProduct],
    afterProductIds: [original, secondProduct],
    collision: true,
  });
  const refreshed = await h.commands.accept(h.hq, {
    versionId: h.versionId,
    extractionHash: fresh.extractionHash,
    expectedReviewRevision: fresh.revision,
    expectedCatalogRevision: fresh.catalogRevision,
    idempotencyKey: randomUUID(),
  });
  await publish(h.versionId, refreshed.reviewedHash!);
  await runJob();
  const rows = await h.dc.executeGraphql<
    { productAliases: { ambiguous: boolean }[] },
    { id: string }
  >(
    'query($id:String!){productAliases(where:{businessId:{eq:$id},status:{eq:ACTIVE}}){ambiguous}}',
    { variables: { id: h.id } },
  );
  expect(rows.data.productAliases).toEqual([{ ambiguous: true }, { ambiguous: true }]);
});
it('rolls publication back after catalog changes and terminalizes the stale intent', async () => {
  const review = await accepted();
  await publish(h.versionId, review.reviewedHash!);
  const before = (await h.repo.version(h.versionId))!;
  await h.dc.executeGraphql(
    'mutation($id:String!){business_update(id:$id,data:{productKnowledgeRevision_update:{inc:1}})}',
    { variables: { id: h.id } },
  );
  await runJob();
  const after = (await h.repo.version(h.versionId))!;
  expect(after).toMatchObject({
    publishedAt: null,
    isActive: false,
    pendingStage: null,
    processingError: 'STALE_STATE',
  });
  expect(after.document).toEqual(before.document);
  expect(after.chunks).toEqual(before.chunks);
  expect(await aliases()).toMatchObject({
    productAliases: [{ status: 'PROPOSED' }],
    product: { type: null, typeSourceVersionId: null },
  });
});
it('blocks and terminalizes a queued product publication after HQ membership revocation', async () => {
  const review = await accepted();
  await publish(h.versionId, review.reviewedHash!);
  await h.dc.executeGraphql(
    'mutation($uid:String!){membership_update(key:{uid:$uid},data:{role:SALON})}',
    { variables: { uid: h.hq } },
  );
  await runJob();
  expect(await h.repo.version(h.versionId)).toMatchObject({
    publishedAt: null,
    pendingStage: null,
    processingError: 'STALE_STATE',
  });
  expect((await aliases()).productAliases[0].status).toBe('PROPOSED');
});
it('retires only the superseded source and clears the type after the last assertion is withdrawn', async () => {
  const first = await accepted();
  await publish(h.versionId, first.reviewedHash!);
  await runJob();
  const replacementId = await h.pipeline(h.id).stageVersion(
    {
      ...h.entry,
      version: 'v2',
      kind: 'product-catalog',
      origin: 'synthetic',
      sourceType: undefined,
    } as never,
    h.bytes,
  );
  await h.pipeline(h.id).extractVersion(replacementId);
  const replacement = await accepted(replacementId, 'Replacement', 'type Y');
  await publish(replacementId, replacement.reviewedHash!);
  await runJob();
  expect(await aliases()).toMatchObject({
    productAliases: expect.arrayContaining([
      { phrase: 'Alpha', status: 'RETIRED', sourceDocumentVersionId: h.versionId },
      { phrase: 'Replacement', status: 'ACTIVE', sourceDocumentVersionId: replacementId },
    ]),
    product: { type: 'type Y', typeSourceVersionId: replacementId },
  });
  const v = (await h.repo.version(replacementId))!;
  await new DocumentCommandService(h.repo).delete(h.hq, {
    versionId: replacementId,
    expectedDocumentRevision: v.document.revision,
    expectedVersionRevision: v.revision,
    idempotencyKey: randomUUID(),
  });
  expect((await aliases()).product).toMatchObject({ type: null, typeSourceVersionId: null });
  expect((await aliases()).productAliases.every((a) => a.status === 'RETIRED')).toBe(true);
});
it.skipIf(!process.env.BARBERHQ_ISOLATED_POSTGRES_URL)(
  'rejects a waiting withdrawal with a stale statement snapshot, then retries against surviving sources',
  async () => {
    const { createRequire } = await import('node:module');
    const { Client } = createRequire(import.meta.url)('pg');
    const url = process.env.BARBERHQ_ISOLATED_POSTGRES_URL!;
    const target = new URL(url);
    if (target.hostname !== '127.0.0.1' || target.port !== '9598')
      throw Error('Owned disposable PostgreSQL required');
    const first = await accepted();
    await publish(h.versionId, first.reviewedHash!);
    await runJob();
    const secondId = await h.pipeline(h.id).stageVersion(
      {
        ...h.entry,
        documentId: 'RACE',
        kind: 'product-catalog',
        origin: 'synthetic',
        sourceType: undefined,
      } as never,
      h.bytes,
    );
    await h.pipeline(h.id).extractVersion(secondId);
    const second = await accepted(secondId, 'Alpha', 'type Y');
    await publish(secondId, second.reviewedHash!);
    await runJob();
    const ids = [h.versionId, secondId];
    const versions = await Promise.all(ids.map((id) => h.repo.version(id)));
    const inputs = versions.map((v) => ({
      versionId: v!.id,
      expectedDocumentRevision: v!.document.revision,
      expectedVersionRevision: v!.revision,
      idempotencyKey: randomUUID(),
    }));
    // SQL Connect's local transport serializes operations; use independent native
    // sessions to execute the exact production statement under READ COMMITTED.
    const { readFile } = await import('node:fs/promises');
    const gql = await readFile('dataconnect/server/knowledge/revocation.gql', 'utf8');
    const statement = gql
      .slice(gql.indexOf('mutation RevokeKnowledgeVersion'))
      .match(/sql: """([\s\S]*?)"""/)![1];
    const { knowledgePayloadHash } = await import('../../functions/src/knowledge/schemas.ts');
    const blocker = new Client({ connectionString: url }),
      observer = new Client({ connectionString: url });
    const writers = inputs.map(() => new Client({ connectionString: url }));
    await Promise.all([blocker, observer, ...writers].map((c) => c.connect()));
    try {
      await blocker.query('BEGIN');
      await blocker.query('SELECT id FROM business WHERE id=$1 FOR UPDATE', [h.id]);
      const outcomes = Promise.all(
        writers.map((client, index) => {
          const input = inputs[index],
            v = versions[index]!;
          return client.query(statement, [
            h.id,
            v.id,
            v.documentId,
            v.document.revision,
            v.revision,
            true,
            randomUUID(),
            h.hq,
            input.idempotencyKey,
            knowledgePayloadHash('DELETE', input),
          ]);
        }),
      );
      const deadline = Date.now() + 5000;
      let waiting = 0;
      while (Date.now() < deadline) {
        waiting = Number(
          (
            await observer.query(
              "SELECT count(*) AS n FROM pg_stat_activity WHERE wait_event_type='Lock' AND datname=current_database()",
            )
          ).rows[0].n,
        );
        if (waiting >= 2) break;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      await blocker.query('COMMIT');
      const results = await outcomes;
      expect(waiting).toBeGreaterThanOrEqual(2);
      expect(results.filter((r) => r.rowCount === 1)).toHaveLength(1);
      const loser = results.findIndex((r) => r.rowCount === 0);
      await new DocumentCommandService(h.repo).delete(h.hq, inputs[loser]);
      expect((await aliases()).product).toMatchObject({ type: null, typeSourceVersionId: null });
      expect((await aliases()).productAliases.every((a) => a.status === 'RETIRED')).toBe(true);
    } finally {
      await blocker.query('ROLLBACK').catch(() => {});
      await Promise.all([blocker, observer, ...writers].map((c) => c.end()));
    }
  },
);
it('overrides the reviewed seed type on publication and falls back to it after withdrawal', async () => {
  await h.dc.executeGraphql(
    'mutation($id:String!,$b:String!){business_update(id:$b,data:{productKnowledgeRevision_update:{inc:1}}) product_update(id:$id,data:{seedType:"seed type",type:"seed type"})}',
    { variables: { id: h.productId, b: h.id } },
  );
  const review = await accepted();
  await publish(h.versionId, review.reviewedHash!);
  await runJob();
  expect((await aliases()).product).toEqual({ type: 'type X', typeSourceVersionId: h.versionId });
  const v = (await h.repo.version(h.versionId))!;
  await new DocumentCommandService(h.repo).delete(h.hq, {
    versionId: h.versionId,
    expectedDocumentRevision: v.document.revision,
    expectedVersionRevision: v.revision,
    idempotencyKey: randomUUID(),
  });
  expect((await aliases()).product).toEqual({ type: 'seed type', typeSourceVersionId: null });
});
