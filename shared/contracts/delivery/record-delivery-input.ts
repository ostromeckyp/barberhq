import type { DeliveryQuantities } from './delivery-quantities.js';
import type { ProcedureReference } from './procedure-reference.js';
export type RecordDeliveryInput = {
  requestId: string;
  expectedRevision: number;
  idempotencyKey: string;
  items: DeliveryQuantities[];
  report?: { description: string; batchIdentifier: string | null };
  procedureReferences: ProcedureReference[];
};
