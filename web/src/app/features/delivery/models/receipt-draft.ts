import type {
  DeliveryQuantities,
  ProcedureReference,
} from '../../../../../../shared/contracts/delivery/index';

export type ReceiptDraft = {
  items: DeliveryQuantities[];
  description: string;
  batchIdentifier: string;
  procedureReferences: ProcedureReference[];
};
