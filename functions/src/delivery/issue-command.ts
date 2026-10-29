import type { DataConnect } from 'firebase-admin/data-connect';
import type {
  DeliveryAction,
  DeliveryCommandResult,
} from '../../../shared/contracts/delivery/index.js';
import { randomUUID, createHash } from 'node:crypto';
import * as sql from '@barberhq/server';
import { StockError } from '../stock/errors.js';
import { canonicalDeliveryPayload } from './intent.js';
import { requestItemId } from '../stock/intent.js';
import { lookupDeliveryReplay } from './replay.js';

export async function executeIssueAction(
  dc: DataConnect,
  uid: string,
  action: Exclude<DeliveryAction, { type: 'RECORD_RECEIPT' | 'SET_PROCEDURE' }>,
): Promise<DeliveryCommandResult> {
  const input = action.input,
    payloadHash = createHash('sha256').update(canonicalDeliveryPayload(action)).digest('hex');
  const context = async () => {
    const c = (await sql.readIssueContext(dc, { uid, issueId: input.issueId })).data;
    const member = c.membership,
      issue = c.deliveryIssue;
    if (!member || member.role !== 'HQ' || !issue || issue.businessId !== member.businessId)
      throw new StockError('FORBIDDEN');
    return { member, issue };
  };
  const { member, issue } = await context();
  const replay = () =>
    lookupDeliveryReplay(dc, uid, member.businessId, action, payloadHash, issue.id);
  const existing = await replay();
  if (existing) return existing;
  if (issue.revision !== input.expectedRevision) throw new StockError('STALE_STATE');
  const outstanding = issue.items.filter(
    (item) => item.initialAffectedQuantity > item.replacementAcceptedQuantity,
  );
  const conflicts = async () =>
    (
      await sql.readReplacementSlots(dc, {
        businessId: member.businessId,
        salonId: issue.salonId,
        productIds: outstanding.map((item) => item.productId),
      })
    ).data.activeRequests;
  const activeError = (rows: { productId: string; requestId: string }[]) =>
    new StockError('ALREADY_ACTIVE', 'Some products already have active requests.', rows);
  if (action.type === 'CREATE_REPLACEMENT') {
    if (issue.status === 'RESOLVED' || !outstanding.length)
      throw new StockError('INVALID_TRANSITION');
    const active = await conflicts();
    if (active.length) throw activeError(active);
    if (issue.activeReplacementRequestId || !['OPEN', 'IN_REVIEW'].includes(issue.status))
      throw new StockError('INVALID_TRANSITION');
  } else if (
    issue.status === 'RESOLVED' ||
    (action.type === 'START_REVIEW' && issue.status !== 'OPEN')
  )
    throw new StockError('INVALID_TRANSITION');
  const commandId = randomUUID(),
    requestId = action.type === 'CREATE_REPLACEMENT' ? randomUUID() : issue.rootRequestId;
  const result: DeliveryCommandResult = {
    commandId,
    issueId: issue.id,
    issueRevision: issue.revision + 1,
    requestId,
    ...(action.type === 'CREATE_REPLACEMENT'
      ? { replacementRequestId: requestId, requestRevision: 1 }
      : {}),
    replayed: false,
  };
  const base = {
    uid,
    businessId: member.businessId,
    issueId: issue.id,
    revision: issue.revision,
    commandId,
    key: input.idempotencyKey,
    payloadHash,
    result,
  };
  try {
    if (action.type === 'CREATE_REPLACEMENT') {
      await sql.createDeliveryReplacement(dc, {
        ...base,
        requestId,
        salonId: issue.salonId,
        count: outstanding.length,
        productIds: outstanding.map((item) => item.productId),
        itemIds: outstanding.map((item) => requestItemId(requestId, item.productId)),
        quantities: outstanding.map(
          (item) => item.initialAffectedQuantity - item.replacementAcceptedQuantity,
        ),
        use0: outstanding.length > 0,
        use1: outstanding.length > 1,
        use2: outstanding.length > 2,
        use3: outstanding.length > 3,
        use4: outstanding.length > 4,
        use5: outstanding.length > 5,
      });
    } else {
      await sql.changeDeliveryIssue(dc, {
        ...base,
        type: sql.DeliveryCommandType[action.type],
        eventType:
          action.type === 'START_REVIEW'
            ? sql.DeliveryIssueEventType.REVIEW_STARTED
            : sql.DeliveryIssueEventType.NOTE_ADDED,
        status:
          action.type === 'START_REVIEW'
            ? sql.DeliveryIssueStatus.IN_REVIEW
            : sql.DeliveryIssueStatus[issue.status],
        note: action.type === 'ADD_NOTE' ? action.input.text : null,
      });
    }
  } catch (error) {
    await context();
    const committed = await replay();
    if (committed) return committed;
    if (action.type === 'CREATE_REPLACEMENT') {
      const active = await conflicts();
      if (active.length) throw activeError(active);
    }
    if (error instanceof StockError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    for (const code of [
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
