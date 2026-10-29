import type { DeliveryProblemKind } from './delivery-problem-kind.js';
import type { ProcedureReference } from './procedure-reference.js';
export type DeliveryProcedureDto = {
  kind: DeliveryProblemKind;
  documentId: string | null;
  revision: number;
  availability: 'AVAILABLE' | 'MISSING' | 'UNAVAILABLE';
  reference: ProcedureReference | null;
  title: string | null;
};
