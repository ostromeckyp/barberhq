export type MatchResult = {
  lines: { lineId: string; productIds: string[]; confidence: 'HIGH' | 'LOW'; reason: string }[];
};
