# Increment 1 — implementation evidence

Status: **IN PROGRESS; cloud checks BLOCKED pending owner setup**.

## Angular refactor — 30 September 2026

The current working tree follows [Angular architecture and customization](../angular-architecture.md). Feature facades own session/login/inventory/access/shell behavior; Firebase adapters and pure DTO mapping live in data-access folders. A local shared UI library and shared tokens make presentation reusable. The salon page now composes presentation components and reads its facade rather than issuing SDK calls or coordinating async state itself.

Signals guidance was checked through the installed Angular MCP and local skill references. Inventory uses resource/computed/linkedSignal with a scope-bound last-known snapshot. Six facade tests cover initial errors, refresh recovery, delayed responses, sign-out, salon changes and offline refresh; two mapper tests cover quantities and missing records. This addresses the previously deferred inventory-response-after-sign-out coverage.

Visual refinements were compared with the rendered Claude prototype: dark login/toolbar, BarberHQ/DEMO brand, outlined form fields, compact two-column salon stock, Material low-stock chip, mobile role context. HQ availability remains visible in a read-only side card for the current increment; ordering/RAG controls are not implemented.

The new failed-refresh browser test initially failed: Data Connect's default `PREFER_CACHE` policy returned cached data without a server request. Inventory and membership reads now explicitly use `SERVER_ONLY`; the facade alone owns deliberate stale-display fallback. The same test then passed. Brand navigation also now uses a UrlTree, avoiding double-encoding salon IDs.

Final checks for this refactor:

- Angular: **12/12**; root suite: **20/20**; root typecheck: passed.
- Playwright: **5/5**, including real emulator login, stock quantities, error/retry, stale-read recovery, sign-out, brand navigation, keyboard navigation and 320px overflow. AXE A/AA passed on desktop inventory, mobile login and mobile inventory.
- Optimized emulator build and Hosting artifact scan: passed, 28 public files; SHA-256 `4be4f6eef92afc06962bb9af9c6e714eb18c8823c274d0c06612202303ecb1ec`.
- Initial bundle: **516.76 kB**, above the existing 500 kB warning threshold, below the 1 MB failure limit. No threshold was raised.
- Inspected final desktop and mobile screenshots under ignored `artifacts/`. No cloud deploy or stock-changing operation was added.

The local MCP configuration had duplicate `angular-cli` table names; the Firebase entry now has its own name. User-staged skill files were preserved and no commit was made during this refactor. Earlier evidence below records the pre-refactor implementation; use the linked architecture document for current paths.

## Local foundation

- Angular CLI scaffold, SPA, no SSR. Material/CDK and Firebase installed.
- Six source products, four locations, 24 synthetic inventory rows. HQ 18, each salon 2, reserved 0. Repeated generation produces identical bytes (SHA-1 `32c123a71549c73a1425726ee62e407e3e7b22c5`).
- Catalog/provenance, imported seed metadata/IDs, public configuration: 15 unit tests passed. Root TypeScript check passed.
- Angular production scaffold build passed, browser output `web/dist/barberhq/browser`.
- Build aborted under the restricted sandbox (exit 134 without diagnostics); identical build passed outside the sandbox without code changes.

## Exact versions

Node 22.22.3; npm 10.9.8. Angular/CLI 22.2.0; Material/CDK 22.2.1; Firebase 12.19.0; Firebase CLI 15.32.0; Angular TypeScript 6.0.3; operator TypeScript 7.0.2; Vitest 5.0.2; Playwright 1.63.0. Lockfiles pin transitive dependencies.

## Cloud prerequisites

Owner project `notbad-6be95`: read access verified on 2026-09-30. Web apps and Data Connect services lists are empty. No cloud mutation, deployment, schema import or Auth test has run. Follow the [owner checklist](../firebase-owner-checklist.md).

Task 1 complete locally. Tasks 2–4 have local implementation; their cloud acceptance gates remain blocked. This report does not certify live login, authorization or inventory.

## Data layer — local proof

Compiled `dataconnect/` using Firebase CLI 15.32.0, generated browser and Admin SDKs. Proposed local service/instance/database `barberhq`, region `europe-west1`; these are not provisioned resources. Owner must confirm before deployment. Commands: `npx firebase dataconnect:compile --project notbad-6be95`; regeneration via `npm run generate:sdk`.

`npx firebase emulators:start --only dataconnect,auth --project demo-barberhq` starts isolated local services. `BARBERHQ_TEST_MODE=emulator npm run test:integration` passed 2 tests with actual email/password emulator accounts and generated operations: unassigned/cross-salon/cross-business reads denied; operator write denied; repeated seed preserves modified 16-unit HQ inventory and 24 rows. Seed dry-run leaves modified inventory unchanged. Root suite: 16 passed; TypeScript passed.

Queries use server-side membership checks. Operator writes are NO_ACCESS. Seed inserts missing inventory only; a concurrent insert may fail safely and require retry. Metadata upserts do not reset stock.

Task 2 remains **BLOCKED for deployed proof**, though independent local implementation is present. Cloud App Check/account setup and target verification remain required. No local result is cloud authorization evidence.

## Angular UI — local proof

Real emulator sign-in, scoped stock, nested URL refresh, sign-out, unassigned access, failed-read Retry, keyboard login and mobile overflow checks passed in Playwright (4 scenarios). Session tests passed (3), including a deferred membership response after sign-out; the full Angular suite passed (4). Inspected 1280/360 screenshots, verified 320px overflow via browser measurement. Material UI uses the handoff typography/colors; navigation hides unfinished features. Development without config shows setup-required rather than initiating Firebase.

Strict TypeScript/template checks and production compilation passed. Initial JS/CSS budget warning: 509.85 kB vs scaffold warning 500 kB; hard limit 1 MB still passes. Cloud sign-in/App Check and deployed authorization remain unverified.

## Hosting preparation

Verified existing site ID `notbad-6be95`; no release created. Public output is exactly `web/dist/barberhq/browser`. SPA rewrites, no-cache and nosniff headers are configured. Build scans public files and denies PDFs/maps/credentials. Predeploy verifies production mode, explicit project/site and artifact hash, preventing accidental emulator deployment. Configuration, artifact and release-gate tests bring the root suite to 20 passing tests.

The optimized emulator artifact passes its scan (27 files). Production settings are intentionally unavailable until owner registration/App Check setup; no fabricated release record or live URL evidence exists. See [runbook](../deployment-runbook.md) for repeatable local startup, generated local accounts, checks, owner actions and proposed preview/promotion commands.

Known limits: only increment 1 is implemented; no requests, stock-changing user commands, RAG, PDFs or AI yet. Cloud SQL constraints/authorization, real Auth/App Check and preview/live login remain acceptance gates. Initial bundle is approximately 510 kB versus the scaffold's 500 kB warning threshold; the 1 MB hard limit passes.

Final local verification before review: root 20/20, Angular 4/4, SQL/Auth emulator 2/2, Playwright 4/4 including AXE A/AA. Typecheck passed. Hosting emulator passed three SPA routes, cache/content headers and assets; port 5002 avoids an unrelated local listener on 5000. Local demo accounts were generated in an ignored mode-0600 file. No passwords/tokens appear in tracked files.

## Review and resume point

Independent whole-branch source/evidence review (`1e32ef7..d70b10a`) confirmed no Critical/Important issue. One minor test-coverage recommendation is deferred: directly hold an inventory response across sign-out (membership delay and completed-load sign-out are already covered). See [decisions and review](increment-1-decisions.md).

The production CLI was also executed with the incomplete example config: it correctly rejected placeholders with exit 1 and cleared the stale build record. Local preview remains on `http://127.0.0.1:4200/login`, using the dedicated emulator configuration. Local account credentials are in ignored `config/demo-accounts.local.json`.

Resume with the owner checklist and this handoff: register Web app/Auth users/App Check and provision the confirmed service/region, generate SDKs if settings differ, then perform schema/seed/cloud access verification and preview/live release. Do not start increment 2 on the assumption that cloud acceptance passed. Keep the plan's scratch ledger until these gates are resolved.
