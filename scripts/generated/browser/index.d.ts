import { ConnectorConfig, DataConnect, OperationOptions, ExecuteOperationResponse } from 'firebase-admin/data-connect';

export const connectorConfig: ConnectorConfig;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;

export type LocationKind = "HQ" | "SALON";
export type DeliveryIssueEventType = "OPENED" | "REVIEW_STARTED" | "NOTE_ADDED" | "REPLACEMENT_CREATED" | "REPLACEMENT_REJECTED" | "REPLACEMENT_RECEIVED";
export type DeliveryReceiptOrigin = "RECORDED" | "LEGACY";
export type KnowledgeDocumentKind = "PROCEDURE" | "POLICY" | "PRODUCT_CARD" | "PRODUCT_CATALOG";
export type KnowledgeGeometryStatus = "VERIFIED" | "UNAVAILABLE";
export type KnowledgeOrigin = "OFFICIAL" | "PUBLIC_COMPILATION" | "SYNTHETIC";
export type KnowledgePageQuality = "COMPLETE" | "NEEDS_REVIEW";
export type KnowledgePendingStage = "EXTRACT" | "PUBLISH";
export type KnowledgeProcessingStatus = "STAGED" | "EXTRACTED" | "REVIEWED" | "EMBEDDED" | "READY" | "NEEDS_REVIEW" | "FAILED";
export type KnowledgePublicationStatus = "DEMO_CURRENT" | "RETIRED";
export type KnowledgeSourceType = "SYNTHETIC_PROCEDURE" | "PUBLIC_PRODUCT_SUMMARY";
export type ProductAliasKind = "NAME" | "TYPE" | "PHONETIC";
export type ProductAliasSource = "GENERATED" | "HQ" | "SALON_CONFIRMED" | "SEED";
export type ProductAliasStatus = "PROPOSED" | "ACTIVE" | "REJECTED" | "RETIRED";
export type StockActionType = "SUBMIT" | "APPROVE" | "REJECT" | "DISPATCH" | "RECEIVE";

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
export enum MemberRole {
  HQ = "HQ",
  SALON = "SALON",
}
export enum MovementType {
  DISPATCH = "DISPATCH",
  RECEIPT = "RECEIPT",
}
export enum RequestState {
  PENDING_APPROVAL = "PENDING_APPROVAL",
  RESERVED = "RESERVED",
  DISPATCHED = "DISPATCHED",
  RECEIVED = "RECEIVED",
  REJECTED = "REJECTED",
  RECEIVED_WITH_ISSUE = "RECEIVED_WITH_ISSUE",
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

export interface AiUsageWindow_Key {
  uid: string;
  hourStart: TimestampString;
  __typename?: 'AiUsageWindow_Key';
}

export interface Business_Key {
  id: string;
  __typename?: 'Business_Key';
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

export interface GetDeliveryIssueData {
  membership?: {
    business: {
      issues: ({
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
        events: ({
          id: string;
          revision: number;
          actorUid: string;
          recordedAt: TimestampString;
          type: DeliveryIssueEventType;
          status: DeliveryIssueStatus;
          requestId?: string | null;
          note?: string | null;
          quantities: unknown;
        } & DeliveryIssueEvent_Key)[];
        replacements: ({
          id: string;
          state: RequestState;
          createdAt: TimestampString;
        } & ReplenishmentRequest_Key)[];
      } & DeliveryIssue_Key)[];
    };
  };
}

export interface GetDeliveryIssueVariables {
  issueId: string;
  eventLimit?: number;
  eventOffset?: number;
  replacementLimit?: number;
  replacementOffset?: number;
}

export interface GetDeliveryProcedureBindingsData {
  membership?: {
    businessId: string;
    business: {
      bindings: ({
        kind: DeliveryProblemKind;
        documentId?: string | null;
        revision: number;
        updatedAt: TimestampString;
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
  };
}

export interface GetDeliveryReceiptData {
  membership?: {
    business: {
      requests: ({
        id: string;
        salonId: string;
        state: RequestState;
        revision: number;
        replacementIssueId?: string | null;
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
          status: DeliveryIssueStatus;
          revision: number;
        } & DeliveryIssue_Key;
      } & ReplenishmentRequest_Key)[];
    };
  };
}

export interface GetDeliveryReceiptVariables {
  requestId: string;
}

export interface GetHqInventoryData {
  membership?: {
    business: {
      hq: ({
        id: string;
        name: string;
        inventory: ({
          onHand: number;
          reserved: number;
          version: number;
          product: {
            id: string;
            demoId: string;
            name: string;
            netContentMl: number;
          } & Product_Key;
        })[];
      } & Location_Key)[];
    };
  };
}

export interface GetHqInventoryVariables {
  limit?: number;
  offset?: number;
}

export interface GetKnowledgeProductReviewData {
  membership?: {
    business: {
      productKnowledgeRevision: number;
      products: ({
        id: string;
        name: string;
        sourceCode: string;
        type?: string | null;
        category: string;
        summaryEn: string;
        scentPl?: string | null;
      } & Product_Key)[];
      versions: ({
        id: string;
        kind?: KnowledgeDocumentKind | null;
        extractionHash?: string | null;
        publishedAt?: TimestampString | null;
        revokedAt?: TimestampString | null;
        pendingStage?: KnowledgePendingStage | null;
        productKnowledgeRevision: number;
        productKnowledgeReviewedHash?: string | null;
        productKnowledgeCatalogRevision?: number | null;
        productKnowledgeState?: unknown | null;
        document: {
          activeVersionId?: string | null;
        };
        chunks: ({
          id: string;
          text: string;
          physicalPage: number;
        } & KnowledgeChunk_Key)[];
        links: ({
          id: string;
          productId?: string | null;
          chunkId: string;
          start: number;
          end: number;
          method: string;
          confirmed: boolean;
          candidateProductIds: unknown;
          extractionHash: string;
        } & KnowledgeProductLink_Key)[];
        profiles: ({
          productId: string;
          proposedType?: string | null;
          approvedType?: string | null;
          reviewedBy?: string | null;
          reviewedAt?: TimestampString | null;
        })[];
        aliases: ({
          id: string;
          productId: string;
          phrase: string;
          kind: ProductAliasKind;
          lang: string;
          source: ProductAliasSource;
          status: ProductAliasStatus;
          reviewedAt?: TimestampString | null;
        } & ProductAlias_Key)[];
      } & KnowledgeVersion_Key)[];
    };
  };
  activeAliases?: unknown[] | null;
}

export interface GetKnowledgeProductReviewVariables {
  versionId: string;
}

export interface GetKnowledgeReviewData {
  membership?: {
    business: {
      versions: ({
        id: string;
        documentId: string;
        businessId: string;
        versionLabel: string;
        title: string;
        language: string;
        sourceUrls: unknown;
        observedOn?: DateString | null;
        sourceType?: KnowledgeSourceType | null;
        kind?: KnowledgeDocumentKind | null;
        origin?: KnowledgeOrigin | null;
        synthetic: boolean;
        publicationStatus: KnowledgePublicationStatus;
        isActive: boolean;
        pageCount?: number | null;
        status: KnowledgeProcessingStatus;
        revision: number;
        document: {
          activeVersionId?: string | null;
          revision: number;
        };
        revokedAt?: TimestampString | null;
        pdfSha256: string;
        publishedAt?: TimestampString | null;
        pendingStage?: KnowledgePendingStage | null;
        processingError?: string | null;
        extractionHash?: string | null;
        createdAt: TimestampString;
        pages: ({
          physicalPage: number;
          text: string;
          markdown: string;
          spans: unknown;
          printedLabel?: string | null;
          quality: KnowledgePageQuality;
          reviewed: boolean;
          viewBox: unknown;
          userUnit: number;
          rotation: number;
        })[];
      } & KnowledgeVersion_Key)[];
    };
  };
}

export interface GetKnowledgeReviewVariables {
  versionId: string;
}

export interface GetMyMembershipData {
  membership?: {
    uid: string;
    businessId: string;
    role: MemberRole;
    salonAccesses_on_membership: ({
      location: {
        id: string;
        name: string;
        key: string;
        kind: LocationKind;
        businessId: string;
      } & Location_Key;
    })[];
    business: {
      locations_on_business: ({
        id: string;
        name: string;
        key: string;
      } & Location_Key)[];
    };
  } & Membership_Key;
}

export interface GetRequestDetailData {
  membership?: {
    business: {
      requests: ({
        id: string;
        salonId: string;
        state: RequestState;
        revision: number;
        createdAt: TimestampString;
        replacementIssueId?: string | null;
        replacementIssue?: {
          id: string;
          status: DeliveryIssueStatus;
          revision: number;
        } & DeliveryIssue_Key;
        replacementCreation: ({
          id: string;
          recordedAt: TimestampString;
        } & DeliveryIssueEvent_Key)[];
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
        salon: {
          name: string;
        };
        items: ({
          id: string;
          productId: string;
          quantity: number;
          product: {
            name: string;
          };
          transferItem?: {
            dispatchedQuantity: number;
            receivedQuantity: number;
          };
        } & RequestItem_Key)[];
        timeline: ({
          id: string;
          revision: number;
          state: RequestState;
          createdAt: TimestampString;
          action: StockActionType;
          reason?: string | null;
        } & ActionReceipt_Key)[];
      } & ReplenishmentRequest_Key)[];
    };
  };
}

export interface GetRequestDetailVariables {
  requestId: string;
}

export interface GetSalonInventoryData {
  membership?: {
    business: {
      salon: ({
        id: string;
        name: string;
        inventory: ({
          onHand: number;
          reserved: number;
          version: number;
          product: {
            id: string;
            demoId: string;
            name: string;
            netContentMl: number;
          } & Product_Key;
        })[];
      } & Location_Key)[];
      hq: ({
        inventory: ({
          productId: string;
          onHand: number;
          reserved: number;
          version: number;
        })[];
      })[];
    };
  };
}

export interface GetSalonInventoryVariables {
  salonId: string;
  limit?: number;
  offset?: number;
}

export interface GetSalonSettingsData {
  settings?: {
    salonId: string;
    lowStockThreshold: number;
    version: number;
    updatedAt: TimestampString;
  } & SalonSettings_Key;
}

export interface GetSalonSettingsVariables {
  salonId: string;
}

export interface GetSourceSectionData {
  membership?: {
    business: {
      versions: ({
        id: string;
        documentId: string;
        businessId: string;
        versionLabel: string;
        title: string;
        language: string;
        sourceUrls: unknown;
        observedOn?: DateString | null;
        sourceType?: KnowledgeSourceType | null;
        kind?: KnowledgeDocumentKind | null;
        origin?: KnowledgeOrigin | null;
        synthetic: boolean;
        isActive: boolean;
        pageCount?: number | null;
        publishedAt?: TimestampString | null;
        status: KnowledgeProcessingStatus;
        revokedAt?: TimestampString | null;
        document: {
          documentCode: string;
        };
        chunks: ({
          id: string;
          sectionId: string;
          physicalPage: number;
          text: string;
          rects: unknown;
          geometryStatus: KnowledgeGeometryStatus;
        } & KnowledgeChunk_Key)[];
        pages: ({
          physicalPage: number;
          text: string;
          viewBox: unknown;
          userUnit: number;
          rotation: number;
        })[];
      } & KnowledgeVersion_Key)[];
    };
  };
}

export interface GetSourceSectionVariables {
  versionId: string;
  chunkId?: string | null;
}

export interface HqStockAdjustment_Key {
  id: string;
  __typename?: 'HqStockAdjustment_Key';
}

export interface Inventory_Key {
  locationId: string;
  productId: string;
  __typename?: 'Inventory_Key';
}

export interface KnowledgeChunk_Key {
  id: string;
  __typename?: 'KnowledgeChunk_Key';
}

export interface KnowledgeDocument_Key {
  id: string;
  __typename?: 'KnowledgeDocument_Key';
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

export interface KnowledgeVersion_Key {
  id: string;
  __typename?: 'KnowledgeVersion_Key';
}

export interface ListActiveRequestsData {
  membership?: {
    business: {
      requests: ({
        id: string;
        salonId: string;
        state: RequestState;
        revision: number;
        createdAt: TimestampString;
        salon: {
          name: string;
        };
        items: ({
          id: string;
          productId: string;
          quantity: number;
          product: {
            name: string;
          };
          transferItem?: {
            dispatchedQuantity: number;
            receivedQuantity: number;
          };
        } & RequestItem_Key)[];
      } & ReplenishmentRequest_Key)[];
    };
  };
}

export interface ListActiveRequestsVariables {
  salonId: string;
  limit?: number;
  offset?: number;
}

export interface ListDeliveryIssuesData {
  membership?: {
    business: {
      openCounts: ({
        _count: number;
      })[];
      salonOpenCounts: ({
        _count: number;
      })[];
      issues: ({
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
      } & DeliveryIssue_Key)[];
      salonIssues: ({
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
      } & DeliveryIssue_Key)[];
    };
  };
}

export interface ListDeliveryIssuesVariables {
  allSalons: boolean;
  salonId?: string | null;
  statuses: DeliveryIssueStatus[];
  limit?: number;
  offset?: number;
}

export interface ListDeliveryProcedureDocumentsData {
  membership?: {
    business: {
      documents: ({
        id: string;
        documentId: string;
        title: string;
        document: {
          documentCode: string;
          activeVersionId?: string | null;
        };
      } & KnowledgeVersion_Key)[];
    };
  };
}

export interface ListDeliveryProcedureDocumentsVariables {
  limit?: number;
  offset?: number;
}

export interface ListHqKnowledgeDocumentsData {
  membership?: {
    business: {
      versions: ({
        id: string;
        documentId: string;
        businessId: string;
        versionLabel: string;
        title: string;
        language: string;
        sourceUrls: unknown;
        observedOn?: DateString | null;
        sourceType?: KnowledgeSourceType | null;
        kind?: KnowledgeDocumentKind | null;
        origin?: KnowledgeOrigin | null;
        synthetic: boolean;
        publicationStatus: KnowledgePublicationStatus;
        isActive: boolean;
        pageCount?: number | null;
        status: KnowledgeProcessingStatus;
        revision: number;
        document: {
          activeVersionId?: string | null;
          revision: number;
        };
        revokedAt?: TimestampString | null;
        pdfSha256: string;
        publishedAt?: TimestampString | null;
        pendingStage?: KnowledgePendingStage | null;
        processingError?: string | null;
        createdAt: TimestampString;
      } & KnowledgeVersion_Key)[];
    };
  };
}

export interface ListHqKnowledgeDocumentsVariables {
  limit: number;
  offset: number;
}

export interface ListHqQueueData {
  membership?: {
    business: {
      requests: ({
        id: string;
        salonId: string;
        state: RequestState;
        revision: number;
        createdAt: TimestampString;
        salon: {
          name: string;
        };
        items: ({
          id: string;
          productId: string;
          quantity: number;
          product: {
            name: string;
          };
          transferItem?: {
            dispatchedQuantity: number;
            receivedQuantity: number;
          };
        } & RequestItem_Key)[];
      } & ReplenishmentRequest_Key)[];
    };
  };
}

export interface ListHqQueueVariables {
  limit?: number;
  offset?: number;
}

export interface ListHqShorthandData {
  productAliases: ({
    id: string;
    businessId: string;
    phrase: string;
    revision: number;
    reviewedAt?: TimestampString | null;
    createdAt: TimestampString;
    salon?: {
      id: string;
      name: string;
      businessId: string;
    } & Location_Key;
    product: {
      id: string;
      name: string;
      businessId: string;
    } & Product_Key;
  } & ProductAlias_Key)[];
}

export interface ListHqShorthandVariables {
  businessId: string;
  after: string;
}

export interface ListProductsData {
  membership?: {
    business: {
      products_on_business: ({
        id: string;
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
      } & Product_Key)[];
    };
  };
}

export interface ListProductsVariables {
  limit?: number;
  offset?: number;
}

export interface ListPublishedKnowledgeDocumentsData {
  membership?: {
    business: {
      versions: ({
        id: string;
        documentId: string;
        businessId: string;
        versionLabel: string;
        title: string;
        language: string;
        sourceUrls: unknown;
        observedOn?: DateString | null;
        sourceType?: KnowledgeSourceType | null;
        kind?: KnowledgeDocumentKind | null;
        origin?: KnowledgeOrigin | null;
        synthetic: boolean;
        publicationStatus: KnowledgePublicationStatus;
        isActive: boolean;
        pageCount?: number | null;
        status: KnowledgeProcessingStatus;
        revision: number;
        document: {
          activeVersionId?: string | null;
          revision: number;
        };
        revokedAt?: TimestampString | null;
        pdfSha256: string;
        publishedAt?: TimestampString | null;
        pendingStage?: KnowledgePendingStage | null;
        createdAt: TimestampString;
      } & KnowledgeVersion_Key)[];
    };
  };
}

export interface ListPublishedKnowledgeDocumentsVariables {
  limit: number;
  offset: number;
}

export interface ListSalonRequestsData {
  membership?: {
    business: {
      requests: ({
        id: string;
        salonId: string;
        state: RequestState;
        revision: number;
        createdAt: TimestampString;
        salon: {
          name: string;
        };
        items: ({
          id: string;
          productId: string;
          quantity: number;
          product: {
            name: string;
          };
          transferItem?: {
            dispatchedQuantity: number;
            receivedQuantity: number;
          };
        } & RequestItem_Key)[];
      } & ReplenishmentRequest_Key)[];
    };
  };
}

export interface ListSalonRequestsVariables {
  salonId: string;
  states: RequestState[];
  limit?: number;
  offset?: number;
}

export interface ListSalonShorthandData {
  productAliases: ({
    id: string;
    businessId: string;
    phrase: string;
    revision: number;
    reviewedAt?: TimestampString | null;
    createdAt: TimestampString;
    salon?: {
      id: string;
      name: string;
      businessId: string;
    } & Location_Key;
    product: {
      id: string;
      name: string;
      businessId: string;
    } & Product_Key;
  } & ProductAlias_Key)[];
}

export interface ListSalonShorthandVariables {
  salonId: string;
  after: string;
}

export interface Location_Key {
  id: string;
  __typename?: 'Location_Key';
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

export interface ProductKnowledgeOperation_Key {
  id: string;
  __typename?: 'ProductKnowledgeOperation_Key';
}

export interface Product_Key {
  id: string;
  __typename?: 'Product_Key';
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

export interface SaveSalonSettingsData {
  changed: number;
  result?: {
    settings?: {
      salonId: string;
      lowStockThreshold: number;
      version: number;
      updatedAt: TimestampString;
    } & SalonSettings_Key;
  };
}

export interface SaveSalonSettingsVariables {
  salonId: string;
  lowStockThreshold: number;
  expectedVersion: number;
}

export interface StockMovement_Key {
  transferItemRequestItemId: string;
  type: MovementType;
  __typename?: 'StockMovement_Key';
}

export interface TransferItem_Key {
  requestItemId: string;
  __typename?: 'TransferItem_Key';
}

export interface Transfer_Key {
  requestId: string;
  __typename?: 'Transfer_Key';
}

/** Generated Node Admin SDK operation action function for the 'GetMyMembership' Query. Allow users to execute without passing in DataConnect. */
export function getMyMembership(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<GetMyMembershipData>>;
/** Generated Node Admin SDK operation action function for the 'GetMyMembership' Query. Allow users to pass in custom DataConnect instances. */
export function getMyMembership(options?: OperationOptions): Promise<ExecuteOperationResponse<GetMyMembershipData>>;

/** Generated Node Admin SDK operation action function for the 'ListProducts' Query. Allow users to execute without passing in DataConnect. */
export function listProducts(dc: DataConnect, vars?: ListProductsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListProductsData>>;
/** Generated Node Admin SDK operation action function for the 'ListProducts' Query. Allow users to pass in custom DataConnect instances. */
export function listProducts(vars?: ListProductsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListProductsData>>;

/** Generated Node Admin SDK operation action function for the 'GetSalonInventory' Query. Allow users to execute without passing in DataConnect. */
export function getSalonInventory(dc: DataConnect, vars: GetSalonInventoryVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetSalonInventoryData>>;
/** Generated Node Admin SDK operation action function for the 'GetSalonInventory' Query. Allow users to pass in custom DataConnect instances. */
export function getSalonInventory(vars: GetSalonInventoryVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetSalonInventoryData>>;

/** Generated Node Admin SDK operation action function for the 'GetHqInventory' Query. Allow users to execute without passing in DataConnect. */
export function getHqInventory(dc: DataConnect, vars?: GetHqInventoryVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetHqInventoryData>>;
/** Generated Node Admin SDK operation action function for the 'GetHqInventory' Query. Allow users to pass in custom DataConnect instances. */
export function getHqInventory(vars?: GetHqInventoryVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetHqInventoryData>>;

/** Generated Node Admin SDK operation action function for the 'GetDeliveryProcedureBindings' Query. Allow users to execute without passing in DataConnect. */
export function getDeliveryProcedureBindings(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<GetDeliveryProcedureBindingsData>>;
/** Generated Node Admin SDK operation action function for the 'GetDeliveryProcedureBindings' Query. Allow users to pass in custom DataConnect instances. */
export function getDeliveryProcedureBindings(options?: OperationOptions): Promise<ExecuteOperationResponse<GetDeliveryProcedureBindingsData>>;

/** Generated Node Admin SDK operation action function for the 'ListDeliveryProcedureDocuments' Query. Allow users to execute without passing in DataConnect. */
export function listDeliveryProcedureDocuments(dc: DataConnect, vars?: ListDeliveryProcedureDocumentsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListDeliveryProcedureDocumentsData>>;
/** Generated Node Admin SDK operation action function for the 'ListDeliveryProcedureDocuments' Query. Allow users to pass in custom DataConnect instances. */
export function listDeliveryProcedureDocuments(vars?: ListDeliveryProcedureDocumentsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListDeliveryProcedureDocumentsData>>;

/** Generated Node Admin SDK operation action function for the 'GetDeliveryReceipt' Query. Allow users to execute without passing in DataConnect. */
export function getDeliveryReceipt(dc: DataConnect, vars: GetDeliveryReceiptVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetDeliveryReceiptData>>;
/** Generated Node Admin SDK operation action function for the 'GetDeliveryReceipt' Query. Allow users to pass in custom DataConnect instances. */
export function getDeliveryReceipt(vars: GetDeliveryReceiptVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetDeliveryReceiptData>>;

/** Generated Node Admin SDK operation action function for the 'GetDeliveryIssue' Query. Allow users to execute without passing in DataConnect. */
export function getDeliveryIssue(dc: DataConnect, vars: GetDeliveryIssueVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetDeliveryIssueData>>;
/** Generated Node Admin SDK operation action function for the 'GetDeliveryIssue' Query. Allow users to pass in custom DataConnect instances. */
export function getDeliveryIssue(vars: GetDeliveryIssueVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetDeliveryIssueData>>;

/** Generated Node Admin SDK operation action function for the 'ListDeliveryIssues' Query. Allow users to execute without passing in DataConnect. */
export function listDeliveryIssues(dc: DataConnect, vars: ListDeliveryIssuesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListDeliveryIssuesData>>;
/** Generated Node Admin SDK operation action function for the 'ListDeliveryIssues' Query. Allow users to pass in custom DataConnect instances. */
export function listDeliveryIssues(vars: ListDeliveryIssuesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListDeliveryIssuesData>>;

/** Generated Node Admin SDK operation action function for the 'GetSourceSection' Query. Allow users to execute without passing in DataConnect. */
export function getSourceSection(dc: DataConnect, vars: GetSourceSectionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetSourceSectionData>>;
/** Generated Node Admin SDK operation action function for the 'GetSourceSection' Query. Allow users to pass in custom DataConnect instances. */
export function getSourceSection(vars: GetSourceSectionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetSourceSectionData>>;

/** Generated Node Admin SDK operation action function for the 'ListPublishedKnowledgeDocuments' Query. Allow users to execute without passing in DataConnect. */
export function listPublishedKnowledgeDocuments(dc: DataConnect, vars: ListPublishedKnowledgeDocumentsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListPublishedKnowledgeDocumentsData>>;
/** Generated Node Admin SDK operation action function for the 'ListPublishedKnowledgeDocuments' Query. Allow users to pass in custom DataConnect instances. */
export function listPublishedKnowledgeDocuments(vars: ListPublishedKnowledgeDocumentsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListPublishedKnowledgeDocumentsData>>;

/** Generated Node Admin SDK operation action function for the 'ListHqKnowledgeDocuments' Query. Allow users to execute without passing in DataConnect. */
export function listHqKnowledgeDocuments(dc: DataConnect, vars: ListHqKnowledgeDocumentsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListHqKnowledgeDocumentsData>>;
/** Generated Node Admin SDK operation action function for the 'ListHqKnowledgeDocuments' Query. Allow users to pass in custom DataConnect instances. */
export function listHqKnowledgeDocuments(vars: ListHqKnowledgeDocumentsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListHqKnowledgeDocumentsData>>;

/** Generated Node Admin SDK operation action function for the 'GetKnowledgeReview' Query. Allow users to execute without passing in DataConnect. */
export function getKnowledgeReview(dc: DataConnect, vars: GetKnowledgeReviewVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetKnowledgeReviewData>>;
/** Generated Node Admin SDK operation action function for the 'GetKnowledgeReview' Query. Allow users to pass in custom DataConnect instances. */
export function getKnowledgeReview(vars: GetKnowledgeReviewVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetKnowledgeReviewData>>;

/** Generated Node Admin SDK operation action function for the 'GetKnowledgeProductReview' Query. Allow users to execute without passing in DataConnect. */
export function getKnowledgeProductReview(dc: DataConnect, vars: GetKnowledgeProductReviewVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetKnowledgeProductReviewData>>;
/** Generated Node Admin SDK operation action function for the 'GetKnowledgeProductReview' Query. Allow users to pass in custom DataConnect instances. */
export function getKnowledgeProductReview(vars: GetKnowledgeProductReviewVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetKnowledgeProductReviewData>>;

/** Generated Node Admin SDK operation action function for the 'ListSalonShorthand' Query. Allow users to execute without passing in DataConnect. */
export function listSalonShorthand(dc: DataConnect, vars: ListSalonShorthandVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListSalonShorthandData>>;
/** Generated Node Admin SDK operation action function for the 'ListSalonShorthand' Query. Allow users to pass in custom DataConnect instances. */
export function listSalonShorthand(vars: ListSalonShorthandVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListSalonShorthandData>>;

/** Generated Node Admin SDK operation action function for the 'ListHqShorthand' Query. Allow users to execute without passing in DataConnect. */
export function listHqShorthand(dc: DataConnect, vars: ListHqShorthandVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListHqShorthandData>>;
/** Generated Node Admin SDK operation action function for the 'ListHqShorthand' Query. Allow users to pass in custom DataConnect instances. */
export function listHqShorthand(vars: ListHqShorthandVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListHqShorthandData>>;

/** Generated Node Admin SDK operation action function for the 'GetSalonSettings' Query. Allow users to execute without passing in DataConnect. */
export function getSalonSettings(dc: DataConnect, vars: GetSalonSettingsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetSalonSettingsData>>;
/** Generated Node Admin SDK operation action function for the 'GetSalonSettings' Query. Allow users to pass in custom DataConnect instances. */
export function getSalonSettings(vars: GetSalonSettingsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetSalonSettingsData>>;

/** Generated Node Admin SDK operation action function for the 'SaveSalonSettings' Mutation. Allow users to execute without passing in DataConnect. */
export function saveSalonSettings(dc: DataConnect, vars: SaveSalonSettingsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SaveSalonSettingsData>>;
/** Generated Node Admin SDK operation action function for the 'SaveSalonSettings' Mutation. Allow users to pass in custom DataConnect instances. */
export function saveSalonSettings(vars: SaveSalonSettingsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SaveSalonSettingsData>>;

/** Generated Node Admin SDK operation action function for the 'ListActiveRequests' Query. Allow users to execute without passing in DataConnect. */
export function listActiveRequests(dc: DataConnect, vars: ListActiveRequestsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListActiveRequestsData>>;
/** Generated Node Admin SDK operation action function for the 'ListActiveRequests' Query. Allow users to pass in custom DataConnect instances. */
export function listActiveRequests(vars: ListActiveRequestsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListActiveRequestsData>>;

/** Generated Node Admin SDK operation action function for the 'ListHqQueue' Query. Allow users to execute without passing in DataConnect. */
export function listHqQueue(dc: DataConnect, vars?: ListHqQueueVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListHqQueueData>>;
/** Generated Node Admin SDK operation action function for the 'ListHqQueue' Query. Allow users to pass in custom DataConnect instances. */
export function listHqQueue(vars?: ListHqQueueVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListHqQueueData>>;

/** Generated Node Admin SDK operation action function for the 'GetRequestDetail' Query. Allow users to execute without passing in DataConnect. */
export function getRequestDetail(dc: DataConnect, vars: GetRequestDetailVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetRequestDetailData>>;
/** Generated Node Admin SDK operation action function for the 'GetRequestDetail' Query. Allow users to pass in custom DataConnect instances. */
export function getRequestDetail(vars: GetRequestDetailVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetRequestDetailData>>;

/** Generated Node Admin SDK operation action function for the 'ListSalonRequests' Query. Allow users to execute without passing in DataConnect. */
export function listSalonRequests(dc: DataConnect, vars: ListSalonRequestsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListSalonRequestsData>>;
/** Generated Node Admin SDK operation action function for the 'ListSalonRequests' Query. Allow users to pass in custom DataConnect instances. */
export function listSalonRequests(vars: ListSalonRequestsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListSalonRequestsData>>;

