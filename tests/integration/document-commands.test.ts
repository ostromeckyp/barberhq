import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, expect, it } from 'vitest';
import * as sql from '@barberhq/server';
import { createKnowledgeHarness } from '../support/knowledge.ts';
import { DocumentCommandService } from '../../functions/src/knowledge/document-commands.ts';
import { resolveSourceIdentity } from '../../functions/src/knowledge/source.ts';

type KnowledgeHarness = Awaited<ReturnType<typeof createKnowledgeHarness>>;
let h: KnowledgeHarness;
let activeHarness: KnowledgeHarness | undefined;
let hq: string;
let salon: string;
let foreign: string;
let commands: DocumentCommandService;
const membership =
  'mutation($uid:String!,$businessId:String!,$role:MemberRole!){membership_insert(data:{uid:$uid,businessId:$businessId,role:$role})}';

beforeEach(async () => {
  activeHarness = undefined;
  hq = '';
  salon = '';
  foreign = '';
  h = await createKnowledgeHarness();
  activeHarness = h;
  hq = `hq-${randomUUID()}`;
  salon = `salon-${randomUUID()}`;
  foreign = `foreign-${randomUUID()}`;
  for (const [uid, businessId, role] of [
    [hq, h.id, 'HQ'],
    [salon, h.id, 'SALON'],
    [foreign, h.foreignId, 'HQ'],
  ])
    await h.dc.executeGraphql(membership, { variables: { uid, businessId, role } });
  commands = new DocumentCommandService(h.repo);
});
afterEach(async () => {
  const current = activeHarness;
  activeHarness = undefined;
  if (!current) return;
  let cleanupFailed = false;
  for (const uid of [hq, salon, foreign]) {
    if (!uid) continue;
    try {
      await current.dc.executeGraphql('mutation($uid:String!){membership_delete(key:{uid:$uid})}', {
        variables: { uid },
      });
    } catch {
      cleanupFailed = true;
    }
  }
  try {
    await current.dispose();
  } catch {
    cleanupFailed = true;
  }
  if (cleanupFailed)
    throw new Error('Document command fixture cleanup failed; SDK details suppressed');
});

function createInput(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Hair dye procedure',
    language: 'en' as const,
    sourceType: 'synthetic-procedure' as const,
    sourceUrls: [],
    observedOn: null,
    sha256: 'a'.repeat(64),
    idempotencyKey: randomUUID(),
    ...overrides,
  };
}

function canonicalPath(versionId: string, sha256: string) {
  const versionLabel = versionId.slice(versionId.lastIndexOf(':') + 1);
  const documentCode = versionId.slice(versionId.indexOf(':') + 1, versionId.lastIndexOf(':'));
  return `knowledge/${h.id}/${documentCode}/${versionLabel}/${sha256}.pdf`;
}

it('replays the same create key and rejects a changed payload without another allocation', async () => {
  const input = createInput();
  const first = await commands.create(hq, input);
  const replay = await commands.create(hq, input);
  expect(replay.versionId).toBe(first.versionId);
  expect(replay.versionRevision).toBe(first.versionRevision);
  await expect(commands.create(hq, { ...input, title: 'Different title' })).rejects.toMatchObject({
    code: 'IDEMPOTENCY_CONFLICT',
  });
  expect((await h.repo.version(first.versionId))?.versionLabel).toBe('v1');
});

it('reports an idempotency conflict before looking up a changed CREATE target', async () => {
  const input = createInput();
  await commands.create(hq, input);
  for (const documentId of [`${h.id}:MISSING-001`, `${h.foreignId}:FOREIGN-001`]) {
    await expect(
      commands.create(hq, { ...input, documentId, expectedDocumentRevision: 0 }),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  }
});

it('reauthorizes a create replay after HQ membership is removed', async () => {
  const input = createInput();
  await commands.create(hq, input);
  await h.dc.executeGraphql(
    'mutation($uid:String!){membership_update(key:{uid:$uid},data:{role:SALON})}',
    { variables: { uid: hq } },
  );
  await expect(commands.create(hq, input)).rejects.toMatchObject({ code: 'FORBIDDEN' });
});

it('does not resolve a registered but unuploaded version as an HQ source', async () => {
  const created = await commands.create(hq, createInput());
  expect(await resolveSourceIdentity(h.dc, hq, created.versionId)).toBeNull();
});

it('denies salon and foreign HQ registration without creating a version', async () => {
  const input = createInput();
  await expect(commands.create(salon, input)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  const staged = await commands.create(hq, input);
  await expect(
    commands.create(
      foreign,
      createInput({ documentId: staged.documentId, expectedDocumentRevision: 0 }),
    ),
  ).rejects.toMatchObject({ code: 'FORBIDDEN' });
});

it('concurrent registration reserves distinct sequential version labels', async () => {
  const first = await commands.create(hq, createInput());
  const inputs = [
    createInput({ documentId: first.documentId, expectedDocumentRevision: 0 }),
    createInput({ documentId: first.documentId, expectedDocumentRevision: 0 }),
  ];
  const results = await Promise.all(inputs.map((input) => commands.create(hq, input)));
  const labels = await Promise.all(
    results.map(async (result) => (await h.repo.version(result.versionId))?.versionLabel),
  );
  expect(labels.sort()).toEqual(['v2', 'v3']);
  expect((await h.repo.document(first.documentId))?.nextVersionNumber).toBe(4);
});

it('refuses a legacy NULL cursor for registration and stage before storage writes', async () => {
  const documentCode = 'LEGACY-001';
  const documentId = `${h.id}:${documentCode}`;
  await h.dc.executeGraphql(
    'mutation($id:String!,$businessId:String!,$code:String!){knowledgeDocument_insert(data:{id:$id,businessId:$businessId,documentCode:$code})}',
    { variables: { id: documentId, businessId: h.id, code: documentCode } },
  );
  expect((await h.repo.document(documentId))?.nextVersionNumber).toBeNull();
  await expect(
    commands.create(hq, createInput({ documentId, expectedDocumentRevision: 0 })),
  ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
  const before = h.objectCount();
  await expect(
    h.pipeline(h.id).stageVersion({ ...h.entry, documentId: documentCode }, h.bytes),
  ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
  expect(h.objectCount()).toBe(before);
});

it('refuses an existing Stage retry when its document cursor becomes NULL', async () => {
  const pipeline = h.pipeline(h.id);
  const versionId = await pipeline.stageVersion(h.entry, h.bytes);
  const documentId = (await h.repo.version(versionId))!.documentId;
  await h.dc.executeGraphql(
    'mutation($id:String!){knowledgeDocument_update(id:$id,data:{nextVersionNumber:null})}',
    { variables: { id: documentId } },
  );
  const before = h.objectCount();
  await expect(pipeline.stageVersion(h.entry, h.bytes)).rejects.toMatchObject({
    code: 'VERSION_CONFLICT',
  });
  expect(h.objectCount()).toBe(before);
  expect((await h.repo.document(documentId))?.nextVersionNumber).toBeNull();
});

it('allocates from a validated cursor beyond v100 without a capped history query', async () => {
  const first = await commands.create(hq, createInput());
  const documentCode = (await h.repo.document(first.documentId))!.documentCode;
  await h
    .pipeline(h.id)
    .stageVersion({ ...h.entry, documentId: documentCode, version: 'v101' }, h.bytes);
  expect((await h.repo.document(first.documentId))?.nextVersionNumber).toBe(102);
  const next = await commands.create(
    hq,
    createInput({ documentId: first.documentId, expectedDocumentRevision: 0 }),
  );
  expect((await h.repo.version(next.versionId))?.versionLabel).toBe('v102');
});

it('rejects stale document and version revisions on withdrawal', async () => {
  const created = await commands.create(hq, createInput());
  await expect(
    commands.create(
      hq,
      createInput({ documentId: created.documentId, expectedDocumentRevision: 1 }),
    ),
  ).rejects.toMatchObject({ code: 'STALE_STATE' });
  await expect(
    commands.delete(hq, {
      versionId: created.versionId,
      expectedDocumentRevision: 1,
      expectedVersionRevision: 1,
      idempotencyKey: randomUUID(),
    }),
  ).rejects.toMatchObject({ code: 'STALE_STATE' });
  await expect(
    commands.delete(hq, {
      versionId: created.versionId,
      expectedDocumentRevision: 0,
      expectedVersionRevision: 2,
      idempotencyKey: randomUUID(),
    }),
  ).rejects.toMatchObject({ code: 'STALE_STATE' });
});

it('withdraws a nonactive version without changing the active pointer or document revision', async () => {
  const active = await h.pipeline(h.id).stageVersion(h.entry, h.bytes);
  await h.pipeline(h.id).extractVersion(active);
  const state = (await h.repo.version(active))!;
  await h.pipeline(h.id).recordReview(
    {
      versionId: active,
      pdfSha256: state.pdfSha256,
      extractionHash: state.extractionHash!,
      reviewedPhysicalPages: [1],
      approvalText: 'Approved',
      approvedAt: '2026-10-12',
    },
    { kind: 'operator', id: 'test@example.invalid', businessId: h.id },
  );
  await h.pipeline(h.id).publishVersion({ versionId: active, expectedDocumentRevision: 0 });
  const documentId = state.documentId;
  expect((await h.repo.document(documentId))?.nextVersionNumber).toBe(2);
  const candidate = await commands.create(
    hq,
    createInput({ documentId, expectedDocumentRevision: 1 }),
  );
  const withdrawn = await commands.delete(hq, {
    versionId: candidate.versionId,
    expectedDocumentRevision: 1,
    expectedVersionRevision: 1,
    idempotencyKey: randomUUID(),
  });
  expect(withdrawn.revokedAt).not.toBeNull();
  expect((await h.repo.document(documentId))?.activeVersionId).toBe(active);
  expect((await h.repo.document(documentId))?.revision).toBe(1);
});

it('withdraws the active version without falling back to a prior published version', async () => {
  const pipeline = h.pipeline(h.id);
  const first = await pipeline.stageVersion(h.entry, h.bytes);
  await pipeline.extractVersion(first);
  const state = (await h.repo.version(first))!;
  await pipeline.recordReview(
    {
      versionId: first,
      pdfSha256: state.pdfSha256,
      extractionHash: state.extractionHash!,
      reviewedPhysicalPages: [1],
      approvalText: 'Approved',
      approvedAt: '2026-10-12',
    },
    { kind: 'operator', id: 'test@example.invalid', businessId: h.id },
  );
  await pipeline.publishVersion({ versionId: first, expectedDocumentRevision: 0 });
  const revision = (await h.repo.version(first))!.revision;
  const result = await commands.delete(hq, {
    versionId: first,
    expectedDocumentRevision: 1,
    expectedVersionRevision: revision,
    idempotencyKey: randomUUID(),
  });
  expect(result.revokedAt).not.toBeNull();
  expect((await h.repo.document(state.documentId))?.activeVersionId).toBeNull();
  expect((await h.repo.document(state.documentId))?.revision).toBe(2);
});

it('replays withdrawal by key and rejects a changed withdrawal payload', async () => {
  const created = await commands.create(hq, createInput());
  const input = {
    versionId: created.versionId,
    expectedDocumentRevision: 0,
    expectedVersionRevision: 1,
    idempotencyKey: randomUUID(),
  };
  const first = await commands.delete(hq, input);
  const replay = await commands.delete(hq, input);
  expect(replay).toEqual(first);
  await expect(commands.delete(hq, { ...input, expectedVersionRevision: 2 })).rejects.toMatchObject(
    { code: 'IDEMPOTENCY_CONFLICT' },
  );
});

it('reports an idempotency conflict before looking up a changed DELETE target', async () => {
  const created = await commands.create(hq, createInput());
  const input = {
    versionId: created.versionId,
    expectedDocumentRevision: 0,
    expectedVersionRevision: 1,
    idempotencyKey: randomUUID(),
  };
  await commands.delete(hq, input);
  for (const versionId of [`${h.id}:MISSING-001:v1`, `${h.foreignId}:FOREIGN-001:v1`]) {
    await expect(commands.delete(hq, { ...input, versionId })).rejects.toMatchObject({
      code: 'IDEMPOTENCY_CONFLICT',
    });
  }
});

it('staging older version labels never lowers the allocation cursor', async () => {
  const pipeline = h.pipeline(h.id);
  await pipeline.stageVersion({ ...h.entry, version: 'v3' }, h.bytes);
  expect((await h.repo.document(`${h.id}:DAM-001`))?.nextVersionNumber).toBe(4);
  await pipeline.stageVersion({ ...h.entry, version: 'v0', publicationStatus: 'retired' }, h.bytes);
  expect((await h.repo.document(`${h.id}:DAM-001`))?.nextVersionNumber).toBe(4);
});

it('binds uploaded original identity once and records EXTRACT queue failure durably', async () => {
  const sha256 = h.hash(h.bytes);
  const created = await commands.create(hq, createInput({ sha256 }));
  await sql.bindKnowledgeOriginal(h.dc, {
    uid: hq,
    businessId: h.id,
    versionId: created.versionId,
    pdfSha256: sha256,
    bucket: 'private-test',
    objectPath: canonicalPath(created.versionId, sha256),
    objectGeneration: '1',
    byteSize: h.bytes.length,
    pageCount: 1,
  });
  const bound = (await h.repo.version(created.versionId))!;
  expect(bound.uploadedAt).toBeTruthy();
  expect(bound.pendingStage).toBe('EXTRACT');
  await expect(
    sql.bindKnowledgeOriginal(h.dc, {
      uid: hq,
      businessId: h.id,
      versionId: created.versionId,
      pdfSha256: sha256,
      bucket: 'private-test',
      objectPath: 'knowledge/other.pdf',
      objectGeneration: '2',
      byteSize: h.bytes.length,
      pageCount: 1,
    }),
  ).rejects.toThrow();
  await sql.setKnowledgeDispatchPending(h.dc, {
    uid: hq,
    businessId: h.id,
    versionId: created.versionId,
    revision: bound.revision,
    stage: sql.KnowledgePendingStage.EXTRACT,
    expectedDocumentRevision: 0,
    extractionHash: null,
  });
  await sql.setKnowledgeDispatchFailure(h.dc, {
    versionId: created.versionId,
    revision: bound.revision + 1,
    stage: sql.KnowledgePendingStage.EXTRACT,
    status: sql.KnowledgeProcessingStatus.FAILED,
    errorCode: 'QUEUE_UNAVAILABLE',
    expectedDocumentRevision: 0,
    extractionHash: null,
  });
  expect(await h.repo.version(created.versionId)).toMatchObject({
    status: 'FAILED',
    pendingStage: 'EXTRACT',
    processingError: 'QUEUE_UNAVAILABLE',
    objectPath: canonicalPath(created.versionId, sha256),
  });
});

it.each([
  ['empty bucket', { bucket: '' }],
  ['blank bucket', { bucket: '  ' }],
  ['wrong path', { objectPath: 'knowledge/elsewhere.pdf' }],
  ['zero generation', { objectGeneration: '0' }],
  ['invalid generation', { objectGeneration: '1x' }],
  ['unsafe generation', { objectGeneration: '9007199254740993' }],
  ['undersized bytes', { byteSize: 4 }],
  ['oversized bytes', { byteSize: 10 * 1024 * 1024 + 1 }],
  ['zero pages', { pageCount: 0 }],
  ['too many pages', { pageCount: 31 }],
])('rejects %s before original identity is latched', async (_name, change) => {
  const sha256 = h.hash(h.bytes);
  const created = await commands.create(hq, createInput({ sha256 }));
  const valid = {
    uid: hq,
    businessId: h.id,
    versionId: created.versionId,
    pdfSha256: sha256,
    bucket: 'private-test',
    objectPath: canonicalPath(created.versionId, sha256),
    objectGeneration: '1',
    byteSize: h.bytes.length,
    pageCount: 1,
  };
  await expect(sql.bindKnowledgeOriginal(h.dc, { ...valid, ...change })).rejects.toThrow();
  expect(await h.repo.version(created.versionId)).toMatchObject({
    bucket: null,
    objectPath: null,
    objectGeneration: null,
    contentType: null,
    byteSize: null,
    pageCount: null,
    uploadedAt: null,
    pendingStage: null,
  });
  await sql.bindKnowledgeOriginal(h.dc, valid);
  expect((await h.repo.version(created.versionId))?.objectPath).toBe(valid.objectPath);
});

it.each(['1700000000000000', '9007199254740991'])(
  'binds a representable 16-digit generation %s',
  async (objectGeneration) => {
    const sha256 = h.hash(h.bytes);
    const created = await commands.create(hq, createInput({ sha256 }));
    await sql.bindKnowledgeOriginal(h.dc, {
      uid: hq,
      businessId: h.id,
      versionId: created.versionId,
      pdfSha256: sha256,
      bucket: 'private-test',
      objectPath: canonicalPath(created.versionId, sha256),
      objectGeneration,
      byteSize: h.bytes.length,
      pageCount: 1,
    });
    expect(await h.repo.version(created.versionId)).toMatchObject({
      objectGeneration,
      uploadedAt: expect.any(String),
    });
  },
);

it.each([
  ['document ID', { documentId: 'OTHER-BUSINESS:DOC-MISMATCH-001' }],
  ['version ID', { versionId: 'OTHER-BUSINESS:DOC-MISMATCH-001:v1' }],
  ['numeric label', { versionLabel: 'v2' }],
])(
  'compiled registration rejects a mismatched %s without storing a receipt or row',
  async (_name, change) => {
    const documentCode = 'DOC-MISMATCH-001';
    const documentId = `${h.id}:${documentCode}`;
    const versionId = `${documentId}:v1`;
    const key = randomUUID();
    await expect(
      sql.registerKnowledgeVersion(h.dc, {
        uid: hq,
        businessId: h.id,
        documentId,
        documentCode,
        versionId,
        versionLabel: 'v1',
        nextVersionNumber: 2,
        expectedDocumentRevision: 0,
        newDocument: true,
        existingDocument: false,
        operationId: randomUUID(),
        key,
        payloadHash: 'a'.repeat(64),
        title: 'Identity guard',
        language: 'en',
        sourceType: sql.KnowledgeSourceType.SYNTHETIC_PROCEDURE,
        kind: sql.KnowledgeDocumentKind.PROCEDURE,
        origin: sql.KnowledgeOrigin.SYNTHETIC,
        synthetic: true,
        sourceUrls: [],
        observedOn: null,
        pdfSha256: 'a'.repeat(64),
        ...change,
      }),
    ).rejects.toThrow();
    expect(await h.repo.document(documentId)).toBeNull();
    expect(await h.repo.version(versionId)).toBeNull();
    const context = (
      await sql.knowledgeCommandContext(h.dc, { uid: hq, key, documentId, versionId })
    ).data;
    expect(context.membership?.business.operations).toEqual([]);
  },
);

it('keeps a reviewed READY version retryable when PUBLISH dispatch fails', async () => {
  const pipeline = h.pipeline(h.id);
  const versionId = await pipeline.stageVersion(h.entry, h.bytes);
  await pipeline.extractVersion(versionId);
  const extracted = (await h.repo.version(versionId))!;
  await pipeline.recordReview(
    {
      versionId,
      pdfSha256: extracted.pdfSha256,
      extractionHash: extracted.extractionHash!,
      reviewedPhysicalPages: [1],
      approvalText: 'Approved',
      approvedAt: '2026-10-12',
    },
    { kind: 'operator', id: 'test@example.invalid', businessId: h.id },
  );
  const ready = (await h.repo.version(versionId))!;
  await sql.setKnowledgeDispatchPending(h.dc, {
    uid: hq,
    businessId: h.id,
    versionId,
    revision: ready.revision,
    stage: sql.KnowledgePendingStage.PUBLISH,
    expectedDocumentRevision: 0,
    extractionHash: ready.extractionHash,
  });
  await sql.setKnowledgeDispatchFailure(h.dc, {
    versionId,
    revision: ready.revision + 1,
    stage: sql.KnowledgePendingStage.PUBLISH,
    status: sql.KnowledgeProcessingStatus.READY,
    errorCode: 'QUEUE_UNAVAILABLE',
    expectedDocumentRevision: 0,
    extractionHash: ready.extractionHash,
  });
  expect(await h.repo.version(versionId)).toMatchObject({
    status: 'READY',
    pendingStage: 'PUBLISH',
    processingError: 'QUEUE_UNAVAILABLE',
    publishedAt: null,
  });
});
