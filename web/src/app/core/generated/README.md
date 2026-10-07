# Generated TypeScript README
This README will guide you through the process of using the generated JavaScript SDK package for the connector `browser`. It will also provide examples on how to use your generated SDK to call your Data Connect queries and mutations.

***NOTE:** This README is generated alongside the generated SDK. If you make changes to this file, they will be overwritten when the SDK is regenerated.*

# Table of Contents
- [**Overview**](#generated-javascript-readme)
- [**Accessing the connector**](#accessing-the-connector)
  - [*Connecting to the local Emulator*](#connecting-to-the-local-emulator)
- [**Queries**](#queries)
  - [*GetMyMembership*](#getmymembership)
  - [*ListProducts*](#listproducts)
  - [*GetSalonInventory*](#getsaloninventory)
  - [*ListActiveRequests*](#listactiverequests)
  - [*ListHQQueue*](#listhqqueue)
  - [*GetRequestDetail*](#getrequestdetail)
  - [*ListSalonRequests*](#listsalonrequests)
- [**Mutations**](#mutations)

# Accessing the connector
A connector is a collection of Queries and Mutations. One SDK is generated for each connector - this SDK is generated for the connector `browser`. You can find more information about connectors in the [Data Connect documentation](https://firebase.google.com/docs/data-connect#how-does).

You can use this generated SDK by importing from the package `@barberhq/browser` as shown below. Both CommonJS and ESM imports are supported.

You can also follow the instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#set-client).

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@barberhq/browser';

const dataConnect = getDataConnect(connectorConfig);
```

## Connecting to the local Emulator
By default, the connector will connect to the production service.

To connect to the emulator, you can use the following code.
You can also follow the emulator instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#instrument-clients).

```typescript
import { connectDataConnectEmulator, getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@barberhq/browser';

const dataConnect = getDataConnect(connectorConfig);
connectDataConnectEmulator(dataConnect, 'localhost', 9399);
```

After it's initialized, you can call your Data Connect [queries](#queries) and [mutations](#mutations) from your generated SDK.

# Queries

There are two ways to execute a Data Connect Query using the generated Web SDK:
- Using a Query Reference function, which returns a `QueryRef`
  - The `QueryRef` can be used as an argument to `executeQuery()`, which will execute the Query and return a `QueryPromise`
- Using an action shortcut function, which returns a `QueryPromise`
  - Calling the action shortcut function will execute the Query and return a `QueryPromise`

The following is true for both the action shortcut function and the `QueryRef` function:
- The `QueryPromise` returned will resolve to the result of the Query once it has finished executing
- If the Query accepts arguments, both the action shortcut function and the `QueryRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Query
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `browser` connector's generated functions to execute each query. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-queries).

## GetMyMembership
You can execute the `GetMyMembership` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [generated/index.d.ts](./index.d.ts):
```typescript
getMyMembership(options?: ExecuteQueryOptions): QueryPromise<GetMyMembershipData, undefined>;

interface GetMyMembershipRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetMyMembershipData, undefined>;
}
export const getMyMembershipRef: GetMyMembershipRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getMyMembership(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<GetMyMembershipData, undefined>;

interface GetMyMembershipRef {
  ...
  (dc: DataConnect): QueryRef<GetMyMembershipData, undefined>;
}
export const getMyMembershipRef: GetMyMembershipRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getMyMembershipRef:
```typescript
const name = getMyMembershipRef.operationName;
console.log(name);
```

### Variables
The `GetMyMembership` query has no variables.
### Return Type
Recall that executing the `GetMyMembership` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetMyMembershipData`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `GetMyMembership`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getMyMembership } from '@barberhq/browser';


// Call the `getMyMembership()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getMyMembership();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getMyMembership(dataConnect);

console.log(data.membership);

// Or, you can use the `Promise` API.
getMyMembership().then((response) => {
  const data = response.data;
  console.log(data.membership);
});
```

### Using `GetMyMembership`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getMyMembershipRef } from '@barberhq/browser';


// Call the `getMyMembershipRef()` function to get a reference to the query.
const ref = getMyMembershipRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getMyMembershipRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.membership);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.membership);
});
```

## ListProducts
You can execute the `ListProducts` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [generated/index.d.ts](./index.d.ts):
```typescript
listProducts(vars?: ListProductsVariables, options?: ExecuteQueryOptions): QueryPromise<ListProductsData, ListProductsVariables>;

interface ListProductsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars?: ListProductsVariables): QueryRef<ListProductsData, ListProductsVariables>;
}
export const listProductsRef: ListProductsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listProducts(dc: DataConnect, vars?: ListProductsVariables, options?: ExecuteQueryOptions): QueryPromise<ListProductsData, ListProductsVariables>;

interface ListProductsRef {
  ...
  (dc: DataConnect, vars?: ListProductsVariables): QueryRef<ListProductsData, ListProductsVariables>;
}
export const listProductsRef: ListProductsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listProductsRef:
```typescript
const name = listProductsRef.operationName;
console.log(name);
```

### Variables
The `ListProducts` query has an optional argument of type `ListProductsVariables`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface ListProductsVariables {
  limit?: number;
  offset?: number;
}
```
### Return Type
Recall that executing the `ListProducts` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListProductsData`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `ListProducts`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listProducts, ListProductsVariables } from '@barberhq/browser';

// The `ListProducts` query has an optional argument of type `ListProductsVariables`:
const listProductsVars: ListProductsVariables = {
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `listProducts()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listProducts(listProductsVars);
// Variables can be defined inline as well.
const { data } = await listProducts({ limit: ..., offset: ..., });
// Since all variables are optional for this query, you can omit the `ListProductsVariables` argument.
const { data } = await listProducts();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listProducts(dataConnect, listProductsVars);

console.log(data.membership);

// Or, you can use the `Promise` API.
listProducts(listProductsVars).then((response) => {
  const data = response.data;
  console.log(data.membership);
});
```

### Using `ListProducts`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listProductsRef, ListProductsVariables } from '@barberhq/browser';

// The `ListProducts` query has an optional argument of type `ListProductsVariables`:
const listProductsVars: ListProductsVariables = {
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `listProductsRef()` function to get a reference to the query.
const ref = listProductsRef(listProductsVars);
// Variables can be defined inline as well.
const ref = listProductsRef({ limit: ..., offset: ..., });
// Since all variables are optional for this query, you can omit the `ListProductsVariables` argument.
const ref = listProductsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listProductsRef(dataConnect, listProductsVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.membership);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.membership);
});
```

## GetSalonInventory
You can execute the `GetSalonInventory` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [generated/index.d.ts](./index.d.ts):
```typescript
getSalonInventory(vars: GetSalonInventoryVariables, options?: ExecuteQueryOptions): QueryPromise<GetSalonInventoryData, GetSalonInventoryVariables>;

interface GetSalonInventoryRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetSalonInventoryVariables): QueryRef<GetSalonInventoryData, GetSalonInventoryVariables>;
}
export const getSalonInventoryRef: GetSalonInventoryRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getSalonInventory(dc: DataConnect, vars: GetSalonInventoryVariables, options?: ExecuteQueryOptions): QueryPromise<GetSalonInventoryData, GetSalonInventoryVariables>;

interface GetSalonInventoryRef {
  ...
  (dc: DataConnect, vars: GetSalonInventoryVariables): QueryRef<GetSalonInventoryData, GetSalonInventoryVariables>;
}
export const getSalonInventoryRef: GetSalonInventoryRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getSalonInventoryRef:
```typescript
const name = getSalonInventoryRef.operationName;
console.log(name);
```

### Variables
The `GetSalonInventory` query requires an argument of type `GetSalonInventoryVariables`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetSalonInventoryVariables {
  salonId: string;
  limit?: number;
  offset?: number;
}
```
### Return Type
Recall that executing the `GetSalonInventory` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetSalonInventoryData`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `GetSalonInventory`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getSalonInventory, GetSalonInventoryVariables } from '@barberhq/browser';

// The `GetSalonInventory` query requires an argument of type `GetSalonInventoryVariables`:
const getSalonInventoryVars: GetSalonInventoryVariables = {
  salonId: ..., 
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `getSalonInventory()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getSalonInventory(getSalonInventoryVars);
// Variables can be defined inline as well.
const { data } = await getSalonInventory({ salonId: ..., limit: ..., offset: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getSalonInventory(dataConnect, getSalonInventoryVars);

console.log(data.membership);

// Or, you can use the `Promise` API.
getSalonInventory(getSalonInventoryVars).then((response) => {
  const data = response.data;
  console.log(data.membership);
});
```

### Using `GetSalonInventory`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getSalonInventoryRef, GetSalonInventoryVariables } from '@barberhq/browser';

// The `GetSalonInventory` query requires an argument of type `GetSalonInventoryVariables`:
const getSalonInventoryVars: GetSalonInventoryVariables = {
  salonId: ..., 
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `getSalonInventoryRef()` function to get a reference to the query.
const ref = getSalonInventoryRef(getSalonInventoryVars);
// Variables can be defined inline as well.
const ref = getSalonInventoryRef({ salonId: ..., limit: ..., offset: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getSalonInventoryRef(dataConnect, getSalonInventoryVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.membership);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.membership);
});
```

## ListActiveRequests
You can execute the `ListActiveRequests` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [generated/index.d.ts](./index.d.ts):
```typescript
listActiveRequests(vars: ListActiveRequestsVariables, options?: ExecuteQueryOptions): QueryPromise<ListActiveRequestsData, ListActiveRequestsVariables>;

interface ListActiveRequestsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListActiveRequestsVariables): QueryRef<ListActiveRequestsData, ListActiveRequestsVariables>;
}
export const listActiveRequestsRef: ListActiveRequestsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listActiveRequests(dc: DataConnect, vars: ListActiveRequestsVariables, options?: ExecuteQueryOptions): QueryPromise<ListActiveRequestsData, ListActiveRequestsVariables>;

interface ListActiveRequestsRef {
  ...
  (dc: DataConnect, vars: ListActiveRequestsVariables): QueryRef<ListActiveRequestsData, ListActiveRequestsVariables>;
}
export const listActiveRequestsRef: ListActiveRequestsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listActiveRequestsRef:
```typescript
const name = listActiveRequestsRef.operationName;
console.log(name);
```

### Variables
The `ListActiveRequests` query requires an argument of type `ListActiveRequestsVariables`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface ListActiveRequestsVariables {
  salonId: string;
  limit?: number;
  offset?: number;
}
```
### Return Type
Recall that executing the `ListActiveRequests` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListActiveRequestsData`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `ListActiveRequests`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listActiveRequests, ListActiveRequestsVariables } from '@barberhq/browser';

// The `ListActiveRequests` query requires an argument of type `ListActiveRequestsVariables`:
const listActiveRequestsVars: ListActiveRequestsVariables = {
  salonId: ..., 
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `listActiveRequests()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listActiveRequests(listActiveRequestsVars);
// Variables can be defined inline as well.
const { data } = await listActiveRequests({ salonId: ..., limit: ..., offset: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listActiveRequests(dataConnect, listActiveRequestsVars);

console.log(data.membership);

// Or, you can use the `Promise` API.
listActiveRequests(listActiveRequestsVars).then((response) => {
  const data = response.data;
  console.log(data.membership);
});
```

### Using `ListActiveRequests`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listActiveRequestsRef, ListActiveRequestsVariables } from '@barberhq/browser';

// The `ListActiveRequests` query requires an argument of type `ListActiveRequestsVariables`:
const listActiveRequestsVars: ListActiveRequestsVariables = {
  salonId: ..., 
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `listActiveRequestsRef()` function to get a reference to the query.
const ref = listActiveRequestsRef(listActiveRequestsVars);
// Variables can be defined inline as well.
const ref = listActiveRequestsRef({ salonId: ..., limit: ..., offset: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listActiveRequestsRef(dataConnect, listActiveRequestsVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.membership);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.membership);
});
```

## ListHQQueue
You can execute the `ListHQQueue` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [generated/index.d.ts](./index.d.ts):
```typescript
listHqQueue(vars?: ListHqQueueVariables, options?: ExecuteQueryOptions): QueryPromise<ListHqQueueData, ListHqQueueVariables>;

interface ListHqQueueRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars?: ListHqQueueVariables): QueryRef<ListHqQueueData, ListHqQueueVariables>;
}
export const listHqQueueRef: ListHqQueueRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listHqQueue(dc: DataConnect, vars?: ListHqQueueVariables, options?: ExecuteQueryOptions): QueryPromise<ListHqQueueData, ListHqQueueVariables>;

interface ListHqQueueRef {
  ...
  (dc: DataConnect, vars?: ListHqQueueVariables): QueryRef<ListHqQueueData, ListHqQueueVariables>;
}
export const listHqQueueRef: ListHqQueueRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listHqQueueRef:
```typescript
const name = listHqQueueRef.operationName;
console.log(name);
```

### Variables
The `ListHQQueue` query has an optional argument of type `ListHqQueueVariables`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface ListHqQueueVariables {
  limit?: number;
  offset?: number;
}
```
### Return Type
Recall that executing the `ListHQQueue` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListHqQueueData`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `ListHQQueue`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listHqQueue, ListHqQueueVariables } from '@barberhq/browser';

// The `ListHQQueue` query has an optional argument of type `ListHqQueueVariables`:
const listHqQueueVars: ListHqQueueVariables = {
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `listHqQueue()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listHqQueue(listHqQueueVars);
// Variables can be defined inline as well.
const { data } = await listHqQueue({ limit: ..., offset: ..., });
// Since all variables are optional for this query, you can omit the `ListHqQueueVariables` argument.
const { data } = await listHqQueue();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listHqQueue(dataConnect, listHqQueueVars);

console.log(data.membership);

// Or, you can use the `Promise` API.
listHqQueue(listHqQueueVars).then((response) => {
  const data = response.data;
  console.log(data.membership);
});
```

### Using `ListHQQueue`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listHqQueueRef, ListHqQueueVariables } from '@barberhq/browser';

// The `ListHQQueue` query has an optional argument of type `ListHqQueueVariables`:
const listHqQueueVars: ListHqQueueVariables = {
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `listHqQueueRef()` function to get a reference to the query.
const ref = listHqQueueRef(listHqQueueVars);
// Variables can be defined inline as well.
const ref = listHqQueueRef({ limit: ..., offset: ..., });
// Since all variables are optional for this query, you can omit the `ListHqQueueVariables` argument.
const ref = listHqQueueRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listHqQueueRef(dataConnect, listHqQueueVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.membership);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.membership);
});
```

## GetRequestDetail
You can execute the `GetRequestDetail` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [generated/index.d.ts](./index.d.ts):
```typescript
getRequestDetail(vars: GetRequestDetailVariables, options?: ExecuteQueryOptions): QueryPromise<GetRequestDetailData, GetRequestDetailVariables>;

interface GetRequestDetailRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetRequestDetailVariables): QueryRef<GetRequestDetailData, GetRequestDetailVariables>;
}
export const getRequestDetailRef: GetRequestDetailRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getRequestDetail(dc: DataConnect, vars: GetRequestDetailVariables, options?: ExecuteQueryOptions): QueryPromise<GetRequestDetailData, GetRequestDetailVariables>;

interface GetRequestDetailRef {
  ...
  (dc: DataConnect, vars: GetRequestDetailVariables): QueryRef<GetRequestDetailData, GetRequestDetailVariables>;
}
export const getRequestDetailRef: GetRequestDetailRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getRequestDetailRef:
```typescript
const name = getRequestDetailRef.operationName;
console.log(name);
```

### Variables
The `GetRequestDetail` query requires an argument of type `GetRequestDetailVariables`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetRequestDetailVariables {
  requestId: string;
}
```
### Return Type
Recall that executing the `GetRequestDetail` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetRequestDetailData`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `GetRequestDetail`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getRequestDetail, GetRequestDetailVariables } from '@barberhq/browser';

// The `GetRequestDetail` query requires an argument of type `GetRequestDetailVariables`:
const getRequestDetailVars: GetRequestDetailVariables = {
  requestId: ..., 
};

// Call the `getRequestDetail()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getRequestDetail(getRequestDetailVars);
// Variables can be defined inline as well.
const { data } = await getRequestDetail({ requestId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getRequestDetail(dataConnect, getRequestDetailVars);

console.log(data.membership);

// Or, you can use the `Promise` API.
getRequestDetail(getRequestDetailVars).then((response) => {
  const data = response.data;
  console.log(data.membership);
});
```

### Using `GetRequestDetail`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getRequestDetailRef, GetRequestDetailVariables } from '@barberhq/browser';

// The `GetRequestDetail` query requires an argument of type `GetRequestDetailVariables`:
const getRequestDetailVars: GetRequestDetailVariables = {
  requestId: ..., 
};

// Call the `getRequestDetailRef()` function to get a reference to the query.
const ref = getRequestDetailRef(getRequestDetailVars);
// Variables can be defined inline as well.
const ref = getRequestDetailRef({ requestId: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getRequestDetailRef(dataConnect, getRequestDetailVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.membership);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.membership);
});
```

## ListSalonRequests
You can execute the `ListSalonRequests` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [generated/index.d.ts](./index.d.ts):
```typescript
listSalonRequests(vars: ListSalonRequestsVariables, options?: ExecuteQueryOptions): QueryPromise<ListSalonRequestsData, ListSalonRequestsVariables>;

interface ListSalonRequestsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListSalonRequestsVariables): QueryRef<ListSalonRequestsData, ListSalonRequestsVariables>;
}
export const listSalonRequestsRef: ListSalonRequestsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listSalonRequests(dc: DataConnect, vars: ListSalonRequestsVariables, options?: ExecuteQueryOptions): QueryPromise<ListSalonRequestsData, ListSalonRequestsVariables>;

interface ListSalonRequestsRef {
  ...
  (dc: DataConnect, vars: ListSalonRequestsVariables): QueryRef<ListSalonRequestsData, ListSalonRequestsVariables>;
}
export const listSalonRequestsRef: ListSalonRequestsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listSalonRequestsRef:
```typescript
const name = listSalonRequestsRef.operationName;
console.log(name);
```

### Variables
The `ListSalonRequests` query requires an argument of type `ListSalonRequestsVariables`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface ListSalonRequestsVariables {
  salonId: string;
  states: RequestState[];
  limit?: number;
  offset?: number;
}
```
### Return Type
Recall that executing the `ListSalonRequests` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListSalonRequestsData`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `ListSalonRequests`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listSalonRequests, ListSalonRequestsVariables } from '@barberhq/browser';

// The `ListSalonRequests` query requires an argument of type `ListSalonRequestsVariables`:
const listSalonRequestsVars: ListSalonRequestsVariables = {
  salonId: ..., 
  states: ..., 
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `listSalonRequests()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listSalonRequests(listSalonRequestsVars);
// Variables can be defined inline as well.
const { data } = await listSalonRequests({ salonId: ..., states: ..., limit: ..., offset: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listSalonRequests(dataConnect, listSalonRequestsVars);

console.log(data.membership);

// Or, you can use the `Promise` API.
listSalonRequests(listSalonRequestsVars).then((response) => {
  const data = response.data;
  console.log(data.membership);
});
```

### Using `ListSalonRequests`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listSalonRequestsRef, ListSalonRequestsVariables } from '@barberhq/browser';

// The `ListSalonRequests` query requires an argument of type `ListSalonRequestsVariables`:
const listSalonRequestsVars: ListSalonRequestsVariables = {
  salonId: ..., 
  states: ..., 
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `listSalonRequestsRef()` function to get a reference to the query.
const ref = listSalonRequestsRef(listSalonRequestsVars);
// Variables can be defined inline as well.
const ref = listSalonRequestsRef({ salonId: ..., states: ..., limit: ..., offset: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listSalonRequestsRef(dataConnect, listSalonRequestsVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.membership);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.membership);
});
```

# Mutations

No mutations were generated for the `browser` connector.

If you want to learn more about how to use mutations in Data Connect, you can follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-mutations).

