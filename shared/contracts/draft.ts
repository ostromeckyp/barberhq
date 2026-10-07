import type { SubmitInput, ActiveConflict } from "./stock.js";
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
export type SubmissionOutcome =
  | { status: "CREATED"; requestId: string }
  | { status: "FAILED"; code: string; conflicts?: ActiveConflict[] }
  | { status: "UNKNOWN" };
export type PendingSubmission = {
  version: 2;
  userId: string;
  businessId: string;
  salonId: string;
  payload: SubmitInput;
};
