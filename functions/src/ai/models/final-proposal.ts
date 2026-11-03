import type { ProposalResult } from '../../../../shared/contracts/ai/index.js';
import type { MatchLine } from './match-line.js';
import type { MatchRequest } from './match-request.js';

export type FinalProposal = {
  result: ProposalResult;
  /**
   * Receipt requests: final product clarifications and AI-matched lines (model-extracted
   * phrase, every product the user may be offered for it).
   */
  clarifications: { lineId: string; productQuery: string; allowedProductIds: string[] }[];
  /** Explicit user choices that passed final validation. */
  choices: { lineId: string; productId: string; choiceReceiptId?: string }[];
  /** Model-extracted lines lookup left open, without an explicit choice or an applied AI match. */
  unresolved: MatchLine[];
  /** The scoped catalog card the final lines were built from. */
  catalog: MatchRequest['catalog'];
  catalogRevision: number;
};
