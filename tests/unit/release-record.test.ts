import { afterEach, expect, it, vi } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readFileSync } from 'node:fs';
import {
  validatePromotion,
  verifyRelease,
  readBundledPublicConfig,
  assertPublicConfigMatches,
  assertBuildConfigurationHash,
  type ReleaseRecord,
  type VerificationServices,
} from '../../scripts/release/verify.ts';
import { backendFingerprint, main } from '../../scripts/release/cli.ts';
import { mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { inspectArtifact } from '../../scripts/checks/hosting.ts';
import { renderPublicConfig } from '../../scripts/config/build-web.ts';

const record: ReleaseRecord = {
  projectId: 'notbad-6be95',
  siteId: 'notbad-6be95',
  channelId: 'foundation',
  hostingVersionId: 'projects/notbad-6be95/sites/notbad-6be95/versions/verified',
  buildHash: 'a'.repeat(64),
  configHash: 'b'.repeat(64),
  baseUrl: 'https://notbad-6be95--foundation-unesffgt.web.app',
  backendRevision: 'sha256:' + 'c'.repeat(64),
  verifiedAt: '2026-10-25T00:00:00.000Z',
};
const input = {
  projectId: record.projectId,
  siteId: record.siteId,
  channelId: record.channelId,
  baseUrl: record.baseUrl,
  expectedBuildHash: record.buildHash,
};
function services(): VerificationServices {
  return {
    artifact: vi.fn(async () => ({ buildHash: record.buildHash, configHash: record.configHash })),
    channel: vi.fn(async () => ({
      hostingVersionId: record.hostingVersionId,
      baseUrl: record.baseUrl,
    })),
    backendRevision: vi.fn(async () => record.backendRevision),
    checkHosted: vi.fn(async () => {}),
    now: () => new Date(record.verifiedAt),
  };
}
let directory: string | undefined;
afterEach(() => {
  if (directory) rmSync(directory, { recursive: true });
  directory = undefined;
});

it('accepts the same verified version promoted to live without rebuilding', () => {
  expect(() =>
    validatePromotion(record, {
      ...record,
      channelId: 'live',
      baseUrl: 'https://notbad-6be95.web.app',
    }),
  ).not.toThrow();
});
it.each([
  'projectId',
  'siteId',
  'hostingVersionId',
  'buildHash',
  'configHash',
  'backendRevision',
] as const)('rejects promotion when %s drifts', (field) => {
  expect(() => validatePromotion(record, { ...record, [field]: 'changed' })).toThrow();
});
it('returns an actual release identity after checking both version and backend twice', async () => {
  const s = services();
  await expect(verifyRelease(input, s)).resolves.toEqual(record);
  expect(s.checkHosted).toHaveBeenCalledTimes(1);
  expect(s.channel).toHaveBeenCalledTimes(2);
  expect(s.backendRevision).toHaveBeenCalledTimes(2);
});
it('rejects a version that changes during the hosted checks', async () => {
  const s = services();
  vi.mocked(s.channel)
    .mockResolvedValueOnce({ hostingVersionId: record.hostingVersionId, baseUrl: record.baseUrl })
    .mockResolvedValueOnce({
      hostingVersionId: record.hostingVersionId + '-later',
      baseUrl: record.baseUrl,
    });
  await expect(verifyRelease(input, s)).rejects.toThrow(/version|drift/i);
});
it('rejects backend drift even when frontend files stay the same', async () => {
  const s = services();
  vi.mocked(s.backendRevision)
    .mockResolvedValueOnce(record.backendRevision)
    .mockResolvedValueOnce('sha256:' + 'd'.repeat(64));
  await expect(verifyRelease(input, s)).rejects.toThrow(/backend|drift/i);
});

it('rejects local artifact drift while hosted checks are running', async () => {
  const s = services();
  vi.mocked(s.artifact)
    .mockResolvedValueOnce({ buildHash: record.buildHash, configHash: record.configHash })
    .mockResolvedValueOnce({ buildHash: 'd'.repeat(64), configHash: record.configHash });
  await expect(verifyRelease(input, s)).rejects.toThrow(/artifact|drift/i);
});
it('rejects a URL unrelated to the selected Hosting channel before remote smoke checks', async () => {
  const s = services();
  await expect(verifyRelease({ ...input, baseUrl: 'https://another.web.app' }, s)).rejects.toThrow(
    /origin|URL|channel/i,
  );
  expect(s.checkHosted).not.toHaveBeenCalled();
});
it('rejects an unexpected artifact hash and never checks hosted content', async () => {
  const s = services();
  await expect(verifyRelease({ ...input, expectedBuildHash: 'd'.repeat(64) }, s)).rejects.toThrow(
    /artifact|hash/i,
  );
  expect(s.checkHosted).not.toHaveBeenCalled();
});
it('propagates a hosted byte mismatch instead of returning a verified release', async () => {
  const s = services();
  vi.mocked(s.checkHosted).mockRejectedValue(new Error('Hosted file mismatch'));
  await expect(verifyRelease(input, s)).rejects.toThrow('Hosted file mismatch');
});
it('compares bundled runtime flags and Firebase identity, not the stale generated file', () => {
  const expected = JSON.parse(readFileSync('config/public.example.json', 'utf8'));
  Object.assign(expected, {
    knowledgeEnabled: true,
    ragEnabled: true,
    replenishmentEnabled: true,
    replenishmentAiEnabled: true,
  });
  directory = mkdtempSync(join(tmpdir(), 'release-runtime-'));
  const runtime = JSON.stringify(expected).replace(/true/g, '!0').replace(/false/g, '!1');
  writeFileSync(
    join(directory, 'main-test.js'),
    'const settings={publicConfig:' + runtime + ',useEmulators:!1};',
  );
  const actual = readBundledPublicConfig(directory);
  expect(() => assertPublicConfigMatches(expected, actual)).not.toThrow();
  expect(() => assertPublicConfigMatches(expected, { ...expected, ragEnabled: false })).toThrow(
    /configuration/i,
  );
  expect(() =>
    assertPublicConfigMatches(expected, {
      ...expected,
      firebase: { ...expected.firebase, appId: 'different' },
    }),
  ).toThrow(/configuration/i);
});
it('refuses executable expressions inside the bundled public configuration', () => {
  directory = mkdtempSync(join(tmpdir(), 'release-expression-'));
  writeFileSync(
    join(directory, 'main-test.js'),
    'const settings={publicConfig:{projectId:getProject()},useEmulators:!1};',
  );
  expect(() => readBundledPublicConfig(directory!)).toThrow(/literal|configuration/i);
});

it('fingerprints actual backend revision identities independently of list order', () => {
  const first = {
    metadata: { name: 'approve', labels: { 'cloud.googleapis.com/location': 'europe-west1' } },
    status: { latestReadyRevisionName: 'approve-00001' },
  };
  const second = {
    metadata: { name: 'receive', labels: { 'cloud.googleapis.com/location': 'europe-west1' } },
    status: { latestReadyRevisionName: 'receive-00001' },
  };
  expect(backendFingerprint([first, second])).toBe(backendFingerprint([second, first]));
  expect(backendFingerprint([first, second])).not.toBe(
    backendFingerprint([
      first,
      { ...second, status: { latestReadyRevisionName: 'receive-00002' } },
    ]),
  );
  expect(() => backendFingerprint([{ ...first, status: {} }])).toThrow();
});

it('rejects a fabricated build-record configuration hash even when its length is valid', () => {
  const config = JSON.parse(readFileSync('config/public.example.json', 'utf8'));
  Object.assign(config.firebase, {
    apiKey: 'public-test',
    appId: 'web-app',
    authDomain: 'notbad-6be95.firebaseapp.com',
  });
  config.appCheck.siteKey = 'public-site';
  expect(() => assertBuildConfigurationHash(config, 'd'.repeat(64))).toThrow(/configuration hash/i);
});

it('verifies a candidate locally before publication without requiring a hosted channel', async () => {
  const config = JSON.parse(readFileSync('config/public.example.json', 'utf8'));
  Object.assign(config.firebase, {
    apiKey: 'public-test',
    appId: 'web-app',
    authDomain: 'notbad-6be95.firebaseapp.com',
  });
  config.appCheck.siteKey = 'public-site';
  directory = mkdtempSync(join(tmpdir(), 'release-preflight-'));
  const site = join(directory, 'site');
  mkdirSync(site);
  writeFileSync(join(site, 'index.html'), '<html>Candidate</html>');
  writeFileSync(
    join(site, 'main-test.js'),
    'const settings={publicConfig:' + JSON.stringify(config) + ',useEmulators:false};',
  );
  const artifact = inspectArtifact(site);
  const source = renderPublicConfig(config, config.projectId, false, {
    connector: config.dataConnect.browserConnectorId,
    service: config.dataConnect.serviceId,
    location: config.dataConnect.location,
  });
  writeFileSync(
    join(directory, 'build-record.json'),
    JSON.stringify({
      ...artifact,
      mode: 'production',
      projectId: config.projectId,
      siteId: config.hostingSiteId,
      configHash: createHash('sha256').update(source).digest('hex'),
    }),
  );
  writeFileSync(join(directory, 'public-config.json'), JSON.stringify(config));
  const log = vi.spyOn(console, 'log').mockImplementation(() => {});
  try {
    await expect(
      main([
        '--project',
        config.projectId,
        '--site',
        config.hostingSiteId,
        '--artifact',
        directory,
        '--approved-public-config',
        join(directory, 'public-config.json'),
        '--expected-build-hash',
        artifact.buildHash,
        '--artifact-only',
      ]),
    ).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith(expect.stringContaining('"artifactOnly":true'));
  } finally {
    log.mockRestore();
  }
});
