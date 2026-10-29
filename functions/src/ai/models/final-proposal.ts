import type { ProposalResult } from '../../../../shared/contracts/ai/index.js';

export type FinalProposal = {
  result: ProposalResult;
  /** Final product clarifications (model-extracted phrase, offered candidates). */
  clarifications: { lineId: string; productQuery: string; allowedProductIds: string[] }[];
  /** Explicit user choices that passed final validation. */
  choices: { lineId: string; productId: string; choiceReceiptId?: string }[];
  catalogRevision: number;
};
