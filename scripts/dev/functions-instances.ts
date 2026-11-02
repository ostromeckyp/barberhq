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

function describeCommand(svc: string, project: string, region: string): string[] {
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

function run(argv: string[]): number {
  console.log(argv.join(' '));
  const result = spawnSync(argv[0], argv.slice(1), { stdio: 'inherit' });
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
  for (const svc of SERVICES) run(describeCommand(svc, project, region));
}
