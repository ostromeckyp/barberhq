# HQ product management — design

28 October 2026. Follows the [product knowledge design](2026-10-24-product-knowledge-and-dictated-replenishment-design.md) (increments 1–3, deployed to `notbad-6be95`). Status: for owner review.

## Intent

HQ needs to keep the product catalog right for the demo without touching seed files or document review: add a product, correct its HQ stock, and teach the ordering assistant how people actually say the product ("drajmat", "matifajer"). Today products and HQ quantities exist only through seed scripts, aliases only through seed or a full document review, and published document aliases cannot be edited. The owner wants one simple place for this, reached from the existing HQ stock list.

## Goals

1. **Product screen for HQ**, reached from the existing HQ stock list (`/hq/stock`): "Add product" and clicking a product open the same add/edit screen.
2. **Product fields** (all on the form, all known to HQ): name, brand, category, net content (ml), displayed retail price (PLN), product code, source URL, observed date, and HQ quantity on hand. Initial products remain the seeded six.
3. **HQ quantity edit**: HQ types the new number of pieces in the HQ warehouse and saves. No delivery, reason or supplier flow.
4. **Aliases belong to the product.** The screen lists the product's aliases; HQ adds, edits and removes its own. Each alias has a kind chosen from Name / Pronunciation / Type, default Name.
5. **Attach a product card** from the product screen: HQ picks a PDF; it is processed in the background; when processing ends the screen shows AI alias suggestions from the card; HQ accepts, edits or rejects each. Accepted suggestions become product aliases like manual ones. The card is published in the background as a `PRODUCT_CARD` document linked to this product, so the procedure assistant can cite it.
6. The ordering assistant uses the product's aliases immediately (same lookup as increment 3).

## Non-goals

- Deleting or archiving products.
- Supplier deliveries, stock reasons, reorder levels or salon stock editing.
- Changing the document library's own review flow for procedures, policies or catalogs.
- A separate alias editor per document. Document review (increment 2) keeps working as is.

## Anti-goals (would be a failure even if it works)

- An HQ quantity save that silently overwrites a concurrent dispatch or receipt, or drives HQ on-hand below what is reserved for salon deliveries.
- Withdrawing or replacing a card silently removing aliases HQ accepted.
- A salon user able to see or call product editing.
- A product write that leaves the assistant reading a stale catalog without a revision change.

## Owner decisions

- Entry point is the existing HQ stock list; add and edit share one screen.
- All listed product fields are form fields.
- Quantity change is a plain HQ-only set; "under demo we don't model deliveries".
- Aliases belong to the product, not to the document.
- Card attachment: suggestions shown on the product screen after processing; publication happens in the background without a separate document review.
- Add and edit only; no delete for the demo.

## Builder decisions (marked as Claude's calls; owner may override)

- **New products get 0 stock in every salon** so salons can order them at once; HQ quantity from the form.
- **Quantity floor**: the new HQ on-hand must be ≥ HQ reserved. The save carries the inventory version it was based on; a concurrent change rejects the save and the screen shows the current numbers for re-entry.
- **Audit**: each HQ quantity change writes a row to a new `HqStockAdjustment` journal (business, product, before, after, actor, time, idempotency key). The existing `StockMovement` table is keyed by transfer items and is not reused. No UI for the journal in this increment.
- **Alias kinds** in the UI: "Name" = `NAME`, "Pronunciation" = `PHONETIC`, "Type" = `TYPE`. A warning appears when a phrase also matches other products ("also matches: Mattifier, Pomada Matowa"), computed with the increment 3 lookup normalization.
- **Alias storage**: product-owned aliases are `ProductAlias` rows with `source = HQ`, `sourceDocumentVersion = null`, `status = ACTIVE`, business-global. Increment 3 currently treats `HQ` rows as eligible only with a current published source; this increment extends eligibility to source-less `HQ` rows. Seed rows stay `SEED`; HQ can edit or remove them from the product screen (an edit converts the phrase to an HQ-owned row and retires the seed row so the seed never re-creates it — see "Seed interaction").
- **Background publication**: a card attached from the product screen auto-publishes only when extraction is clean (every page `COMPLETE`, expected chunks embedded). Otherwise the screen shows "card needs review" with a link to the existing document review; alias suggestions are still usable.
- **Card replacement**: attaching a new card to a product with an existing card creates a new version of the same document (document code derived from the product), replacing the previous one in the library.
- **Suggestion filtering**: AI suggestions drop phrases already active on this product; phrases active on other products are shown with the collision warning, not dropped.
- **Revisions**: every product, quantity or alias write bumps the business catalog revision used by increment 3 snapshots, except quantity-only changes, which already participate in stock versioning.

- **What a background-published card carries**: one confirmed whole-card link to the product (method `PRODUCT_SCREEN`) and nothing else — no type assertion, no document-bound aliases. Product type and aliases change only through the product screen. The increment 2 gate "card needs one confirmed product link plus complete review" is satisfied by this link for cards attached from the product screen only.
- **"Card needs review" path**: the existing document review is used for pages/passages and publication only; its alias-generation step is hidden for cards attached from the product screen, so every accepted alias stays product-owned.
- **Aliases from other published documents** (catalogs, earlier cards) are shown read-only with a "From document" badge and count for suggestion filtering and collision warnings. HQ overrides them by adding its own alias; editing them stays in document review.
- **Product already has a card from document review**: "Attach card" creates a new version of that existing card document rather than a second card.
- **Form fields beyond the owner's list**: optional "type" (product type used by the assistant's type tier, stored as the product's seed-level type so a document never needs to supply it), required "description" (`summaryEn`, fed to the assistant) and optional "scent". Logistics fields (pack size, dimensions, weight) stay off the form.
- **Product code** is editable; `Product.id`/`demoId` and the card document code are fixed at creation and never change.

## Demo reset and re-seed (owner decision: return to baseline)

A demo reset restores the seeded baseline so the demo can be repeated from zero: HQ-added products (with their inventory, aliases and product-screen cards' links) are removed, seeded product fields and HQ/salon quantities return to seed values, HQ aliases and HQ edits/removals of seed aliases are cleared (seed aliases re-activated), and the `HqStockAdjustment` journal is cleared. Requests and transfers are reset as today. Published knowledge documents are not deleted by reset. Outside a reset, re-running the business seed never overwrites HQ product edits; the alias seed follows the rules below.

## Rollout (Claude's call; owner may override)

Build and verify locally first (as increments 2–3), then deploy to `notbad-6be95` as the last plan step: additive migration, connectors, Functions, preview, promote — each production write with explicit owner approval.

## Seed interaction

Seed apply (increment 3) manages only `SEED` rows. When HQ edits or removes a seeded alias, the seed row is retired and an `HQ` row (for edits) takes its place. The seed planner must treat a retired seed row whose phrase/product/kind has an active `HQ` row, or that HQ removed, as owner-decided and not reactivate it. Product field edits keep `seedType`/`keywords` unchanged unless HQ edits the type; the product form's category is the existing `category` field.

## Data and security

- Writes go through server-side callables (HQ role, business scope, App Check, revoked-token checks), never browser mutations. Reads may use browser connectors guarded like existing HQ queries.
- Product create/update reuses the `Product` table; `demoId` for new products is derived server-side from the code. Product code is unique per business.
- HQ inventory set is one transaction: HQ membership, product in business, inventory version CAS, on-hand ≥ reserved, journal insert, version bump.
- Alias writes are one transaction per save with per-alias revision CAS; idempotent by key for unknown-outcome retries, as increment 3 removal.
- Card attachment reuses the existing upload (`uploadKnowledgePdf`), extraction worker and product knowledge generation (one model call, existing quotas: 10 AI admissions per user per UTC hour, 25 s deadline). The new piece is an orchestration that links the version to the product, runs generation, stores suggestions, and publishes when clean.

## Screens

- **HQ stock list**: unchanged table plus "Add product" and a link/click on each row.
- **Product screen** (add/edit, 320 px to desktop): product fields form; HQ quantity with current reserved/available shown; alias list grouped by kind with source badge (Manual / From card / Seed) and edit/remove; "Add alias" row (phrase + kind); "Attach card" with processing state, suggestion list (accept / edit / reject) and card status (published / needs review).
- Salon users never see these controls; HQ routes use the existing HQ guard.

## Testing expectations

Unit and isolated-SQL tests in the style of increments 2–3 (native PostgreSQL 17/pgvector), Angular component/facade tests, one browser acceptance at desktop and 320 px. Specific gates: concurrent dispatch vs quantity save; reserved floor; alias collision warnings; seed re-apply after HQ edits/removals; card replacement keeps accepted aliases; salon role denied on every write; assistant resolves a newly added alias without redeploy.

## Left to the builder

Exact callable names and payloads, SQL operation names, form layout details within existing Angular Material patterns, page sizes, copy wording, and how the card orchestration is split across existing worker tasks, as long as the decisions above hold.
