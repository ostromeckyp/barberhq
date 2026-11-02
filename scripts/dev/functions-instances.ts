import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const SERVICES = ['commands', 'ai', 'getsourcepdf'];

export function instancesCommands(n: number, project: string, region: string): string[][] {
  if (!Number.isInteger(n) || n < 0 || n > 3)
    throw new Error(`min instances must be an integer from 0 to 3, got ${n}`);
  return SERVICES.map((svc) => [
    'gcloud',
    'run',
    'services',
    'update',
    svc,
    '--min-instances',
    String(n),
    '--region',
    region,
    '--project',
    project,
    '--quiet',
  ]);
}

export function describeCommand(svc: string, project: string, region: string): string[] {
  return [
    'gcloud',
    'run',
    'services',
    'describe',
    svc,
    '--region',
    region,
    '--project',
    project,
    '--format=value(spec.template.metadata.annotations["autoscaling.knative.dev/minScale"])',
  ];
}

export function minScaleLine(svc: string, stdout: string): string {
  return `${svc}: ${stdout.trim() || '0'}`;
}

function run(argv: string[]): number {
  console.log(argv.join(' '));
  const result = spawnSync(argv[0], argv.slice(1), { stdio: 'inherit' });
  if (result.error) {
    console.error(
      `${argv[0]} not found or failed to start (${result.error.message}). Install the Google Cloud SDK and run gcloud auth login.`,
    );
    return 1;
  }
  return result.status ?? 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const project = 'notbad-6be95';
  const region = 'europe-west1';
  const n = Number(process.argv[2]);
  let commands: string[][];
  try {
    commands = instancesCommands(n, project, region);
  } catch (error) {
    console.error(String(error instanceof Error ? error.message : error));
    console.error('Usage: npm run functions:instances -- <0..3>');
    process.exit(2);
  }
  for (const argv of commands) {
    const status = run(argv);
    if (status !== 0) process.exit(status);
  }
  let describeFailed = false;
  for (const svc of SERVICES) {
    const argv = describeCommand(svc, project, region);
    const result = spawnSync(argv[0], argv.slice(1), { encoding: 'utf8' });
    if (result.error || result.status !== 0) {
      describeFailed = true;
      console.error(
        `${svc}: describe failed${result.error ? ` (${result.error.message})` : ''} ${result.stderr ?? ''}`.trim(),
      );
      continue;
    }
    console.log(minScaleLine(svc, result.stdout));
  }
  if (describeFailed) process.exit(1);
}
