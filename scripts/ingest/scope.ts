import type { ManifestEntry } from '../../functions/src/knowledge/pipeline.js';

export function validateCloudIngestEnvironment(env: NodeJS.ProcessEnv = process.env): void {
  if (
    env.DATA_CONNECT_EMULATOR_HOST ||
    env.FIREBASE_STORAGE_EMULATOR_HOST ||
    env.STORAGE_EMULATOR_HOST
  ) {
    throw new Error('Cloud ingest refuses emulator environment');
  }
}

export function validatePublicationScope(businessId: string, entry: ManifestEntry): void {
  if (businessId !== entry.businessKey)
    throw new Error('Business ID does not match manifest business key');
}
