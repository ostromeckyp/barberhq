# Performance Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut the first-visit weight (icon font, reCAPTCHA, auth iframe), merge the 31 user-facing callables into two Cloud Run services, and give the owner npm scripts to warm and pin them.

**Architecture:** Fonts move to Google Fonts with an icon subset guarded by a unit test. App Check becomes a memoised `firebase.appCheck()` promise awaited by every callable/PDF request and started at idle after the first navigation. Functions gain two `onCall` routers (`commands`, `ai`) that dispatch `{ op, input }` to the existing callables through their `.run(request)`; the web calls them through one helper. Two scripts drive warm-up and `min-instances` through plain HTTPS and `gcloud`.

**Tech Stack:** Angular 22 (zoneless, signals), Firebase JS SDK, firebase-functions 7.4 v2 `onCall`, Vitest, Playwright, Node 22 scripts run with `node --import tsx`.

**Spec:** `docs/superpowers/specs/2026-11-02-performance-design.md`

## Global Constraints

- Follow `AGENTS.md`: never read `*.local.json` or `.env`; TDD (watch each new test fail first); logic files ≤ 300 lines; one exported model per file (`tests/unit/code-structure.test.ts`): functions models only in `models/`, contracts one export per file named after the file.
- Every user-visible text is a Transloco key in `en.json` and `pl.json` (no new UI text is expected in this plan).
- No behaviour change beyond the spec. Existing tests stay green; change them only where a function name, font package or the App Check shape changed on purpose.
- Region `europe-west1`, project `notbad-6be95`. Never run a command that writes to production; deploys are done by the controller after the owner approves.
- Starting the emulators regenerates `scripts/generated/browser/index.d.ts` and `web/src/app/core/generated/index.d.ts`; revert them with `git checkout --` and never commit them.
- E2E: `BARBERHQ_TEST_MODE=emulator npx playwright test <files>` with `npm run dev:emulators` and `npm run dev:web` running. Run one spec file group at a time.
- Commits: Conventional Commits, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. An icon used only through a binding (`[icon]="…"`, a ternary inside `<mat-icon>`, a TS constant) that the collector misses → renders as text in production; the test must collect these forms.
2. A callable fired before the idle App Check start (e.g. the HQ queue loading right after sign-in) → must still carry an App Check token, because it awaits `firebase.appCheck()`.
3. The knowledge `callable()` helper reads tokens from `request.rawRequest`; the router must pass the original request through with only `data` replaced, or auth/App Check checks break.
4. An unknown or missing `op`, or `input` missing → `invalid-argument`, never a crash or a call to the wrong handler.
5. E2E mocks that matched old function URLs silently stop matching after the rename → tests would hit the real emulator instead of the mock; every old route mock must be moved and proven to still intercept.

---

### Task 1: Fonts from Google Fonts with a guarded icon subset

**Files:**
- Modify: `web/src/index.html` (head links; splash `font-family`)
- Modify: `web/src/styles.scss:6-8,18` (drop the three `@use` font imports; body family)
- Modify: every `'Archivo Variable'` → `'Archivo'`: `web/src/app/shared/theme.scss:22-23`, `web/src/app/shared/ui/boot-splash/boot-splash.ts:25`, `web/src/app/features/procedures/cited-answer.component.ts:211`, `web/src/app/features/procedures/document-row.component.ts:123`
- Modify: `web/package.json` (remove `material-symbols`, `@fontsource-variable/archivo`, `@fontsource/ibm-plex-mono`), lockfile via `npm --prefix web uninstall`
- Create: `tests/unit/icon-font.test.ts`

**Interfaces:**
- Produces: the icon list lives only in the Material Symbols `<link>` in `web/src/index.html`, as the `icon_names` query value.

- [ ] **Step 1: Write the failing test** `tests/unit/icon-font.test.ts`, `describe('icon font subset')`:
  - `it('requests Material Symbols with an icon_names subset')`: read `web/src/index.html`, find the `fonts.googleapis.com/css2` link whose `family` starts with `Material+Symbols+Outlined`; expect `icon_names` present.
  - `it('lists icon_names sorted and unique')`: `expect(names).toEqual([...new Set(names)].sort())`.
  - `it('includes every icon the app uses')`: walk `web/src/app/**/*.{ts,html}` excluding `*.spec.ts` and `core/generated*`; collect (a) every word or quoted literal inside `<mat-icon …>…</mat-icon>` (multi-line, including `'check'` in ternaries; ignore `{{`, `}}`, `?`, `:` and translation keys containing `.`), (b) `fontIcon="x"`, (c) `icon="x"` attributes, (d) `icon[A-Za-z]*\s*:\s*'x'` in TS, (e) quoted literals inside `[icon]="…"` bindings. Names match `/^[a-z0-9_]+$/`. `expect(used.filter((n) => !names.includes(n))).toEqual([])`.
  - `it('loads text fonts from Google Fonts, not npm packages')`: `index.html` has links for `family=Archivo` and `family=IBM+Plex+Mono:wght@500`; `web/src/styles.scss` contains neither `@fontsource` nor `material-symbols`.
- [ ] **Step 2: Run** `npx vitest run tests/unit/icon-font.test.ts` — Expected: FAIL (no Google Fonts link).
- [ ] **Step 3: Implement.** In `index.html` `<head>`: `preconnect` to `https://fonts.googleapis.com` and `https://fonts.gstatic.com` (`crossorigin`); one stylesheet `https://fonts.googleapis.com/css2?family=Archivo:wght@100..900&family=IBM+Plex+Mono:wght@500&display=swap`; one stylesheet `https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:FILL@0..1&icon_names=<sorted list>&display=block`. Remove the npm font `@use` lines and packages; rename `'Archivo Variable'` to `'Archivo'` in all listed files and the splash. `MAT_ICON_DEFAULT_OPTIONS` (`fontSet: 'material-symbols-outlined'`) stays — Google's CSS defines that class.
- [ ] **Step 4: Run** `npx vitest run tests/unit/icon-font.test.ts tests/unit/code-structure.test.ts && npm run test:web && npm run typecheck` — Expected: PASS.
- [ ] **Step 5: Visual check.** `npm run build:emulator`, serve, open `/login` and one icon-heavy page (salon dashboard, request detail) at 390 px; confirm icons render as glyphs (not words), text uses Archivo, the request-detail filled icon is filled. Save one screenshot per page under the scratchpad.
- [ ] **Step 6: Commit** `perf(web): fonts from Google Fonts with icon subset`.

### Task 2: App Check at idle, auth without popup resolver

**Files:**
- Modify: `web/src/app/core/firebase.providers.ts`
- Modify: `web/src/app/app.ts` (start App Check at idle after first navigation)
- Modify: `web/src/app/core/knowledge-api.ts:196-200`, `web/src/app/features/procedures/data-access/knowledge-documents-api.ts:168-172` (await `firebase.appCheck()`)
- Test: `web/src/app/core/firebase.providers.spec.ts` (create), `web/src/app/app.spec.ts`, existing specs that build a fake `FIREBASE`

**Interfaces:**
- Produces: `createFirebase()` returns `{ auth, data, functions, appCheck: () => Promise<AppCheck | null> }`. Memoised: the first call runs `initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(siteKey), isTokenAutoRefreshEnabled: true })`; emulator mode resolves `null` without initialising. Auth is `initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence] })`.

- [ ] **Step 1: Write failing tests.**
  - `firebase.providers.spec.ts` (mock `firebase/app`, `firebase/auth`, `firebase/app-check`, `firebase/functions`, `firebase/data-connect`): `createFirebase()` does not call `initializeAppCheck`; `await appCheck()` twice calls it exactly once and returns the same instance; `initializeAuth` is called with both persistences and no `popupRedirectResolver`; `getAuth` is not called.
  - `app.spec.ts`: after the first `NavigationEnd`, an idle callback (stub `requestIdleCallback`) calls `firebase.appCheck()` once; before it, not at all.
  - `knowledge-api` PDF test: with a fake `appCheck` that resolves only when released, `getPdf()` does not call `fetch` until it resolves, then sends `X-Firebase-AppCheck`.
- [ ] **Step 2: Run** `npm run test:web` — Expected: the new tests FAIL.
- [ ] **Step 3: Implement** per Interfaces. `App`: inject `FIREBASE`; on the same first-navigation signal used for `booting`, schedule `requestIdleCallback(() => void firebase.appCheck(), { timeout: 2000 })`, falling back to `setTimeout(…, 0)` when `requestIdleCallback` is missing. PDF read and upload paths: `const appCheck = await this.firebase.appCheck()` before building headers; keep today's error when it is `null` outside emulators. Update every spec's fake `FIREBASE` to the new shape.
- [ ] **Step 4: Run** `npm run test:web && npm run typecheck` — Expected: PASS.
- [ ] **Step 5: Commit** `perf(web): start App Check at idle, auth without popup resolver`.

### Task 3: Function routers `commands` and `ai`

**Files:**
- Create: `shared/contracts/functions/index.ts`, `command-ops.ts` (`export const commandOps = [...] as const`), `command-op.ts` (`export type CommandOp`), `ai-ops.ts`, `ai-op.ts`
- Create: `functions/src/routing/router.ts` (`createRouter`), `functions/src/routing/commands.ts`, `functions/src/routing/ai.ts`
- Modify: `functions/src/index.ts` (export `commands`, `ai`, `getSourcePdf`, `uploadKnowledgePdf`, `processKnowledgeTask`; drop the 31 merged exports)
- Test: `tests/unit/function-router.test.ts`

**Interfaces:**
- Produces: `commandOps` = `submitRequest, approveRequest, rejectRequest, dispatchTransfer, receiveTransfer, recordDeliveryReceipt, startDeliveryIssueReview, addDeliveryIssueNote, createDeliveryReplacement, setDeliveryProcedure, getDeliveryProcedures, removeSalonShorthand, getProductAdmin, createProduct, updateProduct, setHqStock, listProductAliases, saveProductAliases, attachProductCard, getProductCardAttachment, createDocumentUpload, reviewAndPublishDocument, retryDocumentProcessing, deleteKnowledgeVersion, saveKnowledgeProductReview, acceptKnowledgeProductReview`; `aiOps` = `prepareReplenishment, answerProcedureQuestion, suggestKnowledgeProductLink, generateKnowledgeProductAliases, processProductCard`. Wire format: callable `commands` / `ai` with `data = { op, input }`.
- Produces: `createRouter(ops: Record<string, { run(request: CallableRequest): unknown }>)` returns the async handler `(request: CallableRequest) => unknown`; `commands.ts` / `ai.ts` export `onCall({ region: 'europe-west1', enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== 'true', maxInstances: 5 }, createRouter({...}))`, building the op map from today's factories (`stockCommand('SUBMIT')`, `createProductFunction()`, …) exactly as `index.ts` does now.

- [ ] **Step 1: Write the failing test** `tests/unit/function-router.test.ts`:
  - `it('passes input as data and keeps the rest of the request')`: fake op `{ run: vi.fn(async (r) => r) }`; request `{ data: { op: 'a', input: { x: 1 } }, auth: { uid: 'u' }, rawRequest: R }` → `run` receives `{ ...request, data: { x: 1 } }` with the same `rawRequest` and `auth`.
  - `it('rejects an unknown op')`, `it('rejects a missing op')`, `it('rejects non-object data')`: throws `HttpsError` with code `invalid-argument`; no op runs.
  - `it('propagates handler errors unchanged')`: op throws `new HttpsError('permission-denied', 'x')` → same error.
  - `it('covers the contract exactly')`: keys of the `commands` op map equal `commandOps`, keys of the `ai` op map equal `aiOps`, and the two lists are disjoint (export the maps from `commands.ts` / `ai.ts` as `commandHandlers` / `aiHandlers` for this check).
  - `it('index exports only the routed and standalone functions')`: `Object.keys(await import('functions/src/index'))` sorted equals `['ai', 'commands', 'getSourcePdf', 'processKnowledgeTask', 'uploadKnowledgePdf']` (mock `firebase-admin/app` `initializeApp`).
- [ ] **Step 2: Run** `npx vitest run tests/unit/function-router.test.ts` — Expected: FAIL (modules missing).
- [ ] **Step 3: Implement** per Interfaces. `createRouter` validates `data` is an object with a string `op` that is an own key of `ops`; then `return ops[op].run({ ...request, data: data.input })`.
- [ ] **Step 4: Run** `npx vitest run tests/unit && npm run typecheck && npm run build:functions` — Expected: PASS (code-structure included).
- [ ] **Step 5: Commit** `perf(functions): route callables through commands and ai services`.

### Task 4: Web callers and e2e mocks use the routers

**Files:**
- Create: `web/src/app/core/call-function.ts`, `web/src/app/core/call-function.spec.ts`
- Modify: `web/src/app/core/assistant-api.ts`, `web/src/app/features/procedures/data-access/knowledge-documents-api.ts`, `web/src/app/features/salon-settings/data-access/salon-shorthand-api.ts`, `web/src/app/features/replenishment/data-access/replenishment-api.ts`, `web/src/app/features/delivery/data-access/delivery-api.ts`, `web/src/app/features/hq-products/data-access/product-admin-api.ts`, and their specs
- Modify: e2e mocks in `tests/e2e/` that match `submitRequest`, `approveRequest`, `recordDeliveryReceipt`, `setDeliveryProcedure`, `createDeliveryReplacement`, `prepareReplenishment`, `answerProcedureQuestion`, `**/europe…` (`getSourcePdf` stays)

**Interfaces:**
- Consumes: `commandOps`, `aiOps`, `CommandOp`, `AiOp` from `shared/contracts/functions/index`; `firebase.appCheck()` from Task 2.
- Produces: `callFunction<I, O>(firebase: { functions: Functions; appCheck: () => Promise<unknown> }, op: CommandOp | AiOp, input: I): Promise<O>` — awaits `firebase.appCheck()`, then `httpsCallable<{ op; input: I }, O>(firebase.functions, aiOps.includes(op) ? 'ai' : 'commands')({ op, input })` and returns `.data`. Errors propagate unchanged, so each API's existing error mapping keeps working.

- [ ] **Step 1: Write the failing test** `call-function.spec.ts` (mock `firebase/functions`): `submitRequest` → `httpsCallable(functions, 'commands')` called with `{ op: 'submitRequest', input }`; `prepareReplenishment` → `'ai'`; `httpsCallable` not invoked until `appCheck()` resolves; a rejected callable rejects with the same error object.
- [ ] **Step 2: Run** `npm run test:web` — Expected: FAIL.
- [ ] **Step 3: Implement** `callFunction`; replace every `httpsCallable(…, name)(input)` in the six APIs with `callFunction(this.firebase, name, input)` keeping their error handling; update their specs to assert the op name instead of the function name.
- [ ] **Step 4: Run** `npm run test:web && npm run typecheck` — Expected: PASS; `grep -rn "httpsCallable" web/src/app --include=*.ts | grep -v spec` shows only `call-function.ts`.
- [ ] **Step 5: Update e2e mocks.** Route `**/commands` / `**/ai` and branch on `route.request().postDataJSON().data.op`; fall through with `route.fallback()` for other ops. For each moved mock, first run its spec unchanged after Task 3 to watch it fail or hit the real backend, then move it.
- [ ] **Step 6: Run e2e** (emulators + `dev:web`): `replenishment`, `replenishment-ai`, `procedure-rag`, `hq-products`, `salon-shorthand`, `delivery*`, `demo-scenarios`, `ui-states`, `ux-ui-design`, `responsive-order`, `mobile-layout` — Expected: same pass/fail set as on `main` (the 10 assistant-gated failures listed in the ledger stay the only failures).
- [ ] **Step 7: Commit** `perf(web): call functions through commands and ai routers`.

### Task 5: Warm-up and instance scripts, docs

**Files:**
- Create: `scripts/dev/functions-warm.ts`, `scripts/dev/functions-instances.ts`
- Modify: `package.json` scripts, `AGENTS.md` (Deployment), `docs/commands.md` (Publish / new "Demo day" section)
- Test: `tests/unit/functions-scripts.test.ts`

**Interfaces:**
- Produces: `warmTargets(project: string, region: string): { name: string; url: string; method: 'POST' | 'GET' }[]` → `commands` and `ai` as POST `https://<region>-<project>.cloudfunctions.net/<name>` with body `{"data":{}}`, `getSourcePdf` as GET. `instancesCommands(n: number, project, region): string[][]` → one `['gcloud','run','services','update',svc,'--min-instances',String(n),'--region',region,'--project',project,'--quiet']` per service `commands`, `ai`, `getsourcepdf`; throws for `n` not an integer in 0..3.
- Scripts: `"functions:warm": "node --import tsx scripts/dev/functions-warm.ts"`, `"functions:instances": "node --import tsx scripts/dev/functions-instances.ts"`. Warm prints `name status ms` per target and exits 0 whenever every request got any HTTP response. Instances runs the commands, then prints `gcloud run services describe … --format='value(spec.template.metadata.annotations["autoscaling.knative.dev/minScale"])'` per service.

- [ ] **Step 1: Write the failing test** for `warmTargets` (exact URLs/methods for `notbad-6be95`, `europe-west1`) and `instancesCommands` (exact argv for `1`; throws for `-1`, `4`, `1.5`, `NaN`).
- [ ] **Step 2: Run** `npx vitest run tests/unit/functions-scripts.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** both modules (pure functions exported, CLI guarded by `import.meta.url` like `scripts/checks/release.ts`). Add npm scripts. Document in `AGENTS.md` Deployment: what each does, that warm needs no credentials, that `functions:instances` needs the owner's approval like any production change and costs money while > 0, that the next Functions deploy resets it to 0. Same in `docs/commands.md` with example commands.
- [ ] **Step 4: Run** `npx vitest run tests/unit && npm run typecheck && npx prettier --check AGENTS.md docs/commands.md` — Expected: PASS. Do not run either script against production.
- [ ] **Step 5: Commit** `feat(scripts): functions warm-up and min-instances control`.

## Controller steps (not tasks)

- Spec §6 (the 103 s attachment read): the controller reads production logs (read-only) and either files a finding in the ledger or adds a task if the cause is in our code.
- Rollout and proof after the owner approves each step: `build:prod` → `deploy:functions` (new services only, old ones kept) → `deploy:preview` → re-run Lighthouse and the throttled tour on preview → owner checks → delete the 31 old services → `deploy:promote`.
