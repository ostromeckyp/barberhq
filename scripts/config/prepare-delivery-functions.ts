import { lstat, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { sourceRuntimeAccount } from './functions-runtime.ts';
export type DeliveryPackageOptions = { root: string; outputRoot: string };
const stock = ['commands', 'repository', 'errors', 'schemas', 'intent', 'runtime'];
const delivery = ['commands', 'repository', 'schemas', 'intent', 'receipt', 'procedures'];
const account = 'baberhq-runtime@notbad-6be95.iam.gserviceaccount.com';
const exports = [
  ['submitRequest', "stockCommand('SUBMIT')"],
  ['approveRequest', "stockCommand('APPROVE')"],
  ['rejectRequest', "stockCommand('REJECT')"],
  ['dispatchTransfer', "stockCommand('DISPATCH')"],
  ['receiveTransfer', "stockCommand('RECEIVE')"],
  ['recordDeliveryReceipt', "deliveryCommand('RECORD_RECEIPT')"],
  ['startDeliveryIssueReview', "deliveryCommand('START_REVIEW')"],
  ['addDeliveryIssueNote', "deliveryCommand('ADD_NOTE')"],
  ['createDeliveryReplacement', "deliveryCommand('CREATE_REPLACEMENT')"],
  ['setDeliveryProcedure', "deliveryCommand('SET_PROCEDURE')"],
  ['getDeliveryProcedures', 'deliveryProceduresFunction()'],
];
export const deliveryFunctionNames = exports.map(([name]) => name);
const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
export async function prepareDeliveryFunctions({
  root,
  outputRoot,
}: DeliveryPackageOptions): Promise<void> {
  root = path.resolve(root);
  outputRoot = path.resolve(outputRoot);
  if (outputRoot !== path.join(root, 'artifacts/delivery-functions'))
    throw new Error('Unexpected output path');
  async function ordinary(file: string, optional = false) {
    try {
      const s = await lstat(file);
      if (s.isSymbolicLink()) throw new Error('Symlink input/output forbidden');
      return s;
    } catch (error) {
      if (optional && (error as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw error;
    }
  }
  async function input(relative: string) {
    let current = root;
    for (const part of relative.split('/')) {
      current = path.join(current, part);
      await ordinary(current);
    }
    const bytes = await readFile(current);
    if (!bytes.length) throw new Error('Empty package input');
    return bytes;
  }
  for (const dir of ['artifacts', 'artifacts/delivery-functions'])
    await ordinary(path.join(root, dir), true);
  const files = new Map<string, Buffer>();
  for (const [dir, names] of [
    ['stock', stock],
    ['delivery', delivery],
  ] as const)
    for (const name of names)
      files.set(
        `functions/${dir}/${name}.js`,
        await input(`functions/lib/functions/src/${dir}/${name}.js`),
      );
  for (const name of ['index.cjs.js', 'esm/index.esm.js', 'esm/package.json'])
    files.set(`functions/server-sdk/${name}`, await input(`functions/src/generated/${name}`));
  const entrySource = await input('functions/src/index.ts'),
    packageSource = await input('functions/package.json'),
    sdkSource = await input('functions/src/generated/package.json');
  if (sourceRuntimeAccount(entrySource.toString()) !== account)
    throw new Error('Unexpected runtime account');
  const dependencies = JSON.parse(packageSource.toString()).dependencies;
  if (
    dependencies['firebase-admin'] !== '14.5.0' ||
    dependencies['firebase-functions'] !== '7.4.0' ||
    dependencies.zod !== '4.6.5'
  )
    throw new Error('Unexpected dependency versions');
  const sdk = JSON.parse(sdkSource.toString());
  if (sdk.name !== '@barberhq/server' || sdk.main !== 'index.cjs.js')
    throw new Error('Unexpected server SDK');
  const entry = [
    "import {initializeApp} from 'firebase-admin/app';",
    "import {setGlobalOptions} from 'firebase-functions';",
    "import {stockCommand} from './stock/commands.js';",
    "import {deliveryCommand,deliveryProceduresFunction} from './delivery/commands.js';",
    'initializeApp();',
    `setGlobalOptions({serviceAccount:'${account}'});`,
    ...exports.map(([name, expression]) => `export const ${name}=${expression};`),
    '',
  ].join('\n');
  files.set('functions/index.js', Buffer.from(entry));
  files.set(
    'functions/package.json',
    Buffer.from(
      JSON.stringify(
        {
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
        },
        null,
        2,
      ) + '\n',
    ),
  );
  files.set(
    'functions/server-sdk/package.json',
    Buffer.from(
      JSON.stringify(
        {
          name: '@barberhq/server',
          version: '0.0.1',
          main: 'index.cjs.js',
          module: 'esm/index.esm.js',
          exports: { '.': { require: './index.cjs.js', default: './esm/index.esm.js' } },
        },
        null,
        2,
      ) + '\n',
    ),
  );
  files.set(
    'firebase.json',
    Buffer.from(
      JSON.stringify(
        {
          functions: [
            {
              source: 'functions',
              codebase: 'stock',
              runtime: 'nodejs22',
              ignore: ['node_modules', '.git', '*-debug.log'],
            },
          ],
        },
        null,
        2,
      ) + '\n',
    ),
  );
  const hashes = Object.fromEntries(
    [...files].sort(([a], [b]) => a.localeCompare(b)).map(([file, bytes]) => [file, hash(bytes)]),
  );
  const manifest = {
    functions: deliveryFunctionNames,
    deployOnly: deliveryFunctionNames.map((name) => `functions:stock:${name}`).join(','),
    serviceAccount: account,
    region: 'europe-west1',
    maxInstances: 5,
    sql: { serviceId: 'notbad-6be95-service', location: 'europe-west3', connector: 'server' },
    runtime: 'nodejs22',
    dependencies: JSON.parse(files.get('functions/package.json')!.toString()).dependencies,
    files: hashes,
    codeHash: hash(JSON.stringify(hashes)),
    entrySourceHash: hash(entrySource),
    dependencySourceHash: hash(packageSource),
  };
  files.set('release-manifest.json', Buffer.from(JSON.stringify(manifest, null, 2) + '\n'));
  async function inspect(dir: string, relative = ''): Promise<void> {
    const stat = await ordinary(dir, true);
    if (!stat) return;
    if (!stat.isDirectory()) throw new Error('Unexpected output type');
    for (const name of await readdir(dir)) {
      const file = relative ? `${relative}/${name}` : name,
        full = path.join(dir, name),
        info = await ordinary(full);
      if (info!.isDirectory()) {
        if (![...files.keys()].some((expected) => expected.startsWith(file + '/')))
          throw new Error('Unexpected output directory');
        await inspect(full, file);
      } else if (!info!.isFile() || !files.has(file)) throw new Error('Unexpected output file');
    }
  }
  await inspect(outputRoot);
  for (const [relative, bytes] of files) {
    const output = path.join(outputRoot, relative);
    await mkdir(path.dirname(output), { recursive: true });
    await writeFile(output, bytes);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const root = process.cwd();
  prepareDeliveryFunctions({
    root,
    outputRoot: path.join(root, 'artifacts/delivery-functions'),
  }).catch((error) => {
    console.error(error instanceof Error ? error.message : 'Package preparation failed');
    process.exitCode = 1;
  });
}
