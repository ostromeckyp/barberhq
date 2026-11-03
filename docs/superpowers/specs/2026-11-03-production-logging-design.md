# Production logging — design

3 November 2026. Decisions marked "owner" were made by the owner in conversation; "assistant" marks the assistant's calls.

## Why

When a user reports a failure on production and the owner cannot reproduce it locally, the report ends as "not reproduced" and the trail is lost. The trigger: on the iPhone PWA (preview), voice order stayed on "Recognising…" for minutes; no request reached `ai`, so the backend logs were empty, and a refresh made it work again. Logs must show at which step of a user's path the app failed (owner).

## Goals

1. **Find one user's case (owner):** given an account and an approximate time, the owner opens Logs Explorer and sees that user's browser steps and backend operations on one timeline.
2. **Steps, not lines (owner):** each important path logs its milestones, every error with its code, and how long the steps took; enough to say where it stopped.
3. **Replenishment request is the main path (owner):** it gets the densest coverage, end to end:
   - salon: text or dictation → prepare → clarifications → submit (including the offline queue);
   - HQ: queue → approve / reject → dispatch;
   - salon: receive delivery → delivery issue.
4. **Other paths get milestones and errors (assistant):** login and boot (auth, membership, first data), procedures assistant (question, answer, source PDF), HQ knowledge base (upload, processing, product links), HQ products and stock, PWA and push (service worker update, permission, token registration).
5. **Offline is not lost (owner):** events recorded while the salon is offline are kept on the device and sent when the network is back.
6. **Unhandled errors (assistant):** uncaught browser exceptions and unhandled promise rejections, and uncaught Functions exceptions, are always logged.
7. **The dictation hang can't hang forever (assistant):** `stop()` and the whole recognition get time limits that end in the existing error with retry, and a logged event.

## Non-goals

- No alerts, dashboards or notifications; the owner reads logs when a report comes in (owner).
- No support/report code shown in the app; lookup is by account and time (owner).
- No third-party service (Sentry, Datadog…); everything in Cloud Logging / Error Reporting of `notbad-6be95` (assistant).
- No per-line or per-render logging, no performance tracing, no analytics.
- No change to App Check enforcement (stays off until after the demo).

## Anti-goals

- Never log content: no transcript, assistant message, AI answer, audio, product notes, PDF text, passwords, ID tokens, push tokens, config values.
- No personal data beyond the Firebase `uid` (and salon/business ids). No email, no name.
- Logging must never break or slow the app: a failed send is dropped silently after retries; the main thread never waits for it.
- A logging endpoint must not become an open, unbounded write for the internet.

## Decisions

### Shape of a log entry (assistant)

- One structured JSON entry per event in Cloud Logging, with: `source` (`web` | `functions`), `event` (dotted name, e.g. `request.submit.sent`), `outcome` (`ok` | `error`), `code` (error code when any), `durationMs`, `uid`, `role`, `salonId`/`businessId` when known, `sessionId` (random per app load), `build` (version stamp), `channel` (`live` | `preview` | `local`, from the hostname, since preview and live serve the same build) and a small `details` object of allow-listed scalar fields (sizes, counts, mime type, op name).
- Web entries also carry the client timestamp and the user agent; the server keeps its own receive time.
- Severity: `INFO` for steps, `WARNING` for handled errors, `ERROR` for unhandled ones (so Error Reporting groups them).

### Browser (assistant)

- `core/client-log.ts`: the only place that records and sends events. Features call it through their facades; components do not.
- Buffer persisted to `localStorage` so offline events survive a reload (assistant: 500 small events fit easily; IndexedDB is not needed at this size). Cap the stored buffer (500 events; oldest dropped first) and each event's size.
- Send in batches: after a short delay, when the buffer reaches a batch size, on `visibilitychange` to hidden, and on `online`. Use `fetch` with `keepalive` and the user's ID token; do not wait for App Check (the voice hang may be inside it). Events recorded before sign-in are sent after sign-in, or dropped on the logout path.
- Every callable call goes through `core/call-function.ts`; it reports each call (`call.<op>`, outcome, code, duration) to `ClientLog`, so every frontend → backend call is covered with one change (assistant).
- Angular `ErrorHandler` plus `unhandledrejection` feed `client.error` events with the error name, a code if known and a trimmed stack (no message text when it may hold user content).
- `build` comes from a stamp written by `build:prod` (git short SHA and build time).

### Server (assistant)

- New HTTP function `clientLog` (`onRequest`, `europe-west1`, `maxInstances: 2`), not an op of `commands` (assistant): every callable already sets `enforceAppCheck: true`, so a callable would reject logs sent without an App Check token, exactly when App Check may be the part that hangs. `clientLog` accepts only `POST` from the live and preview origins (CORS), verifies the Firebase ID token with the Admin SDK, takes at most 50 events per call, drops unknown fields, trims strings, and writes each event via `firebase-functions/logger` with the server-verified `uid` (never the client's claim).
- The router (`functions/src/routing/router.ts`) logs every `commands` and `ai` operation once: `op`, `uid`, outcome, `HttpsError` code, `durationMs`. That covers all backend ops with one change. Existing AI logs stay; they already avoid content.
- Abuse bound (assistant): only signed-in users with a valid ID token, per-call caps, CORS to our origins and `maxInstances: 2`; no per-user rate limit for now.
- Before sign-in (assistant): failed sign-in attempts are kept on the device and sent with the first successful sign-in; if the user never signs in they are lost. Accepted: login has the fewest moving parts.
- Background work (`processKnowledgeTask`, push after stock commands, `uploadKnowledgePdf`, `getSourcePdf`) logs start/outcome/error code.

### Reading the logs (assistant)

- `docs/commands.md` gets a "Logs" section: the Logs Explorer query for one user (`jsonPayload.uid="<uid>"`, time range), filters for `source="web"`, `channel`, a path (`jsonPayload.event=~"^request\."`), and the `gcloud logging read` equivalent.
- `npm run logs -- --uid <uid> [--since 2h] [--channel live]` prints that user's timeline from the terminal (read-only, uses the owner's gcloud login).
- Retention: Cloud Logging default (30 days) (assistant).

### Event catalogue

- The plan lists the exact events per path. The replenishment request path names every step listed in Goal 3, including dictation (`start`, `stop` with size/mime/duration, `encoded`, `sent`, `result` / error code, `timeout`) and the offline queue (`queued`, `retried`, `sent`, `failed`).

## Constraints

- `AGENTS.md`: TDD, i18n unaffected (logs are not user-visible), 300-line logic files, one model per file, web layering (component → facade → data-access → core).
- Contracts in `shared/contracts` change additively (new op and event types).
- Production writes need the owner's approval per step: `deploy:functions` (new `clientLog` service and router logging) before the new preview (the web sends to `clientLog`; while it does not exist the client drops the batch after retries).

## Left to the builder

- Exact batch size, delays, caps and retry backoff.
- Exact names of events beyond the main path, as long as they follow the dotted pattern and the catalogue in the plan.
- Whether `ai` ops' existing `info` logs are folded into the router log or kept.

## Proof

- Unit (web): events buffered while offline, persisted, sent on `online`; cap drops oldest; no event contains a disallowed field (test the allow-list); `ErrorHandler` and `unhandledrejection` produce `client.error`; dictation `stop()` timeout and recognition timeout end in the error state with retry and a logged event.
- Unit (functions): `clientLog` rejects non-POST, foreign origins, unauthenticated calls and oversized batches, strips unknown fields, writes the verified `uid`; the router logs one entry per op with outcome and code, for success and for `HttpsError`.
- E2E on emulators: a request path run produces the expected ordered events for that user.
- On preview after deploy: run a dictated order on the iPhone, then find the session with `npm run logs -- --uid <uid> --since 15m` and see every step from recording to submit.
