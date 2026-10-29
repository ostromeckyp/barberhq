import type { DeliverySummaryDto } from '../delivery/delivery-summary-dto.js';
import type { RequestDetailItem } from './request-detail-item.js';
import type { RequestState } from './request-state.js';
import type { RequestSummary } from './request-summary.js';
export type RequestDetail = Omit<RequestSummary, 'items'> & {
  items: RequestDetailItem[];
  delivery?: DeliverySummaryDto;
  timeline: {
    state: RequestState;
    at: string;
    actorLabel: string;
    reason?: string;
  }[];
};
