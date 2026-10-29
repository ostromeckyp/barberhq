import type { DeliveryIssueStatus } from './delivery-issue-status.js';
import type { DeliveryQuantities } from './delivery-quantities.js';
export type DeliveryIssueEventDto = {
  id: string;
  revision: number;
  type:
    | 'OPENED'
    | 'REVIEW_STARTED'
    | 'NOTE_ADDED'
    | 'REPLACEMENT_CREATED'
    | 'REPLACEMENT_REJECTED'
    | 'REPLACEMENT_RECEIVED';
  recordedAt: string;
  actorLabel: string;
  requestId: string | null;
  note: string | null;
  status: DeliveryIssueStatus;
  quantities: DeliveryQuantities[];
};
