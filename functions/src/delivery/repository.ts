import type { DataConnect } from 'firebase-admin/data-connect';
import type { DeliveryAction, DeliveryCommandResult } from '../../../shared/contracts/delivery.js';
import { StockError } from '../stock/errors.js';
import { randomUUID, createHash } from 'node:crypto';
import * as sql from '@barberhq/server';
import { parseDeliveryAction } from './schemas.js';
import { canonicalDeliveryPayload, deliveryReceiptId, deliveryIssueId } from './intent.js';
import { classifyReceipt } from './receipt.js';
import { requestItemId } from '../stock/intent.js';
type Context = sql.ReadDeliveryContextData;
export function authorizeDeliveryContext(c: Context) {
  const member = c.membership,
    request = c.replenishmentRequest;
  if (
    !member ||
    !request ||
    member.businessId !== request.businessId ||
    request.salon.businessId !== member.businessId ||
    request.salon.kind !== 'SALON' ||
    (member.role !== 'HQ' &&
      (member.role !== 'SALON' ||
        !member.salonAccesses_on_membership.some(
          (access) => access.locationId === request.salonId,
        )))
  )
    throw new StockError('FORBIDDEN');
  return { member, request };
}
export class DeliveryRepository {
  constructor(private readonly dc: DataConnect) {}
  async execute(uid: string, raw: DeliveryAction): Promise<DeliveryCommandResult> {
    if (!uid) throw new StockError('UNAUTHENTICATED');
    const action = parseDeliveryAction(raw.type, raw.input);
    if (action.type === 'RECORD_RECEIPT') return this.record(uid, action);
    if (action.type === 'SET_PROCEDURE') return this.setProcedure(uid, action);
    return this.issue(uid, action);
  }
  private async lookupReplay(
    uid: string,
    businessId: string,
    action: DeliveryAction,
    payloadHash: string,
    target: string,
  ): Promise<DeliveryCommandResult | undefined> {
    const key = (
      await sql.readDeliveryKey(this.dc, { uid, businessId, key: action.input.idempotencyKey })
    ).data.deliveryActionKey;
    if (!key) return;
    if (
      key.payloadHash !== payloadHash ||
      key.command.businessId !== businessId ||
      key.command.actorUid !== uid ||
      key.command.type !== action.type ||
      key.command.target !== target
    )
      throw new StockError('IDEMPOTENCY_CONFLICT');
    return { ...(key.command.result as DeliveryCommandResult), replayed: true };
  }
  private async setProcedure(
    uid: string,
    action: Extract<DeliveryAction, { type: 'SET_PROCEDURE' }>,
  ): Promise<DeliveryCommandResult> {
    const input = action.input,
      payloadHash = createHash('sha256').update(canonicalDeliveryPayload(action)).digest('hex');
    const context = async () => {
      const member = (await sql.readDeliveryBindings(this.dc, { uid })).data.membership;
      if (!member || member.role !== 'HQ') throw new StockError('FORBIDDEN');
      return { member, binding: member.business.bindings.find((row) => row.kind === input.kind) };
    };
    const { member, binding } = await context();
    const replay = () => this.lookupReplay(uid, member.businessId, action, payloadHash, input.kind);
    const existing = await replay();
    if (existing) return existing;
    if ((binding?.revision ?? 0) !== input.expectedRevision) throw new StockError('STALE_STATE');
    if (input.documentId) {
      const document = (
        await sql.readDeliveryProcedureDocument(this.dc, {
          businessId: member.businessId,
          documentId: input.documentId,
        })
      ).data.knowledgeDocument;
      if (
        !document ||
        !document.versions.some(
          (version) =>
            version.id === document.activeVersionId &&
            version.businessId === member.businessId &&
            version.status === 'READY' &&
            version.publishedAt &&
            !version.revokedAt,
        )
      )
        throw new StockError('SOURCE_CHANGED', 'Choose a current published procedure.');
    }
    const commandId = randomUUID(),
      result: DeliveryCommandResult = {
        commandId,
        bindingRevision: input.expectedRevision + 1,
        replayed: false,
      };
    try {
      await sql.setDeliveryProcedure(this.dc, {
        uid,
        businessId: member.businessId,
        kind: sql.DeliveryProblemKind[input.kind],
        target: input.kind,
        documentId: input.documentId,
        hasDocument: input.documentId !== null,
        create: !binding,
        revision: input.expectedRevision,
        commandId,
        key: input.idempotencyKey,
        payloadHash,
        result,
      });
    } catch (error) {
      const fresh = await context();
      const committed = await replay();
      if (committed) return committed;
      if ((fresh.binding?.revision ?? 0) !== input.expectedRevision)
        throw new StockError('STALE_STATE');
      const message = error instanceof Error ? error.message : String(error);
      for (const code of ['FORBIDDEN', 'STALE_STATE', 'SOURCE_CHANGED'] as const)
        if (message.includes(code)) throw new StockError(code);
      throw error;
    }
    return result;
  }
  private async record(
    uid: string,
    action: Extract<DeliveryAction, { type: 'RECORD_RECEIPT' }>,
  ): Promise<DeliveryCommandResult> {
    const input = action.input;
    const payloadHash = createHash('sha256').update(canonicalDeliveryPayload(action)).digest('hex');
    const context = async () => {
      const c = (await sql.readDeliveryContext(this.dc, { uid, requestId: input.requestId })).data;
      const scope = authorizeDeliveryContext(c);
      return { ...scope, c };
    };
    const { member, request } = await context();
    const replay = () =>
      this.lookupReplay(uid, member.businessId, action, payloadHash, input.requestId);
    const existing = await replay();
    if (existing) return existing;
    if (request.receipt || request.state !== 'DISPATCHED')
      throw new StockError('INVALID_TRANSITION');
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
      await sql.recordDeliveryTransaction(this.dc, {
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
  private async issue(
    uid: string,
    action: Exclude<DeliveryAction, { type: 'RECORD_RECEIPT' | 'SET_PROCEDURE' }>,
  ): Promise<DeliveryCommandResult> {
    const input = action.input,
      payloadHash = createHash('sha256').update(canonicalDeliveryPayload(action)).digest('hex');
    const context = async () => {
      const c = (await sql.readIssueContext(this.dc, { uid, issueId: input.issueId })).data;
      const member = c.membership,
        issue = c.deliveryIssue;
      if (!member || member.role !== 'HQ' || !issue || issue.businessId !== member.businessId)
        throw new StockError('FORBIDDEN');
      return { member, issue };
    };
    const { member, issue } = await context();
    const replay = () => this.lookupReplay(uid, member.businessId, action, payloadHash, issue.id);
    const existing = await replay();
    if (existing) return existing;
    if (issue.revision !== input.expectedRevision) throw new StockError('STALE_STATE');
    const outstanding = issue.items.filter(
      (item) => item.initialAffectedQuantity > item.replacementAcceptedQuantity,
    );
    const conflicts = async () =>
      (
        await sql.readReplacementSlots(this.dc, {
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
        await sql.createDeliveryReplacement(this.dc, {
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
        await sql.changeDeliveryIssue(this.dc, {
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
}
