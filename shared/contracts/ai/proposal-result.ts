import type { ShorthandLearning } from './shorthand-learning.js';
import type { DraftLine } from '../draft/draft-line.js';
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
