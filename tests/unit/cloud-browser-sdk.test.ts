import { afterEach, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { stageCloudBrowserSdk } from '../../scripts/config/generate-cloud-browser-sdk.ts';

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

it('stages only browser JS generation with cloud target and isolated output', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'cloud-browser-sdk-'));
  roots.push(root);
  const configPath = path.join(root, 'config/knowledge-cloud.json');
  const outputRoot = path.join(root, 'artifacts/cloud-browser-sdk');
  await mkdir(path.dirname(configPath), { recursive: true });
  await writeFile(
    configPath,
    JSON.stringify({
      projectId: 'notbad-6be95',
      firebaseStorageBucket: 'notbad-6be95.firebasestorage.app',
      dataConnect: {
        serviceId: 'notbad-6be95-service',
        location: 'europe-west3',
        database: 'notbad-6be95-database',
        instanceId: 'notbad-6be95-instance',
      },
      vertexAi: { model: 'gemini-embedding-001', location: 'europe-west3', dimension: 768 },
    }),
  );
  for (const name of ['schema', 'server', 'vector', 'browser']) {
    const dir = path.join(root, 'dataconnect', name);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, name + '.gql'), 'query Example { example { id } }\n');
    if (name !== 'schema')
      await writeFile(
        path.join(dir, 'connector.yaml'),
        `connectorId: ${name}\ngenerate:\n  javascriptSdk:\n    outputDir: ../../local\n`,
      );
  }
  const staged = await stageCloudBrowserSdk({ root, configPath, outputRoot });
  expect(staged.projectId).toBe('notbad-6be95');
  expect(await readFile(path.join(outputRoot, 'dataconnect/dataconnect.yaml'), 'utf8')).toContain(
    'location: europe-west3',
  );
  for (const name of ['server', 'vector'])
    expect(
      await readFile(path.join(outputRoot, `dataconnect/${name}/connector.yaml`), 'utf8'),
    ).toBe(`connectorId: ${name}\n`);
  const browser = await readFile(
    path.join(outputRoot, 'dataconnect/browser/connector.yaml'),
    'utf8',
  );
  expect(browser).toContain('javascriptSdk:');
  expect(browser).toContain("package: '@barberhq/browser-cloud'");
  expect(browser).toContain('../../../../web/src/app/core/generated-cloud');
  expect(browser).not.toContain('adminNodeSdk');
});
