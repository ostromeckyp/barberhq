import { lstat, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sourceRuntimeAccount } from './functions-runtime.ts';

type Options = { root: string; outputRoot: string };
const account = 'baberhq-runtime@notbad-6be95.iam.gserviceaccount.com';
const artifactPath = 'artifacts/source-functions';

async function requireOrdinaryPath(target: string, allowMissing = false): Promise<void> {
  try {
    const stat = await lstat(target);
    if (stat.isSymbolicLink()) throw new Error(`Symlink is not allowed: ${target}`);
  } catch (error) {
    if (allowMissing && (error as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw error;
  }
}

async function requireAllowedInput(root: string, relative: string): Promise<string> {
  let current = root;
  for (const segment of relative.split('/')) {
    current = path.join(current, segment);
    await requireOrdinaryPath(current);
  }
  return current;
}

async function requireSafeOutput(root: string, outputRoot: string): Promise<void> {
  if (path.resolve(outputRoot) !== path.join(root, artifactPath)) {
    throw new Error('Output must be artifacts/source-functions inside root');
  }
  for (const relative of ['artifacts', artifactPath, `${artifactPath}/functions`]) {
    await requireOrdinaryPath(path.join(root, relative), true);
  }
  for (const relative of [
    `${artifactPath}/firebase.json`,
    `${artifactPath}/functions/index.js`,
    `${artifactPath}/functions/source.js`,
    `${artifactPath}/functions/package.json`,
  ])
    await requireOrdinaryPath(path.join(root, relative), true);

  // Inspect names and file types only. In particular, never open a CLI-generated .env file.
  for (const [directory, allowed] of [
    [outputRoot, ['firebase.json', 'functions']],
    [
      path.join(outputRoot, 'functions'),
      [
        'index.js',
        'source.js',
        'package.json',
        'package-lock.json',
        'node_modules',
        '.env.notbad-6be95',
      ],
    ],
  ] as const) {
    try {
      const names = await readdir(directory);
      const allowedNames: readonly string[] = allowed;
      for (const name of names) {
        const log = /^(?:firebase|functions|ui)-debug(?:\.[^/]+)?\.log$/.test(name);
        if (!allowedNames.includes(name) && !log) {
          throw new Error(
            `Unexpected file in isolated Functions package: ${path.join(directory, name)}`,
          );
        }
        const stat = await lstat(path.join(directory, name));
        const shouldBeDirectory = name === 'functions' || name === 'node_modules';
        if (stat.isSymbolicLink() || (shouldBeDirectory ? !stat.isDirectory() : !stat.isFile())) {
          throw new Error(
            `Unexpected file type in isolated Functions package: ${path.join(directory, name)}`,
          );
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
}

export async function prepareSourceFunctions({ root, outputRoot }: Options): Promise<void> {
  root = path.resolve(root);
  await requireSafeOutput(root, outputRoot);
  const sourcePath = await requireAllowedInput(
    root,
    'functions/lib/functions/src/knowledge/source.js',
  );
  const packagePath = await requireAllowedInput(root, 'functions/package.json');
  const indexPath = await requireAllowedInput(root, 'functions/src/index.ts');

  const [source, packageText, index] = await Promise.all([
    readFile(sourcePath),
    readFile(packagePath, 'utf8'),
    readFile(indexPath, 'utf8'),
  ]);
  if (source.length === 0) throw new Error('Compiled source endpoint is empty');
  const declaredAccount = sourceRuntimeAccount(index);
  if (
    declaredAccount !== account ||
    !index.includes('export const getSourcePdf = sourcePdfFunction();')
  ) {
    throw new Error(
      'Expected source endpoint and runtime service account are missing from Functions entrypoint',
    );
  }
  const dependencies = (JSON.parse(packageText) as { dependencies?: Record<string, string> })
    .dependencies;
  if (
    dependencies?.['firebase-admin'] !== '14.5.0' ||
    dependencies?.['firebase-functions'] !== '7.4.0'
  ) {
    throw new Error('Expected exact Firebase runtime dependency versions are missing');
  }

  const functionsDir = path.join(outputRoot, 'functions');
  const entry = [
    "import { initializeApp } from 'firebase-admin/app';",
    "import { setGlobalOptions } from 'firebase-functions';",
    "import { sourcePdfFunction } from './source.js';",
    '',
    'initializeApp();',
    `setGlobalOptions({ serviceAccount: '${account}' });`,
    '',
    'export const getSourcePdf = sourcePdfFunction();',
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
  await mkdir(functionsDir, { recursive: true });
  await Promise.all([
    writeFile(path.join(functionsDir, 'source.js'), source),
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
  await prepareSourceFunctions({ root, outputRoot: path.join(root, artifactPath) });
}
