import { afterEach, beforeEach, expect, it } from 'vitest';
import { createKnowledgeHarness } from '../support/knowledge.ts';

let h: Awaited<ReturnType<typeof createKnowledgeHarness>>;
beforeEach(async () => {
  h = await createKnowledgeHarness();
});
afterEach(async () => {
  if (h) await h.dispose();
});

it('scope_filters_before_top_k', async () => {
  async function publish(
    businessId: string,
    documentId: string,
    versionLabel: string,
    vector: number[],
  ) {
    const pipeline = h.pipeline(businessId, vector);
    const versionId = await pipeline.stageVersion(
      { ...h.entry, documentId, version: versionLabel },
      h.bytes,
    );
    await pipeline.extractVersion(versionId);
    const version = (await h.repo.version(versionId))!;
    await pipeline.recordReview(
      {
        versionId,
        pdfSha256: version.pdfSha256,
        extractionHash: version.extractionHash!,
        reviewedPhysicalPages: [1],
        approvalText: 'Fixture review',
        approvedAt: '2026-10-12',
      },
      { kind: 'operator', id: 'fixture@example.invalid', businessId },
    );
    const document = (await h.repo.document(`${businessId}:${documentId}`))!;
    await pipeline.publishVersion({ versionId, expectedDocumentRevision: document.revision });
    return versionId;
  }
  await publish(h.foreignId, 'DAM-001', 'v1', h.makeVector(1, 0));
  const pipeline = h.pipeline(h.id, h.makeVector(1, 0));
  const retiredId = await pipeline.stageVersion(
    { ...h.entry, version: 'v0', publicationStatus: 'retired' },
    h.bytes,
  );
  await pipeline.extractVersion(retiredId);
  const retired = (await h.repo.version(retiredId))!;
  await pipeline.recordReview(
    {
      versionId: retiredId,
      pdfSha256: retired.pdfSha256,
      extractionHash: retired.extractionHash!,
      reviewedPhysicalPages: [1],
      approvalText: 'Fixture review',
      approvedAt: '2026-10-12',
    },
    { kind: 'operator', id: 'fixture@example.invalid', businessId: h.id },
  );
  expect((await h.repo.version(retiredId))?.status).toBe('READY');
  const eligibleId = await publish(h.id, 'DAM-001', 'v1', h.makeVector(0.8, 0.6));
  // Simulate corrupted active/published flags: the publication classification
  // must still exclude the more-similar retired chunks before top-k selection.
  await h.dc.executeGraphql(
    'mutation($id:String!){knowledgeVersion_update(id:$id,data:{isActive:true,publishedAt:"2026-10-12T00:00:00Z"})}',
    { variables: { id: retiredId } },
  );
  const revokedId = await publish(h.id, 'DAM-002', 'v1', h.makeVector(1, 0));
  await h.dc.executeGraphql(
    'mutation($id:String!){knowledgeVersion_updateMany(where:{id:{eq:$id}},data:{revokedAt_expr:"request.time"})}',
    { variables: { id: revokedId } },
  );
  expect((await h.repo.version(retiredId))?.isActive).toBe(true);
  expect((await h.repo.version(revokedId))?.revokedAt).toBeTruthy();
  const hits = await h.repo.search(h.id, h.makeVector(1, 0), h.config.configHash);
  expect(hits.length).toBeGreaterThan(0);
  expect(hits.every((hit) => hit.versionId === eligibleId)).toBe(true);
  await expect(h.repo.search(h.id, [1, 0], h.config.configHash)).rejects.toThrow(/dimension/);
  await expect(
    h.repo.search(h.id, h.makeVector(Number.NaN, 0), h.config.configHash),
  ).rejects.toThrow(/non-finite/);
});
