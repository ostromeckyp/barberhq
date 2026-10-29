export type ShorthandLearning = {
  lineId: string;
  status: 'LEARNED' | 'UNCHANGED' | 'NOT_SAVED';
  reason?: 'NO_RECEIPT' | 'STALE_STATE' | 'EXPIRED' | 'UNAVAILABLE' | 'CONFLICTING_CHOICES';
};
