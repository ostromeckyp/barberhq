import type { AiBudget } from './ai-budget.js';
import type { MatchRequest } from './match-request.js';
import type { MatchResult } from './match-result.js';

export type ProductMatcher = (budget: AiBudget, request: MatchRequest) => Promise<MatchResult>;
