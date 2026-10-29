# Basic Usage

Always prioritize using a supported framework over using the generated SDK
directly. Supported frameworks simplify the developer experience and help ensure
best practices are followed.





## Advanced Usage
If a user is not using a supported framework, they can use the generated SDK directly.

Here's an example of how to use it with the first 5 operations:

```js
import { getMyMembership, listProducts, getSalonInventory, getHqInventory, getDeliveryProcedureBindings, listDeliveryProcedureDocuments, getDeliveryReceipt, getDeliveryIssue, listDeliveryIssues, getSourceSection } from '@barberhq/browser';


// Operation GetMyMembership: 
const { data } = await GetMyMembership(dataConnect);

// Operation ListProducts:  For variables, look at type ListProductsVars in ../index.d.ts
const { data } = await ListProducts(dataConnect, listProductsVars);

// Operation GetSalonInventory:  For variables, look at type GetSalonInventoryVars in ../index.d.ts
const { data } = await GetSalonInventory(dataConnect, getSalonInventoryVars);

// Operation GetHqInventory:  For variables, look at type GetHqInventoryVars in ../index.d.ts
const { data } = await GetHqInventory(dataConnect, getHqInventoryVars);

// Operation GetDeliveryProcedureBindings: 
const { data } = await GetDeliveryProcedureBindings(dataConnect);

// Operation ListDeliveryProcedureDocuments:  For variables, look at type ListDeliveryProcedureDocumentsVars in ../index.d.ts
const { data } = await ListDeliveryProcedureDocuments(dataConnect, listDeliveryProcedureDocumentsVars);

// Operation GetDeliveryReceipt:  For variables, look at type GetDeliveryReceiptVars in ../index.d.ts
const { data } = await GetDeliveryReceipt(dataConnect, getDeliveryReceiptVars);

// Operation GetDeliveryIssue:  For variables, look at type GetDeliveryIssueVars in ../index.d.ts
const { data } = await GetDeliveryIssue(dataConnect, getDeliveryIssueVars);

// Operation ListDeliveryIssues:  For variables, look at type ListDeliveryIssuesVars in ../index.d.ts
const { data } = await ListDeliveryIssues(dataConnect, listDeliveryIssuesVars);

// Operation GetSourceSection:  For variables, look at type GetSourceSectionVars in ../index.d.ts
const { data } = await GetSourceSection(dataConnect, getSourceSectionVars);


```