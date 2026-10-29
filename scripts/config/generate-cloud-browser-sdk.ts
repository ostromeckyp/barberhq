import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareKnowledgeCloud } from './prepare-knowledge-cloud.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const expected = {
  projectId: 'notbad-6be95',
  serviceId: 'notbad-6be95-service',
  location: 'europe-west3',
};
const require = createRequire(import.meta.url);
const { postprocessSdkEnums } = require('./sdk-enums.mjs') as {
  postprocessSdkEnums: (schema: URL, paths: URL[]) => Promise<void>;
};
type Options = { root: string; configPath: string; outputRoot: string };

export async function stageCloudBrowserSdk({
  root,
  configPath,
  outputRoot,
}: Options): Promise<{ projectId: string; outputRoot: string }> {
  if (path.resolve(outputRoot) !== path.join(path.resolve(root), 'artifacts/cloud-browser-sdk'))
    throw new Error('Cloud browser staging must use artifacts/cloud-browser-sdk');
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  if (
    config.projectId !== expected.projectId ||
    config.dataConnect?.serviceId !== expected.serviceId ||
    config.dataConnect?.location !== expected.location
  )
    throw new Error(
      'Cloud browser SDK config does not match the approved project/service/location',
    );
  await prepareKnowledgeCloud({ root, configPath, outputRoot, includeBrowser: true });
  const outputDir = '../../../../web/src/app/core/generated-cloud';
  const destination = path.resolve(outputRoot, 'dataconnect/browser', outputDir);
  if (destination !== path.join(path.resolve(root), 'web/src/app/core/generated-cloud'))
    throw new Error('Cloud browser SDK output must stay in generated-cloud');
  await writeFile(
    path.join(outputRoot, 'dataconnect/browser/connector.yaml'),
    [
      'connectorId: browser',
      'generate:',
      '  javascriptSdk:',
      `    outputDir: ${outputDir}`,
      "    package: '@barberhq/browser-cloud'",
      '',
    ].join('\n'),
  );
  return { projectId: config.projectId, outputRoot };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 2) throw new Error('generate-cloud-browser-sdk takes no arguments');
  const outputRoot = path.join(root, 'artifacts/cloud-browser-sdk');
  const staged = await stageCloudBrowserSdk({
    root,
    configPath: path.join(root, 'config/knowledge-cloud.json'),
    outputRoot,
  });
  const cli = path.join(root, 'node_modules/firebase-tools/lib/bin/firebase.js');
  const result = spawnSync(
    process.execPath,
    [cli, 'dataconnect:sdk:generate', '--project', staged.projectId],
    {
      cwd: outputRoot,
      stdio: 'inherit',
      env: {
        ...process.env,
        XDG_CONFIG_HOME:
          process.env.XDG_CONFIG_HOME ?? path.join(tmpdir(), 'barberhq-firebase-cli'),
      },
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
  await postprocessSdkEnums(new URL('../../dataconnect/schema/', import.meta.url), [
    new URL('../../web/src/app/core/generated-cloud/index.d.ts', import.meta.url),
  ]);
}
