import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { createKnowledgeHarness } from '../support/knowledge.ts';
import { processKnowledge } from '../../functions/src/knowledge/worker.ts';
import { DocumentCommandService } from '../../functions/src/knowledge/document-commands.ts';
import { ReviewPublishService } from '../../functions/src/knowledge/review-publish.ts';

type KnowledgeHarness = Awaited<ReturnType<typeof createKnowledgeHarness>>;
let h: KnowledgeHarness;
let activeHarness: KnowledgeHarness | undefined;
let hq: string;
beforeEach(async () => {
  activeHarness = undefined;
  hq = '';
  h = await createKnowledgeHarness();
  activeHarness = h;
  hq = `hq-${randomUUID()}`;
  await h.dc.executeGraphql(
    'mutation($uid:String!,$businessId:String!){membership_insert(data:{uid:$uid,businessId:$businessId,role:HQ})}',
    { variables: { uid: hq, businessId: h.id } },
  );
});
afterEach(async () => {
  const current = activeHarness;
  activeHarness = undefined;
  if (!current) return;
  let cleanupFailed = false;
  if (hq) {
    try {
      await current.dc.executeGraphql('mutation($uid:String!){membership_delete(key:{uid:$uid})}', {
        variables: { uid: hq },
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
    throw new Error('Document race fixture cleanup failed; SDK details suppressed');
});

async function uploadedExtraction() {
  const versionId = await h.pipeline(h.id).stageVersion(h.entry, h.bytes);
  await h.dc.executeGraphql(
    'mutation($id:String!){knowledgeVersion_update(id:$id,data:{uploadedAt_expr:"request.time",pendingStage:EXTRACT,pendingDocumentRevision:0})}',
    { variables: { id: versionId } },
  );
  return (await h.repo.version(versionId))!;
}

async function extractedVersion(version: 'v1' | 'v2' | 'v3', expectedDocumentRevision: number) {
  const entry = { ...h.entry, version };
  const versionId = await h.pipeline(h.id).stageVersion(entry, h.bytes);
  await h.dc.executeGraphql(
    'mutation($id:String!,$revision:Int!){knowledgeVersion_update(id:$id,data:{uploadedAt_expr:"request.time",pendingStage:EXTRACT,pendingDocumentRevision:$revision})}',
    { variables: { id: versionId, revision: expectedDocumentRevision } },
  );
  await processKnowledge(
    { versionId, stage: 'EXTRACT', expectedDocumentRevision },
    {
      repo: h.repo,
      pipeline: h.pipeline(h.id),
      now: () => new Date('2026-10-16T10:00:00.000Z'),
      createLeaseId: () => randomUUID(),
    },
  );
  return (await h.repo.version(versionId))!;
}

async function operatorPublished(): Promise<string> {
  const pipeline = h.pipeline(h.id),
    versionId = await pipeline.stageVersion(h.entry, h.bytes);
  await pipeline.extractVersion(versionId);
  const version = (await h.repo.version(versionId))!;
  await pipeline.recordReview(
    {
      versionId,
      pdfSha256: version.pdfSha256,
      extractionHash: version.extractionHash!,
      reviewedPhysicalPages: [1],
      approvalText: 'Approved',
      approvedAt: '2026-10-16',
    },
    { kind: 'operator', id: 'test@example.invalid', businessId: h.id },
  );
  await pipeline.publishVersion({ versionId, expectedDocumentRevision: 0 });
  return versionId;
}

async function hqReview(
  versionId: string,
  expectedDocumentRevision: number,
  idempotencyKey = randomUUID(),
) {
  const version = (await h.repo.version(versionId))!,
    jobs: unknown[] = [];
  const service = new ReviewPublishService({
    repo: h.repo,
    pipeline: h.pipeline(h.id),
    enqueue: async (job) => {
      jobs.push(job);
    },
  });
  const input = {
    versionId,
    extractionHash: version.extractionHash!,
    reviewedPhysicalPages: [1],
    expectedDocumentRevision,
    idempotencyKey,
  };
  await service.reviewAndPublishDocument(hq, input);
  return { job: jobs[0], input };
}

async function hqIntent(versionId: string, expectedDocumentRevision: number) {
  return (await hqReview(versionId, expectedDocumentRevision)).job;
}

it('RED: duplicate delivery during a live EXTRACT lease is retriable', async () => {
  const version = await uploadedExtraction();
  const first = await h.repo.claimExtraction({
    versionId: version.id,
    revision: version.revision,
    expectedDocumentRevision: 0,
    pdfSha256: version.pdfSha256,
    leaseId: 'lease-one',
    now: new Date('2026-10-16T10:00:00.000Z'),
    expiresAt: new Date('2026-10-16T10:06:00.000Z'),
  });
  await expect(
    h.repo.claimExtraction({
      versionId: version.id,
      revision: first.revision,
      expectedDocumentRevision: 0,
      pdfSha256: version.pdfSha256,
      leaseId: 'lease-duplicate',
      now: new Date('2026-10-16T10:01:00.000Z'),
      expiresAt: new Date('2026-10-16T10:07:00.000Z'),
    }),
  ).rejects.toThrow();
  expect(await h.repo.version(version.id)).toMatchObject({
    processingLeaseId: 'lease-one',
    processingAttempt: 1,
  });
});

it('RED: expired EXTRACT lease reclaims and stale page or failure writes cannot affect its successor', async () => {
  const version = await uploadedExtraction();
  const first = await h.repo.claimExtraction({
    versionId: version.id,
    revision: version.revision,
    expectedDocumentRevision: 0,
    pdfSha256: version.pdfSha256,
    leaseId: 'lease-one',
    now: new Date('2026-10-16T10:00:00.000Z'),
    expiresAt: new Date('2026-10-16T10:06:00.000Z'),
  });
  const second = await h.repo.claimExtraction({
    versionId: version.id,
    revision: first.revision,
    expectedDocumentRevision: 0,
    pdfSha256: version.pdfSha256,
    leaseId: 'lease-two',
    now: new Date('2026-10-16T10:06:01.000Z'),
    expiresAt: new Date('2026-10-16T10:12:01.000Z'),
  });
  await expect(
    h.repo.page({
      versionId: version.id,
      revision: first.revision,
      pdfSha256: version.pdfSha256,
      leaseId: 'lease-one',
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
  await expect(
    h.repo.failExtraction({
      versionId: version.id,
      revision: first.revision,
      pdfSha256: version.pdfSha256,
      leaseId: 'lease-one',
      errorCode: 'EXTRACTION_FAILED',
    }),
  ).rejects.toThrow();
  expect(await h.repo.version(version.id)).toMatchObject({
    revision: second.revision,
    processingLeaseId: 'lease-two',
    processingAttempt: 2,
    status: 'STAGED',
  });
});

it('RED: document revision change between worker read and lease claim rejects the old task', async () => {
  const version = await uploadedExtraction();
  const repo = {
    version: (id: string) => h.repo.version(id),
    claimExtraction: async (input: {
      versionId: string;
      revision: number;
      pdfSha256: string;
      leaseId: string;
      now: Date;
      expiresAt: Date;
      expectedDocumentRevision: number;
    }) => {
      await h.dc.executeGraphql(
        'mutation($id:String!){knowledgeDocument_update(id:$id,data:{revision:1})}',
        { variables: { id: version.documentId } },
      );
      return h.repo.claimExtraction(input as never);
    },
    failExtraction: (input: {
      versionId: string;
      revision: number;
      pdfSha256: string;
      leaseId: string;
      errorCode: string;
    }) => h.repo.failExtraction(input),
  };
  await expect(
    processKnowledge(
      { versionId: version.id, stage: 'EXTRACT', expectedDocumentRevision: 0 },
      {
        repo,
        pipeline: h.pipeline(h.id),
        now: () => new Date('2026-10-16T10:00:00.000Z'),
        createLeaseId: () => 'stale-document-revision',
      },
    ),
  ).rejects.toThrow();
  expect(await h.repo.version(version.id)).toMatchObject({
    revision: version.revision,
    processingAttempt: 0,
    processingLeaseId: null,
    status: 'STAGED',
  });
});

it('RED: stale PUBLISH candidate terminalizes with STALE_STATE and keeps the winning active version', async () => {
  const oldActive = await operatorPublished();
  const stale = await extractedVersion('v2', 1),
    winner = await extractedVersion('v3', 1);
  const staleJob = await hqIntent(stale.id, 1),
    winnerJob = await hqIntent(winner.id, 1);
  await processKnowledge(winnerJob, { repo: h.repo, pipeline: h.pipeline(h.id) });
  await expect(
    processKnowledge(staleJob, { repo: h.repo, pipeline: h.pipeline(h.id) }),
  ).resolves.toMatchObject({ status: 'READY', retryable: false, errorCode: 'STALE_STATE' });
  expect(await h.repo.document(stale.documentId)).toMatchObject({
    activeVersionId: winner.id,
    revision: 2,
  });
  expect(await h.repo.version(stale.id)).toMatchObject({
    status: 'READY',
    processingError: 'STALE_STATE',
    pendingStage: null,
    publishedAt: null,
    isActive: false,
  });
  expect(await h.repo.version(oldActive)).toMatchObject({
    publishedAt: expect.any(String),
    isActive: false,
    revokedAt: null,
  });
});

it('RED: a new HQ review key resumes a stale READY candidate only with the refreshed document revision', async () => {
  const oldActive = await operatorPublished();
  const stale = await extractedVersion('v2', 1),
    winner = await extractedVersion('v3', 1);
  const staleReview = await hqReview(stale.id, 1),
    winnerJob = await hqIntent(winner.id, 1);
  await processKnowledge(winnerJob, { repo: h.repo, pipeline: h.pipeline(h.id) });
  await processKnowledge(staleReview.job, { repo: h.repo, pipeline: h.pipeline(h.id) });
  const service = new ReviewPublishService({
    repo: h.repo,
    pipeline: h.pipeline(h.id),
    enqueue: async () => undefined,
  });
  await expect(service.reviewAndPublishDocument(hq, staleReview.input)).rejects.toThrow();
  await expect(
    service.reviewAndPublishDocument(hq, { ...staleReview.input, reviewedPhysicalPages: [1, 1] }),
  ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  const refreshed = {
    ...staleReview.input,
    expectedDocumentRevision: 2,
    idempotencyKey: randomUUID(),
  };
  await expect(service.reviewAndPublishDocument(hq, refreshed)).resolves.toMatchObject({
    status: 'READY',
  });
  expect(await h.repo.version(stale.id)).toMatchObject({
    status: 'READY',
    pendingStage: 'PUBLISH',
    pendingDocumentRevision: 2,
    pendingExtractionHash: stale.extractionHash,
  });
  expect(await h.repo.document(stale.documentId)).toMatchObject({
    activeVersionId: winner.id,
    revision: 2,
  });
  expect(await h.repo.version(oldActive)).toMatchObject({
    publishedAt: expect.any(String),
    revokedAt: null,
  });
});

it('RED: worker retries a transient stale-terminal SQL failure while the same stale intent remains pending', async () => {
  const candidate = await extractedVersion('v1', 0),
    job = await hqIntent(candidate.id, 0);
  await h.dc.executeGraphql(
    'mutation($id:String!){knowledgeDocument_update(id:$id,data:{revision:1})}',
    { variables: { id: candidate.documentId } },
  );
  const repo = {
    version: (id: string) => h.repo.version(id),
    document: (id: string) => h.repo.document(id),
    claimExtraction: h.repo.claimExtraction.bind(h.repo),
    failExtraction: h.repo.failExtraction.bind(h.repo),
    markPublishStale: async () => {
      throw Error('temporary SQL outage');
    },
  };
  await expect(processKnowledge(job, { repo, pipeline: h.pipeline(h.id) })).rejects.toThrow(
    'temporary SQL outage',
  );
  expect(await h.repo.version(candidate.id)).toMatchObject({
    pendingStage: 'PUBLISH',
    pendingDocumentRevision: 0,
    pendingExtractionHash: candidate.extractionHash,
    processingError: null,
  });
});

it('RED: withdrawal while the PUBLISH worker is paused wins the version CAS and preserves the prior active pointer', async () => {
  const oldActive = await operatorPublished(),
    candidate = await extractedVersion('v2', 1),
    job = await hqIntent(candidate.id, 1);
  const pipeline = h.pipeline(h.id);
  const paused = {
    extractClaimedVersion: pipeline.extractClaimedVersion.bind(pipeline),
    publishVersion: async (input: Parameters<typeof pipeline.publishVersion>[0]) => {
      const current = (await h.repo.version(candidate.id))!;
      await new DocumentCommandService(h.repo).delete(hq, {
        versionId: candidate.id,
        expectedDocumentRevision: 1,
        expectedVersionRevision: current.revision,
        idempotencyKey: randomUUID(),
      });
      return pipeline.publishVersion(input);
    },
  };
  await expect(processKnowledge(job, { repo: h.repo, pipeline: paused })).resolves.toMatchObject({
    retryable: false,
  });
  expect(await h.repo.document(candidate.documentId)).toMatchObject({
    activeVersionId: oldActive,
    revision: 1,
  });
  expect(await h.repo.version(candidate.id)).toMatchObject({
    revokedAt: expect.any(String),
    publishedAt: null,
    isActive: false,
    pendingStage: null,
  });
});

it('RED: concurrent PUBLISH transactions choose one replacement and leave the prior source readable', async () => {
  const oldActive = await operatorPublished(),
    first = await extractedVersion('v2', 1),
    second = await extractedVersion('v3', 1);
  const jobs = await Promise.all([hqIntent(first.id, 1), hqIntent(second.id, 1)]);
  await Promise.all(
    jobs.map((job) => processKnowledge(job, { repo: h.repo, pipeline: h.pipeline(h.id) })),
  );
  const document = (await h.repo.document(first.documentId))!;
  expect([first.id, second.id]).toContain(document.activeVersionId);
  expect(document.revision).toBe(2);
  const versions = await Promise.all([h.repo.version(first.id), h.repo.version(second.id)]);
  expect(versions.filter((version) => version?.publishedAt && version.isActive)).toHaveLength(1);
  expect(
    versions.filter(
      (version) => version?.processingError === 'STALE_STATE' && version.pendingStage === null,
    ),
  ).toHaveLength(1);
  expect(await h.repo.version(oldActive)).toMatchObject({
    publishedAt: expect.any(String),
    isActive: false,
    revokedAt: null,
  });
});
