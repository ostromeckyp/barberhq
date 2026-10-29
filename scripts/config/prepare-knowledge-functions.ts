import { lstat, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const typescriptPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../functions/node_modules/typescript/lib/typescript.js',
);
const typescript = createRequire(import.meta.url)(typescriptPath);

type Options = { root: string; outputRoot: string };
const artifactPath = 'artifacts/knowledge-functions';
const account = 'baberhq-runtime@notbad-6be95.iam.gserviceaccount.com';
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
const sdkFiles = [
  'index.cjs.js',
  'index.d.ts',
  'package.json',
  'esm/index.esm.js',
  'esm/package.json',
];
const runtimeDependencies = [
  'firebase-admin',
  'firebase-functions',
  'zod',
  'genkit',
  '@genkit-ai/google-genai',
  'pdfjs-dist',
];
const endpoints = [
  ['createDocumentUpload', 'createDocumentUploadFunction', 'callables'],
  ['reviewAndPublishDocument', 'reviewAndPublishDocumentFunction', 'callables'],
  ['retryDocumentProcessing', 'retryDocumentProcessingFunction', 'callables'],
  ['deleteKnowledgeVersion', 'deleteKnowledgeVersionFunction', 'callables'],
  ['uploadKnowledgePdf', 'uploadKnowledgePdfFunction', 'upload'],
  ['processKnowledgeTask', 'processKnowledgeTaskFunction', 'worker'],
  ...(
    [
      'saveKnowledgeProductReview',
      'suggestKnowledgeProductLink',
      'generateKnowledgeProductAliases',
      'acceptKnowledgeProductReview',
    ] as const
  ).map((name) => [name, `${name}Function`, 'product-knowledge-callables'] as const),
] as const;

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

async function safeOutput(root: string, outputRoot: string): Promise<void> {
  if (path.resolve(outputRoot) !== path.join(root, artifactPath)) {
    throw new Error('Output must be artifacts/knowledge-functions inside root');
  }
  const relativeDirs = [
    'artifacts',
    artifactPath,
    `${artifactPath}/functions`,
    `${artifactPath}/functions/knowledge`,
    `${artifactPath}/functions/ai`,
    `${artifactPath}/functions/server-sdk`,
    `${artifactPath}/functions/server-sdk/esm`,
  ];
  for (const relative of relativeDirs) await ordinary(path.join(root, relative), true);

  const generatedModules = [
    ...modules.map((name) => `${name}.js`),
    'knowledge-metadata.js',
    'product-normalization.js',
  ];
  const generatedSdk = ['package.json', 'index.cjs.js', 'index.d.ts', 'esm'];
  const directories: [string, string[]][] = [
    [outputRoot, ['firebase.json', 'functions']],
    [
      path.join(outputRoot, 'functions'),
      [
        'index.js',
        'package.json',
        'knowledge',
        'ai',
        'server-sdk',
        'cloud-config.js',
        'config',
        'package-lock.json',
        'node_modules',
        '.env.notbad-6be95',
      ],
    ],
    [path.join(outputRoot, 'functions/knowledge'), generatedModules],
    [path.join(outputRoot, 'functions/ai'), aiModules.map((n) => `${n}.js`)],
    [path.join(outputRoot, 'functions/config'), ['cloud.json']],
    [path.join(outputRoot, 'functions/server-sdk'), generatedSdk],
    [path.join(outputRoot, 'functions/server-sdk/esm'), ['index.esm.js', 'package.json']],
  ];
  for (const [directory, allowed] of directories) {
    let names: string[];
    try {
      names = await readdir(directory);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
      throw error;
    }
    for (const name of names) {
      const log = /^(?:firebase|functions|ui)-debug(?:\.[^/]+)?\.log$/.test(name);
      const canContainLog =
        directory === outputRoot || directory === path.join(outputRoot, 'functions');
      if (!allowed.includes(name) && !(canContainLog && log)) {
        throw new Error(
          `Unexpected file in isolated Functions package: ${path.join(directory, name)}`,
        );
      }
      const stat = await lstat(path.join(directory, name));
      const shouldBeDirectory = [
        'functions',
        'knowledge',
        'ai',
        'server-sdk',
        'esm',
        'node_modules',
        'config',
      ].includes(name);
      if (stat.isSymbolicLink() || (shouldBeDirectory ? !stat.isDirectory() : !stat.isFile())) {
        throw new Error(
          `Unexpected file type in isolated Functions package: ${path.join(directory, name)}`,
        );
      }
    }
  }
}

function parseSource(text: string, fileName: string, scriptKind: number) {
  const source = typescript.createSourceFile(
    fileName,
    text,
    typescript.ScriptTarget.Latest,
    true,
    scriptKind,
  );
  if (source.parseDiagnostics.length) throw new Error(`Unable to parse ${fileName}`);
  return source;
}

function exported(statement: any): boolean {
  return (statement.modifiers ?? []).some(
    (modifier: any) => modifier.kind === typescript.SyntaxKind.ExportKeyword,
  );
}

function hasRuntimeAccount(source: any): boolean {
  return source.statements.some((statement: any) => {
    if (
      !typescript.isExpressionStatement(statement) ||
      !typescript.isCallExpression(statement.expression) ||
      !typescript.isIdentifier(statement.expression.expression) ||
      statement.expression.expression.text !== 'setGlobalOptions'
    )
      return false;
    const options = statement.expression.arguments[0];
    if (!options || !typescript.isObjectLiteralExpression(options)) return false;
    return options.properties.some(
      (property: any) =>
        typescript.isPropertyAssignment(property) &&
        (typescript.isIdentifier(property.name) || typescript.isStringLiteral(property.name)) &&
        property.name.text === 'serviceAccount' &&
        typescript.isStringLiteral(property.initializer) &&
        property.initializer.text === account,
    );
  });
}

function hasEndpointDeclaration(source: any, name: string, factory: string): boolean {
  return source.statements.some((statement: any) => {
    if (!typescript.isVariableStatement(statement) || !exported(statement)) return false;
    return statement.declarationList.declarations.some((declaration: any) => {
      if (
        !typescript.isIdentifier(declaration.name) ||
        declaration.name.text !== name ||
        !declaration.initializer ||
        !typescript.isCallExpression(declaration.initializer) ||
        declaration.initializer.arguments.length !== 0
      )
        return false;
      return (
        typescript.isIdentifier(declaration.initializer.expression) &&
        declaration.initializer.expression.text === factory
      );
    });
  });
}

function hasExportedFunction(source: any, name: string): boolean {
  return source.statements.some((statement: any) => {
    if (typescript.isFunctionDeclaration(statement)) {
      return exported(statement) && statement.name?.text === name;
    }
    if (!typescript.isVariableStatement(statement) || !exported(statement)) return false;
    return statement.declarationList.declarations.some(
      (declaration: any) =>
        typescript.isIdentifier(declaration.name) &&
        declaration.name.text === name &&
        !!declaration.initializer &&
        (typescript.isArrowFunction(declaration.initializer) ||
          typescript.isFunctionExpression(declaration.initializer)),
    );
  });
}

function packageEntryTargets(value: unknown): string[] {
  if (typeof value === 'string') {
    if (!value.startsWith('./')) throw new Error(`Invalid server SDK export target: ${value}`);
    return [value.slice(2)];
  }
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return value.flatMap(packageEntryTargets);
  if (value && typeof value === 'object') return Object.values(value).flatMap(packageEntryTargets);
  throw new Error('Invalid non-null server SDK export target');
}

function peerRangeAllowsExactVersion(range: unknown, version: string): boolean {
  if (typeof range !== 'string') return false;
  const actual = version.split('.').map(Number);
  return range.split(/\s*\|\|\s*/).some((branch) => {
    const match = /^(\^)?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(branch);
    if (!match) return false;
    const minimum = match.slice(2).map(Number);
    const comparison = actual[0] - minimum[0] || actual[1] - minimum[1] || actual[2] - minimum[2];
    if (!match[1]) return comparison === 0;
    if (minimum[0] > 0) return actual[0] === minimum[0] && comparison >= 0;
    if (minimum[1] > 0) return actual[0] === 0 && actual[1] === minimum[1] && comparison >= 0;
    return actual[0] === 0 && actual[1] === 0 && actual[2] === minimum[2];
  });
}

function exactVersion(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(
      value,
    )
  );
}

function relocateMetadataImports(text: string): string {
  const source = parseSource(text, 'runtime.js', typescript.ScriptKind.JS);
  const imports = source.statements.filter(
    (node: any) =>
      typescript.isImportDeclaration(node) &&
      [
        '../../../shared/knowledge-metadata.js',
        '../../../shared/product-normalization.js',
      ].includes(node.moduleSpecifier?.text),
  );
  for (const node of imports.reverse()) {
    text =
      text.slice(0, node.moduleSpecifier.getStart(source)) +
      JSON.stringify('./' + node.moduleSpecifier.text.split('/').at(-1)) +
      text.slice(node.moduleSpecifier.end);
  }
  return text;
}

export async function prepareKnowledgeFunctions({ root, outputRoot }: Options): Promise<void> {
  root = path.resolve(root);
  await ordinary(root);
  if (!(await lstat(root)).isDirectory()) throw new Error('Root must be an ordinary directory');
  await safeOutput(root, outputRoot);

  const files = [
    ...modules.map((name) => `functions/lib/functions/src/knowledge/${name}.js`),
    ...aiModules.map((name) => `functions/lib/functions/src/ai/${name}.js`),
    ...sdkFiles.map((name) => `functions/src/generated/${name}`),
    'functions/src/index.ts',
    'functions/package.json',
    'functions/lib/shared/knowledge-metadata.js',
    'functions/lib/shared/product-normalization.js',
    'functions/lib/functions/src/cloud-config.js',
    'functions/lib/functions/config/cloud.json',
  ];
  const bytes = await Promise.all(files.map((name) => input(root, name)));
  if (bytes.some((data) => data.length === 0))
    throw new Error('Required knowledge runtime input is empty');
  const byName = new Map(files.map((name, index) => [name, bytes[index]]));
  const indexText = byName.get('functions/src/index.ts')!.toString('utf8');
  const index = parseSource(indexText, 'functions/src/index.ts', typescript.ScriptKind.TS);
  if (!hasRuntimeAccount(index)) {
    throw new Error('Expected runtime service account is missing from Functions entrypoint');
  }
  for (const [name, factory, module] of endpoints) {
    if (!hasEndpointDeclaration(index, name, factory))
      throw new Error(`Expected knowledge callable export is missing: ${name}`);
    const compiledPath = `functions/lib/functions/src/knowledge/${module}.js`;
    const compiled = parseSource(
      byName.get(compiledPath)!.toString('utf8'),
      compiledPath,
      typescript.ScriptKind.JS,
    );
    if (!hasExportedFunction(compiled, factory))
      throw new Error(`Expected compiled factory export is missing: ${factory}`);
  }

  const packageJson = JSON.parse(byName.get('functions/package.json')!.toString('utf8')) as {
    dependencies?: Record<string, unknown>;
  };
  const sourceDependencies = packageJson.dependencies;
  if (
    !sourceDependencies ||
    runtimeDependencies.some((name) => !exactVersion(sourceDependencies[name]))
  ) {
    throw new Error('Expected exact knowledge runtime dependency versions are missing');
  }
  const dependencies = Object.fromEntries(
    runtimeDependencies.map((name) => [name, sourceDependencies[name] as string]),
  );

  const sdk = JSON.parse(byName.get('functions/src/generated/package.json')!.toString('utf8')) as {
    name?: string;
    main?: string;
    module?: string;
    browser?: string;
    typings?: string;
    types?: string;
    exports?: Record<string, unknown>;
    peerDependencies?: Record<string, unknown>;
  };
  const sdkTargets = [
    sdk.main,
    sdk.module,
    sdk.browser,
    sdk.typings,
    sdk.types,
    ...packageEntryTargets(sdk.exports),
  ].filter((target): target is string => typeof target === 'string');
  if (
    sdk.name !== '@barberhq/server' ||
    !sdk.exports?.['.'] ||
    sdkTargets.some(
      (target) => !byName.has(`functions/src/generated/${target.replace(/^\.\//, '')}`),
    ) ||
    !peerRangeAllowsExactVersion(
      sdk.peerDependencies?.['firebase-admin'],
      dependencies['firebase-admin'],
    )
  ) {
    throw new Error(
      'Generated server SDK metadata, dependency compatibility, or entrypoint targets are invalid',
    );
  }

  const functionsDir = path.join(outputRoot, 'functions');
  const entry = [
    "import { initializeApp } from 'firebase-admin/app';",
    "import { setGlobalOptions } from 'firebase-functions';",
    "import { createDocumentUploadFunction, reviewAndPublishDocumentFunction, retryDocumentProcessingFunction, deleteKnowledgeVersionFunction } from './knowledge/callables.js';",
    "import { uploadKnowledgePdfFunction } from './knowledge/upload.js';",
    "import { processKnowledgeTaskFunction } from './knowledge/worker.js';",
    "import {saveKnowledgeProductReviewFunction,suggestKnowledgeProductLinkFunction,generateKnowledgeProductAliasesFunction,acceptKnowledgeProductReviewFunction} from './knowledge/product-knowledge-callables.js';",
    '',
    'initializeApp();',
    `setGlobalOptions({ serviceAccount: '${account}' });`,
    '',
    ...endpoints.map(([name, factory]) => `export const ${name} = ${factory}();`),
    '',
  ].join('\n');
  const manifest = {
    private: true,
    type: 'module',
    main: 'index.js',
    engines: { node: '22' },
    dependencies: { ...dependencies, '@barberhq/server': 'file:server-sdk' },
  };
  const firebaseConfig = {
    functions: [
      {
        source: 'functions',
        codebase: 'knowledge',
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
  await mkdir(path.join(functionsDir, 'knowledge'), { recursive: true });
  await mkdir(path.join(functionsDir, 'ai'), { recursive: true });
  await mkdir(path.join(functionsDir, 'config'), { recursive: true });
  await mkdir(path.join(functionsDir, 'server-sdk/esm'), { recursive: true });
  await Promise.all([
    writeFile(
      path.join(functionsDir, 'knowledge/product-normalization.js'),
      byName.get('functions/lib/shared/product-normalization.js')!,
    ),
    ...aiModules.map((name) =>
      writeFile(
        path.join(functionsDir, `ai/${name}.js`),
        byName.get(`functions/lib/functions/src/ai/${name}.js`)!,
      ),
    ),
    writeFile(
      path.join(functionsDir, 'knowledge/knowledge-metadata.js'),
      byName.get('functions/lib/shared/knowledge-metadata.js')!,
    ),
    ...modules.map((name) =>
      writeFile(
        path.join(functionsDir, `knowledge/${name}.js`),
        relocateMetadataImports(
          byName.get(`functions/lib/functions/src/knowledge/${name}.js`)!.toString('utf8'),
        ),
      ),
    ),
    ...sdkFiles.map((name) =>
      writeFile(
        path.join(functionsDir, `server-sdk/${name}`),
        byName.get(`functions/src/generated/${name}`)!,
      ),
    ),
    // Flattened layout: the public cloud config sits next to the package root.
    writeFile(
      path.join(functionsDir, 'cloud-config.js'),
      byName
        .get('functions/lib/functions/src/cloud-config.js')!
        .toString('utf8')
        .replace("'../config/cloud.json'", "'./config/cloud.json'"),
    ),
    writeFile(
      path.join(functionsDir, 'config/cloud.json'),
      byName.get('functions/lib/functions/config/cloud.json')!,
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
  await prepareKnowledgeFunctions({ root, outputRoot: path.join(root, artifactPath) });
}
