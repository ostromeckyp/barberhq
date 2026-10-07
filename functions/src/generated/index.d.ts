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
export enum StockActionType {
  SUBMIT = "SUBMIT",
  APPROVE = "APPROVE",
  REJECT = "REJECT",
  DISPATCH = "DISPATCH",
  RECEIVE = "RECEIVE",
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

export interface ApproveStockData {
  changed: number;
  inventory_updateMany: number;
  transfer_insert: Transfer_Key;
  actionReceipt_insert: ActionReceipt_Key;
  actionKey_insert: ActionKey_Key;
}

export interface ApproveStockVariables {
  uid: string;
  businessId: string;
  requestId: string;
  revision: number;
  receiptId: string;
  key: string;
  payloadHash: string;
  semanticHash: string;
  inventoryVersion: number;
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

export interface DispatchStockData {
  changed: number;
  inventory_updateMany: number;
  transfer_updateMany: number;
  stockMovement_insert: StockMovement_Key;
  actionReceipt_insert: ActionReceipt_Key;
  actionKey_insert: ActionKey_Key;
}

export interface DispatchStockVariables {
  uid: string;
  businessId: string;
  requestId: string;
  revision: number;
  receiptId: string;
  key: string;
  payloadHash: string;
  semanticHash: string;
  inventoryVersion: number;
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

export interface ReadResetCountsData {
  requests: ({
    _count: number;
  })[];
  active: ({
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

export interface ReceiveStockData {
  changed: number;
  inventory_updateMany: number;
  transfer_updateMany: number;
  stockMovement_insert: StockMovement_Key;
  activeRequest_deleteMany: number;
  actionReceipt_insert: ActionReceipt_Key;
  actionKey_insert: ActionKey_Key;
}

export interface ReceiveStockVariables {
  uid: string;
  businessId: string;
  requestId: string;
  revision: number;
  receiptId: string;
  key: string;
  payloadHash: string;
  semanticHash: string;
  inventoryVersion: number;
  receivedQuantity: number;
}

export interface RejectStockData {
  changed: number;
  activeRequest_deleteMany: number;
  actionReceipt_insert: ActionReceipt_Key;
  actionKey_insert: ActionKey_Key;
}

export interface RejectStockVariables {
  uid: string;
  businessId: string;
  requestId: string;
  revision: number;
  receiptId: string;
  key: string;
  payloadHash: string;
  semanticHash: string;
  reason: string;
}

export interface ReplenishmentRequest_Key {
  id: string;
  __typename?: 'ReplenishmentRequest_Key';
}

export interface ResetDemoStockData {
  keys: number;
  receipts: number;
  movements: number;
  transfers: number;
  active: number;
  requests: number;
  hq: number;
  salons: number;
}

export interface ResetDemoStockVariables {
  businessId: string;
  productIds: string[];
}

export interface SalonAccess_Key {
  membershipUid: string;
  locationId: string;
  __typename?: 'SalonAccess_Key';
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
    productId: string;
    quantity: number;
    state: RequestState;
    revision: number;
    product: {
      inventories_on_product: ({
        locationId: string;
        onHand: number;
        reserved: number;
        version: number;
      })[];
    };
  } & ReplenishmentRequest_Key;
  product?: {
    id: string;
    businessId: string;
    inventories_on_product: ({
      locationId: string;
      onHand: number;
      reserved: number;
      version: number;
    })[];
  } & Product_Key;
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
  })[];
}

export interface StockContextVariables {
  uid: string;
  requestId?: string | null;
  salonId?: string | null;
  productId?: string | null;
  key: string;
  action: StockActionType;
}

export interface StockMovement_Key {
  transferRequestId: string;
  type: MovementType;
  __typename?: 'StockMovement_Key';
}

export interface SubmitStockData {
  replenishmentRequest_insert: ReplenishmentRequest_Key;
  activeRequest_insert: ActiveRequest_Key;
  actionReceipt_insert: ActionReceipt_Key;
  actionKey_insert: ActionKey_Key;
}

export interface SubmitStockVariables {
  uid: string;
  businessId: string;
  salonId: string;
  productId: string;
  quantity: number;
  requestId: string;
  receiptId: string;
  key: string;
  payloadHash: string;
  semanticHash: string;
}

export interface Transfer_Key {
  requestId: string;
  __typename?: 'Transfer_Key';
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

/** Generated Node Admin SDK operation action function for the 'ReadResetCounts' Query. Allow users to execute without passing in DataConnect. */
export function readResetCounts(dc: DataConnect, vars: ReadResetCountsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReadResetCountsData>>;
/** Generated Node Admin SDK operation action function for the 'ReadResetCounts' Query. Allow users to pass in custom DataConnect instances. */
export function readResetCounts(vars: ReadResetCountsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReadResetCountsData>>;

/** Generated Node Admin SDK operation action function for the 'ResetDemoStock' Mutation. Allow users to execute without passing in DataConnect. */
export function resetDemoStock(dc: DataConnect, vars: ResetDemoStockVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ResetDemoStockData>>;
/** Generated Node Admin SDK operation action function for the 'ResetDemoStock' Mutation. Allow users to pass in custom DataConnect instances. */
export function resetDemoStock(vars: ResetDemoStockVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ResetDemoStockData>>;

/** Generated Node Admin SDK operation action function for the 'StockContext' Query. Allow users to execute without passing in DataConnect. */
export function stockContext(dc: DataConnect, vars: StockContextVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<StockContextData>>;
/** Generated Node Admin SDK operation action function for the 'StockContext' Query. Allow users to pass in custom DataConnect instances. */
export function stockContext(vars: StockContextVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<StockContextData>>;

/** Generated Node Admin SDK operation action function for the 'SubmitStock' Mutation. Allow users to execute without passing in DataConnect. */
export function submitStock(dc: DataConnect, vars: SubmitStockVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SubmitStockData>>;
/** Generated Node Admin SDK operation action function for the 'SubmitStock' Mutation. Allow users to pass in custom DataConnect instances. */
export function submitStock(vars: SubmitStockVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SubmitStockData>>;

/** Generated Node Admin SDK operation action function for the 'ApproveStock' Mutation. Allow users to execute without passing in DataConnect. */
export function approveStock(dc: DataConnect, vars: ApproveStockVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ApproveStockData>>;
/** Generated Node Admin SDK operation action function for the 'ApproveStock' Mutation. Allow users to pass in custom DataConnect instances. */
export function approveStock(vars: ApproveStockVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ApproveStockData>>;

/** Generated Node Admin SDK operation action function for the 'RejectStock' Mutation. Allow users to execute without passing in DataConnect. */
export function rejectStock(dc: DataConnect, vars: RejectStockVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RejectStockData>>;
/** Generated Node Admin SDK operation action function for the 'RejectStock' Mutation. Allow users to pass in custom DataConnect instances. */
export function rejectStock(vars: RejectStockVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RejectStockData>>;

/** Generated Node Admin SDK operation action function for the 'DispatchStock' Mutation. Allow users to execute without passing in DataConnect. */
export function dispatchStock(dc: DataConnect, vars: DispatchStockVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DispatchStockData>>;
/** Generated Node Admin SDK operation action function for the 'DispatchStock' Mutation. Allow users to pass in custom DataConnect instances. */
export function dispatchStock(vars: DispatchStockVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DispatchStockData>>;

/** Generated Node Admin SDK operation action function for the 'ReceiveStock' Mutation. Allow users to execute without passing in DataConnect. */
export function receiveStock(dc: DataConnect, vars: ReceiveStockVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReceiveStockData>>;
/** Generated Node Admin SDK operation action function for the 'ReceiveStock' Mutation. Allow users to pass in custom DataConnect instances. */
export function receiveStock(vars: ReceiveStockVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ReceiveStockData>>;

/** Generated Node Admin SDK operation action function for the 'BindReplayKey' Mutation. Allow users to execute without passing in DataConnect. */
export function bindReplayKey(dc: DataConnect, vars: BindReplayKeyVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<BindReplayKeyData>>;
/** Generated Node Admin SDK operation action function for the 'BindReplayKey' Mutation. Allow users to pass in custom DataConnect instances. */
export function bindReplayKey(vars: BindReplayKeyVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<BindReplayKeyData>>;

