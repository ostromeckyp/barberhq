import { it, expect, afterEach } from 'vitest';
import { mkdtemp, mkdir, readFile, writeFile, cp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { prepareDeliveryFunctions } from '../../scripts/config/prepare-delivery-functions.ts';
const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'delivery-package-'));
  roots.push(root);
  for (const file of ['functions/src/index.ts', 'functions/package.json']) {
    await mkdir(join(root, file, '..'), { recursive: true });
    await cp(resolve(file), join(root, file));
  }
  for (const dir of ['stock', 'delivery']) {
    await mkdir(join(root, `functions/lib/functions/src/${dir}`), { recursive: true });
    for (const file of await readdir(`functions/src/${dir}`)) {
      if (file.endsWith('.ts'))
        await writeFile(
          join(root, `functions/lib/functions/src/${dir}/${file.replace(/\.ts$/, '.js')}`),
          `// compiled ${dir}/${file}\n`,
        );
    }
  }
  await cp(resolve('functions/src/generated'), join(root, 'functions/src/generated'), {
    recursive: true,
  });
  return { root, outputRoot: join(root, 'artifacts/delivery-functions') };
}
it('packages only eleven named delivery and stock functions with preserved runtime and file hashes', async () => {
  const f = await fixture();
  await prepareDeliveryFunctions(f);
  const manifest = JSON.parse(await readFile(join(f.outputRoot, 'release-manifest.json'), 'utf8'));
  expect(manifest.functions).toHaveLength(11);
  expect(manifest.functions).toContain('getDeliveryProcedures');
  expect(manifest.functions).not.toContain('answerProcedureQuestion');
  expect(manifest.serviceAccount).toBe('baberhq-runtime@notbad-6be95.iam.gserviceaccount.com');
  expect(manifest.codeHash).toMatch(/^[a-f0-9]{64}$/);
  expect(
    Object.keys(manifest.files).every(
      (path) => !path.includes('knowledge/') && !path.includes('ai/'),
    ),
  ).toBe(true);
  expect(await readFile(join(f.outputRoot, 'functions/delivery/repository.js'), 'utf8')).toBe(
    '// compiled delivery/repository.ts\n',
  );
});
it('refuses an unexpected output file and preserves the prior package', async () => {
  const f = await fixture();
  await prepareDeliveryFunctions(f);
  const before = await readFile(join(f.outputRoot, 'functions/index.js'));
  await writeFile(join(f.outputRoot, 'functions/unexpected.txt'), 'do not publish');
  await expect(prepareDeliveryFunctions(f)).rejects.toThrow(/Unexpected/);
  expect(await readFile(join(f.outputRoot, 'functions/index.js'))).toEqual(before);
});
it('refuses changed dependency versions before modifying a prepared package', async () => {
  const f = await fixture();
  await prepareDeliveryFunctions(f);
  const before = await readFile(join(f.outputRoot, 'release-manifest.json'));
  const pkg = JSON.parse(await readFile(join(f.root, 'functions/package.json'), 'utf8'));
  pkg.dependencies.zod = 'latest';
  await writeFile(join(f.root, 'functions/package.json'), JSON.stringify(pkg));
  await expect(prepareDeliveryFunctions(f)).rejects.toThrow(/versions/);
  expect(await readFile(join(f.outputRoot, 'release-manifest.json'))).toEqual(before);
});
