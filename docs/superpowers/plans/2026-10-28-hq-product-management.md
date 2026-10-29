# HQ product management — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans inline in the preserved Native mode. Steps use checkbox (`- [ ]`) syntax. One independent final review on the most capable available model; no implementer delegation.

**Goal:** HQ adds and edits products from HQ stock, sets HQ quantity, owns product aliases, and attaches a product card whose AI alias suggestions appear on the product screen while the card publishes in the background.

**Architecture:** New server-only callables (HQ role, App Check, revoked tokens) over native fenced SQL transactions; product-owned aliases are source-less `HQ` rows that the increment 3 lookup treats as eligible; card attachment reuses upload → extraction → generation → publication with a `PRODUCT_SCREEN` link and no document-bound aliases; Angular screen under `/hq/stock`.

**Tech Stack:** Existing Angular/Material (signals, signal forms), Firebase Auth/App Check, SQL Connect/PostgreSQL native `_execute` CTE transactions, Genkit/Vertex (existing alias generator, one call), Cloud Tasks worker. No new dependency or provider.

**Spec:** [HQ product management design](../specs/2026-10-28-hq-product-management-design.md). Builds on increments 2–3: [product review](../../implementation/product-document-alias-review.md), [alias-backed replenishment](../../implementation/alias-backed-replenishment.md).

**Authority:** Owner approved the design 28 Oct 2026. Local build and verification first; every production write in Task 6 needs explicit owner approval at that moment.

## Global constraints

- All writes through callables with server-derived business scope; SALON role is denied on every product, quantity, alias and card command. Browser connectors read only.
- Native operations: one `_execute` per transaction with dependent CTEs (toolkit 3.4.21 ruling from increment 2). Every write bumps `business.product_knowledge_revision` except quantity-only writes; increment 3 snapshots stay authoritative.
- HQ on-hand set: inventory version CAS, `onHand ≥ reserved`, 0 ≤ value ≤ 2147483647, idempotent by key, journal row in `HqStockAdjustment`. Never touches salon inventory or requests.
- Aliases: phrases 1–120 Unicode chars, kinds NAME/PHONETIC/TYPE, ≤ 32 HQ-owned active aliases per product, per-alias revision CAS, idempotent saves. No product words in application logic.
- Card attachment: existing quotas (10 AI admissions/user/UTC hour, 25 s deadline, one model call), PDF limits and Storage paths. Auto-publish only when every page is `COMPLETE` and chunks are embedded; otherwise the existing document review (pages + publish only).
- Reset to baseline per spec; business seed outside reset never overwrites HQ-edited product fields.
- Preserve the owner's dirty checkout; no stage/commit/cleanup without request. Never read `*.local.json`/`.env*`. Isolated local SQL/Auth/Angular ports (9499/9198/4215, Postgres container) as in increment 3; regenerate SDKs with `generate:sdk` right before `build:functions`.

## Builder decisions for review

1. **Product-owned alias identity**: `product-hq:` + sha256(business, product, kind, `normalizeProductForMatch(phrase)`), `source=HQ`, `sourceDocumentVersion=null`, `lang=und`. Deterministic so a re-add after removal reuses the tombstone revision.
2. **Seed alias overrides**: editing or removing a `SEED` row retires it and writes `ProductAlias.overriddenByHq=true` on the seed row; the seed planner never reactivates overridden rows. Reset clears the flag.
3. **HQ edit marker**: nullable `Product.hqUpdatedAt`/`hqUpdatedBy`; business seed skips field updates for products with `hqUpdatedAt` set (inserts still happen). Reset clears the marker and restores seed values.
4. **Card orchestration state**: new `ProductCardAttachment` (product, version, status `PROCESSING|SUGGESTED|PUBLISHED|NEEDS_REVIEW|FAILED`, suggestions JSON, generation id, revision). The worker advances it; the product screen polls it.
5. **Publication gate**: a `PRODUCT_CARD` version with a confirmed `PRODUCT_SCREEN` whole-card link and no profiles/aliases satisfies `accept` without passage review; publication then projects nothing (no type, no aliases).
6. **New product IDs**: `demoId` = `HQ-` + uppercase code slug + short hash, fixed at creation; inventory rows: HQ from form, every salon 0, inserted in the same transaction.

## Review focus

1. A dispatch/receipt commits between screen load and HQ quantity save: the save is rejected, never overwrites, never drops on-hand below reserved (Task 1).
2. Two HQ users edit the same alias, or a removal races an edit: one revision wins; stale retry never resurrects a removed alias; seed re-apply never brings back an HQ-removed seed phrase (Task 2).
3. A card is withdrawn/replaced or fails extraction after suggestions were accepted: accepted aliases stay; no document-bound aliases or type projection appear (Task 3).
4. SALON user or forged payload calls any new callable, or targets another business's product: denied with no write (Tasks 1–3).
5. 320 px product screen with 32 aliases, long names and a processing card: no horizontal scroll, edits in other sections not lost by polling (Task 4).

## File and responsibility map

- `shared/contracts/product-admin.ts`: DTOs `ProductForm`, `ProductDetail`, `SetHqStockInput`, `ProductAliasRow`, `SaveProductAliasesInput`, `CardAttachmentState`.
- `functions/src/products/{schemas,repository,commands,callables}.ts`: product, quantity, alias commands; `functions/src/products/card-attachment.ts`: orchestration hooks for upload/worker.
- `dataconnect/schema/{business,product-knowledge,stock}.gql`; server `products.gql`; browser `products.gql`; edits to `replenishment.gql` (eligibility), `product-knowledge.gql`/`knowledge.gql` (gate/publish), `seed.gql` (reset, seed planner reads).
- `scripts/seed/{business,reset,product-aliases}.ts` for baseline/overrides.
- `web/src/app/features/hq-products/{data-access,feature,ui}/…`, routes, HQ stock list buttons.
- Tests named per task; e2e `tests/e2e/hq-products.spec.ts`; handoff `docs/implementation/hq-product-management.md`.

## Task 1 — product create/update and HQ quantity

**Files:** contracts; `functions/src/products/{schemas,repository,commands,callables}.ts`; schema `Product.hqUpdatedAt/hqUpdatedBy`, new `HqStockAdjustment`; server `products.gql` (`ReadProductAdmin`, `CreateProduct`, `UpdateProduct`, `SetHqStock`); browser `products.gql` (`GetProductAdmin`); `functions/src/index.ts` exports `createProduct`, `updateProduct`, `setHqStock`; tests `tests/unit/product-admin-schemas.test.ts`, `tests/integration/product-admin.test.ts`.

**Interfaces:** `ProductForm={name,brand,category,type:string|null,summary,scent:string|null,netContentMl,retailPriceGrosz,sourceCode,sourceUrl,observedOn}`; `createProduct(uid,{form,hqOnHand,idempotencyKey})→ProductDetail`; `updateProduct(uid,{productId,expectedCatalogRevision,form,idempotencyKey})→ProductDetail`; `setHqStock(uid,{productId,expectedVersion,onHand,idempotencyKey})→{onHand,reserved,available,version}`. `ProductDetail` adds `id,demoId,hq:{onHand,reserved,version},catalogRevision`.

- [ ] **Step1 — RED schema tests:** strict input, bounds (name 1–120, price ≥0 int grosz, ml 1–100000, https URL, ISO date, code 1–64), unknown keys rejected, `type`→`seedType`/`type` mapping documented.
- [ ] **Step2 — RED SQL tests:** create inserts product + HQ + every salon inventory (0) atomically, unique code per business, duplicate key replays, business revision +1; update sets fields and `hqUpdatedAt`, CAS on catalog revision; setHqStock: version CAS, reserved floor, journal row (before/after/actor), no revision bump, replay same key; SALON/foreign business denied; concurrent dispatch vs set (Promise.all) → one fails STALE, no overwrite.
- [ ] **Step3 — Implement** commands/repository/SQL/callables (stock-command error mapping: FORBIDDEN→permission-denied, STALE_STATE→failed-precondition, unknown→unavailable with same-key retry).
- [ ] **Step4 — Verify:** focused unit + isolated SQL, root units, typecheck, compile, SDK, Functions build.

## Task 2 — product-owned aliases and seed overrides

**Files:** schema `ProductAlias.overriddenByHq: Boolean @default(false)`; server `products.gql` (`ReadProductAliases`, `SaveProductAliases`); `replenishment.gql` alias page eligibility (`HQ` with null source); `scripts/seed/product-aliases.ts` planner; callable `saveProductAliases`; tests `tests/unit/product-alias-admin.test.ts`, `tests/integration/product-aliases-admin.test.ts`, extend `product-lookup` and `product-alias-seed` tests.

**Interfaces:** `ProductAliasRow={id,phrase,kind,source:'HQ'|'SEED'|'DOCUMENT',editable:boolean,revision}`; `saveProductAliases(uid,{productId,changes:{op:'add'|'edit'|'remove',aliasId?,expectedRevision?,phrase?,kind?}[],idempotencyKey})→{aliases:ProductAliasRow[],collisions:{phrase,productNames:string[]}[]}`; collisions computed with `lookupProducts` over the fresh snapshot.

- [ ] **Step1 — RED:** source-less HQ alias resolves in lookup (NAME/PHONETIC/TYPE tiers); document aliases returned read-only; edit of SEED row retires it with `overriddenByHq` and writes HQ row; remove of SEED marks override; seed planner skips overridden rows; per-alias CAS conflict; tombstone re-add increments revision; >32 rejected; SALON denied; collisions reported for phrases matching other products.
- [ ] **Step2 — Implement** SQL (one transaction, product + business scope, revision bump), callable, planner change.
- [ ] **Step3 — Verify:** unit, isolated SQL incl. existing product-lookup/salon-alias/publication suites, fixture eval still 13/13 (+ new HQ-row case).

## Task 3 — card attachment from the product screen

**Files:** schema `ProductCardAttachment`; server ops for attachment state and gate; `functions/src/products/card-attachment.ts`; hooks in `knowledge/document-commands.ts` (create with `productId`), `knowledge/worker.ts` (after extraction → generation → suggestions → auto-publish when clean), `product-knowledge-commands.ts` gate for `PRODUCT_SCREEN`; callables `attachProductCard`, `getProductCardAttachment`, `acceptCardSuggestions` (delegates to Task 2 save); tests `tests/integration/product-card-attachment.test.ts`, unit for gate and suggestion filtering.

**Interfaces:** `attachProductCard(uid,{productId,fileName,sha256,size,idempotencyKey})→{versionId,uploadUrl…}` reusing `createDocumentUpload` contract with kind `product-card`, origin `official`; document code `CARD-{demoId}`, new version when it exists or when the product already has a linked card. `CardAttachmentState={status,versionId,suggestions:{phrase,kind,collision:string[]}[],needsReviewUrl?}`.

- [ ] **Step1 — RED:** clean card → SUGGESTED then PUBLISHED with one PRODUCT_SCREEN link, no profiles, no aliases, product type unchanged; poor extraction → NEEDS_REVIEW, review UI flag hides alias step, publish allowed after page review; suggestions exclude phrases active on the product, flag other-product collisions; accepting suggestions writes HQ aliases; withdrawing/replacing the card keeps them; second attach creates v2 of the same document; model failure → FAILED with retry, quota respected; SALON denied.
- [ ] **Step2 — Implement** with deterministic generator in tests; production uses existing `createProductKnowledgeGenerator`.
- [ ] **Step3 — Verify:** isolated SQL incl. document worker/races/publication/RAG suites, units, compile, SDK, Functions build.

## Task 4 — product screen and HQ stock entry points

**Files:** `web/src/app/features/hq-products/data-access/product-admin-api.ts`, `feature/product-editor.facade.ts`, `ui/{product-form,product-aliases,product-card}.component.ts` + specs; `app.routes.ts` (`/hq/stock/products/new`, `/hq/stock/products/:productId`, HQ guard); HQ stock component (Add product button, row link); `tests/e2e/hq-products.spec.ts`.

- [ ] **Step1 — RED specs:** form validation and dirty-state preservation; quantity save shows reserved/available and recovers from STALE by showing current numbers; alias add/edit/remove with kind select (default Name), source badges, collision warning, unknown-outcome same-key retry; card attach upload → polling → suggestions accept/edit/reject; polling never resets form or alias drafts; SALON cannot route.
- [ ] **Step2 — Implement** with existing Material patterns, separate facades per section.
- [ ] **Step3 — Verify:** Angular suite, typecheck, Playwright on isolated stack (route adapter around actual callables, deterministic model) at 1280 and 320 px; existing HQ stock and replenishment e2e unaffected.

## Task 5 — demo reset to baseline and seed safety

**Files:** `scripts/seed/reset.ts`, server `seed.gql` reset ops, `scripts/seed/business.ts`, `scripts/seed/product-aliases.ts`; tests `tests/integration/reset.test.ts`, `tests/unit/seed.test.ts`.

- [ ] **Step1 — RED:** reset removes HQ-added products (inventory, aliases, attachments, PRODUCT_SCREEN links), restores seed fields/quantities, clears `hqUpdatedAt`, HQ aliases and overrides (seed aliases re-active), clears journal; keeps published documents; business seed outside reset skips HQ-edited fields.
- [ ] **Step2 — Implement and verify** with existing reset guards (`--quiescent`, exact business confirmation).

## Task 6 — evaluation, docs, final review, rollout

- [ ] **Step1:** fixture eval extended (HQ alias, overridden seed), production-shaped browser build from the public snapshot with restore, graph update, handoff doc, spec Next step.
- [ ] **Step2:** one independent final review; one RED→GREEN fix pass; deferred minors ledgered.
- [ ] **Step3 — Rollout (each step only after explicit owner approval):** SQL diff review → migrate → connectors → Functions (params from deployed values via temporary file removed after) → preview check by owner → promote → alias seed dry-run/apply if seed data changed.

## Self-review

- Spec coverage: product screen/fields/quantity → T1, T4; product-owned aliases, kinds, collisions, seed interaction → T2; card attach, background publish, needs-review path, replacement → T3; reset baseline/seed safety → T5; rollout → T6. Non-goals (delete, deliveries, salon edits) have no tasks.
- Interfaces: Task 3 suggestion acceptance calls Task 2 `saveProductAliases`; Task 4 consumes T1–T3 callables and `ProductDetail`/`ProductAliasRow`/`CardAttachmentState`.
- Review focus items each have owning RED tests.
