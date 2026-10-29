import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { parsePublicConfig } from './public-config.ts';
import { inspectArtifact } from '../checks/hosting.ts';
import { connectorConfig } from '@barberhq/browser';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
type SdkTarget = { connector: string; service: string; location: string };

export function selectSdkTarget(
  useEmulators: boolean,
  localPath = resolve(root, 'web/src/app/core/generated/esm/index.esm.js'),
  cloudPath = resolve(root, 'web/src/app/core/generated-cloud/esm/index.esm.js'),
): SdkTarget {
  const selected = useEmulators ? localPath : cloudPath;
  let source: string;
  try {
    source = readFileSync(selected, 'utf8');
  } catch {
    throw new Error(
      `${useEmulators ? 'Local' : 'Cloud'} browser SDK is missing at ${selected}; generate it before building`,
    );
  }
  const config = source.match(/export\s+const\s+connectorConfig\s*=\s*\{([^}]+)\}/)?.[1];
  const field = (name: string) =>
    config?.match(new RegExp(`\\b${name}\\s*:\\s*['\"]([^'\"]+)['\"]`))?.[1];
  const target = {
    connector: field('connector'),
    service: field('service'),
    location: field('location'),
  };
  if (!target.connector || !target.service || !target.location)
    throw new Error(`Generated browser SDK target is missing or invalid at ${selected}`);
  return target as SdkTarget;
}
export function renderPublicConfig(
  raw: unknown,
  projectId: string,
  useEmulators = false,
  sdkTarget: SdkTarget = connectorConfig,
): string {
  const config = parsePublicConfig(raw);
  if (config.projectId !== projectId)
    throw new Error('Build project does not match selected configuration');
  if (/REPLACE_WITH|PLACEHOLDER/.test(JSON.stringify(config)))
    throw new Error('Complete public Firebase settings before building');
  if (useEmulators !== projectId.startsWith('demo-'))
    throw new Error(
      'Demo projects require the emulator build; releases cannot use emulator configuration',
    );
  if (
    config.dataConnect.serviceId !== sdkTarget.service ||
    config.dataConnect.location !== sdkTarget.location ||
    config.dataConnect.browserConnectorId !== sdkTarget.connector
  )
    throw new Error('Public configuration and generated SDK target differ');
  return `// Generated from explicitly selected PUBLIC configuration. Never edit.\nexport const runtimeConfig = ${JSON.stringify({ publicConfig: config, useEmulators })};\n`;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  rmSync(resolve(root, 'artifacts/build-record.json'), { force: true });
  const { values } = parseArgs({
    options: {
      config: { type: 'string' },
      project: { type: 'string' },
      emulator: { type: 'boolean' },
      'configure-only': { type: 'boolean' },
    },
  });
  if (!values.config || !values.project)
    throw new Error(
      'Pass --config PATH and --project PROJECT_ID; no implicit environment configuration',
    );
  const generated = resolve(
    root,
    `web/src/app/core/public-config${values.emulator ? '.emulator' : ''}.generated.ts`,
  );
  // A rejected build must not leave a stale generated release configuration.
  rmSync(generated, { force: true });
  const config = JSON.parse(readFileSync(resolve(values.config), 'utf8'));
  const source = renderPublicConfig(
    config,
    values.project,
    !!values.emulator,
    selectSdkTarget(!!values.emulator),
  );
  writeFileSync(generated, source);
  if (!values['configure-only']) {
    const result = spawnSync(
      process.execPath,
      [
        resolve(root, 'web/node_modules/@angular/cli/bin/ng.js'),
        'build',
        '--configuration',
        values.emulator ? 'production,emulator' : 'production',
        '--source-map=false',
        '--optimization=true',
      ],
      { cwd: resolve(root, 'web'), stdio: 'inherit' },
    );
    if (result.status !== 0) process.exit(result.status ?? 1);
    const artifact = inspectArtifact(resolve(root, 'web/dist/barberhq/browser'));
    mkdirSync(resolve(root, 'artifacts'), { recursive: true });
    writeFileSync(
      resolve(root, 'artifacts/build-record.json'),
      JSON.stringify(
        {
          projectId: values.project,
          siteId: config.hostingSiteId,
          mode: values.emulator ? 'emulator' : 'production',
          buildHash: artifact.buildHash,
          configHash: createHash('sha256').update(source).digest('hex'),
          files: artifact.files,
        },
        null,
        2,
      ) + '\n',
    );
    console.log(
      `Verified ${artifact.files.length} public files; build SHA-256 ${artifact.buildHash}`,
    );
  }
}
