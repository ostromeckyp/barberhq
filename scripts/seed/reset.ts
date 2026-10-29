import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { aliasSeedFromBusinessSeed, runProductAliasSeed } from './product-aliases.ts';
import { initializeApp, deleteApp, applicationDefault } from 'firebase-admin/app';
import { getDataConnect, type DataConnect } from 'firebase-admin/data-connect';
import { getStorage } from 'firebase-admin/storage';
import {
  createEmbeddingConfig,
  createVertexEmbeddingAdapter,
} from '../../functions/src/knowledge/embedding.ts';
import { KnowledgeRepository } from '../../functions/src/knowledge/repository.ts';
import { rebuildKnowledge, type RebuildDeps } from './knowledge.ts';
import * as sdk from '@barberhq/server';
import { validateSeed } from '../prepare-data/catalog.ts';
import { parsePublicConfig } from '../config/public-config.ts';
export type ResetInput = {
  projectId: string;
  businessKey: string;
  confirmBusinessKey: string;
  dryRun: boolean;
  quiescent: boolean;
  publicConfig?: unknown;
};
const BUSINESS = 'not-bad-stuff-demo';
export async function resetDemo(input: ResetInput) {
  if (
    !['notbad-6be95', 'demo-barberhq'].includes(input.projectId) ||
    input.businessKey !== BUSINESS ||
    input.confirmBusinessKey !== BUSINESS ||
    !input.quiescent
  )
    throw new Error(
      'Reset requires the approved demo target, exact business confirmation and --quiescent.',
    );
  const local = input.projectId === 'demo-barberhq';
  let target = sdk.connectorConfig;
  const cloud = JSON.parse(readFileSync('config/knowledge-cloud.json', 'utf8')) as {
    projectId: string;
    firebaseStorageBucket: string;
    vertexAi: { model: string; location: string; dimension: number };
  };
  if (local) {
    if (process.env.DATA_CONNECT_EMULATOR_HOST !== '127.0.0.1:9399')
      throw new Error('Local reset requires DATA_CONNECT_EMULATOR_HOST=127.0.0.1:9399.');
    if (!/^127\.0\.0\.1:\d+$/.test(process.env.FIREBASE_STORAGE_EMULATOR_HOST ?? ''))
      throw new Error('Local reset requires FIREBASE_STORAGE_EMULATOR_HOST on 127.0.0.1.');
  } else {
    if (cloud.projectId !== input.projectId) throw new Error('RESET_TARGET_INVALID');
    if (Object.entries(process.env).some(([key, value]) => key.endsWith('_EMULATOR_HOST') && value))
      throw new Error('RESET_EMULATOR_FORBIDDEN');
    let config;
    try {
      config = parsePublicConfig(input.publicConfig);
    } catch {
      throw new Error('RESET_TARGET_INVALID');
    }
    if (
      config.projectId !== input.projectId ||
      config.hostingSiteId !== input.projectId ||
      config.dataConnect.serviceId !== 'notbad-6be95-service' ||
      config.dataConnect.location !== 'europe-west3' ||
      config.dataConnect.browserConnectorId !== 'browser' ||
      sdk.connectorConfig.connector !== 'server'
    )
      throw new Error('RESET_TARGET_INVALID');
    target = {
      ...sdk.connectorConfig,
      serviceId: config.dataConnect.serviceId,
      location: config.dataConnect.location,
    };
  }
  const app = initializeApp(
    {
      projectId: input.projectId,
      ...(!local ? { credential: applicationDefault() } : {}),
    },
    `reset-${Date.now()}`,
  );
  try {
    const dc = getDataConnect(target, app);
    const bucket = getStorage(app).bucket(
      local ? 'demo-barberhq.appspot.com' : cloud.firebaseStorageBucket,
    );
    // Same approved Vertex embedding runtime the local and cloud Functions use.
    const embedder = createVertexEmbeddingAdapter(
      createEmbeddingConfig({
        projectId: cloud.projectId,
        modelId: cloud.vertexAi.model,
        location: cloud.vertexAi.location,
        dimension: cloud.vertexAi.dimension,
        documentMode: 'RETRIEVAL_DOCUMENT',
        queryMode: 'RETRIEVAL_QUERY',
      }),
    );
    const repo = new KnowledgeRepository(
      dc,
      getDataConnect({ ...target, connector: 'vector' }, app),
      bucket,
    );
    return await resetRecords(dc, input.businessKey, input.dryRun, { repo, embedder });
  } finally {
    await deleteApp(app);
  }
}
/**
 * Same transaction for CLI and isolated test fixtures; never exposed as a callable.
 * With `knowledge`, documents, cards and their Storage originals are rebuilt from the repo too.
 */
export async function resetRecords(
  dc: DataConnect,
  businessId: string,
  dryRun: boolean,
  knowledge?: Pick<RebuildDeps, 'repo' | 'embedder'>,
) {
  const seed = validateSeed(
    JSON.parse(readFileSync(new URL('../../data/seed/business.json', import.meta.url), 'utf8')),
  );
  if (seed.inventory.some((r) => r.onHand !== (r.locationKey === 'hq' ? 18 : 2)))
    throw new Error('Reset operation must be updated for this seed.');
  const rebuild = (dry: boolean) =>
    knowledge
      ? rebuildKnowledge({ ...knowledge, dc, businessId, businessSeed: seed }, dry)
      : undefined;
  if (dryRun) {
    const { data } = await sdk.readResetCounts(dc, { businessId });
    const knowledgePlan = await rebuild(true);
    return {
      ...(knowledgePlan ? { knowledge: knowledgePlan } : {}),
      deletedOperationalRows: [
        data.requests,
        data.active,
        data.transfers,
        data.items,
        data.transferItems,
        data.movements,
        data.receipts,
        data.keys,
        data.deliveryReceipts,
        data.deliveryItems,
        data.deliveryIssues,
        data.deliveryIssueItems,
        data.deliveryEvents,
        data.deliveryReferences,
        data.deliveryKeys,
        data.deliveryCommands,
      ].reduce((total, rows) => total + (rows[0]?._count ?? 0), 0),
      resetInventoryRows: data.inventories[0]?._count ?? 0,
    };
  }
  const productIds = seed.products.map((p) => `${businessId}:${p.demoId}`);
  const { data } = await sdk.resetDemoStock(dc, { businessId, productIds });
  // HQ product administration returns to the seeded baseline: added products, HQ aliases,
  // seed-alias overrides, journals and edit markers go; seeded fields and aliases come back.
  await dc.executeMutation('ResetProductAdmin', {
    businessId,
    seedProductIdsJson: JSON.stringify(productIds),
  });
  for (const p of seed.products) {
    // type/keywords/aliases are applied by the alias seed, not the product upsert.
    const {
      netContent,
      transferPackSize,
      packageDimensionsMm,
      shippingWeightGrams,
      type,
      keywords,
      aliases,
      ...metadata
    } = p;
    await sdk.upsertProduct(dc, {
      ...metadata,
      id: `${businessId}:${p.demoId}`,
      businessId,
      netContentMl: netContent.value,
    });
  }
  await runProductAliasSeed(dc, aliasSeedFromBusinessSeed(seed), businessId, true);
  const rebuilt = await rebuild(false);
  return {
    ...(rebuilt ? { knowledge: rebuilt } : {}),
    deletedOperationalRows:
      data.deliveryReceipts +
      data.deliveryItems +
      data.deliveryIssues +
      data.deliveryIssueItems +
      data.deliveryEvents +
      data.deliveryReferences +
      data.deliveryKeys +
      data.deliveryCommands +
      data.keys +
      data.receipts +
      data.movements +
      data.transfers +
      data.items +
      data.transferItems +
      data.active +
      data.requests,
    resetInventoryRows: data.hq + data.salons,
  };
}
export function safeResetError(error: unknown): string {
  // Knowledge preflight errors name only codes and document versions, never request details.
  return error instanceof Error &&
    (/^RESET_[A-Z_]+$/.test(error.message) ||
      /^KNOWLEDGE_[A-Z_]+: [A-Z0-9 :;v_-]+$/.test(error.message))
    ? error.message
    : 'RESET_OPERATION_FAILED';
}
async function runResetCli() {
  const { values: v } = parseArgs({
    options: {
      project: { type: 'string' },
      business: { type: 'string' },
      confirm: { type: 'string' },
      quiescent: { type: 'boolean' },
      apply: { type: 'boolean' },
      'dry-run': { type: 'boolean' },
      config: { type: 'string' },
    },
  });
  if (Boolean(v.apply) === Boolean(v['dry-run']))
    throw new Error('Choose exactly one of --dry-run / --apply. Close demo sessions before reset.');
  const input: ResetInput = {
    projectId: v.project ?? '',
    businessKey: v.business ?? '',
    confirmBusinessKey: v.confirm ?? '',
    quiescent: !!v.quiescent,
    dryRun: true,
    publicConfig: v.config ? JSON.parse(readFileSync(v.config, 'utf8')) : undefined,
  };
  console.log({
    projectId: input.projectId,
    businessKey: input.businessKey,
    dryRun: await resetDemo(input),
  });
  if (v.apply) console.log({ applied: await resetDemo({ ...input, dryRun: false }) });
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runResetCli().catch((error: unknown) => {
    console.error(safeResetError(error));
    process.exitCode = 1;
  });
}
