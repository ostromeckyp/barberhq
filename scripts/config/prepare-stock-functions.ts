import { lstat, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sourceRuntimeAccount } from './functions-runtime.ts';

type Options = { root: string; outputRoot: string };
const artifactPath = 'artifacts/stock-functions';
const account = 'baberhq-runtime@notbad-6be95.iam.gserviceaccount.com';
const stockFiles = ['commands', 'repository', 'errors', 'schemas', 'intent', 'runtime'].map(
  (name) => `${name}.js`,
);
const sdkFiles = ['index.cjs.js', 'esm/index.esm.js', 'esm/package.json'];

async function ordinary(target: string, missing = false): Promise<void> {
  try {
    const stat = await lstat(target);
    if (stat.isSymbolicLink()) throw new Error(`Symlink is not allowed: ${target}`);
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

async function output(root: string, outputRoot: string): Promise<void> {
  if (path.resolve(outputRoot) !== path.join(root, artifactPath))
    throw new Error('Output must be artifacts/stock-functions inside root');
  const dirs = [
    'artifacts',
    artifactPath,
    `${artifactPath}/functions`,
    `${artifactPath}/functions/stock`,
    `${artifactPath}/functions/server-sdk`,
    `${artifactPath}/functions/server-sdk/esm`,
  ];
  for (const dir of dirs) await ordinary(path.join(root, dir), true);
  const names: [string, string[]][] = [
    [outputRoot, ['firebase.json', 'functions']],
    [
      path.join(outputRoot, 'functions'),
      [
        'index.js',
        'package.json',
        'stock',
        'server-sdk',
        'package-lock.json',
        'node_modules',
        '.env.notbad-6be95',
      ],
    ],
    [path.join(outputRoot, 'functions/stock'), stockFiles],
    [path.join(outputRoot, 'functions/server-sdk'), ['package.json', 'index.cjs.js', 'esm']],
    [path.join(outputRoot, 'functions/server-sdk/esm'), ['index.esm.js', 'package.json']],
  ];
  for (const [dir, allowed] of names) {
    let present: string[];
    try {
      present = await readdir(dir);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
      throw error;
    }
    for (const name of present) {
      const log = /^(?:firebase|functions|ui)-debug(?:\.[^/]+)?\.log$/.test(name);
      const artifactOrFunctionsDir =
        dir === outputRoot || dir === path.join(outputRoot, 'functions');
      if (!allowed.includes(name) && !(artifactOrFunctionsDir && log))
        throw new Error(`Unexpected file in isolated Functions package: ${path.join(dir, name)}`);
      const stat = await lstat(path.join(dir, name));
      const directory = ['functions', 'stock', 'server-sdk', 'esm', 'node_modules'].includes(name);
      if (stat.isSymbolicLink() || (directory ? !stat.isDirectory() : !stat.isFile()))
        throw new Error(
          `Unexpected file type in isolated Functions package: ${path.join(dir, name)}`,
        );
    }
  }
}

export async function prepareStockFunctions({ root, outputRoot }: Options): Promise<void> {
  root = path.resolve(root);
  await output(root, outputRoot);
  const files = [
    ...stockFiles.map((name) => `functions/lib/functions/src/stock/${name}`),
    ...sdkFiles.map((name) => `functions/src/generated/${name}`),
    'functions/src/generated/package.json',
    'functions/src/index.ts',
    'functions/package.json',
  ];
  const bytes = await Promise.all(files.map((name) => input(root, name)));
  if (bytes.some((data) => data.length === 0))
    throw new Error('Required stock runtime input is empty');
  const byName = new Map(files.map((name, i) => [name, bytes[i]]));
  const index = byName.get('functions/src/index.ts')!.toString('utf8');
  if (sourceRuntimeAccount(index) !== account)
    throw new Error('Expected runtime service account is missing from Functions entrypoint');
  const dependencies = (
    JSON.parse(byName.get('functions/package.json')!.toString('utf8')) as {
      dependencies?: Record<string, string>;
    }
  ).dependencies;
  if (
    dependencies?.['firebase-admin'] !== '14.5.0' ||
    dependencies?.['firebase-functions'] !== '7.4.0' ||
    dependencies?.zod !== '4.6.5'
  ) {
    throw new Error('Expected exact stock dependency versions are missing');
  }
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
    "import { stockCommand } from './stock/commands.js';",
    'initializeApp();',
    `setGlobalOptions({ serviceAccount: '${account}' });`,
    "export const submitRequest = stockCommand('SUBMIT');",
    "export const approveRequest = stockCommand('APPROVE');",
    "export const rejectRequest = stockCommand('REJECT');",
    "export const dispatchTransfer = stockCommand('DISPATCH');",
    "export const receiveTransfer = stockCommand('RECEIVE');",
    '',
  ].join('\n');
  const manifest = {
    private: true,
    type: 'module',
    main: 'index.js',
    engines: { node: '22' },
    dependencies: {
      'firebase-admin': dependencies['firebase-admin'],
      'firebase-functions': dependencies['firebase-functions'],
      zod: dependencies.zod,
      '@barberhq/server': 'file:server-sdk',
    },
  };
  // Generated runtime bytes stay exact; omit the SDK's stale Firebase 13 peer declaration.
  const sdkManifest = {
    name: '@barberhq/server',
    version: '0.0.1',
    main: 'index.cjs.js',
    module: 'esm/index.esm.js',
    exports: {
      '.': { require: './index.cjs.js', default: './esm/index.esm.js' },
    },
  };
  const firebaseConfig = {
    functions: [
      {
        source: 'functions',
        codebase: 'stock',
        runtime: 'nodejs22',
        ignore: [
          'node_modules',
          '.git',
          'firebase-debug.log',
          'firebase-debug.*.log',
          'functions-debug.log',
          'functions-debug.*.log',
          'ui-debug.log',
          'ui-debug.*.log',
          '*.local.json',
          '.env',
          '.env.*',
        ],
      },
    ],
  };
  await mkdir(path.join(functionsDir, 'stock'), { recursive: true });
  await mkdir(path.join(functionsDir, 'server-sdk/esm'), { recursive: true });
  await Promise.all([
    ...stockFiles.map((name) =>
      writeFile(
        path.join(functionsDir, 'stock', name),
        byName.get(`functions/lib/functions/src/stock/${name}`)!,
      ),
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
  await prepareStockFunctions({ root, outputRoot: path.join(root, artifactPath) });
}
