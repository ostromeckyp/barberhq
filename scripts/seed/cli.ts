import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { parsePublicConfig } from '../config/public-config.ts';
import { validateSeed } from '../prepare-data/catalog.ts';
import { seedBusiness } from './business.ts';
import { connectorConfig } from '@barberhq/server';
const { values } = parseArgs({
  options: {
    config: { type: 'string' },
    memberships: { type: 'string' },
    apply: { type: 'boolean' },
    'dry-run': { type: 'boolean' },
  },
});
if (!values.config || !values.memberships || Boolean(values.apply) === Boolean(values['dry-run']))
  throw new Error(
    'Pass --config FILE --memberships PRIVATE_FILE and exactly one of --dry-run / --apply',
  );
const config = parsePublicConfig(JSON.parse(readFileSync(values.config, 'utf8')));
if (
  config.dataConnect.serviceId !== connectorConfig.serviceId ||
  config.dataConnect.location !== connectorConfig.location
)
  throw new Error('Regenerate SDKs for the selected service/location before import');
const seed = validateSeed(JSON.parse(readFileSync('data/seed/business.json', 'utf8')));
console.log({
  projectId: config.projectId,
  businessKey: seed.businessKey,
  dryRun: !values.apply,
});
console.log(
  await seedBusiness({
    projectId: config.projectId,
    businessKey: seed.businessKey,
    dryRun: !values.apply,
    seed,
    memberships: JSON.parse(readFileSync(values.memberships, 'utf8')),
  }),
);
