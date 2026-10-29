import type { DeliveryIssueStatus } from './delivery-issue-status.js';
import type { DeliveryQuantities } from './delivery-quantities.js';
import type { DeliveryReceiptDto } from './delivery-receipt-dto.js';
export type DeliverySummaryDto = {
  receipt: DeliveryReceiptDto | null;
  rootIssue: { id: string; status: DeliveryIssueStatus; revision: number } | null;
  replacementForIssueId: string | null;
  items: (DeliveryQuantities & { inTransit: number })[];
};
