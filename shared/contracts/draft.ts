import type { SubmitInput } from "./stock.js";
export type LineOrigin = "manual" | "assistant";
export type ReadyDraftLine = {
  status: "READY";
  lineId: string;
  productId: string;
  productName: string;
  quantity: number;
  origin: LineOrigin;
  hqAvailable: number;
  salonOnHand: number;
  hqInventoryVersion: number;
  salonInventoryVersion: number;
};
export type ClarificationLine = {
  status: "NEEDS_CLARIFICATION";
  lineId: string;
  originalWording: string;
  reason: string;
  origin: LineOrigin;
  candidates: { productId: string; productName: string }[];
  quantity?: number;
};
export type DraftLine = ReadyDraftLine | ClarificationLine;
export type SubmissionRow = {
  lineId: string;
  payload: SubmitInput;
  status: "CREATED" | "ALREADY_ACTIVE" | "FAILED" | "UNKNOWN";
  requestId?: string;
  errorCode?: string;
};
export type PendingSubmission = {
  userId: string;
  businessId: string;
  salonId: string;
  rows: {
    lineId: string;
    payload: SubmitInput;
    status: "UNSENT" | "UNKNOWN";
  }[];
};
