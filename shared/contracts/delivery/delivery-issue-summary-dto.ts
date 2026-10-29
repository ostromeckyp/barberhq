import type { DeliveryIssueDto } from './delivery-issue-dto.js';
import type { DeliveryReplacementDto } from './delivery-replacement-dto.js';
export type DeliveryIssueSummaryDto = Pick<
  DeliveryIssueDto,
  'id' | 'rootRequestId' | 'salonId' | 'salonName' | 'status' | 'revision' | 'createdAt'
> & { outstandingQuantity: number; activeReplacement: DeliveryReplacementDto | null };
