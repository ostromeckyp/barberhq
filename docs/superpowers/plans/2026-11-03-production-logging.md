# Production Logging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the owner one per-user timeline in Cloud Logging (browser steps + backend operations) to locate where a production failure happened, and stop dictation from hanging forever.

**Architecture:** A shared event contract with an allow-list sanitizer is used by both sides. The browser records events in `core/client-log.ts`, buffers them in `localStorage`, and posts batches to a new HTTP function `clientLog` (ID token, no App Check). The function re-sanitizes and writes them with `firebase-functions/logger`. On the backend, `createRouter` logs every `commands`/`ai` op once. On the web, `callFunction` reports every callable call. Features add only the steps a call cannot show.

**Tech Stack:** Angular 22 (signals, zoneless, Vitest via `ng test`), Firebase Functions v2 (`onRequest`, `firebase-functions/logger`, Admin Auth), Vitest unit tests in `tests/unit`, Playwright e2e on emulators, `gcloud logging read`.

**Spec:** `docs/superpowers/specs/2026-11-03-production-logging-design.md`

## Global Constraints

- Never log content: no transcript, assistant message, AI answer, audio, product notes, PDF text, passwords, ID tokens, push tokens, config values. No email, no name. Identity = verified `uid` (+ `role`, `businessId`, `salonId`).
- Event entry fields only: `source` (`web` | `functions`), `event` (dotted, `^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+){1,4}$`), `outcome` (`ok` | `error`), `code?`, `durationMs?`, `uid`, `role?`, `businessId?`, `salonId?`, `sessionId`, `build`, `channel` (`live` | `preview` | `local`), `details?` (allow-listed scalars). Web adds `clientTime`, `userAgent`.
- Severity: `INFO` steps, `WARNING` handled errors, `ERROR` unhandled.
- Logging never breaks or slows the app: every log call is fire-and-forget and swallows its own errors.
- `clientLog`: `POST` only, origins from `CLOUD.allowedOrigins` (+ `http://localhost:4200`, `http://127.0.0.1:4200` in the emulator), verified ID token, ≤ 50 events per call, `region: 'europe-west1'`, `maxInstances: 2`.
- Browser buffer: `localStorage` key `barberhq.clientLog.v1`, ≤ 500 events, oldest dropped first.
- Dictation limits: `stop()` 5 000 ms, whole recognition 40 000 ms.
- `AGENTS.md`: TDD (failing test first), one exported model per file, logic files ≤ 300 lines, web layering (component → facade → data-access → core), contracts change additively, never commit `scripts/generated/browser/index.d.ts` or `web/src/app/core/generated/index.d.ts`.
- Production writes (`deploy:functions`, `build:prod` + `deploy:preview`, `deploy:promote`) only with the owner's explicit approval for that step.

## Review Focus

1. **Content leaking through `details` or error stacks.** Someone passes a whole object or an `Error` whose message holds user text, and it should be dropped, not logged. Task 1 sanitizer tests pin it, and Task 5 `ErrorHandler` tests pin name + trimmed stack only.
2. **A send loop while offline or signed out.** No network or no user must mean no repeated fetches and no growing memory. Events stay stored (≤ 500) until `online` or sign-in. Pinned in Task 4.
3. **Spoofed identity.** A client-supplied `uid`/`role` in the body must be ignored, and the server writes the token's `uid`. Pinned in Task 2.
4. **Two tabs or a reload mid-send.** Events must not be duplicated endlessly and must not be lost if the send fails. Remove from storage only after a 2xx. Pinned in Task 4.
5. **Dictation timeout racing a late result.** A transcription that resolves after the 40 s timeout must not overwrite the error state or append text. Pinned in Task 6.

---

### Task 1: Shared event contract and sanitizer

**Files:**
- Create: `shared/contracts/logging/client-log-event.ts` (type `ClientLogEvent`)
- Create: `shared/contracts/logging/log-channel.ts` (type `LogChannel = 'live' | 'preview' | 'local'`)
- Create: `shared/contracts/logging/sanitize-log-event.ts` (`sanitizeLogEvent`, `MAX_LOG_BATCH = 50`)
- Create: `shared/contracts/logging/index.ts`
- Test: `tests/unit/log-event-sanitizer.test.ts`

**Interfaces:**
- Produces: `ClientLogEvent = { event: string; outcome: 'ok' | 'error'; code?: string; durationMs?: number; sessionId: string; build: string; channel: LogChannel; clientTime: string; role?: 'HQ' | 'SALON'; businessId?: string; salonId?: string; details?: Record<string, string | number | boolean> }`
- Produces: `sanitizeLogEvent(raw: unknown): ClientLogEvent | null`. Returns `null` for a bad `event`/`outcome`/`sessionId`. Drops unknown top-level keys. Keeps `details` only for keys matching `^[a-zA-Z][a-zA-Z0-9]{0,31}$`, at most 12 keys, scalar values only, strings trimmed to 120 chars. `code` matches `^[A-Za-z0-9_./-]{1,64}$`, otherwise dropped. `durationMs` must be a finite number in 0…3 600 000, otherwise dropped.

- [ ] **Step 1: Write failing tests.** In `log-event-sanitizer.test.ts`:
  - a valid event round-trips unchanged;
  - `{ ...valid, uid: 'x', email: 'a@b' }` → result has no `uid`/`email`;
  - `event: 'Bad Name'` → `null`;
  - `details: { text: 'x'.repeat(500) }` → `details.text.length === 120`;
  - `details: { nested: { a: 1 } }` → `details` without `nested`;
  - 13 detail keys → 12 kept;
  - `durationMs: -1` → dropped;
  - `code: 'has space'` → dropped.
- [ ] **Step 2: Run** `npx vitest run --project unit tests/unit/log-event-sanitizer.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement** the files above. Export from `index.ts`.
- [ ] **Step 4: Run** the same command. Expected: PASS. Then `npm run test:unit -- code-structure`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(contracts): client log event and sanitizer`.

### Task 2: `clientLog` HTTP function

**Files:**
- Create: `functions/src/logging/client-log.ts`: `createClientLogHandler(deps)` and `clientLogFunction()`
- Create: `functions/src/logging/models/client-log-deps.ts`
- Modify: `functions/src/index.ts`: `export const clientLog = clientLogFunction();`
- Test: `tests/unit/client-log-function.test.ts`

**Interfaces:**
- Consumes: `sanitizeLogEvent`, `MAX_LOG_BATCH` (Task 1).
- Produces: `ClientLogDeps = { origins: string[]; verifyAuth(token: string): Promise<string | null>; write(severity: 'INFO' | 'WARNING' | 'ERROR', entry: Record<string, unknown>): void }`
- Produces: `createClientLogHandler(deps)(request, response)`, with the same request/response shape as `createSourceHandler` in `functions/src/knowledge/source.ts`. Follow its origin/CORS handling. Body `{ events: unknown[] }`. Each sanitized event is written with `source: 'web'`, the verified `uid`, the request `user-agent` as `userAgent`, and severity `ERROR` when `event` starts with `client.error`, `WARNING` when `outcome === 'error'`, else `INFO`.
- Responses: `OPTIONS` from an allowed origin → 204. Foreign origin → 403. Non-POST → 405. Missing or invalid token → 401. More than 50 events or a non-array → 400. Otherwise 204 with nothing returned.
- `clientLogFunction()`: `onRequest({ region: 'europe-west1', maxInstances: 2, memory: '256MiB' }, …)`. Origins are `CLOUD.allowedOrigins` plus the emulator localhost origins. `verifyAuth` is `getAuth().verifyIdToken(token)` (no revocation check, to keep it cheap). `write` uses `logger.write({ severity, ...entry })`.

- [ ] **Step 1: Write failing tests** with fake deps, one test for each response above, plus:
  - body `events: [{ ...valid, uid: 'spoof' }]` with token for `u1` → `write` called with `uid: 'u1'`;
  - one invalid event among two valid ones → `write` called twice;
  - `client.error.unhandled` → `ERROR`.
- [ ] **Step 2: Run** `npx vitest run --project unit tests/unit/client-log-function.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** it again. Expected: PASS. Then `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(functions): clientLog endpoint for browser events`.

### Task 3: Backend operation and background logs

**Files:**
- Modify: `functions/src/routing/router.ts`
- Modify: `functions/src/routing/commands.ts`, `functions/src/routing/ai.ts` (pass service name)
- Modify: `functions/src/knowledge/worker.ts`, `functions/src/knowledge/upload.ts`, `functions/src/knowledge/source.ts`, `functions/src/push/after-stock-command.ts`
- Test: `tests/unit/function-router.test.ts` (extend), plus the existing tests of the touched background modules

**Interfaces:**
- Produces: `createRouter(ops, options?: { service: 'commands' | 'ai'; log?: (severity, entry) => void })`. The default `log` is `firebase-functions/logger` `write`. After each op it writes one entry: `{ source: 'functions', event: '<service>.<op>', outcome, code?, durationMs, uid? }`.
  - `code` is the `HttpsError.code`, plus `details.reason` = its message when that is an UPPER_SNAKE code (e.g. `RATE_LIMITED`).
  - A non-`HttpsError` throw logs `ERROR` with `code: 'internal'` and rethrows unchanged.
  - Rejected routing (unknown op) logs `event: '<service>.invalid'`.
- Background modules each log `<area>.<step>` with outcome and code, never payload. Names:
  - `knowledge.task.started` / `knowledge.task.finished` (`details.kind`, `details.versionId`);
  - `knowledge.upload.finished`;
  - `knowledge.source.served` (status code only);
  - `push.notify.finished` (`details.sent`, `details.failed`).

- [ ] **Step 1: Write failing router tests** with an injected `log`:
  - success → one `INFO` entry with `event: 'commands.a'`, `outcome: 'ok'`, numeric `durationMs`, `uid: 'u'`;
  - `HttpsError('resource-exhausted', 'RATE_LIMITED')` → `WARNING`, `code: 'resource-exhausted'`, `details.reason: 'RATE_LIMITED'`, error rethrown;
  - plain `Error` → `ERROR`, `code: 'internal'`, same error rethrown;
  - the entry never contains `data`/`input`.
- [ ] **Step 2: Run** `npx vitest run --project unit tests/unit/function-router.test.ts`. Expected: new tests FAIL.
- [ ] **Step 3: Implement** the router change and pass `{ service }` from `commands.ts`/`ai.ts`.
- [ ] **Step 4: Add the background log lines** with one assertion per module in its existing test file. Write the test first, watch it fail, then add the line.
- [ ] **Step 5: Run** `npm run test:unit`. Expected: PASS.
- [ ] **Step 6: Commit** `feat(functions): log every routed op and background step`.

### Task 4: Build stamp and browser `ClientLog`

**Files:**
- Modify: `scripts/config/build-web.ts` (`renderPublicConfig` gains `build: string`, written into `runtimeConfig.build`); emulator and dev builds use `'local'`
- Modify: `web/src/app/core/public-config.ts` (type of `runtimeConfig` gets `build: string`), and regenerate the dev/emulator generated configs via their existing scripts
- Create: `web/src/app/core/client-log.ts` (`ClientLog`)
- Create: `web/src/app/core/log-channel.ts` (`channelFor(hostname: string): LogChannel`)
- Test: `tests/unit/public-config.test.ts` (extend), `web/src/app/core/client-log.spec.ts`, `web/src/app/core/log-channel.spec.ts`

**Interfaces:**
- Consumes: `ClientLogEvent`, `sanitizeLogEvent`, `MAX_LOG_BATCH` (Task 1). The endpoint is `https://<functionsRegion>-<projectId>.cloudfunctions.net/clientLog`, or `http://127.0.0.1:5001/<projectId>/<functionsRegion>/clientLog` with emulators.
- Produces: `channelFor`. Hostnames containing `--` are `preview`, `localhost`/`127.0.0.1` are `local`, anything else is `live`.
- Produces: `@Service() class ClientLog`:
  - `record(event: string, outcome?: 'ok' | 'error', extra?: { code?: string; durationMs?: number; details?: Record<string, string | number | boolean> }): void`
  - `step<T>(event: string, run: () => Promise<T>, details?): Promise<T>`: records `ok` with `durationMs`, or `error` with the error's `code` when it has a string `code`, then rethrows
  - `setContext(ctx: { role?: 'HQ' | 'SALON'; businessId?: string; salonId?: string }): void`
  - `flush(): Promise<void>`
- Injection tokens for testability: `CLIENT_LOG_STORAGE` (default `localStorage`, falls back to memory when it throws), `CLIENT_LOG_FETCH` (default `fetch`).
- Behaviour:
  - `sessionId` is a `crypto.randomUUID()` per load.
  - Every event goes through `sanitizeLogEvent` before storing.
  - The store is capped at 500.
  - A flush is scheduled 5 s after the first new event, or right away at 20 events, on `visibilitychange` → hidden, and on `online`.
  - Flush sends ≤ 50 events with `keepalive: true` and `Authorization: Bearer <auth.currentUser.getIdToken()>`. It removes the sent events from storage only on a 2xx.
  - When there is no user or `navigator.onLine === false`, it does not send and keeps the events.
  - After a failed send, the next attempt waits 30 s, then 60 s, up to 5 min. Only one flush runs at a time.

- [ ] **Step 1: Write failing tests.**
  - `public-config.test.ts`: the rendered source contains `"build":"abc1234"` when given `abc1234`.
  - `log-channel.spec.ts`: `notbad-6be95--foundation-unesffgt.web.app` → `preview`, `notbad-6be95.web.app` → `live`, `localhost` → `local`.
  - `client-log.spec.ts`, with a fake storage, fetch and auth plus fake timers:
    - an event is stored and sent after 5 s with a bearer token;
    - offline → no fetch, and the event is still stored after `online` fires… then sent;
    - no user → no fetch;
    - a 500 response keeps the events and the retry waits 30 s;
    - 501 records → the store holds 500, and the first one is gone;
    - a `details` value that is an object is not stored;
    - `step` records an `error` with `code` from a thrown `{ code: 'X' }` and rethrows.
- [ ] **Step 2: Run** `npx vitest run --project unit tests/unit/public-config.test.ts` and `npm run test:web -- --include src/app/core/client-log.spec.ts src/app/core/log-channel.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the build stamp. The main path of `build-web.ts` passes `git rev-parse --short HEAD`, or `'unknown'` when git fails.
- [ ] **Step 4: Implement** `channelFor` and `ClientLog`.
- [ ] **Step 5: Run** both test commands, then `npm run typecheck`. Expected: PASS.
- [ ] **Step 6: Commit** `feat(web): client log buffer with offline storage and build stamp`.

### Task 5: Global errors, callable calls and session context

**Files:**
- Create: `web/src/app/core/logging-error-handler.ts` (`LoggingErrorHandler extends ErrorHandler`)
- Modify: `web/src/app/app.config.ts` (provide `{ provide: ErrorHandler, useClass: LoggingErrorHandler }`; start `ClientLog` eagerly with `provideAppInitializer`)
- Modify: `web/src/app/core/call-function.ts`: add `setCallObserver(observer: ((op: string, outcome: 'ok' | 'error', durationMs: number, code?: string) => void) | null): void`, and report every call
- Modify: `web/src/app/features/auth/feature/session.facade.ts`: call `ClientLog.setContext` on `READY` and record the session states listed below
- Test: `web/src/app/core/logging-error-handler.spec.ts`, `web/src/app/core/call-function.spec.ts` (extend), `web/src/app/features/auth/feature/session.facade.spec.ts` (extend)

**Interfaces:**
- Consumes: `ClientLog` (Task 4).
- `LoggingErrorHandler.handleError(error)` calls `super.handleError` and records `client.error.unhandled`:
  - `outcome: 'error'`;
  - `code` = the error's `code`, else `error.name`;
  - `details.stack` = first 3 stack frames without the message line.
- `unhandledrejection` is handled by `provideBrowserGlobalErrorListeners` → `ErrorHandler`. Verify this in the test; do not add a second listener.
- `ClientLog` constructor calls `setCallObserver` → `record('call.' + op, outcome, { code, durationMs })`. `code` is the Firebase `functions/<code>` code, plus the controlled `AssistantApiError` code when present.
- Session events, all with `ok` unless noted:
  - `session.signedIn`;
  - `session.ready` (`details.role`);
  - `session.noAccess` (`error`);
  - `session.error` (`error`);
  - `session.signedOut`;
  - `session.signIn.failed` (`error`, `code` = Firebase auth code).

- [ ] **Step 1: Write failing tests.**
  - The handler records `client.error.unhandled`, and its `details` contain no message text: throw `new Error('secret text')` and assert that `'secret text'` appears nowhere in the recorded event.
  - The call observer gets `('prepareReplenishment', 'error', n, 'functions/resource-exhausted')`.
  - Session `READY` sets the context with role, businessId and salonId.
- [ ] **Step 2: Run** `npm run test:web -- --include src/app/core src/app/features/auth`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(web): log unhandled errors, callable calls and session state`.

### Task 6: Dictation time limits and steps

**Files:**
- Modify: `web/src/app/features/replenishment/feature/dictation.facade.ts`
- Test: `web/src/app/features/replenishment/feature/dictation.facade.spec.ts` (extend)

**Interfaces:**
- Consumes: `ClientLog` (Task 4).
- Produces: `export const STOP_TIMEOUT_MS = 5_000; export const RECOGNITION_TIMEOUT_MS = 40_000;`
- When `recorder.stop()` has not settled within `STOP_TIMEOUT_MS`, the facade ends in `error` with `replenishment.dictation.failed` and no retry (`last = null`). When the transcription has not settled within `RECOGNITION_TIMEOUT_MS`, it ends in `error` with the same key and keeps `last` for retry. A result arriving after a timeout is ignored. Use an attempt counter and compare it before applying a result.
- Events:
  - `dictation.start` (`ok`/`error`, `code: 'blocked'` for a blocked mic);
  - `dictation.stop` (`details: { bytes, mimeType, durationMs }`);
  - `dictation.stop.timeout` (`error`);
  - `dictation.encoded` (`details.bytes`);
  - `dictation.result` (`ok` with `details.chars`, or `error` with the API code);
  - `dictation.timeout` (`error`);
  - `dictation.retry`.

  Never the text.

- [ ] **Step 1: Write failing tests** with fake timers:
  - `stop` never resolving → after 5 s `state() === 'error'` and `canRetry() === false`, and `dictation.stop.timeout` is recorded;
  - `transcribe` never resolving → after 40 s `error` and `canRetry() === true`;
  - a transcription resolving at 41 s → the message stays unchanged and the state stays `error`;
  - a successful run records `dictation.stop`, `dictation.encoded` and `dictation.result` in that order, and no recorded value contains the transcript text.
- [ ] **Step 2: Run** `npm run test:web -- --include src/app/features/replenishment/feature/dictation.facade.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `fix(web): time limits for dictation and step logs`.

### Task 7: Replenishment request path events

**Files:**
- Modify: `web/src/app/features/replenishment/feature/replenishment-assistant.facade.ts`, `submission.service.ts`, `order.facade.ts`
- Modify: `web/src/app/features/hq-queue/feature/hq-queue.facade.ts`, `web/src/app/features/request-detail/feature/request-action.facade.ts`, `request-detail.facade.ts`
- Modify: `web/src/app/features/delivery/feature/delivery-receipt.facade.ts`, `delivery-issue.facade.ts`, `delivery-issues.facade.ts`
- Modify: `web/src/app/features/salon-requests/feature/salon-requests.facade.ts`
- Test: the matching `*.spec.ts` of each modified facade (extend)

**Interfaces:**
- Consumes: `ClientLog` (Task 4). Callables are already covered as `call.<op>` (Task 5). Add only these:
  - `request.prepare.result`: `details: { ready, clarifications, aiMatched }` (counts).
  - `request.clarification.chosen`: `details.kind` = `CHOOSE_PRODUCT` | `ENTER_QUANTITY`.
  - `request.aiMatch.changed`.
  - `request.submit.queued`, `request.submit.resumed`, `request.submit.blocked` (`code` = `PendingState.reason`), `request.submit.outcome` (`code` = outcome kind).
  - `request.list.load` and `request.detail.load`: outcome only, recorded on Data Connect read failure or success.
  - `hq.queue.load`.
  - `delivery.receipt.load`.
  - `delivery.issues.load`.
  - `delivery.issue.load`.
- No product names, notes or quantities beyond counts.

- [ ] **Step 1: Write failing tests**, one per event, asserting the event name, outcome and `details` keys. In each spec, also assert that `details` contains no `productName` or `note` key.
- [ ] **Step 2: Run** `npm run test:web -- --include src/app/features/replenishment src/app/features/hq-queue src/app/features/request-detail src/app/features/delivery src/app/features/salon-requests`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(web): replenishment request path events`.

### Task 8: Milestones on other paths

**Files:**
- Modify: `web/src/app/features/procedures/assistant.facade.ts`, `procedures/pdf-viewer/pdf-viewer.facade.ts`, `procedures/library/document-upload.facade.ts`, `procedures/library/document-library.facade.ts`
- Modify: `web/src/app/features/salon-settings/feature/push.facade.ts`, `web/src/app/core/app-update.ts`, `web/src/app/features/hq-stock/feature/hq-stock.facade.ts`, `web/src/app/features/hq-products/feature/product-editor.facade.ts`
- Test: matching specs (extend)

**Interfaces:**
- Events:
  - `procedure.answer.result` (`details.sources` count);
  - `pdf.open` (outcome, `code` = HTTP status);
  - `knowledge.upload` (outcome, `details.bytes`);
  - `knowledge.library.load`;
  - `push.permission` (`code` = `granted` | `denied` | `default`);
  - `push.register` (outcome);
  - `app.update.available`;
  - `app.update.applied`;
  - `hq.stock.load`;
  - `hq.product.load`.
- Uploads and PDF fetches that are not callables use `ClientLog.step`.

- [ ] **Step 1: Write failing tests**, one per event.
- [ ] **Step 2: Run** `npm run test:web`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm run test:web`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(web): milestone events for procedures, knowledge, push and HQ`.

### Task 9: Reading the logs

**Files:**
- Create: `scripts/dev/logs.ts` (`buildLogFilter(opts: { uid: string; since: string; channel?: LogChannel; source?: 'web' | 'functions' }): string`, `formatEntry(entry: unknown): string`)
- Modify: `package.json`: `"logs": "node --import tsx scripts/dev/logs.ts"`
- Modify: `docs/commands.md` (new "Logs" section), `AGENTS.md` (one line under Deployment: logs are read with `npm run logs`; no content in log events)
- Test: `tests/unit/logs-script.test.ts`

**Interfaces:**
- `buildLogFilter({ uid: 'u1', since: '2h' })` returns a filter on `jsonPayload.uid="u1"` and `timestamp>="<now-2h ISO>"`, plus `jsonPayload.channel` / `jsonPayload.source` when given. The timestamp comes from an injected clock.
- `formatEntry` prints one line: `HH:MM:SS.mmm source channel event outcome code durationMs details-json`.
- The CLI runs `gcloud logging read <filter> --project notbad-6be95 --order asc --format json --limit 500` and prints formatted lines. It is read-only. Flags: `--uid` (required), `--since` (default `1h`), `--channel`, `--source`.
- `docs/commands.md` "Logs": the Logs Explorer query for one user, filters by path (`jsonPayload.event=~"^request\."`), the `npm run logs` usage, and the note that preview and live share the backend, so filter by `channel`.

- [ ] **Step 1: Write failing tests** for `buildLogFilter` (with and without channel/source, injected clock) and for `formatEntry` (a full entry, and an entry with no `details`).
- [ ] **Step 2: Run** `npx vitest run --project unit tests/unit/logs-script.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement**, then write the docs.
- [ ] **Step 4: Run** it again. Expected: PASS. Then `npm run format:check`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(scripts): npm run logs and logging docs`.

### Task 10: E2E proof on emulators

**Files:**
- Create: `tests/e2e/client-log.spec.ts`

**Interfaces:**
- Consumes everything above. Use Playwright `page.route('**/clientLog', …)` to capture the posted batches; the real function is also hit in a second test.
- Test 1: salon runs a typed order → prepare → submit. The captured events contain, in order:
  - `session.ready`;
  - `call.prepareReplenishment`;
  - `request.prepare.result`;
  - `call.submitRequest`;
  - `request.submit.outcome`.

  Every event has `sessionId`, `build: 'local'` and `channel: 'local'`. No body contains the typed message text.
- Test 2: without route interception, after the same flow and `page.evaluate` of a hidden visibility event, the `clientLog` emulator responds 204. Assert the response status via `page.waitForResponse`.

- [ ] **Step 1: Write the spec.**
- [ ] **Step 2: Run** with emulators (`npm run dev:emulators`, `npm run dev:seed`, `npm run dev:web`): `BARBERHQ_TEST_MODE=emulator npx playwright test tests/e2e/client-log.spec.ts`. Expected: PASS. If it fails, fix the code from the owning task, not the assertion.
- [ ] **Step 3: Run** `BARBERHQ_TEST_MODE=emulator npx playwright test tests/e2e/replenishment.spec.ts tests/e2e/voice-order.spec.ts`. Expected: PASS (no regression).
- [ ] **Step 4:** Stop the emulators (`npm run dev:stop`) and the dev server. Revert the generated `index.d.ts` files with `git checkout --`.
- [ ] **Step 5: Commit** `test(e2e): client log events for the request path`.

### Task 11: Release (each step needs the owner's approval)

- [ ] **Step 1:** Run `npm run typecheck && npm run format:check && npm run test:unit && npm run test:web`. Expected: all PASS.
- [ ] **Step 2:** Ask the owner, then run `npm run deploy:functions`. Expected: a new `clientlog` service, and `commands`/`ai` updated.
- [ ] **Step 3:** Check that `curl -i -X OPTIONS -H 'Origin: https://notbad-6be95.web.app' https://europe-west1-notbad-6be95.cloudfunctions.net/clientLog` returns 204.
- [ ] **Step 4:** Ask the owner, then the owner runs `npm run build:prod` (it reads the local config) and `npm run deploy:preview`.
- [ ] **Step 5:** The owner runs a dictated order on the iPhone preview. Run `npm run logs -- --uid <owner uid> --since 15m --channel preview`. Expected: the steps from `dictation.start` to `request.submit.outcome`, with `functions` entries for `ai.transcribeOrder`, `ai.prepareReplenishment` and `commands.submitRequest` interleaved.
- [ ] **Step 6:** Promote only after the owner says so: `npm run deploy:promote`.
