import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { initializeApp, deleteApp, applicationDefault } from 'firebase-admin/app';
import { getDataConnect } from 'firebase-admin/data-connect';
import { getStorage } from 'firebase-admin/storage';
import { connectorConfig } from '@barberhq/server';
import {
  createEmbeddingConfig,
  createVertexEmbeddingAdapter,
} from '../../functions/src/knowledge/embedding.js';
import { KnowledgePipeline, knowledgeIds } from '../../functions/src/knowledge/pipeline.js';
import type { ManifestEntry } from '../../functions/src/knowledge/models/manifest-entry.js';
import { KnowledgeRepository } from '../../functions/src/knowledge/repository.js';
import { readReviewReceipt, preserveReviewReceipt } from './review.js';
import { validateCloudIngestEnvironment, validatePublicationScope } from './scope.js';

const [command, ...argv] = process.argv.slice(2);
if (!['stage', 'extract', 'review', 'publish', 'status'].includes(command))
  throw new Error(
    'Usage: npm run ingest -- <stage|extract|review|publish|status> --project PROJECT --business-id ID [--receipt FILE] [--expected-revision N]',
  );
const args = new Map<string, string>();
for (let i = 0; i < argv.length; i += 2) {
  if (
    !argv[i]?.startsWith('--') ||
    !argv[i + 1] ||
    argv[i + 1].startsWith('--') ||
    args.has(argv[i].slice(2))
  )
    throw new Error(`Invalid argument ${argv[i]}`);
  args.set(argv[i].slice(2), argv[i + 1]);
}
const required = (key: string) => {
  const value = args.get(key)?.trim();
  if (!value) throw new Error(`--${key} is required`);
  return value;
};
const projectId = required('project');
const businessId = required('business-id');
const cloud = JSON.parse(
  await readFile(resolve(args.get('config') ?? 'config/knowledge-cloud.json'), 'utf8'),
) as {
  projectId: string;
  firebaseStorageBucket: string;
  dataConnect: { serviceId: string; location: string };
  vertexAi: { model: string; location: string; dimension: number };
};
if (projectId !== cloud.projectId) throw new Error('Project does not match cloud configuration');
validateCloudIngestEnvironment();
const entries = JSON.parse(
  await readFile(resolve(args.get('manifest') ?? 'data/knowledge/manifest.json'), 'utf8'),
) as ManifestEntry[];
const entry = entries.find(
  (item) =>
    item.documentId === (args.get('document') ?? 'DAM-001') &&
    item.version === (args.get('version') ?? 'v1'),
);
if (!entry) throw new Error('Manifest version not found');
validatePublicationScope(businessId, entry);
const { versionId } = knowledgeIds(businessId, entry.documentId, entry.version);
const app = initializeApp(
  { projectId, credential: applicationDefault(), storageBucket: cloud.firebaseStorageBucket },
  `knowledge-ingest-${process.pid}`,
);
try {
  const dc = getDataConnect(
    {
      ...connectorConfig,
      serviceId: cloud.dataConnect.serviceId,
      location: cloud.dataConnect.location,
    },
    app,
  );
  const vectorDc = getDataConnect(
    {
      ...connectorConfig,
      connector: 'vector',
      serviceId: cloud.dataConnect.serviceId,
      location: cloud.dataConnect.location,
    },
    app,
  );
  const config = createEmbeddingConfig({
    projectId,
    modelId: cloud.vertexAi.model,
    location: cloud.vertexAi.location,
    dimension: cloud.vertexAi.dimension,
    documentMode: 'RETRIEVAL_DOCUMENT',
    queryMode: 'RETRIEVAL_QUERY',
  });
  const repo = new KnowledgeRepository(
    dc,
    vectorDc,
    getStorage(app).bucket(cloud.firebaseStorageBucket),
  );
  const pipeline = new KnowledgePipeline(
    repo,
    createVertexEmbeddingAdapter(config),
    businessId,
    entry.businessKey,
  );
  if (command === 'stage')
    console.log(
      JSON.stringify({
        versionId: await pipeline.stageVersion(
          entry,
          new Uint8Array(await readFile(resolve(entry.inputPdf))),
        ),
      }),
    );
  if (command === 'extract') {
    const result = await pipeline.extractVersion(versionId);
    const state = await repo.version(versionId);
    const directory = resolve('data/knowledge/derived');
    await mkdir(directory, { recursive: true });
    await writeFile(
      resolve(directory, `${entry.documentId}-${entry.version}-extraction.json`),
      `${JSON.stringify({ versionId, pdfSha256: state?.pdfSha256, extractionHash: state?.extractionHash, status: state?.status, pages: state?.pages.map((page) => ({ physicalPage: page.physicalPage, quality: page.quality, markdown: page.markdown, viewBox: page.viewBox })), chunks: state?.chunks.map((chunk) => ({ id: chunk.id, physicalPage: chunk.physicalPage, sectionId: chunk.sectionId, text: chunk.text })) }, null, 2)}\n`,
    );
    console.log(JSON.stringify(result));
  }
  if (command === 'review') {
    const receipt = await readReviewReceipt(required('receipt'));
    if (receipt.review.versionId !== versionId || receipt.actor.businessId !== businessId)
      throw new Error('Receipt does not match selected scope/version');
    await pipeline.recordReview(receipt.review, receipt.actor);
    console.log(JSON.stringify({ versionId, receiptPath: await preserveReviewReceipt(receipt) }));
  }
  if (command === 'publish') {
    const revision = Number(required('expected-revision'));
    if (!Number.isSafeInteger(revision) || revision < 0)
      throw new Error('Invalid document revision');
    console.log(
      JSON.stringify(
        await pipeline.publishVersion({ versionId, expectedDocumentRevision: revision }),
      ),
    );
  }
  if (command === 'status') {
    const state = await repo.version(versionId);
    const document = await repo.document(`${businessId}:${entry.documentId}`);
    console.log(
      JSON.stringify({
        versionId,
        status: state?.status,
        publicationStatus: state?.publicationStatus,
        revision: state?.revision,
        pdfSha256: state?.pdfSha256,
        extractionHash: state?.extractionHash,
        pageCount: state?.pageCount,
        storedPages: state?.pages.length,
        expectedChunkCount: state?.expectedChunkCount,
        storedChunks: state?.chunks.length,
        reviewedPageCount: state?.reviewedPageCount,
        reviewedBy: state?.reviewedBy,
        embeddingConfigHash: state?.embeddingConfigHash,
        isActive: state?.isActive,
        publishedAt: state?.publishedAt,
        documentRevision: document?.revision,
        activeVersionId: document?.activeVersionId,
      }),
    );
  }
} finally {
  await deleteApp(app);
}
