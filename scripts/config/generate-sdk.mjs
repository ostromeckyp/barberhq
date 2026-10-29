import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { postprocessSdkEnums } from './sdk-enums.mjs';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const firebaseCli = fileURLToPath(
  new URL('../../node_modules/firebase-tools/lib/bin/firebase.js', import.meta.url),
);
export function sdkGenerationCommand(args) {
  if (args.length !== 2 || args[0] !== '--project' || !/^[a-z][a-z0-9-]{3,62}$/.test(args[1]))
    throw new Error(
      'An explicit --project <project-id> is required; no default project is selected.',
    );
  return [firebaseCli, 'dataconnect:sdk:generate', '--project', args[1]];
}
async function main() {
  const result = spawnSync(process.execPath, sdkGenerationCommand(process.argv.slice(2)), {
    cwd: repoRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME ?? join(tmpdir(), 'barberhq-firebase-cli'),
    },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);

  await postprocessSdkEnums(new URL('../../dataconnect/schema/', import.meta.url), [
    new URL('../../web/src/app/core/generated/index.d.ts', import.meta.url),
    new URL('../../scripts/generated/browser/index.d.ts', import.meta.url),
  ]);
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) await main();
