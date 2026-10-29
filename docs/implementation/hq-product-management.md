# HQ product management — local implementation

28 October 2026. Implements the [HQ product management plan](../superpowers/plans/2026-10-28-hq-product-management.md) from the [approved design](../superpowers/specs/2026-10-28-hq-product-management-design.md). Local only until the owner approves each production step.

## What HQ can do

- **HQ stock → Add product / click a product** opens one screen (`/hq/stock/products/new`, `/hq/stock/products/:productId`).
- **Product details**: name, brand, category, optional type, description, optional scent, net content, retail price, product code (unique per business), source URL and observed date. Saving bumps the catalog revision, so the ordering assistant sees changes at once. A new product gets the entered HQ quantity and 0 in every salon.
- **HQ quantity**: set the on-hand number. It cannot go below what is reserved for salon deliveries; if stock moved meanwhile the screen shows the current numbers instead of overwriting. Each change is journaled (`HqStockAdjustment`).
- **Aliases** belong to the product, grouped by kind (Name / Pronunciation / Type): add, edit in place or remove. Seed aliases can be removed or replaced (the seed never brings them back); aliases from published documents are shown read-only. A warning lists other products the phrase also matches exactly. At most 32 own aliases per product.
- **Product card**: pick a PDF; it uploads through the existing document pipeline, then one AI call suggests aliases (edit, accept or reject on the screen). Reopening the product resumes an unfinished card; a failed one offers Retry processing, which replays completed steps. A cleanly extracted card is published in the background with only a product link (no type, no document-bound aliases); otherwise it is marked "needs document review". Attaching again creates a new version of the same card. Withdrawing a card never removes accepted aliases.

## Data and guarantees

Additive schema: `Product.hqUpdatedAt/hqUpdatedBy`, `ProductAlias.overriddenByHq`, tables `HqStockAdjustment`, `ProductAdminOperation` (idempotency journal), `ProductCardAttachment`. All writes are HQ-only callables (Auth, App Check, revoked tokens) over single native SQL transactions with CAS; the business is derived from the caller's membership. Product-owned aliases are source-less `HQ` rows and are eligible in the increment 3 lookup. New callables: `getProductAdmin`, `createProduct`, `updateProduct`, `setHqStock`, `listProductAliases`, `saveProductAliases`, `attachProductCard`, `processProductCard`, `getProductCardAttachment`.

## Demo reset and seed

`scripts/seed/reset.ts` now also returns HQ product work to the seeded baseline: HQ-added products (with inventory, aliases and card attachments) are removed, seeded fields and quantities restored, HQ aliases and seed-alias overrides cleared, journals emptied, and the reviewed alias seed re-applied. Published documents stay. Outside a reset the business seed skips products HQ edited.

## Verification (local, isolated SQL 9499 / Auth 9198 / Angular 4215)

| Gate | Result |
| --- | --- |
| Root unit | 359 passed |
| Angular | 221 passed |
| Isolated SQL (product admin, aliases, card attachment, reset, seed, lookup, salon shorthand, replenishment agent, documents, publication, RAG) | 86 passed, 1 skipped (existing) |
| Browser (Playwright): add product, quantity, alias, collision at 1280 and 320 px; salon denied | 3 passed |
| Fixture lookup evaluation | 14/14 |

The card upload/poll UI was not exercised in a browser (needs Storage + extraction worker); the flow is covered by SQL integration with a deterministic model and by facade tests. Real model suggestion quality is unmeasured until the production card test.

## Rollout

Additive migration → connectors → Functions (9 new callables) → preview → owner check → promote. Each step needs owner approval.
