import type { DraftLine } from './draft.js';
import type { SourceSection } from './knowledge.js';

export type PrepareInput = {
  salonId: string;
  message: string;
  clarifications?: {
    lineId: string;
    originalWording: string;
    productId?: string;
    quantity?: number;
    /** Opaque server receipt from the clarification; never a trusted product phrase. */
    choiceReceiptId?: string;
  }[];
};
export type ProposalResult = {
  status: 'PROPOSAL' | 'NEEDS_CLARIFICATION' | 'UNAVAILABLE';
  lines: DraftLine[];
  excluded: { lineId: string; productId: string; requestId: string; reason: 'ALREADY_ACTIVE' }[];
  toolEvents: {
    name: 'findProduct' | 'getStockContext' | 'calculateProposal';
    durationMs: number;
  }[];
  /** Server outcome of salon shorthand learning (at most six); never client authority. */
  shorthandLearning?: ShorthandLearning[];
};
export type ShorthandLearning = {
  lineId: string;
  status: 'LEARNED' | 'UNCHANGED' | 'NOT_SAVED';
  reason?: 'NO_RECEIPT' | 'STALE_STATE' | 'EXPIRED' | 'UNAVAILABLE' | 'CONFLICTING_CHOICES';
};
export type { ProductMatch } from './product-lookup.js';
export type StockContext = {
  productId: string;
  productName: string;
  hqAvailable: number;
  salonOnHand: number;
  hqInventoryVersion: number;
  salonInventoryVersion: number;
  activeRequestId: string | null;
};
export type ProcedureInput = { question: string; answerLanguage: 'en' | 'pl' };
export type CitedStep = { text: string; sourceSectionIds: string[] };
export type ProcedureResult =
  | { status: 'ANSWER'; steps: CitedStep[]; sources: SourceSection[]; missingInformation: string[] }
  | { status: 'NEEDS_CLARIFICATION'; question: string; sources: [] }
  | { status: 'INSUFFICIENT_EVIDENCE'; message: string; sources: [] };
export type AiOperationalCode =
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'PROVIDER_UNAVAILABLE'
  | 'SERVICE_UNAVAILABLE'
  | 'SOURCE_CHANGED'
  | 'INVALID_MODEL_OUTPUT'
  | 'EMBEDDING_CONFIG_MISMATCH';
