import { createHash, randomUUID } from "node:crypto";
import type { DataConnect } from "firebase-admin/data-connect";
import * as sql from "@barberhq/server";
import type {
  StockAction,
  CommandResult,
  RequestState,
} from "../../../shared/contracts/stock.js";
import { parseAction } from "./schemas.js";
import { StockError } from "./errors.js";

type Context = sql.StockContextData;
type Receipt = Context["semantic"][number];
const hash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const result = (receipt: Receipt, replayed: boolean): CommandResult => ({
  actionReceiptId: receipt.id,
  requestId: receipt.requestId,
  state: receipt.state as RequestState,
  revision: receipt.revision,
  replayed,
});

/** Auth UID comes from the callable token. Business, scope and inventory come from SQL. */
export class StockRepository {
  constructor(private readonly dc: DataConnect) {}

  private async context(uid: string, action: StockAction): Promise<Context> {
    const input = action.input;
    const { data } = await sql.stockContext(this.dc, {
      uid,
      key: input.idempotencyKey,
      action: sql.StockActionType[action.type],
      requestId: "requestId" in input ? input.requestId : "",
      salonId: "salonId" in input ? input.salonId : "",
      productId: "productId" in input ? input.productId : "",
    });
    const member = data.membership;
    if (!member) throw new StockError("FORBIDDEN");
    const salonId =
      action.type === "SUBMIT"
        ? action.input.salonId
        : data.replenishmentRequest?.salonId;
    const salonAction = action.type === "SUBMIT" || action.type === "RECEIVE";
    if (
      salonAction
        ? member.role !== "SALON" ||
          !member.salonAccesses_on_membership.some(
            (a) => a.locationId === salonId,
          )
        : member.role !== "HQ"
    )
      throw new StockError("FORBIDDEN");
    if (action.type === "SUBMIT") {
      if (
        data.product?.businessId !== member.businessId ||
        data.location?.businessId !== member.businessId ||
        data.location.kind !== "SALON"
      )
        throw new StockError("FORBIDDEN");
    } else if (data.replenishmentRequest?.businessId !== member.businessId)
      throw new StockError("FORBIDDEN");
    return data;
  }

  private async replay(
    c: Context,
    uid: string,
    action: StockAction,
    payloadHash: string,
    semanticHash: string,
  ): Promise<CommandResult | undefined> {
    const keyed = c.keyed[0];
    if (keyed) {
      if (
        keyed.receipt.businessId !== c.membership!.businessId ||
        keyed.payloadHash !== payloadHash
      )
        throw new StockError("IDEMPOTENCY_CONFLICT");
      return result(keyed.receipt, true);
    }
    const semantic = c.semantic[0];
    if (semantic) {
      if (semantic.semanticHash !== semanticHash)
        throw new StockError("IDEMPOTENCY_CONFLICT");
      try {
        await sql.bindReplayKey(this.dc, {
          uid,
          businessId: c.membership!.businessId,
          receiptId: semantic.id,
          key: action.input.idempotencyKey,
          payloadHash,
        });
      } catch (error) {
        const fresh = await this.context(uid, action);
        const existing = fresh.keyed[0];
        if (!existing) throw error;
        if (existing.payloadHash !== payloadHash)
          throw new StockError("IDEMPOTENCY_CONFLICT");
        return result(existing.receipt, true);
      }
      return result(semantic, true);
    }
    return undefined;
  }

  async execute(uid: string, raw: StockAction): Promise<CommandResult> {
    if (!uid) throw new StockError("UNAUTHENTICATED");
    const action = parseAction(raw.type, raw.input);
    const { idempotencyKey, ...payload } = action.input;
    const {
      expectedRevision: _revision,
      expectedHqInventoryVersion: _version,
      ...intent
    } = payload as typeof payload & {
      expectedRevision?: number;
      expectedHqInventoryVersion?: number;
    };
    const payloadHash = hash({ type: action.type, ...payload });
    const semanticHash = hash({ type: action.type, ...intent });
    const c = await this.context(uid, action);
    const replay = await this.replay(c, uid, action, payloadHash, semanticHash);
    if (replay) return replay;
    const businessId = c.membership!.businessId;
    if (action.type === "SUBMIT" && c.activeRequests[0])
      throw new StockError(
        "ALREADY_ACTIVE",
        "This product already has an active request.",
        c.activeRequests[0].requestId,
      );
    const requestId =
      action.type === "SUBMIT" ? randomUUID() : action.input.requestId;
    const receiptId = randomUUID();
    const base = {
      uid,
      businessId,
      requestId,
      receiptId,
      key: idempotencyKey,
      payloadHash,
      semanticHash,
    };
    let state: RequestState;
    let revision: number;
    try {
      if (action.type === "SUBMIT") {
        await sql.submitStock(this.dc, {
          ...base,
          salonId: action.input.salonId,
          productId: action.input.productId,
          quantity: action.input.quantity,
        });
        state = "PENDING_APPROVAL";
        revision = 1;
      } else {
        const request = c.replenishmentRequest!;
        if (request.revision !== action.input.expectedRevision)
          throw new StockError("STALE_STATE");
        const expected = {
          APPROVE: "PENDING_APPROVAL",
          REJECT: "PENDING_APPROVAL",
          DISPATCH: "RESERVED",
          RECEIVE: "DISPATCHED",
        };
        if (request.state !== expected[action.type])
          throw new StockError("INVALID_TRANSITION");
        const locationId =
          action.type === "RECEIVE"
            ? request.salonId
            : c.membership!.business.locations_on_business[0]?.id;
        const inventory = request.product.inventories_on_product.find(
          (i) => i.locationId === locationId,
        );
        const vars = {
          ...base,
          revision: action.input.expectedRevision,
          inventoryVersion: inventory?.version ?? 0,
        };
        switch (action.type) {
          case "APPROVE":
            if (
              !inventory ||
              inventory.version !== action.input.expectedHqInventoryVersion
            )
              throw new StockError("STALE_STATE");
            if (inventory.onHand - inventory.reserved < request.quantity)
              throw new StockError("INSUFFICIENT_STOCK");
            await sql.approveStock(this.dc, vars);
            state = "RESERVED";
            break;
          case "REJECT":
            await sql.rejectStock(this.dc, {
              ...base,
              revision: action.input.expectedRevision,
              reason: action.input.reason,
            });
            state = "REJECTED";
            break;
          case "DISPATCH":
            await sql.dispatchStock(this.dc, vars);
            state = "DISPATCHED";
            break;
          case "RECEIVE":
            if (action.input.receivedQuantity !== request.quantity)
              throw new StockError(
                "VALIDATION_ERROR",
                "Only a full, intact delivery can be received.",
              );
            await sql.receiveStock(this.dc, {
              ...vars,
              receivedQuantity: action.input.receivedQuantity,
            });
            state = "RECEIVED";
            break;
        }
        revision = request.revision + 1;
      }
    } catch (error) {
      if (error instanceof StockError) throw error;
      // A rival command may have committed while this transaction waited on a row/unique key.
      // Re-authorize before inspecting its receipt; never retry a write automatically.
      const fresh = await this.context(uid, action);
      const replay = await this.replay(
        fresh,
        uid,
        action,
        payloadHash,
        semanticHash,
      );
      if (replay) return replay;
      if (action.type === "SUBMIT" && fresh.activeRequests[0])
        throw new StockError(
          "ALREADY_ACTIVE",
          "This product already has an active request.",
          fresh.activeRequests[0].requestId,
        );
      const message = error instanceof Error ? error.message : "";
      if (message.includes("STALE_STATE")) throw new StockError("STALE_STATE");
      if (message.includes("FORBIDDEN")) throw new StockError("FORBIDDEN");
      if (message.includes("INVALID_TRANSITION"))
        throw new StockError("INVALID_TRANSITION");
      // Preserve unexpected infrastructure failures as UNKNOWN at the transport boundary.
      throw error;
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
