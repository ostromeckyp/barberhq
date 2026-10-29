import { createHash } from 'node:crypto';
import { deliveryReceiptId } from '../../functions/src/delivery/intent.ts';
export type DeliveryTarget = {
  projectId: string;
  serviceId: string;
  location: string;
  businessId: string;
};
export type LegacyReceipt = {
  id: string;
  businessId: string;
  requestId: string;
  transferRequestId: string;
  salonId: string;
  actorUid: string;
  recordedAt: string;
  origin: string;
  legacyActionReceiptId: string | null;
  items: {
    productId: string;
    goodQuantity: number;
    damagedQuantity: number;
    missingQuantity: number;
  }[];
};
export type DeliverySnapshot = {
  target: DeliveryTarget;
  requests: {
    id: string;
    businessId: string;
    salonId: string;
    state: string;
    revision: number;
    replacementIssueId: string | null;
  }[];
  items: { id: string; requestId: string; productId: string; quantity: number }[];
  transfers: {
    requestId: string;
    businessId: string;
    warehouseId: string;
    destinationId: string;
  }[];
  transferItems: {
    requestItemId: string;
    transferRequestId: string;
    quantity: number;
    dispatchedQuantity: number;
    receivedQuantity: number;
  }[];
  actions: {
    id: string;
    businessId: string;
    requestId: string;
    actorUid: string;
    action: string;
    state: string;
    revision: number;
    createdAt: string;
  }[];
  movements: {
    transferItemRequestItemId: string;
    type: string;
    quantity: number;
    actorUid: string;
    createdAt: string;
  }[];
  receipts: LegacyReceipt[];
  preservation: Record<string, unknown[]>;
};
export type DeliveryBackfill = {
  target: DeliveryTarget;
  snapshotHash: string;
  receipts: LegacyReceipt[];
};
const canonical = (value: unknown): string =>
  JSON.stringify(value, (_key, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  );
const digest = (value: unknown) => createHash('sha256').update(canonical(value)).digest('hex');
function expectedReceipts(s: DeliverySnapshot): LegacyReceipt[] {
  const ids = new Set<string>();
  return s.requests.flatMap((request) => {
    if (ids.has(request.id) || request.businessId !== s.target.businessId)
      throw new Error('Invalid migration scope');
    ids.add(request.id);
    const existing = s.receipts.filter((r) => r.requestId === request.id);
    if (existing.length > 1) throw new Error('Receipt conflict');
    if (existing[0]?.origin === 'RECORDED') return [];
    if (request.state !== 'RECEIVED') {
      if (existing.length) throw new Error('Receipt conflict with request state');
      return [];
    }
    if (request.replacementIssueId) throw new Error('Legacy replacement history unavailable');
    const actions = s.actions.filter((a) => a.requestId === request.id && a.action === 'RECEIVE'),
      action = actions[0],
      transfer = s.transfers.filter((t) => t.requestId === request.id),
      items = s.items
        .filter((i) => i.requestId === request.id)
        .sort((a, b) => a.productId.localeCompare(b.productId));
    if (
      actions.length !== 1 ||
      !action.actorUid ||
      !Number.isFinite(Date.parse(action.createdAt)) ||
      action.businessId !== s.target.businessId ||
      action.state !== 'RECEIVED' ||
      action.revision !== request.revision ||
      transfer.length !== 1 ||
      transfer[0].businessId !== s.target.businessId ||
      transfer[0].destinationId !== request.salonId ||
      items.length < 1 ||
      items.length > 6 ||
      new Set(items.map((i) => i.productId)).size !== items.length ||
      new Set(items.map((i) => i.id)).size !== items.length
    )
      throw new Error('Inconsistent legacy receipt history');
    const productIds = new Set(
      (s.preservation.products ?? []).map((row) => (row as { id: string }).id),
    );
    if (items.some((item) => !productIds.has(item.productId)))
      throw new Error('Legacy product outside business scope');
    const rows = items.map((item) => {
      const lines = s.transferItems.filter((t) => t.requestItemId === item.id),
        line = lines[0],
        moves = s.movements.filter(
          (m) => m.transferItemRequestItemId === item.id && m.type === 'RECEIPT',
        ),
        move = moves[0];
      if (
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > 99 ||
        lines.length !== 1 ||
        line.transferRequestId !== request.id ||
        line.quantity !== item.quantity ||
        line.dispatchedQuantity !== item.quantity ||
        line.receivedQuantity !== item.quantity ||
        moves.length !== 1 ||
        move.quantity !== item.quantity ||
        move.actorUid !== action.actorUid ||
        Date.parse(move.createdAt) !== Date.parse(action.createdAt)
      )
        throw new Error('Inconsistent legacy quantities or actor/time');
      return {
        productId: item.productId,
        goodQuantity: item.quantity,
        damagedQuantity: 0,
        missingQuantity: 0,
      };
    });
    return [
      {
        id: deliveryReceiptId(request.id),
        businessId: s.target.businessId,
        requestId: request.id,
        transferRequestId: request.id,
        salonId: request.salonId,
        actorUid: action.actorUid,
        recordedAt: action.createdAt,
        origin: 'LEGACY',
        legacyActionReceiptId: action.id,
        items: rows,
      },
    ];
  });
}
export function planDeliveryBackfill(snapshot: DeliverySnapshot): DeliveryBackfill {
  const expected = expectedReceipts(snapshot),
    receipts: LegacyReceipt[] = [];
  for (const row of expected) {
    const existing = snapshot.receipts.find((r) => r.requestId === row.requestId);
    if (existing) {
      if (canonical(existing) !== canonical(row)) throw new Error('Existing receipt conflict');
    } else receipts.push(row);
  }
  for (const receipt of snapshot.receipts)
    if (!snapshot.requests.some((r) => r.id === receipt.requestId))
      throw new Error('Orphan receipt conflict');
  const { receipts: _receipts, ...stable } = snapshot;
  return { target: { ...snapshot.target }, snapshotHash: digest(stable), receipts };
}

import type { DataConnect } from 'firebase-admin/data-connect';
export async function readDeliveryBackfillSnapshot(
  dc: DataConnect,
  target: DeliveryTarget,
): Promise<DeliverySnapshot> {
  verifyTarget(dc, target);
  async function rows<T>(name: string, where: string, fields: string, order: string): Promise<T[]> {
    const all: T[] = [];
    let offset = 0;
    for (;;) {
      const result = await dc.executeGraphql<{ rows: T[] }, { businessId: string; offset: number }>(
        `query($businessId:String!,$offset:Int!){rows:${name}(where:{${where}},orderBy:${order},limit:100,offset:$offset){${fields}}}`,
        { variables: { businessId: target.businessId, offset } },
      );
      all.push(...result.data.rows);
      if (result.data.rows.length < 100) return all;
      offset += 100;
    }
  }
  const own = 'businessId:{eq:$businessId}',
    request = 'request:{businessId:{eq:$businessId}}',
    version = 'version:{businessId:{eq:$businessId}}';
  const requests = await rows<DeliverySnapshot['requests'][number]>(
    'replenishmentRequests',
    own,
    'id businessId salonId state revision replacementIssueId createdAt',
    '{id:ASC}',
  );
  const items = await rows<DeliverySnapshot['items'][number]>(
    'requestItems',
    request,
    'id requestId productId quantity',
    '{id:ASC}',
  );
  const transfers = await rows<DeliverySnapshot['transfers'][number]>(
    'transfers',
    own,
    'requestId businessId warehouseId destinationId',
    '{requestId:ASC}',
  );
  const transferItems = await rows<DeliverySnapshot['transferItems'][number]>(
    'transferItems',
    'transfer:{businessId:{eq:$businessId}}',
    'requestItemId transferRequestId quantity dispatchedQuantity receivedQuantity',
    '{requestItemId:ASC}',
  );
  const actions = await rows<DeliverySnapshot['actions'][number]>(
    'actionReceipts',
    own,
    'id businessId requestId actorUid action state revision createdAt idempotencyKey payloadHash semanticHash reason',
    '{id:ASC}',
  );
  const movements = await rows<DeliverySnapshot['movements'][number]>(
    'stockMovements',
    own,
    'transferItemRequestItemId type quantity actorUid createdAt businessId',
    '[{transferItemRequestItemId:ASC},{type:ASC}]',
  );
  const receipts = await rows<LegacyReceipt>(
    'deliveryReceipts',
    own,
    'id businessId requestId transferRequestId salonId actorUid recordedAt origin legacyActionReceiptId items:deliveryReceiptItems_on_receipt(orderBy:{productId:ASC},limit:6){productId goodQuantity damagedQuantity missingQuantity}',
    '{id:ASC}',
  );
  const preservation: Record<string, unknown[]> = {};
  const selected: [string, string, string, string][] = [
    [
      'inventories',
      'location:{businessId:{eq:$businessId}}',
      'locationId productId onHand reserved version',
      '[{locationId:ASC},{productId:ASC}]',
    ],
    [
      'actionKeys',
      own,
      'businessId actorUid idempotencyKey receiptId payloadHash',
      '[{actorUid:ASC},{idempotencyKey:ASC}]',
    ],
    [
      'activeRequests',
      own,
      'businessId salonId productId requestId',
      '[{salonId:ASC},{productId:ASC}]',
    ],
    [
      'products',
      own,
      'id demoId name brand category summaryEn scentPl sourceCode netContentMl retailPriceGrosz sourceUrl observedOn',
      '{id:ASC}',
    ],
    ['locations', own, 'id businessId key name kind', '{id:ASC}'],
    ['memberships', own, 'uid businessId role', '{uid:ASC}'],
    [
      'salonAccesses',
      'membership:{businessId:{eq:$businessId}}',
      'membershipUid locationId',
      '[{membershipUid:ASC},{locationId:ASC}]',
    ],
    [
      'salonSettingss',
      'salon:{businessId:{eq:$businessId}}',
      'salonId lowStockThreshold version updatedAt',
      '{salonId:ASC}',
    ],
    [
      'deliveryProcedureBindings',
      own,
      'businessId kind documentId revision updatedAt',
      '{kind:ASC}',
    ],
    [
      'deliveryIssues',
      own,
      'id businessId salonId rootReceiptId rootRequestId status revision activeReplacementRequestId createdAt',
      '{id:ASC}',
    ],
    [
      'deliveryIssueItems',
      'issue:{businessId:{eq:$businessId}}',
      'issueId productId initialAffectedQuantity replacementAcceptedQuantity',
      '[{issueId:ASC},{productId:ASC}]',
    ],
    [
      'deliveryIssueEvents',
      'issue:{businessId:{eq:$businessId}}',
      'id issueId revision actorUid recordedAt type status requestId note quantities',
      '{id:ASC}',
    ],
    [
      'deliveryActionKeys',
      own,
      'businessId actorUid idempotencyKey commandId payloadHash',
      '[{actorUid:ASC},{idempotencyKey:ASC}]',
    ],
    [
      'deliveryCommandReceipts',
      own,
      'id businessId actorUid type target payloadHash result createdAt',
      '{id:ASC}',
    ],
    [
      'knowledgeDocuments',
      own,
      'id businessId documentCode activeVersionId revision nextVersionNumber',
      '{id:ASC}',
    ],
    [
      'knowledgeVersions',
      own,
      'id documentId businessId versionLabel title language sourceType publicationStatus synthetic sourceUrls observedOn status revision bucket objectPath objectGeneration pdfSha256 contentType byteSize pageCount uploadedAt pendingStage pendingDocumentRevision pendingExtractionHash processingLeaseId processingLeaseExpiresAt parserVersion extractionHash embeddingConfigHash expectedChunkCount reviewedBy reviewedAt reviewedPageCount publishedAt isActive revokedAt processingError processingAttempt createdAt',
      '{id:ASC}',
    ],
    [
      'knowledgeOperations',
      own,
      'id businessId actorUid idempotencyKey action retryStage payloadHash documentId versionId completedAt createdAt',
      '{id:ASC}',
    ],
    [
      'knowledgePages',
      version,
      'versionId physicalPage text markdown spans printedLabel quality reviewed viewBox userUnit rotation',
      '[{versionId:ASC},{physicalPage:ASC}]',
    ],
    [
      'knowledgeChunks',
      version,
      'id versionId physicalPage ordinal sectionId heading text start end rects geometryStatus embedding embeddingModel embeddingDimension embeddingConfigHash',
      '{id:ASC}',
    ],
  ];
  for (const [name, where, fields, order] of selected)
    preservation[name] = await rows(name, where, fields, order);
  return {
    target,
    requests,
    items,
    transfers,
    transferItems,
    actions,
    movements,
    receipts,
    preservation,
  };
}
function verifyTarget(dc: DataConnect, target: DeliveryTarget) {
  const config = dc.connectorConfig;
  if (
    !target.businessId ||
    !['demo-barberhq', 'notbad-6be95'].includes(target.projectId) ||
    dc.app.options.projectId !== target.projectId ||
    config.serviceId !== target.serviceId ||
    config.location !== target.location ||
    config.connector !== 'server'
  )
    throw new Error('DELIVERY_TARGET_CONFLICT');
  if (
    target.projectId === 'demo-barberhq' &&
    (target.serviceId !== 'barberhq' ||
      target.location !== 'europe-west1' ||
      process.env.DATA_CONNECT_EMULATOR_HOST !== '127.0.0.1:9399')
  )
    throw new Error('DELIVERY_TARGET_CONFLICT');
  if (
    target.projectId === 'notbad-6be95' &&
    (target.serviceId !== 'notbad-6be95-service' ||
      target.location !== 'europe-west3' ||
      Object.entries(process.env).some(([k, v]) => k.endsWith('_EMULATOR_HOST') && v))
  )
    throw new Error('DELIVERY_TARGET_CONFLICT');
}
export type BackfillApproval = {
  confirmBusinessId: string;
  quiescent: boolean;
  snapshotHash: string;
};
export async function applyDeliveryBackfill(
  dc: DataConnect,
  plan: DeliveryBackfill,
  approval: BackfillApproval,
) {
  verifyTarget(dc, plan.target);
  if (
    !approval.quiescent ||
    approval.confirmBusinessId !== plan.target.businessId ||
    approval.snapshotHash !== plan.snapshotHash
  )
    throw new Error('DELIVERY_APPROVAL_REQUIRED');
  let inserted = 0;
  for (const row of plan.receipts) {
    const snapshot = await readDeliveryBackfillSnapshot(dc, plan.target),
      current = planDeliveryBackfill(snapshot);
    if (current.snapshotHash !== plan.snapshotHash) throw new Error('DELIVERY_SNAPSHOT_CHANGED');
    const expected = expectedReceipts(snapshot).find((r) => r.requestId === row.requestId);
    if (!expected || canonical(expected) !== canonical(row))
      throw new Error('DELIVERY_PLAN_CONFLICT');
    if (snapshot.receipts.some((r) => r.requestId === row.requestId)) continue;
    const request = snapshot.requests.find((r) => r.id === row.requestId)!;
    const { origin: _origin, items: _items, transferRequestId: _transfer, ...header } = row;
    const variables = {
      ...header,
      revision: request.revision,
      productIds: row.items.map((i) => i.productId),
      quantities: row.items.map((i) => i.goodQuantity),
    };
    const inserts = row.items
      .map(
        (_item, i) =>
          `item${i}:deliveryReceiptItem_insert(data:{receiptId:$id,productId_expr:"vars.productIds[${i}]",goodQuantity_expr:"vars.quantities[${i}]",damagedQuantity:0,missingQuantity:0})`,
      )
      .join('\n');
    await dc.executeGraphql(
      `mutation($id:String!,$businessId:String!,$requestId:String!,$salonId:String!,$actorUid:String!,$recordedAt:Timestamp!,$legacyActionReceiptId:String!,$revision:Int!,$productIds:[String!]!,$quantities:[Int!]!) @transaction {
   requestGuard:query @redact {replenishmentRequest(id:$requestId) @check(expr:"this != null && this.businessId == vars.businessId && this.salonId == vars.salonId && this.state == 'RECEIVED' && this.revision == vars.revision && this.replacementIssueId == null && this.items.map(i,i.productId) == vars.productIds && this.items.map(i,i.quantity) == vars.quantities",message:"DELIVERY_SNAPSHOT_CHANGED"){id businessId salonId state revision replacementIssueId items:requestItems_on_request(orderBy:{productId:ASC},limit:6){productId quantity}}}
   historyGuard:query @redact {actionReceipt(id:$legacyActionReceiptId) @check(expr:"this != null && this.businessId == vars.businessId && this.requestId == vars.requestId && this.actorUid == vars.actorUid && this.action == 'RECEIVE' && this.state == 'RECEIVED' && this.revision == vars.revision && this.createdAt == vars.recordedAt",message:"DELIVERY_SNAPSHOT_CHANGED"){businessId requestId actorUid action state revision createdAt}}
   deliveryReceipt_insert(data:{id:$id,businessId:$businessId,requestId:$requestId,transferRequestId:$requestId,salonId:$salonId,actorUid:$actorUid,recordedAt:$recordedAt,origin:LEGACY,legacyActionReceiptId:$legacyActionReceiptId})
   ${inserts}
  }`,
      { variables },
    );
    inserted++;
  }
  const after = planDeliveryBackfill(await readDeliveryBackfillSnapshot(dc, plan.target));
  if (after.snapshotHash !== plan.snapshotHash || after.receipts.length)
    throw new Error('DELIVERY_VERIFICATION_FAILED');
  return { inserted, snapshotHash: after.snapshotHash };
}

import { initializeApp, deleteApp, applicationDefault } from 'firebase-admin/app';
import { getDataConnect } from 'firebase-admin/data-connect';
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
async function runDeliveryBackfillCli() {
  const { values: v } = parseArgs({
    options: {
      project: { type: 'string' },
      service: { type: 'string' },
      location: { type: 'string' },
      business: { type: 'string' },
      confirm: { type: 'string' },
      quiescent: { type: 'boolean' },
      'snapshot-hash': { type: 'string' },
      apply: { type: 'boolean' },
      'dry-run': { type: 'boolean' },
    },
  });
  if (v.apply && v['dry-run']) throw new Error('Choose dry-run or apply');
  const target: DeliveryTarget = {
    projectId: v.project ?? '',
    serviceId: v.service ?? '',
    location: v.location ?? '',
    businessId: v.business ?? '',
  };
  if (!target.projectId || !target.serviceId || !target.location || !target.businessId)
    throw new Error('Explicit project/service/location/business required');
  if (v.apply && (!v.quiescent || v.confirm !== target.businessId || !v['snapshot-hash']))
    throw new Error(
      'Apply requires confirmed business, quiescent commands and the dry-run snapshot hash',
    );
  const app = initializeApp(
    {
      projectId: target.projectId,
      ...(target.projectId === 'notbad-6be95' ? { credential: applicationDefault() } : {}),
    },
    `delivery-backfill-${Date.now()}`,
  );
  try {
    const dc = getDataConnect(
      { connector: 'server', serviceId: target.serviceId, location: target.location },
      app,
    );
    const plan = planDeliveryBackfill(await readDeliveryBackfillSnapshot(dc, target));
    console.log({
      target,
      dryRun: !v.apply,
      pendingReceipts: plan.receipts.length,
      snapshotHash: plan.snapshotHash,
    });
    if (v.apply)
      console.log(
        await applyDeliveryBackfill(dc, plan, {
          confirmBusinessId: v.confirm!,
          quiescent: !!v.quiescent,
          snapshotHash: v['snapshot-hash']!,
        }),
      );
  } finally {
    await deleteApp(app);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  runDeliveryBackfillCli().catch((error) => {
    console.error(
      error instanceof Error && /^DELIVERY_[A-Z_]+$/.test(error.message)
        ? error.message
        : 'DELIVERY_BACKFILL_FAILED',
    );
    process.exitCode = 1;
  });
