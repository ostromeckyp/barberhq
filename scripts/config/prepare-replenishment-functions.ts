import { lstat, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sourceRuntimeAccount } from './functions-runtime.ts';

type Options = { root: string; outputRoot: string };
const artifactPath = 'artifacts/replenishment-functions';
const account = 'baberhq-runtime@notbad-6be95.iam.gserviceaccount.com';
/** Exact compiled closure of the two entry modules, mirrored so relative imports stay byte-exact. */
export const replenishmentModules = Object.freeze([
  ...[
    'admission',
    'budget',
    'context',
    'errors',
    'product-lookup',
    'proposal',
    'replenishment',
    'replenishment-model',
    'replenishment-repository',
    'replenishment-tools',
    'repository',
    'runtime',
    'salon-alias-callables',
    'salon-alias-commands',
    'schemas',
  ].map((name) => `functions/src/ai/${name}.js`),
  'functions/src/cloud-config.js',
  'functions/config/cloud.json',
  'functions/src/stock/runtime.js',
  'shared/product-normalization.js',
]);
const sdkFiles = ['index.cjs.js', 'esm/index.esm.js', 'esm/package.json'];
const pinned = {
  '@genkit-ai/google-genai': '1.42.0',
  'firebase-admin': '14.5.0',
  'firebase-functions': '7.4.0',
  genkit: '1.42.0',
} as const;

async function ordinary(target: string, missing = false): Promise<void> {
  try {
    if ((await lstat(target)).isSymbolicLink())
      throw new Error(`Symlink is not allowed: ${target}`);
  } catch (error) {
    if (missing && (error as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw error;
  }
}
async function input(root: string, relative: string): Promise<Buffer> {
  let current = root;
  for (const segment of relative.split('/')) {
    current = path.join(current, segment);
    await ordinary(current);
  }
  return readFile(current);
}
/** Only previously written package files may exist in the output tree. */
async function output(root: string, outputRoot: string): Promise<void> {
  if (path.resolve(outputRoot) !== path.join(root, artifactPath))
    throw new Error('Output must be artifacts/replenishment-functions inside root');
  const allowed = new Set([
    'firebase.json',
    'functions',
    'functions/index.js',
    'functions/package.json',
    'functions/server-sdk',
    'functions/server-sdk/package.json',
    'functions/server-sdk/esm',
    ...sdkFiles.map((name) => `functions/server-sdk/${name}`),
    ...replenishmentModules.flatMap((name) => {
      const parts = `functions/lib/${name}`.split('/');
      return parts.map((_, i) => parts.slice(0, i + 1).join('/'));
    }),
  ]);
  async function scan(relative: string): Promise<void> {
    const dir = path.join(outputRoot, relative);
    let names: string[];
    try {
      names = await readdir(dir);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw error;
    }
    for (const name of names) {
      const child = relative ? `${relative}/${name}` : name;
      const stat = await lstat(path.join(outputRoot, child));
      if (!allowed.has(child) || stat.isSymbolicLink())
        throw new Error(`Unexpected file in isolated Functions package: ${child}`);
      if (stat.isDirectory()) await scan(child);
    }
  }
  for (const dir of ['artifacts', artifactPath]) await ordinary(path.join(root, dir), true);
  await scan('');
}

export async function prepareReplenishmentFunctions({ root, outputRoot }: Options): Promise<void> {
  root = path.resolve(root);
  await output(root, outputRoot);
  const files = [
    ...replenishmentModules.map((name) => `functions/lib/${name}`),
    ...sdkFiles.map((name) => `functions/src/generated/${name}`),
    'functions/src/generated/package.json',
    'functions/src/index.ts',
    'functions/package.json',
  ];
  const bytes = await Promise.all(files.map((name) => input(root, name)));
  if (bytes.some((data) => data.length === 0))
    throw new Error('Required replenishment runtime input is empty');
  const byName = new Map(files.map((name, i) => [name, bytes[i]]));
  if (sourceRuntimeAccount(byName.get('functions/src/index.ts')!.toString('utf8')) !== account)
    throw new Error('Expected runtime service account is missing from Functions entrypoint');
  const dependencies =
    (
      JSON.parse(byName.get('functions/package.json')!.toString('utf8')) as {
        dependencies?: Record<string, string>;
      }
    ).dependencies ?? {};
  if (Object.entries(pinned).some(([name, version]) => dependencies[name] !== version))
    throw new Error('Expected exact replenishment dependency versions are missing');
  const sdk = JSON.parse(byName.get('functions/src/generated/package.json')!.toString('utf8')) as {
    name?: string;
    main?: string;
    exports?: Record<string, unknown>;
  };
  if (sdk.name !== '@barberhq/server' || sdk.main !== 'index.cjs.js' || !sdk.exports?.['.'])
    throw new Error('Expected generated server SDK package is missing');

  const functionsDir = path.join(outputRoot, 'functions');
  const entry = [
    "import { initializeApp } from 'firebase-admin/app';",
    "import { setGlobalOptions } from 'firebase-functions';",
    "import { createPrepareReplenishmentFunction } from './lib/functions/src/ai/replenishment.js';",
    "import { createRemoveSalonShorthandFunction } from './lib/functions/src/ai/salon-alias-callables.js';",
    'initializeApp();',
    `setGlobalOptions({ serviceAccount: '${account}' });`,
    'export const prepareReplenishment = createPrepareReplenishmentFunction();',
    'export const removeSalonShorthand = createRemoveSalonShorthandFunction();',
    '',
  ].join('\n');
  const manifest = {
    private: true,
    type: 'module',
    main: 'index.js',
    engines: { node: '22' },
    dependencies: { ...pinned, '@barberhq/server': 'file:server-sdk' },
  };
  // Generated runtime bytes stay exact; omit the SDK's stale Firebase 13 peer declaration.
  const sdkManifest = {
    name: '@barberhq/server',
    version: '0.0.1',
    main: 'index.cjs.js',
    module: 'esm/index.esm.js',
    exports: { '.': { require: './index.cjs.js', default: './esm/index.esm.js' } },
  };
  const firebaseConfig = {
    functions: [
      {
        source: 'functions',
        codebase: 'replenishment',
        runtime: 'nodejs22',
        ignore: ['node_modules', '.git', '*.log', '*.local.json', '.env', '.env.*'],
      },
    ],
  };
  for (const name of replenishmentModules)
    await mkdir(path.dirname(path.join(functionsDir, 'lib', name)), { recursive: true });
  await mkdir(path.join(functionsDir, 'server-sdk/esm'), { recursive: true });
  await Promise.all([
    ...replenishmentModules.map((name) =>
      writeFile(path.join(functionsDir, 'lib', name), byName.get(`functions/lib/${name}`)!),
    ),
    ...sdkFiles.map((name) =>
      writeFile(
        path.join(functionsDir, 'server-sdk', name),
        byName.get(`functions/src/generated/${name}`)!,
      ),
    ),
    writeFile(
      path.join(functionsDir, 'server-sdk/package.json'),
      `${JSON.stringify(sdkManifest, null, 2)}\n`,
    ),
    writeFile(path.join(functionsDir, 'index.js'), entry),
    writeFile(path.join(functionsDir, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`),
    writeFile(
      path.join(outputRoot, 'firebase.json'),
      `${JSON.stringify(firebaseConfig, null, 2)}\n`,
    ),
  ]);
}

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  if (process.argv.length !== 2) throw new Error('This command does not accept arguments');
  const root = path.resolve(path.dirname(scriptPath), '../..');
  await prepareReplenishmentFunctions({ root, outputRoot: path.join(root, artifactPath) });
}
