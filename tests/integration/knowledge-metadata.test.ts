import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { createKnowledgeHarness } from '../support/knowledge.ts';
import { DocumentCommandService } from '../../functions/src/knowledge/document-commands.ts';
import { backfillKnowledgeMetadata } from '../../scripts/ingest/backfill-knowledge-metadata.js';

it('writes independent classifications, replays legacy keys and preserves stored history during backfill', async () => {
  const h = await createKnowledgeHarness();
  const uid = `hq-${randomUUID()}`;
  try {
    await h.dc.executeGraphql(
      'mutation($uid:String!,$businessId:String!){membership_insert(data:{uid:$uid,businessId:$businessId,role:HQ})}',
      { variables: { uid, businessId: h.id } },
    );
    const commands = new DocumentCommandService(h.repo);
    const base = {
      title: 'Metadata fixture',
      language: 'en',
      sourceUrls: [],
      observedOn: null,
      sha256: 'a'.repeat(64),
      idempotencyKey: randomUUID(),
    };
    const legacy = { ...base, sourceType: 'synthetic-procedure' };
    const first = await commands.create(uid, legacy);
    expect(await h.repo.version(first.versionId)).toMatchObject({
      kind: 'PROCEDURE',
      origin: 'SYNTHETIC',
      synthetic: true,
    });
    expect((await commands.create(uid, legacy)).versionId).toBe(first.versionId);
    await expect(
      commands.create(uid, { ...base, kind: 'policy', origin: 'official' }),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    const policy = await commands.create(uid, {
      ...base,
      idempotencyKey: randomUUID(),
      kind: 'policy',
      origin: 'official',
    });
    expect(await h.repo.version(policy.versionId)).toMatchObject({
      kind: 'POLICY',
      origin: 'OFFICIAL',
      sourceType: null,
      synthetic: false,
    });
    const versionId = await h.pipeline(h.id).stageVersion(h.entry, h.bytes);
    await h.pipeline(h.id).extractVersion(versionId);
    await h.dc.executeGraphql(
      'mutation($id:String!){knowledgeVersion_update(id:$id,data:{kind:null,origin:null,revokedAt_expr:"request.time",isActive:false})}',
      { variables: { id: versionId } },
    );
    const snapshot = async () => {
      const { kind: _kind, origin: _origin, ...rest } = (await h.repo.version(versionId))!;
      return rest;
    };
    await h.dc.executeGraphql(`mutation{
      location_insert(data:{id:"${h.id}-stock",businessId:"${h.id}",key:"metadata-stock",name:"Metadata stock",kind:HQ})
      product_insert(data:{id:"${h.id}-product",businessId:"${h.id}",demoId:"metadata-product",name:"Fixture product",brand:"Fixture",category:"Fixture",summaryEn:"Fixture",sourceCode:"fixture",netContentMl:1,retailPriceGrosz:1,sourceUrl:"https://example.invalid",observedOn:"2026-10-27"})
      inventory_insert(data:{locationId:"${h.id}-stock",productId:"${h.id}-product",onHand:7,reserved:2,version:4})
    }`);
    const stock = async () =>
      (
        await h.dc.executeGraphql(
          'query($businessId:String!){inventories(where:{location:{businessId:{eq:$businessId}}}){locationId productId onHand reserved version}}',
          { variables: { businessId: h.id } },
        )
      ).data;
    const stockBefore = await stock();
    const before = await snapshot();
    const row = await h.repo.version(versionId);
    const bytes = h.originalBytes(row!.objectPath!, row!.objectGeneration!);
    expect(await backfillKnowledgeMetadata(h.dc, { businessId: h.id, apply: true })).toMatchObject({
      changed: 1,
      conflicts: 0,
      preserved: true,
    });
    expect(await snapshot()).toEqual(before);
    expect(await stock()).toEqual(stockBefore);
    expect(h.originalBytes(row!.objectPath!, row!.objectGeneration!)).toEqual(bytes);
    expect(await backfillKnowledgeMetadata(h.dc, { businessId: h.id, apply: true })).toMatchObject({
      changed: 0,
      alreadyCorrect: 3,
    });
  } finally {
    await h.dc.executeGraphql('mutation($uid:String!){membership_delete(key:{uid:$uid})}', {
      variables: { uid },
    });
    await h.dispose();
  }
});

it('backfills more than one SQL page across retired/withdrawn versions and rejects stale metadata CAS', async () => {
  const h = await createKnowledgeHarness();
  try {
    const documentId = `${h.id}:HISTORY`;
    await h.dc.executeGraphql(
      'mutation($id:String!,$businessId:String!){knowledgeDocument_insert(data:{id:$id,businessId:$businessId,documentCode:"HISTORY",nextVersionNumber:206})}',
      { variables: { id: documentId, businessId: h.id } },
    );
    for (let offset = 0; offset < 205; offset += 25) {
      const inserts = Array.from({ length: Math.min(25, 205 - offset) }, (_, j) => {
        const i = offset + j,
          retired = i % 2 === 0;
        return `v${i}:knowledgeVersion_insert(data:{id:"${documentId}:v${i}",documentId:"${documentId}",businessId:"${h.id}",versionLabel:"v${i}",title:"Metadata history",language:"en",sourceType:SYNTHETIC_PROCEDURE,synthetic:true,sourceUrls:[],pdfSha256:"${'a'.repeat(64)}",status:${['STAGED', 'EXTRACTED', 'REVIEWED', 'EMBEDDED', 'READY', 'NEEDS_REVIEW', 'FAILED'][i % 7]},publicationStatus:${retired ? 'RETIRED' : 'DEMO_CURRENT'},${i % 3 === 0 ? 'revokedAt:"2026-10-01T00:00:00Z",' : ''}revision:7})`;
      });
      await h.dc.executeGraphql(`mutation{${inserts.join('\n')}}`);
    }
    const result = await backfillKnowledgeMetadata(h.dc, { businessId: h.id, apply: true });
    expect(result).toMatchObject({ scanned: 205, changed: 205, conflicts: 0, preserved: true });
    expect(result.rows.every((r) => r.before === r.after)).toBe(true);
    expect(await backfillKnowledgeMetadata(h.dc, { businessId: h.id, apply: true })).toMatchObject({
      changed: 0,
      alreadyCorrect: 205,
    });
    await h.dc.executeGraphql(
      'mutation($id:String!){knowledgeVersion_update(id:$id,data:{kind:POLICY,origin:SYNTHETIC,sourceType:null})}',
      { variables: { id: `${documentId}:v0` } },
    );
    const sql = await import('@barberhq/server');
    await expect(
      sql.backfillKnowledgeMetadata(h.dc, {
        businessId: h.id,
        versionId: `${documentId}:v0`,
        expectedSourceType: sql.KnowledgeSourceType.SYNTHETIC_PROCEDURE,
        expectedSynthetic: true,
        kind: sql.KnowledgeDocumentKind.PROCEDURE,
        origin: sql.KnowledgeOrigin.SYNTHETIC,
      }),
    ).rejects.toThrow();
    expect(await h.repo.version(`${documentId}:v0`)).toMatchObject({
      kind: 'POLICY',
      origin: 'SYNTHETIC',
      revision: 7,
      publicationStatus: 'RETIRED',
    });
  } finally {
    await h.dispose();
  }
});

it('does not reinterpret an existing version when a repeated manifest changes classification', async () => {
  const h = await createKnowledgeHarness();
  try {
    const pipeline = h.pipeline(h.id);
    await pipeline.stageVersion(h.entry, h.bytes);
    await expect(
      pipeline.stageVersion({ ...h.entry, kind: 'policy' }, h.bytes),
    ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
  } finally {
    await h.dispose();
  }
});

it('recovers a committed legacy public upload before enforcing provenance for new registrations', async () => {
  const h = await createKnowledgeHarness(),
    uid = `legacy-hq-${randomUUID()}`;
  try {
    const sql = await import('@barberhq/server');
    const { knowledgePayloadHash, parseCreateDocument } =
      await import('../../functions/src/knowledge/schemas.js');
    await h.dc.executeGraphql(
      'mutation($uid:String!,$businessId:String!){membership_insert(data:{uid:$uid,businessId:$businessId,role:HQ})}',
      { variables: { uid, businessId: h.id } },
    );
    const input = parseCreateDocument({
      title: 'Legacy public upload',
      language: 'en',
      sourceType: 'public-product-summary',
      sourceUrls: [],
      observedOn: null,
      sha256: 'a'.repeat(64),
      idempotencyKey: randomUUID(),
    });
    const commands = new DocumentCommandService(h.repo);
    await expect(commands.create(uid, input)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    const documentId = `${h.id}:LEGACY-PUBLIC`,
      versionId = `${documentId}:v1`;
    await sql.registerKnowledgeVersion(h.dc, {
      uid,
      businessId: h.id,
      documentId,
      documentCode: 'LEGACY-PUBLIC',
      versionId,
      versionLabel: 'v1',
      nextVersionNumber: 2,
      expectedDocumentRevision: 0,
      newDocument: true,
      existingDocument: false,
      operationId: randomUUID(),
      key: input.idempotencyKey,
      payloadHash: knowledgePayloadHash('CREATE', input),
      title: input.title,
      language: input.language,
      sourceType: sql.KnowledgeSourceType.PUBLIC_PRODUCT_SUMMARY,
      kind: sql.KnowledgeDocumentKind.PRODUCT_CATALOG,
      origin: sql.KnowledgeOrigin.PUBLIC_COMPILATION,
      synthetic: false,
      sourceUrls: [],
      observedOn: null,
      pdfSha256: input.sha256,
    });
    expect(await commands.create(uid, input)).toMatchObject({ versionId });
    expect((await h.repo.document(documentId))?.nextVersionNumber).toBe(2);
  } finally {
    await h.dc.executeGraphql('mutation($uid:String!){membership_delete(key:{uid:$uid})}', {
      variables: { uid },
    });
    await h.dispose();
  }
});

it('rejects malformed public-compilation provenance through manifest ingestion before allocating a version', async () => {
  const h = await createKnowledgeHarness();
  try {
    for (const invalid of [
      { sourceUrls: ['javascript:alert(1)'], observedOn: '2026-10-27' },
      { sourceUrls: Array(11).fill('https://example.invalid'), observedOn: '2026-10-27' },
      { sourceUrls: ['https://example.invalid'], observedOn: '2026-02-30' },
      { sourceUrls: [], observedOn: '2026-10-27' },
      { sourceUrls: 'https://example.invalid' as unknown as string[], observedOn: '2026-10-27' },
      { sourceUrls: null as unknown as string[], observedOn: '2026-10-27' },
    ])
      await expect(
        h
          .pipeline(h.id)
          .stageVersion(
            { ...h.entry, kind: 'policy', origin: 'public-compilation', ...invalid },
            h.bytes,
          ),
      ).rejects.toMatchObject({ code: 'INVALID_MANIFEST' });
    expect(h.objectCount()).toBe(0);
  } finally {
    await h.dispose();
  }
});
