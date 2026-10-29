import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { createEmbeddingConfig } from '../../functions/src/knowledge/embedding.ts';
import {
  createProcedureRetriever,
  createSqlProcedureRepository,
} from '../../functions/src/ai/retrieval.ts';
import type { RetrievedChunk } from '../../functions/src/ai/models/retrieved-chunk.ts';
import { createKnowledgeHarness } from '../support/knowledge.ts';
import { AiError } from '../../functions/src/ai/budget.ts';

const embeddingConfig = createEmbeddingConfig({
  projectId: 'demo-barberhq',
  modelId: 'gemini-embedding-001',
  dimension: 768,
  location: 'europe-west3',
  documentMode: 'RETRIEVAL_DOCUMENT',
  queryMode: 'RETRIEVAL_QUERY',
});
const vector = [1, ...Array(767).fill(0)];
const actor = {
  uid: 'fixture-user',
  businessId: 'fixture-business',
  role: 'HQ' as const,
  salonIds: [],
};

function chunk(distance: number): RetrievedChunk {
  return {
    businessId: actor.businessId,
    documentId: 'fixture-business:DAM-001',
    versionId: 'fixture-business:DAM-001:v1',
    version: 'v1',
    title: 'Damaged delivery',
    language: 'en',
    synthetic: true,
    kind: 'procedure',
    origin: 'synthetic',
    superseded: false,
    pageCount: 1,
    chunkId: 'fixture-chunk',
    sourceSectionId: 'fixture-chunk',
    sectionId: 'report',
    physicalPage: 1,
    excerpt: 'Report the damage to the HQ delivery coordinator.',
    geometry: { viewBox: [0, 0, 100, 100], userUnit: 1, rotation: 0 },
    rects: [],
    geometryStatus: 'VERIFIED',
    cosineDistance: distance,
    documentRevision: 1,
    embeddingConfigHash: embeddingConfig.configHash,
  };
}

it('unsupported_question_has_no_usable_evidence', async () => {
  const retrieve = createProcedureRetriever({
    embedding: { config: embeddingConfig, embedTexts: async () => [vector] },
    repository: { search: async () => [chunk(0.7)] },
    config: {
      maxChunks: 3,
      maxCosineDistance: 0.4,
      embeddingConfigHash: embeddingConfig.configHash,
      evaluationSetHash: 'a'.repeat(64),
    },
  });
  expect(
    await retrieve(
      { question: 'What chemical concentration disinfects equipment?', limit: 3 },
      actor,
    ),
  ).toEqual([]);
});

it('filters_before_similarity_limit', async () => {
  let called = false;
  const retrieve = createProcedureRetriever({
    embedding: { config: embeddingConfig, embedTexts: async () => [vector] },
    repository: {
      search: async (input) => {
        called = true;
        expect(input).toMatchObject({
          uid: actor.uid,
          businessId: actor.businessId,
          embeddingConfigHash: embeddingConfig.configHash,
          embeddingModel: embeddingConfig.modelId,
          limit: 3,
        });
        return [chunk(0.1)];
      },
    },
    config: {
      maxChunks: 3,
      maxCosineDistance: 0.4,
      embeddingConfigHash: embeddingConfig.configHash,
      evaluationSetHash: 'a'.repeat(64),
    },
  });
  const chunks = await retrieve({ question: 'Where do I report a broken item?', limit: 3 }, actor);
  expect(called).toBe(true);
  expect(chunks).toHaveLength(1);
  expect(chunks[0].sourceSectionId).toBe(chunks[0].chunkId);
});

it('mismatched_embedding_config_is_operational_error', async () => {
  expect(() =>
    createProcedureRetriever({
      embedding: { config: embeddingConfig, embedTexts: async () => [vector] },
      repository: { search: async () => [] },
      config: {
        maxChunks: 3,
        maxCosineDistance: 0.4,
        embeddingConfigHash: 'b'.repeat(64),
        evaluationSetHash: 'a'.repeat(64),
      },
    }),
  ).toThrow('EMBEDDING_CONFIG_MISMATCH');
});

it('retrieval_and_provider_failures_are_not_no_evidence', async () => {
  const config = {
    maxChunks: 3 as const,
    maxCosineDistance: 0.4,
    embeddingConfigHash: embeddingConfig.configHash,
    evaluationSetHash: 'a'.repeat(64),
  };
  const providerFailure = createProcedureRetriever({
    embedding: {
      config: embeddingConfig,
      embedTexts: async () => {
        throw Error('provider detail');
      },
    },
    repository: { search: async () => [] },
    config,
  });
  await expect(providerFailure({ question: 'Damaged jar?', limit: 3 }, actor)).rejects.toThrow(
    'PROVIDER_UNAVAILABLE',
  );
  const sqlFailure = createProcedureRetriever({
    embedding: { config: embeddingConfig, embedTexts: async () => [vector] },
    repository: {
      search: async () => {
        throw Error('database detail');
      },
    },
    config,
  });
  await expect(sqlFailure({ question: 'Damaged jar?', limit: 3 }, actor)).rejects.toThrow(
    'SERVICE_UNAVAILABLE',
  );
});

it.skipIf(process.env.BARBERHQ_TEST_MODE !== 'emulator')(
  'sql_filters_before_similarity_limit',
  async () => {
    const h = await createKnowledgeHarness();
    const uid = `rag-user-${randomUUID()}`;
    const salonUid = `rag-salon-user-${randomUUID()}`;
    const salonId = `rag-salon-${randomUUID()}`;
    const queryVector = h.makeVector(1, 0);
    let phase = 'fixture setup';
    let primary: Error | null = null;
    async function ready(
      businessId: string,
      code: string,
      nearest: boolean,
      publicationStatus: 'demo-current' | 'retired' = 'demo-current',
    ) {
      const pipeline = h.pipeline(businessId, nearest ? queryVector : h.makeVector(0.8, 0.6));
      const versionId = await pipeline.stageVersion(
        { ...h.entry, documentId: code, publicationStatus },
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
        { kind: 'operator', id: 'fixture@example.invalid', businessId },
      );
      return { pipeline, versionId, documentId: `${businessId}:${code}` };
    }
    async function publish(item: Awaited<ReturnType<typeof ready>>) {
      const document = (await h.repo.document(item.documentId))!;
      await item.pipeline.publishVersion({
        versionId: item.versionId,
        expectedDocumentRevision: document.revision,
      });
      return item.versionId;
    }
    try {
      phase = 'membership insert';
      await h.dc.executeGraphql(
        'mutation($uid:String!,$businessId:String!){membership_insert(data:{uid:$uid,businessId:$businessId,role:HQ})}',
        { variables: { uid, businessId: h.id } },
      );
      phase = 'foreign';
      const foreign = await ready(h.foreignId, 'FOREIGN', true);
      await publish(foreign);
      phase = 'retired';
      const retired = await ready(h.id, 'RETIRED', true, 'retired');
      await h.dc.executeGraphql(
        'mutation($id:String!){knowledgeVersion_update(id:$id,data:{isActive:true,publishedAt:"2026-10-21T00:00:00Z"})}',
        { variables: { id: retired.versionId } },
      );
      phase = 'revoked';
      const revoked = await ready(h.id, 'REVOKED', true);
      await publish(revoked);
      await h.dc.executeGraphql(
        'mutation($id:String!){knowledgeVersion_update(id:$id,data:{revokedAt_expr:"request.time"})}',
        { variables: { id: revoked.versionId } },
      );
      phase = 'unready';
      const unready = await ready(h.id, 'UNREADY', true);
      await publish(unready);
      await h.dc.executeGraphql(
        'mutation($id:String!){knowledgeVersion_update(id:$id,data:{status:REVIEWED})}',
        { variables: { id: unready.versionId } },
      );
      phase = 'pointer';
      const pointer = await ready(h.id, 'POINTER', true);
      await publish(pointer);
      await h.dc.executeGraphql(
        'mutation($id:String!){knowledgeDocument_update(id:$id,data:{activeVersionId:null})}',
        { variables: { id: pointer.documentId } },
      );
      phase = 'config mismatch';
      const mismatch = await ready(h.id, 'MISMATCH', true);
      await publish(mismatch);
      await h.dc.executeGraphql(
        'mutation($id:String!){knowledgeChunk_updateMany(where:{versionId:{eq:$id}},data:{embeddingConfigHash:"wrong"})}',
        { variables: { id: mismatch.versionId } },
      );
      phase = 'eligible';
      const eligible = await ready(h.id, 'ELIGIBLE', false);
      await publish(eligible);

      phase = 'eligible retrieval';
      const retrieve = createProcedureRetriever({
        embedding: { config: h.config, embedTexts: async () => [queryVector] },
        repository: createSqlProcedureRepository(h.dc),
        config: {
          maxChunks: 3,
          maxCosineDistance: 2,
          embeddingConfigHash: h.config.configHash,
          evaluationSetHash: 'a'.repeat(64),
        },
      });
      const hits = await retrieve(
        { question: 'Where do I report damage?', limit: 3 },
        { uid, businessId: h.id, role: 'HQ', salonIds: [] },
      );
      expect(hits.length).toBeGreaterThan(0);
      expect(hits.length).toBeLessThanOrEqual(3);
      expect(hits.every((c) => c.versionId === eligible.versionId)).toBe(true);
      expect(hits.every((c) => c.embeddingConfigHash === h.config.configHash)).toBe(true);
      expect(hits.every((c) => c.sourceSectionId === c.chunkId && c.physicalPage >= 1)).toBe(true);
      phase = 'missing member denial';
      await expect(
        retrieve(
          { question: 'Where?', limit: 3 },
          { uid: 'missing-member', businessId: h.id, role: 'HQ', salonIds: [] },
        ),
      ).rejects.toThrow('FORBIDDEN');
      phase = 'salon access';
      await h.dc.executeGraphql(
        'mutation($id:String!,$businessId:String!){location_insert(data:{id:$id,businessId:$businessId,key:"rag-fixture",name:"RAG salon",kind:SALON})}',
        { variables: { id: salonId, businessId: h.id } },
      );
      await h.dc.executeGraphql(
        'mutation($uid:String!,$businessId:String!){membership_insert(data:{uid:$uid,businessId:$businessId,role:SALON})}',
        { variables: { uid: salonUid, businessId: h.id } },
      );
      const salonActor = {
        uid: salonUid,
        businessId: h.id,
        role: 'SALON' as const,
        salonIds: [salonId],
      };
      await expect(retrieve({ question: 'Where?', limit: 3 }, salonActor)).rejects.toThrow(
        'FORBIDDEN',
      );
      await h.dc.executeGraphql(
        'mutation($uid:String!,$locationId:String!){salonAccess_insert(data:{membershipUid:$uid,locationId:$locationId})}',
        { variables: { uid: salonUid, locationId: salonId } },
      );
      expect((await retrieve({ question: 'Where?', limit: 3 }, salonActor)).length).toBeGreaterThan(
        0,
      );
      await h.dc.executeGraphql(
        'mutation($uid:String!){salonAccess_deleteMany(where:{membershipUid:{eq:$uid}})}',
        { variables: { uid: salonUid } },
      );
      await expect(retrieve({ question: 'Where?', limit: 3 }, salonActor)).rejects.toThrow(
        'FORBIDDEN',
      );
    } catch (error) {
      primary = new Error(
        `${phase} failed: ${error instanceof AiError ? error.code : error instanceof Error ? error.name : 'unknown'}`,
      );
    } finally {
      try {
        await h.dc.executeGraphql(
          'mutation($uid:String!){salonAccess_deleteMany(where:{membershipUid:{eq:$uid}})}',
          { variables: { uid: salonUid } },
        );
      } catch {
        /* Continue exact cleanup. */
      }
      try {
        await h.dc.executeGraphql('mutation($uid:String!){membership_delete(key:{uid:$uid})}', {
          variables: { uid: salonUid },
        });
      } catch {
        /* Continue exact cleanup. */
      }
      try {
        await h.dc.executeGraphql('mutation($id:String!){location_delete(id:$id)}', {
          variables: { id: salonId },
        });
      } catch {
        /* Continue exact cleanup. */
      }
      try {
        await h.dc.executeGraphql('mutation($uid:String!){membership_delete(key:{uid:$uid})}', {
          variables: { uid },
        });
      } catch {
        /* Harness cleanup still runs. */
      }
      try {
        await h.dispose();
      } catch {
        if (!primary) primary = new Error('fixture cleanup failed');
      }
    }
    if (primary) throw primary;
  },
);

it('filters independent document kinds in SQL before the three nearest slots', async () => {
  const h = await createKnowledgeHarness(),
    uid = `metadata-hq-${randomUUID()}`;
  try {
    await h.dc.executeGraphql(
      'mutation($uid:String!,$businessId:String!){membership_insert(data:{uid:$uid,businessId:$businessId,role:HQ})}',
      { variables: { uid, businessId: h.id } },
    );
    const kinds = ['procedure', 'policy', 'product-card', 'product-catalog'] as const;
    for (const [i, kind] of kinds.entries()) {
      const pipeline = h.pipeline(h.id, h.makeVector(1 - i * 0.05, i * 0.05));
      const versionId = await pipeline.stageVersion(
        { ...h.entry, documentId: `KIND-${i}00`, kind, origin: 'synthetic' },
        h.bytes,
      );
      await pipeline.extractVersion(versionId);
      const version = (await h.repo.version(versionId))!;
      await pipeline.recordReview(
        {
          versionId,
          pdfSha256: version.pdfSha256,
          extractionHash: version.extractionHash!,
          reviewedPhysicalPages: version.pages.map((p) => p.physicalPage),
          approvalText: 'Metadata fixture reviewed',
          approvedAt: new Date().toISOString(),
        },
        { kind: 'operator', id: 'fixture', businessId: h.id },
      );
      const document = (await h.repo.document(version.documentId))!;
      // Product references here represent already committed PDF-only intents from before enrichment.
      if (kind === 'product-card' || kind === 'product-catalog')
        await h.dc.executeGraphql(
          'mutation($id:String!,$hash:String!,$revision:Int!){knowledgeVersion_update(id:$id,data:{pendingStage:PUBLISH,pendingDocumentRevision:$revision,pendingExtractionHash:$hash})}',
          {
            variables: {
              id: versionId,
              hash: version.extractionHash!,
              revision: document.revision,
            },
          },
        );
      await pipeline.publishVersion({ versionId, expectedDocumentRevision: document.revision });
    }
    const repo = createSqlProcedureRepository(h.dc);
    const input = {
      uid,
      businessId: h.id,
      vector: h.makeVector(1, 0),
      embeddingConfigHash: h.config.configHash,
      embeddingModel: h.config.modelId,
      limit: 3 as const,
    };
    for (const kind of kinds) {
      const hits = await repo.search({ ...input, kinds: [kind] });
      expect(hits.length).toBeGreaterThan(0);
      expect(hits.every((hit) => hit.kind === kind)).toBe(true);
    }
    const hits = await repo.search({ ...input, kinds });
    expect(hits[0].kind).toBe('procedure');
    await expect(repo.search({ ...input, kinds: [] })).rejects.toThrow();
    await expect(repo.search({ ...input, kinds: ['unknown' as never] })).rejects.toThrow();
  } finally {
    await h.dc.executeGraphql('mutation($uid:String!){membership_delete(key:{uid:$uid})}', {
      variables: { uid },
    });
    await h.dispose();
  }
});
