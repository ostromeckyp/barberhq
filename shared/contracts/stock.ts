import type { InventoryRow } from "./business.js";
export type RequestState =
  "PENDING_APPROVAL" | "RESERVED" | "DISPATCHED" | "RECEIVED" | "REJECTED";
export type RequestItemInput = { productId: string; quantity: number };
export type SubmitInput = {
  salonId: string;
  items: RequestItemInput[];
  idempotencyKey: string;
};
export type TransitionInput = {
  requestId: string;
  expectedRevision: number;
  idempotencyKey: string;
};
export type ApproveInput = TransitionInput & {
  inventoryVersions: {
    productId: string;
    expectedHqInventoryVersion: number;
  }[];
};
export type RejectInput = TransitionInput & { reason: string };
export type ReceiveInput = TransitionInput & {
  items: { productId: string; receivedQuantity: number }[];
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
export type ActiveConflict = { productId: string; requestId: string };
export type RequestItemSummary = RequestItemInput & { productName: string };
export type RequestSummary = {
  id: string;
  salonId: string;
  salonName: string;
  state: RequestState;
  revision: number;
  createdAt: string;
  items: RequestItemSummary[];
  itemCount: number;
  totalUnits: number;
};
export type RequestDetailItem = RequestItemSummary & {
  dispatchedQuantity: number;
  receivedQuantity: number;
  stock: InventoryRow;
};
export type RequestDetail = Omit<RequestSummary, "items"> & {
  items: RequestDetailItem[];
  timeline: {
    state: RequestState;
    at: string;
    actorLabel: string;
    reason?: string;
  }[];
};
export type RequestFilter = "ALL" | "ACTIVE" | "RECEIVED" | "REJECTED";
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
