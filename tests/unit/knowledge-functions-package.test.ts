import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { afterEach, expect, it } from 'vitest';
import {
  cpSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { prepareKnowledgeFunctions } from '../../scripts/config/prepare-knowledge-functions.ts';

const roots: string[] = [];
const modules = [
  'callables',
  'document-commands',
  'runtime',
  'worker',
  'upload',
  'source',
  'queue',
  'review-publish',
  'pipeline',
  'repository',
  'schemas',
  'embedding',
  'extract',
  'pdf-validation',
  'chunk',
  ...[
    'schemas',
    'rules',
    'repository',
    'commands',
    'generation',
    'model',
    'callables',
    'publication',
  ].map((n) => `product-knowledge-${n}`),
];
const aiModules = ['admission', 'budget', 'repository', 'runtime', 'schemas'];
const sdkFiles = ['index.cjs.js', 'index.d.ts', 'esm/index.esm.js', 'esm/package.json'];
const serviceAccount = 'baberhq-runtime@notbad-6be95.iam.gserviceaccount.com';
const exports = [
  'createDocumentUpload',
  'reviewAndPublishDocument',
  'retryDocumentProcessing',
  'deleteKnowledgeVersion',
  'uploadKnowledgePdf',
  'processKnowledgeTask',
  'saveKnowledgeProductReview',
  'suggestKnowledgeProductLink',
  'generateKnowledgeProductAliases',
  'acceptKnowledgeProductReview',
];
const versions = {
  'firebase-admin': '14.5.0',
  'firebase-functions': '7.4.0',
  zod: '4.6.5',
  genkit: '1.42.0',
  '@genkit-ai/google-genai': '1.42.0',
  'pdfjs-dist': '5.4.149',
  privateExtra: '1.0.0',
};

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'knowledge-functions-'));
  roots.push(root);
  mkdirSync(join(root, 'functions/lib/functions/src/knowledge'), { recursive: true });
  mkdirSync(join(root, 'functions/src/generated/esm'), { recursive: true });
  mkdirSync(join(root, 'functions/lib/shared'), { recursive: true });
  mkdirSync(join(root, 'functions/lib/functions/src/ai'), { recursive: true });
  for (const n of aiModules)
    writeFileSync(join(root, `functions/lib/functions/src/ai/${n}.js`), `// compiled ${n}`);
  writeFileSync(
    join(root, 'functions/lib/shared/product-normalization.js'),
    'export const normalizeProduct = text => text;',
  );
  writeFileSync(
    join(root, 'functions/lib/shared/knowledge-metadata.js'),
    'export function metadataFromLegacy() {return {kind: "procedure", origin: "synthetic"};}',
  );
  mkdirSync(join(root, 'functions/src'), { recursive: true });
  for (const name of modules)
    writeFileSync(
      join(root, `functions/lib/functions/src/knowledge/${name}.js`),
      Buffer.from(`// compiled ${name}\n`),
    );
  writeFileSync(
    join(root, 'functions/lib/functions/src/knowledge/callables.js'),
    [...exports.slice(0, 4).map((name) => `export function ${name}Function() { return {}; }`)].join(
      '\n',
    ),
  );
  writeFileSync(
    join(root, 'functions/lib/functions/src/knowledge/upload.js'),
    [
      'const tokenPattern = /\\$\\{[^}]+\\}|[{}]/g;',
      'const objectPath = `knowledge/${tokenPattern.source}/${`${"fixture"}`}`;',
      'export function uploadKnowledgePdfFunction() { return objectPath; }',
    ].join('\n'),
  );
  writeFileSync(
    join(root, 'functions/lib/functions/src/knowledge/worker.js'),
    'export function processKnowledgeTaskFunction() { return {}; }\n',
  );
  writeFileSync(
    join(root, 'functions/lib/functions/src/knowledge/product-knowledge-callables.js'),
    exports
      .slice(6)
      .map((n) => `export function ${n}Function(){return {};}`)
      .join('\n'),
  );
  for (const name of sdkFiles)
    writeFileSync(
      join(root, `functions/src/generated/${name}`),
      Buffer.from(`// generated ${name}\n`),
    );
  const sdkManifest = {
    name: '@barberhq/server',
    version: '0.0.1',
    main: 'index.cjs.js',
    module: 'esm/index.esm.js',
    typings: 'index.d.ts',
    browser: 'esm/index.esm.js',
    exports: {
      '.': { types: './index.d.ts', require: './index.cjs.js', default: './esm/index.esm.js' },
      './package.json': './package.json',
    },
    peerDependencies: { 'firebase-admin': '^13.4.0 || ^14.0.0' },
  };
  writeFileSync(
    join(root, 'functions/src/generated/package.json'),
    JSON.stringify(sdkManifest, null, 2),
  );
  writeFileSync(
    join(root, 'functions/src/index.ts'),
    [
      `setGlobalOptions({ serviceAccount: '${serviceAccount}' });`,
      ...exports.map((name) => `export const ${name} = ${name}Function();`),
      'export const getSourcePdf = sourcePdfFunction();',
    ].join('\n'),
  );
  writeFileSync(join(root, 'functions/package.json'), JSON.stringify({ dependencies: versions }));
  // Non-allowlisted fixture inputs must never be included in the isolated deployment package.
  writeFileSync(join(root, 'functions/src/private.local.json'), 'fixture-only sentinel');
  writeFileSync(join(root, 'functions/.env'), 'fixture-only sentinel');
  return { root, outputRoot: join(root, 'artifacts/knowledge-functions') };
}

function packageFiles(outputRoot: string) {
  return [
    'firebase.json',
    ...[
      'functions/index.js',
      'functions/package.json',
      'functions/knowledge/knowledge-metadata.js',
      'functions/knowledge/product-normalization.js',
      ...aiModules.map((n) => `functions/ai/${n}.js`),
      ...modules.map((name) => `functions/knowledge/${name}.js`),
      ...sdkFiles.map((name) => `functions/server-sdk/${name}`),
      'functions/server-sdk/package.json',
    ],
  ].map((name) => readFileSync(join(outputRoot, name)));
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

it('packages only allowlisted compiled modules, byte-exact SDK files, and ten callables', async () => {
  const { root, outputRoot } = fixture();
  await prepareKnowledgeFunctions({ root, outputRoot });
  const functionsDir = join(outputRoot, 'functions');
  expect(readdirSync(outputRoot).sort()).toEqual(['firebase.json', 'functions']);
  expect(readdirSync(functionsDir).sort()).toEqual([
    'ai',
    'index.js',
    'knowledge',
    'package.json',
    'server-sdk',
  ]);
  expect(readdirSync(join(functionsDir, 'knowledge')).sort()).toEqual(
    [
      ...modules.map((name) => `${name}.js`),
      'knowledge-metadata.js',
      'product-normalization.js',
    ].sort(),
  );
  for (const name of modules) {
    expect(readFileSync(join(functionsDir, `knowledge/${name}.js`))).toEqual(
      readFileSync(join(root, `functions/lib/functions/src/knowledge/${name}.js`)),
    );
  }
  for (const name of sdkFiles) {
    expect(readFileSync(join(functionsDir, `server-sdk/${name}`))).toEqual(
      readFileSync(join(root, `functions/src/generated/${name}`)),
    );
  }
  const entry = readFileSync(join(functionsDir, 'index.js'), 'utf8');
  expect(entry).toContain(`serviceAccount: '${serviceAccount}'`);
  expect([...entry.matchAll(/export const (\w+) =/g)].map((match) => match[1])).toEqual(exports);
  expect(entry).not.toContain('getSourcePdf');
  expect(JSON.parse(readFileSync(join(functionsDir, 'package.json'), 'utf8')).dependencies).toEqual(
    {
      ...Object.fromEntries(Object.entries(versions).filter(([name]) => name !== 'privateExtra')),
      '@barberhq/server': 'file:server-sdk',
    },
  );
  expect(packageFiles(outputRoot).join('').includes('fixture-only sentinel')).toBe(false);
});

it('rejects missing inputs, altered service account, or dependency ranges without changing prior output', async () => {
  const { root, outputRoot } = fixture();
  await prepareKnowledgeFunctions({ root, outputRoot });
  const before = packageFiles(outputRoot);
  rmSync(join(root, 'functions/lib/functions/src/knowledge/chunk.js'));
  await expect(prepareKnowledgeFunctions({ root, outputRoot })).rejects.toThrow();
  writeFileSync(join(root, 'functions/lib/functions/src/knowledge/chunk.js'), '// chunk\n');
  writeFileSync(
    join(root, 'functions/src/index.ts'),
    `setGlobalOptions({ serviceAccount: 'wrong@example.com' });`,
  );
  await expect(prepareKnowledgeFunctions({ root, outputRoot })).rejects.toThrow(
    /service account|export/i,
  );
  writeFileSync(
    join(root, 'functions/src/index.ts'),
    [
      `setGlobalOptions({ serviceAccount: '${serviceAccount}' });`,
      ...exports.map((name) => `export const ${name} = ${name}Function();`),
    ].join('\n'),
  );
  writeFileSync(
    join(root, 'functions/package.json'),
    JSON.stringify({ dependencies: { ...versions, zod: '^4.6.5' } }),
  );
  await expect(prepareKnowledgeFunctions({ root, outputRoot })).rejects.toThrow(/dependency/i);
  expect(packageFiles(outputRoot)).toEqual(before);
});

it('rejects symlink inputs and outputs, unexpected files, and output paths outside the fixed artifact root', async () => {
  const { root, outputRoot } = fixture();
  await prepareKnowledgeFunctions({ root, outputRoot });
  const before = packageFiles(outputRoot);
  writeFileSync(join(outputRoot, 'functions/unexpected.js'), 'not allowed');
  await expect(prepareKnowledgeFunctions({ root, outputRoot })).rejects.toThrow(/Unexpected file/);
  rmSync(join(outputRoot, 'functions/unexpected.js'));
  rmSync(join(root, 'functions/lib/functions/src/knowledge/chunk.js'));
  symlinkSync(
    join(root, 'functions/lib/functions/src/knowledge/runtime.js'),
    join(root, 'functions/lib/functions/src/knowledge/chunk.js'),
  );
  await expect(prepareKnowledgeFunctions({ root, outputRoot })).rejects.toThrow(/Symlink/);
  rmSync(join(root, 'functions/lib/functions/src/knowledge/chunk.js'));
  writeFileSync(join(root, 'functions/lib/functions/src/knowledge/chunk.js'), '// chunk\n');
  rmSync(join(outputRoot, 'functions/knowledge/chunk.js'));
  symlinkSync(
    join(root, 'functions/lib/functions/src/knowledge/runtime.js'),
    join(outputRoot, 'functions/knowledge/chunk.js'),
  );
  await expect(prepareKnowledgeFunctions({ root, outputRoot })).rejects.toThrow(
    /Symlink|file type/i,
  );
  rmSync(join(outputRoot, 'functions/knowledge/chunk.js'));
  writeFileSync(join(outputRoot, 'functions/knowledge/chunk.js'), '// compiled chunk\n');
  await expect(
    prepareKnowledgeFunctions({ root, outputRoot: join(root, 'elsewhere') }),
  ).rejects.toThrow(/Output must/);
  expect(packageFiles(outputRoot)).toEqual(before);
});

it('preserves allowed generated install artifacts while checking names and types only', async () => {
  const { root, outputRoot } = fixture();
  await prepareKnowledgeFunctions({ root, outputRoot });
  const functionsDir = join(outputRoot, 'functions');
  mkdirSync(join(functionsDir, 'node_modules'));
  writeFileSync(join(functionsDir, 'package-lock.json'), 'lock');
  writeFileSync(join(functionsDir, '.env.notbad-6be95'), 'fixture parameter');
  writeFileSync(join(outputRoot, 'firebase-debug.log'), 'fixture log');
  await expect(prepareKnowledgeFunctions({ root, outputRoot })).resolves.toBeUndefined();
  expect(readdirSync(functionsDir)).toContain('.env.notbad-6be95');
  expect(readFileSync(join(functionsDir, 'package.json'), 'utf8')).toContain('firebase-admin');
});

it('rejects commented endpoint declarations and missing compiled factory exports', async () => {
  const { root, outputRoot } = fixture();
  await prepareKnowledgeFunctions({ root, outputRoot });
  const before = packageFiles(outputRoot);
  writeFileSync(
    join(root, 'functions/src/index.ts'),
    [
      `setGlobalOptions({ serviceAccount: '${serviceAccount}' });`,
      ...exports.map((name) => `// export const ${name} = ${name}Function();`),
    ].join('\n'),
  );
  await expect(prepareKnowledgeFunctions({ root, outputRoot })).rejects.toThrow(/callable export/i);
  writeFileSync(
    join(root, 'functions/src/index.ts'),
    [
      `setGlobalOptions({ serviceAccount: '${serviceAccount}' });`,
      ...exports.map((name) => `export const ${name} = ${name}Function();`),
    ].join('\n'),
  );
  writeFileSync(
    join(root, 'functions/lib/functions/src/knowledge/callables.js'),
    'export const createDocumentUploadFunction = 42;\n',
  );
  await expect(prepareKnowledgeFunctions({ root, outputRoot })).rejects.toThrow(
    /compiled factory export/i,
  );
  writeFileSync(
    join(root, 'functions/lib/functions/src/knowledge/callables.js'),
    [
      'const tokenPattern = /\\$\\{[^}]+\\}|[{}]/g;',
      'const objectPath = `knowledge/${tokenPattern.source}/${`${"fixture"}`}`;',
      'function nested() { function createDocumentUploadFunction() { return objectPath; } }',
    ].join('\n'),
  );
  await expect(prepareKnowledgeFunctions({ root, outputRoot })).rejects.toThrow(
    /compiled factory export/i,
  );
  expect(packageFiles(outputRoot)).toEqual(before);
});

it('rejects a symlink root before reading inputs or writing output', async () => {
  const { root, outputRoot } = fixture();
  const alias = join(root, 'root-alias');
  symlinkSync(root, alias);
  await expect(
    prepareKnowledgeFunctions({
      root: alias,
      outputRoot: join(alias, 'artifacts/knowledge-functions'),
    }),
  ).rejects.toThrow(/Symlink/);
  expect(() => readdirSync(outputRoot)).toThrow();
});

it('preserves generated SDK metadata and validates every declared entrypoint target', async () => {
  const { root, outputRoot } = fixture();
  const manifestPath = join(root, 'functions/src/generated/package.json');
  const generatedManifest = readFileSync(manifestPath);
  await prepareKnowledgeFunctions({ root, outputRoot });
  expect(readFileSync(join(outputRoot, 'functions/server-sdk/package.json'))).toEqual(
    generatedManifest,
  );
  expect(readFileSync(join(outputRoot, 'functions/server-sdk/index.d.ts'))).toEqual(
    readFileSync(join(root, 'functions/src/generated/index.d.ts')),
  );
  expect(
    JSON.parse(readFileSync(join(outputRoot, 'functions/server-sdk/package.json'), 'utf8'))
      .peerDependencies,
  ).toEqual({ 'firebase-admin': '^13.4.0 || ^14.0.0' });

  const before = packageFiles(outputRoot);
  writeFileSync(
    manifestPath,
    JSON.stringify({
      name: '@barberhq/server',
      main: 'missing.cjs.js',
      typings: 'index.d.ts',
      peerDependencies: { 'firebase-admin': '^14.0.0' },
    }),
  );
  await expect(prepareKnowledgeFunctions({ root, outputRoot })).rejects.toThrow(
    /SDK.*target|entrypoint/i,
  );
  writeFileSync(
    manifestPath,
    JSON.stringify({
      name: '@barberhq/server',
      main: 'index.cjs.js',
      typings: 'index.d.ts',
      peerDependencies: { 'firebase-admin': '^13.4.0' },
    }),
  );
  await expect(prepareKnowledgeFunctions({ root, outputRoot })).rejects.toThrow(
    /dependency compatibility/i,
  );
  writeFileSync(
    manifestPath,
    JSON.stringify({
      name: '@barberhq/server',
      main: 'index.cjs.js',
      typings: 'index.d.ts',
      exports: { '.': { types: 'https://example.invalid/index.d.ts', require: './index.cjs.js' } },
      peerDependencies: { 'firebase-admin': '^14.0.0' },
    }),
  );
  await expect(prepareKnowledgeFunctions({ root, outputRoot })).rejects.toThrow(/export target/i);
  expect(packageFiles(outputRoot)).toEqual(before);
});

it('loads the packaged schema with its shared metadata runtime without reaching outside the package', async () => {
  const { root, outputRoot } = fixture();
  writeFileSync(
    join(root, 'functions/lib/functions/src/knowledge/schemas.js'),
    "import {metadataFromLegacy} from '../../../shared/knowledge-metadata.js'; export const sample = metadataFromLegacy('synthetic-procedure');",
  );
  await prepareKnowledgeFunctions({ root, outputRoot });
  const schemaUrl = pathToFileURL(join(outputRoot, 'functions/knowledge/schemas.js')).href;
  const result = execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `import {sample} from ${JSON.stringify(schemaUrl)}; console.log(JSON.stringify(sample));`,
    ],
    { encoding: 'utf8' },
  );
  expect(JSON.parse(result)).toEqual({ kind: 'procedure', origin: 'synthetic' });
});

it('loads actual compiled product services using only named packaged files and declared dependencies', async () => {
  const { root, outputRoot } = fixture();
  const source = resolve('.');
  const files = [
    ...modules.map((n) => `functions/lib/functions/src/knowledge/${n}.js`),
    ...aiModules.map((n) => `functions/lib/functions/src/ai/${n}.js`),
    'functions/lib/shared/knowledge-metadata.js',
    'functions/lib/shared/product-normalization.js',
    'functions/src/index.ts',
    'functions/package.json',
    ...sdkFiles.map((n) => `functions/src/generated/${n}`),
    'functions/src/generated/package.json',
  ];
  for (const file of files) cpSync(join(source, file), join(root, file));
  await prepareKnowledgeFunctions({ root, outputRoot });
  const fn = join(outputRoot, 'functions');
  mkdirSync(join(fn, 'node_modules/@barberhq'), { recursive: true });
  const manifest = JSON.parse(readFileSync(join(fn, 'package.json'), 'utf8'));
  for (const dep of Object.keys(manifest.dependencies)) {
    const target =
      dep === '@barberhq/server'
        ? join(fn, 'server-sdk')
        : join(source, 'functions/node_modules', dep);
    mkdirSync(join(fn, 'node_modules', dep, '..'), { recursive: true });
    symlinkSync(target, join(fn, 'node_modules', dep), 'dir');
  }
  const entry = pathToFileURL(join(fn, 'index.js')).href;
  const output = execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `const functions=await import(${JSON.stringify(entry)});const commands=await import('./knowledge/product-knowledge-commands.js');const generation=await import('./knowledge/product-knowledge-generation.js');const normalization=await import('./knowledge/product-normalization.js');const metadata=await import('./knowledge/knowledge-metadata.js');console.log(JSON.stringify({exports:Object.keys(functions).sort(),commands:typeof commands.ProductKnowledgeCommands,generation:typeof generation.ProductKnowledgeGeneration,normalized:normalization.normalizeProduct('ŁÓDŹ—A'),kind:metadata.metadataFromLegacy('synthetic-procedure').kind}));`,
    ],
    { cwd: fn, encoding: 'utf8', env: { PATH: process.env.PATH, GCLOUD_PROJECT: 'demo-barberhq' } },
  );
  expect(JSON.parse(output.trim().split('\n').at(-1)!)).toEqual({
    exports: [...exports].sort(),
    commands: 'function',
    generation: 'function',
    normalized: 'lodz a',
    kind: 'procedure',
  });
});
