# Full demo reset — 29 October 2026

The reset now rebuilds knowledge from the repo ([full-demo-reset.md](full-demo-reset.md)). Order: deploy connectors (operator product publication) → reset `--dry-run` → owner review → `--apply`. Each step needs explicit owner approval.

# Release checkpoint — 25 October 2026

Current live version `4b833190c12b9244` serves the approved Back-button frontend. [Read-only release verification](release-verification.md) checks the actual bundled configuration, independent configuration hash, 59 hosted file bytes, exact Hosting channel and backend ready revisions. Use its `--artifact-only` mode before publishing; hosted mode records only an already served release. A changed environment file or generated baseline must not silently replace the approved public configuration.

The [59-item acceptance index](acceptance-coverage.md) keeps outstanding gates explicit. The [controlled pinned release trial](release-verification.md#controlled-cloud-trial--completed) passed: preview/live both serve `4b833190c12b9244`; deliberate live rollback to `6dca66a0ba4ae78d` and restoration preserved scoped operational/knowledge records and seven original metadata snapshots. The promotion attempt was a same-version no-op rejected by Hosting, not a new release. Full protected-command/upload smoke and two timed live rehearsals remain pending. Existing scripts below are historical setup recipes; choose the named reviewed public-config snapshot for release work.

Later 25 October: [two approved reset-based attempts](demo-rehearsal-2026-10-25.md) passed stock twice and preserved knowledge/original metadata. The first full scoped run passed in 5:23; the second RAG call and retry returned504 after 25.19s. Genuine offline fallback JPEGs are available. Two successful full stage repetitions remain unproven. The subsequently approved [diagnostic-only publication](rag-phase-diagnostics-2026-10-25.md) yielded a valid5.32s production answer. Previous timeout cause, preview App Check and the unset→20 max-instance difference remain unresolved; no backend release occurred during the earlier rehearsal attempts themselves.

## Historical knowledge-library checkpoint — 20 October 2026

Increment 3B is ready for the demo and subsequent AI work. The [document-library handoff](handoffs/document-library.md) records the actual HQ upload/review/publication/replacement/withdrawal workflow, dedicated SALON access checks, three real late/repeated worker deliveries and 74 deployed SQL lifecycle/conflict checks. The local integration regression passed 149 tests, unit regression 133; no test-namespace rows remain and the existing corpus/vectors/stock are unchanged. SQL tests use deterministic embeddings/in-memory Storage and local orchestration; hosted browser and actual task checks are separate evidence. No new application deployment, schema or IAM change was made for this final checkpoint.

The existing [foundation preview](https://notbad-6be95--foundation-unesffgt.web.app) is renewed through 26 October. The current 57-file build SHA-256 is `7100ec6a80180768729dfad87061d3c62fa360e1c0d9de4ededeadad88b6c0d1`; it enables the library and manual replenishment, with both AI flags still disabled. Rebuild instructions use the public-only `artifacts/library-public-config.json` input in the handoff. No additional owner configuration is needed for the completed library slice. Gemini runtime/model verification and grounded answers follow as a separate phase.

# Historical replenishment release summary — 14 October 2026

Manual replenishment is deployed to the foundation preview. Five Gen 2 Node 22 callables (`submitRequest`, `approveRequest`, `rejectRequest`, `dispatchTransfer`, `receiveTransfer`) are ACTIVE in `europe-west1` under the existing `baberhq-runtime@notbad-6be95.iam.gserviceaccount.com` account. Their public SQL target is `notbad-6be95-service/europe-west3`; the deployed server connector definitions match the repository byte-for-byte. No SQL migration/deploy, schema change, reset/reseed, IAM change, or source PDF deployment occurred. The PDF Function remains ACTIVE.

The production build and release gate passed (49 files; SHA-256 `7f2eae36a552cac2eb1a2d8175df9638deeff3983566209e44f62780fef133c4`). The successful foundation preview is [https://notbad-6be95--foundation-unesffgt.web.app](https://notbad-6be95--foundation-unesffgt.web.app), expiring 21 October 2026 at 17:12 Warsaw time. The public artifact enables only `replenishmentEnabled`; other flags remain false. Five unauthenticated protocol requests returned 401 `UNAUTHENTICATED`; this was not an isolated App Check test.

**Status: DEPLOYED — manual browser workflow accepted.** All five commands passed through the real App Check protected HQ UI on behalf of Legnicka: a two-item request was approved, dispatched, and fully received; a second request was rejected with unchanged stock. The request lifecycle, mobile entry, inventory/movement assertions, retained history, and passed full PDF reload check are documented in the [replenishment cloud handoff](handoffs/replenishment-cloud.md). Cloud concurrency, SALON-role, and revocation proof remain outstanding, so the broader increment-2 cloud gate is not READY.

Historical local instructions and commands follow unchanged.

# Increment 1 — local run and Firebase Hosting release

Current status: local implementation verified; **no cloud deployment**. Project/site `notbad-6be95` were read from Firebase. The project's Web apps and Data Connect services were empty on 2026-09-30. `barberhq` service/instance/database and `europe-west1` remain proposed settings, not existing resources.

## Clean installation and local preview

Use Node 22.22.3 (see `.node-version`) and npm 10.9.8. Generated SDKs are committed so both clean installs work without cloud access.

```sh
npm ci
npm --prefix web ci
npm --prefix functions ci
npx playwright install chromium
npm run dev:configure
npm run dev:emulators
```

Keep that terminal running. In another terminal:

```sh
npm run dev:seed
npm run dev:web
```

Open `http://127.0.0.1:4200`. Generated passwords live only in ignored `config/demo-accounts.local.json` (mode 0600); do not paste them into commits, slides or logs. Four local accounts correspond to HQ, Legnicka, Łódzka and Zakładowa. The preparation command preserves existing quantities and writes only to localhost emulators. `dev:emulators` imports `.emulator-data/` on start and exports back to it on exit, so local data survives restarts. Stop with Ctrl+C or `npm run dev:stop` (both export); a hard kill skips export. Delete `.emulator-data/` for a clean start, then rerun `npm run dev:seed`.

The default `npm --prefix web start` displays a setup-required page until explicitly configured. There is no implicit `.env` loading, SSR, or cloud fallback in the emulator profile.

## Verification

```sh
npm run test:unit
npm run typecheck
npm run test:web
BARBERHQ_TEST_MODE=emulator npm run test:integration
BARBERHQ_TEST_MODE=emulator npm run test:e2e
npm run build:emulator
npx firebase emulators:exec --only hosting --project demo-barberhq 'npm run check:hosting -- --base-url http://127.0.0.1:5002'
```

Browser tests require the emulator dev server at port 4200; they create isolated accounts and businesses and delete only their own records. Tests use real Firebase SDK operations against local services, not mocked inventory. `BARBERHQ_BASE_URL` can select another test URL. AXE checks WCAG A/AA on login and inventory; keyboard/mobile behavior is checked separately. Source maps and PDFs cannot pass the Hosting artifact inspector.

`npm run generate:sdk -- --project demo-barberhq` regenerates clients after any schema/operation change. Run `npx firebase dataconnect:compile --project notbad-6be95` before committing schema changes. The compiler does not provision or deploy a service. Emulator/compiler version observed: 3.4.21.

## Owner prerequisites for cloud

Follow the [owner checklist](firebase-owner-checklist.md): billing and region decision; register a Web app; enable email/password; create demo users; provision Data Connect/Cloud SQL; configure App Check. No service-account key belongs in this repository or the Angular app. Configure ADC/operator access privately for seed and isolated integration fixtures.

Copy `config/public.example.json` to ignored `config/public.local.json` and replace all remaining public placeholders with actual values. Confirm service/location/connector against generated SDKs. Keep private UID mappings separately in `config/memberships.local.json`:

```json
[{"uid":"ACTUAL_AUTH_UID","role":"SALON","salonKeys":["legnicka"]}]
```

Add one entry per account; HQ uses `role: "HQ", salonKeys: []`. An unassigned account deliberately has no SQL membership.

After owner provisioning and target confirmation, deploy the schema/connectors explicitly (review SQL diff before migration). Do not use `--force` to bypass a destructive migration warning:

```sh
npm run deploy:db:diff
npm run deploy:db
npm run seed:prod:dry
npm run seed:prod
```

The dry run reads current data and reports changes without writing. Metadata is upserted; existing stock is preserved. Concurrent seeds may fail on an insert conflict; rerun after the other import finishes. Do not run two seed operators simultaneously. Salon-access assignment is a provisioning operation, so run it before users start the demo.

Cloud verification must exercise real Auth, App Check and deployed operations. The Node integration harness has no browser App Check provider: when enforcement applies, run browser verification against a registered domain and add a supported test App Check setup before treating Node cloud checks as passed. Never switch off enforcement to manufacture passing tests. `BARBERHQ_TEST_CONFIG` and `BARBERHQ_ALLOW_TEST_FIXTURES=notbad-6be95` explicitly opt into isolated cloud fixtures; these are not needed for local tests.

## Build and preview

```sh
npm run build:prod
npm run deploy:preview
```

The build validates an explicit allowlist and project/SDK consistency, emits only public values, compiles Angular and scans `web/dist/barberhq/browser`. It produces ignored `artifacts/build-record.json` with project, site, mode, artifact hash and configuration hash. Firebase's predeploy hook verifies the selected CLI project, site and bytes against that record; emulator artifacts, changed files and unrecorded builds are rejected. Build/deployment never seed data.

Register actual preview/live hostnames in Auth and reCAPTCHA Enterprise/App Check before smoke testing. The configured `foundation` preview is [BarberHQ preview](https://notbad-6be95--foundation-unesffgt.web.app). Run `npm run check:hosting -- --base-url ACTUAL_PREVIEW_URL`, then real login/access/stock tests on that URL. Do not infer successful sign-in from an HTTP 200.

For document-library releases, the public-only build procedure and actual acceptance results are in the [library handoff](handoffs/document-library.md). Extend static route/worker checks explicitly with `--review-version-id not-bad-stuff-demo:CAT-001:v1 --source-version-id not-bad-stuff-demo:CAT-001:v1`. These flags verify SPA fallbacks and headers, not authenticated PDF contents or permissions. Both source/upload exact-origin CORS checks and real signed-in role checks are separate gates; do not disable App Check for a test. Operational reset preservation is tested in isolated local fixtures; do not reset the active cloud demo to repeat that test.

After explicit approval and fresh [version/configuration checks](release-verification.md), promote the pinned verified version without rebuilding. Example for the current release; do not replace it with a mutable channel name:

```sh
node node_modules/firebase-tools/lib/bin/firebase.js hosting:clone notbad-6be95@4b833190c12b9244 notbad-6be95:live --project notbad-6be95
```

Record the actual Hosting version ID and URL alongside `{projectId,siteId,buildHash,configHash}` from the build record in the increment handoff. Repeat the smoke/login/read checks on live. The existing site's registered default URL is `https://notbad-6be95.web.app`; it is not evidence that BarberHQ is deployed there.

Official reference: [Firebase Hosting releases and versions](https://firebase.google.com/docs/hosting/manage-hosting-resources). Rollback selects a recorded known-good Hosting version and does not roll back SQL. The current known-good pair is Back buttons `4b833190c12b9244` and prior request view `6dca66a0ba4ae78d`, with the same verified public configuration. The owner-approved controlled rollback/restoration passed on 25 October; [scoped data hashes, release IDs and limits](release-verification.md#controlled-cloud-trial--completed) are separate from the earlier configuration incident recovery.

## Increment 2 local startup

Use `npm --prefix functions ci` once, then `npm run dev:emulators` (Auth, SQL Connect, Functions; `dev:emulators:all` adds Hosting; Emulator UI at http://127.0.0.1:4000). Keep that terminal running; run `npm run dev:seed` and `npm run dev:web` in a second terminal. Stop everything with `npm run dev:stop`. See [increment 2 handoff](handoffs/increment-2.md) for reset and verification. Older auth/dataconnect-only commands above support the foundation only and cannot execute replenishment actions.

## Increment 2b coordinated local upgrade

Read [the handoff](handoffs/increment-2b.md) and [backup/migration/journal procedure](replenishment-items-upgrade.md) before restarting an existing demo. The preserved state is in `artifacts/replenishment-upgrade/emulators-v2`; v1 remains a rollback artifact. Reconcile any `barberhq.pending.v1` journal before reopening writers. Remove obsolete `lowStockThreshold` from private public-config JSON.

After that gate, stop any existing local emulator launchers and use three terminals from the repository root:

```sh
# Terminal 1 — matching backend, restored existing data
npm --prefix functions run build
npx firebase emulators:start --only auth,dataconnect,functions --project demo-barberhq --import artifacts/replenishment-upgrade/emulators-v2

# Terminal 2 — matching browser build
npm run dev:configure
npm run dev:web -- --poll=1000

# Terminal 3 — before stopping, export current state to a NEW directory
npm run dev:export
```

Use the latest verified export on the next restart, not the original v2 snapshot after new business actions. Existing local credentials stay in `config/demo-accounts.local.json`; no password changes are required. `npm run dev:seed` is for missing setup, not a substitute for restoring existing requests/history.

## Delivery receipt upgrade (prepared locally)

Use [delivery-upgrade.md](delivery-upgrade.md) and [handoffs/delivery-receipts.md](handoffs/delivery-receipts.md). This is a coordinated schema/backend/backfill/frontend release. Local approval does not authorize cloud migration, reset, publication or hosted stock smoke. After the first partial receipt, the earlier full-intact backend/five-state UI is not a compatible rollback.
