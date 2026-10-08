import { ConnectorConfig, DataConnect, OperationOptions, ExecuteOperationResponse } from 'firebase-admin/data-connect';

export const connectorConfig: ConnectorConfig;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;

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

export interface Business_Key {
  id: string;
  __typename?: 'Business_Key';
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
          state: RequestState;
          createdAt: TimestampString;
          action: StockActionType;
          reason?: string | null;
        })[];
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

export interface Inventory_Key {
  locationId: string;
  productId: string;
  __typename?: 'Inventory_Key';
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

export interface Location_Key {
  id: string;
  __typename?: 'Location_Key';
}

export interface Membership_Key {
  uid: string;
  __typename?: 'Membership_Key';
}

export interface Product_Key {
  id: string;
  __typename?: 'Product_Key';
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

