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
  - [*GetHqInventory*](#gethqinventory)
  - [*GetDeliveryProcedureBindings*](#getdeliveryprocedurebindings)
  - [*ListDeliveryProcedureDocuments*](#listdeliveryproceduredocuments)
  - [*GetDeliveryReceipt*](#getdeliveryreceipt)
  - [*GetDeliveryIssue*](#getdeliveryissue)
  - [*ListDeliveryIssues*](#listdeliveryissues)
  - [*GetSourceSection*](#getsourcesection)
  - [*ListPublishedKnowledgeDocuments*](#listpublishedknowledgedocuments)
  - [*ListHqKnowledgeDocuments*](#listhqknowledgedocuments)
  - [*GetKnowledgeReview*](#getknowledgereview)
  - [*GetKnowledgeProductReview*](#getknowledgeproductreview)
  - [*ListSalonShorthand*](#listsalonshorthand)
  - [*ListHqShorthand*](#listhqshorthand)
  - [*GetSalonSettings*](#getsalonsettings)
  - [*ListActiveRequests*](#listactiverequests)
  - [*ListHQQueue*](#listhqqueue)
  - [*GetRequestDetail*](#getrequestdetail)
  - [*ListSalonRequests*](#listsalonrequests)
- [**Mutations**](#mutations)
  - [*SaveSalonSettings*](#savesalonsettings)

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

## GetHqInventory
You can execute the `GetHqInventory` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [generated/index.d.ts](./index.d.ts):
```typescript
getHqInventory(vars?: GetHqInventoryVariables, options?: ExecuteQueryOptions): QueryPromise<GetHqInventoryData, GetHqInventoryVariables>;

interface GetHqInventoryRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars?: GetHqInventoryVariables): QueryRef<GetHqInventoryData, GetHqInventoryVariables>;
}
export const getHqInventoryRef: GetHqInventoryRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getHqInventory(dc: DataConnect, vars?: GetHqInventoryVariables, options?: ExecuteQueryOptions): QueryPromise<GetHqInventoryData, GetHqInventoryVariables>;

interface GetHqInventoryRef {
  ...
  (dc: DataConnect, vars?: GetHqInventoryVariables): QueryRef<GetHqInventoryData, GetHqInventoryVariables>;
}
export const getHqInventoryRef: GetHqInventoryRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getHqInventoryRef:
```typescript
const name = getHqInventoryRef.operationName;
console.log(name);
```

### Variables
The `GetHqInventory` query has an optional argument of type `GetHqInventoryVariables`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetHqInventoryVariables {
  limit?: number;
  offset?: number;
}
```
### Return Type
Recall that executing the `GetHqInventory` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetHqInventoryData`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `GetHqInventory`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getHqInventory, GetHqInventoryVariables } from '@barberhq/browser';

// The `GetHqInventory` query has an optional argument of type `GetHqInventoryVariables`:
const getHqInventoryVars: GetHqInventoryVariables = {
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `getHqInventory()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getHqInventory(getHqInventoryVars);
// Variables can be defined inline as well.
const { data } = await getHqInventory({ limit: ..., offset: ..., });
// Since all variables are optional for this query, you can omit the `GetHqInventoryVariables` argument.
const { data } = await getHqInventory();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getHqInventory(dataConnect, getHqInventoryVars);

console.log(data.membership);

// Or, you can use the `Promise` API.
getHqInventory(getHqInventoryVars).then((response) => {
  const data = response.data;
  console.log(data.membership);
});
```

### Using `GetHqInventory`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getHqInventoryRef, GetHqInventoryVariables } from '@barberhq/browser';

// The `GetHqInventory` query has an optional argument of type `GetHqInventoryVariables`:
const getHqInventoryVars: GetHqInventoryVariables = {
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `getHqInventoryRef()` function to get a reference to the query.
const ref = getHqInventoryRef(getHqInventoryVars);
// Variables can be defined inline as well.
const ref = getHqInventoryRef({ limit: ..., offset: ..., });
// Since all variables are optional for this query, you can omit the `GetHqInventoryVariables` argument.
const ref = getHqInventoryRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getHqInventoryRef(dataConnect, getHqInventoryVars);

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

## GetDeliveryProcedureBindings
You can execute the `GetDeliveryProcedureBindings` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [generated/index.d.ts](./index.d.ts):
```typescript
getDeliveryProcedureBindings(options?: ExecuteQueryOptions): QueryPromise<GetDeliveryProcedureBindingsData, undefined>;

interface GetDeliveryProcedureBindingsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetDeliveryProcedureBindingsData, undefined>;
}
export const getDeliveryProcedureBindingsRef: GetDeliveryProcedureBindingsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getDeliveryProcedureBindings(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<GetDeliveryProcedureBindingsData, undefined>;

interface GetDeliveryProcedureBindingsRef {
  ...
  (dc: DataConnect): QueryRef<GetDeliveryProcedureBindingsData, undefined>;
}
export const getDeliveryProcedureBindingsRef: GetDeliveryProcedureBindingsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getDeliveryProcedureBindingsRef:
```typescript
const name = getDeliveryProcedureBindingsRef.operationName;
console.log(name);
```

### Variables
The `GetDeliveryProcedureBindings` query has no variables.
### Return Type
Recall that executing the `GetDeliveryProcedureBindings` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetDeliveryProcedureBindingsData`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `GetDeliveryProcedureBindings`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getDeliveryProcedureBindings } from '@barberhq/browser';


// Call the `getDeliveryProcedureBindings()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getDeliveryProcedureBindings();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getDeliveryProcedureBindings(dataConnect);

console.log(data.membership);

// Or, you can use the `Promise` API.
getDeliveryProcedureBindings().then((response) => {
  const data = response.data;
  console.log(data.membership);
});
```

### Using `GetDeliveryProcedureBindings`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getDeliveryProcedureBindingsRef } from '@barberhq/browser';


// Call the `getDeliveryProcedureBindingsRef()` function to get a reference to the query.
const ref = getDeliveryProcedureBindingsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getDeliveryProcedureBindingsRef(dataConnect);

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

## ListDeliveryProcedureDocuments
You can execute the `ListDeliveryProcedureDocuments` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [generated/index.d.ts](./index.d.ts):
```typescript
listDeliveryProcedureDocuments(vars?: ListDeliveryProcedureDocumentsVariables, options?: ExecuteQueryOptions): QueryPromise<ListDeliveryProcedureDocumentsData, ListDeliveryProcedureDocumentsVariables>;

interface ListDeliveryProcedureDocumentsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars?: ListDeliveryProcedureDocumentsVariables): QueryRef<ListDeliveryProcedureDocumentsData, ListDeliveryProcedureDocumentsVariables>;
}
export const listDeliveryProcedureDocumentsRef: ListDeliveryProcedureDocumentsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listDeliveryProcedureDocuments(dc: DataConnect, vars?: ListDeliveryProcedureDocumentsVariables, options?: ExecuteQueryOptions): QueryPromise<ListDeliveryProcedureDocumentsData, ListDeliveryProcedureDocumentsVariables>;

interface ListDeliveryProcedureDocumentsRef {
  ...
  (dc: DataConnect, vars?: ListDeliveryProcedureDocumentsVariables): QueryRef<ListDeliveryProcedureDocumentsData, ListDeliveryProcedureDocumentsVariables>;
}
export const listDeliveryProcedureDocumentsRef: ListDeliveryProcedureDocumentsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listDeliveryProcedureDocumentsRef:
```typescript
const name = listDeliveryProcedureDocumentsRef.operationName;
console.log(name);
```

### Variables
The `ListDeliveryProcedureDocuments` query has an optional argument of type `ListDeliveryProcedureDocumentsVariables`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface ListDeliveryProcedureDocumentsVariables {
  limit?: number;
  offset?: number;
}
```
### Return Type
Recall that executing the `ListDeliveryProcedureDocuments` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListDeliveryProcedureDocumentsData`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `ListDeliveryProcedureDocuments`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listDeliveryProcedureDocuments, ListDeliveryProcedureDocumentsVariables } from '@barberhq/browser';

// The `ListDeliveryProcedureDocuments` query has an optional argument of type `ListDeliveryProcedureDocumentsVariables`:
const listDeliveryProcedureDocumentsVars: ListDeliveryProcedureDocumentsVariables = {
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `listDeliveryProcedureDocuments()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listDeliveryProcedureDocuments(listDeliveryProcedureDocumentsVars);
// Variables can be defined inline as well.
const { data } = await listDeliveryProcedureDocuments({ limit: ..., offset: ..., });
// Since all variables are optional for this query, you can omit the `ListDeliveryProcedureDocumentsVariables` argument.
const { data } = await listDeliveryProcedureDocuments();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listDeliveryProcedureDocuments(dataConnect, listDeliveryProcedureDocumentsVars);

console.log(data.membership);

// Or, you can use the `Promise` API.
listDeliveryProcedureDocuments(listDeliveryProcedureDocumentsVars).then((response) => {
  const data = response.data;
  console.log(data.membership);
});
```

### Using `ListDeliveryProcedureDocuments`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listDeliveryProcedureDocumentsRef, ListDeliveryProcedureDocumentsVariables } from '@barberhq/browser';

// The `ListDeliveryProcedureDocuments` query has an optional argument of type `ListDeliveryProcedureDocumentsVariables`:
const listDeliveryProcedureDocumentsVars: ListDeliveryProcedureDocumentsVariables = {
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `listDeliveryProcedureDocumentsRef()` function to get a reference to the query.
const ref = listDeliveryProcedureDocumentsRef(listDeliveryProcedureDocumentsVars);
// Variables can be defined inline as well.
const ref = listDeliveryProcedureDocumentsRef({ limit: ..., offset: ..., });
// Since all variables are optional for this query, you can omit the `ListDeliveryProcedureDocumentsVariables` argument.
const ref = listDeliveryProcedureDocumentsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listDeliveryProcedureDocumentsRef(dataConnect, listDeliveryProcedureDocumentsVars);

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

## GetDeliveryReceipt
You can execute the `GetDeliveryReceipt` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [generated/index.d.ts](./index.d.ts):
```typescript
getDeliveryReceipt(vars: GetDeliveryReceiptVariables, options?: ExecuteQueryOptions): QueryPromise<GetDeliveryReceiptData, GetDeliveryReceiptVariables>;

interface GetDeliveryReceiptRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetDeliveryReceiptVariables): QueryRef<GetDeliveryReceiptData, GetDeliveryReceiptVariables>;
}
export const getDeliveryReceiptRef: GetDeliveryReceiptRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getDeliveryReceipt(dc: DataConnect, vars: GetDeliveryReceiptVariables, options?: ExecuteQueryOptions): QueryPromise<GetDeliveryReceiptData, GetDeliveryReceiptVariables>;

interface GetDeliveryReceiptRef {
  ...
  (dc: DataConnect, vars: GetDeliveryReceiptVariables): QueryRef<GetDeliveryReceiptData, GetDeliveryReceiptVariables>;
}
export const getDeliveryReceiptRef: GetDeliveryReceiptRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getDeliveryReceiptRef:
```typescript
const name = getDeliveryReceiptRef.operationName;
console.log(name);
```

### Variables
The `GetDeliveryReceipt` query requires an argument of type `GetDeliveryReceiptVariables`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetDeliveryReceiptVariables {
  requestId: string;
}
```
### Return Type
Recall that executing the `GetDeliveryReceipt` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetDeliveryReceiptData`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `GetDeliveryReceipt`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getDeliveryReceipt, GetDeliveryReceiptVariables } from '@barberhq/browser';

// The `GetDeliveryReceipt` query requires an argument of type `GetDeliveryReceiptVariables`:
const getDeliveryReceiptVars: GetDeliveryReceiptVariables = {
  requestId: ..., 
};

// Call the `getDeliveryReceipt()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getDeliveryReceipt(getDeliveryReceiptVars);
// Variables can be defined inline as well.
const { data } = await getDeliveryReceipt({ requestId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getDeliveryReceipt(dataConnect, getDeliveryReceiptVars);

console.log(data.membership);

// Or, you can use the `Promise` API.
getDeliveryReceipt(getDeliveryReceiptVars).then((response) => {
  const data = response.data;
  console.log(data.membership);
});
```

### Using `GetDeliveryReceipt`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getDeliveryReceiptRef, GetDeliveryReceiptVariables } from '@barberhq/browser';

// The `GetDeliveryReceipt` query requires an argument of type `GetDeliveryReceiptVariables`:
const getDeliveryReceiptVars: GetDeliveryReceiptVariables = {
  requestId: ..., 
};

// Call the `getDeliveryReceiptRef()` function to get a reference to the query.
const ref = getDeliveryReceiptRef(getDeliveryReceiptVars);
// Variables can be defined inline as well.
const ref = getDeliveryReceiptRef({ requestId: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getDeliveryReceiptRef(dataConnect, getDeliveryReceiptVars);

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

## GetDeliveryIssue
You can execute the `GetDeliveryIssue` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [generated/index.d.ts](./index.d.ts):
```typescript
getDeliveryIssue(vars: GetDeliveryIssueVariables, options?: ExecuteQueryOptions): QueryPromise<GetDeliveryIssueData, GetDeliveryIssueVariables>;

interface GetDeliveryIssueRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetDeliveryIssueVariables): QueryRef<GetDeliveryIssueData, GetDeliveryIssueVariables>;
}
export const getDeliveryIssueRef: GetDeliveryIssueRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getDeliveryIssue(dc: DataConnect, vars: GetDeliveryIssueVariables, options?: ExecuteQueryOptions): QueryPromise<GetDeliveryIssueData, GetDeliveryIssueVariables>;

interface GetDeliveryIssueRef {
  ...
  (dc: DataConnect, vars: GetDeliveryIssueVariables): QueryRef<GetDeliveryIssueData, GetDeliveryIssueVariables>;
}
export const getDeliveryIssueRef: GetDeliveryIssueRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getDeliveryIssueRef:
```typescript
const name = getDeliveryIssueRef.operationName;
console.log(name);
```

### Variables
The `GetDeliveryIssue` query requires an argument of type `GetDeliveryIssueVariables`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetDeliveryIssueVariables {
  issueId: string;
  eventLimit?: number;
  eventOffset?: number;
  replacementLimit?: number;
  replacementOffset?: number;
}
```
### Return Type
Recall that executing the `GetDeliveryIssue` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetDeliveryIssueData`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `GetDeliveryIssue`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getDeliveryIssue, GetDeliveryIssueVariables } from '@barberhq/browser';

// The `GetDeliveryIssue` query requires an argument of type `GetDeliveryIssueVariables`:
const getDeliveryIssueVars: GetDeliveryIssueVariables = {
  issueId: ..., 
  eventLimit: ..., // optional
  eventOffset: ..., // optional
  replacementLimit: ..., // optional
  replacementOffset: ..., // optional
};

// Call the `getDeliveryIssue()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getDeliveryIssue(getDeliveryIssueVars);
// Variables can be defined inline as well.
const { data } = await getDeliveryIssue({ issueId: ..., eventLimit: ..., eventOffset: ..., replacementLimit: ..., replacementOffset: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getDeliveryIssue(dataConnect, getDeliveryIssueVars);

console.log(data.membership);

// Or, you can use the `Promise` API.
getDeliveryIssue(getDeliveryIssueVars).then((response) => {
  const data = response.data;
  console.log(data.membership);
});
```

### Using `GetDeliveryIssue`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getDeliveryIssueRef, GetDeliveryIssueVariables } from '@barberhq/browser';

// The `GetDeliveryIssue` query requires an argument of type `GetDeliveryIssueVariables`:
const getDeliveryIssueVars: GetDeliveryIssueVariables = {
  issueId: ..., 
  eventLimit: ..., // optional
  eventOffset: ..., // optional
  replacementLimit: ..., // optional
  replacementOffset: ..., // optional
};

// Call the `getDeliveryIssueRef()` function to get a reference to the query.
const ref = getDeliveryIssueRef(getDeliveryIssueVars);
// Variables can be defined inline as well.
const ref = getDeliveryIssueRef({ issueId: ..., eventLimit: ..., eventOffset: ..., replacementLimit: ..., replacementOffset: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getDeliveryIssueRef(dataConnect, getDeliveryIssueVars);

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

## ListDeliveryIssues
You can execute the `ListDeliveryIssues` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [generated/index.d.ts](./index.d.ts):
```typescript
listDeliveryIssues(vars: ListDeliveryIssuesVariables, options?: ExecuteQueryOptions): QueryPromise<ListDeliveryIssuesData, ListDeliveryIssuesVariables>;

interface ListDeliveryIssuesRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListDeliveryIssuesVariables): QueryRef<ListDeliveryIssuesData, ListDeliveryIssuesVariables>;
}
export const listDeliveryIssuesRef: ListDeliveryIssuesRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listDeliveryIssues(dc: DataConnect, vars: ListDeliveryIssuesVariables, options?: ExecuteQueryOptions): QueryPromise<ListDeliveryIssuesData, ListDeliveryIssuesVariables>;

interface ListDeliveryIssuesRef {
  ...
  (dc: DataConnect, vars: ListDeliveryIssuesVariables): QueryRef<ListDeliveryIssuesData, ListDeliveryIssuesVariables>;
}
export const listDeliveryIssuesRef: ListDeliveryIssuesRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listDeliveryIssuesRef:
```typescript
const name = listDeliveryIssuesRef.operationName;
console.log(name);
```

### Variables
The `ListDeliveryIssues` query requires an argument of type `ListDeliveryIssuesVariables`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface ListDeliveryIssuesVariables {
  allSalons: boolean;
  salonId?: string | null;
  statuses: DeliveryIssueStatus[];
  limit?: number;
  offset?: number;
}
```
### Return Type
Recall that executing the `ListDeliveryIssues` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListDeliveryIssuesData`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `ListDeliveryIssues`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listDeliveryIssues, ListDeliveryIssuesVariables } from '@barberhq/browser';

// The `ListDeliveryIssues` query requires an argument of type `ListDeliveryIssuesVariables`:
const listDeliveryIssuesVars: ListDeliveryIssuesVariables = {
  allSalons: ..., 
  salonId: ..., // optional
  statuses: ..., 
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `listDeliveryIssues()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listDeliveryIssues(listDeliveryIssuesVars);
// Variables can be defined inline as well.
const { data } = await listDeliveryIssues({ allSalons: ..., salonId: ..., statuses: ..., limit: ..., offset: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listDeliveryIssues(dataConnect, listDeliveryIssuesVars);

console.log(data.membership);

// Or, you can use the `Promise` API.
listDeliveryIssues(listDeliveryIssuesVars).then((response) => {
  const data = response.data;
  console.log(data.membership);
});
```

### Using `ListDeliveryIssues`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listDeliveryIssuesRef, ListDeliveryIssuesVariables } from '@barberhq/browser';

// The `ListDeliveryIssues` query requires an argument of type `ListDeliveryIssuesVariables`:
const listDeliveryIssuesVars: ListDeliveryIssuesVariables = {
  allSalons: ..., 
  salonId: ..., // optional
  statuses: ..., 
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `listDeliveryIssuesRef()` function to get a reference to the query.
const ref = listDeliveryIssuesRef(listDeliveryIssuesVars);
// Variables can be defined inline as well.
const ref = listDeliveryIssuesRef({ allSalons: ..., salonId: ..., statuses: ..., limit: ..., offset: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listDeliveryIssuesRef(dataConnect, listDeliveryIssuesVars);

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

## GetSourceSection
You can execute the `GetSourceSection` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [generated/index.d.ts](./index.d.ts):
```typescript
getSourceSection(vars: GetSourceSectionVariables, options?: ExecuteQueryOptions): QueryPromise<GetSourceSectionData, GetSourceSectionVariables>;

interface GetSourceSectionRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetSourceSectionVariables): QueryRef<GetSourceSectionData, GetSourceSectionVariables>;
}
export const getSourceSectionRef: GetSourceSectionRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getSourceSection(dc: DataConnect, vars: GetSourceSectionVariables, options?: ExecuteQueryOptions): QueryPromise<GetSourceSectionData, GetSourceSectionVariables>;

interface GetSourceSectionRef {
  ...
  (dc: DataConnect, vars: GetSourceSectionVariables): QueryRef<GetSourceSectionData, GetSourceSectionVariables>;
}
export const getSourceSectionRef: GetSourceSectionRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getSourceSectionRef:
```typescript
const name = getSourceSectionRef.operationName;
console.log(name);
```

### Variables
The `GetSourceSection` query requires an argument of type `GetSourceSectionVariables`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetSourceSectionVariables {
  versionId: string;
  chunkId?: string | null;
}
```
### Return Type
Recall that executing the `GetSourceSection` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetSourceSectionData`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `GetSourceSection`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getSourceSection, GetSourceSectionVariables } from '@barberhq/browser';

// The `GetSourceSection` query requires an argument of type `GetSourceSectionVariables`:
const getSourceSectionVars: GetSourceSectionVariables = {
  versionId: ..., 
  chunkId: ..., // optional
};

// Call the `getSourceSection()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getSourceSection(getSourceSectionVars);
// Variables can be defined inline as well.
const { data } = await getSourceSection({ versionId: ..., chunkId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getSourceSection(dataConnect, getSourceSectionVars);

console.log(data.membership);

// Or, you can use the `Promise` API.
getSourceSection(getSourceSectionVars).then((response) => {
  const data = response.data;
  console.log(data.membership);
});
```

### Using `GetSourceSection`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getSourceSectionRef, GetSourceSectionVariables } from '@barberhq/browser';

// The `GetSourceSection` query requires an argument of type `GetSourceSectionVariables`:
const getSourceSectionVars: GetSourceSectionVariables = {
  versionId: ..., 
  chunkId: ..., // optional
};

// Call the `getSourceSectionRef()` function to get a reference to the query.
const ref = getSourceSectionRef(getSourceSectionVars);
// Variables can be defined inline as well.
const ref = getSourceSectionRef({ versionId: ..., chunkId: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getSourceSectionRef(dataConnect, getSourceSectionVars);

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

## ListPublishedKnowledgeDocuments
You can execute the `ListPublishedKnowledgeDocuments` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [generated/index.d.ts](./index.d.ts):
```typescript
listPublishedKnowledgeDocuments(vars: ListPublishedKnowledgeDocumentsVariables, options?: ExecuteQueryOptions): QueryPromise<ListPublishedKnowledgeDocumentsData, ListPublishedKnowledgeDocumentsVariables>;

interface ListPublishedKnowledgeDocumentsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListPublishedKnowledgeDocumentsVariables): QueryRef<ListPublishedKnowledgeDocumentsData, ListPublishedKnowledgeDocumentsVariables>;
}
export const listPublishedKnowledgeDocumentsRef: ListPublishedKnowledgeDocumentsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listPublishedKnowledgeDocuments(dc: DataConnect, vars: ListPublishedKnowledgeDocumentsVariables, options?: ExecuteQueryOptions): QueryPromise<ListPublishedKnowledgeDocumentsData, ListPublishedKnowledgeDocumentsVariables>;

interface ListPublishedKnowledgeDocumentsRef {
  ...
  (dc: DataConnect, vars: ListPublishedKnowledgeDocumentsVariables): QueryRef<ListPublishedKnowledgeDocumentsData, ListPublishedKnowledgeDocumentsVariables>;
}
export const listPublishedKnowledgeDocumentsRef: ListPublishedKnowledgeDocumentsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listPublishedKnowledgeDocumentsRef:
```typescript
const name = listPublishedKnowledgeDocumentsRef.operationName;
console.log(name);
```

### Variables
The `ListPublishedKnowledgeDocuments` query requires an argument of type `ListPublishedKnowledgeDocumentsVariables`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface ListPublishedKnowledgeDocumentsVariables {
  limit: number;
  offset: number;
}
```
### Return Type
Recall that executing the `ListPublishedKnowledgeDocuments` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListPublishedKnowledgeDocumentsData`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `ListPublishedKnowledgeDocuments`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listPublishedKnowledgeDocuments, ListPublishedKnowledgeDocumentsVariables } from '@barberhq/browser';

// The `ListPublishedKnowledgeDocuments` query requires an argument of type `ListPublishedKnowledgeDocumentsVariables`:
const listPublishedKnowledgeDocumentsVars: ListPublishedKnowledgeDocumentsVariables = {
  limit: ..., 
  offset: ..., 
};

// Call the `listPublishedKnowledgeDocuments()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listPublishedKnowledgeDocuments(listPublishedKnowledgeDocumentsVars);
// Variables can be defined inline as well.
const { data } = await listPublishedKnowledgeDocuments({ limit: ..., offset: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listPublishedKnowledgeDocuments(dataConnect, listPublishedKnowledgeDocumentsVars);

console.log(data.membership);

// Or, you can use the `Promise` API.
listPublishedKnowledgeDocuments(listPublishedKnowledgeDocumentsVars).then((response) => {
  const data = response.data;
  console.log(data.membership);
});
```

### Using `ListPublishedKnowledgeDocuments`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listPublishedKnowledgeDocumentsRef, ListPublishedKnowledgeDocumentsVariables } from '@barberhq/browser';

// The `ListPublishedKnowledgeDocuments` query requires an argument of type `ListPublishedKnowledgeDocumentsVariables`:
const listPublishedKnowledgeDocumentsVars: ListPublishedKnowledgeDocumentsVariables = {
  limit: ..., 
  offset: ..., 
};

// Call the `listPublishedKnowledgeDocumentsRef()` function to get a reference to the query.
const ref = listPublishedKnowledgeDocumentsRef(listPublishedKnowledgeDocumentsVars);
// Variables can be defined inline as well.
const ref = listPublishedKnowledgeDocumentsRef({ limit: ..., offset: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listPublishedKnowledgeDocumentsRef(dataConnect, listPublishedKnowledgeDocumentsVars);

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

## ListHqKnowledgeDocuments
You can execute the `ListHqKnowledgeDocuments` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [generated/index.d.ts](./index.d.ts):
```typescript
listHqKnowledgeDocuments(vars: ListHqKnowledgeDocumentsVariables, options?: ExecuteQueryOptions): QueryPromise<ListHqKnowledgeDocumentsData, ListHqKnowledgeDocumentsVariables>;

interface ListHqKnowledgeDocumentsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListHqKnowledgeDocumentsVariables): QueryRef<ListHqKnowledgeDocumentsData, ListHqKnowledgeDocumentsVariables>;
}
export const listHqKnowledgeDocumentsRef: ListHqKnowledgeDocumentsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listHqKnowledgeDocuments(dc: DataConnect, vars: ListHqKnowledgeDocumentsVariables, options?: ExecuteQueryOptions): QueryPromise<ListHqKnowledgeDocumentsData, ListHqKnowledgeDocumentsVariables>;

interface ListHqKnowledgeDocumentsRef {
  ...
  (dc: DataConnect, vars: ListHqKnowledgeDocumentsVariables): QueryRef<ListHqKnowledgeDocumentsData, ListHqKnowledgeDocumentsVariables>;
}
export const listHqKnowledgeDocumentsRef: ListHqKnowledgeDocumentsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listHqKnowledgeDocumentsRef:
```typescript
const name = listHqKnowledgeDocumentsRef.operationName;
console.log(name);
```

### Variables
The `ListHqKnowledgeDocuments` query requires an argument of type `ListHqKnowledgeDocumentsVariables`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface ListHqKnowledgeDocumentsVariables {
  limit: number;
  offset: number;
}
```
### Return Type
Recall that executing the `ListHqKnowledgeDocuments` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListHqKnowledgeDocumentsData`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `ListHqKnowledgeDocuments`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listHqKnowledgeDocuments, ListHqKnowledgeDocumentsVariables } from '@barberhq/browser';

// The `ListHqKnowledgeDocuments` query requires an argument of type `ListHqKnowledgeDocumentsVariables`:
const listHqKnowledgeDocumentsVars: ListHqKnowledgeDocumentsVariables = {
  limit: ..., 
  offset: ..., 
};

// Call the `listHqKnowledgeDocuments()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listHqKnowledgeDocuments(listHqKnowledgeDocumentsVars);
// Variables can be defined inline as well.
const { data } = await listHqKnowledgeDocuments({ limit: ..., offset: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listHqKnowledgeDocuments(dataConnect, listHqKnowledgeDocumentsVars);

console.log(data.membership);

// Or, you can use the `Promise` API.
listHqKnowledgeDocuments(listHqKnowledgeDocumentsVars).then((response) => {
  const data = response.data;
  console.log(data.membership);
});
```

### Using `ListHqKnowledgeDocuments`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listHqKnowledgeDocumentsRef, ListHqKnowledgeDocumentsVariables } from '@barberhq/browser';

// The `ListHqKnowledgeDocuments` query requires an argument of type `ListHqKnowledgeDocumentsVariables`:
const listHqKnowledgeDocumentsVars: ListHqKnowledgeDocumentsVariables = {
  limit: ..., 
  offset: ..., 
};

// Call the `listHqKnowledgeDocumentsRef()` function to get a reference to the query.
const ref = listHqKnowledgeDocumentsRef(listHqKnowledgeDocumentsVars);
// Variables can be defined inline as well.
const ref = listHqKnowledgeDocumentsRef({ limit: ..., offset: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listHqKnowledgeDocumentsRef(dataConnect, listHqKnowledgeDocumentsVars);

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

## GetKnowledgeReview
You can execute the `GetKnowledgeReview` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [generated/index.d.ts](./index.d.ts):
```typescript
getKnowledgeReview(vars: GetKnowledgeReviewVariables, options?: ExecuteQueryOptions): QueryPromise<GetKnowledgeReviewData, GetKnowledgeReviewVariables>;

interface GetKnowledgeReviewRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetKnowledgeReviewVariables): QueryRef<GetKnowledgeReviewData, GetKnowledgeReviewVariables>;
}
export const getKnowledgeReviewRef: GetKnowledgeReviewRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getKnowledgeReview(dc: DataConnect, vars: GetKnowledgeReviewVariables, options?: ExecuteQueryOptions): QueryPromise<GetKnowledgeReviewData, GetKnowledgeReviewVariables>;

interface GetKnowledgeReviewRef {
  ...
  (dc: DataConnect, vars: GetKnowledgeReviewVariables): QueryRef<GetKnowledgeReviewData, GetKnowledgeReviewVariables>;
}
export const getKnowledgeReviewRef: GetKnowledgeReviewRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getKnowledgeReviewRef:
```typescript
const name = getKnowledgeReviewRef.operationName;
console.log(name);
```

### Variables
The `GetKnowledgeReview` query requires an argument of type `GetKnowledgeReviewVariables`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetKnowledgeReviewVariables {
  versionId: string;
}
```
### Return Type
Recall that executing the `GetKnowledgeReview` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetKnowledgeReviewData`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `GetKnowledgeReview`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getKnowledgeReview, GetKnowledgeReviewVariables } from '@barberhq/browser';

// The `GetKnowledgeReview` query requires an argument of type `GetKnowledgeReviewVariables`:
const getKnowledgeReviewVars: GetKnowledgeReviewVariables = {
  versionId: ..., 
};

// Call the `getKnowledgeReview()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getKnowledgeReview(getKnowledgeReviewVars);
// Variables can be defined inline as well.
const { data } = await getKnowledgeReview({ versionId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getKnowledgeReview(dataConnect, getKnowledgeReviewVars);

console.log(data.membership);

// Or, you can use the `Promise` API.
getKnowledgeReview(getKnowledgeReviewVars).then((response) => {
  const data = response.data;
  console.log(data.membership);
});
```

### Using `GetKnowledgeReview`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getKnowledgeReviewRef, GetKnowledgeReviewVariables } from '@barberhq/browser';

// The `GetKnowledgeReview` query requires an argument of type `GetKnowledgeReviewVariables`:
const getKnowledgeReviewVars: GetKnowledgeReviewVariables = {
  versionId: ..., 
};

// Call the `getKnowledgeReviewRef()` function to get a reference to the query.
const ref = getKnowledgeReviewRef(getKnowledgeReviewVars);
// Variables can be defined inline as well.
const ref = getKnowledgeReviewRef({ versionId: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getKnowledgeReviewRef(dataConnect, getKnowledgeReviewVars);

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

## GetKnowledgeProductReview
You can execute the `GetKnowledgeProductReview` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [generated/index.d.ts](./index.d.ts):
```typescript
getKnowledgeProductReview(vars: GetKnowledgeProductReviewVariables, options?: ExecuteQueryOptions): QueryPromise<GetKnowledgeProductReviewData, GetKnowledgeProductReviewVariables>;

interface GetKnowledgeProductReviewRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetKnowledgeProductReviewVariables): QueryRef<GetKnowledgeProductReviewData, GetKnowledgeProductReviewVariables>;
}
export const getKnowledgeProductReviewRef: GetKnowledgeProductReviewRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getKnowledgeProductReview(dc: DataConnect, vars: GetKnowledgeProductReviewVariables, options?: ExecuteQueryOptions): QueryPromise<GetKnowledgeProductReviewData, GetKnowledgeProductReviewVariables>;

interface GetKnowledgeProductReviewRef {
  ...
  (dc: DataConnect, vars: GetKnowledgeProductReviewVariables): QueryRef<GetKnowledgeProductReviewData, GetKnowledgeProductReviewVariables>;
}
export const getKnowledgeProductReviewRef: GetKnowledgeProductReviewRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getKnowledgeProductReviewRef:
```typescript
const name = getKnowledgeProductReviewRef.operationName;
console.log(name);
```

### Variables
The `GetKnowledgeProductReview` query requires an argument of type `GetKnowledgeProductReviewVariables`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetKnowledgeProductReviewVariables {
  versionId: string;
}
```
### Return Type
Recall that executing the `GetKnowledgeProductReview` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetKnowledgeProductReviewData`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `GetKnowledgeProductReview`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getKnowledgeProductReview, GetKnowledgeProductReviewVariables } from '@barberhq/browser';

// The `GetKnowledgeProductReview` query requires an argument of type `GetKnowledgeProductReviewVariables`:
const getKnowledgeProductReviewVars: GetKnowledgeProductReviewVariables = {
  versionId: ..., 
};

// Call the `getKnowledgeProductReview()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getKnowledgeProductReview(getKnowledgeProductReviewVars);
// Variables can be defined inline as well.
const { data } = await getKnowledgeProductReview({ versionId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getKnowledgeProductReview(dataConnect, getKnowledgeProductReviewVars);

console.log(data.membership);
console.log(data.activeAliases);

// Or, you can use the `Promise` API.
getKnowledgeProductReview(getKnowledgeProductReviewVars).then((response) => {
  const data = response.data;
  console.log(data.membership);
  console.log(data.activeAliases);
});
```

### Using `GetKnowledgeProductReview`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getKnowledgeProductReviewRef, GetKnowledgeProductReviewVariables } from '@barberhq/browser';

// The `GetKnowledgeProductReview` query requires an argument of type `GetKnowledgeProductReviewVariables`:
const getKnowledgeProductReviewVars: GetKnowledgeProductReviewVariables = {
  versionId: ..., 
};

// Call the `getKnowledgeProductReviewRef()` function to get a reference to the query.
const ref = getKnowledgeProductReviewRef(getKnowledgeProductReviewVars);
// Variables can be defined inline as well.
const ref = getKnowledgeProductReviewRef({ versionId: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getKnowledgeProductReviewRef(dataConnect, getKnowledgeProductReviewVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.membership);
console.log(data.activeAliases);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.membership);
  console.log(data.activeAliases);
});
```

## ListSalonShorthand
You can execute the `ListSalonShorthand` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [generated/index.d.ts](./index.d.ts):
```typescript
listSalonShorthand(vars: ListSalonShorthandVariables, options?: ExecuteQueryOptions): QueryPromise<ListSalonShorthandData, ListSalonShorthandVariables>;

interface ListSalonShorthandRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListSalonShorthandVariables): QueryRef<ListSalonShorthandData, ListSalonShorthandVariables>;
}
export const listSalonShorthandRef: ListSalonShorthandRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listSalonShorthand(dc: DataConnect, vars: ListSalonShorthandVariables, options?: ExecuteQueryOptions): QueryPromise<ListSalonShorthandData, ListSalonShorthandVariables>;

interface ListSalonShorthandRef {
  ...
  (dc: DataConnect, vars: ListSalonShorthandVariables): QueryRef<ListSalonShorthandData, ListSalonShorthandVariables>;
}
export const listSalonShorthandRef: ListSalonShorthandRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listSalonShorthandRef:
```typescript
const name = listSalonShorthandRef.operationName;
console.log(name);
```

### Variables
The `ListSalonShorthand` query requires an argument of type `ListSalonShorthandVariables`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface ListSalonShorthandVariables {
  salonId: string;
  after: string;
}
```
### Return Type
Recall that executing the `ListSalonShorthand` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListSalonShorthandData`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `ListSalonShorthand`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listSalonShorthand, ListSalonShorthandVariables } from '@barberhq/browser';

// The `ListSalonShorthand` query requires an argument of type `ListSalonShorthandVariables`:
const listSalonShorthandVars: ListSalonShorthandVariables = {
  salonId: ..., 
  after: ..., 
};

// Call the `listSalonShorthand()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listSalonShorthand(listSalonShorthandVars);
// Variables can be defined inline as well.
const { data } = await listSalonShorthand({ salonId: ..., after: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listSalonShorthand(dataConnect, listSalonShorthandVars);

console.log(data.productAliases);

// Or, you can use the `Promise` API.
listSalonShorthand(listSalonShorthandVars).then((response) => {
  const data = response.data;
  console.log(data.productAliases);
});
```

### Using `ListSalonShorthand`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listSalonShorthandRef, ListSalonShorthandVariables } from '@barberhq/browser';

// The `ListSalonShorthand` query requires an argument of type `ListSalonShorthandVariables`:
const listSalonShorthandVars: ListSalonShorthandVariables = {
  salonId: ..., 
  after: ..., 
};

// Call the `listSalonShorthandRef()` function to get a reference to the query.
const ref = listSalonShorthandRef(listSalonShorthandVars);
// Variables can be defined inline as well.
const ref = listSalonShorthandRef({ salonId: ..., after: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listSalonShorthandRef(dataConnect, listSalonShorthandVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.productAliases);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.productAliases);
});
```

## ListHqShorthand
You can execute the `ListHqShorthand` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [generated/index.d.ts](./index.d.ts):
```typescript
listHqShorthand(vars: ListHqShorthandVariables, options?: ExecuteQueryOptions): QueryPromise<ListHqShorthandData, ListHqShorthandVariables>;

interface ListHqShorthandRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListHqShorthandVariables): QueryRef<ListHqShorthandData, ListHqShorthandVariables>;
}
export const listHqShorthandRef: ListHqShorthandRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listHqShorthand(dc: DataConnect, vars: ListHqShorthandVariables, options?: ExecuteQueryOptions): QueryPromise<ListHqShorthandData, ListHqShorthandVariables>;

interface ListHqShorthandRef {
  ...
  (dc: DataConnect, vars: ListHqShorthandVariables): QueryRef<ListHqShorthandData, ListHqShorthandVariables>;
}
export const listHqShorthandRef: ListHqShorthandRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listHqShorthandRef:
```typescript
const name = listHqShorthandRef.operationName;
console.log(name);
```

### Variables
The `ListHqShorthand` query requires an argument of type `ListHqShorthandVariables`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface ListHqShorthandVariables {
  businessId: string;
  after: string;
}
```
### Return Type
Recall that executing the `ListHqShorthand` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListHqShorthandData`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `ListHqShorthand`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listHqShorthand, ListHqShorthandVariables } from '@barberhq/browser';

// The `ListHqShorthand` query requires an argument of type `ListHqShorthandVariables`:
const listHqShorthandVars: ListHqShorthandVariables = {
  businessId: ..., 
  after: ..., 
};

// Call the `listHqShorthand()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listHqShorthand(listHqShorthandVars);
// Variables can be defined inline as well.
const { data } = await listHqShorthand({ businessId: ..., after: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listHqShorthand(dataConnect, listHqShorthandVars);

console.log(data.productAliases);

// Or, you can use the `Promise` API.
listHqShorthand(listHqShorthandVars).then((response) => {
  const data = response.data;
  console.log(data.productAliases);
});
```

### Using `ListHqShorthand`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listHqShorthandRef, ListHqShorthandVariables } from '@barberhq/browser';

// The `ListHqShorthand` query requires an argument of type `ListHqShorthandVariables`:
const listHqShorthandVars: ListHqShorthandVariables = {
  businessId: ..., 
  after: ..., 
};

// Call the `listHqShorthandRef()` function to get a reference to the query.
const ref = listHqShorthandRef(listHqShorthandVars);
// Variables can be defined inline as well.
const ref = listHqShorthandRef({ businessId: ..., after: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listHqShorthandRef(dataConnect, listHqShorthandVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.productAliases);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.productAliases);
});
```

## GetSalonSettings
You can execute the `GetSalonSettings` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [generated/index.d.ts](./index.d.ts):
```typescript
getSalonSettings(vars: GetSalonSettingsVariables, options?: ExecuteQueryOptions): QueryPromise<GetSalonSettingsData, GetSalonSettingsVariables>;

interface GetSalonSettingsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetSalonSettingsVariables): QueryRef<GetSalonSettingsData, GetSalonSettingsVariables>;
}
export const getSalonSettingsRef: GetSalonSettingsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getSalonSettings(dc: DataConnect, vars: GetSalonSettingsVariables, options?: ExecuteQueryOptions): QueryPromise<GetSalonSettingsData, GetSalonSettingsVariables>;

interface GetSalonSettingsRef {
  ...
  (dc: DataConnect, vars: GetSalonSettingsVariables): QueryRef<GetSalonSettingsData, GetSalonSettingsVariables>;
}
export const getSalonSettingsRef: GetSalonSettingsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getSalonSettingsRef:
```typescript
const name = getSalonSettingsRef.operationName;
console.log(name);
```

### Variables
The `GetSalonSettings` query requires an argument of type `GetSalonSettingsVariables`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetSalonSettingsVariables {
  salonId: string;
}
```
### Return Type
Recall that executing the `GetSalonSettings` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetSalonSettingsData`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetSalonSettingsData {
  settings?: {
    salonId: string;
    lowStockThreshold: number;
    version: number;
    updatedAt: TimestampString;
  } & SalonSettings_Key;
}
```
### Using `GetSalonSettings`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getSalonSettings, GetSalonSettingsVariables } from '@barberhq/browser';

// The `GetSalonSettings` query requires an argument of type `GetSalonSettingsVariables`:
const getSalonSettingsVars: GetSalonSettingsVariables = {
  salonId: ..., 
};

// Call the `getSalonSettings()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getSalonSettings(getSalonSettingsVars);
// Variables can be defined inline as well.
const { data } = await getSalonSettings({ salonId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getSalonSettings(dataConnect, getSalonSettingsVars);

console.log(data.settings);

// Or, you can use the `Promise` API.
getSalonSettings(getSalonSettingsVars).then((response) => {
  const data = response.data;
  console.log(data.settings);
});
```

### Using `GetSalonSettings`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getSalonSettingsRef, GetSalonSettingsVariables } from '@barberhq/browser';

// The `GetSalonSettings` query requires an argument of type `GetSalonSettingsVariables`:
const getSalonSettingsVars: GetSalonSettingsVariables = {
  salonId: ..., 
};

// Call the `getSalonSettingsRef()` function to get a reference to the query.
const ref = getSalonSettingsRef(getSalonSettingsVars);
// Variables can be defined inline as well.
const ref = getSalonSettingsRef({ salonId: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getSalonSettingsRef(dataConnect, getSalonSettingsVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.settings);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.settings);
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

There are two ways to execute a Data Connect Mutation using the generated Web SDK:
- Using a Mutation Reference function, which returns a `MutationRef`
  - The `MutationRef` can be used as an argument to `executeMutation()`, which will execute the Mutation and return a `MutationPromise`
- Using an action shortcut function, which returns a `MutationPromise`
  - Calling the action shortcut function will execute the Mutation and return a `MutationPromise`

The following is true for both the action shortcut function and the `MutationRef` function:
- The `MutationPromise` returned will resolve to the result of the Mutation once it has finished executing
- If the Mutation accepts arguments, both the action shortcut function and the `MutationRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Mutation
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `browser` connector's generated functions to execute each mutation. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-mutations).

## SaveSalonSettings
You can execute the `SaveSalonSettings` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [generated/index.d.ts](./index.d.ts):
```typescript
saveSalonSettings(vars: SaveSalonSettingsVariables): MutationPromise<SaveSalonSettingsData, SaveSalonSettingsVariables>;

interface SaveSalonSettingsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: SaveSalonSettingsVariables): MutationRef<SaveSalonSettingsData, SaveSalonSettingsVariables>;
}
export const saveSalonSettingsRef: SaveSalonSettingsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
saveSalonSettings(dc: DataConnect, vars: SaveSalonSettingsVariables): MutationPromise<SaveSalonSettingsData, SaveSalonSettingsVariables>;

interface SaveSalonSettingsRef {
  ...
  (dc: DataConnect, vars: SaveSalonSettingsVariables): MutationRef<SaveSalonSettingsData, SaveSalonSettingsVariables>;
}
export const saveSalonSettingsRef: SaveSalonSettingsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the saveSalonSettingsRef:
```typescript
const name = saveSalonSettingsRef.operationName;
console.log(name);
```

### Variables
The `SaveSalonSettings` mutation requires an argument of type `SaveSalonSettingsVariables`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface SaveSalonSettingsVariables {
  salonId: string;
  lowStockThreshold: number;
  expectedVersion: number;
}
```
### Return Type
Recall that executing the `SaveSalonSettings` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `SaveSalonSettingsData`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `SaveSalonSettings`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, saveSalonSettings, SaveSalonSettingsVariables } from '@barberhq/browser';

// The `SaveSalonSettings` mutation requires an argument of type `SaveSalonSettingsVariables`:
const saveSalonSettingsVars: SaveSalonSettingsVariables = {
  salonId: ..., 
  lowStockThreshold: ..., 
  expectedVersion: ..., 
};

// Call the `saveSalonSettings()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await saveSalonSettings(saveSalonSettingsVars);
// Variables can be defined inline as well.
const { data } = await saveSalonSettings({ salonId: ..., lowStockThreshold: ..., expectedVersion: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await saveSalonSettings(dataConnect, saveSalonSettingsVars);

console.log(data.changed);
console.log(data.result);

// Or, you can use the `Promise` API.
saveSalonSettings(saveSalonSettingsVars).then((response) => {
  const data = response.data;
  console.log(data.changed);
  console.log(data.result);
});
```

### Using `SaveSalonSettings`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, saveSalonSettingsRef, SaveSalonSettingsVariables } from '@barberhq/browser';

// The `SaveSalonSettings` mutation requires an argument of type `SaveSalonSettingsVariables`:
const saveSalonSettingsVars: SaveSalonSettingsVariables = {
  salonId: ..., 
  lowStockThreshold: ..., 
  expectedVersion: ..., 
};

// Call the `saveSalonSettingsRef()` function to get a reference to the mutation.
const ref = saveSalonSettingsRef(saveSalonSettingsVars);
// Variables can be defined inline as well.
const ref = saveSalonSettingsRef({ salonId: ..., lowStockThreshold: ..., expectedVersion: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = saveSalonSettingsRef(dataConnect, saveSalonSettingsVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.changed);
console.log(data.result);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.changed);
  console.log(data.result);
});
```

