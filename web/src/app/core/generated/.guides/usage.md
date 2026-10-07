# Basic Usage

Always prioritize using a supported framework over using the generated SDK
directly. Supported frameworks simplify the developer experience and help ensure
best practices are followed.





## Advanced Usage
If a user is not using a supported framework, they can use the generated SDK directly.

Here's an example of how to use it with the first 5 operations:

```js
import { getMyMembership, listProducts, getSalonInventory, listActiveRequests, listHqQueue, getRequestDetail, listSalonRequests } from '@barberhq/browser';


// Operation GetMyMembership: 
const { data } = await GetMyMembership(dataConnect);

// Operation ListProducts:  For variables, look at type ListProductsVars in ../index.d.ts
const { data } = await ListProducts(dataConnect, listProductsVars);

// Operation GetSalonInventory:  For variables, look at type GetSalonInventoryVars in ../index.d.ts
const { data } = await GetSalonInventory(dataConnect, getSalonInventoryVars);

// Operation ListActiveRequests:  For variables, look at type ListActiveRequestsVars in ../index.d.ts
const { data } = await ListActiveRequests(dataConnect, listActiveRequestsVars);

// Operation ListHQQueue:  For variables, look at type ListHqQueueVars in ../index.d.ts
const { data } = await ListHqQueue(dataConnect, listHqQueueVars);

// Operation GetRequestDetail:  For variables, look at type GetRequestDetailVars in ../index.d.ts
const { data } = await GetRequestDetail(dataConnect, getRequestDetailVars);

// Operation ListSalonRequests:  For variables, look at type ListSalonRequestsVars in ../index.d.ts
const { data } = await ListSalonRequests(dataConnect, listSalonRequestsVars);


```