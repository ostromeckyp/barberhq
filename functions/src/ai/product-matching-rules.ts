import type { AppliedMatch } from './models/applied-match.js';
import type { MatchLine } from './models/match-line.js';
import type { MatchRequest } from './models/match-request.js';
import type { MatchResult } from './models/match-result.js';

export const matchLimits = Object.freeze({ suggestions: 3, reasonChars: 120 });
/** Only fuzzy or missing deterministic evidence may become an AI auto-match. */
const autoTiers = new Set<MatchLine['tier']>(['NONE', 'CONTAINS']);

/** Pure server rules over model output: the model can suggest, never invent or widen scope. */
export function applyMatches(
  lines: MatchLine[],
  matches: MatchResult,
  catalog: MatchRequest['catalog'],
): AppliedMatch[] {
  const names = new Map(catalog.map((p) => [p.productId, p.name]));
  const results = new Map<string, MatchResult['lines'][number]>();
  for (const m of matches.lines) if (!results.has(m.lineId)) results.set(m.lineId, m);
  const applied: AppliedMatch[] = [];
  for (const line of lines) {
    const match = results.get(line.lineId);
    if (!match) continue;
    const suggested = [...new Set(match.productIds)]
      .filter((id) => names.has(id))
      .slice(0, matchLimits.suggestions);
    if (!suggested.length) continue;
    const reason = [...match.reason].slice(0, matchLimits.reasonChars).join('');
    const rest = line.candidateIds.filter((id) => names.has(id) && !suggested.includes(id));
    const single =
      autoTiers.has(line.tier) && suggested.length === 1 && match.confidence === 'HIGH';
    const validQuantity =
      Number.isInteger(line.quantity) && line.quantity! >= 1 && line.quantity! <= 99;
    applied.push({
      lineId: line.lineId,
      outcome: single ? (validQuantity ? 'READY' : 'ENTER_QUANTITY') : 'CHOOSE_PRODUCT',
      reason,
      candidates: [
        ...suggested.map((productId) => ({
          productId,
          productName: names.get(productId)!,
          suggested: true as const,
          reason,
        })),
        ...rest.map((productId) => ({ productId, productName: names.get(productId)! })),
      ],
    });
  }
  return applied;
}
