import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);
const yaml = require('yaml') as { parse(source: string): Record<string, any> };
const { toDatasource } = require('firebase-tools/lib/dataconnect/types.js') as {
  toDatasource(
    projectId: string,
    location: string,
    datasource: Record<string, any>,
  ): Record<string, any>;
};

type Options = { root: string; configPath: string; outputRoot: string; includeBrowser?: boolean };
type CloudConfig = {
  projectId: string;
  firebaseStorageBucket: string;
  dataConnect: { serviceId: string; location: string; database: string; instanceId: string };
  vertexAi: { model: string; location: string; dimension: number };
};
type StagedFile = { name: string; contents: string };

function requireMatch(
  value: string,
  pattern: RegExp,
  label: string,
  configPath: string,
  root: string,
): void {
  if (typeof value !== 'string' || !pattern.test(value)) {
    throw new Error(`Invalid ${label} in ${path.relative(root, configPath)}`);
  }
}

async function gqlFiles(directory: string, relative = ''): Promise<StagedFile[]> {
  const entries = (await readdir(path.join(directory, relative), { withFileTypes: true })).sort(
    (a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0),
  );
  const files: StagedFile[] = [];
  for (const entry of entries) {
    const name = relative ? path.join(relative, entry.name) : entry.name;
    if (entry.isDirectory()) files.push(...(await gqlFiles(directory, name)));
    else if (entry.isFile() && entry.name.endsWith('.gql'))
      files.push({ name, contents: await readFile(path.join(directory, name), 'utf8') });
  }
  return files;
}

async function writeStagedFiles(directory: string, files: StagedFile[]): Promise<void> {
  for (const file of files) {
    const target = path.join(directory, file.name);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, file.contents);
  }
}

export async function prepareKnowledgeCloud({
  root,
  configPath,
  outputRoot,
  includeBrowser = false,
}: Options): Promise<void> {
  const config = JSON.parse(await readFile(configPath, 'utf8')) as CloudConfig;
  requireMatch(config.projectId, /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/, 'projectId', configPath, root);
  requireMatch(
    config.firebaseStorageBucket,
    /^[a-z0-9][a-z0-9.-]*\.firebasestorage\.app$/,
    'firebaseStorageBucket',
    configPath,
    root,
  );
  requireMatch(
    config.dataConnect.serviceId,
    /^[a-z][a-z0-9-]*$/,
    'Data Connect serviceId',
    configPath,
    root,
  );
  requireMatch(
    config.dataConnect.location,
    /^[a-z]+-[a-z]+[0-9]$/,
    'Data Connect location',
    configPath,
    root,
  );
  requireMatch(
    config.dataConnect.database,
    /^[a-z][a-z0-9-]*$/,
    'Data Connect database',
    configPath,
    root,
  );
  requireMatch(
    config.dataConnect.instanceId,
    /^[a-z][a-z0-9-]*$/,
    'Data Connect instanceId',
    configPath,
    root,
  );
  requireMatch(config.vertexAi.model, /^[a-z][a-z0-9-]*$/, 'Vertex AI model', configPath, root);
  requireMatch(
    config.vertexAi.location,
    /^[a-z]+-[a-z]+[0-9]$/,
    'Vertex AI location',
    configPath,
    root,
  );
  if (!Number.isInteger(config.vertexAi.dimension) || config.vertexAi.dimension < 1) {
    throw new Error(`Invalid Vertex AI dimension in ${path.relative(root, configPath)}`);
  }

  const sourceRoot = path.join(root, 'dataconnect');
  const schemaFiles = await gqlFiles(path.join(sourceRoot, 'schema'));
  if (schemaFiles.length === 0) throw new Error('No dataconnect/schema .gql files found');
  const connectorNames = includeBrowser ? ['server', 'vector', 'browser'] : ['server', 'vector'];
  const connectors = await Promise.all(
    connectorNames.map(async (name) => {
      const directory = path.join(sourceRoot, name);
      const files = await gqlFiles(directory);
      const connectorId = (await readFile(path.join(directory, 'connector.yaml'), 'utf8')).match(
        /^connectorId:\s*["']?([a-zA-Z0-9_-]+)["']?\s*$/m,
      )?.[1];
      if (!connectorId)
        throw new Error(`Could not read connectorId from dataconnect/${name}/connector.yaml`);
      return { name, connectorId, files };
    }),
  );

  const stagedConfig = [
    'specVersion: v1',
    `serviceId: ${config.dataConnect.serviceId}`,
    `location: ${config.dataConnect.location}`,
    'schema:',
    '  source: ./schema',
    '  datasource:',
    '    postgresql:',
    `      database: ${config.dataConnect.database}`,
    '      schemaValidation: COMPATIBLE',
    '      cloudSql:',
    `        instanceId: ${config.dataConnect.instanceId}`,
    `connectorDirs: [${connectorNames.map((name) => `./${name}`).join(', ')}]`,
    '',
  ].join('\n');
  const parsedConfig = yaml.parse(stagedConfig);
  const mappedDatasource = toDatasource(
    config.projectId,
    config.dataConnect.location,
    parsedConfig.schema.datasource,
  ) as { postgresql?: { schemaValidation?: string } };
  if (mappedDatasource.postgresql?.schemaValidation !== 'COMPATIBLE') {
    throw new Error('Firebase CLI does not map staged schema validation to COMPATIBLE');
  }

  await rm(outputRoot, { recursive: true, force: true });
  const cloudDataConnect = path.join(outputRoot, 'dataconnect');
  const cloudSchema = path.join(cloudDataConnect, 'schema');
  await mkdir(cloudSchema, { recursive: true });
  await writeStagedFiles(cloudSchema, schemaFiles);
  for (const connector of connectors) {
    const outputConnector = path.join(cloudDataConnect, connector.name);
    await mkdir(outputConnector, { recursive: true });
    await writeStagedFiles(outputConnector, connector.files);
    await writeFile(
      path.join(outputConnector, 'connector.yaml'),
      `connectorId: ${connector.connectorId}\n`,
    );
  }
  await writeFile(path.join(cloudDataConnect, 'dataconnect.yaml'), stagedConfig);
  await writeFile(
    path.join(outputRoot, 'firebase.json'),
    `${JSON.stringify({ dataconnect: { source: 'dataconnect' } }, null, 2)}\n`,
  );
  console.log(
    `Prepared cloud Data Connect config for ${config.projectId} in ${path.relative(root, outputRoot)}.`,
  );
}

export async function runPrepareKnowledgeCloud(args: string[], options: Options): Promise<void> {
  for (const arg of args) {
    if (arg !== '--include-browser') throw new Error(`Unknown option: ${arg}`);
  }
  await prepareKnowledgeCloud({ ...options, includeBrowser: args.includes('--include-browser') });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runPrepareKnowledgeCloud(process.argv.slice(2), {
    root,
    configPath: path.join(root, 'config/knowledge-cloud.json'),
    outputRoot: path.join(root, 'artifacts/cloud-knowledge'),
  });
}
