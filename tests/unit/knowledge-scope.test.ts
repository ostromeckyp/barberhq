import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import {
  KnowledgePipeline,
  knowledgeIds,
  type ManifestEntry,
} from '../../functions/src/knowledge/pipeline.ts';
import {
  validateCloudIngestEnvironment,
  validatePublicationScope,
} from '../../scripts/ingest/scope.ts';

const entry = { businessKey: 'not-bad-stuff-demo' } as ManifestEntry;
const corpusEntry = (
  JSON.parse(readFileSync('data/knowledge/manifest.json', 'utf8')) as ManifestEntry[]
)[0];
const pdfBytes = new Uint8Array(readFileSync(corpusEntry.inputPdf));
it('allows exactly v0 and canonical v1-plus knowledge version IDs', () => {
  expect(knowledgeIds('business', 'DAM-001', 'v0').versionId).toBe('business:DAM-001:v0');
  expect(knowledgeIds('business', 'DAM-001', 'v1').versionId).toBe('business:DAM-001:v1');
  expect(knowledgeIds('business', 'DAM-001', 'v12').versionId).toBe('business:DAM-001:v12');
  for (const malformed of ['v00', 'v01', 'v-1', 'v', 'v1.0', 'version1']) {
    expect(() => knowledgeIds('business', 'DAM-001', malformed)).toThrowError(/INVALID_ID/);
  }
});
it('rejects unknown and missing manifest classification before storage or SQL writes', async () => {
  let storageWrites = 0,
    sqlWrites = 0;
  const repo = {
    version: async () => null,
    putOriginal: async () => {
      storageWrites++;
      return { bucket: 'fixture', path: 'fixture', generation: '1' };
    },
    stage: async () => {
      sqlWrites++;
    },
  };
  const pipeline = new KnowledgePipeline(
    repo as never,
    { config: { dimension: 768 } as never, embedTexts: async () => [] },
    'business',
    corpusEntry.businessKey,
  );
  await expect(
    pipeline.stageVersion({ ...corpusEntry, publicationStatus: 'archived' } as never, pdfBytes),
  ).rejects.toMatchObject({ code: 'INVALID_MANIFEST' });
  const { publicationStatus: _status, ...missing } = corpusEntry;
  await expect(pipeline.stageVersion(missing as never, pdfBytes)).rejects.toMatchObject({
    code: 'INVALID_MANIFEST',
  });
  await expect(
    pipeline.stageVersion(
      { ...corpusEntry, version: 'v0', publicationStatus: 'demo-current' },
      pdfBytes,
    ),
  ).rejects.toMatchObject({ code: 'INVALID_MANIFEST' });
  await expect(
    pipeline.stageVersion({ ...corpusEntry, version: 'v01' }, pdfBytes),
  ).rejects.toMatchObject({ code: 'INVALID_ID' });
  expect(storageWrites).toBe(0);
  expect(sqlWrites).toBe(0);
});
it('rejects retired pipeline publish before the active-version retry shortcut', async () => {
  const versionId = 'business:DAM-001:v0';
  const repo = {
    version: async () => ({
      id: versionId,
      businessId: 'business',
      publicationStatus: 'RETIRED',
      isActive: true,
      publishedAt: '2026-10-01',
      revokedAt: null,
      embeddingConfigHash: 'config',
      document: { activeVersionId: versionId },
    }),
    publish: async () => {
      throw Error('must not call publish');
    },
  };
  const pipeline = new KnowledgePipeline(
    repo as never,
    { config: { dimension: 768, configHash: 'config' } as never, embedTexts: async () => [] },
    'business',
    'not-bad-stuff-demo',
  );
  await expect(
    pipeline.publishVersion({ versionId, expectedDocumentRevision: 1 }),
  ).rejects.toMatchObject({ code: 'RETIRED_VERSION' });
});
it('refuses a foreign business before any cloud client is constructed', () => {
  expect(() => validatePublicationScope('other-business', entry)).toThrow(/does not match/);
  expect(() => validatePublicationScope('not-bad-stuff-demo', entry)).not.toThrow();
});

for (const host of [
  'DATA_CONNECT_EMULATOR_HOST',
  'FIREBASE_STORAGE_EMULATOR_HOST',
  'STORAGE_EMULATOR_HOST',
] as const) {
  it(`refuses ${host} when it is the only emulator host`, () => {
    expect(() => validateCloudIngestEnvironment({ [host]: 'http://127.0.0.1:9199' })).toThrow(
      'Cloud ingest refuses emulator environment',
    );
  });
}

it('allows a clean cloud environment', () => {
  expect(() => validateCloudIngestEnvironment({})).not.toThrow();
});

it('ingest CLI refuses the alternate Storage emulator host before reading the manifest', () => {
  const directory = mkdtempSync(join(tmpdir(), 'knowledge-ingest-guard-'));
  try {
    const configPath = join(directory, 'cloud.json');
    writeFileSync(configPath, JSON.stringify({ projectId: 'guard-test' }));
    const result = spawnSync(
      process.execPath,
      [
        '--import',
        'tsx',
        'scripts/ingest/cli.ts',
        'status',
        '--project',
        'guard-test',
        '--business-id',
        'guard-business',
        '--config',
        configPath,
        '--manifest',
        join(directory, 'missing-manifest.json'),
      ],
      {
        cwd: join(import.meta.dirname, '../..'),
        env: {
          ...process.env,
          DATA_CONNECT_EMULATOR_HOST: '',
          FIREBASE_STORAGE_EMULATOR_HOST: '',
          STORAGE_EMULATOR_HOST: 'http://127.0.0.1:9199',
        },
        encoding: 'utf8',
      },
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Cloud ingest refuses emulator environment');
    expect(result.stderr).not.toContain('missing-manifest.json');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
