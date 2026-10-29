import { randomUUID } from 'node:crypto';
import type { DataConnect } from 'firebase-admin/data-connect';
import * as sql from '@barberhq/server';
import type { StockAction, CommandResult, RequestState } from '../../../shared/contracts/stock.js';
import { parseAction } from './schemas.js';
import { StockError } from './errors.js';
import { canonicalizeAction, payloadHash, semanticHash, requestItemId } from './intent.js';
type Context = sql.StockContextData;
type Receipt = Context['semantic'][number];
const result = (r: Receipt, replayed: boolean): CommandResult => ({
  actionReceiptId: r.id,
  requestId: r.requestId,
  state: r.state as RequestState,
  revision: r.revision,
  replayed,
});
const slots = (count: number) => ({
  use0: count > 0,
  use1: count > 1,
  use2: count > 2,
  use3: count > 3,
  use4: count > 4,
  use5: count > 5,
});
/** Only the verified callable UID enters this boundary. SQL derives and rechecks scope. */
export class StockRepository {
  constructor(private readonly dc: DataConnect) {}
  private async context(uid: string, action: StockAction): Promise<Context> {
    const input = action.input;
    const { data } = await sql.stockContext(this.dc, {
      uid,
      key: input.idempotencyKey,
      action: sql.StockActionType[action.type],
      requestId: 'requestId' in input ? input.requestId : '',
      salonId: 'salonId' in input ? input.salonId : '',
      productIds: action.type === 'SUBMIT' ? action.input.items.map((i) => i.productId) : [],
    });
    const m = data.membership;
    if (!m) throw new StockError('FORBIDDEN');
    const salonId =
      action.type === 'SUBMIT' ? action.input.salonId : data.replenishmentRequest?.salonId;
    if (action.type === 'SUBMIT') {
      if (
        m.role !== 'HQ' &&
        (m.role !== 'SALON' || !m.salonAccesses_on_membership.some((a) => a.locationId === salonId))
      )
        throw new StockError('FORBIDDEN');
    } else if (action.type === 'RECEIVE' && m.role !== 'HQ') {
      if (
        m.role !== 'SALON' ||
        !m.salonAccesses_on_membership.some((a) => a.locationId === salonId)
      )
        throw new StockError('FORBIDDEN');
    } else if (m.role !== 'HQ') throw new StockError('FORBIDDEN');
    if (action.type === 'SUBMIT') {
      if (
        data.products.length !== action.input.items.length ||
        data.products.some((p) => p.businessId !== m.businessId) ||
        data.location?.businessId !== m.businessId ||
        data.location.kind !== 'SALON'
      )
        throw new StockError('FORBIDDEN');
    } else if (data.replenishmentRequest?.businessId !== m.businessId)
      throw new StockError('FORBIDDEN');
    return data;
  }
  private async replay(
    c: Context,
    uid: string,
    action: StockAction,
    payload: string,
    semantic: string,
  ): Promise<CommandResult | undefined> {
    const keyed = c.keyed[0];
    if (keyed) {
      if (keyed.receipt.businessId !== c.membership!.businessId || keyed.payloadHash !== payload)
        throw new StockError('IDEMPOTENCY_CONFLICT');
      return result(keyed.receipt, true);
    }
    const existing = c.semantic[0];
    if (existing) {
      if (existing.semanticHash !== semantic) throw new StockError('IDEMPOTENCY_CONFLICT');
      try {
        await sql.bindReplayKey(this.dc, {
          uid,
          businessId: c.membership!.businessId,
          receiptId: existing.id,
          key: action.input.idempotencyKey,
          payloadHash: payload,
        });
      } catch (error) {
        const fresh = await this.context(uid, action),
          bound = fresh.keyed[0];
        if (!bound) throw error;
        if (bound.payloadHash !== payload) throw new StockError('IDEMPOTENCY_CONFLICT');
        return result(bound.receipt, true);
      }
      return result(existing, true);
    }
  }
  async execute(uid: string, raw: StockAction): Promise<CommandResult> {
    if (!uid) throw new StockError('UNAUTHENTICATED');
    const action = canonicalizeAction(parseAction(raw.type, raw.input));
    const payload = payloadHash(action),
      semantic = semanticHash(action),
      c = await this.context(uid, action);
    const replay = await this.replay(c, uid, action, payload, semantic);
    if (replay) return replay;
    if (action.type === 'RECEIVE')
      throw new StockError('CLIENT_UPDATE_REQUIRED', 'Reload the app to inspect this delivery.');
    if (action.type === 'SUBMIT' && c.activeRequests.length)
      throw new StockError(
        'ALREADY_ACTIVE',
        'Some products already have active requests.',
        c.activeRequests,
      );
    const requestId = action.type === 'SUBMIT' ? randomUUID() : action.input.requestId,
      receiptId = randomUUID();
    const base = {
      uid,
      businessId: c.membership!.businessId,
      requestId,
      receiptId,
      key: action.input.idempotencyKey,
      payloadHash: payload,
      semanticHash: semantic,
    };
    let state: RequestState, revision: number;
    try {
      if (action.type === 'SUBMIT') {
        const items = action.input.items;
        await sql.submitStock(this.dc, {
          ...base,
          ...slots(items.length),
          count: items.length,
          salonId: action.input.salonId,
          productIds: items.map((i) => i.productId),
          itemIds: items.map((i) => requestItemId(requestId, i.productId)),
          quantities: items.map((i) => i.quantity),
        });
        state = 'PENDING_APPROVAL';
        revision = 1;
      } else {
        const request = c.replenishmentRequest!;
        if (request.revision !== action.input.expectedRevision) throw new StockError('STALE_STATE');
        const expected = {
          APPROVE: 'PENDING_APPROVAL',
          REJECT: 'PENDING_APPROVAL',
          DISPATCH: 'RESERVED',
          RECEIVE: 'DISPATCHED',
        };
        if (request.state !== expected[action.type]) throw new StockError('INVALID_TRANSITION');
        const items = request.items;
        if (items.length < 1 || items.length > 6) throw new StockError('INVALID_TRANSITION');
        const vars = {
          ...base,
          revision: action.input.expectedRevision,
          count: items.length,
        };
        const indexed = { ...vars, ...slots(items.length) };
        switch (action.type) {
          case 'APPROVE': {
            const versions = action.input.inventoryVersions;
            if (
              versions.length !== items.length ||
              items.some((item, i) => item.productId !== versions[i].productId)
            )
              throw new StockError('VALIDATION_ERROR');
            for (const [i, item] of items.entries()) {
              const inventory = item.product.inventories_on_product.find(
                (row) => row.locationId === c.membership!.business.locations_on_business[0]?.id,
              );
              if (!inventory || inventory.version !== versions[i].expectedHqInventoryVersion)
                throw new StockError('STALE_STATE');
              if (inventory.onHand - inventory.reserved < item.quantity)
                throw new StockError('INSUFFICIENT_STOCK');
            }
            await sql.approveStock(this.dc, {
              ...indexed,
              inventoryVersions: versions.map((v) => v.expectedHqInventoryVersion),
            });
            state = 'RESERVED';
            break;
          }
          case 'REJECT':
            await sql.rejectStock(this.dc, {
              ...vars,
              reason: action.input.reason,
              isReplacement: !!request.replacementIssueId,
              replacementIssueId: request.replacementIssueId ?? null,
              issueRevision: request.replacementIssue?.revision ?? null,
            });
            state = 'REJECTED';
            break;
          case 'DISPATCH':
            await sql.dispatchStock(this.dc, indexed);
            state = 'DISPATCHED';
            break;
        }
        revision = request.revision + 1;
      }
    } catch (error) {
      if (error instanceof StockError) throw error;
      const fresh = await this.context(uid, action);
      const replay = await this.replay(fresh, uid, action, payload, semantic);
      if (replay) return replay;
      if (action.type === 'SUBMIT' && fresh.activeRequests.length)
        throw new StockError(
          'ALREADY_ACTIVE',
          'Some products already have active requests.',
          fresh.activeRequests,
        );
      const message = error instanceof Error ? error.message : '';
      for (const code of [
        'STALE_STATE',
        'FORBIDDEN',
        'INVALID_TRANSITION',
        'VALIDATION_ERROR',
      ] as const)
        if (message.includes(code)) throw new StockError(code);
      throw error; // Caller reports UNKNOWN; a lost response is not proof of rollback.
    }
    return {
      actionReceiptId: receiptId,
      requestId,
      state,
      revision,
      replayed: false,
    };
  }
}
