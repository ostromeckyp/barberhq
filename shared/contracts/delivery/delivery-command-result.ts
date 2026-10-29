export type DeliveryCommandResult = {
  commandId: string;
  requestId?: string;
  receiptId?: string;
  issueId?: string;
  replacementRequestId?: string;
  requestRevision?: number;
  issueRevision?: number;
  bindingRevision?: number;
  replayed: boolean;
};
