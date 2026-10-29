import type { DeliveryIssueEventDto } from './delivery-issue-event-dto.js';
import type { DeliveryIssueStatus } from './delivery-issue-status.js';
import type { DeliveryReceiptDto } from './delivery-receipt-dto.js';
import type { DeliveryReplacementDto } from './delivery-replacement-dto.js';
export type DeliveryIssueDto = {
  id: string;
  rootRequestId: string;
  rootReceipt: DeliveryReceiptDto;
  salonId: string;
  salonName: string;
  status: DeliveryIssueStatus;
  revision: number;
  createdAt: string;
  items: {
    productId: string;
    productName: string;
    initialAffectedQuantity: number;
    replacementAcceptedQuantity: number;
    outstandingQuantity: number;
  }[];
  activeReplacement: DeliveryReplacementDto | null;
  replacements: DeliveryReplacementDto[];
  replacementOffset: number;
  hasMoreReplacements: boolean;
  events: DeliveryIssueEventDto[];
  eventOffset: number;
  hasMoreEvents: boolean;
};
