import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import * as sql from '@barberhq/server';
import { createKnowledgeHarness } from '../support/knowledge.ts';
import { DocumentCommandService } from '../../functions/src/knowledge/document-commands.ts';
import { createUploadHandler } from '../../functions/src/knowledge/upload.ts';
import { DispatchService } from '../../functions/src/knowledge/queue.ts';
import { processKnowledge } from '../../functions/src/knowledge/worker.ts';
import { KnowledgePipeline } from '../../functions/src/knowledge/pipeline.ts';
import { ReviewPublishService } from '../../functions/src/knowledge/review-publish.ts';
import { knowledgePayloadHash } from '../../functions/src/knowledge/schemas.ts';
import {
  backfillVersionCursors,
  dataConnectCursorRepository,
} from '../../scripts/ingest/backfill-version-cursors.ts';

type KnowledgeHarness = Awaited<ReturnType<typeof createKnowledgeHarness>>;
let h: KnowledgeHarness;
let activeHarness: KnowledgeHarness | undefined;
let hq: string;
let salon: string;
let foreign: string;
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
    throw new Error('Document worker fixture cleanup failed; SDK details suppressed');
});
async function registered(bytes: Uint8Array = h.bytes) {
  return new DocumentCommandService(h.repo).create(hq, {
    title: 'Upload test',
    language: 'en',
    sourceType: 'synthetic-procedure',
    sourceUrls: [],
    observedOn: null,
    sha256: h.hash(bytes),
    idempotencyKey: randomUUID(),
  });
}
async function extractedUpload() {
  const value = await registered();
  const { upload } = handler();
  await upload(request(value.versionId, Buffer.from(h.bytes)), response());
  await processKnowledge(
    { versionId: value.versionId, stage: 'EXTRACT', expectedDocumentRevision: 0 },
    {
      repo: h.repo,
      pipeline: h.pipeline(h.id),
      now: () => new Date('2026-10-16T10:00:00.000Z'),
      createLeaseId: () => randomUUID(),
    },
  );
  return (await h.repo.version(value.versionId))!;
}
function reviewRequest(
  versionId: string,
  extractionHash: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    versionId,
    extractionHash,
    reviewedPhysicalPages: [1],
    expectedDocumentRevision: 0,
    idempotencyKey: randomUUID(),
    ...overrides,
  };
}
function response() {
  return {
    code: 0,
    headers: {} as Record<string, string>,
    body: undefined as unknown,
    status(code: number) {
      this.code = code;
      return this;
    },
    set(name: string, value: string) {
      this.headers[name] = value;
      return this;
    },
    send(body: unknown) {
      this.body = body;
      return this;
    },
    end() {
      return this;
    },
  };
}
function request(versionId: string, rawBody: Buffer, uid = hq) {
  return {
    method: 'POST',
    headers: {
      origin: 'https://allowed.example',
      authorization: `Bearer ${uid}`,
      'x-firebase-appcheck': 'valid',
      'content-type': 'application/pdf',
    },
    query: { versionId },
    rawBody,
  };
}
function handler(enqueue = vi.fn(async () => undefined), emulator = false) {
  const dispatch = new DispatchService(h.repo, enqueue);
  return {
    enqueue,
    dispatch,
    upload: createUploadHandler({
      repo: h.repo,
      dispatch,
      origins: ['https://allowed.example'],
      emulator,
      verifyAuth: async (token) => (['expired', 'revoked'].includes(token) ? null : token),
      verifyAppCheck: async (token) => token === 'valid',
    }),
  };
}

it('allows upload preflight only for the exact configured origin', async () => {
  const { upload } = handler();
  const allowed = response();
  await upload(
    { method: 'OPTIONS', headers: { origin: 'https://allowed.example' }, query: {} },
    allowed,
  );
  expect(allowed.code).toBe(204);
  expect(allowed.headers['Access-Control-Allow-Origin']).toBe('https://allowed.example');
  expect(allowed.headers['Access-Control-Allow-Methods']).toBe('POST, OPTIONS');
  const denied = response();
  await upload(
    { method: 'OPTIONS', headers: { origin: 'https://foreign.example' }, query: {} },
    denied,
  );
  expect(denied.code).toBe(403);
  expect(denied.headers['Access-Control-Allow-Origin']).toBeUndefined();
});

it('rejects rawBody over 10 MiB despite a false small Content-Length before storage', async () => {
  const v = await registered();
  const { upload } = handler();
  const r = response();
  await upload(
    {
      ...request(v.versionId, Buffer.alloc(10 * 1024 * 1024 + 1)),
      headers: { ...request(v.versionId, Buffer.alloc(0)).headers, 'content-length': '5' },
    },
    r,
  );
  expect(r.code).toBe(413);
  expect(h.objectCount()).toBe(0);
});
it('rejects an oversized fallback stream at byte MAX plus one despite small Content-Length', async () => {
  const v = await registered();
  const { upload } = handler();
  const r = response();
  const req = {
    ...request(v.versionId, Buffer.alloc(0)),
    rawBody: undefined,
    headers: { ...request(v.versionId, Buffer.alloc(0)).headers, 'content-length': '5' },
    async *[Symbol.asyncIterator]() {
      yield Buffer.alloc(10 * 1024 * 1024);
      yield Buffer.alloc(1);
    },
  };
  await upload(req, r);
  expect(r.code).toBe(413);
  expect(h.objectCount()).toBe(0);
});
function blankPdf(pageCount: number): Buffer {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${Array.from({ length: pageCount }, (_, i) => `${i + 3} 0 R`).join(' ')}] /Count ${pageCount} >>`,
    ...Array.from(
      { length: pageCount },
      () => '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Resources << >> >>',
    ),
  ];
  let body = '%PDF-1.4\n';
  const offsets = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(body, 'latin1'));
    body += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const start = Buffer.byteLength(body, 'latin1');
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) body += `${String(offset).padStart(10, '0')} 00000 n \n`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
  return Buffer.from(body, 'latin1');
}
it('rejects a parsed PDF with 31 pages before storage', async () => {
  const bytes = blankPdf(31),
    v = await registered(bytes),
    { upload } = handler(),
    r = response();
  await upload(request(v.versionId, bytes), r);
  expect(r.code).toBe(400);
  expect(h.objectCount()).toBe(0);
});
it('rejects bad signature and mismatched hash before storage', async () => {
  const v = await registered();
  const { upload } = handler();
  for (const bytes of [Buffer.from('not-pdf'), Buffer.from('%PDF-not-the-registered-document')]) {
    const r = response();
    await upload(request(v.versionId, bytes), r);
    expect(r.code).toBe(400);
  }
  expect(h.objectCount()).toBe(0);
});
it('accepts only one versionId query field and raw uncompressed application/pdf', async () => {
  const v = await registered(),
    { upload } = handler();
  for (const change of [
    { query: { versionId: v.versionId, extra: 'x' } },
    {
      headers: {
        ...request(v.versionId, Buffer.from(h.bytes)).headers,
        'content-type': 'multipart/form-data',
      },
    },
    {
      headers: {
        ...request(v.versionId, Buffer.from(h.bytes)).headers,
        'content-encoding': 'gzip',
      },
    },
  ]) {
    const r = response();
    await upload({ ...request(v.versionId, Buffer.from(h.bytes)), ...change }, r);
    expect([400, 415]).toContain(r.code);
  }
  expect(h.objectCount()).toBe(0);
});
it('denies expired or revoked auth, missing App Check, salon, foreign HQ, and disallowed origin', async () => {
  const v = await registered();
  const { upload } = handler();
  for (const req of [
    {
      ...request(v.versionId, Buffer.from(h.bytes)),
      headers: {
        ...request(v.versionId, Buffer.from(h.bytes)).headers,
        authorization: 'Bearer expired',
      },
    },
    {
      ...request(v.versionId, Buffer.from(h.bytes)),
      headers: {
        ...request(v.versionId, Buffer.from(h.bytes)).headers,
        authorization: 'Bearer revoked',
      },
    },
    {
      ...request(v.versionId, Buffer.from(h.bytes)),
      headers: { ...request(v.versionId, Buffer.from(h.bytes)).headers, 'x-firebase-appcheck': '' },
    },
    request(v.versionId, Buffer.from(h.bytes), salon),
    request(v.versionId, Buffer.from(h.bytes), foreign),
    {
      ...request(v.versionId, Buffer.from(h.bytes)),
      headers: {
        ...request(v.versionId, Buffer.from(h.bytes)).headers,
        origin: 'https://foreign.example',
      },
    },
  ]) {
    const r = response();
    await upload(req, r);
    expect([401, 403, 404]).toContain(r.code);
  }
  expect(h.objectCount()).toBe(0);
});
it('binds immutable bytes and resumes the same upload after queue failure', async () => {
  const v = await registered();
  const failed = vi.fn().mockRejectedValueOnce(Error('queue down')).mockResolvedValue(undefined);
  const { upload } = handler(failed);
  const first = response();
  await upload(request(v.versionId, Buffer.from(h.bytes)), first);
  expect(first.code).toBe(503);
  expect(await h.repo.version(v.versionId)).toMatchObject({
    status: 'FAILED',
    pendingStage: 'EXTRACT',
    processingError: 'QUEUE_UNAVAILABLE',
  });
  const second = response();
  await upload(request(v.versionId, Buffer.from(h.bytes)), second);
  expect(second.code).toBe(200);
  expect(h.objectCount()).toBe(1);
  expect(failed).toHaveBeenCalledTimes(2);
});
it('resumes the immutable object after SQL bind interruption without overwriting it', async () => {
  const v = await registered();
  const enqueue = vi.fn(async () => undefined);
  const repo = {
    dc: h.repo.dc,
    bucket: h.repo.bucket,
    version: (id: string) => h.repo.version(id),
    putOriginal: async (path: string, bytes: Uint8Array, sha: string) => {
      const object = await h.repo.putOriginal(path, bytes, sha);
      await h.dc.executeGraphql(
        'mutation($uid:String!){membership_update(key:{uid:$uid},data:{role:SALON})}',
        { variables: { uid: hq } },
      );
      return object;
    },
  };
  const upload = createUploadHandler({
    repo,
    dispatch: new DispatchService(h.repo, enqueue),
    origins: ['https://allowed.example'],
    emulator: false,
    verifyAuth: async (token) => token,
    verifyAppCheck: async () => true,
  });
  const first = response();
  await upload(request(v.versionId, Buffer.from(h.bytes)), first);
  expect(first.code).toBe(503);
  expect(h.objectCount()).toBe(1);
  expect((await h.repo.version(v.versionId))?.objectPath).toBeNull();
  await h.dc.executeGraphql(
    'mutation($uid:String!){membership_update(key:{uid:$uid},data:{role:HQ})}',
    { variables: { uid: hq } },
  );
  const second = response();
  await handler(enqueue).upload(request(v.versionId, Buffer.from(h.bytes)), second);
  expect(second.code).toBe(200);
  expect(h.objectCount()).toBe(1);
  expect(enqueue).toHaveBeenCalledOnce();
});
it('rejects a delayed queue failure after a newer dispatch or withdrawal', async () => {
  const v = await registered();
  const { upload, dispatch } = handler();
  await upload(request(v.versionId, Buffer.from(h.bytes)), response());
  const first = (await h.repo.version(v.versionId))!;
  await dispatch.dispatch(hq, v.versionId);
  await expect(
    sql.setKnowledgeDispatchFailure(h.dc, {
      versionId: v.versionId,
      revision: first.revision,
      stage: sql.KnowledgePendingStage.EXTRACT,
      status: sql.KnowledgeProcessingStatus.FAILED,
      errorCode: 'QUEUE_UNAVAILABLE',
      expectedDocumentRevision: 0,
      extractionHash: null,
    }),
  ).rejects.toThrow();
  expect((await h.repo.version(v.versionId))?.processingError).toBeNull();
  const state = (await h.repo.version(v.versionId))!;
  await new DocumentCommandService(h.repo).delete(hq, {
    versionId: v.versionId,
    expectedDocumentRevision: 0,
    expectedVersionRevision: state.revision,
    idempotencyKey: randomUUID(),
  });
  await expect(
    sql.setKnowledgeDispatchFailure(h.dc, {
      versionId: v.versionId,
      revision: state.revision,
      stage: sql.KnowledgePendingStage.EXTRACT,
      status: sql.KnowledgeProcessingStatus.FAILED,
      errorCode: 'QUEUE_UNAVAILABLE',
      expectedDocumentRevision: 0,
      extractionHash: null,
    }),
  ).rejects.toThrow();
  expect((await h.repo.version(v.versionId))?.revokedAt).toBeTruthy();
});
it('records RETRY receipts, rejects changed payload and allows a new key after uncertain dispatch', async () => {
  const v = await registered();
  const enqueue = vi
    .fn()
    .mockRejectedValueOnce(Error('ambiguous'))
    .mockRejectedValueOnce(Error('ambiguous again'))
    .mockResolvedValue(undefined);
  const { upload, dispatch } = handler(enqueue);
  await upload(request(v.versionId, Buffer.from(h.bytes)), response());
  const input = { versionId: v.versionId, sha256: h.hash(h.bytes), idempotencyKey: randomUUID() };
  await expect(dispatch.retry(hq, input)).resolves.toMatchObject({
    versionId: v.versionId,
    status: 'FAILED',
    errorCode: 'QUEUE_UNAVAILABLE',
  });
  await expect(dispatch.retry(hq, input)).resolves.toMatchObject({
    versionId: v.versionId,
    status: 'FAILED',
  });
  await expect(dispatch.retry(hq, { ...input, sha256: 'b'.repeat(64) })).rejects.toMatchObject({
    code: 'IDEMPOTENCY_CONFLICT',
  });
  await expect(
    dispatch.retry(hq, { ...input, versionId: `${h.foreignId}:MISSING:v1` }),
  ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  await expect(
    dispatch.retry(hq, { ...input, versionId: `${h.id}:MISSING:v1` }),
  ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  await expect(
    dispatch.retry(hq, { ...input, idempotencyKey: randomUUID() }),
  ).resolves.toMatchObject({ versionId: v.versionId });
});
it.each(['EXTRACTED', 'READY'] as const)(
  'replays a completed RETRY receipt after %s without redispatching',
  async (progressedStatus) => {
    const v = await registered(),
      enqueue = vi.fn(async () => undefined),
      { upload, dispatch } = handler(enqueue);
    await upload(request(v.versionId, Buffer.from(h.bytes)), response());
    const input = { versionId: v.versionId, sha256: h.hash(h.bytes), idempotencyKey: randomUUID() };
    await dispatch.retry(hq, input);
    await h.dc.executeGraphql(
      'mutation($id:String!,$status:KnowledgeProcessingStatus!){knowledgeVersion_update(id:$id,data:{status:$status,pendingStage:null,processingError:null})}',
      { variables: { id: v.versionId, status: progressedStatus } },
    );
    const calls = enqueue.mock.calls.length;
    await expect(dispatch.retry(hq, input)).resolves.toMatchObject({
      versionId: v.versionId,
      status: progressedStatus,
    });
    expect(enqueue).toHaveBeenCalledTimes(calls);
    await expect(dispatch.retry(hq, { ...input, sha256: 'b'.repeat(64) })).rejects.toMatchObject({
      code: 'IDEMPOTENCY_CONFLICT',
    });
    await expect(dispatch.retry(foreign, input)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    const state = (await h.repo.version(v.versionId))!;
    await new DocumentCommandService(h.repo).delete(hq, {
      versionId: v.versionId,
      expectedDocumentRevision: 0,
      expectedVersionRevision: state.revision,
      idempotencyKey: randomUUID(),
    });
    await expect(dispatch.retry(hq, input)).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
    await h.dc.executeGraphql(
      'mutation($uid:String!){membership_update(key:{uid:$uid},data:{role:SALON})}',
      { variables: { uid: hq } },
    );
    await expect(dispatch.retry(hq, input)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  },
);
it.each(['EXTRACTED', 'READY'] as const)(
  'finalizes a pending RETRY receipt after %s without redispatching',
  async (progressedStatus) => {
    const v = await registered(),
      enqueue = vi.fn(async () => undefined),
      { upload, dispatch } = handler(enqueue);
    await upload(request(v.versionId, Buffer.from(h.bytes)), response());
    const input = { versionId: v.versionId, sha256: h.hash(h.bytes), idempotencyKey: randomUUID() };
    await sql.startKnowledgeRetry(h.dc, {
      uid: hq,
      businessId: h.id,
      versionId: v.versionId,
      documentId: v.documentId,
      operationId: randomUUID(),
      key: input.idempotencyKey,
      payloadHash: knowledgePayloadHash('RETRY', input),
      pdfSha256: input.sha256,
      retryStage: sql.KnowledgePendingStage.EXTRACT,
    });
    await h.dc.executeGraphql(
      'mutation($id:String!,$status:KnowledgeProcessingStatus!){knowledgeVersion_update(id:$id,data:{status:$status,pendingStage:null,processingError:null})}',
      { variables: { id: v.versionId, status: progressedStatus } },
    );
    const calls = enqueue.mock.calls.length;
    await expect(dispatch.retry(hq, input)).resolves.toMatchObject({
      versionId: v.versionId,
      status: progressedStatus,
    });
    expect(enqueue).toHaveBeenCalledTimes(calls);
    const context = (
      await sql.knowledgeCommandContext(h.dc, {
        uid: hq,
        key: input.idempotencyKey,
        documentId: '',
        versionId: v.versionId,
      })
    ).data;
    expect(context.membership?.business.operations[0]?.completedAt).toBeTruthy();
  },
);
it('returns accepted same-byte upload while EXTRACT has a lease without redispatch', async () => {
  const v = await registered(),
    enqueue = vi.fn(async () => undefined),
    { upload } = handler(enqueue);
  await upload(request(v.versionId, Buffer.from(h.bytes)), response());
  await h.dc.executeGraphql(
    'mutation($id:String!){knowledgeVersion_update(id:$id,data:{processingLeaseId:"active-lease"})}',
    { variables: { id: v.versionId } },
  );
  const second = response();
  await upload(request(v.versionId, Buffer.from(h.bytes)), second);
  expect(second.code).toBe(200);
  expect(second.body).toMatchObject({ versionId: v.versionId, status: 'STAGED' });
  expect(enqueue).toHaveBeenCalledOnce();
});
it('redispatches PUBLISH from stored revision and extraction hash without substituting current document revision', async () => {
  const pipeline = h.pipeline(h.id),
    versionId = await pipeline.stageVersion(h.entry, h.bytes);
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
  await h.dc.executeGraphql(
    'mutation($id:String!){knowledgeDocument_update(id:$id,data:{revision:1})}',
    { variables: { id: ready.documentId } },
  );
  const enqueue = vi.fn(async () => undefined),
    dispatch = new DispatchService(h.repo, enqueue);
  await expect(
    dispatch.retry(hq, { versionId, sha256: ready.pdfSha256, idempotencyKey: randomUUID() }),
  ).resolves.toMatchObject({ status: 'READY' });
  expect(enqueue).toHaveBeenCalledWith({
    versionId,
    stage: 'PUBLISH',
    expectedDocumentRevision: 0,
    extractionHash: ready.extractionHash,
  });
  expect((await h.repo.version(versionId))?.pendingDocumentRevision).toBe(0);
});
it('finalizes an old pending EXTRACT RETRY receipt at READY with PUBLISH pending without dispatching PUBLISH', async () => {
  const v = await registered(),
    enqueue = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(Error('ambiguous'))
      .mockResolvedValue(undefined);
  const { upload, dispatch } = handler(enqueue);
  await upload(request(v.versionId, Buffer.from(h.bytes)), response());
  const input = { versionId: v.versionId, sha256: h.hash(h.bytes), idempotencyKey: randomUUID() };
  await expect(dispatch.retry(hq, input)).resolves.toMatchObject({
    status: 'FAILED',
    errorCode: 'QUEUE_UNAVAILABLE',
  });
  await h.pipeline(h.id).extractVersion(v.versionId);
  const extracted = (await h.repo.version(v.versionId))!;
  await h.pipeline(h.id).recordReview(
    {
      versionId: v.versionId,
      pdfSha256: extracted.pdfSha256,
      extractionHash: extracted.extractionHash!,
      reviewedPhysicalPages: [1],
      approvalText: 'Approved',
      approvedAt: '2026-10-12',
    },
    { kind: 'operator', id: 'test@example.invalid', businessId: h.id },
  );
  const ready = (await h.repo.version(v.versionId))!;
  await sql.setKnowledgeDispatchPending(h.dc, {
    uid: hq,
    businessId: h.id,
    versionId: v.versionId,
    revision: ready.revision,
    stage: sql.KnowledgePendingStage.PUBLISH,
    expectedDocumentRevision: 0,
    extractionHash: ready.extractionHash,
  });
  const calls = enqueue.mock.calls.length;
  await expect(dispatch.retry(hq, input)).resolves.toMatchObject({
    versionId: v.versionId,
    status: 'READY',
  });
  expect(enqueue).toHaveBeenCalledTimes(calls);
  const op = (
    await sql.knowledgeCommandContext(h.dc, {
      uid: hq,
      key: input.idempotencyKey,
      documentId: '',
      versionId: v.versionId,
    })
  ).data.membership?.business.operations[0];
  expect(op?.retryStage).toBe('EXTRACT');
  expect(op?.completedAt).toBeTruthy();
});
it('resumes a pending PUBLISH RETRY receipt with the same key while PUBLISH remains pending', async () => {
  const pipeline = h.pipeline(h.id),
    versionId = await pipeline.stageVersion(h.entry, h.bytes);
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
  const enqueue = vi.fn().mockRejectedValueOnce(Error('queue down')).mockResolvedValue(undefined),
    dispatch = new DispatchService(h.repo, enqueue);
  const input = { versionId, sha256: ready.pdfSha256, idempotencyKey: randomUUID() };
  await expect(dispatch.retry(hq, input)).resolves.toMatchObject({
    status: 'READY',
    errorCode: 'QUEUE_UNAVAILABLE',
  });
  await expect(dispatch.retry(hq, input)).resolves.toMatchObject({ status: 'READY' });
  expect(enqueue).toHaveBeenCalledTimes(2);
  expect(enqueue.mock.calls.every(([job]) => job.stage === 'PUBLISH')).toBe(true);
  const op = (
    await sql.knowledgeCommandContext(h.dc, {
      uid: hq,
      key: input.idempotencyKey,
      documentId: '',
      versionId,
    })
  ).data.membership?.business.operations[0];
  expect(op).toMatchObject({ retryStage: 'PUBLISH', completedAt: expect.any(String) });
});
it('compiled RETRY insert rejects a stage different from the pending version stage', async () => {
  const v = await registered(),
    { upload } = handler();
  await upload(request(v.versionId, Buffer.from(h.bytes)), response());
  const input = { versionId: v.versionId, sha256: h.hash(h.bytes), idempotencyKey: randomUUID() };
  await expect(
    sql.startKnowledgeRetry(h.dc, {
      uid: hq,
      businessId: h.id,
      versionId: v.versionId,
      documentId: v.documentId,
      operationId: randomUUID(),
      key: input.idempotencyKey,
      payloadHash: knowledgePayloadHash('RETRY', input),
      pdfSha256: input.sha256,
      retryStage: sql.KnowledgePendingStage.PUBLISH,
    }),
  ).rejects.toThrow();
  const op = (
    await sql.knowledgeCommandContext(h.dc, {
      uid: hq,
      key: input.idempotencyKey,
      documentId: '',
      versionId: v.versionId,
    })
  ).data.membership?.business.operations[0];
  expect(op).toBeUndefined();
});
it('returns current extracted state on identical upload without redispatching', async () => {
  const v = await registered(),
    enqueue = vi.fn(async () => undefined),
    { upload } = handler(enqueue);
  await upload(request(v.versionId, Buffer.from(h.bytes)), response());
  await h.dc.executeGraphql(
    'mutation($id:String!){knowledgeVersion_update(id:$id,data:{status:EXTRACTED,pendingStage:null})}',
    { variables: { id: v.versionId } },
  );
  const second = response();
  await upload(request(v.versionId, Buffer.from(h.bytes)), second);
  expect(second.code).toBe(200);
  expect(second.body).toMatchObject({ status: 'EXTRACTED' });
  expect(enqueue).toHaveBeenCalledOnce();
});
it('RED: duplicate EXTRACT delivery does not embed twice or create duplicate chunks', async () => {
  const v = await registered(),
    { upload } = handler();
  await upload(request(v.versionId, Buffer.from(h.bytes)), response());
  let embeddings = 0;
  const pipeline = h.pipeline(h.id);
  const embedder = {
    ...pipeline.embedder,
    embedTexts: async (texts: string[]) => {
      embeddings++;
      return texts.map(() => h.makeVector(0.8, 0.6));
    },
  };
  const workerPipeline = new KnowledgePipeline(h.repo, embedder, h.id, 'not-bad-stuff-demo');
  const job = { versionId: v.versionId, stage: 'EXTRACT' as const, expectedDocumentRevision: 0 };
  const deps = {
    repo: h.repo,
    pipeline: workerPipeline,
    now: () => new Date('2026-10-16T10:00:00.000Z'),
    createLeaseId: () => randomUUID(),
  };
  await expect(processKnowledge(job, deps)).resolves.toMatchObject({ status: 'EXTRACTED' });
  const first = (await h.repo.version(v.versionId))!;
  await expect(processKnowledge(job, deps)).resolves.toMatchObject({ status: 'EXTRACTED' });
  const second = (await h.repo.version(v.versionId))!;
  expect(second.processingAttempt).toBe(first.processingAttempt);
  expect(second.chunks).toHaveLength(first.chunks.length);
  expect(embeddings).toBe(1);
});
it('RED: expired extraction lease can be reclaimed with a new revision and token', async () => {
  const v = await registered(),
    { upload } = handler();
  await upload(request(v.versionId, Buffer.from(h.bytes)), response());
  const before = (await h.repo.version(v.versionId))!;
  const first = await h.repo.claimExtraction({
    versionId: v.versionId,
    revision: before.revision,
    expectedDocumentRevision: 0,
    pdfSha256: before.pdfSha256,
    leaseId: 'lease-first',
    now: new Date('2026-10-16T10:00:00.000Z'),
    expiresAt: new Date('2026-10-16T10:06:00.000Z'),
  });
  const second = await h.repo.claimExtraction({
    versionId: v.versionId,
    revision: first.revision,
    expectedDocumentRevision: 0,
    pdfSha256: before.pdfSha256,
    leaseId: 'lease-second',
    now: new Date('2026-10-16T10:06:01.000Z'),
    expiresAt: new Date('2026-10-16T10:12:01.000Z'),
  });
  expect(second).toMatchObject({ revision: first.revision + 1, leaseId: 'lease-second' });
  expect(await h.repo.version(v.versionId)).toMatchObject({
    processingLeaseId: 'lease-second',
    processingAttempt: 2,
  });
});
it('RED: a duplicate EXTRACT delivery with a live lease fails retriably', async () => {
  const v = await registered(),
    { upload } = handler();
  await upload(request(v.versionId, Buffer.from(h.bytes)), response());
  const before = (await h.repo.version(v.versionId))!;
  await h.repo.claimExtraction({
    versionId: v.versionId,
    revision: before.revision,
    expectedDocumentRevision: 0,
    pdfSha256: before.pdfSha256,
    leaseId: 'lease-active',
    now: new Date('2026-10-16T10:00:00.000Z'),
    expiresAt: new Date('2026-10-16T10:06:00.000Z'),
  });
  await expect(
    processKnowledge(
      { versionId: v.versionId, stage: 'EXTRACT', expectedDocumentRevision: 0 },
      { repo: h.repo, pipeline: h.pipeline(h.id), now: () => new Date('2026-10-16T10:01:00.000Z') },
    ),
  ).rejects.toMatchObject({ code: 'LEASE_ACTIVE' });
  expect((await h.repo.version(v.versionId))?.processingAttempt).toBe(1);
});
it('RED: an EXTRACT job with an obsolete document revision cannot claim a newer dispatch', async () => {
  const v = await registered(),
    { upload, dispatch } = handler();
  await upload(request(v.versionId, Buffer.from(h.bytes)), response());
  await dispatch.dispatch(hq, v.versionId);
  const before = (await h.repo.version(v.versionId))!;
  const result = await processKnowledge(
    { versionId: v.versionId, stage: 'EXTRACT', expectedDocumentRevision: 1 },
    { repo: h.repo, pipeline: h.pipeline(h.id), now: () => new Date('2026-10-16T10:01:00.000Z') },
  );
  expect(result).toMatchObject({ status: 'STAGED', retryable: false });
  expect((await h.repo.version(v.versionId))?.processingAttempt).toBe(before.processingAttempt);
  expect((await h.repo.version(v.versionId))?.processingLeaseId).toBeNull();
});
it('RED: worker save clears EXTRACT intent so the reviewed version can start PUBLISH', async () => {
  const v = await registered(),
    { upload } = handler();
  await upload(request(v.versionId, Buffer.from(h.bytes)), response());
  await processKnowledge(
    { versionId: v.versionId, stage: 'EXTRACT', expectedDocumentRevision: 0 },
    {
      repo: h.repo,
      pipeline: h.pipeline(h.id),
      now: () => new Date('2026-10-16T10:00:00.000Z'),
      createLeaseId: () => randomUUID(),
    },
  );
  const extracted = (await h.repo.version(v.versionId))!;
  expect(extracted).toMatchObject({
    status: 'EXTRACTED',
    pendingStage: null,
    pendingDocumentRevision: null,
    pendingExtractionHash: null,
  });
  await h.pipeline(h.id).recordReview(
    {
      versionId: v.versionId,
      pdfSha256: extracted.pdfSha256,
      extractionHash: extracted.extractionHash!,
      reviewedPhysicalPages: [1],
      approvalText: 'Approved',
      approvedAt: '2026-10-16',
    },
    { kind: 'operator', id: 'test@example.invalid', businessId: h.id },
  );
  const ready = (await h.repo.version(v.versionId))!;
  await sql.setKnowledgeDispatchPending(h.dc, {
    uid: hq,
    businessId: h.id,
    versionId: v.versionId,
    revision: ready.revision,
    stage: sql.KnowledgePendingStage.PUBLISH,
    expectedDocumentRevision: 0,
    extractionHash: ready.extractionHash,
  });
  expect(await h.repo.version(v.versionId)).toMatchObject({
    status: 'READY',
    pendingStage: 'PUBLISH',
    pendingDocumentRevision: 0,
    pendingExtractionHash: ready.extractionHash,
  });
});
it('RED: HQ review rejects incomplete pages and a changed extraction identity before creating a receipt', async () => {
  const version = await extractedUpload(),
    service = new ReviewPublishService({
      repo: h.repo,
      pipeline: h.pipeline(h.id),
      enqueue: vi.fn(async () => undefined),
    });
  const changed = reviewRequest(version.id, 'f'.repeat(64));
  await expect(service.reviewAndPublishDocument(hq, changed)).rejects.toMatchObject({
    code: 'REVIEW_IDENTITY_MISMATCH',
  });
  const incomplete = reviewRequest(version.id, version.extractionHash!, {
    reviewedPhysicalPages: [1, 1],
  });
  await expect(service.reviewAndPublishDocument(hq, incomplete)).rejects.toMatchObject({
    code: 'REVIEW_INCOMPLETE',
  });
  expect((await h.repo.version(version.id))?.status).toBe('EXTRACTED');
});
it('RED: same review key resumes after response loss between REVIEWED and PUBLISH intent', async () => {
  const version = await extractedUpload(),
    pipeline = h.pipeline(h.id),
    enqueue = vi.fn(async () => undefined);
  let calls = 0;
  const interrupted = {
    embedder: pipeline.embedder,
    publishVersion: pipeline.publishVersion.bind(pipeline),
    recordReview: async (...args: Parameters<typeof pipeline.recordReview>) => {
      await pipeline.recordReview(...args);
      if (calls++ === 0) throw Error('simulated response loss after review');
    },
  };
  const service = new ReviewPublishService({ repo: h.repo, pipeline: interrupted, enqueue });
  const input = reviewRequest(version.id, version.extractionHash!);
  await expect(service.reviewAndPublishDocument(hq, input)).rejects.toThrow(
    'simulated response loss',
  );
  expect(await h.repo.version(version.id)).toMatchObject({
    status: 'READY',
    reviewedBy: `hq:${hq}`,
    pendingStage: null,
  });
  await expect(service.reviewAndPublishDocument(hq, input)).resolves.toMatchObject({
    status: 'READY',
  });
  expect(enqueue).toHaveBeenCalledOnce();
  const receipt = (
    await sql.knowledgeCommandContext(h.dc, {
      uid: hq,
      key: input.idempotencyKey,
      documentId: '',
      versionId: version.id,
    })
  ).data.membership?.business.operations[0];
  expect(receipt).toMatchObject({
    action: 'REVIEW',
    payloadHash: knowledgePayloadHash('REVIEW', input),
    completedAt: expect.any(String),
  });
});
it('RED: queue failure keeps exact PUBLISH intent and same-key review retry dispatches it', async () => {
  const version = await extractedUpload(),
    enqueue = vi
      .fn()
      .mockRejectedValueOnce(Error('queue unavailable'))
      .mockResolvedValue(undefined);
  const service = new ReviewPublishService({ repo: h.repo, pipeline: h.pipeline(h.id), enqueue });
  const input = reviewRequest(version.id, version.extractionHash!);
  await expect(service.reviewAndPublishDocument(hq, input)).resolves.toMatchObject({
    status: 'READY',
    retryable: true,
    errorCode: 'QUEUE_UNAVAILABLE',
  });
  const pending = (await h.repo.version(version.id))!;
  expect(pending).toMatchObject({
    pendingStage: 'PUBLISH',
    pendingDocumentRevision: 0,
    pendingExtractionHash: version.extractionHash,
  });
  await expect(service.reviewAndPublishDocument(hq, input)).resolves.toMatchObject({
    status: 'READY',
    retryable: false,
  });
  expect(enqueue).toHaveBeenCalledTimes(2);
  expect(enqueue.mock.calls.map(([job]) => job)).toEqual(
    Array(2).fill({
      versionId: version.id,
      stage: 'PUBLISH',
      expectedDocumentRevision: 0,
      extractionHash: version.extractionHash,
    }),
  );
});
it('RED: PUBLISH worker reloads SQL intent and atomically makes reviewed version active', async () => {
  const version = await extractedUpload(),
    jobs: unknown[] = [],
    service = new ReviewPublishService({
      repo: h.repo,
      pipeline: h.pipeline(h.id),
      enqueue: async (job) => {
        jobs.push(job);
      },
    });
  await service.reviewAndPublishDocument(hq, reviewRequest(version.id, version.extractionHash!));
  await expect(
    processKnowledge(jobs[0], { repo: h.repo, pipeline: h.pipeline(h.id) }),
  ).resolves.toMatchObject({ status: 'READY', retryable: false });
  expect(await h.repo.document(version.documentId)).toMatchObject({
    activeVersionId: version.id,
    revision: 1,
  });
  expect(await h.repo.version(version.id)).toMatchObject({
    publishedAt: expect.any(String),
    isActive: true,
    pendingStage: null,
    pendingDocumentRevision: null,
    pendingExtractionHash: null,
    processingError: null,
  });
});
it('RED: same REVIEW key replays while PUBLISH is pending and after publication, with changed payload conflicts in both states', async () => {
  const version = await extractedUpload(),
    jobs: unknown[] = [],
    enqueue = vi.fn(async (job: unknown) => {
      jobs.push(job);
    });
  const service = new ReviewPublishService({ repo: h.repo, pipeline: h.pipeline(h.id), enqueue });
  const input = reviewRequest(version.id, version.extractionHash!);
  await service.reviewAndPublishDocument(hq, input);
  await expect(service.reviewAndPublishDocument(hq, input)).resolves.toMatchObject({
    status: 'READY',
  });
  expect(enqueue).toHaveBeenCalledTimes(2);
  await expect(
    service.reviewAndPublishDocument(hq, { ...input, reviewedPhysicalPages: [1, 1] }),
  ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  await processKnowledge(jobs[0], { repo: h.repo, pipeline: h.pipeline(h.id) });
  await expect(service.reviewAndPublishDocument(hq, input)).resolves.toMatchObject({
    status: 'READY',
    retryable: false,
  });
  await expect(
    service.reviewAndPublishDocument(hq, { ...input, reviewedPhysicalPages: [1, 1] }),
  ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
});
it('RED: failed embedding is durable and preserves the previous active version', async () => {
  const pipeline = h.pipeline(h.id);
  const oldVersionId = await pipeline.stageVersion(h.entry, h.bytes);
  await pipeline.extractVersion(oldVersionId);
  const extracted = (await h.repo.version(oldVersionId))!;
  await pipeline.recordReview(
    {
      versionId: oldVersionId,
      pdfSha256: extracted.pdfSha256,
      extractionHash: extracted.extractionHash!,
      reviewedPhysicalPages: [1],
      approvalText: 'Approved',
      approvedAt: '2026-10-16',
    },
    { kind: 'operator', id: 'test@example.invalid', businessId: h.id },
  );
  await pipeline.publishVersion({ versionId: oldVersionId, expectedDocumentRevision: 0 });
  const replacement = await pipeline.stageVersion({ ...h.entry, version: 'v2' }, h.bytes);
  await h.dc.executeGraphql(
    'mutation($id:String!){knowledgeVersion_update(id:$id,data:{uploadedAt_expr:"request.time",pendingStage:EXTRACT,pendingDocumentRevision:1})}',
    { variables: { id: replacement } },
  );
  const failingPipeline = new KnowledgePipeline(
    h.repo,
    {
      config: h.config,
      embedTexts: async () => {
        throw Error('embedding unavailable');
      },
    },
    h.id,
    'not-bad-stuff-demo',
  );
  await expect(
    processKnowledge(
      { versionId: replacement, stage: 'EXTRACT', expectedDocumentRevision: 1 },
      {
        repo: h.repo,
        pipeline: failingPipeline,
        now: () => new Date('2026-10-16T10:00:00.000Z'),
        createLeaseId: () => randomUUID(),
      },
    ),
  ).rejects.toThrow('embedding unavailable');
  expect(await h.repo.document(extracted.documentId)).toMatchObject({
    activeVersionId: oldVersionId,
    revision: 1,
  });
  expect(await h.repo.version(replacement)).toMatchObject({
    status: 'FAILED',
    processingError: 'EMBEDDING_FAILED',
    pendingStage: 'EXTRACT',
    processingLeaseId: null,
  });
});
it('RED: a stale extraction worker cannot save pages or clear a newer lease after reclaim', async () => {
  const v = await registered(),
    { upload } = handler();
  await upload(request(v.versionId, Buffer.from(h.bytes)), response());
  const before = (await h.repo.version(v.versionId))!;
  const first = await h.repo.claimExtraction({
    versionId: v.versionId,
    revision: before.revision,
    expectedDocumentRevision: 0,
    pdfSha256: before.pdfSha256,
    leaseId: 'lease-first',
    now: new Date('2026-10-16T10:00:00.000Z'),
    expiresAt: new Date('2026-10-16T10:06:00.000Z'),
  });
  const second = await h.repo.claimExtraction({
    versionId: v.versionId,
    revision: first.revision,
    expectedDocumentRevision: 0,
    pdfSha256: before.pdfSha256,
    leaseId: 'lease-second',
    now: new Date('2026-10-16T10:06:01.000Z'),
    expiresAt: new Date('2026-10-16T10:12:01.000Z'),
  });
  await expect(
    h.repo.page({
      versionId: v.versionId,
      revision: first.revision,
      leaseId: 'lease-first',
      pdfSha256: before.pdfSha256,
      physicalPage: 1,
      text: 'stale',
      markdown: 'stale',
      spans: [],
      quality: sql.KnowledgePageQuality.COMPLETE,
      viewBox: [0, 0, 100, 100],
      userUnit: 1,
      rotation: 0,
    }),
  ).rejects.toThrow();
  await expect(
    h.repo.failExtraction({
      versionId: v.versionId,
      revision: first.revision,
      leaseId: 'lease-first',
      pdfSha256: before.pdfSha256,
      errorCode: 'EMBEDDING_FAILED',
    }),
  ).rejects.toThrow();
  expect(await h.repo.version(v.versionId)).toMatchObject({
    revision: second.revision,
    processingLeaseId: 'lease-second',
    status: 'STAGED',
  });
});
it('backfills a NULL cursor from every paged label without changing publication revision', async () => {
  const v = await registered();
  await h.dc.executeGraphql(
    'mutation($id:String!){knowledgeDocument_update(id:$id,data:{nextVersionNumber:null})}',
    { variables: { id: v.documentId } },
  );
  const repo = dataConnectCursorRepository(h.dc, h.id);
  const dry = await backfillVersionCursors(repo, h.id, false, 1);
  expect(dry.changes).toEqual([{ documentId: v.documentId, from: null, to: 2 }]);
  expect((await h.repo.document(v.documentId))?.nextVersionNumber).toBeNull();
  await backfillVersionCursors(repo, h.id, true, 1);
  expect(await h.repo.document(v.documentId)).toMatchObject({
    nextVersionNumber: 2,
    revision: 0,
    activeVersionId: null,
  });
});
