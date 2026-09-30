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

export interface SalonAccess_Key {
  membershipUid: string;
  locationId: string;
  __typename?: 'SalonAccess_Key';
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

