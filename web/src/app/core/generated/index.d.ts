import { ConnectorConfig, DataConnect, QueryRef, QueryPromise, ExecuteQueryOptions, MutationRef, MutationPromise } from 'firebase/data-connect';

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
};

export enum DeliveryProblemKind {
  DAMAGED = "DAMAGED",
  MISSING = "MISSING",
};

export enum MemberRole {
  HQ = "HQ",
  SALON = "SALON",
};

export enum MovementType {
  DISPATCH = "DISPATCH",
  RECEIPT = "RECEIPT",
};

export enum RequestState {
  PENDING_APPROVAL = "PENDING_APPROVAL",
  RESERVED = "RESERVED",
  DISPATCHED = "DISPATCHED",
  RECEIVED = "RECEIVED",
  REJECTED = "REJECTED",
  RECEIVED_WITH_ISSUE = "RECEIVED_WITH_ISSUE",
};



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

interface GetMyMembershipRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetMyMembershipData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<GetMyMembershipData, undefined>;
  operationName: string;
}
export const getMyMembershipRef: GetMyMembershipRef;

export function getMyMembership(options?: ExecuteQueryOptions): QueryPromise<GetMyMembershipData, undefined>;
export function getMyMembership(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<GetMyMembershipData, undefined>;

interface ListProductsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars?: ListProductsVariables): QueryRef<ListProductsData, ListProductsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars?: ListProductsVariables): QueryRef<ListProductsData, ListProductsVariables>;
  operationName: string;
}
export const listProductsRef: ListProductsRef;

export function listProducts(vars?: ListProductsVariables, options?: ExecuteQueryOptions): QueryPromise<ListProductsData, ListProductsVariables>;
export function listProducts(dc: DataConnect, vars?: ListProductsVariables, options?: ExecuteQueryOptions): QueryPromise<ListProductsData, ListProductsVariables>;

interface GetSalonInventoryRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetSalonInventoryVariables): QueryRef<GetSalonInventoryData, GetSalonInventoryVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetSalonInventoryVariables): QueryRef<GetSalonInventoryData, GetSalonInventoryVariables>;
  operationName: string;
}
export const getSalonInventoryRef: GetSalonInventoryRef;

export function getSalonInventory(vars: GetSalonInventoryVariables, options?: ExecuteQueryOptions): QueryPromise<GetSalonInventoryData, GetSalonInventoryVariables>;
export function getSalonInventory(dc: DataConnect, vars: GetSalonInventoryVariables, options?: ExecuteQueryOptions): QueryPromise<GetSalonInventoryData, GetSalonInventoryVariables>;

interface GetHqInventoryRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars?: GetHqInventoryVariables): QueryRef<GetHqInventoryData, GetHqInventoryVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars?: GetHqInventoryVariables): QueryRef<GetHqInventoryData, GetHqInventoryVariables>;
  operationName: string;
}
export const getHqInventoryRef: GetHqInventoryRef;

export function getHqInventory(vars?: GetHqInventoryVariables, options?: ExecuteQueryOptions): QueryPromise<GetHqInventoryData, GetHqInventoryVariables>;
export function getHqInventory(dc: DataConnect, vars?: GetHqInventoryVariables, options?: ExecuteQueryOptions): QueryPromise<GetHqInventoryData, GetHqInventoryVariables>;

interface GetDeliveryReceiptRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetDeliveryReceiptVariables): QueryRef<GetDeliveryReceiptData, GetDeliveryReceiptVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetDeliveryReceiptVariables): QueryRef<GetDeliveryReceiptData, GetDeliveryReceiptVariables>;
  operationName: string;
}
export const getDeliveryReceiptRef: GetDeliveryReceiptRef;

export function getDeliveryReceipt(vars: GetDeliveryReceiptVariables, options?: ExecuteQueryOptions): QueryPromise<GetDeliveryReceiptData, GetDeliveryReceiptVariables>;
export function getDeliveryReceipt(dc: DataConnect, vars: GetDeliveryReceiptVariables, options?: ExecuteQueryOptions): QueryPromise<GetDeliveryReceiptData, GetDeliveryReceiptVariables>;

interface GetDeliveryIssueRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetDeliveryIssueVariables): QueryRef<GetDeliveryIssueData, GetDeliveryIssueVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetDeliveryIssueVariables): QueryRef<GetDeliveryIssueData, GetDeliveryIssueVariables>;
  operationName: string;
}
export const getDeliveryIssueRef: GetDeliveryIssueRef;

export function getDeliveryIssue(vars: GetDeliveryIssueVariables, options?: ExecuteQueryOptions): QueryPromise<GetDeliveryIssueData, GetDeliveryIssueVariables>;
export function getDeliveryIssue(dc: DataConnect, vars: GetDeliveryIssueVariables, options?: ExecuteQueryOptions): QueryPromise<GetDeliveryIssueData, GetDeliveryIssueVariables>;

interface ListDeliveryIssuesRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListDeliveryIssuesVariables): QueryRef<ListDeliveryIssuesData, ListDeliveryIssuesVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ListDeliveryIssuesVariables): QueryRef<ListDeliveryIssuesData, ListDeliveryIssuesVariables>;
  operationName: string;
}
export const listDeliveryIssuesRef: ListDeliveryIssuesRef;

export function listDeliveryIssues(vars: ListDeliveryIssuesVariables, options?: ExecuteQueryOptions): QueryPromise<ListDeliveryIssuesData, ListDeliveryIssuesVariables>;
export function listDeliveryIssues(dc: DataConnect, vars: ListDeliveryIssuesVariables, options?: ExecuteQueryOptions): QueryPromise<ListDeliveryIssuesData, ListDeliveryIssuesVariables>;

interface GetDeliveryProcedureBindingsRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetDeliveryProcedureBindingsData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<GetDeliveryProcedureBindingsData, undefined>;
  operationName: string;
}
export const getDeliveryProcedureBindingsRef: GetDeliveryProcedureBindingsRef;

export function getDeliveryProcedureBindings(options?: ExecuteQueryOptions): QueryPromise<GetDeliveryProcedureBindingsData, undefined>;
export function getDeliveryProcedureBindings(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<GetDeliveryProcedureBindingsData, undefined>;

interface ListDeliveryProcedureDocumentsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars?: ListDeliveryProcedureDocumentsVariables): QueryRef<ListDeliveryProcedureDocumentsData, ListDeliveryProcedureDocumentsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars?: ListDeliveryProcedureDocumentsVariables): QueryRef<ListDeliveryProcedureDocumentsData, ListDeliveryProcedureDocumentsVariables>;
  operationName: string;
}
export const listDeliveryProcedureDocumentsRef: ListDeliveryProcedureDocumentsRef;

export function listDeliveryProcedureDocuments(vars?: ListDeliveryProcedureDocumentsVariables, options?: ExecuteQueryOptions): QueryPromise<ListDeliveryProcedureDocumentsData, ListDeliveryProcedureDocumentsVariables>;
export function listDeliveryProcedureDocuments(dc: DataConnect, vars?: ListDeliveryProcedureDocumentsVariables, options?: ExecuteQueryOptions): QueryPromise<ListDeliveryProcedureDocumentsData, ListDeliveryProcedureDocumentsVariables>;

interface GetSourceSectionRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetSourceSectionVariables): QueryRef<GetSourceSectionData, GetSourceSectionVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetSourceSectionVariables): QueryRef<GetSourceSectionData, GetSourceSectionVariables>;
  operationName: string;
}
export const getSourceSectionRef: GetSourceSectionRef;

export function getSourceSection(vars: GetSourceSectionVariables, options?: ExecuteQueryOptions): QueryPromise<GetSourceSectionData, GetSourceSectionVariables>;
export function getSourceSection(dc: DataConnect, vars: GetSourceSectionVariables, options?: ExecuteQueryOptions): QueryPromise<GetSourceSectionData, GetSourceSectionVariables>;

interface ListPublishedKnowledgeDocumentsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListPublishedKnowledgeDocumentsVariables): QueryRef<ListPublishedKnowledgeDocumentsData, ListPublishedKnowledgeDocumentsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ListPublishedKnowledgeDocumentsVariables): QueryRef<ListPublishedKnowledgeDocumentsData, ListPublishedKnowledgeDocumentsVariables>;
  operationName: string;
}
export const listPublishedKnowledgeDocumentsRef: ListPublishedKnowledgeDocumentsRef;

export function listPublishedKnowledgeDocuments(vars: ListPublishedKnowledgeDocumentsVariables, options?: ExecuteQueryOptions): QueryPromise<ListPublishedKnowledgeDocumentsData, ListPublishedKnowledgeDocumentsVariables>;
export function listPublishedKnowledgeDocuments(dc: DataConnect, vars: ListPublishedKnowledgeDocumentsVariables, options?: ExecuteQueryOptions): QueryPromise<ListPublishedKnowledgeDocumentsData, ListPublishedKnowledgeDocumentsVariables>;

interface ListHqKnowledgeDocumentsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListHqKnowledgeDocumentsVariables): QueryRef<ListHqKnowledgeDocumentsData, ListHqKnowledgeDocumentsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ListHqKnowledgeDocumentsVariables): QueryRef<ListHqKnowledgeDocumentsData, ListHqKnowledgeDocumentsVariables>;
  operationName: string;
}
export const listHqKnowledgeDocumentsRef: ListHqKnowledgeDocumentsRef;

export function listHqKnowledgeDocuments(vars: ListHqKnowledgeDocumentsVariables, options?: ExecuteQueryOptions): QueryPromise<ListHqKnowledgeDocumentsData, ListHqKnowledgeDocumentsVariables>;
export function listHqKnowledgeDocuments(dc: DataConnect, vars: ListHqKnowledgeDocumentsVariables, options?: ExecuteQueryOptions): QueryPromise<ListHqKnowledgeDocumentsData, ListHqKnowledgeDocumentsVariables>;

interface GetKnowledgeReviewRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetKnowledgeReviewVariables): QueryRef<GetKnowledgeReviewData, GetKnowledgeReviewVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetKnowledgeReviewVariables): QueryRef<GetKnowledgeReviewData, GetKnowledgeReviewVariables>;
  operationName: string;
}
export const getKnowledgeReviewRef: GetKnowledgeReviewRef;

export function getKnowledgeReview(vars: GetKnowledgeReviewVariables, options?: ExecuteQueryOptions): QueryPromise<GetKnowledgeReviewData, GetKnowledgeReviewVariables>;
export function getKnowledgeReview(dc: DataConnect, vars: GetKnowledgeReviewVariables, options?: ExecuteQueryOptions): QueryPromise<GetKnowledgeReviewData, GetKnowledgeReviewVariables>;

interface GetKnowledgeProductReviewRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetKnowledgeProductReviewVariables): QueryRef<GetKnowledgeProductReviewData, GetKnowledgeProductReviewVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetKnowledgeProductReviewVariables): QueryRef<GetKnowledgeProductReviewData, GetKnowledgeProductReviewVariables>;
  operationName: string;
}
export const getKnowledgeProductReviewRef: GetKnowledgeProductReviewRef;

export function getKnowledgeProductReview(vars: GetKnowledgeProductReviewVariables, options?: ExecuteQueryOptions): QueryPromise<GetKnowledgeProductReviewData, GetKnowledgeProductReviewVariables>;
export function getKnowledgeProductReview(dc: DataConnect, vars: GetKnowledgeProductReviewVariables, options?: ExecuteQueryOptions): QueryPromise<GetKnowledgeProductReviewData, GetKnowledgeProductReviewVariables>;

interface ListSalonShorthandRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListSalonShorthandVariables): QueryRef<ListSalonShorthandData, ListSalonShorthandVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ListSalonShorthandVariables): QueryRef<ListSalonShorthandData, ListSalonShorthandVariables>;
  operationName: string;
}
export const listSalonShorthandRef: ListSalonShorthandRef;

export function listSalonShorthand(vars: ListSalonShorthandVariables, options?: ExecuteQueryOptions): QueryPromise<ListSalonShorthandData, ListSalonShorthandVariables>;
export function listSalonShorthand(dc: DataConnect, vars: ListSalonShorthandVariables, options?: ExecuteQueryOptions): QueryPromise<ListSalonShorthandData, ListSalonShorthandVariables>;

interface ListHqShorthandRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListHqShorthandVariables): QueryRef<ListHqShorthandData, ListHqShorthandVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ListHqShorthandVariables): QueryRef<ListHqShorthandData, ListHqShorthandVariables>;
  operationName: string;
}
export const listHqShorthandRef: ListHqShorthandRef;

export function listHqShorthand(vars: ListHqShorthandVariables, options?: ExecuteQueryOptions): QueryPromise<ListHqShorthandData, ListHqShorthandVariables>;
export function listHqShorthand(dc: DataConnect, vars: ListHqShorthandVariables, options?: ExecuteQueryOptions): QueryPromise<ListHqShorthandData, ListHqShorthandVariables>;

interface GetSalonSettingsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetSalonSettingsVariables): QueryRef<GetSalonSettingsData, GetSalonSettingsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetSalonSettingsVariables): QueryRef<GetSalonSettingsData, GetSalonSettingsVariables>;
  operationName: string;
}
export const getSalonSettingsRef: GetSalonSettingsRef;

export function getSalonSettings(vars: GetSalonSettingsVariables, options?: ExecuteQueryOptions): QueryPromise<GetSalonSettingsData, GetSalonSettingsVariables>;
export function getSalonSettings(dc: DataConnect, vars: GetSalonSettingsVariables, options?: ExecuteQueryOptions): QueryPromise<GetSalonSettingsData, GetSalonSettingsVariables>;

interface SaveSalonSettingsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: SaveSalonSettingsVariables): MutationRef<SaveSalonSettingsData, SaveSalonSettingsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: SaveSalonSettingsVariables): MutationRef<SaveSalonSettingsData, SaveSalonSettingsVariables>;
  operationName: string;
}
export const saveSalonSettingsRef: SaveSalonSettingsRef;

export function saveSalonSettings(vars: SaveSalonSettingsVariables): MutationPromise<SaveSalonSettingsData, SaveSalonSettingsVariables>;
export function saveSalonSettings(dc: DataConnect, vars: SaveSalonSettingsVariables): MutationPromise<SaveSalonSettingsData, SaveSalonSettingsVariables>;

interface ListActiveRequestsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListActiveRequestsVariables): QueryRef<ListActiveRequestsData, ListActiveRequestsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ListActiveRequestsVariables): QueryRef<ListActiveRequestsData, ListActiveRequestsVariables>;
  operationName: string;
}
export const listActiveRequestsRef: ListActiveRequestsRef;

export function listActiveRequests(vars: ListActiveRequestsVariables, options?: ExecuteQueryOptions): QueryPromise<ListActiveRequestsData, ListActiveRequestsVariables>;
export function listActiveRequests(dc: DataConnect, vars: ListActiveRequestsVariables, options?: ExecuteQueryOptions): QueryPromise<ListActiveRequestsData, ListActiveRequestsVariables>;

interface ListHqQueueRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars?: ListHqQueueVariables): QueryRef<ListHqQueueData, ListHqQueueVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars?: ListHqQueueVariables): QueryRef<ListHqQueueData, ListHqQueueVariables>;
  operationName: string;
}
export const listHqQueueRef: ListHqQueueRef;

export function listHqQueue(vars?: ListHqQueueVariables, options?: ExecuteQueryOptions): QueryPromise<ListHqQueueData, ListHqQueueVariables>;
export function listHqQueue(dc: DataConnect, vars?: ListHqQueueVariables, options?: ExecuteQueryOptions): QueryPromise<ListHqQueueData, ListHqQueueVariables>;

interface GetRequestDetailRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetRequestDetailVariables): QueryRef<GetRequestDetailData, GetRequestDetailVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetRequestDetailVariables): QueryRef<GetRequestDetailData, GetRequestDetailVariables>;
  operationName: string;
}
export const getRequestDetailRef: GetRequestDetailRef;

export function getRequestDetail(vars: GetRequestDetailVariables, options?: ExecuteQueryOptions): QueryPromise<GetRequestDetailData, GetRequestDetailVariables>;
export function getRequestDetail(dc: DataConnect, vars: GetRequestDetailVariables, options?: ExecuteQueryOptions): QueryPromise<GetRequestDetailData, GetRequestDetailVariables>;

interface ListSalonRequestsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListSalonRequestsVariables): QueryRef<ListSalonRequestsData, ListSalonRequestsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ListSalonRequestsVariables): QueryRef<ListSalonRequestsData, ListSalonRequestsVariables>;
  operationName: string;
}
export const listSalonRequestsRef: ListSalonRequestsRef;

export function listSalonRequests(vars: ListSalonRequestsVariables, options?: ExecuteQueryOptions): QueryPromise<ListSalonRequestsData, ListSalonRequestsVariables>;
export function listSalonRequests(dc: DataConnect, vars: ListSalonRequestsVariables, options?: ExecuteQueryOptions): QueryPromise<ListSalonRequestsData, ListSalonRequestsVariables>;

