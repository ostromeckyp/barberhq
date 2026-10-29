import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepareSourceFunctions } from '../../scripts/config/prepare-source-functions.ts';

const roots: string[] = [];
const serviceAccount = 'baberhq-runtime@notbad-6be95.iam.gserviceaccount.com';

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'source-functions-'));
  roots.push(root);
  mkdirSync(join(root, 'functions/lib/functions/src/knowledge'), { recursive: true });
  mkdirSync(join(root, 'functions/src'), { recursive: true });
  const source = Buffer.from('export function sourcePdfFunction() { return 42; }\n');
  writeFileSync(join(root, 'functions/lib/functions/src/knowledge/source.js'), source);
  writeFileSync(
    join(root, 'functions/package.json'),
    JSON.stringify({
      dependencies: {
        'firebase-admin': '14.5.0',
        'firebase-functions': '7.4.0',
        'private-extra': '1.0.0',
      },
    }),
  );
  writeFileSync(
    join(root, 'functions/src/index.ts'),
    `setGlobalOptions({ serviceAccount: '${serviceAccount}' });\nexport const getSourcePdf = sourcePdfFunction();\n`,
  );
  writeFileSync(join(root, 'functions/unrelated.js'), 'private-extra');
  writeFileSync(join(root, 'sensitive-extra.txt'), 'fixture secret that must not be packaged');
  const outputRoot = join(root, 'artifacts/source-functions');
  return { root, outputRoot, source };
}

function packageBytes(outputRoot: string) {
  return [
    'firebase.json',
    'functions/index.js',
    'functions/source.js',
    'functions/package.json',
  ].map((name) => readFileSync(join(outputRoot, name)));
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

it('packages only the byte-exact source endpoint with pinned runtime dependencies', async () => {
  const { root, outputRoot, source } = fixture();
  await prepareSourceFunctions({ root, outputRoot });
  expect(readdirSync(outputRoot).sort()).toEqual(['firebase.json', 'functions']);
  expect(readdirSync(join(outputRoot, 'functions')).sort()).toEqual([
    'index.js',
    'package.json',
    'source.js',
  ]);
  expect(readFileSync(join(outputRoot, 'functions/source.js'))).toEqual(source);
  const entry = readFileSync(join(outputRoot, 'functions/index.js'), 'utf8');
  expect(entry).toContain(`serviceAccount: '${serviceAccount}'`);
  expect(entry).toContain('export const getSourcePdf = sourcePdfFunction();');
  expect(entry.match(/export const /g)).toHaveLength(1);
  const pkg = JSON.parse(readFileSync(join(outputRoot, 'functions/package.json'), 'utf8'));
  expect(pkg).toEqual({
    private: true,
    type: 'module',
    main: 'index.js',
    engines: { node: '22' },
    dependencies: {
      'firebase-admin': '14.5.0',
      'firebase-functions': '7.4.0',
    },
  });
  const config = JSON.parse(readFileSync(join(outputRoot, 'firebase.json'), 'utf8'));
  expect(config).toEqual({
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
  });
});

it('rejects a missing or empty compiled source without changing previous output', async () => {
  const { root, outputRoot } = fixture();
  await prepareSourceFunctions({ root, outputRoot });
  const original = packageBytes(outputRoot);
  rmSync(join(root, 'functions/lib/functions/src/knowledge/source.js'));
  await expect(prepareSourceFunctions({ root, outputRoot })).rejects.toThrow(/ENOENT/);
  writeFileSync(join(root, 'functions/lib/functions/src/knowledge/source.js'), '');
  await expect(prepareSourceFunctions({ root, outputRoot })).rejects.toThrow(
    'Compiled source endpoint is empty',
  );
  expect(packageBytes(outputRoot)).toEqual(original);
});

it('rejects a changed runtime account or dependency version without changing previous output', async () => {
  const { root, outputRoot } = fixture();
  await prepareSourceFunctions({ root, outputRoot });
  const original = packageBytes(outputRoot);
  writeFileSync(
    join(root, 'functions/src/index.ts'),
    `setGlobalOptions({ serviceAccount: 'wrong@example.com' });`,
  );
  await expect(prepareSourceFunctions({ root, outputRoot })).rejects.toThrow(
    'Expected source endpoint and runtime service account',
  );
  writeFileSync(
    join(root, 'functions/src/index.ts'),
    `setGlobalOptions({ serviceAccount: '${serviceAccount}' });\nexport const getSourcePdf = sourcePdfFunction();`,
  );
  writeFileSync(
    join(root, 'functions/package.json'),
    JSON.stringify({
      dependencies: {
        'firebase-admin': '^14.5.0',
        'firebase-functions': '7.4.0',
      },
    }),
  );
  await expect(prepareSourceFunctions({ root, outputRoot })).rejects.toThrow(
    'Expected exact Firebase runtime dependency versions',
  );
  expect(packageBytes(outputRoot)).toEqual(original);
});

it('ignores known generated package artifacts while regenerating reviewed files', async () => {
  const { root, outputRoot } = fixture();
  await prepareSourceFunctions({ root, outputRoot });
  const functions = join(outputRoot, 'functions');
  writeFileSync(join(functions, 'package-lock.json'), '{}');
  mkdirSync(join(functions, 'node_modules'));
  writeFileSync(join(functions, '.env.notbad-6be95'), 'fixture parameter');
  writeFileSync(join(outputRoot, 'firebase-debug.log'), 'fixture log');
  await expect(prepareSourceFunctions({ root, outputRoot })).resolves.toBeUndefined();
  expect(readdirSync(functions).sort()).toEqual([
    '.env.notbad-6be95',
    'index.js',
    'node_modules',
    'package-lock.json',
    'package.json',
    'source.js',
  ]);
});

it('rejects a service account occurrence outside the actual global options call', async () => {
  const { root, outputRoot } = fixture();
  await prepareSourceFunctions({ root, outputRoot });
  const original = packageBytes(outputRoot);
  writeFileSync(
    join(root, 'functions/src/index.ts'),
    `setGlobalOptions({ memory: '512MiB' });\n// serviceAccount: '${serviceAccount}'\nconst unrelated = { serviceAccount: '${serviceAccount}' };\nexport const getSourcePdf = sourcePdfFunction();`,
  );
  await expect(prepareSourceFunctions({ root, outputRoot })).rejects.toThrow(
    'Expected source endpoint and runtime service account',
  );
  expect(packageBytes(outputRoot)).toEqual(original);
});

it('rejects unknown files in a previously valid package', async () => {
  const { root, outputRoot } = fixture();
  await prepareSourceFunctions({ root, outputRoot });
  const original = packageBytes(outputRoot);
  writeFileSync(join(outputRoot, 'functions/other.js'), 'must not be uploaded');
  await expect(prepareSourceFunctions({ root, outputRoot })).rejects.toThrow(
    'Unexpected file in isolated Functions package',
  );
  expect(packageBytes(outputRoot)).toEqual(original);
});

it('rejects output outside the fixed artifact location before writing', async () => {
  const { root } = fixture();
  const outside = join(root, 'elsewhere');
  await expect(prepareSourceFunctions({ root, outputRoot: outside })).rejects.toThrow();
  expect(() => readdirSync(outside)).toThrow();
});
