import { ConnectorConfig, DataConnect, OperationOptions, ExecuteOperationResponse } from 'firebase-admin/data-connect';

export const connectorConfig: ConnectorConfig;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;

export enum DeliveryCommandType {
  RECORD_RECEIPT = "RECORD_RECEIPT",
  START_REVIEW = "START_REVIEW",
  CREATE_REPLACEMENT = "CREATE_REPLACEMENT",
  ADD_NOTE = "ADD_NOTE",
  SET_PROCEDURE = "SET_PROCEDURE",
}
export enum DeliveryIssueEventType {
  OPENED = "OPENED",
  REVIEW_STARTED = "REVIEW_STARTED",
  NOTE_ADDED = "NOTE_ADDED",
  REPLACEMENT_CREATED = "REPLACEMENT_CREATED",
  REPLACEMENT_REJECTED = "REPLACEMENT_REJECTED",
  REPLACEMENT_RECEIVED = "REPLACEMENT_RECEIVED",
}
export enum DeliveryIssueStatus {
  OPEN = "OPEN",
  IN_REVIEW = "IN_REVIEW",
  REPLACEMENT_IN_PROGRESS = "REPLACEMENT_IN_PROGRESS",
  RESOLVED = "RESOLVED",
}
export enum DeliveryProblemKind {
  DAMAGED = "DAMAGED",
  MISSING = "MISSING",
}
export enum KnowledgeDocumentKind {
  PROCEDURE = "PROCEDURE",
  POLICY = "POLICY",
  PRODUCT_CARD = "PRODUCT_CARD",
  PRODUCT_CATALOG = "PRODUCT_CATALOG",
}
export enum KnowledgeOrigin {
  OFFICIAL = "OFFICIAL",
  PUBLIC_COMPILATION = "PUBLIC_COMPILATION",
  SYNTHETIC = "SYNTHETIC",
}
export enum KnowledgePageQuality {
  COMPLETE = "COMPLETE",
  NEEDS_REVIEW = "NEEDS_REVIEW",
}
export enum KnowledgePendingStage {
  EXTRACT = "EXTRACT",
  PUBLISH = "PUBLISH",
}
export enum KnowledgeProcessingStatus {
  STAGED = "STAGED",
  EXTRACTED = "EXTRACTED",
  REVIEWED = "REVIEWED",
  EMBEDDED = "EMBEDDED",
  READY = "READY",
  NEEDS_REVIEW = "NEEDS_REVIEW",
  FAILED = "FAILED",
}
export enum KnowledgePublicationStatus {
  DEMO_CURRENT = "DEMO_CURRENT",
  RETIRED = "RETIRED",
}
export enum KnowledgeSourceType {
  SYNTHETIC_PROCEDURE = "SYNTHETIC_PROCEDURE",
  PUBLIC_PRODUCT_SUMMARY = "PUBLIC_PRODUCT_SUMMARY",
}
export enum LocationKind {
  HQ = "HQ",
  SALON = "SALON",
}
export enum MemberRole {
  HQ = "HQ",
  SALON = "SALON",
}
export enum MovementType {
  DISPATCH = "DISPATCH",
  RECEIPT = "RECEIPT",
}
export enum ProductAliasKind {
  NAME = "NAME",
  TYPE = "TYPE",
  PHONETIC = "PHONETIC",
}
export enum ProductAliasSource {
  GENERATED = "GENERATED",
  HQ = "HQ",
  SALON_CONFIRMED = "SALON_CONFIRMED",
  SEED = "SEED",
}
export enum ProductAliasStatus {
  PROPOSED = "PROPOSED",
  ACTIVE = "ACTIVE",
  REJECTED = "REJECTED",
  RETIRED = "RETIRED",
}
export enum RequestState {
  PENDING_APPROVAL = "PENDING_APPROVAL",
  RESERVED = "RESERVED",
  DISPATCHED = "DISPATCHED",
  RECEIVED = "RECEIVED",
  REJECTED = "REJECTED",
  RECEIVED_WITH_ISSUE = "RECEIVED_WITH_ISSUE",
}
export enum StockActionType {
  SUBMIT = "SUBMIT",
  APPROVE = "APPROVE",
  REJECT = "REJECT",
  DISPATCH = "DISPATCH",
  RECEIVE = "RECEIVE",
}

export interface AcceptProductKnowledgeSnapshotData {
  result?: number | null;
}

export interface AcceptProductKnowledgeSnapshotVariables {
  uid: string;
  businessId: string;
  versionId: string;
  extractionHash: string;
  revision: number;
  catalogRevision: number;
  reviewedHash: string;
  operationJson: string;
}

export interface ActionKey_Key {
  businessId: string;
  actorUid: string;
  idempotencyKey: string;
  __typename?: 'ActionKey_Key';
}

export interface ActionReceipt_Key {
  id: string;
  __typename?: 'ActionReceipt_Key';
}

export interface ActiveRequest_Key {
  businessId: string;
  salonId: string;
  productId: string;
  __typename?: 'ActiveRequest_Key';
}

export interface AdmitAiWindowData {
  admitted?: unknown | null;
}

export interface AdmitAiWindowVariables {
  uid: string;
  businessId: string;
  role: MemberRole;
}

export interface AiUsageWindow_Key {
  uid: string;
  hourStart: TimestampString;
  __typename?: 'AiUsageWindow_Key';
}

export interface ApplyProductAliasSeedData {
  result?: number | null;
}

export interface ApplyProductAliasSeedVariables {
  businessId: string;
  expectedRevision: number;
  aliasesJson: string;
  retireJson: string;
  productsJson: string;
}

export interface ApproveStockData {
  changed: number;
  transfer_insert: Transfer_Key;
  update0: number;
  transfer0: TransferItem_Key;
  update1: number;
  transfer1: TransferItem_Key;
  update2: number;
  transfer2: TransferItem_Key;
  update3: number;
  transfer3: TransferItem_Key;
  update4: number;
  transfer4: TransferItem_Key;
  update5: number;
  transfer5: TransferItem_Key;
  actionReceipt_insert: ActionReceipt_Key;
  actionKey_insert: ActionKey_Key;
}

export interface ApproveStockVariables {
  uid: string;
  businessId: string;
  requestId: string;
  receiptId: string;
  key: string;
  payloadHash: string;
  semanticHash: string;
  revision: number;
  count: number;
  inventoryVersions: number[];
  use0: boolean;
  use1: boolean;
  use2: boolean;
  use3: boolean;
  use4: boolean;
  use5: boolean;
}

export interface BackfillKnowledgeCursorData {
  initial: number;
  progressed: number;
}

export interface BackfillKnowledgeCursorVariables {
  businessId: string;
  documentId: string;
  expected?: number | null;
  target: number;
  initialize: boolean;
  advance: boolean;
}

export interface BackfillKnowledgeMetadataData {
  knowledgeVersion_updateMany: number;
}

export interface BackfillKnowledgeMetadataVariables {
  businessId: string;
  versionId: string;
  expectedSourceType?: KnowledgeSourceType | null;
  expectedSynthetic: boolean;
  kind: KnowledgeDocumentKind;
  origin: KnowledgeOrigin;
}

export interface BeginKnowledgeExtractionData {
  knowledgeVersion_updateMany: number;
  knowledgeChunk_deleteMany: number;
  knowledgePage_deleteMany: number;
}

export interface BeginKnowledgeExtractionVariables {
  versionId: string;
  revision: number;
  pdfSha256: string;
  now: TimestampString;
}

export interface BindKnowledgeOriginalData {
  knowledgeVersion_updateMany: number;
}

export interface BindKnowledgeOriginalVariables {
  uid: string;
  businessId: string;
  versionId: string;
  pdfSha256: string;
  bucket: string;
  objectPath: string;
  objectGeneration: string;
  byteSize: number;
  pageCount: number;
}

export interface BindReplayKeyData {
  actionKey_insert: ActionKey_Key;
}

export interface BindReplayKeyVariables {
  uid: string;
  businessId: string;
  receiptId: string;
  key: string;
  payloadHash: string;
}

export interface Business_Key {
  id: string;
  __typename?: 'Business_Key';
}

export interface ChangeDeliveryIssueData {
  changed: number;
  deliveryIssueEvent_insert: DeliveryIssueEvent_Key;
  deliveryCommandReceipt_insert: DeliveryCommandReceipt_Key;
  deliveryActionKey_insert: DeliveryActionKey_Key;
}

export interface ChangeDeliveryIssueVariables {
  uid: string;
  businessId: string;
  issueId: string;
  revision: number;
  commandId: string;
  key: string;
  payloadHash: string;
  result: unknown;
  type: DeliveryCommandType;
  eventType: DeliveryIssueEventType;
  status: DeliveryIssueStatus;
  note?: string | null;
}

export interface ClaimKnowledgeExtractionData {
  knowledgeVersion_updateMany: number;
  knowledgeChunk_deleteMany: number;
  knowledgePage_deleteMany: number;
}

export interface ClaimKnowledgeExtractionVariables {
  versionId: string;
  revision: number;
  expectedDocumentRevision: number;
  pdfSha256: string;
  leaseId: string;
  now: TimestampString;
  expiresAt: TimestampString;
}

export interface ClaimProductKnowledgeGenerationData {
  result?: number | null;
}

export interface ClaimProductKnowledgeGenerationVariables {
  uid: string;
  businessId: string;
  versionId: string;
  revision: number;
  catalogRevision: number;
  extractionHash: string;
  operationJson: string;
  leaseSeconds: number;
}

export interface CompleteKnowledgeRetryData {
  knowledgeOperation_updateMany: number;
}

export interface CompleteKnowledgeRetryVariables {
  uid: string;
  businessId: string;
  operationId: string;
  versionId: string;
}

export interface CompleteKnowledgeReviewData {
  knowledgeOperation_updateMany: number;
}

export interface CompleteKnowledgeReviewVariables {
  uid: string;
  businessId: string;
  operationId: string;
  versionId: string;
}

export interface ConfirmSalonShorthandData {
  result?: number | null;
}

export interface ConfirmSalonShorthandVariables {
  uid: string;
  businessId: string;
  salonId: string;
  expectedSalonRevision: number;
  writesJson: string;
  consumeJson: string;
}

export interface CreateDeliveryReplacementData {
  claim: number;
  replenishmentRequest_insert: ReplenishmentRequest_Key;
  item0: RequestItem_Key;
  active0: ActiveRequest_Key;
  item1: RequestItem_Key;
  active1: ActiveRequest_Key;
  item2: RequestItem_Key;
  active2: ActiveRequest_Key;
  item3: RequestItem_Key;
  active3: ActiveRequest_Key;
  item4: RequestItem_Key;
  active4: ActiveRequest_Key;
  item5: RequestItem_Key;
  active5: ActiveRequest_Key;
  pointer: number;
  deliveryIssueEvent_insert: DeliveryIssueEvent_Key;
  deliveryCommandReceipt_insert: DeliveryCommandReceipt_Key;
  deliveryActionKey_insert: DeliveryActionKey_Key;
}

export interface CreateDeliveryReplacementVariables {
  uid: string;
  businessId: string;
  issueId: string;
  revision: number;
  salonId: string;
  requestId: string;
  commandId: string;
  key: string;
  payloadHash: string;
  result: unknown;
  productIds: string[];
  itemIds: string[];
  quantities: number[];
  count: number;
  use0: boolean;
  use1: boolean;
  use2: boolean;
  use3: boolean;
  use4: boolean;
  use5: boolean;
}

export interface CreateProductAdminData {
  result?: number | null;
}

export interface CreateProductAdminVariables {
  uid: string;
  productId: string;
  demoId: string;
  formJson: string;
  hqOnHand: number;
  operationId: string;
  key: string;
  payloadHash: string;
}

export interface DeletePushTokenData {
  result?: number | null;
}

export interface DeletePushTokenVariables {
  uid: string;
  token: string;
}

export interface DeletePushTokensData {
  result?: number | null;
}

export interface DeletePushTokensVariables {
  tokens: string[];
}

export interface DeliveryActionKey_Key {
  businessId: string;
  actorUid: string;
  idempotencyKey: string;
  __typename?: 'DeliveryActionKey_Key';
}

export interface DeliveryCommandReceipt_Key {
  id: string;
  __typename?: 'DeliveryCommandReceipt_Key';
}

export interface DeliveryIssueEvent_Key {
  id: string;
  __typename?: 'DeliveryIssueEvent_Key';
}

export interface DeliveryIssueItem_Key {
  issueId: string;
  productId: string;
  __typename?: 'DeliveryIssueItem_Key';
}

export interface DeliveryIssue_Key {
  id: string;
  __typename?: 'DeliveryIssue_Key';
}

export interface DeliveryProcedureBinding_Key {
  businessId: string;
  kind: DeliveryProblemKind;
  __typename?: 'DeliveryProcedureBinding_Key';
}

export interface DeliveryReceiptItem_Key {
  receiptId: string;
  productId: string;
  __typename?: 'DeliveryReceiptItem_Key';
}

export interface DeliveryReceiptProcedure_Key {
  receiptId: string;
  kind: DeliveryProblemKind;
  __typename?: 'DeliveryReceiptProcedure_Key';
}

export interface DeliveryReceipt_Key {
  id: string;
  __typename?: 'DeliveryReceipt_Key';
}

export interface DispatchStockData {
  changed: number;
  update0: number;
  transfer0: number;
  movement0: StockMovement_Key;
  update1: number;
  transfer1: number;
  movement1: StockMovement_Key;
  update2: number;
  transfer2: number;
  movement2: StockMovement_Key;
  update3: number;
  transfer3: number;
  movement3: StockMovement_Key;
  update4: number;
  transfer4: number;
  movement4: StockMovement_Key;
  update5: number;
  transfer5: number;
  movement5: StockMovement_Key;
  actionReceipt_insert: ActionReceipt_Key;
  actionKey_insert: ActionKey_Key;
}

export interface DispatchStockVariables {
  uid: string;
  businessId: string;
  requestId: string;
  receiptId: string;
  key: string;
  payloadHash: string;
  semanticHash: string;
  revision: number;
  count: number;
  use0: boolean;
  use1: boolean;
  use2: boolean;
  use3: boolean;
  use4: boolean;
  use5: boolean;
}

export interface FailKnowledgeExtractionData {
  knowledgeVersion_updateMany: number;
}

export interface FailKnowledgeExtractionVariables {
  versionId: string;
  revision: number;
  pdfSha256: string;
  leaseId: string;
  errorCode: string;
}

export interface HqStockAdjustment_Key {
  id: string;
  __typename?: 'HqStockAdjustment_Key';
}

export interface InsertInventoryData {
  inventory_insert: Inventory_Key;
}

export interface InsertInventoryVariables {
  locationId: string;
  productId: string;
  onHand: number;
}

export interface InsertKnowledgePageData {
  knowledgePage_insert: KnowledgePage_Key;
}

export interface InsertKnowledgePageVariables {
  versionId: string;
  revision: number;
  pdfSha256: string;
  leaseId?: string | null;
  physicalPage: number;
  text: string;
  markdown: string;
  spans: unknown;
  quality: KnowledgePageQuality;
  viewBox: unknown;
  userUnit: number;
  rotation: number;
}

export interface InsertLegacyDeliveryReceiptData {
  deliveryReceipt_insert: DeliveryReceipt_Key;
}

export interface InsertLegacyDeliveryReceiptVariables {
  id: string;
  businessId: string;
  requestId: string;
  transferRequestId: string;
  salonId: string;
  actorUid: string;
  recordedAt: TimestampString;
  legacyActionReceiptId: string;
}

export interface InsertSalonSettingsData {
  salonSettings_insert: SalonSettings_Key;
}

export interface InsertSalonSettingsVariables {
  salonId: string;
}

export interface Inventory_Key {
  locationId: string;
  productId: string;
  __typename?: 'Inventory_Key';
}

export interface IssueReplenishmentChoiceReceiptsData {
  result?: number | null;
}

export interface IssueReplenishmentChoiceReceiptsVariables {
  uid: string;
  businessId: string;
  salonId: string;
  catalogRevision: number;
  receiptsJson: string;
}

export interface KnowledgeChunk_Key {
  id: string;
  __typename?: 'KnowledgeChunk_Key';
}

export interface KnowledgeCommandContextData {
  membership?: {
    businessId: string;
    role: MemberRole;
    business: {
      operations: ({
        id: string;
        businessId: string;
        actorUid: string;
        idempotencyKey: string;
        action: KnowledgeOperationAction;
        retryStage?: KnowledgePendingStage | null;
        payloadHash: string;
        documentId: string;
        versionId: string;
        completedAt?: TimestampString | null;
      } & KnowledgeOperation_Key)[];
    };
  };
  knowledgeDocument?: {
    id: string;
    businessId: string;
    documentCode: string;
    activeVersionId?: string | null;
    revision: number;
    nextVersionNumber?: number | null;
  } & KnowledgeDocument_Key;
  knowledgeVersion?: {
    id: string;
    businessId: string;
    documentId: string;
    versionLabel: string;
    status: KnowledgeProcessingStatus;
    revision: number;
    revokedAt?: TimestampString | null;
    publishedAt?: TimestampString | null;
    isActive: boolean;
    pdfSha256: string;
    pendingStage?: KnowledgePendingStage | null;
    processingError?: string | null;
    document: {
      activeVersionId?: string | null;
      revision: number;
    };
  } & KnowledgeVersion_Key;
}

export interface KnowledgeCommandContextVariables {
  uid: string;
  key: string;
  documentId: string;
  versionId: string;
}

export interface KnowledgeCursorBusinessData {
  business?: {
    id: string;
  } & Business_Key;
}

export interface KnowledgeCursorBusinessVariables {
  businessId: string;
}

export interface KnowledgeCursorDocumentsData {
  knowledgeDocuments: ({
    id: string;
    businessId: string;
    nextVersionNumber?: number | null;
  } & KnowledgeDocument_Key)[];
}

export interface KnowledgeCursorDocumentsVariables {
  businessId: string;
  after: string;
  limit: number;
}

export interface KnowledgeCursorLabelsData {
  knowledgeVersions: ({
    versionLabel: string;
  })[];
}

export interface KnowledgeCursorLabelsVariables {
  documentId: string;
  after: string;
  limit: number;
}

export interface KnowledgeDocumentStateData {
  knowledgeDocument?: {
    id: string;
    businessId: string;
    documentCode: string;
    activeVersionId?: string | null;
    revision: number;
    nextVersionNumber?: number | null;
  } & KnowledgeDocument_Key;
}

export interface KnowledgeDocumentStateVariables {
  documentId: string;
}

export interface KnowledgeDocument_Key {
  id: string;
  __typename?: 'KnowledgeDocument_Key';
}

export interface KnowledgeMetadataPageData {
  rows?: unknown[] | null;
}

export interface KnowledgeMetadataPageVariables {
  businessId: string;
  after: string;
  limit: number;
}

export interface KnowledgeOperation_Key {
  id: string;
  __typename?: 'KnowledgeOperation_Key';
}

export interface KnowledgePage_Key {
  versionId: string;
  physicalPage: number;
  __typename?: 'KnowledgePage_Key';
}

export interface KnowledgeProductLink_Key {
  id: string;
  __typename?: 'KnowledgeProductLink_Key';
}

export interface KnowledgeProductProfile_Key {
  versionId: string;
  productId: string;
  __typename?: 'KnowledgeProductProfile_Key';
}

export interface KnowledgeVersionStateData {
  knowledgeVersion?: {
    id: string;
    documentId: string;
    businessId: string;
    versionLabel: string;
    title: string;
    language: string;
    sourceType?: KnowledgeSourceType | null;
    kind?: KnowledgeDocumentKind | null;
    origin?: KnowledgeOrigin | null;
    synthetic: boolean;
    sourceUrls: unknown;
    observedOn?: DateString | null;
    status: KnowledgeProcessingStatus;
    publicationStatus: KnowledgePublicationStatus;
    revision: number;
    isActive: boolean;
    bucket?: string | null;
    objectPath?: string | null;
    objectGeneration?: string | null;
    pdfSha256: string;
    contentType?: string | null;
    byteSize?: number | null;
    pageCount?: number | null;
    uploadedAt?: TimestampString | null;
    pendingStage?: KnowledgePendingStage | null;
    pendingDocumentRevision?: number | null;
    pendingExtractionHash?: string | null;
    productKnowledgeRevision: number;
    productKnowledgeReviewedHash?: string | null;
    productKnowledgeCatalogRevision?: number | null;
    pendingProductKnowledgeRevision?: number | null;
    pendingProductKnowledgeReviewedHash?: string | null;
    pendingProductKnowledgeCatalogRevision?: number | null;
    processingLeaseId?: string | null;
    processingLeaseExpiresAt?: TimestampString | null;
    parserVersion?: string | null;
    extractionHash?: string | null;
    embeddingConfigHash?: string | null;
    expectedChunkCount?: number | null;
    reviewedBy?: string | null;
    reviewedAt?: TimestampString | null;
    reviewedPageCount: number;
    publishedAt?: TimestampString | null;
    revokedAt?: TimestampString | null;
    processingError?: string | null;
    processingAttempt: number;
    document: {
      id: string;
      businessId: string;
      documentCode: string;
      activeVersionId?: string | null;
      revision: number;
      nextVersionNumber?: number | null;
    } & KnowledgeDocument_Key;
    pages: ({
      physicalPage: number;
      text: string;
      markdown: string;
      spans: unknown;
      quality: KnowledgePageQuality;
      reviewed: boolean;
      viewBox: unknown;
      userUnit: number;
      rotation: number;
    })[];
    chunks: ({
      id: string;
      physicalPage: number;
      ordinal: number;
      sectionId: string;
      heading: string;
      text: string;
      start: number;
      end: number;
      rects: unknown;
      geometryStatus: KnowledgeGeometryStatus;
      embeddingModel: string;
      embeddingDimension: number;
      embeddingConfigHash: string;
    } & KnowledgeChunk_Key)[];
  } & KnowledgeVersion_Key;
}

export interface KnowledgeVersionStateVariables {
  versionId: string;
}

export interface KnowledgeVersion_Key {
  id: string;
  __typename?: 'KnowledgeVersion_Key';
}

export interface Location_Key {
  id: string;
  __typename?: 'Location_Key';
}

export interface MarkKnowledgePageReviewedData {
  knowledgePage_updateMany: number;
}

export interface MarkKnowledgePageReviewedVariables {
  versionId: string;
  physicalPage: number;
  extractionHash: string;
}

export interface MarkKnowledgePublishStaleData {
  result?: number | null;
}

export interface MarkKnowledgePublishStaleVariables {
  versionId: string;
  revision: number;
  expectedDocumentRevision: number;
  extractionHash: string;
}

export interface MarkKnowledgeReadyData {
  knowledgeVersion_updateMany: number;
}

export interface MarkKnowledgeReadyVariables {
  versionId: string;
  revision: number;
  configHash: string;
  chunkCount: number;
}

export interface Membership_Key {
  uid: string;
  __typename?: 'Membership_Key';
}

export interface ProductAdminOperation_Key {
  id: string;
  __typename?: 'ProductAdminOperation_Key';
}

export interface ProductAlias_Key {
  id: string;
  __typename?: 'ProductAlias_Key';
}

export interface ProductCardAttachment_Key {
  productId: string;
  __typename?: 'ProductCardAttachment_Key';
}

export interface ProductKnowledgeActiveAliasPageData {
  rows?: unknown[] | null;
}

export interface ProductKnowledgeActiveAliasPageVariables {
  uid: string;
  versionId: string;
  after: string;
  limit: number;
}

export interface ProductKnowledgeCatalogPageData {
  rows?: unknown[] | null;
}

export interface ProductKnowledgeCatalogPageVariables {
  uid: string;
  versionId: string;
  after: string;
  limit: number;
}

export interface ProductKnowledgeOperation_Key {
  id: string;
  __typename?: 'ProductKnowledgeOperation_Key';
}

export interface ProductKnowledgeStateData {
  result?: unknown | null;
}

export interface ProductKnowledgeStateVariables {
  uid: string;
  versionId: string;
  key: string;
}

export interface Product_Key {
  id: string;
  __typename?: 'Product_Key';
}

export interface PublishKnowledgeVersionData {
  result?: number | null;
}

export interface PublishKnowledgeVersionVariables {
  versionId: string;
  documentId: string;
  businessId: string;
  expectedDocumentRevision: number;
  versionRevision: number;
  extractionHash: string;
  configHash: string;
}

export interface PushRecipientsData {
  request?: unknown[] | null;
  tokens?: unknown[] | null;
}

export interface PushRecipientsVariables {
  requestId: string;
}

export interface PushToken_Key {
  token: string;
  __typename?: 'PushToken_Key';
}

export interface ReadAiActorData {
  membership?: {
    uid: string;
    businessId: string;
    role: MemberRole;
    salonAccesses_on_membership: ({
      locationId: string;
      location: {
        businessId: string;
        kind: LocationKind;
      };
    })[];
  } & Membership_Key;
}

export interface ReadAiActorVariables {
  uid: string;
}

export interface ReadAiCurrentWindowData {
  window?: unknown | null;
}

export interface ReadAiCurrentWindowVariables {
  uid: string;
}

export interface ReadCollisionAliasesData {
  rows?: unknown[] | null;
}

export interface ReadCollisionAliasesVariables {
  uid: string;
}

export interface ReadCollisionProductsData {
  rows?: unknown[] | null;
}

export interface ReadCollisionProductsVariables {
  uid: string;
}

export interface ReadDeliveryBindingsData {
  membership?: {
    uid: string;
    businessId: string;
    role: MemberRole;
    business: {
      bindings: ({
        kind: DeliveryProblemKind;
        documentId?: string | null;
        revision: number;
        document?: {
          id: string;
          businessId: string;
          documentCode: string;
          activeVersionId?: string | null;
          versions: ({
            id: string;
            title: string;
            businessId: string;
            status: KnowledgeProcessingStatus;
            publishedAt?: TimestampString | null;
            revokedAt?: TimestampString | null;
          } & KnowledgeVersion_Key)[];
        } & KnowledgeDocument_Key;
      })[];
    };
  } & Membership_Key;
}

export interface ReadDeliveryBindingsVariables {
  uid: string;
}

export interface ReadDeliveryContextData {
  membership?: {
    uid: string;
    businessId: string;
    role: MemberRole;
    salonAccesses_on_membership: ({
      locationId: string;
    })[];
  } & Membership_Key;
  replenishmentRequest?: {
    id: string;
    businessId: string;
    salonId: string;
    state: RequestState;
    revision: number;
    replacementIssueId?: string | null;
    salon: {
      kind: LocationKind;
      businessId: string;
    };
    items: ({
      id: string;
      productId: string;
      quantity: number;
      product: {
        businessId: string;
        inventories_on_product: ({
          locationId: string;
          onHand: number;
          reserved: number;
          version: number;
        })[];
      };
      transferItem?: {
        requestItemId: string;
        quantity: number;
        dispatchedQuantity: number;
        receivedQuantity: number;
      } & TransferItem_Key;
    } & RequestItem_Key)[];
    transfer?: {
      requestId: string;
      businessId: string;
      warehouseId: string;
      destinationId: string;
    } & Transfer_Key;
    receipt?: {
      id: string;
      requestId: string;
      recordedAt: TimestampString;
      actorUid: string;
      origin: DeliveryReceiptOrigin;
      legacyActionReceiptId?: string | null;
      description?: string | null;
      batchIdentifier?: string | null;
      rootIssueId?: string | null;
      items: ({
        productId: string;
        goodQuantity: number;
        damagedQuantity: number;
        missingQuantity: number;
        product: {
          name: string;
        };
      })[];
      procedureReferences: ({
        kind: DeliveryProblemKind;
        versionId: string;
        chunkId?: string | null;
      })[];
      rootIssue?: {
        id: string;
        status: DeliveryIssueStatus;
        revision: number;
      } & DeliveryIssue_Key;
    } & DeliveryReceipt_Key;
    replacementIssue?: {
      id: string;
      rootRequestId: string;
      salonId: string;
      status: DeliveryIssueStatus;
      revision: number;
      createdAt: TimestampString;
      salon: {
        name: string;
      };
      items: ({
        productId: string;
        initialAffectedQuantity: number;
        replacementAcceptedQuantity: number;
        product: {
          name: string;
        };
      })[];
      activeReplacement?: {
        id: string;
        state: RequestState;
        createdAt: TimestampString;
      } & ReplenishmentRequest_Key;
      businessId: string;
      activeReplacementRequestId?: string | null;
    } & DeliveryIssue_Key;
  } & ReplenishmentRequest_Key;
}

export interface ReadDeliveryContextVariables {
  uid: string;
  requestId: string;
}

export interface ReadDeliveryKeyData {
  deliveryActionKey?: {
    payloadHash: string;
    command: {
      id: string;
      businessId: string;
      actorUid: string;
      type: DeliveryCommandType;
      target: string;
      payloadHash: string;
      result: unknown;
    } & DeliveryCommandReceipt_Key;
  };
}

export interface ReadDeliveryKeyVariables {
  uid: string;
  businessId: string;
  key: string;
}

export interface ReadDeliveryProcedureDocumentData {
  knowledgeDocument?: {
    id: string;
    businessId: string;
    activeVersionId?: string | null;
    versions: ({
      id: string;
      title: string;
      businessId: string;
      status: KnowledgeProcessingStatus;
      publishedAt?: TimestampString | null;
      revokedAt?: TimestampString | null;
    } & KnowledgeVersion_Key)[];
  } & KnowledgeDocument_Key;
}

export interface ReadDeliveryProcedureDocumentVariables {
  businessId: string;
  documentId: string;
}

export interface ReadIssueContextData {
  membership?: {
    uid: string;
    businessId: string;
    role: MemberRole;
    salonAccesses_on_membership: ({
      locationId: string;
    })[];
    business: {
      locations_on_business: ({
        id: string;
      } & Location_Key)[];
    };
  } & Membership_Key;
  deliveryIssue?: {
    id: string;
    rootRequestId: string;
    salonId: string;
    status: DeliveryIssueStatus;
    revision: number;
    createdAt: TimestampString;
    salon: {
      name: string;
    };
    items: ({
      productId: string;
      initialAffectedQuantity: number;
      replacementAcceptedQuantity: number;
      product: {
        name: string;
      };
    })[];
    activeReplacement?: {
      id: string;
      state: RequestState;
      createdAt: TimestampString;
    } & ReplenishmentRequest_Key;
    businessId: string;
    activeReplacementRequestId?: string | null;
    rootReceiptId: string;
    rootReceipt: {
      id: string;
      requestId: string;
      recordedAt: TimestampString;
      actorUid: string;
      origin: DeliveryReceiptOrigin;
      legacyActionReceiptId?: string | null;
      description?: string | null;
      batchIdentifier?: string | null;
      rootIssueId?: string | null;
      items: ({
        productId: string;
        goodQuantity: number;
        damagedQuantity: number;
        missingQuantity: number;
        product: {
          name: string;
        };
      })[];
      procedureReferences: ({
        kind: DeliveryProblemKind;
        versionId: string;
        chunkId?: string | null;
      })[];
      rootIssue?: {
        id: string;
        status: DeliveryIssueStatus;
        revision: number;
      } & DeliveryIssue_Key;
    } & DeliveryReceipt_Key;
  } & DeliveryIssue_Key;
}

export interface ReadIssueContextVariables {
  uid: string;
  issueId: string;
}

export interface ReadKnowledgeWipeCountsData {
  documents: ({
    _count: number;
  })[];
  versions: ({
    _count: number;
  })[];
  chunks: ({
    _count: number;
  })[];
  cardAttachments: ({
    _count: number;
  })[];
  documentAliases: ({
    _count: number;
  })[];
}

export interface ReadKnowledgeWipeCountsVariables {
  businessId: string;
}

export interface ReadMembershipData {
  membership?: {
    uid: string;
    businessId: string;
    role: MemberRole;
  } & Membership_Key;
}

export interface ReadMembershipVariables {
  uid: string;
}

export interface ReadProductAdminData {
  rows?: unknown[] | null;
}

export interface ReadProductAdminOperationData {
  productAdminOperations: ({
    action: string;
    payloadHash: string;
    result: unknown;
  })[];
}

export interface ReadProductAdminOperationVariables {
  uid: string;
  key: string;
}

export interface ReadProductAdminScopeData {
  membership?: {
    role: MemberRole;
    businessId: string;
  };
}

export interface ReadProductAdminScopeVariables {
  uid: string;
}

export interface ReadProductAdminVariables {
  uid: string;
  productId: string;
}

export interface ReadProductAliasRevisionsData {
  rows?: unknown[] | null;
}

export interface ReadProductAliasRevisionsVariables {
  uid: string;
  productId: string;
  idsJson: string;
}

export interface ReadProductAliasSeedStateData {
  business?: {
    productKnowledgeRevision: number;
  };
  products: ({
    id: string;
    demoId: string;
    seedType?: string | null;
    keywords?: string[] | null;
    typeSourceVersionId?: string | null;
  } & Product_Key)[];
  productAliases: ({
    id: string;
    productId: string;
    phrase: string;
    normalized: string;
    kind: ProductAliasKind;
    lang: string;
    source: ProductAliasSource;
    status: ProductAliasStatus;
    overriddenByHq: boolean;
  } & ProductAlias_Key)[];
}

export interface ReadProductAliasSeedStateVariables {
  businessId: string;
}

export interface ReadProductAliasesData {
  rows?: unknown[] | null;
}

export interface ReadProductAliasesVariables {
  uid: string;
  productId: string;
}

export interface ReadProductCardAttachmentData {
  rows?: unknown[] | null;
}

export interface ReadProductCardAttachmentVariables {
  uid: string;
  productId: string;
}

export interface ReadProductCodeOwnerData {
  rows?: unknown[] | null;
}

export interface ReadProductCodeOwnerVariables {
  uid: string;
  sourceCode: string;
}

export interface ReadReplacementSlotsData {
  activeRequests: ({
    productId: string;
    requestId: string;
  })[];
}

export interface ReadReplacementSlotsVariables {
  businessId: string;
  salonId: string;
  productIds: string[];
}

export interface ReadReplenishmentAliasPageData {
  rows?: unknown[] | null;
}

export interface ReadReplenishmentAliasPageVariables {
  businessId: string;
  after: string;
  limit: number;
}

export interface ReadReplenishmentProductPageData {
  rows?: unknown[] | null;
}

export interface ReadReplenishmentProductPageVariables {
  businessId: string;
  salonId: string;
  after: string;
  limit: number;
}

export interface ReadReplenishmentSalonAliasPageData {
  rows?: unknown[] | null;
}

export interface ReadReplenishmentSalonAliasPageVariables {
  businessId: string;
  salonId: string;
  after: string;
  limit: number;
}

export interface ReadReplenishmentSnapshotHeaderData {
  membership?: {
    businessId: string;
    role: MemberRole;
    salonAccesses_on_membership: ({
      locationId: string;
    })[];
  };
  location?: {
    id: string;
    businessId: string;
    kind: LocationKind;
    productAliasRevision: number;
  } & Location_Key;
  business?: {
    productKnowledgeRevision: number;
  };
}

export interface ReadReplenishmentSnapshotHeaderVariables {
  uid: string;
  businessId: string;
  role: MemberRole;
  salonId: string;
}

export interface ReadResetCountsData {
  deliveryReceipts: ({
    _count: number;
  })[];
  deliveryItems: ({
    _count: number;
  })[];
  deliveryIssues: ({
    _count: number;
  })[];
  deliveryIssueItems: ({
    _count: number;
  })[];
  deliveryEvents: ({
    _count: number;
  })[];
  deliveryReferences: ({
    _count: number;
  })[];
  deliveryKeys: ({
    _count: number;
  })[];
  deliveryCommands: ({
    _count: number;
  })[];
  requests: ({
    _count: number;
  })[];
  active: ({
    _count: number;
  })[];
  items: ({
    _count: number;
  })[];
  transferItems: ({
    _count: number;
  })[];
  transfers: ({
    _count: number;
  })[];
  movements: ({
    _count: number;
  })[];
  receipts: ({
    _count: number;
  })[];
  keys: ({
    _count: number;
  })[];
  inventories: ({
    _count: number;
  })[];
}

export interface ReadResetCountsVariables {
  businessId: string;
}

export interface ReadSalonAliasOperationData {
  salonAliasOperations: ({
    payloadHash: string;
    result: unknown;
  })[];
}

export interface ReadSalonAliasOperationVariables {
  uid: string;
  key: string;
}

export interface ReadSalonShorthandConfirmationData {
  rows?: unknown[] | null;
}

export interface ReadSalonShorthandConfirmationVariables {
  uid: string;
  businessId: string;
  salonId: string;
  receiptIdsJson: string;
}

export interface ReadSalonShorthandScopeData {
  membership?: {
    businessId: string;
    role: MemberRole;
    salonAccesses_on_membership: ({
      locationId: string;
    })[];
  };
  productAlias?: {
    businessId: string;
    salonId?: string | null;
    source: ProductAliasSource;
    status: ProductAliasStatus;
    revision: number;
  };
}

export interface ReadSalonShorthandScopeVariables {
  uid: string;
  salonId: string;
  aliasId: string;
}

export interface ReadSeedStateData {
  business?: {
    id: string;
    name: string;
  } & Business_Key;
  salonSettings: ({
    salonId: string;
    lowStockThreshold: number;
    version: number;
    updatedAt: TimestampString;
  } & SalonSettings_Key)[];
  locations: ({
    id: string;
    key: string;
  } & Location_Key)[];
  products: ({
    id: string;
    demoId: string;
    hqUpdatedAt?: TimestampString | null;
  } & Product_Key)[];
  inventories: ({
    locationId: string;
    productId: string;
    onHand: number;
    reserved: number;
    version: number;
  } & Inventory_Key)[];
}

export interface ReadSeedStateVariables {
  businessId: string;
}

export interface RecheckProcedureSourcesData {
  result?: unknown | null;
}

export interface RecheckProcedureSourcesVariables {
  uid: string;
  businessId: string;
  role: string;
  sourceJson: string;
  salonJson: string;
  kindsJson: string;
}

export interface RecordDeliveryTransactionData {
  changed: number;
  issueClaim: number;
  deliveryReceipt_insert: DeliveryReceipt_Key;
  deliveryIssue_insert: DeliveryIssue_Key;
  rootLink?: DeliveryReceipt_Key | null;
  inventory0: number;
  inspected0: number;
  receipt0: DeliveryReceiptItem_Key;
  movement0: StockMovement_Key;
  affected0: DeliveryIssueItem_Key;
  accepted0: number;
  inventory1: number;
  inspected1: number;
  receipt1: DeliveryReceiptItem_Key;
  movement1: StockMovement_Key;
  affected1: DeliveryIssueItem_Key;
  accepted1: number;
  inventory2: number;
  inspected2: number;
  receipt2: DeliveryReceiptItem_Key;
  movement2: StockMovement_Key;
  affected2: DeliveryIssueItem_Key;
  accepted2: number;
  inventory3: number;
  inspected3: number;
  receipt3: DeliveryReceiptItem_Key;
  movement3: StockMovement_Key;
  affected3: DeliveryIssueItem_Key;
  accepted3: number;
  inventory4: number;
  inspected4: number;
  receipt4: DeliveryReceiptItem_Key;
  movement4: StockMovement_Key;
  affected4: DeliveryIssueItem_Key;
  accepted4: number;
  inventory5: number;
  inspected5: number;
  receipt5: DeliveryReceiptItem_Key;
  movement5: StockMovement_Key;
  affected5: DeliveryIssueItem_Key;
  accepted5: number;
  reference0: DeliveryReceiptProcedure_Key;
  reference1: DeliveryReceiptProcedure_Key;
  opened: DeliveryIssueEvent_Key;
  replacementReceived: DeliveryIssueEvent_Key;
  activeRequest_deleteMany: number;
  deliveryCommandReceipt_insert: DeliveryCommandReceipt_Key;
  deliveryActionKey_insert: DeliveryActionKey_Key;
}

export interface RecordDeliveryTransactionVariables {
  uid: string;
  businessId: string;
  requestId: string;
  revision: number;
  receiptId: string;
  issueId: string;
  commandId: string;
  key: string;
  payloadHash: string;
  result: unknown;
  eventQuantities: unknown;
  hasIssue: boolean;
  isReplacement: boolean;
  createIssue: boolean;
  hasRootIssue: boolean;
  issueRevision: number;
  resolveIssue: boolean;
  description?: string | null;
  batchIdentifier?: string | null;
  productIds: string[];
  goods: number[];
  damaged: number[];
  missing: number[];
  count: number;
  use0: boolean;
  move0: boolean;
  affected0: boolean;
  replace0: boolean;
  use1: boolean;
  move1: boolean;
  affected1: boolean;
  replace1: boolean;
  use2: boolean;
  move2: boolean;
  affected2: boolean;
  replace2: boolean;
  use3: boolean;
  move3: boolean;
  affected3: boolean;
  replace3: boolean;
  use4: boolean;
  move4: boolean;
  affected4: boolean;
  replace4: boolean;
  use5: boolean;
  move5: boolean;
  affected5: boolean;
  replace5: boolean;
  ref0: boolean;
  version0: string;
  kind0: DeliveryProblemKind;
  chunk0?: string | null;
  useChunk0: boolean;
  ref1: boolean;
  version1: string;
  kind1: DeliveryProblemKind;
  chunk1?: string | null;
  useChunk1: boolean;
}

export interface RecordKnowledgeReviewData {
  knowledgeVersion_updateMany: number;
}

export interface RecordKnowledgeReviewVariables {
  versionId: string;
  revision: number;
  extractionHash: string;
  pageCount: number;
  reviewedBy: string;
}

export interface RecordOperatorProductReviewData {
  result?: number | null;
}

export interface RecordOperatorProductReviewVariables {
  businessId: string;
  versionId: string;
  extractionHash: string;
  catalogRevision: number;
  reviewedHash: string;
  stateJson: string;
  linksJson: string;
}

export interface RegisterKnowledgeVersionData {
  knowledgeDocument_insert: KnowledgeDocument_Key;
  knowledgeDocument_updateMany: number;
  knowledgeVersion_insert: KnowledgeVersion_Key;
  knowledgeOperation_insert: KnowledgeOperation_Key;
}

export interface RegisterKnowledgeVersionVariables {
  uid: string;
  businessId: string;
  documentId: string;
  documentCode: string;
  versionId: string;
  versionLabel: string;
  nextVersionNumber: number;
  expectedDocumentRevision: number;
  newDocument: boolean;
  existingDocument: boolean;
  operationId: string;
  key: string;
  payloadHash: string;
  title: string;
  language: string;
  sourceType?: KnowledgeSourceType | null;
  kind: KnowledgeDocumentKind;
  origin: KnowledgeOrigin;
  synthetic: boolean;
  sourceUrls: unknown;
  observedOn?: DateString | null;
  pdfSha256: string;
}

export interface RejectStockData {
  changed: number;
  issueChanged: number;
  deliveryIssueEvent_insert: DeliveryIssueEvent_Key;
  activeRequest_deleteMany: number;
  actionReceipt_insert: ActionReceipt_Key;
  actionKey_insert: ActionKey_Key;
}

export interface RejectStockVariables {
  uid: string;
  businessId: string;
  requestId: string;
  receiptId: string;
  key: string;
  payloadHash: string;
  semanticHash: string;
  revision: number;
  count: number;
  reason: string;
  isReplacement?: boolean;
  replacementIssueId?: string | null;
  issueRevision?: number | null;
}

export interface ReleaseProductKnowledgeGenerationData {
  result?: number | null;
}

export interface ReleaseProductKnowledgeGenerationVariables {
  uid: string;
  generationId: string;
}

export interface RemoveSalonShorthandData {
  result?: number | null;
}

export interface RemoveSalonShorthandVariables {
  uid: string;
  salonId: string;
  aliasId: string;
  expectedRevision: number;
  operationId: string;
  key: string;
  payloadHash: string;
}

export interface ReplenishmentChoiceReceipt_Key {
  id: string;
  __typename?: 'ReplenishmentChoiceReceipt_Key';
}

export interface ReplenishmentRequest_Key {
  id: string;
  __typename?: 'ReplenishmentRequest_Key';
}

export interface RequestItem_Key {
  id: string;
  __typename?: 'RequestItem_Key';
}

export interface ResetDemoStockData {
  deliveryKeys: number;
  deliveryCommands: number;
  deliveryEvents: number;
  deliveryIssueItems: number;
  deliveryIssues: number;
  deliveryReferences: number;
  deliveryItems: number;
  deliveryReceipts: number;
  keys: number;
  receipts: number;
  movements: number;
  transferItems: number;
  transfers: number;
  active: number;
  items: number;
  requests: number;
  hq: number;
  salons: number;
}

export interface ResetDemoStockVariables {
  businessId: string;
  productIds: string[];
}

export interface ResetProductAdminData {
  result?: number | null;
}

export interface ResetProductAdminVariables {
  businessId: string;
  seedProductIdsJson: string;
}

export interface RevokeKnowledgeVersionData {
  result?: number | null;
}

export interface RevokeKnowledgeVersionVariables {
  uid: string;
  businessId: string;
  documentId: string;
  versionId: string;
  expectedDocumentRevision: number;
  expectedVersionRevision: number;
  active: boolean;
  operationId: string;
  key: string;
  payloadHash: string;
}

export interface SalonAccess_Key {
  membershipUid: string;
  locationId: string;
  __typename?: 'SalonAccess_Key';
}

export interface SalonAliasOperation_Key {
  id: string;
  __typename?: 'SalonAliasOperation_Key';
}

export interface SalonSettings_Key {
  salonId: string;
  __typename?: 'SalonSettings_Key';
}

export interface SaveKnowledgeExtractionData {
  knowledgeVersion_updateMany: number;
}

export interface SaveKnowledgeExtractionVariables {
  versionId: string;
  revision: number;
  pdfSha256: string;
  leaseId?: string | null;
  parserVersion: string;
  extractionHash: string;
  expectedPageCount: number;
  expectedChunkCount: number;
  status: KnowledgeProcessingStatus;
}

export interface SaveProductAliasesData {
  result?: number | null;
}

export interface SaveProductAliasesVariables {
  uid: string;
  productId: string;
  retiresJson: string;
  upsertsJson: string;
  operationId: string;
  key: string;
  payloadHash: string;
}

export interface SaveProductCardAttachmentData {
  result?: number | null;
}

export interface SaveProductCardAttachmentVariables {
  uid: string;
  productId: string;
  expectedRevision: number;
  documentId: string;
  versionId: string;
  status: string;
  suggestionsJson: string;
}

export interface SaveProductKnowledgeSnapshotData {
  result?: number | null;
}

export interface SaveProductKnowledgeSnapshotVariables {
  uid: string;
  businessId: string;
  versionId: string;
  extractionHash: string;
  revision: number;
  catalogRevision: number;
  stateJson: string;
  linksJson: string;
  profilesJson: string;
  aliasesJson: string;
  operationJson: string;
  generationId?: string | null;
}

export interface SearchEligibleProcedureChunksData {
  result?: unknown | null;
}

export interface SearchEligibleProcedureChunksVariables {
  uid: string;
  businessId: string;
  vectorText: string;
  configHash: string;
  model: string;
  kindsJson: string;
}

export interface SeedDeliveryProcedureBindingsData {
  result?: number | null;
}

export interface SeedDeliveryProcedureBindingsVariables {
  businessId: string;
  bindingsJson: string;
  expectedCount: number;
}

export interface SeedProductCardAttachmentData {
  result?: number | null;
}

export interface SeedProductCardAttachmentVariables {
  businessId: string;
  productId: string;
  documentId: string;
  versionId: string;
}

export interface SetDeliveryProcedureData {
  created: DeliveryProcedureBinding_Key;
  changed: number;
  deliveryCommandReceipt_insert: DeliveryCommandReceipt_Key;
  deliveryActionKey_insert: DeliveryActionKey_Key;
}

export interface SetDeliveryProcedureVariables {
  uid: string;
  businessId: string;
  kind: DeliveryProblemKind;
  target: string;
  documentId?: string | null;
  hasDocument: boolean;
  create: boolean;
  revision: number;
  commandId: string;
  key: string;
  payloadHash: string;
  result: unknown;
}

export interface SetHqStockAdminData {
  result?: number | null;
}

export interface SetHqStockAdminVariables {
  uid: string;
  productId: string;
  expectedVersion: number;
  onHand: number;
  operationId: string;
  key: string;
  payloadHash: string;
  adjustmentId: string;
}

export interface SetKnowledgeDispatchFailureData {
  knowledgeVersion_updateMany: number;
}

export interface SetKnowledgeDispatchFailureVariables {
  versionId: string;
  revision: number;
  stage: KnowledgePendingStage;
  status: KnowledgeProcessingStatus;
  errorCode: string;
  expectedDocumentRevision?: number | null;
  extractionHash?: string | null;
}

export interface SetKnowledgeDispatchPendingData {
  knowledgeVersion_updateMany: number;
}

export interface SetKnowledgeDispatchPendingVariables {
  uid: string;
  businessId: string;
  versionId: string;
  revision: number;
  stage: KnowledgePendingStage;
  expectedDocumentRevision?: number | null;
  extractionHash?: string | null;
}

export interface SetKnowledgePublishIntentData {
  knowledgeVersion_updateMany: number;
}

export interface SetKnowledgePublishIntentVariables {
  uid: string;
  businessId: string;
  versionId: string;
  revision: number;
  expectedDocumentRevision: number;
  extractionHash: string;
  productKnowledgeReviewedHash?: string | null;
  productKnowledgeRevision?: number | null;
  productKnowledgeCatalogRevision?: number | null;
  configHash: string;
}

export interface SetOperatorKnowledgePublishIntentData {
  knowledgeVersion_updateMany: number;
}

export interface SetOperatorKnowledgePublishIntentVariables {
  businessId: string;
  versionId: string;
  revision: number;
  expectedDocumentRevision: number;
  extractionHash: string;
  configHash: string;
  productKnowledgeReviewedHash?: string | null;
  productKnowledgeRevision?: number | null;
  productKnowledgeCatalogRevision?: number | null;
}

export interface StageKnowledgeVersionData {
  knowledgeDocument_insert: KnowledgeDocument_Key;
  knowledgeDocument_updateMany: number;
  knowledgeVersion_insert: KnowledgeVersion_Key;
}

export interface StageKnowledgeVersionVariables {
  businessId: string;
  documentId: string;
  documentCode: string;
  versionId: string;
  versionLabel: string;
  nextVersionNumber: number;
  newDocument?: boolean | null;
  existingDocument?: boolean | null;
  title: string;
  language: string;
  sourceType?: KnowledgeSourceType | null;
  kind: KnowledgeDocumentKind;
  origin: KnowledgeOrigin;
  synthetic: boolean;
  sourceUrls: unknown;
  observedOn?: DateString | null;
  bucket: string;
  objectPath: string;
  objectGeneration: string;
  pdfSha256: string;
  contentType: string;
  byteSize: number;
  pageCount: number;
  publicationStatus?: KnowledgePublicationStatus | null;
}

export interface StartKnowledgeRetryData {
  knowledgeOperation_insert: KnowledgeOperation_Key;
}

export interface StartKnowledgeRetryVariables {
  uid: string;
  businessId: string;
  versionId: string;
  documentId: string;
  operationId: string;
  key: string;
  payloadHash: string;
  pdfSha256: string;
  retryStage: KnowledgePendingStage;
}

export interface StartKnowledgeReviewData {
  knowledgeOperation_insert: KnowledgeOperation_Key;
}

export interface StartKnowledgeReviewVariables {
  uid: string;
  businessId: string;
  documentId: string;
  versionId: string;
  operationId: string;
  key: string;
  payloadHash: string;
  extractionHash: string;
  expectedDocumentRevision: number;
}

export interface StockContextData {
  membership?: {
    uid: string;
    businessId: string;
    role: MemberRole;
    salonAccesses_on_membership: ({
      locationId: string;
    })[];
    business: {
      locations_on_business: ({
        id: string;
      } & Location_Key)[];
    };
  } & Membership_Key;
  replenishmentRequest?: {
    id: string;
    businessId: string;
    salonId: string;
    state: RequestState;
    revision: number;
    replacementIssueId?: string | null;
    replacementIssue?: {
      id: string;
      businessId: string;
      revision: number;
      status: DeliveryIssueStatus;
      activeReplacementRequestId?: string | null;
    } & DeliveryIssue_Key;
    items: ({
      id: string;
      productId: string;
      quantity: number;
      product: {
        inventories_on_product: ({
          locationId: string;
          onHand: number;
          reserved: number;
          version: number;
        })[];
      };
    } & RequestItem_Key)[];
  } & ReplenishmentRequest_Key;
  products: ({
    id: string;
    businessId: string;
  } & Product_Key)[];
  location?: {
    id: string;
    businessId: string;
    kind: LocationKind;
  } & Location_Key;
  keyed: ({
    payloadHash: string;
    receipt: {
      id: string;
      businessId: string;
      requestId: string;
      actorUid: string;
      action: StockActionType;
      payloadHash: string;
      semanticHash: string;
      state: RequestState;
      revision: number;
    } & ActionReceipt_Key;
  })[];
  semantic: ({
    id: string;
    businessId: string;
    requestId: string;
    actorUid: string;
    action: StockActionType;
    payloadHash: string;
    semanticHash: string;
    state: RequestState;
    revision: number;
  } & ActionReceipt_Key)[];
  activeRequests: ({
    requestId: string;
    productId: string;
  })[];
}

export interface StockContextVariables {
  uid: string;
  requestId?: string | null;
  salonId?: string | null;
  productIds: string[];
  key: string;
  action: StockActionType;
}

export interface StockMovement_Key {
  transferItemRequestItemId: string;
  type: MovementType;
  __typename?: 'StockMovement_Key';
}

export interface SubmitStockData {
  replenishmentRequest_insert: ReplenishmentRequest_Key;
  item0: RequestItem_Key;
  active0: ActiveRequest_Key;
  item1: RequestItem_Key;
  active1: ActiveRequest_Key;
  item2: RequestItem_Key;
  active2: ActiveRequest_Key;
  item3: RequestItem_Key;
  active3: ActiveRequest_Key;
  item4: RequestItem_Key;
  active4: ActiveRequest_Key;
  item5: RequestItem_Key;
  active5: ActiveRequest_Key;
  actionReceipt_insert: ActionReceipt_Key;
  actionKey_insert: ActionKey_Key;
}

export interface SubmitStockVariables {
  uid: string;
  businessId: string;
  requestId: string;
  receiptId: string;
  key: string;
  payloadHash: string;
  semanticHash: string;
  salonId: string;
  productIds: string[];
  itemIds: string[];
  quantities: number[];
  count: number;
  use0: boolean;
  use1: boolean;
  use2: boolean;
  use3: boolean;
  use4: boolean;
  use5: boolean;
}

export interface TransferItem_Key {
  requestItemId: string;
  __typename?: 'TransferItem_Key';
}

export interface Transfer_Key {
  requestId: string;
  __typename?: 'Transfer_Key';
}

export interface UpdateProductAdminData {
  result?: number | null;
}

export interface UpdateProductAdminVariables {
  uid: string;
  productId: string;
  expectedRevision: number;
  formJson: string;
  operationId: string;
  key: string;
  payloadHash: string;
}

export interface UpsertBusinessData {
  business_upsert: Business_Key;
}

export interface UpsertBusinessVariables {
  id: string;
  name: string;
}

export interface UpsertLocationData {
  location_upsert: Location_Key;
}

export interface UpsertLocationVariables {
  id: string;
  businessId: string;
  key: string;
  name: string;
  kind: LocationKind;
}

export interface UpsertMembershipData {
  membership_upsert: Membership_Key;
  salonAccess_deleteMany: number;
}

export interface UpsertMembershipVariables {
  uid: string;
  businessId: string;
  role: MemberRole;
}

export interface UpsertProductData {
  business_update?: Business_Key | null;
  product_upsert: Product_Key;
}

export interface UpsertProductVariables {
  id: string;
  businessId: string;
  demoId: string;
  name: string;
  brand: string;
  category: string;
  summaryEn: string;
  scentPl?: string | null;
  sourceCode: string;
  netContentMl: number;
  retailPriceGrosz: number;
  sourceUrl: string;
  observedOn: DateString;
}

export interface UpsertPushTokenData {
  result?: number | null;
}

export interface UpsertPushTokenVariables {
  uid: string;
  token: string;
  locale: string;
}

export interface UpsertSalonAccessData {
  salonAccess_upsert: SalonAccess_Key;
}

export interface UpsertSalonAccessVariables {
  uid: string;
  locationId: string;
}

export interface WipeDemoKnowledgeData {
  result?: number | null;
}

export interface WipeDemoKnowledgeVariables {
  businessId: string;
}

/** Generated Node Admin SDK operation action function for the 'ReadAiActor' Query. Allow users to execute without passing in DataConnect. */
export function readAiActor(dc: DataConnect, vars: ReadAiActorVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReadAiActorData>>;
/** Generated Node Admin SDK operation action function for the 'ReadAiActor' Query. Allow users to pass in custom DataConnect instances. */
export function readAiActor(vars: ReadAiActorVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReadAiActorData>>;

/** Generated Node Admin SDK operation action function for the 'AdmitAiWindow' Mutation. Allow users to execute without passing in DataConnect. */
export function admitAiWindow(dc: DataConnect, vars: AdmitAiWindowVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AdmitAiWindowData>>;
/** Generated Node Admin SDK operation action function for the 'AdmitAiWindow' Mutation. Allow users to pass in custom DataConnect instances. */
export function admitAiWindow(vars: AdmitAiWindowVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AdmitAiWindowData>>;

/** Generated Node Admin SDK operation action function for the 'ReadAiCurrentWindow' Query. Allow users to execute without passing in DataConnect. */
export function readAiCurrentWindow(dc: DataConnect, vars: ReadAiCurrentWindowVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReadAiCurrentWindowData>>;
/** Generated Node Admin SDK operation action function for the 'ReadAiCurrentWindow' Query. Allow users to pass in custom DataConnect instances. */
export function readAiCurrentWindow(vars: ReadAiCurrentWindowVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReadAiCurrentWindowData>>;

/** Generated Node Admin SDK operation action function for the 'ChangeDeliveryIssue' Mutation. Allow users to execute without passing in DataConnect. */
export function changeDeliveryIssue(dc: DataConnect, vars: ChangeDeliveryIssueVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ChangeDeliveryIssueData>>;
/** Generated Node Admin SDK operation action function for the 'ChangeDeliveryIssue' Mutation. Allow users to pass in custom DataConnect instances. */
export function changeDeliveryIssue(vars: ChangeDeliveryIssueVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ChangeDeliveryIssueData>>;

/** Generated Node Admin SDK operation action function for the 'CreateDeliveryReplacement' Mutation. Allow users to execute without passing in DataConnect. */
export function createDeliveryReplacement(dc: DataConnect, vars: CreateDeliveryReplacementVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateDeliveryReplacementData>>;
/** Generated Node Admin SDK operation action function for the 'CreateDeliveryReplacement' Mutation. Allow users to pass in custom DataConnect instances. */
export function createDeliveryReplacement(vars: CreateDeliveryReplacementVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateDeliveryReplacementData>>;

/** Generated Node Admin SDK operation action function for the 'InsertLegacyDeliveryReceipt' Mutation. Allow users to execute without passing in DataConnect. */
export function insertLegacyDeliveryReceipt(dc: DataConnect, vars: InsertLegacyDeliveryReceiptVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<InsertLegacyDeliveryReceiptData>>;
/** Generated Node Admin SDK operation action function for the 'InsertLegacyDeliveryReceipt' Mutation. Allow users to pass in custom DataConnect instances. */
export function insertLegacyDeliveryReceipt(vars: InsertLegacyDeliveryReceiptVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<InsertLegacyDeliveryReceiptData>>;

/** Generated Node Admin SDK operation action function for the 'ReadDeliveryBindings' Query. Allow users to execute without passing in DataConnect. */
export function readDeliveryBindings(dc: DataConnect, vars: ReadDeliveryBindingsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReadDeliveryBindingsData>>;
/** Generated Node Admin SDK operation action function for the 'ReadDeliveryBindings' Query. Allow users to pass in custom DataConnect instances. */
export function readDeliveryBindings(vars: ReadDeliveryBindingsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReadDeliveryBindingsData>>;

/** Generated Node Admin SDK operation action function for the 'ReadDeliveryProcedureDocument' Query. Allow users to execute without passing in DataConnect. */
export function readDeliveryProcedureDocument(dc: DataConnect, vars: ReadDeliveryProcedureDocumentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReadDeliveryProcedureDocumentData>>;
/** Generated Node Admin SDK operation action function for the 'ReadDeliveryProcedureDocument' Query. Allow users to pass in custom DataConnect instances. */
export function readDeliveryProcedureDocument(vars: ReadDeliveryProcedureDocumentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReadDeliveryProcedureDocumentData>>;

/** Generated Node Admin SDK operation action function for the 'SetDeliveryProcedure' Mutation. Allow users to execute without passing in DataConnect. */
export function setDeliveryProcedure(dc: DataConnect, vars: SetDeliveryProcedureVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SetDeliveryProcedureData>>;
/** Generated Node Admin SDK operation action function for the 'SetDeliveryProcedure' Mutation. Allow users to pass in custom DataConnect instances. */
export function setDeliveryProcedure(vars: SetDeliveryProcedureVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SetDeliveryProcedureData>>;

/** Generated Node Admin SDK operation action function for the 'ReadDeliveryContext' Query. Allow users to execute without passing in DataConnect. */
export function readDeliveryContext(dc: DataConnect, vars: ReadDeliveryContextVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReadDeliveryContextData>>;
/** Generated Node Admin SDK operation action function for the 'ReadDeliveryContext' Query. Allow users to pass in custom DataConnect instances. */
export function readDeliveryContext(vars: ReadDeliveryContextVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReadDeliveryContextData>>;

/** Generated Node Admin SDK operation action function for the 'ReadDeliveryKey' Query. Allow users to execute without passing in DataConnect. */
export function readDeliveryKey(dc: DataConnect, vars: ReadDeliveryKeyVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReadDeliveryKeyData>>;
/** Generated Node Admin SDK operation action function for the 'ReadDeliveryKey' Query. Allow users to pass in custom DataConnect instances. */
export function readDeliveryKey(vars: ReadDeliveryKeyVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReadDeliveryKeyData>>;

/** Generated Node Admin SDK operation action function for the 'ReadReplacementSlots' Query. Allow users to execute without passing in DataConnect. */
export function readReplacementSlots(dc: DataConnect, vars: ReadReplacementSlotsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReadReplacementSlotsData>>;
/** Generated Node Admin SDK operation action function for the 'ReadReplacementSlots' Query. Allow users to pass in custom DataConnect instances. */
export function readReplacementSlots(vars: ReadReplacementSlotsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReadReplacementSlotsData>>;

/** Generated Node Admin SDK operation action function for the 'ReadIssueContext' Query. Allow users to execute without passing in DataConnect. */
export function readIssueContext(dc: DataConnect, vars: ReadIssueContextVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReadIssueContextData>>;
/** Generated Node Admin SDK operation action function for the 'ReadIssueContext' Query. Allow users to pass in custom DataConnect instances. */
export function readIssueContext(vars: ReadIssueContextVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReadIssueContextData>>;

/** Generated Node Admin SDK operation action function for the 'RecordDeliveryTransaction' Mutation. Allow users to execute without passing in DataConnect. */
export function recordDeliveryTransaction(dc: DataConnect, vars: RecordDeliveryTransactionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RecordDeliveryTransactionData>>;
/** Generated Node Admin SDK operation action function for the 'RecordDeliveryTransaction' Mutation. Allow users to pass in custom DataConnect instances. */
export function recordDeliveryTransaction(vars: RecordDeliveryTransactionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RecordDeliveryTransactionData>>;

/** Generated Node Admin SDK operation action function for the 'KnowledgeCursorDocuments' Query. Allow users to execute without passing in DataConnect. */
export function knowledgeCursorDocuments(dc: DataConnect, vars: KnowledgeCursorDocumentsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<KnowledgeCursorDocumentsData>>;
/** Generated Node Admin SDK operation action function for the 'KnowledgeCursorDocuments' Query. Allow users to pass in custom DataConnect instances. */
export function knowledgeCursorDocuments(vars: KnowledgeCursorDocumentsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<KnowledgeCursorDocumentsData>>;

/** Generated Node Admin SDK operation action function for the 'KnowledgeCursorBusiness' Query. Allow users to execute without passing in DataConnect. */
export function knowledgeCursorBusiness(dc: DataConnect, vars: KnowledgeCursorBusinessVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<KnowledgeCursorBusinessData>>;
/** Generated Node Admin SDK operation action function for the 'KnowledgeCursorBusiness' Query. Allow users to pass in custom DataConnect instances. */
export function knowledgeCursorBusiness(vars: KnowledgeCursorBusinessVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<KnowledgeCursorBusinessData>>;

/** Generated Node Admin SDK operation action function for the 'KnowledgeCursorLabels' Query. Allow users to execute without passing in DataConnect. */
export function knowledgeCursorLabels(dc: DataConnect, vars: KnowledgeCursorLabelsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<KnowledgeCursorLabelsData>>;
/** Generated Node Admin SDK operation action function for the 'KnowledgeCursorLabels' Query. Allow users to pass in custom DataConnect instances. */
export function knowledgeCursorLabels(vars: KnowledgeCursorLabelsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<KnowledgeCursorLabelsData>>;

/** Generated Node Admin SDK operation action function for the 'BackfillKnowledgeCursor' Mutation. Allow users to execute without passing in DataConnect. */
export function backfillKnowledgeCursor(dc: DataConnect, vars: BackfillKnowledgeCursorVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<BackfillKnowledgeCursorData>>;
/** Generated Node Admin SDK operation action function for the 'BackfillKnowledgeCursor' Mutation. Allow users to pass in custom DataConnect instances. */
export function backfillKnowledgeCursor(vars: BackfillKnowledgeCursorVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<BackfillKnowledgeCursorData>>;

/** Generated Node Admin SDK operation action function for the 'SetKnowledgeDispatchFailure' Mutation. Allow users to execute without passing in DataConnect. */
export function setKnowledgeDispatchFailure(dc: DataConnect, vars: SetKnowledgeDispatchFailureVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SetKnowledgeDispatchFailureData>>;
/** Generated Node Admin SDK operation action function for the 'SetKnowledgeDispatchFailure' Mutation. Allow users to pass in custom DataConnect instances. */
export function setKnowledgeDispatchFailure(vars: SetKnowledgeDispatchFailureVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SetKnowledgeDispatchFailureData>>;

/** Generated Node Admin SDK operation action function for the 'SetKnowledgeDispatchPending' Mutation. Allow users to execute without passing in DataConnect. */
export function setKnowledgeDispatchPending(dc: DataConnect, vars: SetKnowledgeDispatchPendingVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SetKnowledgeDispatchPendingData>>;
/** Generated Node Admin SDK operation action function for the 'SetKnowledgeDispatchPending' Mutation. Allow users to pass in custom DataConnect instances. */
export function setKnowledgeDispatchPending(vars: SetKnowledgeDispatchPendingVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SetKnowledgeDispatchPendingData>>;

/** Generated Node Admin SDK operation action function for the 'StartKnowledgeRetry' Mutation. Allow users to execute without passing in DataConnect. */
export function startKnowledgeRetry(dc: DataConnect, vars: StartKnowledgeRetryVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<StartKnowledgeRetryData>>;
/** Generated Node Admin SDK operation action function for the 'StartKnowledgeRetry' Mutation. Allow users to pass in custom DataConnect instances. */
export function startKnowledgeRetry(vars: StartKnowledgeRetryVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<StartKnowledgeRetryData>>;

/** Generated Node Admin SDK operation action function for the 'CompleteKnowledgeRetry' Mutation. Allow users to execute without passing in DataConnect. */
export function completeKnowledgeRetry(dc: DataConnect, vars: CompleteKnowledgeRetryVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CompleteKnowledgeRetryData>>;
/** Generated Node Admin SDK operation action function for the 'CompleteKnowledgeRetry' Mutation. Allow users to pass in custom DataConnect instances. */
export function completeKnowledgeRetry(vars: CompleteKnowledgeRetryVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CompleteKnowledgeRetryData>>;

/** Generated Node Admin SDK operation action function for the 'SaveKnowledgeExtraction' Mutation. Allow users to execute without passing in DataConnect. */
export function saveKnowledgeExtraction(dc: DataConnect, vars: SaveKnowledgeExtractionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SaveKnowledgeExtractionData>>;
/** Generated Node Admin SDK operation action function for the 'SaveKnowledgeExtraction' Mutation. Allow users to pass in custom DataConnect instances. */
export function saveKnowledgeExtraction(vars: SaveKnowledgeExtractionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SaveKnowledgeExtractionData>>;

/** Generated Node Admin SDK operation action function for the 'InsertKnowledgePage' Mutation. Allow users to execute without passing in DataConnect. */
export function insertKnowledgePage(dc: DataConnect, vars: InsertKnowledgePageVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<InsertKnowledgePageData>>;
/** Generated Node Admin SDK operation action function for the 'InsertKnowledgePage' Mutation. Allow users to pass in custom DataConnect instances. */
export function insertKnowledgePage(vars: InsertKnowledgePageVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<InsertKnowledgePageData>>;

/** Generated Node Admin SDK operation action function for the 'KnowledgeMetadataPage' Query. Allow users to execute without passing in DataConnect. */
export function knowledgeMetadataPage(dc: DataConnect, vars: KnowledgeMetadataPageVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<KnowledgeMetadataPageData>>;
/** Generated Node Admin SDK operation action function for the 'KnowledgeMetadataPage' Query. Allow users to pass in custom DataConnect instances. */
export function knowledgeMetadataPage(vars: KnowledgeMetadataPageVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<KnowledgeMetadataPageData>>;

/** Generated Node Admin SDK operation action function for the 'BackfillKnowledgeMetadata' Mutation. Allow users to execute without passing in DataConnect. */
export function backfillKnowledgeMetadata(dc: DataConnect, vars: BackfillKnowledgeMetadataVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<BackfillKnowledgeMetadataData>>;
/** Generated Node Admin SDK operation action function for the 'BackfillKnowledgeMetadata' Mutation. Allow users to pass in custom DataConnect instances. */
export function backfillKnowledgeMetadata(vars: BackfillKnowledgeMetadataVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<BackfillKnowledgeMetadataData>>;

/** Generated Node Admin SDK operation action function for the 'SetKnowledgePublishIntent' Mutation. Allow users to execute without passing in DataConnect. */
export function setKnowledgePublishIntent(dc: DataConnect, vars: SetKnowledgePublishIntentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SetKnowledgePublishIntentData>>;
/** Generated Node Admin SDK operation action function for the 'SetKnowledgePublishIntent' Mutation. Allow users to pass in custom DataConnect instances. */
export function setKnowledgePublishIntent(vars: SetKnowledgePublishIntentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SetKnowledgePublishIntentData>>;

/** Generated Node Admin SDK operation action function for the 'SetOperatorKnowledgePublishIntent' Mutation. Allow users to execute without passing in DataConnect. */
export function setOperatorKnowledgePublishIntent(dc: DataConnect, vars: SetOperatorKnowledgePublishIntentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SetOperatorKnowledgePublishIntentData>>;
/** Generated Node Admin SDK operation action function for the 'SetOperatorKnowledgePublishIntent' Mutation. Allow users to pass in custom DataConnect instances. */
export function setOperatorKnowledgePublishIntent(vars: SetOperatorKnowledgePublishIntentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SetOperatorKnowledgePublishIntentData>>;

/** Generated Node Admin SDK operation action function for the 'MarkKnowledgePublishStale' Mutation. Allow users to execute without passing in DataConnect. */
export function markKnowledgePublishStale(dc: DataConnect, vars: MarkKnowledgePublishStaleVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MarkKnowledgePublishStaleData>>;
/** Generated Node Admin SDK operation action function for the 'MarkKnowledgePublishStale' Mutation. Allow users to pass in custom DataConnect instances. */
export function markKnowledgePublishStale(vars: MarkKnowledgePublishStaleVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MarkKnowledgePublishStaleData>>;

/** Generated Node Admin SDK operation action function for the 'PublishKnowledgeVersion' Mutation. Allow users to execute without passing in DataConnect. */
export function publishKnowledgeVersion(dc: DataConnect, vars: PublishKnowledgeVersionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<PublishKnowledgeVersionData>>;
/** Generated Node Admin SDK operation action function for the 'PublishKnowledgeVersion' Mutation. Allow users to pass in custom DataConnect instances. */
export function publishKnowledgeVersion(vars: PublishKnowledgeVersionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<PublishKnowledgeVersionData>>;

/** Generated Node Admin SDK operation action function for the 'RegisterKnowledgeVersion' Mutation. Allow users to execute without passing in DataConnect. */
export function registerKnowledgeVersion(dc: DataConnect, vars: RegisterKnowledgeVersionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RegisterKnowledgeVersionData>>;
/** Generated Node Admin SDK operation action function for the 'RegisterKnowledgeVersion' Mutation. Allow users to pass in custom DataConnect instances. */
export function registerKnowledgeVersion(vars: RegisterKnowledgeVersionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RegisterKnowledgeVersionData>>;

/** Generated Node Admin SDK operation action function for the 'BindKnowledgeOriginal' Mutation. Allow users to execute without passing in DataConnect. */
export function bindKnowledgeOriginal(dc: DataConnect, vars: BindKnowledgeOriginalVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<BindKnowledgeOriginalData>>;
/** Generated Node Admin SDK operation action function for the 'BindKnowledgeOriginal' Mutation. Allow users to pass in custom DataConnect instances. */
export function bindKnowledgeOriginal(vars: BindKnowledgeOriginalVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<BindKnowledgeOriginalData>>;

/** Generated Node Admin SDK operation action function for the 'SearchEligibleProcedureChunks' Query. Allow users to execute without passing in DataConnect. */
export function searchEligibleProcedureChunks(dc: DataConnect, vars: SearchEligibleProcedureChunksVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SearchEligibleProcedureChunksData>>;
/** Generated Node Admin SDK operation action function for the 'SearchEligibleProcedureChunks' Query. Allow users to pass in custom DataConnect instances. */
export function searchEligibleProcedureChunks(vars: SearchEligibleProcedureChunksVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SearchEligibleProcedureChunksData>>;

/** Generated Node Admin SDK operation action function for the 'RecheckProcedureSources' Query. Allow users to execute without passing in DataConnect. */
export function recheckProcedureSources(dc: DataConnect, vars: RecheckProcedureSourcesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RecheckProcedureSourcesData>>;
/** Generated Node Admin SDK operation action function for the 'RecheckProcedureSources' Query. Allow users to pass in custom DataConnect instances. */
export function recheckProcedureSources(vars: RecheckProcedureSourcesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RecheckProcedureSourcesData>>;

/** Generated Node Admin SDK operation action function for the 'StartKnowledgeReview' Mutation. Allow users to execute without passing in DataConnect. */
export function startKnowledgeReview(dc: DataConnect, vars: StartKnowledgeReviewVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<StartKnowledgeReviewData>>;
/** Generated Node Admin SDK operation action function for the 'StartKnowledgeReview' Mutation. Allow users to pass in custom DataConnect instances. */
export function startKnowledgeReview(vars: StartKnowledgeReviewVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<StartKnowledgeReviewData>>;

/** Generated Node Admin SDK operation action function for the 'CompleteKnowledgeReview' Mutation. Allow users to execute without passing in DataConnect. */
export function completeKnowledgeReview(dc: DataConnect, vars: CompleteKnowledgeReviewVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CompleteKnowledgeReviewData>>;
/** Generated Node Admin SDK operation action function for the 'CompleteKnowledgeReview' Mutation. Allow users to pass in custom DataConnect instances. */
export function completeKnowledgeReview(vars: CompleteKnowledgeReviewVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CompleteKnowledgeReviewData>>;

/** Generated Node Admin SDK operation action function for the 'RecordKnowledgeReview' Mutation. Allow users to execute without passing in DataConnect. */
export function recordKnowledgeReview(dc: DataConnect, vars: RecordKnowledgeReviewVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RecordKnowledgeReviewData>>;
/** Generated Node Admin SDK operation action function for the 'RecordKnowledgeReview' Mutation. Allow users to pass in custom DataConnect instances. */
export function recordKnowledgeReview(vars: RecordKnowledgeReviewVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RecordKnowledgeReviewData>>;

/** Generated Node Admin SDK operation action function for the 'MarkKnowledgePageReviewed' Mutation. Allow users to execute without passing in DataConnect. */
export function markKnowledgePageReviewed(dc: DataConnect, vars: MarkKnowledgePageReviewedVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MarkKnowledgePageReviewedData>>;
/** Generated Node Admin SDK operation action function for the 'MarkKnowledgePageReviewed' Mutation. Allow users to pass in custom DataConnect instances. */
export function markKnowledgePageReviewed(vars: MarkKnowledgePageReviewedVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MarkKnowledgePageReviewedData>>;

/** Generated Node Admin SDK operation action function for the 'MarkKnowledgeReady' Mutation. Allow users to execute without passing in DataConnect. */
export function markKnowledgeReady(dc: DataConnect, vars: MarkKnowledgeReadyVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MarkKnowledgeReadyData>>;
/** Generated Node Admin SDK operation action function for the 'MarkKnowledgeReady' Mutation. Allow users to pass in custom DataConnect instances. */
export function markKnowledgeReady(vars: MarkKnowledgeReadyVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MarkKnowledgeReadyData>>;

/** Generated Node Admin SDK operation action function for the 'RevokeKnowledgeVersion' Mutation. Allow users to execute without passing in DataConnect. */
export function revokeKnowledgeVersion(dc: DataConnect, vars: RevokeKnowledgeVersionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RevokeKnowledgeVersionData>>;
/** Generated Node Admin SDK operation action function for the 'RevokeKnowledgeVersion' Mutation. Allow users to pass in custom DataConnect instances. */
export function revokeKnowledgeVersion(vars: RevokeKnowledgeVersionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RevokeKnowledgeVersionData>>;

/** Generated Node Admin SDK operation action function for the 'StageKnowledgeVersion' Mutation. Allow users to execute without passing in DataConnect. */
export function stageKnowledgeVersion(dc: DataConnect, vars: StageKnowledgeVersionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<StageKnowledgeVersionData>>;
/** Generated Node Admin SDK operation action function for the 'StageKnowledgeVersion' Mutation. Allow users to pass in custom DataConnect instances. */
export function stageKnowledgeVersion(vars: StageKnowledgeVersionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<StageKnowledgeVersionData>>;

/** Generated Node Admin SDK operation action function for the 'BeginKnowledgeExtraction' Mutation. Allow users to execute without passing in DataConnect. */
export function beginKnowledgeExtraction(dc: DataConnect, vars: BeginKnowledgeExtractionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<BeginKnowledgeExtractionData>>;
/** Generated Node Admin SDK operation action function for the 'BeginKnowledgeExtraction' Mutation. Allow users to pass in custom DataConnect instances. */
export function beginKnowledgeExtraction(vars: BeginKnowledgeExtractionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<BeginKnowledgeExtractionData>>;

/** Generated Node Admin SDK operation action function for the 'ClaimKnowledgeExtraction' Mutation. Allow users to execute without passing in DataConnect. */
export function claimKnowledgeExtraction(dc: DataConnect, vars: ClaimKnowledgeExtractionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ClaimKnowledgeExtractionData>>;
/** Generated Node Admin SDK operation action function for the 'ClaimKnowledgeExtraction' Mutation. Allow users to pass in custom DataConnect instances. */
export function claimKnowledgeExtraction(vars: ClaimKnowledgeExtractionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ClaimKnowledgeExtractionData>>;

/** Generated Node Admin SDK operation action function for the 'FailKnowledgeExtraction' Mutation. Allow users to execute without passing in DataConnect. */
export function failKnowledgeExtraction(dc: DataConnect, vars: FailKnowledgeExtractionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<FailKnowledgeExtractionData>>;
/** Generated Node Admin SDK operation action function for the 'FailKnowledgeExtraction' Mutation. Allow users to pass in custom DataConnect instances. */
export function failKnowledgeExtraction(vars: FailKnowledgeExtractionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<FailKnowledgeExtractionData>>;

/** Generated Node Admin SDK operation action function for the 'KnowledgeVersionState' Query. Allow users to execute without passing in DataConnect. */
export function knowledgeVersionState(dc: DataConnect, vars: KnowledgeVersionStateVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<KnowledgeVersionStateData>>;
/** Generated Node Admin SDK operation action function for the 'KnowledgeVersionState' Query. Allow users to pass in custom DataConnect instances. */
export function knowledgeVersionState(vars: KnowledgeVersionStateVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<KnowledgeVersionStateData>>;

/** Generated Node Admin SDK operation action function for the 'KnowledgeDocumentState' Query. Allow users to execute without passing in DataConnect. */
export function knowledgeDocumentState(dc: DataConnect, vars: KnowledgeDocumentStateVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<KnowledgeDocumentStateData>>;
/** Generated Node Admin SDK operation action function for the 'KnowledgeDocumentState' Query. Allow users to pass in custom DataConnect instances. */
export function knowledgeDocumentState(vars: KnowledgeDocumentStateVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<KnowledgeDocumentStateData>>;

/** Generated Node Admin SDK operation action function for the 'KnowledgeCommandContext' Query. Allow users to execute without passing in DataConnect. */
export function knowledgeCommandContext(dc: DataConnect, vars: KnowledgeCommandContextVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<KnowledgeCommandContextData>>;
/** Generated Node Admin SDK operation action function for the 'KnowledgeCommandContext' Query. Allow users to pass in custom DataConnect instances. */
export function knowledgeCommandContext(vars: KnowledgeCommandContextVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<KnowledgeCommandContextData>>;

/** Generated Node Admin SDK operation action function for the 'RecordOperatorProductReview' Mutation. Allow users to execute without passing in DataConnect. */
export function recordOperatorProductReview(dc: DataConnect, vars: RecordOperatorProductReviewVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RecordOperatorProductReviewData>>;
/** Generated Node Admin SDK operation action function for the 'RecordOperatorProductReview' Mutation. Allow users to pass in custom DataConnect instances. */
export function recordOperatorProductReview(vars: RecordOperatorProductReviewVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RecordOperatorProductReviewData>>;

/** Generated Node Admin SDK operation action function for the 'SaveProductKnowledgeSnapshot' Mutation. Allow users to execute without passing in DataConnect. */
export function saveProductKnowledgeSnapshot(dc: DataConnect, vars: SaveProductKnowledgeSnapshotVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SaveProductKnowledgeSnapshotData>>;
/** Generated Node Admin SDK operation action function for the 'SaveProductKnowledgeSnapshot' Mutation. Allow users to pass in custom DataConnect instances. */
export function saveProductKnowledgeSnapshot(vars: SaveProductKnowledgeSnapshotVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SaveProductKnowledgeSnapshotData>>;

/** Generated Node Admin SDK operation action function for the 'ClaimProductKnowledgeGeneration' Mutation. Allow users to execute without passing in DataConnect. */
export function claimProductKnowledgeGeneration(dc: DataConnect, vars: ClaimProductKnowledgeGenerationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ClaimProductKnowledgeGenerationData>>;
/** Generated Node Admin SDK operation action function for the 'ClaimProductKnowledgeGeneration' Mutation. Allow users to pass in custom DataConnect instances. */
export function claimProductKnowledgeGeneration(vars: ClaimProductKnowledgeGenerationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ClaimProductKnowledgeGenerationData>>;

/** Generated Node Admin SDK operation action function for the 'ReleaseProductKnowledgeGeneration' Mutation. Allow users to execute without passing in DataConnect. */
export function releaseProductKnowledgeGeneration(dc: DataConnect, vars: ReleaseProductKnowledgeGenerationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReleaseProductKnowledgeGenerationData>>;
/** Generated Node Admin SDK operation action function for the 'ReleaseProductKnowledgeGeneration' Mutation. Allow users to pass in custom DataConnect instances. */
export function releaseProductKnowledgeGeneration(vars: ReleaseProductKnowledgeGenerationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReleaseProductKnowledgeGenerationData>>;

/** Generated Node Admin SDK operation action function for the 'AcceptProductKnowledgeSnapshot' Mutation. Allow users to execute without passing in DataConnect. */
export function acceptProductKnowledgeSnapshot(dc: DataConnect, vars: AcceptProductKnowledgeSnapshotVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AcceptProductKnowledgeSnapshotData>>;
/** Generated Node Admin SDK operation action function for the 'AcceptProductKnowledgeSnapshot' Mutation. Allow users to pass in custom DataConnect instances. */
export function acceptProductKnowledgeSnapshot(vars: AcceptProductKnowledgeSnapshotVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AcceptProductKnowledgeSnapshotData>>;

/** Generated Node Admin SDK operation action function for the 'ProductKnowledgeState' Query. Allow users to execute without passing in DataConnect. */
export function productKnowledgeState(dc: DataConnect, vars: ProductKnowledgeStateVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ProductKnowledgeStateData>>;
/** Generated Node Admin SDK operation action function for the 'ProductKnowledgeState' Query. Allow users to pass in custom DataConnect instances. */
export function productKnowledgeState(vars: ProductKnowledgeStateVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ProductKnowledgeStateData>>;

/** Generated Node Admin SDK operation action function for the 'ProductKnowledgeCatalogPage' Query. Allow users to execute without passing in DataConnect. */
export function productKnowledgeCatalogPage(dc: DataConnect, vars: ProductKnowledgeCatalogPageVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ProductKnowledgeCatalogPageData>>;
/** Generated Node Admin SDK operation action function for the 'ProductKnowledgeCatalogPage' Query. Allow users to pass in custom DataConnect instances. */
export function productKnowledgeCatalogPage(vars: ProductKnowledgeCatalogPageVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ProductKnowledgeCatalogPageData>>;

/** Generated Node Admin SDK operation action function for the 'ProductKnowledgeActiveAliasPage' Query. Allow users to execute without passing in DataConnect. */
export function productKnowledgeActiveAliasPage(dc: DataConnect, vars: ProductKnowledgeActiveAliasPageVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ProductKnowledgeActiveAliasPageData>>;
/** Generated Node Admin SDK operation action function for the 'ProductKnowledgeActiveAliasPage' Query. Allow users to pass in custom DataConnect instances. */
export function productKnowledgeActiveAliasPage(vars: ProductKnowledgeActiveAliasPageVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ProductKnowledgeActiveAliasPageData>>;

/** Generated Node Admin SDK operation action function for the 'ReadProductAdmin' Query. Allow users to execute without passing in DataConnect. */
export function readProductAdmin(dc: DataConnect, vars: ReadProductAdminVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReadProductAdminData>>;
/** Generated Node Admin SDK operation action function for the 'ReadProductAdmin' Query. Allow users to pass in custom DataConnect instances. */
export function readProductAdmin(vars: ReadProductAdminVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReadProductAdminData>>;

/** Generated Node Admin SDK operation action function for the 'ReadProductAdminScope' Query. Allow users to execute without passing in DataConnect. */
export function readProductAdminScope(dc: DataConnect, vars: ReadProductAdminScopeVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReadProductAdminScopeData>>;
/** Generated Node Admin SDK operation action function for the 'ReadProductAdminScope' Query. Allow users to pass in custom DataConnect instances. */
export function readProductAdminScope(vars: ReadProductAdminScopeVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReadProductAdminScopeData>>;

/** Generated Node Admin SDK operation action function for the 'ReadProductCodeOwner' Query. Allow users to execute without passing in DataConnect. */
export function readProductCodeOwner(dc: DataConnect, vars: ReadProductCodeOwnerVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReadProductCodeOwnerData>>;
/** Generated Node Admin SDK operation action function for the 'ReadProductCodeOwner' Query. Allow users to pass in custom DataConnect instances. */
export function readProductCodeOwner(vars: ReadProductCodeOwnerVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReadProductCodeOwnerData>>;

/** Generated Node Admin SDK operation action function for the 'ReadProductAdminOperation' Query. Allow users to execute without passing in DataConnect. */
export function readProductAdminOperation(dc: DataConnect, vars: ReadProductAdminOperationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReadProductAdminOperationData>>;
/** Generated Node Admin SDK operation action function for the 'ReadProductAdminOperation' Query. Allow users to pass in custom DataConnect instances. */
export function readProductAdminOperation(vars: ReadProductAdminOperationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReadProductAdminOperationData>>;

/** Generated Node Admin SDK operation action function for the 'CreateProductAdmin' Mutation. Allow users to execute without passing in DataConnect. */
export function createProductAdmin(dc: DataConnect, vars: CreateProductAdminVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateProductAdminData>>;
/** Generated Node Admin SDK operation action function for the 'CreateProductAdmin' Mutation. Allow users to pass in custom DataConnect instances. */
export function createProductAdmin(vars: CreateProductAdminVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateProductAdminData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateProductAdmin' Mutation. Allow users to execute without passing in DataConnect. */
export function updateProductAdmin(dc: DataConnect, vars: UpdateProductAdminVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateProductAdminData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateProductAdmin' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateProductAdmin(vars: UpdateProductAdminVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateProductAdminData>>;

/** Generated Node Admin SDK operation action function for the 'SetHqStockAdmin' Mutation. Allow users to execute without passing in DataConnect. */
export function setHqStockAdmin(dc: DataConnect, vars: SetHqStockAdminVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SetHqStockAdminData>>;
/** Generated Node Admin SDK operation action function for the 'SetHqStockAdmin' Mutation. Allow users to pass in custom DataConnect instances. */
export function setHqStockAdmin(vars: SetHqStockAdminVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SetHqStockAdminData>>;

/** Generated Node Admin SDK operation action function for the 'ReadProductAliases' Query. Allow users to execute without passing in DataConnect. */
export function readProductAliases(dc: DataConnect, vars: ReadProductAliasesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReadProductAliasesData>>;
/** Generated Node Admin SDK operation action function for the 'ReadProductAliases' Query. Allow users to pass in custom DataConnect instances. */
export function readProductAliases(vars: ReadProductAliasesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReadProductAliasesData>>;

/** Generated Node Admin SDK operation action function for the 'ReadProductAliasRevisions' Query. Allow users to execute without passing in DataConnect. */
export function readProductAliasRevisions(dc: DataConnect, vars: ReadProductAliasRevisionsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReadProductAliasRevisionsData>>;
/** Generated Node Admin SDK operation action function for the 'ReadProductAliasRevisions' Query. Allow users to pass in custom DataConnect instances. */
export function readProductAliasRevisions(vars: ReadProductAliasRevisionsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReadProductAliasRevisionsData>>;

/** Generated Node Admin SDK operation action function for the 'ReadCollisionProducts' Query. Allow users to execute without passing in DataConnect. */
export function readCollisionProducts(dc: DataConnect, vars: ReadCollisionProductsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReadCollisionProductsData>>;
/** Generated Node Admin SDK operation action function for the 'ReadCollisionProducts' Query. Allow users to pass in custom DataConnect instances. */
export function readCollisionProducts(vars: ReadCollisionProductsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReadCollisionProductsData>>;

/** Generated Node Admin SDK operation action function for the 'ReadCollisionAliases' Query. Allow users to execute without passing in DataConnect. */
export function readCollisionAliases(dc: DataConnect, vars: ReadCollisionAliasesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReadCollisionAliasesData>>;
/** Generated Node Admin SDK operation action function for the 'ReadCollisionAliases' Query. Allow users to pass in custom DataConnect instances. */
export function readCollisionAliases(vars: ReadCollisionAliasesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReadCollisionAliasesData>>;

/** Generated Node Admin SDK operation action function for the 'SaveProductAliases' Mutation. Allow users to execute without passing in DataConnect. */
export function saveProductAliases(dc: DataConnect, vars: SaveProductAliasesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SaveProductAliasesData>>;
/** Generated Node Admin SDK operation action function for the 'SaveProductAliases' Mutation. Allow users to pass in custom DataConnect instances. */
export function saveProductAliases(vars: SaveProductAliasesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SaveProductAliasesData>>;

/** Generated Node Admin SDK operation action function for the 'ReadProductCardAttachment' Query. Allow users to execute without passing in DataConnect. */
export function readProductCardAttachment(dc: DataConnect, vars: ReadProductCardAttachmentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReadProductCardAttachmentData>>;
/** Generated Node Admin SDK operation action function for the 'ReadProductCardAttachment' Query. Allow users to pass in custom DataConnect instances. */
export function readProductCardAttachment(vars: ReadProductCardAttachmentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReadProductCardAttachmentData>>;

/** Generated Node Admin SDK operation action function for the 'SaveProductCardAttachment' Mutation. Allow users to execute without passing in DataConnect. */
export function saveProductCardAttachment(dc: DataConnect, vars: SaveProductCardAttachmentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SaveProductCardAttachmentData>>;
/** Generated Node Admin SDK operation action function for the 'SaveProductCardAttachment' Mutation. Allow users to pass in custom DataConnect instances. */
export function saveProductCardAttachment(vars: SaveProductCardAttachmentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SaveProductCardAttachmentData>>;

/** Generated Node Admin SDK operation action function for the 'UpsertPushToken' Mutation. Allow users to execute without passing in DataConnect. */
export function upsertPushToken(dc: DataConnect, vars: UpsertPushTokenVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpsertPushTokenData>>;
/** Generated Node Admin SDK operation action function for the 'UpsertPushToken' Mutation. Allow users to pass in custom DataConnect instances. */
export function upsertPushToken(vars: UpsertPushTokenVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpsertPushTokenData>>;

/** Generated Node Admin SDK operation action function for the 'DeletePushToken' Mutation. Allow users to execute without passing in DataConnect. */
export function deletePushToken(dc: DataConnect, vars: DeletePushTokenVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeletePushTokenData>>;
/** Generated Node Admin SDK operation action function for the 'DeletePushToken' Mutation. Allow users to pass in custom DataConnect instances. */
export function deletePushToken(vars: DeletePushTokenVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeletePushTokenData>>;

/** Generated Node Admin SDK operation action function for the 'DeletePushTokens' Mutation. Allow users to execute without passing in DataConnect. */
export function deletePushTokens(dc: DataConnect, vars: DeletePushTokensVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeletePushTokensData>>;
/** Generated Node Admin SDK operation action function for the 'DeletePushTokens' Mutation. Allow users to pass in custom DataConnect instances. */
export function deletePushTokens(vars: DeletePushTokensVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeletePushTokensData>>;

/** Generated Node Admin SDK operation action function for the 'PushRecipients' Query. Allow users to execute without passing in DataConnect. */
export function pushRecipients(dc: DataConnect, vars: PushRecipientsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<PushRecipientsData>>;
/** Generated Node Admin SDK operation action function for the 'PushRecipients' Query. Allow users to pass in custom DataConnect instances. */
export function pushRecipients(vars: PushRecipientsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<PushRecipientsData>>;

/** Generated Node Admin SDK operation action function for the 'ReadReplenishmentSnapshotHeader' Query. Allow users to execute without passing in DataConnect. */
export function readReplenishmentSnapshotHeader(dc: DataConnect, vars: ReadReplenishmentSnapshotHeaderVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReadReplenishmentSnapshotHeaderData>>;
/** Generated Node Admin SDK operation action function for the 'ReadReplenishmentSnapshotHeader' Query. Allow users to pass in custom DataConnect instances. */
export function readReplenishmentSnapshotHeader(vars: ReadReplenishmentSnapshotHeaderVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReadReplenishmentSnapshotHeaderData>>;

/** Generated Node Admin SDK operation action function for the 'ReadReplenishmentProductPage' Query. Allow users to execute without passing in DataConnect. */
export function readReplenishmentProductPage(dc: DataConnect, vars: ReadReplenishmentProductPageVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReadReplenishmentProductPageData>>;
/** Generated Node Admin SDK operation action function for the 'ReadReplenishmentProductPage' Query. Allow users to pass in custom DataConnect instances. */
export function readReplenishmentProductPage(vars: ReadReplenishmentProductPageVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReadReplenishmentProductPageData>>;

/** Generated Node Admin SDK operation action function for the 'ReadReplenishmentAliasPage' Query. Allow users to execute without passing in DataConnect. */
export function readReplenishmentAliasPage(dc: DataConnect, vars: ReadReplenishmentAliasPageVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReadReplenishmentAliasPageData>>;
/** Generated Node Admin SDK operation action function for the 'ReadReplenishmentAliasPage' Query. Allow users to pass in custom DataConnect instances. */
export function readReplenishmentAliasPage(vars: ReadReplenishmentAliasPageVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReadReplenishmentAliasPageData>>;

/** Generated Node Admin SDK operation action function for the 'ReadReplenishmentSalonAliasPage' Query. Allow users to execute without passing in DataConnect. */
export function readReplenishmentSalonAliasPage(dc: DataConnect, vars: ReadReplenishmentSalonAliasPageVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReadReplenishmentSalonAliasPageData>>;
/** Generated Node Admin SDK operation action function for the 'ReadReplenishmentSalonAliasPage' Query. Allow users to pass in custom DataConnect instances. */
export function readReplenishmentSalonAliasPage(vars: ReadReplenishmentSalonAliasPageVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReadReplenishmentSalonAliasPageData>>;

/** Generated Node Admin SDK operation action function for the 'IssueReplenishmentChoiceReceipts' Mutation. Allow users to execute without passing in DataConnect. */
export function issueReplenishmentChoiceReceipts(dc: DataConnect, vars: IssueReplenishmentChoiceReceiptsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<IssueReplenishmentChoiceReceiptsData>>;
/** Generated Node Admin SDK operation action function for the 'IssueReplenishmentChoiceReceipts' Mutation. Allow users to pass in custom DataConnect instances. */
export function issueReplenishmentChoiceReceipts(vars: IssueReplenishmentChoiceReceiptsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<IssueReplenishmentChoiceReceiptsData>>;

/** Generated Node Admin SDK operation action function for the 'ReadSalonShorthandConfirmation' Query. Allow users to execute without passing in DataConnect. */
export function readSalonShorthandConfirmation(dc: DataConnect, vars: ReadSalonShorthandConfirmationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReadSalonShorthandConfirmationData>>;
/** Generated Node Admin SDK operation action function for the 'ReadSalonShorthandConfirmation' Query. Allow users to pass in custom DataConnect instances. */
export function readSalonShorthandConfirmation(vars: ReadSalonShorthandConfirmationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReadSalonShorthandConfirmationData>>;

/** Generated Node Admin SDK operation action function for the 'ConfirmSalonShorthand' Mutation. Allow users to execute without passing in DataConnect. */
export function confirmSalonShorthand(dc: DataConnect, vars: ConfirmSalonShorthandVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ConfirmSalonShorthandData>>;
/** Generated Node Admin SDK operation action function for the 'ConfirmSalonShorthand' Mutation. Allow users to pass in custom DataConnect instances. */
export function confirmSalonShorthand(vars: ConfirmSalonShorthandVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ConfirmSalonShorthandData>>;

/** Generated Node Admin SDK operation action function for the 'ReadSalonAliasOperation' Query. Allow users to execute without passing in DataConnect. */
export function readSalonAliasOperation(dc: DataConnect, vars: ReadSalonAliasOperationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReadSalonAliasOperationData>>;
/** Generated Node Admin SDK operation action function for the 'ReadSalonAliasOperation' Query. Allow users to pass in custom DataConnect instances. */
export function readSalonAliasOperation(vars: ReadSalonAliasOperationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReadSalonAliasOperationData>>;

/** Generated Node Admin SDK operation action function for the 'ReadSalonShorthandScope' Query. Allow users to execute without passing in DataConnect. */
export function readSalonShorthandScope(dc: DataConnect, vars: ReadSalonShorthandScopeVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReadSalonShorthandScopeData>>;
/** Generated Node Admin SDK operation action function for the 'ReadSalonShorthandScope' Query. Allow users to pass in custom DataConnect instances. */
export function readSalonShorthandScope(vars: ReadSalonShorthandScopeVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReadSalonShorthandScopeData>>;

/** Generated Node Admin SDK operation action function for the 'RemoveSalonShorthand' Mutation. Allow users to execute without passing in DataConnect. */
export function removeSalonShorthand(dc: DataConnect, vars: RemoveSalonShorthandVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RemoveSalonShorthandData>>;
/** Generated Node Admin SDK operation action function for the 'RemoveSalonShorthand' Mutation. Allow users to pass in custom DataConnect instances. */
export function removeSalonShorthand(vars: RemoveSalonShorthandVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RemoveSalonShorthandData>>;

/** Generated Node Admin SDK operation action function for the 'ReadProductAliasSeedState' Query. Allow users to execute without passing in DataConnect. */
export function readProductAliasSeedState(dc: DataConnect, vars: ReadProductAliasSeedStateVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReadProductAliasSeedStateData>>;
/** Generated Node Admin SDK operation action function for the 'ReadProductAliasSeedState' Query. Allow users to pass in custom DataConnect instances. */
export function readProductAliasSeedState(vars: ReadProductAliasSeedStateVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReadProductAliasSeedStateData>>;

/** Generated Node Admin SDK operation action function for the 'ApplyProductAliasSeed' Mutation. Allow users to execute without passing in DataConnect. */
export function applyProductAliasSeed(dc: DataConnect, vars: ApplyProductAliasSeedVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ApplyProductAliasSeedData>>;
/** Generated Node Admin SDK operation action function for the 'ApplyProductAliasSeed' Mutation. Allow users to pass in custom DataConnect instances. */
export function applyProductAliasSeed(vars: ApplyProductAliasSeedVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ApplyProductAliasSeedData>>;

/** Generated Node Admin SDK operation action function for the 'ResetProductAdmin' Mutation. Allow users to execute without passing in DataConnect. */
export function resetProductAdmin(dc: DataConnect, vars: ResetProductAdminVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ResetProductAdminData>>;
/** Generated Node Admin SDK operation action function for the 'ResetProductAdmin' Mutation. Allow users to pass in custom DataConnect instances. */
export function resetProductAdmin(vars: ResetProductAdminVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ResetProductAdminData>>;

/** Generated Node Admin SDK operation action function for the 'ReadSeedState' Query. Allow users to execute without passing in DataConnect. */
export function readSeedState(dc: DataConnect, vars: ReadSeedStateVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReadSeedStateData>>;
/** Generated Node Admin SDK operation action function for the 'ReadSeedState' Query. Allow users to pass in custom DataConnect instances. */
export function readSeedState(vars: ReadSeedStateVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReadSeedStateData>>;

/** Generated Node Admin SDK operation action function for the 'ReadMembership' Query. Allow users to execute without passing in DataConnect. */
export function readMembership(dc: DataConnect, vars: ReadMembershipVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReadMembershipData>>;
/** Generated Node Admin SDK operation action function for the 'ReadMembership' Query. Allow users to pass in custom DataConnect instances. */
export function readMembership(vars: ReadMembershipVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReadMembershipData>>;

/** Generated Node Admin SDK operation action function for the 'UpsertBusiness' Mutation. Allow users to execute without passing in DataConnect. */
export function upsertBusiness(dc: DataConnect, vars: UpsertBusinessVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpsertBusinessData>>;
/** Generated Node Admin SDK operation action function for the 'UpsertBusiness' Mutation. Allow users to pass in custom DataConnect instances. */
export function upsertBusiness(vars: UpsertBusinessVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpsertBusinessData>>;

/** Generated Node Admin SDK operation action function for the 'UpsertLocation' Mutation. Allow users to execute without passing in DataConnect. */
export function upsertLocation(dc: DataConnect, vars: UpsertLocationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpsertLocationData>>;
/** Generated Node Admin SDK operation action function for the 'UpsertLocation' Mutation. Allow users to pass in custom DataConnect instances. */
export function upsertLocation(vars: UpsertLocationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpsertLocationData>>;

/** Generated Node Admin SDK operation action function for the 'UpsertProduct' Mutation. Allow users to execute without passing in DataConnect. */
export function upsertProduct(dc: DataConnect, vars: UpsertProductVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpsertProductData>>;
/** Generated Node Admin SDK operation action function for the 'UpsertProduct' Mutation. Allow users to pass in custom DataConnect instances. */
export function upsertProduct(vars: UpsertProductVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpsertProductData>>;

/** Generated Node Admin SDK operation action function for the 'InsertInventory' Mutation. Allow users to execute without passing in DataConnect. */
export function insertInventory(dc: DataConnect, vars: InsertInventoryVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<InsertInventoryData>>;
/** Generated Node Admin SDK operation action function for the 'InsertInventory' Mutation. Allow users to pass in custom DataConnect instances. */
export function insertInventory(vars: InsertInventoryVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<InsertInventoryData>>;

/** Generated Node Admin SDK operation action function for the 'UpsertMembership' Mutation. Allow users to execute without passing in DataConnect. */
export function upsertMembership(dc: DataConnect, vars: UpsertMembershipVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpsertMembershipData>>;
/** Generated Node Admin SDK operation action function for the 'UpsertMembership' Mutation. Allow users to pass in custom DataConnect instances. */
export function upsertMembership(vars: UpsertMembershipVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpsertMembershipData>>;

/** Generated Node Admin SDK operation action function for the 'UpsertSalonAccess' Mutation. Allow users to execute without passing in DataConnect. */
export function upsertSalonAccess(dc: DataConnect, vars: UpsertSalonAccessVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpsertSalonAccessData>>;
/** Generated Node Admin SDK operation action function for the 'UpsertSalonAccess' Mutation. Allow users to pass in custom DataConnect instances. */
export function upsertSalonAccess(vars: UpsertSalonAccessVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpsertSalonAccessData>>;

/** Generated Node Admin SDK operation action function for the 'InsertSalonSettings' Mutation. Allow users to execute without passing in DataConnect. */
export function insertSalonSettings(dc: DataConnect, vars: InsertSalonSettingsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<InsertSalonSettingsData>>;
/** Generated Node Admin SDK operation action function for the 'InsertSalonSettings' Mutation. Allow users to pass in custom DataConnect instances. */
export function insertSalonSettings(vars: InsertSalonSettingsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<InsertSalonSettingsData>>;

/** Generated Node Admin SDK operation action function for the 'ReadKnowledgeWipeCounts' Query. Allow users to execute without passing in DataConnect. */
export function readKnowledgeWipeCounts(dc: DataConnect, vars: ReadKnowledgeWipeCountsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReadKnowledgeWipeCountsData>>;
/** Generated Node Admin SDK operation action function for the 'ReadKnowledgeWipeCounts' Query. Allow users to pass in custom DataConnect instances. */
export function readKnowledgeWipeCounts(vars: ReadKnowledgeWipeCountsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReadKnowledgeWipeCountsData>>;

/** Generated Node Admin SDK operation action function for the 'WipeDemoKnowledge' Mutation. Allow users to execute without passing in DataConnect. */
export function wipeDemoKnowledge(dc: DataConnect, vars: WipeDemoKnowledgeVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<WipeDemoKnowledgeData>>;
/** Generated Node Admin SDK operation action function for the 'WipeDemoKnowledge' Mutation. Allow users to pass in custom DataConnect instances. */
export function wipeDemoKnowledge(vars: WipeDemoKnowledgeVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<WipeDemoKnowledgeData>>;

/** Generated Node Admin SDK operation action function for the 'SeedProductCardAttachment' Mutation. Allow users to execute without passing in DataConnect. */
export function seedProductCardAttachment(dc: DataConnect, vars: SeedProductCardAttachmentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SeedProductCardAttachmentData>>;
/** Generated Node Admin SDK operation action function for the 'SeedProductCardAttachment' Mutation. Allow users to pass in custom DataConnect instances. */
export function seedProductCardAttachment(vars: SeedProductCardAttachmentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SeedProductCardAttachmentData>>;

/** Generated Node Admin SDK operation action function for the 'SeedDeliveryProcedureBindings' Mutation. Allow users to execute without passing in DataConnect. */
export function seedDeliveryProcedureBindings(dc: DataConnect, vars: SeedDeliveryProcedureBindingsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SeedDeliveryProcedureBindingsData>>;
/** Generated Node Admin SDK operation action function for the 'SeedDeliveryProcedureBindings' Mutation. Allow users to pass in custom DataConnect instances. */
export function seedDeliveryProcedureBindings(vars: SeedDeliveryProcedureBindingsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SeedDeliveryProcedureBindingsData>>;

/** Generated Node Admin SDK operation action function for the 'ReadResetCounts' Query. Allow users to execute without passing in DataConnect. */
export function readResetCounts(dc: DataConnect, vars: ReadResetCountsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReadResetCountsData>>;
/** Generated Node Admin SDK operation action function for the 'ReadResetCounts' Query. Allow users to pass in custom DataConnect instances. */
export function readResetCounts(vars: ReadResetCountsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReadResetCountsData>>;

/** Generated Node Admin SDK operation action function for the 'ResetDemoStock' Mutation. Allow users to execute without passing in DataConnect. */
export function resetDemoStock(dc: DataConnect, vars: ResetDemoStockVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ResetDemoStockData>>;
/** Generated Node Admin SDK operation action function for the 'ResetDemoStock' Mutation. Allow users to pass in custom DataConnect instances. */
export function resetDemoStock(vars: ResetDemoStockVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ResetDemoStockData>>;

/** Generated Node Admin SDK operation action function for the 'ApproveStock' Mutation. Allow users to execute without passing in DataConnect. */
export function approveStock(dc: DataConnect, vars: ApproveStockVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ApproveStockData>>;
/** Generated Node Admin SDK operation action function for the 'ApproveStock' Mutation. Allow users to pass in custom DataConnect instances. */
export function approveStock(vars: ApproveStockVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ApproveStockData>>;

/** Generated Node Admin SDK operation action function for the 'StockContext' Query. Allow users to execute without passing in DataConnect. */
export function stockContext(dc: DataConnect, vars: StockContextVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<StockContextData>>;
/** Generated Node Admin SDK operation action function for the 'StockContext' Query. Allow users to pass in custom DataConnect instances. */
export function stockContext(vars: StockContextVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<StockContextData>>;

/** Generated Node Admin SDK operation action function for the 'DispatchStock' Mutation. Allow users to execute without passing in DataConnect. */
export function dispatchStock(dc: DataConnect, vars: DispatchStockVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DispatchStockData>>;
/** Generated Node Admin SDK operation action function for the 'DispatchStock' Mutation. Allow users to pass in custom DataConnect instances. */
export function dispatchStock(vars: DispatchStockVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DispatchStockData>>;

/** Generated Node Admin SDK operation action function for the 'RejectStock' Mutation. Allow users to execute without passing in DataConnect. */
export function rejectStock(dc: DataConnect, vars: RejectStockVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RejectStockData>>;
/** Generated Node Admin SDK operation action function for the 'RejectStock' Mutation. Allow users to pass in custom DataConnect instances. */
export function rejectStock(vars: RejectStockVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RejectStockData>>;

/** Generated Node Admin SDK operation action function for the 'BindReplayKey' Mutation. Allow users to execute without passing in DataConnect. */
export function bindReplayKey(dc: DataConnect, vars: BindReplayKeyVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<BindReplayKeyData>>;
/** Generated Node Admin SDK operation action function for the 'BindReplayKey' Mutation. Allow users to pass in custom DataConnect instances. */
export function bindReplayKey(vars: BindReplayKeyVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<BindReplayKeyData>>;

/** Generated Node Admin SDK operation action function for the 'SubmitStock' Mutation. Allow users to execute without passing in DataConnect. */
export function submitStock(dc: DataConnect, vars: SubmitStockVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SubmitStockData>>;
/** Generated Node Admin SDK operation action function for the 'SubmitStock' Mutation. Allow users to pass in custom DataConnect instances. */
export function submitStock(vars: SubmitStockVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SubmitStockData>>;

