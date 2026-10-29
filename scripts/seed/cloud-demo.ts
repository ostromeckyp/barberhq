import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { applicationDefault, deleteApp, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getDataConnect } from 'firebase-admin/data-connect';
import { connectorConfig } from '@barberhq/server';
import { parsePublicConfig } from '../config/public-config.ts';
import { validateSeed } from '../prepare-data/catalog.ts';
import { seedRecords, validateMemberships } from './business.ts';

const approvedProject = 'notbad-6be95';
const approvedBusiness = 'not-bad-stuff-demo';
const approvedService = 'notbad-6be95-service';
const approvedLocation = 'europe-west3';

export function parseCloudSeedArgs(argv: string[]) {
  const args = new Map<string, string | true>();
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (
      !key ||
      !['--config', '--memberships', '--dry-run', '--apply'].includes(key) ||
      args.has(key)
    )
      throw new Error('SEED_OPTIONS_INVALID');
    if (key === '--dry-run' || key === '--apply') args.set(key, true);
    else {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw new Error('SEED_OPTIONS_INVALID');
      args.set(key, value);
    }
  }
  if (
    typeof args.get('--config') !== 'string' ||
    typeof args.get('--memberships') !== 'string' ||
    Boolean(args.get('--dry-run')) === Boolean(args.get('--apply'))
  )
    throw new Error('SEED_OPTIONS_INVALID');
  return {
    configPath: args.get('--config') as string,
    membershipsPath: args.get('--memberships') as string,
    dryRun: Boolean(args.get('--dry-run')),
  };
}

export function validateCloudSeedTarget(
  publicRaw: unknown,
  cloudRaw: unknown,
  businessKey: string,
  env: NodeJS.ProcessEnv,
) {
  if (Object.keys(env).some((key) => key.endsWith('_EMULATOR_HOST') && Boolean(env[key])))
    throw new Error('SEED_EMULATOR_FORBIDDEN');
  let config: ReturnType<typeof parsePublicConfig>;
  try {
    config = parsePublicConfig(publicRaw);
  } catch {
    throw new Error('SEED_TARGET_INVALID');
  }
  const cloud = cloudRaw as {
    projectId?: unknown;
    dataConnect?: { serviceId?: unknown; location?: unknown };
  } | null;
  if (
    config.projectId !== approvedProject ||
    businessKey !== approvedBusiness ||
    cloud?.projectId !== approvedProject ||
    config.dataConnect.serviceId !== approvedService ||
    config.dataConnect.location !== approvedLocation ||
    config.dataConnect.serviceId !== cloud.dataConnect?.serviceId ||
    config.dataConnect.location !== cloud.dataConnect?.location ||
    config.dataConnect.browserConnectorId !== 'browser' ||
    connectorConfig.connector !== 'server'
  )
    throw new Error('SEED_TARGET_INVALID');
  return config;
}

export function safeSeedError(error: unknown): string {
  if (error instanceof Error && /^SEED_[A-Z_]+$/.test(error.message)) return error.message;
  return 'SEED_OPERATION_FAILED';
}

async function runCloudDemoSeed(argv: string[]) {
  const args = parseCloudSeedArgs(argv);
  const seed = validateSeed(JSON.parse(readFileSync('data/seed/business.json', 'utf8')));
  const config = validateCloudSeedTarget(
    JSON.parse(readFileSync(args.configPath, 'utf8')),
    JSON.parse(readFileSync('config/knowledge-cloud.json', 'utf8')),
    seed.businessKey,
    process.env,
  );
  const members = validateMemberships(JSON.parse(readFileSync(args.membershipsPath, 'utf8')));
  const app = initializeApp(
    { projectId: config.projectId, credential: applicationDefault() },
    `cloud-demo-seed-${process.pid}`,
  );
  try {
    const auth = getAuth(app);
    for (const member of members) {
      let enabled = false;
      try {
        enabled = !(await auth.getUser(member.uid)).disabled;
      } catch {
        throw new Error('SEED_AUTH_ACCOUNT_INVALID');
      }
      if (!enabled) throw new Error('SEED_AUTH_ACCOUNT_INVALID');
    }
    const dc = getDataConnect(
      {
        ...connectorConfig,
        connector: 'server',
        serviceId: config.dataConnect.serviceId,
        location: config.dataConnect.location,
      },
      app,
    );
    const report = await seedRecords(dc, seed, seed.businessKey, members, args.dryRun);
    console.log(
      JSON.stringify({
        projectId: config.projectId,
        serviceId: config.dataConnect.serviceId,
        businessKey: seed.businessKey,
        mode: args.dryRun ? 'dry-run' : 'apply',
        memberCount: members.length,
        ...report,
      }),
    );
  } finally {
    await deleteApp(app);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runCloudDemoSeed(process.argv.slice(2)).catch((error: unknown) => {
    console.error(safeSeedError(error));
    process.exitCode = 1;
  });
}
