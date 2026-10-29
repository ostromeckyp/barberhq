import type { RequestItemSummary } from './request-item-summary.js';
import type { RequestState } from './request-state.js';
export type RequestSummary = {
  id: string;
  salonId: string;
  salonName: string;
  state: RequestState;
  revision: number;
  createdAt: string;
  items: RequestItemSummary[];
  itemCount: number;
  totalUnits: number;
};
