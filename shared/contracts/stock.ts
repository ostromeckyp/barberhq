import type { InventoryRow } from "./business.js";
export type RequestState =
  "PENDING_APPROVAL" | "RESERVED" | "DISPATCHED" | "RECEIVED" | "REJECTED";
export type SubmitInput = {
  salonId: string;
  productId: string;
  quantity: number;
  idempotencyKey: string;
};
export type TransitionInput = {
  requestId: string;
  expectedRevision: number;
  idempotencyKey: string;
};
export type ApproveInput = TransitionInput & {
  expectedHqInventoryVersion: number;
};
export type RejectInput = TransitionInput & { reason: string };
export type ReceiveInput = TransitionInput & {
  receivedQuantity: number;
  allIntact: true;
};
export type StockAction =
  | { type: "SUBMIT"; input: SubmitInput }
  | { type: "APPROVE"; input: ApproveInput }
  | { type: "REJECT"; input: RejectInput }
  | { type: "DISPATCH"; input: TransitionInput }
  | { type: "RECEIVE"; input: ReceiveInput };
export type CommandResult = {
  actionReceiptId: string;
  requestId: string;
  state: RequestState;
  revision: number;
  replayed: boolean;
};
export type RequestSummary = {
  id: string;
  salonId: string;
  productId: string;
  productName: string;
  salonName: string;
  quantity: number;
  state: RequestState;
  revision: number;
  createdAt: string;
};
export type RequestDetail = RequestSummary & {
  dispatchedQuantity: number;
  receivedQuantity: number;
  hqInventoryVersion: number;
  timeline: {
    state: RequestState;
    at: string;
    actorLabel: string;
    reason?: string;
  }[];
  stock: InventoryRow;
};
export type StockErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "VALIDATION_ERROR"
  | "STALE_STATE"
  | "INSUFFICIENT_STOCK"
  | "INVALID_TRANSITION"
  | "IDEMPOTENCY_CONFLICT"
  | "ALREADY_ACTIVE"
  | "NOT_FOUND";
