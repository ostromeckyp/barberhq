import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { createAiBudget } from '../../functions/src/ai/budget.ts';
import { createProcedureAnswerer, recheckEligibility } from '../../functions/src/ai/procedure.ts';
import { createSqlProcedureRepository } from '../../functions/src/ai/retrieval.ts';
import { createKnowledgeHarness } from '../support/knowledge.ts';

type Harness = Awaited<ReturnType<typeof createKnowledgeHarness>>;
async function stockSnapshot(h: Harness) {
  return (
    await h.dc.executeGraphql(
      `query($id:String!){
    inventories(where:{location:{businessId:{eq:$id}}},orderBy:[{locationId:ASC},{productId:ASC}]){locationId productId onHand reserved version}
    replenishmentRequests(where:{businessId:{eq:$id}},orderBy:{id:ASC}){id state revision}
    requestItems(where:{request:{businessId:{eq:$id}}},orderBy:{id:ASC}){id requestId productId quantity}
    transfers(where:{businessId:{eq:$id}},orderBy:{requestId:ASC}){requestId}
    transferItems(where:{transfer:{businessId:{eq:$id}}},orderBy:{requestItemId:ASC}){requestItemId quantity dispatchedQuantity receivedQuantity}
    stockMovements(where:{businessId:{eq:$id}},orderBy:[{transferItemRequestItemId:ASC},{type:ASC}]){transferItemRequestItemId type quantity}
  }`,
      { variables: { id: h.id } },
    )
  ).data;
}
async function readyVersion(h: Harness, code: string, versionLabel = 'v1') {
  const pipeline = h.pipeline(h.id, h.makeVector(1, 0));
  const versionId = await pipeline.stageVersion(
    { ...h.entry, documentId: code, version: versionLabel },
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
      approvedAt: '2026-10-21',
    },
    { kind: 'operator', id: 'fixture@example.invalid', businessId: h.id },
  );
  return { pipeline, versionId, documentId: `${h.id}:${code}` };
}
async function publishVersion(h: Harness, ready: Awaited<ReturnType<typeof readyVersion>>) {
  await ready.pipeline.publishVersion({
    versionId: ready.versionId,
    expectedDocumentRevision: (await h.repo.document(ready.documentId))!.revision,
  });
}

it.skipIf(process.env.BARBERHQ_TEST_MODE !== 'emulator')(
  'withdrawal_during_generation_blocks_answer',
  async () => {
    const h = await createKnowledgeHarness();
    const uid = `rag-flow-${randomUUID()}`;
    const actor = { uid, businessId: h.id, role: 'HQ' as const, salonIds: [] };
    let phase = 'setup';
    let original: Error | null = null;
    try {
      await h.dc.executeGraphql(
        'mutation($uid:String!,$businessId:String!){membership_insert(data:{uid:$uid,businessId:$businessId,role:HQ})}',
        { variables: { uid, businessId: h.id } },
      );
      phase = 'publication';
      const pipeline = h.pipeline(h.id, h.makeVector(1, 0));
      const versionId = await pipeline.stageVersion({ ...h.entry, documentId: 'FLOW' }, h.bytes);
      await pipeline.extractVersion(versionId);
      const version = (await h.repo.version(versionId))!;
      await pipeline.recordReview(
        {
          versionId,
          pdfSha256: version.pdfSha256,
          extractionHash: version.extractionHash!,
          reviewedPhysicalPages: [1],
          approvalText: 'Fixture review',
          approvedAt: '2026-10-21',
        },
        { kind: 'operator', id: 'fixture@example.invalid', businessId: h.id },
      );
      const documentId = `${h.id}:FLOW`;
      await pipeline.publishVersion({
        versionId,
        expectedDocumentRevision: (await h.repo.document(documentId))!.revision,
      });
      const stockBefore = await stockSnapshot(h);
      phase = 'answer race';
      const repository = createSqlProcedureRepository(h.dc);
      let release!: () => void;
      let entered!: () => void;
      const paused = new Promise<void>((resolve) => {
        release = resolve;
      });
      const inside = new Promise<void>((resolve) => {
        entered = resolve;
      });
      let generation = 0;
      let latestChunkId = '';
      const flow = createProcedureAnswerer({
        resolveActor: async () => actor,
        admitAiCall: async () => createAiBudget(Date.now()),
        retrieve: async () => {
          const hits = await repository.search({
            uid,
            businessId: h.id,
            vector: h.makeVector(1, 0),
            embeddingConfigHash: h.config.configHash,
            embeddingModel: h.config.modelId,
            limit: 3,
            kinds: ['procedure', 'policy', 'product-card', 'product-catalog'],
          });
          latestChunkId = hits[0]?.chunkId ?? '';
          return hits;
        },
        recheck: (sources, ctx) => recheckEligibility(sources, ctx, h.dc),
        generate: async () => {
          generation++;
          if (generation === 1)
            return JSON.stringify({ status: 'MISSING_CONTEXT', searchQuery: 'report damage' });
          entered();
          await paused;
          return JSON.stringify({
            status: 'ANSWER',
            steps: [{ text: 'Report damage.', sourceSectionIds: [latestChunkId] }],
            missingInformation: [],
          });
        },
      });
      const pending = flow(uid, { question: 'How do I report damage?', answerLanguage: 'en' });
      await inside;
      await h.dc.executeGraphql(
        'mutation($id:String!){knowledgeVersion_update(id:$id,data:{revokedAt_expr:"request.time"})}',
        { variables: { id: versionId } },
      );
      release();
      await expect(pending).rejects.toMatchObject({ code: 'SOURCE_CHANGED' });
      // SQL recheck itself must see the withdrawal even if generation returned an otherwise valid answer.
      const hits = await repository.search({
        uid,
        businessId: h.id,
        vector: h.makeVector(1, 0),
        embeddingConfigHash: h.config.configHash,
        embeddingModel: h.config.modelId,
        limit: 3,
        kinds: ['procedure', 'policy', 'product-card', 'product-catalog'],
      });
      expect(hits).toEqual([]);
      expect(await stockSnapshot(h)).toEqual(stockBefore);
    } catch (error) {
      original = new Error(
        `${phase} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      try {
        await h.dc.executeGraphql('mutation($uid:String!){membership_delete(key:{uid:$uid})}', {
          variables: { uid },
        });
      } catch {}
      try {
        await h.dispose();
      } catch (error) {
        if (!original) original = error as Error;
      }
    }
    if (original) throw original;
  },
);

it.skipIf(process.env.BARBERHQ_TEST_MODE !== 'emulator')(
  'publication_replacement_recovers_with_remaining_retry_and_access_revocation_denies',
  async () => {
    const h = await createKnowledgeHarness();
    const uid = `rag-replace-${randomUUID()}`;
    const salonUid = `rag-salon-${randomUUID()}`;
    const salonId = `rag-salon-${randomUUID()}`;
    const actor = { uid, businessId: h.id, role: 'HQ' as const, salonIds: [] };
    let phase = 'setup';
    let original: Error | null = null;
    try {
      await h.dc.executeGraphql(
        'mutation($uid:String!,$businessId:String!){membership_insert(data:{uid:$uid,businessId:$businessId,role:HQ})}',
        { variables: { uid, businessId: h.id } },
      );
      const first = await readyVersion(h, 'REPLACEMENT');
      await publishVersion(h, first);
      const second = await readyVersion(h, 'REPLACEMENT', 'v2');
      const stockBefore = await stockSnapshot(h);
      phase = 'paused answer and replacement';
      const repository = createSqlProcedureRepository(h.dc);
      let release!: () => void;
      let entered!: () => void;
      const paused = new Promise<void>((resolve) => {
        release = resolve;
      });
      const inside = new Promise<void>((resolve) => {
        entered = resolve;
      });
      let generation = 0;
      let latestChunkId = '';
      const flow = createProcedureAnswerer({
        resolveActor: async () => actor,
        admitAiCall: async () => createAiBudget(Date.now()),
        retrieve: async () => {
          const hits = await repository.search({
            uid,
            businessId: h.id,
            vector: h.makeVector(1, 0),
            embeddingConfigHash: h.config.configHash,
            embeddingModel: h.config.modelId,
            limit: 3,
            kinds: ['procedure', 'policy', 'product-card', 'product-catalog'],
          });
          latestChunkId = hits[0]?.chunkId ?? '';
          return hits;
        },
        recheck: (sources, ctx) => recheckEligibility(sources, ctx, h.dc),
        generate: async () => {
          generation++;
          if (generation === 1) {
            entered();
            await paused;
          }
          return JSON.stringify({
            status: 'ANSWER',
            steps: [{ text: 'Report damage.', sourceSectionIds: [latestChunkId] }],
            missingInformation: [],
          });
        },
      });
      const pending = flow(uid, { question: 'How do I report damage?', answerLanguage: 'en' });
      await inside;
      await publishVersion(h, second);
      release();
      const result = await pending;
      expect(result).toMatchObject({
        status: 'ANSWER',
        sources: [{ versionId: second.versionId }],
      });
      expect(generation).toBe(2);
      expect(await stockSnapshot(h)).toEqual(stockBefore);
      phase = 'salon access revoke';
      await h.dc.executeGraphql(
        'mutation($id:String!,$businessId:String!){location_insert(data:{id:$id,businessId:$businessId,key:"rag-flow-salon",name:"RAG salon",kind:SALON})}',
        { variables: { id: salonId, businessId: h.id } },
      );
      await h.dc.executeGraphql(
        'mutation($uid:String!,$businessId:String!){membership_insert(data:{uid:$uid,businessId:$businessId,role:SALON})}',
        { variables: { uid: salonUid, businessId: h.id } },
      );
      await h.dc.executeGraphql(
        'mutation($uid:String!,$locationId:String!){salonAccess_insert(data:{membershipUid:$uid,locationId:$locationId})}',
        { variables: { uid: salonUid, locationId: salonId } },
      );
      const salonActor = {
        uid: salonUid,
        businessId: h.id,
        role: 'SALON' as const,
        salonIds: [salonId],
      };
      const hits = await repository.search({
        uid: salonUid,
        businessId: h.id,
        vector: h.makeVector(1, 0),
        embeddingConfigHash: h.config.configHash,
        embeddingModel: h.config.modelId,
        limit: 3,
        kinds: ['procedure', 'policy', 'product-card', 'product-catalog'],
      });
      expect(await recheckEligibility(hits, salonActor, h.dc)).toBe(true);
      await h.dc.executeGraphql(
        'mutation($uid:String!){salonAccess_deleteMany(where:{membershipUid:{eq:$uid}})}',
        { variables: { uid: salonUid } },
      );
      await expect(recheckEligibility(hits, salonActor, h.dc)).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
      expect(await stockSnapshot(h)).toEqual(stockBefore);
    } catch (error) {
      original = new Error(
        `${phase} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      try {
        await h.dc.executeGraphql(
          'mutation($uid:String!){salonAccess_deleteMany(where:{membershipUid:{eq:$uid}})}',
          { variables: { uid: salonUid } },
        );
      } catch {}
      try {
        await h.dc.executeGraphql('mutation($uid:String!){membership_delete(key:{uid:$uid})}', {
          variables: { uid: salonUid },
        });
      } catch {}
      try {
        await h.dc.executeGraphql('mutation($id:String!){location_delete(id:$id)}', {
          variables: { id: salonId },
        });
      } catch {}
      try {
        await h.dc.executeGraphql('mutation($uid:String!){membership_delete(key:{uid:$uid})}', {
          variables: { uid },
        });
      } catch {}
      try {
        await h.dispose();
      } catch (error) {
        if (!original) original = error as Error;
      }
    }
    if (original) throw original;
  },
);

it('rejects stale provenance when classification changes between retrieval and the final citation check', async () => {
  const h = await createKnowledgeHarness(),
    uid = `metadata-race-${randomUUID()}`;
  try {
    await h.dc.executeGraphql(
      'mutation($uid:String!,$businessId:String!){membership_insert(data:{uid:$uid,businessId:$businessId,role:HQ})}',
      { variables: { uid, businessId: h.id } },
    );
    const ready = await readyVersion(h, 'PROVENANCE');
    await publishVersion(h, ready);
    const actor = { uid, businessId: h.id, role: 'HQ' as const, salonIds: [] };
    const hits = await createSqlProcedureRepository(h.dc).search({
      uid,
      businessId: h.id,
      vector: h.makeVector(1, 0),
      embeddingConfigHash: h.config.configHash,
      embeddingModel: h.config.modelId,
      limit: 3,
      kinds: ['procedure', 'policy', 'product-card', 'product-catalog'],
    });
    expect(await recheckEligibility(hits, actor, h.dc)).toBe(true);
    await h.dc.executeGraphql(
      'mutation($id:String!){knowledgeVersion_update(id:$id,data:{kind:POLICY,origin:OFFICIAL,synthetic:false,sourceType:null})}',
      { variables: { id: ready.versionId } },
    );
    expect(await recheckEligibility(hits, actor, h.dc)).toBe(false);
  } finally {
    await h.dc.executeGraphql('mutation($uid:String!){membership_delete(key:{uid:$uid})}', {
      variables: { uid },
    });
    await h.dispose();
  }
});
