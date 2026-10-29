import type { DataConnect } from 'firebase-admin/data-connect';
import type {
  DeliveryAction,
  DeliveryCommandResult,
} from '../../../shared/contracts/delivery/index.js';
import { randomUUID, createHash } from 'node:crypto';
import * as sql from '@barberhq/server';
import { StockError } from '../stock/errors.js';
import { canonicalDeliveryPayload, deliveryReceiptId, deliveryIssueId } from './intent.js';
import { classifyReceipt } from './receipt.js';
import { authorizeDeliveryContext } from './access.js';
import { lookupDeliveryReplay } from './replay.js';

export async function executeReceipt(
  dc: DataConnect,
  uid: string,
  action: Extract<DeliveryAction, { type: 'RECORD_RECEIPT' }>,
): Promise<DeliveryCommandResult> {
  const input = action.input;
  const payloadHash = createHash('sha256').update(canonicalDeliveryPayload(action)).digest('hex');
  const context = async () => {
    const c = (await sql.readDeliveryContext(dc, { uid, requestId: input.requestId })).data;
    const scope = authorizeDeliveryContext(c);
    return { ...scope, c };
  };
  const { member, request } = await context();
  const replay = () =>
    lookupDeliveryReplay(dc, uid, member.businessId, action, payloadHash, input.requestId);
  const existing = await replay();
  if (existing) return existing;
  if (request.receipt || request.state !== 'DISPATCHED') throw new StockError('INVALID_TRANSITION');
  if (request.revision !== input.expectedRevision) throw new StockError('STALE_STATE');
  const items = classifyReceipt(
    input.items,
    request.items.map((item) => ({
      productId: item.productId,
      dispatchedQuantity: item.transferItem?.dispatchedQuantity ?? 0,
    })),
  );
  const hasIssue = items.some((item) => item.damagedQuantity + item.missingQuantity > 0);
  const isReplacement = !!request.replacementIssueId,
    root = request.replacementIssue;
  if (
    isReplacement &&
    (!root ||
      root.businessId !== member.businessId ||
      root.salonId !== request.salonId ||
      root.activeReplacementRequestId !== request.id ||
      root.status !== 'REPLACEMENT_IN_PROGRESS')
  )
    throw new StockError('STALE_STATE');
  if (
    root &&
    root.items.some(
      (line) =>
        line.replacementAcceptedQuantity +
          (items.find((item) => item.productId === line.productId)?.goodQuantity ?? 0) >
        line.initialAffectedQuantity,
    )
  )
    throw new StockError('STALE_STATE');
  const resolveIssue =
    !!root &&
    root.items.every(
      (line) =>
        line.replacementAcceptedQuantity +
          (items.find((item) => item.productId === line.productId)?.goodQuantity ?? 0) ===
        line.initialAffectedQuantity,
    );
  const receiptId = deliveryReceiptId(request.id),
    issueId = root?.id ?? deliveryIssueId(receiptId),
    commandId = randomUUID();
  const result: DeliveryCommandResult = {
    commandId,
    requestId: request.id,
    receiptId,
    requestRevision: request.revision + 1,
    ...(isReplacement
      ? { issueId, issueRevision: root!.revision + 1 }
      : hasIssue
        ? { issueId, issueRevision: 1 }
        : {}),
    replayed: false,
  };
  const switches: Record<string, boolean> = {};
  for (let i = 0; i < 6; i++)
    Object.assign(switches, {
      [`use${i}`]: i < items.length,
      [`move${i}`]: (items[i]?.goodQuantity ?? 0) > 0,
      [`affected${i}`]:
        !isReplacement && (items[i]?.damagedQuantity ?? 0) + (items[i]?.missingQuantity ?? 0) > 0,
      [`replace${i}`]: isReplacement && i < items.length,
    });
  const references = input.procedureReferences;
  const ref0 = references[0],
    ref1 = references[1];
  try {
    await sql.recordDeliveryTransaction(dc, {
      uid,
      businessId: member.businessId,
      requestId: request.id,
      revision: input.expectedRevision,
      receiptId,
      issueId,
      commandId,
      key: input.idempotencyKey,
      payloadHash,
      result,
      eventQuantities: items,
      hasIssue,
      isReplacement,
      createIssue: hasIssue && !isReplacement,
      hasRootIssue: hasIssue || isReplacement,
      issueRevision: root?.revision ?? 0,
      resolveIssue,
      description: input.report?.description ?? null,
      batchIdentifier: input.report?.batchIdentifier ?? null,
      productIds: items.map((item) => item.productId),
      goods: items.map((item) => item.goodQuantity),
      damaged: items.map((item) => item.damagedQuantity),
      missing: items.map((item) => item.missingQuantity),
      count: items.length,
      ...(switches as Pick<
        sql.RecordDeliveryTransactionVariables,
        | 'use0'
        | 'use1'
        | 'use2'
        | 'use3'
        | 'use4'
        | 'use5'
        | 'move0'
        | 'move1'
        | 'move2'
        | 'move3'
        | 'move4'
        | 'move5'
        | 'affected0'
        | 'affected1'
        | 'affected2'
        | 'affected3'
        | 'affected4'
        | 'affected5'
        | 'replace0'
        | 'replace1'
        | 'replace2'
        | 'replace3'
        | 'replace4'
        | 'replace5'
      >),
      ref0: !!ref0,
      version0: ref0?.versionId ?? '',
      kind0: sql.DeliveryProblemKind[ref0?.kind ?? 'DAMAGED'],
      chunk0: ref0?.chunkId ?? null,
      useChunk0: !!ref0?.chunkId,
      ref1: !!ref1,
      version1: ref1?.versionId ?? '',
      kind1: sql.DeliveryProblemKind[ref1?.kind ?? 'MISSING'],
      chunk1: ref1?.chunkId ?? null,
      useChunk1: !!ref1?.chunkId,
    });
  } catch (error) {
    const fresh = await context();
    const committed = await replay();
    if (committed) return committed;
    if (fresh.request.receipt)
      throw new StockError('INVALID_TRANSITION', 'This delivery has already been inspected.');
    if (error instanceof StockError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    for (const code of [
      'SOURCE_CHANGED',
      'FORBIDDEN',
      'STALE_STATE',
      'INVALID_TRANSITION',
      'VALIDATION_ERROR',
    ] as const)
      if (message.includes(code)) throw new StockError(code);
    throw error;
  }
  return result;
}
