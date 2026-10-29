import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { applicationDefault, deleteApp, initializeApp } from 'firebase-admin/app';
import { getDataConnect, type DataConnect } from 'firebase-admin/data-connect';
import * as sql from '@barberhq/server';
import {
  metadataFromStorage,
  storageKind,
  storageOrigin,
} from '../../shared/knowledge-metadata.js';

export type MetadataRow = {
  id: string;
  businessId: string;
  sourceType?: string | null;
  synthetic: boolean;
  kind?: string | null;
  origin?: string | null;
  [key: string]: unknown;
};
export type MetadataRepository = {
  page(after: string, limit: number): Promise<MetadataRow[]>;
  compareAndSet(row: MetadataRow, target: { kind: string; origin: string }): Promise<boolean>;
};
export type MetadataMigrationReport = {
  scanned: number;
  changed: number;
  planned: number;
  alreadyCorrect: number;
  conflicts: number;
  preserved: boolean;
  rows: {
    id: string;
    before: string;
    after?: string;
    kind?: string;
    origin?: string;
    conflict?: string;
  }[];
};
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, canonical(v)]),
    );
  return value;
}
function preservationHash({ kind: _kind, origin: _origin, ...rest }: MetadataRow): string {
  return createHash('sha256')
    .update(JSON.stringify(canonical(rest)))
    .digest('hex');
}
function repository(dc: DataConnect, businessId: string): MetadataRepository {
  return {
    page: async (after, limit) =>
      (await sql.knowledgeMetadataPage(dc, { businessId, after, limit })).data
        .rows as MetadataRow[],
    compareAndSet: async (row, target) => {
      try {
        await sql.backfillKnowledgeMetadata(dc, {
          businessId,
          versionId: row.id,
          expectedSourceType: row.sourceType as sql.KnowledgeSourceType | null,
          expectedSynthetic: row.synthetic,
          kind: target.kind as sql.KnowledgeDocumentKind,
          origin: target.origin as sql.KnowledgeOrigin,
        });
        return true;
      } catch (error) {
        if (String(error).includes('STALE_STATE')) return false;
        throw error;
      }
    },
  };
}
export async function backfillKnowledgeMetadata(
  dc: DataConnect | MetadataRepository,
  options: { businessId: string; apply: boolean },
): Promise<MetadataMigrationReport> {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/.test(options.businessId))
    throw Error('Invalid business');
  const repo = 'page' in dc ? dc : repository(dc, options.businessId);
  const scan = async () => {
    const all: MetadataRow[] = [];
    let after = '';
    for (;;) {
      const rows = await repo.page(after, 100);
      if (rows.length > 100) throw Error('Metadata page exceeds limit');
      for (const row of rows) {
        if (row.id <= after) throw Error('Invalid metadata cursor order');
        after = row.id;
        all.push(row);
      }
      if (rows.length < 100) return all;
    }
  };
  const rows = await scan();
  const report: MetadataMigrationReport = {
    scanned: rows.length,
    changed: 0,
    planned: 0,
    alreadyCorrect: 0,
    conflicts: 0,
    preserved: true,
    rows: [],
  };
  for (const row of rows) {
    const proof: MetadataMigrationReport['rows'][number] = {
      id: row.id,
      before: preservationHash(row),
    };
    report.rows.push(proof);
    try {
      if (row.businessId !== options.businessId) throw Error('Business scope mismatch');
      const metadata = metadataFromStorage(row);
      Object.assign(proof, {
        kind: storageKind(metadata.kind),
        origin: storageOrigin(metadata.origin),
      });
      if (row.kind != null && row.origin != null) report.alreadyCorrect++;
      else report.planned++;
    } catch (error) {
      proof.conflict = error instanceof Error ? error.message : 'Invalid metadata';
      report.conflicts++;
    }
  }
  if (report.conflicts || !options.apply) return report;
  for (const [i, row] of rows.entries()) {
    if (row.kind != null && row.origin != null) continue;
    const proof = report.rows[i];
    if (!(await repo.compareAndSet(row, { kind: proof.kind!, origin: proof.origin! }))) {
      proof.conflict = 'Concurrent metadata change; inspect this row and rerun';
      report.conflicts++;
      break;
    }
    report.changed++;
  }
  const after = await scan();
  const byId = new Map(after.map((row) => [row.id, row]));
  if (after.length !== rows.length) {
    report.preserved = false;
    report.conflicts++;
  }
  for (const proof of report.rows) {
    const row = byId.get(proof.id);
    proof.after = row ? preservationHash(row) : undefined;
    if (proof.before !== proof.after) {
      report.preserved = false;
      proof.conflict = 'Preservation check failed';
      report.conflicts++;
    } else if (!report.conflicts && (row?.kind !== proof.kind || row?.origin !== proof.origin)) {
      proof.conflict = 'Classification verification failed';
      report.conflicts++;
    }
  }
  return report;
}
async function main(args: string[]): Promise<void> {
  const values = new Map<string, string>();
  let apply = false,
    quiescent = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--apply' && !apply) {
      apply = true;
      continue;
    }
    if (args[i] === '--quiescent' && !quiescent) {
      quiescent = true;
      continue;
    }
    if (
      !['--project', '--business-id', '--confirm-business', '--config'].includes(args[i]) ||
      values.has(args[i]) ||
      !args[i + 1] ||
      args[i + 1].startsWith('--')
    )
      throw Error('Invalid metadata migration arguments');
    values.set(args[i], args[++i]);
  }
  const project = values.get('--project'),
    businessId = values.get('--business-id'),
    configPath = values.get('--config');
  if (
    !project ||
    !businessId ||
    !configPath ||
    /(^|\/)\.env(?:\.|$)|\.local\.json$/.test(configPath)
  )
    throw Error('Explicit project, business and public config are required');
  if (apply && (!quiescent || values.get('--confirm-business') !== businessId))
    throw Error('Apply requires a quiescent window and exact business confirmation');
  if (Object.keys(process.env).some((k) => /EMULATOR/i.test(k)))
    throw Error('Cloud migration refuses emulator environment');
  const config = JSON.parse(await readFile(resolve(configPath), 'utf8'));
  if (
    config.projectId !== project ||
    !config.dataConnect?.serviceId ||
    !config.dataConnect?.location
  )
    throw Error('Project/config mismatch');
  const app = initializeApp(
    { projectId: project, credential: applicationDefault() },
    `metadata-${process.pid}`,
  );
  try {
    const dc = getDataConnect(
      {
        connector: 'server',
        serviceId: config.dataConnect.serviceId,
        location: config.dataConnect.location,
      },
      app,
    );
    if (!(await sql.knowledgeCursorBusiness(dc, { businessId })).data.business)
      throw Error('Business not found');
    const report = await backfillKnowledgeMetadata(dc, { businessId, apply });
    console.log(
      JSON.stringify({ mode: apply ? 'apply' : 'dry-run', project, businessId, ...report }),
    );
    if (report.conflicts || !report.preserved) process.exitCode = 1;
  } finally {
    await deleteApp(app);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  main(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : 'Metadata migration failed');
    process.exitCode = 1;
  });
