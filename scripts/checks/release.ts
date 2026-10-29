import { z } from 'zod';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { inspectArtifact } from './hosting.ts';
export function verifyRelease(record: unknown, hash: string, project: string, site: string): void {
  const value = z
    .object({
      mode: z.literal('production'),
      projectId: z.string(),
      siteId: z.string(),
      buildHash: z.string(),
    })
    .parse(record);
  if (
    value.projectId !== project ||
    value.siteId !== site ||
    value.buildHash !== hash ||
    project.startsWith('demo-')
  )
    throw new Error(
      'Release target/artifact mismatch. Run the explicit production build before deploying.',
    );
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const config = JSON.parse(readFileSync('firebase.json', 'utf8'));
  const record = JSON.parse(readFileSync('artifacts/build-record.json', 'utf8'));
  verifyRelease(
    record,
    inspectArtifact(config.hosting.public).buildHash,
    process.env.GCLOUD_PROJECT ?? '',
    config.hosting.site,
  );
  console.log('Production artifact and explicit Firebase project match.');
}
