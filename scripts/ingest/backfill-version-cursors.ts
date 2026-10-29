import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { applicationDefault, deleteApp, initializeApp } from 'firebase-admin/app';
import { getDataConnect, type DataConnect } from 'firebase-admin/data-connect';
import * as sql from '@barberhq/server';

const SQL_INT_MAX = 2_147_483_647;
export type CursorDocument = { id: string; businessId: string; nextVersionNumber: number | null };
export type CursorRepository = {
  listDocuments(after: string, limit: number): Promise<CursorDocument[]>;
  listLabels(documentId: string, after: string, limit: number): Promise<string[]>;
  getDocument(id: string): Promise<CursorDocument | null>;
  compareAndSet(id: string, expected: number | null, target: number): Promise<boolean>;
};
export type CursorChange = { documentId: string; from: number | null; to: number };

async function pageAll<T>(
  page: (after: string, limit: number) => Promise<T[]>,
  key: (item: T) => string,
  limit: number,
): Promise<T[]> {
  const all: T[] = [];
  let after = '';
  for (;;) {
    const items = await page(after, limit);
    if (items.length > limit) throw Error('Cursor page exceeds requested limit');
    for (const item of items) {
      const next = key(item);
      if (next <= after) throw Error('Cursor page order is invalid');
      after = next;
      all.push(item);
    }
    if (items.length < limit) return all;
  }
}
function nextVersionNumber(labels: string[]): number {
  let maximum = -1;
  for (const label of labels) {
    if (!/^v(?:0|[1-9][0-9]*)$/.test(label)) throw Error(`Malformed version label: ${label}`);
    const numeric = Number(label.slice(1));
    if (!Number.isSafeInteger(numeric) || numeric >= SQL_INT_MAX)
      throw Error(`Version label exceeds SQL cursor range: ${label}`);
    maximum = Math.max(maximum, numeric);
  }
  return Math.max(1, maximum + 1);
}
async function targetFor(repo: CursorRepository, id: string, limit: number): Promise<number> {
  return nextVersionNumber(
    await pageAll(
      (after, size) => repo.listLabels(id, after, size),
      (value) => value,
      limit,
    ),
  );
}

/** Complete-history scan and CAS update. A writer race can only advance the cursor. */
export async function backfillVersionCursors(
  repo: CursorRepository,
  businessId: string,
  apply = false,
  pageSize = 100,
): Promise<{ documents: number; changes: CursorChange[] }> {
  if (
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/.test(businessId) ||
    !Number.isInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > 100
  )
    throw Error('Invalid business or page size');
  const documents = await pageAll(
    (after, size) => repo.listDocuments(after, size),
    (value) => value.id,
    pageSize,
  );
  const changes: CursorChange[] = [];
  for (const document of documents) {
    if (document.businessId !== businessId) throw Error('Cursor scan crossed business scope');
    const target = await targetFor(repo, document.id, pageSize);
    const current = document.nextVersionNumber;
    if (
      current !== null &&
      (!Number.isSafeInteger(current) || current < 1 || current > SQL_INT_MAX)
    )
      throw Error('Invalid existing cursor');
    if (current !== null && current >= target) continue;
    changes.push({ documentId: document.id, from: current, to: target });
  }
  // Finish validation across every document before applying any mutation.
  if (!apply) return { documents: documents.length, changes };
  for (const change of changes) {
    const updated = await repo.compareAndSet(change.documentId, change.from, change.to);
    if (!updated) {
      const raced = await repo.getDocument(change.documentId);
      if (
        !raced ||
        raced.businessId !== businessId ||
        raced.nextVersionNumber === null ||
        raced.nextVersionNumber < change.to
      )
        throw Error('Cursor compare-and-set race; rerun after inspecting history');
    }
  }
  for (const document of documents) {
    const verifiedTarget = await targetFor(repo, document.id, pageSize);
    const verified = await repo.getDocument(document.id);
    if (
      !verified ||
      verified.businessId !== businessId ||
      verified.nextVersionNumber === null ||
      verified.nextVersionNumber < verifiedTarget
    )
      throw Error('Cursor verification failed');
  }
  return { documents: documents.length, changes };
}

export function dataConnectCursorRepository(dc: DataConnect, businessId: string): CursorRepository {
  return {
    listDocuments: async (after, limit) =>
      (
        await sql.knowledgeCursorDocuments(dc, { businessId, after, limit })
      ).data.knowledgeDocuments.map((row) => ({
        id: row.id,
        businessId: row.businessId,
        nextVersionNumber: row.nextVersionNumber ?? null,
      })),
    listLabels: async (documentId, after, limit) =>
      (
        await sql.knowledgeCursorLabels(dc, { documentId, after, limit })
      ).data.knowledgeVersions.map((row) => row.versionLabel),
    getDocument: async (id) => {
      const row = (await sql.knowledgeDocumentState(dc, { documentId: id })).data.knowledgeDocument;
      return row
        ? {
            id: row.id,
            businessId: row.businessId,
            nextVersionNumber: row.nextVersionNumber ?? null,
          }
        : null;
    },
    compareAndSet: async (id, expected, target) => {
      try {
        await sql.backfillKnowledgeCursor(dc, {
          businessId,
          documentId: id,
          expected,
          target,
          initialize: expected === null,
          advance: expected !== null,
        });
        return true;
      } catch (error) {
        if (String(error).includes('STALE_STATE')) return false;
        throw error;
      }
    },
  };
}

async function main(argv: string[]): Promise<void> {
  let apply = false;
  let project = '';
  let businessId = '';
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--apply' && !apply) {
      apply = true;
      continue;
    }
    if (arg === '--project' && !project && argv[i + 1]) {
      project = argv[++i];
      continue;
    }
    if (arg === '--business-id' && !businessId && argv[i + 1]) {
      businessId = argv[++i];
      continue;
    }
    throw Error(
      'Usage: backfill-version-cursors.ts --project PROJECT --business-id BUSINESS [--apply]',
    );
  }
  const config = JSON.parse(await readFile(resolve('config/knowledge-cloud.json'), 'utf8')) as {
    projectId: string;
    dataConnect: { serviceId: string; location: string };
  };
  if (
    project !== config.projectId ||
    !businessId ||
    process.env.DATA_CONNECT_EMULATOR_HOST ||
    process.env.FIREBASE_AUTH_EMULATOR_HOST
  )
    throw Error('Project/business mismatch or emulator environment');
  const app = initializeApp(
    { projectId: project, credential: applicationDefault() },
    `cursor-backfill-${process.pid}`,
  );
  try {
    const dc = getDataConnect(
      {
        serviceId: config.dataConnect.serviceId,
        location: config.dataConnect.location,
        connector: 'server',
      },
      app,
    );
    if (!(await sql.knowledgeCursorBusiness(dc, { businessId })).data.business)
      throw Error('Business not found in approved project');
    console.log(
      JSON.stringify({
        mode: apply ? 'apply' : 'dry-run',
        project,
        businessId,
        ...(await backfillVersionCursors(
          dataConnectCursorRepository(dc, businessId),
          businessId,
          apply,
        )),
      }),
    );
  } finally {
    await deleteApp(app);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  main(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : 'Cursor backfill failed');
    process.exitCode = 1;
  });
