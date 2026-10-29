import type { DeliveryIssueSummaryDto } from './delivery-issue-summary-dto.js';
export type DeliveryIssuePageDto = {
  items: DeliveryIssueSummaryDto[];
  offset: number;
  hasMore: boolean;
  openCount: number;
};
