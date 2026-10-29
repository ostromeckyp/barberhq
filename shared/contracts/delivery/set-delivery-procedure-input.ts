import type { DeliveryProblemKind } from './delivery-problem-kind.js';
export type SetDeliveryProcedureInput = {
  kind: DeliveryProblemKind;
  documentId: string | null;
  expectedRevision: number;
  idempotencyKey: string;
};
