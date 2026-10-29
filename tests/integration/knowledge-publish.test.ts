import { afterEach, beforeEach, expect, it } from 'vitest';
import * as sql from '@barberhq/server';
import { createKnowledgeHarness } from '../support/knowledge.ts';
import { knowledgeIds } from '../../functions/src/knowledge/pipeline.ts';

let h: Awaited<ReturnType<typeof createKnowledgeHarness>>;
beforeEach(async () => {
  h = await createKnowledgeHarness();
});
afterEach(async () => {
  if (h) await h.dispose();
});

it('immutable_version_conflicts', async () => {
  const pipeline = h.pipeline(h.id);
  const id = await pipeline.stageVersion(h.entry, h.bytes);
  expect(await pipeline.stageVersion(h.entry, h.bytes)).toBe(id);
  const changed = new Uint8Array([...h.bytes, 10]);
  await expect(
    pipeline.stageVersion({ ...h.entry, sha256: h.hash(changed) }, changed),
  ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
});

it('publication_status_is_durable_and_cannot_change_on_retry', async () => {
  const pipeline = h.pipeline(h.id);
  const current = await pipeline.stageVersion(h.entry, h.bytes);
  expect((await h.repo.version(current))?.publicationStatus).toBe('DEMO_CURRENT');
  await expect(
    pipeline.stageVersion({ ...h.entry, publicationStatus: 'retired' }, h.bytes),
  ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });

  const retired = await pipeline.stageVersion(
    { ...h.entry, version: 'v0', publicationStatus: 'retired' },
    h.bytes,
  );
  expect((await h.repo.version(retired))?.publicationStatus).toBe('RETIRED');
  await expect(
    pipeline.stageVersion(
      { ...h.entry, version: 'v0', publicationStatus: 'demo-current' },
      h.bytes,
    ),
  ).rejects.toMatchObject({ code: 'INVALID_MANIFEST' });
});

it('old_stage_call_defaults_current_but_sql_rejects_unclassified_v0', async () => {
  const base = {
    businessId: h.id,
    documentId: `${h.id}:OLD-001`,
    documentCode: 'OLD-001',
    nextVersionNumber: 2,
    title: 'Older caller fixture',
    language: 'en',
    sourceType: sql.KnowledgeSourceType.SYNTHETIC_PROCEDURE,
    kind: sql.KnowledgeDocumentKind.PROCEDURE,
    origin: sql.KnowledgeOrigin.SYNTHETIC,
    synthetic: true,
    sourceUrls: [],
    observedOn: null,
    bucket: 'fixture',
    objectPath: 'old-caller.pdf',
    objectGeneration: '1',
    pdfSha256: '0'.repeat(64),
    contentType: 'application/pdf',
    byteSize: 8,
    pageCount: 1,
  };
  const currentId = `${h.id}:OLD-001:v1`;
  await sql.stageKnowledgeVersion(h.dc, { ...base, versionId: currentId, versionLabel: 'v1' });
  expect((await h.repo.version(currentId))?.publicationStatus).toBe('DEMO_CURRENT');
  const retiredId = `${h.id}:OLD-001:v0`;
  await expect(
    sql.stageKnowledgeVersion(h.dc, { ...base, versionId: retiredId, versionLabel: 'v0' }),
  ).rejects.toThrow();
  expect(await h.repo.version(retiredId)).toBeNull();
});

it('compiled_stage_rejects_v0_id_with_current_label_and_rolls_back', async () => {
  const documentId = `${h.id}:MISMATCH-001`;
  const versionId = `${documentId}:v0`;
  const base = {
    businessId: h.id,
    documentId,
    documentCode: 'MISMATCH-001',
    nextVersionNumber: 2,
    title: 'Mismatched ID fixture',
    language: 'en',
    sourceType: sql.KnowledgeSourceType.SYNTHETIC_PROCEDURE,
    kind: sql.KnowledgeDocumentKind.PROCEDURE,
    origin: sql.KnowledgeOrigin.SYNTHETIC,
    synthetic: true,
    sourceUrls: [],
    observedOn: null,
    bucket: 'fixture',
    objectPath: 'mismatched-id.pdf',
    objectGeneration: '1',
    pdfSha256: '0'.repeat(64),
    contentType: 'application/pdf',
    byteSize: 8,
    pageCount: 1,
  };
  const outcome = await sql
    .stageKnowledgeVersion(h.dc, { ...base, versionId, versionLabel: 'v1' })
    .then(
      () => ({ success: true }),
      (error) => ({ error }),
    );
  const state = await h.repo.version(versionId);
  const document = await h.repo.document(documentId);
  expect({
    rejected: 'error' in outcome,
    versionCreated: state !== null,
    documentCreated: document !== null,
  }).toEqual({ rejected: true, versionCreated: false, documentCreated: false });
});

it('rejects_unknown_or_missing_manifest_classification_before_storage_or_sql', async () => {
  const pipeline = h.pipeline(h.id);
  for (const entry of [
    { ...h.entry, publicationStatus: 'archived' } as never,
    (() => {
      const { publicationStatus: _status, ...missing } = h.entry;
      return missing as never;
    })(),
  ]) {
    await expect(pipeline.stageVersion(entry, h.bytes)).rejects.toMatchObject({
      code: 'INVALID_MANIFEST',
    });
  }
  expect(h.objectCount()).toBe(0);
  expect(await h.repo.document(`${h.id}:DAM-001`)).toBeNull();
});

it('retired_ready_version_is_rejected_by_pipeline_and_compiled_publish_operation', async () => {
  const pipeline = h.pipeline(h.id);
  const versionId = await pipeline.stageVersion(
    { ...h.entry, version: 'v0', publicationStatus: 'retired' },
    h.bytes,
  );
  await pipeline.extractVersion(versionId);
  const state = (await h.repo.version(versionId))!;
  await pipeline.recordReview(
    {
      versionId,
      pdfSha256: state.pdfSha256,
      extractionHash: state.extractionHash!,
      reviewedPhysicalPages: [1],
      approvalText: 'Human approved',
      approvedAt: '2026-10-12',
    },
    { kind: 'operator', id: 'test@example.invalid', businessId: h.id },
  );
  expect((await h.repo.version(versionId))?.status).toBe('READY');
  await expect(
    pipeline.publishVersion({ versionId, expectedDocumentRevision: 0 }),
  ).rejects.toMatchObject({ code: 'RETIRED_VERSION' });
  await expect(
    h.repo.publish({
      versionId,
      documentId: `${h.id}:DAM-001`,
      businessId: h.id,
      expectedDocumentRevision: 0,
      versionRevision: (await h.repo.version(versionId))!.revision,
      extractionHash: state.extractionHash!,
      configHash: h.config.configHash,
    }),
  ).rejects.toThrow();
  expect((await h.repo.document(`${h.id}:DAM-001`))?.activeVersionId).toBeNull();
});

it('incomplete_review_does_not_publish', async () => {
  const pipeline = h.pipeline(h.id);
  const versionId = await pipeline.stageVersion(h.entry, h.bytes);
  expect((await pipeline.extractVersion(versionId)).status).toBe('EXTRACTED');
  const state = (await h.repo.version(versionId))!;
  await expect(
    pipeline.recordReview(
      {
        versionId,
        pdfSha256: state.pdfSha256,
        extractionHash: state.extractionHash!,
        reviewedPhysicalPages: [],
        approvalText: 'Human approved',
        approvedAt: '2026-10-12',
      },
      { kind: 'operator', id: 'test@example.invalid', businessId: h.id },
    ),
  ).rejects.toMatchObject({ code: 'REVIEW_INCOMPLETE' });
  await expect(
    pipeline.publishVersion({ versionId, expectedDocumentRevision: 0 }),
  ).rejects.toMatchObject({ code: 'NOT_READY' });
  expect((await h.repo.document(`${h.id}:DAM-001`))?.activeVersionId).toBeNull();
});

it('failed_embedding_preserves_active_version', async () => {
  const pipeline = h.pipeline(h.id);
  const versionId = await pipeline.stageVersion(h.entry, h.bytes);
  await pipeline.extractVersion(versionId);
  const state = (await h.repo.version(versionId))!;
  await pipeline.recordReview(
    {
      versionId,
      pdfSha256: state.pdfSha256,
      extractionHash: state.extractionHash!,
      reviewedPhysicalPages: [1],
      approvalText: 'Human approved',
      approvedAt: '2026-10-12',
    },
    { kind: 'operator', id: 'test@example.invalid', businessId: h.id },
  );
  await pipeline.publishVersion({ versionId, expectedDocumentRevision: 0 });
  expect((await h.repo.document(`${h.id}:DAM-001`))?.activeVersionId).toBe(versionId);
  const second = { ...h.entry, version: 'v2' as const };
  const secondId = await pipeline.stageVersion(second, h.bytes);
  const failing = new (
    pipeline.constructor as typeof import('../../functions/src/knowledge/pipeline.ts').KnowledgePipeline
  )(
    h.repo,
    {
      config: h.config,
      embedTexts: async () => {
        throw Error('Vertex unavailable');
      },
    },
    h.id,
    'not-bad-stuff-demo',
  );
  await expect(failing.extractVersion(secondId)).rejects.toThrow('Vertex unavailable');
  expect((await h.repo.document(`${h.id}:DAM-001`))?.activeVersionId).toBe(versionId);
  expect((await h.repo.version(secondId))?.status).toBe('STAGED');
});

it('review_retry_advances_reviewed_version_without_duplicate_approval', async () => {
  const pipeline = h.pipeline(h.id);
  const versionId = await pipeline.stageVersion(h.entry, h.bytes);
  await pipeline.extractVersion(versionId);
  const state = (await h.repo.version(versionId))!;
  const review = {
    versionId,
    pdfSha256: state.pdfSha256,
    extractionHash: state.extractionHash!,
    reviewedPhysicalPages: [1],
    approvalText: 'Human approved',
    approvedAt: '2026-10-12',
  };
  const actor = { kind: 'operator' as const, id: 'test@example.invalid', businessId: h.id };
  await h.repo.reviewPage(versionId, 1, state.extractionHash!);
  await h.repo.recordReview(
    versionId,
    state.revision,
    state.extractionHash!,
    1,
    `operator:${actor.id}`,
  );
  expect((await h.repo.version(versionId))?.status).toBe('REVIEWED');
  await pipeline.recordReview(review, actor);
  expect((await h.repo.version(versionId))?.status).toBe('READY');
  await pipeline.recordReview(review, actor);
  await expect(
    pipeline.recordReview(review, { ...actor, id: 'different@example.invalid' }),
  ).rejects.toMatchObject({ code: 'REVIEW_IDENTITY_MISMATCH' });
});

it('stale_extraction_attempt_cannot_append_pages', async () => {
  const pipeline = h.pipeline(h.id);
  const versionId = await pipeline.stageVersion(h.entry, h.bytes);
  const first = (await h.repo.version(versionId))!;
  await h.repo.begin(versionId, first.revision, first.pdfSha256);
  await h.repo.begin(versionId, first.revision + 1, first.pdfSha256);
  await expect(
    h.repo.page({
      versionId,
      revision: first.revision + 1,
      pdfSha256: first.pdfSha256,
      leaseId: null,
      physicalPage: 1,
      text: 'stale',
      markdown: 'stale',
      spans: [],
      quality: 'COMPLETE' as never,
      viewBox: [0, 0, 10, 10],
      userUnit: 1,
      rotation: 0,
    }),
  ).rejects.toThrow();
  expect((await h.repo.version(versionId))?.pages).toHaveLength(0);
});
