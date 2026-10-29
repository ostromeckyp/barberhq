import type { DeliveryProcedureDto } from './delivery-procedure-dto.js';
import type { DeliverySummaryDto } from './delivery-summary-dto.js';
import type { RequestDetail } from '../stock/request-detail.js';
export type DeliveryReceiptContextDto = {
  request: RequestDetail;
  summary: DeliverySummaryDto;
  procedures: DeliveryProcedureDto[];
};
