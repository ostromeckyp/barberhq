import { afterEach, beforeEach, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createKnowledgeHarness } from '../support/knowledge.ts';
import { resetRecords } from '../../scripts/seed/reset.ts';
import { DocumentCommandService } from '../../functions/src/knowledge/document-commands.ts';
import {
  createSourceHandler,
  resolveSourceIdentity,
} from '../../functions/src/knowledge/source.ts';
import type { SourceResponse } from '../../functions/src/knowledge/source.ts';
import { seedRecords } from '../../scripts/seed/business.ts';
import { validateSeed } from '../../scripts/prepare-data/catalog.ts';
import { readFileSync } from 'node:fs';

let h: Awaited<ReturnType<typeof createKnowledgeHarness>>;
let hq: string;
let commands: DocumentCommandService;
const memberMutation =
  'mutation($uid:String!,$businessId:String!,$role:MemberRole!){membership_insert(data:{uid:$uid,businessId:$businessId,role:$role})}';

beforeEach(async () => {
  h = await createKnowledgeHarness();
  hq = `hq-${randomUUID()}`;
  await h.dc.executeGraphql(memberMutation, {
    variables: { uid: hq, businessId: h.id, role: 'HQ' },
  });
  commands = new DocumentCommandService(h.repo);
});
afterEach(async () => {
  if (!h) return;
  await h.dc.executeGraphql('mutation($uid:String!){membership_delete(key:{uid:$uid})}', {
    variables: { uid: hq },
  });
  await h.dispose();
});

async function published(version: string, documentId?: string) {
  const pipeline = h.pipeline(h.id);
  const versionId = await pipeline.stageVersion(
    { ...h.entry, documentId: documentId ?? h.entry.documentId, version },
    h.bytes,
  );
  await pipeline.extractVersion(versionId);
  const state = (await h.repo.version(versionId))!;
  await pipeline.recordReview(
    {
      versionId,
      pdfSha256: state.pdfSha256,
      extractionHash: state.extractionHash!,
      reviewedPhysicalPages: Array.from({ length: state.pageCount! }, (_, i) => i + 1),
      approvalText: `Reviewed ${version}`,
      approvedAt: '2026-10-19',
    },
    { kind: 'operator', id: 'acceptance@example.invalid', businessId: h.id },
  );
  await pipeline.publishVersion({ versionId, expectedDocumentRevision: state.document.revision });
  return versionId;
}

async function knowledgeSnapshot() {
  const result = await h.dc.executeGraphql(
    `query($businessId:String!){
    knowledgeDocuments(where:{businessId:{eq:$businessId}},orderBy:[{id:ASC}]){id documentCode activeVersionId revision nextVersionNumber}
    knowledgeVersions(where:{businessId:{eq:$businessId}},orderBy:[{id:ASC}]){id documentId versionLabel title language sourceType publicationStatus synthetic sourceUrls observedOn status revision bucket objectPath objectGeneration pdfSha256 contentType byteSize pageCount uploadedAt pendingStage pendingDocumentRevision pendingExtractionHash parserVersion extractionHash embeddingConfigHash expectedChunkCount reviewedBy reviewedAt reviewedPageCount publishedAt isActive revokedAt processingError processingAttempt createdAt}
    knowledgeOperations(where:{businessId:{eq:$businessId}},orderBy:[{id:ASC}]){id actorUid idempotencyKey action retryStage payloadHash documentId versionId completedAt createdAt}
    knowledgePages(where:{version:{businessId:{eq:$businessId}}},orderBy:[{versionId:ASC},{physicalPage:ASC}]){versionId physicalPage text markdown spans printedLabel quality reviewed viewBox userUnit rotation}
    knowledgeChunks(where:{version:{businessId:{eq:$businessId}}},orderBy:[{versionId:ASC},{physicalPage:ASC},{ordinal:ASC}]){id versionId physicalPage ordinal sectionId heading text start end rects geometryStatus embedding embeddingModel embeddingDimension embeddingConfigHash}
  }`,
    { variables: { businessId: h.id } },
  );
  return result.data;
}

function sourceRequest() {
  const response = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this as unknown as SourceResponse;
    },
    set(name: string, value: string) {
      this.headers[name.toLowerCase()] = value;
      return this as unknown as SourceResponse;
    },
    send(body: unknown) {
      this.body = body;
      return this as unknown as SourceResponse;
    },
    end() {
      return this as unknown as SourceResponse;
    },
  };
  return {
    response,
    request: {
      method: 'GET',
      headers: {
        origin: 'https://library.example',
        authorization: 'Bearer accepted',
        'x-firebase-appcheck': 'accepted',
      },
      query: { versionId: '' },
    },
  };
}

it('preserves published metadata, active pointer, pages, chunks, vectors, review receipts and originals across operational reset', async () => {
  const versionId = await published('v1');
  const version = (await h.repo.version(versionId))!;
  const receiptKey = randomUUID();
  const commandReceipt = await commands.create(hq, {
    title: 'Durable reset receipt',
    language: 'en',
    sourceType: 'synthetic-procedure',
    sourceUrls: [],
    observedOn: null,
    sha256: 'c'.repeat(64),
    idempotencyKey: receiptKey,
    documentId: version.documentId,
    expectedDocumentRevision: version.document.revision,
  });
  const before = await knowledgeSnapshot();
  expect(
    (before as { knowledgeDocuments: { id: string; activeVersionId: string | null }[] })
      .knowledgeDocuments,
  ).toContainEqual(expect.objectContaining({ id: version.documentId, activeVersionId: versionId }));
  expect(
    (
      before as {
        knowledgeVersions: {
          id: string;
          status: string;
          reviewedPageCount: number;
          isActive: boolean;
        }[];
      }
    ).knowledgeVersions.find((item) => item.id === versionId),
  ).toMatchObject({ status: 'READY', reviewedPageCount: version.pageCount, isActive: true });
  const operationReceipts = (
    before as {
      knowledgeOperations: {
        id: string;
        action: string;
        documentId: string;
        versionId: string;
        idempotencyKey: string;
      }[];
    }
  ).knowledgeOperations;
  expect(operationReceipts).toHaveLength(1);
  expect(operationReceipts[0]).toMatchObject({
    action: 'CREATE',
    documentId: version.documentId,
    versionId: commandReceipt.versionId,
    idempotencyKey: receiptKey,
  });
  const durableReceiptId = operationReceipts[0].id;
  expect((before as { knowledgePages: unknown[] }).knowledgePages.length).toBe(version.pageCount);
  expect(
    (before as { knowledgeChunks: { embedding: number[] }[] }).knowledgeChunks.length,
  ).toBeGreaterThan(0);
  expect(
    (before as { knowledgeChunks: { embedding: number[] }[] }).knowledgeChunks.every(
      (chunk) => chunk.embedding.length === 768,
    ),
  ).toBe(true);
  expect(h.originalExists(version.objectPath!)).toBe(true);

  const seed = validateSeed(JSON.parse(readFileSync('data/seed/business.json', 'utf8')));
  await seedRecords(h.dc, seed, h.id, [{ uid: hq, role: 'HQ', salonKeys: [] }], false);
  const reset = await resetRecords(h.dc, h.id, false);
  expect(reset).toEqual(
    expect.objectContaining({
      deletedOperationalRows: expect.any(Number),
      resetInventoryRows: expect.any(Number),
    }),
  );
  expect(await knowledgeSnapshot()).toEqual(before);
  expect(
    ((await knowledgeSnapshot()) as { knowledgeOperations: { id: string }[] })
      .knowledgeOperations[0].id,
  ).toBe(durableReceiptId);
  expect(h.originalExists(version.objectPath!)).toBe(true);
  expect(
    Buffer.from(h.originalBytes(version.objectPath!, version.objectGeneration!)).equals(
      Buffer.from(h.bytes),
    ),
  ).toBe(true);
});

it('keeps superseded sources readable, then denies revoked reads through SQL resolution and source handler while retaining private bytes', async () => {
  const oldVersionId = await published('v1');
  const old = (await h.repo.version(oldVersionId))!;
  const newVersionId = await published('v2', old.document.documentCode);
  const current = (await h.repo.version(newVersionId))!;
  expect((await h.repo.document(old.documentId))?.activeVersionId).toBe(newVersionId);
  expect(await resolveSourceIdentity(h.dc, hq, oldVersionId)).toMatchObject({
    id: oldVersionId,
    revokedAt: null,
  });

  const handler = createSourceHandler({
    origins: ['https://library.example'],
    emulator: true,
    verifyAuth: async (token) => (token === 'accepted' ? hq : null),
    verifyAppCheck: async (token) => token === 'accepted',
    resolve: (uid, id) => resolveSourceIdentity(h.dc, uid, id),
    readOriginal: async (identity) =>
      h.originalBytes(identity.objectPath!, identity.objectGeneration!),
  });
  const oldCall = sourceRequest();
  oldCall.request.query.versionId = oldVersionId;
  await handler(oldCall.request, oldCall.response);
  expect(oldCall.response.statusCode).toBe(200);
  expect(Buffer.from(oldCall.response.body as Uint8Array)).toEqual(Buffer.from(h.bytes));

  await commands.delete(hq, {
    versionId: newVersionId,
    expectedDocumentRevision: current.document.revision,
    expectedVersionRevision: current.revision,
    idempotencyKey: randomUUID(),
  });
  expect((await h.repo.document(current.documentId))?.activeVersionId).toBeNull();
  expect(await resolveSourceIdentity(h.dc, hq, newVersionId)).toBeNull();
  expect(h.originalExists(current.objectPath!)).toBe(true);
  expect(
    Buffer.from(h.originalBytes(current.objectPath!, current.objectGeneration!)).equals(
      Buffer.from(h.bytes),
    ),
  ).toBe(true);

  const revokedCall = sourceRequest();
  revokedCall.request.query.versionId = newVersionId;
  await handler(revokedCall.request, revokedCall.response);
  expect(revokedCall.response.statusCode).toBe(404);
  expect(revokedCall.response.body).not.toEqual(h.bytes);
});
