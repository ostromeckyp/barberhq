import { afterEach, expect, it } from 'vitest';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepareStockFunctions } from '../../scripts/config/prepare-stock-functions.ts';

const roots: string[] = [];
const compiled = ['commands', 'repository', 'errors', 'schemas', 'intent', 'runtime'];
const sdk = ['index.cjs.js', 'esm/index.esm.js', 'esm/package.json'];
const account = 'baberhq-runtime@notbad-6be95.iam.gserviceaccount.com';

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'stock-functions-'));
  roots.push(root);
  mkdirSync(join(root, 'functions/lib/functions/src/stock'), { recursive: true });
  mkdirSync(join(root, 'functions/src/generated/esm'), { recursive: true });
  mkdirSync(join(root, 'functions/src'), { recursive: true });
  for (const name of compiled)
    writeFileSync(
      join(root, `functions/lib/functions/src/stock/${name}.js`),
      `// compiled ${name}\n`,
    );
  for (const name of sdk)
    writeFileSync(join(root, `functions/src/generated/${name}`), `// generated ${name}\n`);
  writeFileSync(
    join(root, 'functions/src/generated/package.json'),
    JSON.stringify({
      name: '@barberhq/server',
      main: 'index.cjs.js',
      exports: { '.': { require: './index.cjs.js', default: './esm/index.esm.js' } },
    }),
  );
  writeFileSync(
    join(root, 'functions/src/index.ts'),
    `setGlobalOptions({ serviceAccount: '${account}' });\nexport const submitRequest = stockCommand('SUBMIT');`,
  );
  writeFileSync(
    join(root, 'functions/package.json'),
    JSON.stringify({
      dependencies: {
        'firebase-admin': '14.5.0',
        'firebase-functions': '7.4.0',
        zod: '4.6.5',
        genkit: '1.42.0',
      },
    }),
  );
  return { root, outputRoot: join(root, 'artifacts/stock-functions') };
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

it('packages five stock callables with the dedicated account and exact runtime bytes', async () => {
  const { root, outputRoot } = fixture();
  await prepareStockFunctions({ root, outputRoot });
  const f = join(outputRoot, 'functions');
  expect(readdirSync(f).sort()).toEqual(['index.js', 'package.json', 'server-sdk', 'stock']);
  expect(readdirSync(join(f, 'stock')).sort()).toEqual(compiled.map((n) => `${n}.js`).sort());
  for (const name of compiled)
    expect(readFileSync(join(f, `stock/${name}.js`))).toEqual(
      readFileSync(join(root, `functions/lib/functions/src/stock/${name}.js`)),
    );
  for (const name of sdk)
    expect(readFileSync(join(f, `server-sdk/${name}`))).toEqual(
      readFileSync(join(root, `functions/src/generated/${name}`)),
    );
  const entry = readFileSync(join(f, 'index.js'), 'utf8');
  expect(entry).toContain(`serviceAccount: '${account}'`);
  expect([...entry.matchAll(/export const (\w+) = stockCommand\(/g)].map((m) => m[1])).toEqual([
    'submitRequest',
    'approveRequest',
    'rejectRequest',
    'dispatchTransfer',
    'receiveTransfer',
  ]);
  const pkg = JSON.parse(readFileSync(join(f, 'package.json'), 'utf8'));
  expect(pkg.dependencies).toEqual({
    'firebase-admin': '14.5.0',
    'firebase-functions': '7.4.0',
    zod: '4.6.5',
    '@barberhq/server': 'file:server-sdk',
  });
  expect(pkg.scripts).toBeUndefined();
  expect(
    JSON.parse(readFileSync(join(outputRoot, 'firebase.json'), 'utf8')).functions[0].codebase,
  ).toBe('stock');
});

it('leaves a valid previous package unchanged when account or input is invalid', async () => {
  const { root, outputRoot } = fixture();
  await prepareStockFunctions({ root, outputRoot });
  const before = readFileSync(join(outputRoot, 'functions/index.js'));
  writeFileSync(
    join(root, 'functions/src/index.ts'),
    `// ${account}\nsetGlobalOptions({ serviceAccount: 'wrong@example.com' });`,
  );
  await expect(prepareStockFunctions({ root, outputRoot })).rejects.toThrow(/account/i);
  expect(readFileSync(join(outputRoot, 'functions/index.js'))).toEqual(before);
  writeFileSync(
    join(root, 'functions/src/index.ts'),
    `setGlobalOptions({ serviceAccount: '${account}' });`,
  );
  rmSync(join(root, 'functions/lib/functions/src/stock/runtime.js'));
  await expect(prepareStockFunctions({ root, outputRoot })).rejects.toThrow();
  expect(readFileSync(join(outputRoot, 'functions/index.js'))).toEqual(before);
});

it('rejects unknown output and symlink input before changing owned files', async () => {
  const { root, outputRoot } = fixture();
  await prepareStockFunctions({ root, outputRoot });
  const before = readFileSync(join(outputRoot, 'functions/index.js'));
  writeFileSync(join(outputRoot, 'functions/other.js'), 'unexpected');
  await expect(prepareStockFunctions({ root, outputRoot })).rejects.toThrow(/Unexpected file/);
  rmSync(join(outputRoot, 'functions/other.js'));
  rmSync(join(root, 'functions/src/generated/esm/index.esm.js'));
  symlinkSync(
    join(root, 'functions/src/generated/index.cjs.js'),
    join(root, 'functions/src/generated/esm/index.esm.js'),
  );
  await expect(prepareStockFunctions({ root, outputRoot })).rejects.toThrow(/Symlink/);
  expect(readFileSync(join(outputRoot, 'functions/index.js'))).toEqual(before);
});

it('preserves generated install artifacts on rerun', async () => {
  const { root, outputRoot } = fixture();
  await prepareStockFunctions({ root, outputRoot });
  const f = join(outputRoot, 'functions');
  writeFileSync(join(f, 'package-lock.json'), 'lock');
  mkdirSync(join(f, 'node_modules'));
  writeFileSync(join(f, '.env.notbad-6be95'), 'placeholder');
  writeFileSync(join(outputRoot, 'firebase-debug.log'), 'log');
  writeFileSync(join(f, 'functions-debug.log'), 'functions log');
  await expect(prepareStockFunctions({ root, outputRoot })).resolves.toBeUndefined();
  expect(readdirSync(f)).toContain('.env.notbad-6be95');
  expect(readFileSync(join(f, 'functions-debug.log'), 'utf8')).toBe('functions log');
  expect(readFileSync(join(f, 'package-lock.json'), 'utf8')).toBe('lock');
});
