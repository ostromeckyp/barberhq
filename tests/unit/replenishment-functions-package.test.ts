import { afterEach, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
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
import {
  prepareReplenishmentFunctions,
  replenishmentModules,
} from '../../scripts/config/prepare-replenishment-functions.ts';

const roots: string[] = [];
const account = 'baberhq-runtime@notbad-6be95.iam.gserviceaccount.com';
const sdk = ['index.cjs.js', 'esm/index.esm.js', 'esm/package.json'];
const deps = {
  '@barberhq/server': 'file:src/generated',
  '@genkit-ai/google-genai': '1.42.0',
  'firebase-admin': '14.5.0',
  'firebase-functions': '7.4.0',
  genkit: '1.42.0',
  'pdfjs-dist': '6.4.299',
};
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'replenishment-functions-'));
  roots.push(root);
  for (const name of replenishmentModules) {
    mkdirSync(join(root, 'functions/lib', name, '..'), { recursive: true });
    writeFileSync(join(root, 'functions/lib', name), `// compiled ${name}\n`);
  }
  mkdirSync(join(root, 'functions/src/generated/esm'), { recursive: true });
  for (const name of sdk) writeFileSync(join(root, `functions/src/generated/${name}`), '//\n');
  writeFileSync(
    join(root, 'functions/src/generated/package.json'),
    JSON.stringify({ name: '@barberhq/server', main: 'index.cjs.js', exports: { '.': {} } }),
  );
  writeFileSync(
    join(root, 'functions/src/index.ts'),
    `setGlobalOptions({ serviceAccount: '${account}' });`,
  );
  writeFileSync(join(root, 'functions/package.json'), JSON.stringify({ dependencies: deps }));
  return { root, outputRoot: join(root, 'artifacts/replenishment-functions') };
}
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

it('packages only the named compiled modules, generated SDK and exact dependencies', async () => {
  const f = fixture();
  await prepareReplenishmentFunctions(f);
  const fn = join(f.outputRoot, 'functions');
  expect(readdirSync(fn).sort()).toEqual(['index.js', 'lib', 'package.json', 'server-sdk']);
  expect(readFileSync(join(fn, 'index.js'), 'utf8')).toContain(
    'export const removeSalonShorthand = createRemoveSalonShorthandFunction();',
  );
  expect(JSON.parse(readFileSync(join(fn, 'package.json'), 'utf8')).dependencies).toEqual({
    '@barberhq/server': 'file:server-sdk',
    '@genkit-ai/google-genai': '1.42.0',
    'firebase-admin': '14.5.0',
    'firebase-functions': '7.4.0',
    genkit: '1.42.0',
  });
  for (const name of replenishmentModules)
    expect(readFileSync(join(fn, 'lib', name), 'utf8')).toBe(`// compiled ${name}\n`);
  expect(existsSync(join(fn, 'lib/functions/src/ai/procedure.js'))).toBe(false);
});

it('refuses symlinks, a wrong runtime account and drifted dependency versions', async () => {
  const a = fixture();
  rmSync(join(a.root, 'functions/lib', replenishmentModules[0]));
  symlinkSync('/etc/hosts', join(a.root, 'functions/lib', replenishmentModules[0]));
  await expect(prepareReplenishmentFunctions(a)).rejects.toThrow(/Symlink/);
  const b = fixture();
  writeFileSync(
    join(b.root, 'functions/src/index.ts'),
    "setGlobalOptions({ serviceAccount: 'x' });",
  );
  await expect(prepareReplenishmentFunctions(b)).rejects.toThrow(/service account/);
  const c = fixture();
  writeFileSync(
    join(c.root, 'functions/package.json'),
    JSON.stringify({ dependencies: { ...deps, genkit: '^1.42.0' } }),
  );
  await expect(prepareReplenishmentFunctions(c)).rejects.toThrow(/versions/);
});

it('names exactly the transitive closure of the compiled entry modules', () => {
  const base = resolve('functions/lib');
  const seen = new Set<string>();
  const walk = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);
    for (const m of readFileSync(file, 'utf8').matchAll(/from\s*['"](\.[^'"]+)['"]/g))
      walk(resolve(file, '..', m[1]));
  };
  for (const entry of [
    'functions/src/ai/replenishment.js',
    'functions/src/ai/salon-alias-callables.js',
  ])
    walk(join(base, entry));
  expect([...seen].map((f) => f.slice(base.length + 1)).sort()).toEqual(
    [...replenishmentModules].sort(),
  );
});

it('loads the actual compiled package with exactly two callables', async () => {
  const root = resolve('.');
  const outputRoot = join(root, 'artifacts/replenishment-functions');
  rmSync(outputRoot, { recursive: true, force: true });
  await prepareReplenishmentFunctions({ root, outputRoot });
  const copy = mkdtempSync(join(tmpdir(), 'replenishment-load-'));
  roots.push(copy);
  cpSync(join(outputRoot, 'functions'), copy, { recursive: true });
  symlinkSync(join(root, 'functions/node_modules'), join(copy, 'node_modules'));
  const probe = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `const m = await import(${JSON.stringify(join(copy, 'index.js'))}); console.log(JSON.stringify(Object.keys(m).sort()));`,
    ],
    { encoding: 'utf8', env: { ...process.env, GCLOUD_PROJECT: 'demo-barberhq' } },
  );
  expect(probe.stderr).toBe('');
  expect(JSON.parse(probe.stdout.trim().split('\n').at(-1)!)).toEqual([
    'prepareReplenishment',
    'removeSalonShorthand',
  ]);
});
