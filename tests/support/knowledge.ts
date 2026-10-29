import { randomUUID, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { initializeApp, deleteApp, applicationDefault } from 'firebase-admin/app';
import { getDataConnect } from 'firebase-admin/data-connect';
import { createEmbeddingConfig } from '../../functions/src/knowledge/embedding.ts';
import { KnowledgePipeline } from '../../functions/src/knowledge/pipeline.ts';
import type { ManifestEntry } from '../../functions/src/knowledge/models/manifest-entry.ts';
import { KnowledgeRepository } from '../../functions/src/knowledge/repository.ts';
import {
  KNOWLEDGE_CLOUD_CONFIG_PATH,
  knowledgeConnectorConfig,
  resolveKnowledgeTarget,
} from './knowledge-target.ts';

export async function createKnowledgeHarness() {
  const cloudMode = process.env.BARBERHQ_TEST_MODE === 'cloud-sql';
  const config = cloudMode
    ? (JSON.parse(await readFile(KNOWLEDGE_CLOUD_CONFIG_PATH, 'utf8')) as unknown)
    : null;
  const target = resolveKnowledgeTarget({
    env: process.env,
    configPath: cloudMode ? KNOWLEDGE_CLOUD_CONFIG_PATH : null,
    config,
  });
  const embeddingConfig = createEmbeddingConfig({
    projectId: target.projectId,
    modelId: target.model,
    dimension: target.dimension,
    location: target.embeddingLocation,
    documentMode: 'RETRIEVAL_DOCUMENT',
    queryMode: 'RETRIEVAL_QUERY',
  });
  const entry = (
    JSON.parse(await readFile('data/knowledge/manifest.json', 'utf8')) as ManifestEntry[]
  )[0];
  const bytes = new Uint8Array(await readFile(entry.inputPdf));
  const makeVector = (first: number, second: number) => [first, second, ...Array(766).fill(0)];
  const credential = target.mode === 'cloud-sql' ? { credential: applicationDefault() } : {};
  const suffix = randomUUID();
  const app = initializeApp(
    { projectId: target.projectId, ...credential },
    `knowledge-server-${suffix}`,
  );
  const vectorApp = initializeApp(
    { projectId: target.projectId, ...credential },
    `knowledge-vector-${suffix}`,
  );
  const dc = getDataConnect(knowledgeConnectorConfig(target, 'server'), app);
  const vectorDc = getDataConnect(knowledgeConnectorConfig(target, 'vector'), vectorApp);
  const id = `test-knowledge-${randomUUID()}`;
  const foreignId = `test-knowledge-${randomUUID()}`;
  const objects = new Map<string, { bytes: Buffer; hash: string; generation: string }>();
  const bucket = {
    name: 'test-knowledge-bucket',
    getFiles: async ({ prefix }: { prefix: string }) => [
      [...objects.keys()]
        .filter((path) => path.startsWith(prefix))
        .map((path) => ({ name: path, delete: async () => void objects.delete(path) })),
    ],
    file: (path: string) => ({
      delete: async () => {
        if (!objects.delete(path)) throw { code: 404 };
      },
      save: async (bytes: Buffer, options: { metadata: { metadata: { sha256: string } } }) => {
        if (objects.has(path)) throw { code: 412 };
        objects.set(path, {
          bytes: Buffer.from(bytes),
          hash: options.metadata.metadata.sha256,
          generation: '1',
        });
      },
      getMetadata: async () => {
        const object = objects.get(path);
        if (!object) throw Error('Missing object');
        return [
          {
            metadata: { sha256: object.hash },
            size: String(object.bytes.length),
            generation: object.generation,
          },
        ];
      },
      download: async () => {
        const object = objects.get(path);
        if (!object) throw Error('Missing object');
        return [object.bytes];
      },
    }),
  };
  const createdBusinesses: string[] = [];
  async function deleteFixtures() {
    let cleanupFailed = false;
    for (const businessId of [...createdBusinesses]) {
      try {
        await dc.executeGraphql('mutation($id:String!){business_delete(id:$id)}', {
          variables: { id: businessId },
        });
        const index = createdBusinesses.indexOf(businessId);
        if (index !== -1) createdBusinesses.splice(index, 1);
      } catch {
        cleanupFailed = true;
      }
    }
    if (cleanupFailed)
      throw new Error(
        `${cloudMode ? 'Cloud SQL' : 'Knowledge emulator'} fixture cleanup failed; SDK details suppressed`,
      );
  }
  if (cloudMode) console.info(`Cloud SQL knowledge fixture businesses: ${id}, ${foreignId}`);
  try {
    for (const businessId of [id, foreignId]) {
      // Track before sending: an INSERT can commit even if its response is lost.
      createdBusinesses.push(businessId);
      await dc.executeGraphql(
        'mutation($id:String!){business_insert(data:{id:$id,name:"Knowledge fixture"})}',
        { variables: { id: businessId } },
      );
    }
  } catch {
    try {
      await deleteFixtures();
    } catch {
      /* Keep raw SDK errors out of test output. */
    }
    await Promise.allSettled([deleteApp(app), deleteApp(vectorApp)]);
    if (cloudMode) throw new Error('Cloud SQL fixture setup failed; SDK details suppressed');
    throw new Error('Knowledge emulator fixture setup failed');
  }
  const repo = new KnowledgeRepository(dc, vectorDc, bucket as never);
  const pipeline = (businessId: string, vector = makeVector(0.8, 0.6)) =>
    new KnowledgePipeline(
      repo,
      { config: embeddingConfig, embedTexts: async (texts) => texts.map(() => vector) },
      businessId,
      'not-bad-stuff-demo',
    );
  async function dispose() {
    let cleanupFailed = false;
    try {
      await deleteFixtures();
    } catch {
      cleanupFailed = true;
    } finally {
      await Promise.allSettled([deleteApp(app), deleteApp(vectorApp)]);
    }
    if (cleanupFailed)
      throw new Error(
        `${cloudMode ? 'Cloud SQL' : 'Knowledge emulator'} fixture cleanup failed; SDK details suppressed`,
      );
  }
  return {
    id,
    foreignId,
    dc,
    repo,
    pipeline,
    entry,
    bytes,
    config: embeddingConfig,
    makeVector,
    bucket,
    objectCount: () => objects.size,
    objectPaths: () => [...objects.keys()],
    originalExists: (path: string) => objects.has(path),
    originalBytes: (path: string, generation: string) => {
      const object = objects.get(path);
      if (!object || object.generation !== generation) throw Error('Missing object generation');
      return Buffer.from(object.bytes);
    },
    dispose,
    hash: (value: Uint8Array) => createHash('sha256').update(value).digest('hex'),
  };
}
