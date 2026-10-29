import { afterEach, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  prepareKnowledgeCloud,
  runPrepareKnowledgeCloud,
} from '../../scripts/config/prepare-knowledge-cloud.ts';

const temporaryRoots: string[] = [];
afterEach(async () => {
  for (const root of temporaryRoots.splice(0)) await rm(root, { recursive: true, force: true });
});

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'cloud-knowledge-test-'));
  temporaryRoots.push(root);
  const outputRoot = path.join(root, 'artifacts/cloud-knowledge');
  const configPath = path.join(root, 'config/knowledge-cloud.json');
  await mkdir(path.dirname(configPath), { recursive: true });
  await writeFile(
    configPath,
    JSON.stringify({
      projectId: 'fixture-12345',
      firebaseStorageBucket: 'fixture-12345.firebasestorage.app',
      dataConnect: {
        serviceId: 'fixture-service',
        location: 'europe-west3',
        database: 'fixture-database',
        instanceId: 'fixture-instance',
      },
      vertexAi: { model: 'gemini-embedding-001', location: 'europe-west3', dimension: 768 },
    }),
  );
  const dataConnect = path.join(root, 'dataconnect');
  await mkdir(path.join(dataConnect, 'schema'), { recursive: true });
  await writeFile(
    path.join(dataConnect, 'schema/business.gql'),
    'type Business @table { id: String! }\n',
  );
  for (const connector of ['server', 'vector', 'browser']) {
    const directory = path.join(dataConnect, connector);
    await mkdir(directory, { recursive: true });
    await writeFile(
      path.join(directory, 'connector.yaml'),
      `connectorId: ${connector}-id\ngenerate:\n  javascriptSdk:\n    outputDir: ../../private\n`,
    );
    await writeFile(
      path.join(directory, 'operation.gql'),
      `query ${connector}Operation { businesses { id } }\n`,
    );
  }
  await writeFile(
    path.join(dataConnect, 'browser/knowledge.gql'),
    'query GetSourceSection { sourceSections { id } }\n',
  );
  await writeFile(path.join(dataConnect, 'browser/stock.gql'), 'query GetStock { stock { id } }\n');
  await writeFile(
    path.join(dataConnect, 'browser/settings.gql'),
    'query GetSettings { settings { id } }\n',
  );
  await writeFile(
    path.join(dataConnect, 'browser/business.gql'),
    'query GetBusiness { businesses { id } }\n',
  );
  await writeFile(path.join(dataConnect, 'browser/seed.json'), '{"private":true}');
  await writeFile(path.join(dataConnect, 'browser/receipt.pdf'), 'private');
  return { root, outputRoot, configPath };
}

it('stages only schema, server and vector by default', async () => {
  const options = await fixture();
  await prepareKnowledgeCloud(options);
  const dc = path.join(options.outputRoot, 'dataconnect');
  expect(await readdir(options.outputRoot)).toEqual(['dataconnect', 'firebase.json']);
  expect(await readdir(dc)).toEqual(['dataconnect.yaml', 'schema', 'server', 'vector']);
  expect(await readdir(path.join(dc, 'schema'))).toEqual(['business.gql']);
  expect(await readdir(path.join(dc, 'server'))).toEqual(['connector.yaml', 'operation.gql']);
  expect(await readFile(path.join(dc, 'server/connector.yaml'), 'utf8')).toBe(
    'connectorId: server-id\n',
  );
  expect(await readFile(path.join(dc, 'vector/connector.yaml'), 'utf8')).toBe(
    'connectorId: vector-id\n',
  );
  expect(await readFile(path.join(dc, 'dataconnect.yaml'), 'utf8')).toContain(
    'connectorDirs: [./server, ./vector]',
  );
  expect(await readFile(path.join(options.outputRoot, 'firebase.json'), 'utf8')).toBe(
    '{\n  "dataconnect": {\n    "source": "dataconnect"\n  }\n}\n',
  );
});

it('stages all browser operations only with the explicit option and preserves cloud IDs', async () => {
  const options = await fixture();
  await runPrepareKnowledgeCloud(['--include-browser'], options);
  const dc = path.join(options.outputRoot, 'dataconnect');
  expect(await readdir(path.join(dc, 'browser'))).toEqual([
    'business.gql',
    'connector.yaml',
    'knowledge.gql',
    'operation.gql',
    'settings.gql',
    'stock.gql',
  ]);
  expect(await readFile(path.join(dc, 'browser/knowledge.gql'), 'utf8')).toBe(
    'query GetSourceSection { sourceSections { id } }\n',
  );
  expect(await readFile(path.join(dc, 'browser/connector.yaml'), 'utf8')).toBe(
    'connectorId: browser-id\n',
  );
  const yaml = await readFile(path.join(dc, 'dataconnect.yaml'), 'utf8');
  expect(yaml).toContain('serviceId: fixture-service');
  expect(yaml).toContain('location: europe-west3');
  expect(yaml).toContain('database: fixture-database');
  expect(yaml).toContain('instanceId: fixture-instance');
  expect(yaml).toContain('schemaValidation: COMPATIBLE');
  expect(yaml).toContain('connectorDirs: [./server, ./vector, ./browser]');
  expect(yaml).not.toContain('generate:');
});

it('refuses unknown options without clearing an existing artifact', async () => {
  const options = await fixture();
  await mkdir(options.outputRoot, { recursive: true });
  const marker = path.join(options.outputRoot, 'marker.txt');
  await writeFile(marker, 'keep this');
  await expect(runPrepareKnowledgeCloud(['--unknown'], options)).rejects.toThrow('Unknown option');
  expect(await readFile(marker, 'utf8')).toBe('keep this');
});

it('validates connector input before clearing an existing artifact', async () => {
  const options = await fixture();
  await mkdir(options.outputRoot, { recursive: true });
  const marker = path.join(options.outputRoot, 'marker.txt');
  await writeFile(marker, 'keep this');
  await writeFile(path.join(options.root, 'dataconnect/browser/connector.yaml'), 'generate: {}\n');
  await expect(prepareKnowledgeCloud({ ...options, includeBrowser: true })).rejects.toThrow(
    'connectorId',
  );
  expect(await readFile(marker, 'utf8')).toBe('keep this');
});
