# BarberHQ 1 — Login and live inventory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy sign-in and real salon inventory, including Legnicka Matowa 2 and HQ Matowa 18.

**Architecture:** Angular uses Firebase Auth and generated scoped Data Connect reads. A small operator tool seeds business records without resetting changed inventory; Hosting serves the browser build.

**Tech Stack:** Angular/Material, Firebase Web SDK, SQL Connect, TypeScript, npm, Vitest, Playwright, Firebase CLI.

**Spec:** [Approved delivery design](../specs/2026-09-29-barberhq-delivery-design.md), increment 1; original phases 1 (R1–3), 2 (business reads), 3 (structured seed), 4 (shell/Hosting).

**Status:** Ready for user review; execution not authorized by this file. Read [execution index](2026-09-29-barberhq-execution-index.md) for command conventions and shared types.

## Global Constraints

- Use Angular SPA, Firebase Auth, classic Firebase Hosting, SQL Connect (formerly Data Connect) with Cloud SQL PostgreSQL/pgvector, private Firebase Storage, and server-side Genkit/Gemini.
- AI does not mutate stock. The browser never connects directly to PostgreSQL or receives backend credentials.
- Business external key: `not-bad-stuff-demo`. Preserve the six `demoId` values in `docs/not-bad-stuff-products.json`.
- Integer units only; request quantities are 1–99. Persisted states: `PENDING_APPROVAL`, `RESERVED`, `DISPATCHED`, `RECEIVED`, `REJECTED`.
- No Firestore, SSR, Nx, additional vector database or persistent chat. Keep `.claude/specs/` in place.
- English UI; synthetic procedures visibly labeled. HTML/support.js remain unchanged design references.
- Run only the selected task/plan. Planning files describe future commands; none has been run as proof of implementation.

## Review Focus

- Late inventory response after sign-out must not expose the previous user’s data (task 3).
- A signed-in user without membership must fail direct reads, not only route navigation (task 2).
- A repeated seed must not overwrite changed stock or duplicate memberships (task 2).
- Missing or mismatched public configuration must stop the release (tasks 1 and 4).
- Refreshing a nested URL must load the app while missing data stays distinct from zero (tasks 3 and 4).

---

## Prerequisites and file responsibilities

No Firebase project exists. Local scaffold/fixture work is independent; cloud checks require the owner’s actual project.

- `web/`: one standalone Angular app; no SSR. `functions/` begins in increment 2.
- `shared/contracts/business.ts`: browser-safe TypeScript DTOs from the execution index, no server imports.
- `dataconnect/schema/business.gql`, `dataconnect/browser/`, `dataconnect/server/`: schema, scoped client reads, restricted operator writes.
- `scripts/prepare-data/` and `scripts/seed/`: fixture validation and guarded import.
- `scripts/checks/` and `tests/`: local and deployed checks; generated browser SDK lives in `web/src/app/core/generated/`, operator SDK in `scripts/generated/`.

Keep independent `web/package.json` and root tooling `package.json` lockfiles; no package workspace framework. Add `functions/package.json` later. All commands in the index run from repository root unless stated otherwise.

### Task 1: Validated local foundation and catalog

**Files:**
- Create: `.gitignore`, `package.json`, `package-lock.json`, `.node-version`, `vitest.config.ts`, `playwright.config.ts`.
- Create: `web/` using Angular CLI (including its package/lock/Angular/TS configuration).
- Create: `shared/contracts/business.ts`, `scripts/config/public-config.ts`, `scripts/prepare-data/catalog.ts`, `scripts/prepare-data/cli.ts`, `data/seed/business.json`, `config/public.example.json`.
- Test: `tests/unit/catalog.test.ts`, `tests/unit/public-config.test.ts`.
- Modify: `docs/06-firebase-setup-guide.md` with a compact increment-1 owner checklist.

**Interfaces:**
- Consumes: dated catalog JSON; exact `demoId` values and null packaging metadata.
- Produces: `buildSeed(catalog: CatalogSnapshot): BusinessSeed`, `parsePublicConfig(raw: unknown): PublicConfig`, and `npm run prepare:data`.
- Define `CatalogSnapshot`, `BusinessSeed` and `PublicConfig` as specified in the execution index in this task’s named files; retain source links/dates and integer retail grosz.

- [ ] **Step 1: Write the behavioral checks.** Use catalog/config fixtures in these test files. Tests `preserves_catalog_provenance`, `pins_golden_stock`, `rejects_cross_project_config` assert:
```ts
expect(seed.products).toHaveLength(6);
expect(seed.locations.map(x => x.key)).toEqual(['hq','legnicka','lodzka','zakladowa']);
expect(stock(seed, 'hq', 'NBS-MATOWA-100')).toBe(18);
expect(stock(seed, 'legnicka', 'NBS-MATOWA-100')).toBe(2);
expect(seed.products[0].retailPriceGrosz).toBe(6900);
expect(seed.products[0].packageDimensionsMm).toBeNull();
expect(() => parsePublicConfig(mismatchedProjectConfig)).toThrow();
```
`stock()` is a fixture lookup helper in `catalog.test.ts`; do not add it to the application API. Also reject fractional stock and missing Firebase/service identifiers.

- [ ] **Step 2: Confirm the relevant check fails.** Run `npm run test:unit -- tests/unit/catalog.test.ts tests/unit/public-config.test.ts`. Expected: a failing named behavior before implementation; repair missing test infrastructure first, because an unavailable runner is not behavioral evidence.

- [ ] **Step 3: Implement the task.** First add ignore rules for credentials, `.env*` except examples, `*.local.*`, Auth state and local evidence. If no Git repository exists, initialize one now during implementation, inspect staged files, and commit only known documentation/source files; do not add the whole workspace blindly. Verify compatible stable Angular/Material/CLI and Node versions, pin exact packages/lockfiles, then use Angular CLI for `web/` with standalone/routing/SCSS and SSR off. Establish the index’s test wrappers. Choose deterministic fictional quantities: all HQ products 18, all salons/products 2, all reservations 0; these are explicitly demo fixtures. Implement the two parsers and generate fixture JSON. Add runtime flags `replenishmentEnabled`, `knowledgeEnabled`, `replenishmentAiEnabled`, `ragEnabled`, initially false; these hide unfinished features, not authorize access. Owner checklist requests project/billing, web app, email/password users, service/location and App Check configuration; never invent project identifiers.

- [ ] **Step 4: Verify the deliverable.** Run the two tests: PASS. Run `npm run prepare:data`: six products/four locations/24 inventory rows, same bytes on repeat. Run `npm --prefix web run build`: successful empty shell build. Record exact package versions; no cloud success is implied.

- [ ] **Step 5: Record and commit.** Record real results in the increment handoff. Stage only this task’s named files after checking for secrets, then `git commit -m "chore: establish validated app foundation"`. See index for initial Git setup; never claim a commit if unavailable.

### Task 2: Scoped data operations and non-destructive seed

**Files:**
- Create: `dataconnect/dataconnect.yaml`, `dataconnect/schema/business.gql`, `dataconnect/browser/connector.yaml`, `dataconnect/browser/business.gql`, `dataconnect/server/connector.yaml`, `dataconnect/server/seed.gql`.
- Create: `scripts/seed/business.ts`, `scripts/seed/cli.ts`, `tests/support/cloud.ts`, `tests/integration/business-access.test.ts`, `tests/integration/seed.test.ts`.
- Create/modify: `firebase.json`, `.firebaserc` with verified public project identifiers only.
- Generated: `web/src/app/core/generated/`, `scripts/generated/`.

**Interfaces:**
- Consumes: `BusinessSeed`, ignored membership mapping, explicit target settings.
- Produces: `GetMyMembership`, `ListProducts`, `GetSalonInventory` with DTO mappings in the index; `seedBusiness(input: SeedInput): Promise<SeedReport>`.
- `SeedInput = {projectId:string; businessKey:string; dryRun:boolean; seed:BusinessSeed; memberships:MembershipSeed[]}`; `MembershipSeed = {uid:string; role:'HQ'|'SALON'; salonKeys:string[]}`; `SeedReport = {created:number; updatedMetadata:number; preservedInventory:number}`.
- `tests/support/cloud.ts` implements the isolated cloud harness specified by the index; no production credentials in fixtures.

- [ ] **Step 1: Write the behavioral checks.** Create `rejects_unassigned_and_foreign_reads` and `preserves_existing_inventory_on_reseed` with real generated operations:
```ts
await expect(unassigned.getSalonInventory(legnickaId)).rejects.toThrow();
await expect(lodzka.getSalonInventory(legnickaId)).rejects.toThrow();
await expect(foreign.getSalonInventory(legnickaId)).rejects.toThrow();
await h.setInventory('hq', 'NBS-MATOWA-100', 16);
await h.seedAgain();
expect((await h.inventory()).hqOnHand).toBe(16);
expect(await h.inventoryRowCount()).toBe(24);
```
`h` and role clients belong to the declared cloud harness; foreign client is scoped to an isolated second test business. Test operator mutations via ordinary credentials are denied.

- [ ] **Step 2: Confirm the relevant check fails.** Run `npm run test:integration -- tests/integration/business-access.test.ts tests/integration/seed.test.ts`. Expected: a failing named behavior before implementation; repair missing test infrastructure first, because an unavailable runner is not behavioral evidence.

- [ ] **Step 3: Implement the task.** Add Business, Membership, SalonAccess, Location, Product and Inventory tables with scoped keys/constraints. Browser operations derive identity from Auth; HQ scope is business-wide, staff scope assigned salons. Inventory read may return same-business HQ availability with salon quantities, but not other salons’ stock. Compile and generate actual SDKs using the pinned CLI; record exact generation/deployment commands in the handoff. Server/operator mutations deny direct client access. Upsert metadata and memberships by stable keys, insert inventory only when missing, never reset existing amounts. Dry run prints intended counts/target without writes. Owner completes cloud setup and supplies local UID mapping; validate region/service/project before deploying schema and loading data. Cross-business test fixtures are isolated and not visible in the ordinary demo.

- [ ] **Step 4: Verify the deliverable.** Generated SDKs type-check. Dry run writes nothing; real import yields six products/four locations/24 stock rows. Run both tests against the deployed demo database: PASS including denied reads and retained modified stock. If project/access is missing, mark cloud validation BLOCKED and finish independent local work; never replace these checks with mocks.

- [ ] **Step 5: Record and commit.** Record real results in the increment handoff. Stage only this task’s named files after checking for secrets, then `git commit -m "feat: add scoped business reads and safe seed"`. See index for initial Git setup; never claim a commit if unavailable.

### Task 3: Authenticated Angular inventory view

**Files:**
- Create: `web/src/app/core/session.service.ts`, `core/stock-api.ts`, `core/access.guard.ts`, `core/firebase.providers.ts`.
- Create: `web/src/app/features/login/login.component.ts`, `features/salon-dashboard/salon-dashboard.component.ts`, `shell/shell.component.ts`, `shared/theme.scss`, `shared/empty-state.component.ts`, `shared/stale-banner.component.ts` (all under `web/src/app/`).
- Modify: `web/src/app/app.routes.ts`, `web/src/app/app.config.ts`, `web/src/styles.scss`.
- Test: `web/src/app/core/session.service.spec.ts`, `tests/e2e/foundation.spec.ts`.

**Interfaces:**
- Consumes: generated business reads and validated `PublicConfig`.
- Produces: `SessionService.state: Signal<SessionState>`, `signIn(email:string,password:string):Promise<void>`, `signOut():Promise<void>`; `StockApi.getInventory(salonId:string):Promise<InventoryRow[]>`.
- `SessionState` and `InventoryRow` are defined in the index; map SDK responses at the API boundary. Maintain an auth-generation counter to discard requests belonging to a previous session.

- [ ] **Step 1: Write the behavioral checks.** Test `late_response_does_not_restore_signed_out_data` using an explicitly delayed fake read in the service unit test; browser tests use real Auth/SQL. Assertions:
```ts
await session.signOut();
resolvePreviousMembership(previousMember);
expect(session.state().status).toBe('SIGNED_OUT');
await expect(page.getByText('Pomada Matowa', {exact:true})).toBeVisible();
await expect(page.getByTestId('stock-NBS-MATOWA-100')).toHaveText('2');
```
Also test unassigned login shows no-access, failed reads show Retry rather than 0, and a refreshed salon URL retains correct authorization.

- [ ] **Step 2: Confirm the relevant check fails.** Run `npm run test:web -- web/src/app/core/session.service.spec.ts`. Expected: a failing named behavior before implementation; repair missing test infrastructure first, because an unavailable runner is not behavioral evidence.

- [ ] **Step 3: Implement the task.** Use email/password Auth with membership resolution before rendering protected data. Implement `/login`, `/salons/:salonId`, no-access and not-found; HQ gets the shell with a clear queue-not-yet-enabled state until increment 2. Restore only an authorized return URL. Follow handoff M3 tokens, Archivo/IBM Plex Mono, responsive sidebar/drawer and Material focus behavior. Do not copy prototype credentials or HTML runtime. Clear pending session storage and feature state on sign-out. Expose loading/error/empty/stale states and refresh on focus/reconnect, ignoring stale session responses. Hide unavailable navigation/actions.

- [ ] **Step 4: Verify the deliverable.** Run the service test and `npm run test:e2e -- tests/e2e/foundation.spec.ts`: PASS. Inspect 1280px and 360px layouts plus 320px overflow and keyboard sign-in. Never log account passwords or ID/App Check tokens.

- [ ] **Step 5: Record and commit.** Record real results in the increment handoff. Stage only this task’s named files after checking for secrets, then `git commit -m "feat: show authenticated salon inventory"`. See index for initial Git setup; never claim a commit if unavailable.

### Task 4: First Hosting release and foundation handoff

**Files:**
- Create: `scripts/config/build-web.ts`, `scripts/checks/hosting.ts`, `tests/unit/hosting-config.test.ts`, `docs/implementation/deployment-runbook.md`, `docs/implementation/handoffs/increment-1.md`.
- Modify: `web/package.json`, `firebase.json`, `config/public.example.json`.
- Generated/ignored: `web/src/app/core/public-config.generated.ts`.

**Interfaces:**
- Consumes: public config from an explicit selected local file; `parsePublicConfig()` from task 1.
- Produces: `web` script `build:production`; `npm run check:hosting -- --base-url URL`; release record `{projectId,siteId,hostingVersionId,buildHash,configHash,url}`.
- The build script allowlists public keys; endpoint URLs become required only when their feature flags are enabled in later increments.

- [ ] **Step 1: Write the behavioral checks.** Test `refuses_wrong_project_and_private_artifacts`. Assert config omission/mismatch exits nonzero, generated code contains only allowlisted fields, and Hosting public path resolves to the actual browser `index.html`. Smoke assertions:
```ts
expect(await h.httpStatus('/salons/' + legnickaId)).toBe(200);
expect(await h.header('/', 'cache-control')).toContain('no-cache');
expect(await h.publishedFileNames()).not.toContain('firebase-setup.local.md');
```
`h` here is the `scripts/checks/hosting.ts` inspection helper, not the SQL fixture harness. Check all published files for private PDFs, credentials and source maps that embed private config.

- [ ] **Step 2: Confirm the relevant check fails.** Run `npm run test:unit -- tests/unit/hosting-config.test.ts`. Expected: a failing named behavior before implementation; repair missing test infrastructure first, because an unavailable runner is not behavioral evidence.

- [ ] **Step 3: Implement the task.** Implement `build:production` as validated config generation then Angular production build. Inspect the real output before setting Hosting public; preserve Data Connect config. Set SPA catch-all to `/index.html`, no-cache headers and no service worker. Document npm clean installs for independent root/web lockfiles. Configure exact Hosting/Auth/App Check domains; publish a preview with explicit project and test before same-version promotion to live. Record the pinned CLI commands and actual IDs in the runbook. No seed/reset in deployment. Add `check:hosting` to root scripts.

- [ ] **Step 4: Verify the deliverable.** Run configuration tests, production build, Hosting emulator route checks, then preview/live foundation smoke tests. Record actual asset types/headers, nested refresh and live login/read success. Write increment-1 READY only after cloud evidence; link local results if cloud remains BLOCKED.

- [ ] **Step 5: Record and commit.** Record real results in the increment handoff. Stage only this task’s named files after checking for secrets, then `git commit -m "feat: deploy initial inventory application"`. See index for initial Git setup; never claim a commit if unavailable.

## Completion and next context

Handoff `docs/implementation/handoffs/increment-1.md` lists owner settings still needed, exact versions/SDK generation, public config, schema/seed counts, live URL and evidence. Next agent reads this report, the execution index, increment-2 plan and architecture sections 4–6. Original phases 1–4 are only partly covered; do not mark them complete.
