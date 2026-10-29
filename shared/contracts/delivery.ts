export type DeliveryQuantities = {
  productId: string;
  goodQuantity: number;
  damagedQuantity: number;
  missingQuantity: number;
};
export type DeliveryProblemKind = 'DAMAGED' | 'MISSING';
export type ProcedureReference = { kind: DeliveryProblemKind; versionId: string; chunkId?: string };
export type RecordDeliveryInput = {
  requestId: string;
  expectedRevision: number;
  idempotencyKey: string;
  items: DeliveryQuantities[];
  report?: { description: string; batchIdentifier: string | null };
  procedureReferences: ProcedureReference[];
};
export type IssueTransitionInput = {
  issueId: string;
  expectedRevision: number;
  idempotencyKey: string;
};
export type AddIssueNoteInput = IssueTransitionInput & { text: string };
export type SetDeliveryProcedureInput = {
  kind: DeliveryProblemKind;
  documentId: string | null;
  expectedRevision: number;
  idempotencyKey: string;
};
export type DeliveryAction =
  | { type: 'RECORD_RECEIPT'; input: RecordDeliveryInput }
  | { type: 'START_REVIEW' | 'CREATE_REPLACEMENT'; input: IssueTransitionInput }
  | { type: 'ADD_NOTE'; input: AddIssueNoteInput }
  | { type: 'SET_PROCEDURE'; input: SetDeliveryProcedureInput };
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
export type DeliveryIssueStatus = 'OPEN' | 'IN_REVIEW' | 'REPLACEMENT_IN_PROGRESS' | 'RESOLVED';
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
export type DeliveryIssueEventDto = {
  id: string;
  revision: number;
  type:
    | 'OPENED'
    | 'REVIEW_STARTED'
    | 'NOTE_ADDED'
    | 'REPLACEMENT_CREATED'
    | 'REPLACEMENT_REJECTED'
    | 'REPLACEMENT_RECEIVED';
  recordedAt: string;
  actorLabel: string;
  requestId: string | null;
  note: string | null;
  status: DeliveryIssueStatus;
  quantities: DeliveryQuantities[];
};
export type DeliveryReplacementDto = {
  id: string;
  state: import('./stock.js').RequestState;
  createdAt: string;
};
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
export type DeliveryIssueSummaryDto = Pick<
  DeliveryIssueDto,
  'id' | 'rootRequestId' | 'salonId' | 'salonName' | 'status' | 'revision' | 'createdAt'
> & { outstandingQuantity: number; activeReplacement: DeliveryReplacementDto | null };
export type DeliverySummaryDto = {
  receipt: DeliveryReceiptDto | null;
  rootIssue: { id: string; status: DeliveryIssueStatus; revision: number } | null;
  replacementForIssueId: string | null;
  items: (DeliveryQuantities & { inTransit: number })[];
};
export type DeliveryProcedureDto = {
  kind: DeliveryProblemKind;
  documentId: string | null;
  revision: number;
  availability: 'AVAILABLE' | 'MISSING' | 'UNAVAILABLE';
  reference: ProcedureReference | null;
  title: string | null;
};
export type DeliveryReceiptContextDto = {
  request: import('./stock.js').RequestDetail;
  summary: DeliverySummaryDto;
  procedures: DeliveryProcedureDto[];
};
export type DeliveryIssuePageDto = {
  items: DeliveryIssueSummaryDto[];
  offset: number;
  hasMore: boolean;
  openCount: number;
};
