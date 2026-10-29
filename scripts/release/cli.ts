import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs, promisify } from 'node:util';
import { z } from 'zod';
import { inspectArtifact, checkHosting } from '../checks/hosting.ts';
import { verifyRelease as assertProductionArtifact } from '../checks/release.ts';
import {
  verifyRelease,
  assertPublicConfigMatches,
  readBundledPublicConfig,
  assertBuildConfigurationHash,
} from './verify.ts';

const run = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

// Keep this projection deliberately small: Functions environment variables and credentials
// are neither needed nor emitted. Cloud Run's actual ready revision identifies backend code.
export function backendFingerprint(raw: unknown): string {
  const services = z
    .array(
      z.object({
        metadata: z.object({ name: z.string().min(1), labels: z.record(z.string(), z.string()) }),
        status: z.object({ latestReadyRevisionName: z.string().min(1) }),
      }),
    )
    .min(1)
    .parse(raw)
    .map((row) => ({
      service: row.metadata.name,
      region: row.metadata.labels['cloud.googleapis.com/location'],
      revision: row.status.latestReadyRevisionName,
    }))
    .sort((a, b) => `${a.region}/${a.service}`.localeCompare(`${b.region}/${b.service}`));
  if (services.some((row) => !row.region)) throw new Error('Backend revision region unavailable');
  return 'sha256:' + sha(Buffer.from(JSON.stringify(services)));
}

export async function main(args = process.argv.slice(2)): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      project: { type: 'string' },
      site: { type: 'string' },
      channel: { type: 'string' },
      'base-url': { type: 'string' },
      artifact: { type: 'string' },
      'approved-public-config': { type: 'string' },
      'expected-build-hash': { type: 'string' },
      out: { type: 'string' },
      'artifact-only': { type: 'boolean' },
    },
  });
  const required = (name: keyof typeof values): string => {
    const value = values[name];
    if (typeof value !== 'string' || !value) throw new Error(`Explicit --${name} is required`);
    return value;
  };
  const projectId = required('project'),
    siteId = required('site');
  const artifactDirectory = resolve(required('artifact'));
  const configPath = resolve(required('approved-public-config'));
  if (!/^public-config(?:[.-][\w-]+)?\.json$/.test(basename(configPath)))
    throw new Error('Select a named public-config.json approval snapshot');
  const expectedBuildHash = required('expected-build-hash');
  let publicFiles: string[] = [];
  const checkArtifact = async () => {
    const build = JSON.parse(await readFile(join(artifactDirectory, 'build-record.json'), 'utf8'));
    const artifact = inspectArtifact(join(artifactDirectory, 'site'));
    assertProductionArtifact(build, artifact.buildHash, projectId, siteId);
    assert.deepEqual(build.files, artifact.files, 'Artifact file manifest mismatch');
    const expected = JSON.parse(await readFile(configPath, 'utf8'));
    const actual = readBundledPublicConfig(join(artifactDirectory, 'site'));
    assertPublicConfigMatches(expected, actual);
    assertBuildConfigurationHash(actual, build.configHash);
    assert.equal(actual.projectId, projectId, 'Bundled public project mismatch');
    assert.equal(actual.hostingSiteId, siteId, 'Bundled public site mismatch');
    publicFiles = artifact.files;
    return { buildHash: artifact.buildHash, configHash: build.configHash };
  };
  if (values['artifact-only']) {
    if (values.out) throw new Error('Artifact-only mode does not create a hosted release record');
    const artifact = await checkArtifact();
    assert.equal(artifact.buildHash, expectedBuildHash, 'Unexpected artifact hash');
    console.log(
      JSON.stringify({ passed: true, artifactOnly: true, projectId, siteId, ...artifact }),
    );
    return;
  }
  const channelId = required('channel'),
    baseUrl = required('base-url');
  const cliJson = async (cliArgs: string[]) => {
    const result = await run(
      process.execPath,
      [
        join(root, 'node_modules/firebase-tools/lib/bin/firebase.js'),
        ...cliArgs,
        '--project',
        projectId,
        '--json',
      ],
      { cwd: root, maxBuffer: 8 * 1024 * 1024 },
    );
    const response = JSON.parse(result.stdout);
    if (response.status !== 'success')
      throw new Error('Firebase read-only metadata request failed');
    return response.result as unknown;
  };
  const record = await verifyRelease(
    { projectId, siteId, channelId, baseUrl, expectedBuildHash },
    {
      artifact: checkArtifact,
      channel: async () => {
        const result = z
          .object({
            channels: z.array(
              z.object({
                name: z.string(),
                url: z.string(),
                release: z
                  .object({
                    version: z.object({ name: z.string(), status: z.literal('FINALIZED') }),
                  })
                  .optional(),
              }),
            ),
          })
          .parse(await cliJson(['hosting:channel:list', '--site', siteId]));
        const channel = result.channels.find((row) => row.name.endsWith(`/channels/${channelId}`));
        if (!channel?.release) throw new Error('Selected Hosting channel has no finalized release');
        return { hostingVersionId: channel.release.version.name, baseUrl: channel.url };
      },
      backendRevision: async () => {
        const result = await run(
          'gcloud',
          [
            'run',
            'services',
            'list',
            '--project',
            projectId,
            '--platform',
            'managed',
            '--format=json(metadata.name,metadata.labels,status.latestReadyRevisionName)',
          ],
          { cwd: root },
        );
        return backendFingerprint(JSON.parse(result.stdout));
      },
      checkHosted: async () => {
        await checkHosting(baseUrl);
        for (let offset = 0; offset < publicFiles.length; offset += 6) {
          await Promise.all(
            publicFiles.slice(offset, offset + 6).map(async (file) => {
              const response = await fetch(new URL(file, baseUrl), {
                signal: AbortSignal.timeout(15000),
                redirect: 'error',
              });
              assert.equal(response.status, 200, `Missing hosted file: ${file}`);
              assert.equal(response.headers.get('x-content-type-options'), 'nosniff', file);
              const remote = Buffer.from(await response.arrayBuffer());
              const local = await readFile(join(artifactDirectory, 'site', file));
              assert.equal(sha(remote), sha(local), `Hosted byte mismatch: ${file}`);
            }),
          );
        }
      },
      now: () => new Date(),
    },
  );
  if (values.out) {
    const output = resolve(values.out);
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, JSON.stringify(record, null, 2) + '\n', { flag: 'wx' });
  }
  console.log(JSON.stringify(record));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Release verification failed');
    process.exitCode = 1;
  });
}
