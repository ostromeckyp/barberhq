import { ConnectorConfig, DataConnect, QueryRef, QueryPromise, ExecuteQueryOptions } from 'firebase/data-connect';

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
        productId: string;
        quantity: number;
        state: RequestState;
        revision: number;
        createdAt: TimestampString;
        product: {
          name: string;
        };
        salon: {
          name: string;
        };
        transfer?: {
          dispatchedQuantity: number;
          receivedQuantity: number;
        };
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
        productId: string;
        quantity: number;
        state: RequestState;
        revision: number;
        createdAt: TimestampString;
        product: {
          name: string;
        };
        salon: {
          name: string;
        };
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
        productId: string;
        quantity: number;
        state: RequestState;
        revision: number;
        createdAt: TimestampString;
        product: {
          name: string;
        };
        salon: {
          name: string;
        };
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

export interface SalonAccess_Key {
  membershipUid: string;
  locationId: string;
  __typename?: 'SalonAccess_Key';
}

export interface StockMovement_Key {
  transferRequestId: string;
  type: MovementType;
  __typename?: 'StockMovement_Key';
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

