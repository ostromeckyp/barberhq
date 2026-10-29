import type { DeliveryQuantities } from './delivery-quantities.js';
import type { ProcedureReference } from './procedure-reference.js';
export type DeliveryReceiptDto = {
  id: string;
  requestId: string;
  recordedAt: string;
  actorLabel: string;
  origin: 'RECORDED' | 'LEGACY';
  items: (DeliveryQuantities & { productName: string })[];
  report: { description: string; batchIdentifier: string | null } | null;
  procedureReferences: ProcedureReference[];
  rootIssueId: string | null;
  legacyActionReceiptId: string | null;
};
