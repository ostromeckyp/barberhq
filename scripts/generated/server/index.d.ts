import { ConnectorConfig, DataConnect, OperationOptions, ExecuteOperationResponse } from 'firebase-admin/data-connect';

export const connectorConfig: ConnectorConfig;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;

export enum LocationKind {
  HQ = "HQ",
  SALON = "SALON",
}
export enum MemberRole {
  HQ = "HQ",
  SALON = "SALON",
}

export interface Business_Key {
  id: string;
  __typename?: 'Business_Key';
}

export interface InsertInventoryData {
  inventory_insert: Inventory_Key;
}

export interface InsertInventoryVariables {
  locationId: string;
  productId: string;
  onHand: number;
}

export interface Inventory_Key {
  locationId: string;
  productId: string;
  __typename?: 'Inventory_Key';
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

export interface ReadSeedStateData {
  business?: {
    id: string;
    name: string;
  } & Business_Key;
  locations: ({
    id: string;
    key: string;
  } & Location_Key)[];
  products: ({
    id: string;
    demoId: string;
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

export interface SalonAccess_Key {
  membershipUid: string;
  locationId: string;
  __typename?: 'SalonAccess_Key';
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

export interface UpsertSalonAccessData {
  salonAccess_upsert: SalonAccess_Key;
}

export interface UpsertSalonAccessVariables {
  uid: string;
  locationId: string;
}

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

