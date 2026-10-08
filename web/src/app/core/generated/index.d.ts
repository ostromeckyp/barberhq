import { ConnectorConfig, DataConnect, QueryRef, QueryPromise, ExecuteQueryOptions, MutationRef, MutationPromise } from 'firebase/data-connect';

export const connectorConfig: ConnectorConfig;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;


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

