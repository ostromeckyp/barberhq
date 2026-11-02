# Performance fixes — design

2 November 2026. Follows the performance audit of the same day. The owner chose the scope and every decision marked "owner"; the rest are the assistant's calls.

## Why

The audit (Lighthouse on live `/login`, a throttled Playwright tour of every main page on a production-optimised emulator build, and 7 days of production Functions logs) found:

- The Material Symbols icon font is 3.9 MB. On slow 4G it takes ~20 s; every navigation restarts the download, so icon pages wait up to 21 s and live `/login` has LCP 25.5 s. With the font cached, every page is ready in 1–2 s with no long tasks.
- reCAPTCHA Enterprise (App Check) loads ~420 kB on `/login` before anything else needs it.
- `getAuth()` pulls the popup/redirect sign-in iframe and `gapi` (~130 kB); the app signs in with email and password only.
- 35 Functions, each its own Cloud Run service scaled to zero. Median latency is fine, but ~10 % of calls hit a 3–8 s cold start; the AI procedure answer reaches 25 s at p95. On demo day the first click on any action can hang.
- One `getProductCardAttachment` call took 103 s.

## Goal

A first visit on slow 4G shows a usable page with its icons in under 3 s; the demo's user-facing actions answer without a cold start when the owner wants them warm; the owner warms or pins instances with one command.

## Decisions

### 1. Fonts from Google Fonts (owner: all fonts from the CDN)

- Material Symbols Outlined loads from `fonts.googleapis.com/css2` with `icon_names=` listing only the icons the app uses (alphabetical, comma-separated, as the API requires). Archivo (variable weight) and IBM Plex Mono 500 also load from Google Fonts; the `material-symbols`, `@fontsource-variable/archivo` and `@fontsource/ibm-plex-mono` packages are removed.
- `index.html` gets `preconnect` to `fonts.googleapis.com` and `fonts.gstatic.com` (crossorigin) and the stylesheet links with `display=swap` for text fonts and `display=block` for icons (avoids ligature text flashing as words).
- The icon list lives in one place (`web/src/index.html` link). A unit test collects every icon name the app uses — static `<mat-icon>` text, `fontIcon`, `icon="…"` and `icon: '…'` in TypeScript — and fails if any is missing from `icon_names`, or if the list is not sorted.
- Font family names in CSS change to the Google Fonts names (`'Archivo'`; `'IBM Plex Mono'` is unchanged); the boot splash uses the same family. Icons load with the `FILL@0..1` axis (request detail uses `'FILL' 1`); Plex Mono keeps weight 500 only, as today. No CSP exists, so nothing else changes.
- Accepted by the owner: visitors' IP addresses reach Google.

### 2. App Check loads after first render

- `initializeAppCheck` (and with it the reCAPTCHA script) never runs on module load. The Firebase object exposes `appCheck(): Promise<AppCheck | null>`, memoised: the first call initialises App Check. `App` calls it in an idle callback (2 s timeout) after the first navigation ends.
- Every callable and PDF request awaits `firebase.appCheck()` first, so none is sent without a token even if it comes before the idle callback. Emulator mode resolves `null` and skips App Check.
- Data Connect reads do not wait: its App Check enforcement stays off until after the demo. When it is turned on, Data Connect calls must await `firebase.appCheck()` too (noted in `AGENTS.md`).

### 3. Auth without the popup resolver

- `getAuth(app)` becomes `initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence] })` with no `popupRedirectResolver`. Session persistence behaviour stays the same; `iframe.js` and `gapi` are no longer requested.

### 4. Functions merged into two user-facing services (owner: commands + ai)

| Service | Operations (today's export names) |
|---|---|
| `commands` | submitRequest, approveRequest, rejectRequest, dispatchTransfer, receiveTransfer, recordDeliveryReceipt, startDeliveryIssueReview, addDeliveryIssueNote, createDeliveryReplacement, setDeliveryProcedure, getDeliveryProcedures, removeSalonShorthand, getProductAdmin, createProduct, updateProduct, setHqStock, listProductAliases, saveProductAliases, attachProductCard, getProductCardAttachment, createDocumentUpload, reviewAndPublishDocument, retryDocumentProcessing, deleteKnowledgeVersion, saveKnowledgeProductReview, acceptKnowledgeProductReview |
| `ai` | prepareReplenishment, answerProcedureQuestion, suggestKnowledgeProductLink, generateKnowledgeProductAliases, processProductCard |
| unchanged | getSourcePdf, uploadKnowledgePdf (their URLs are in the public config), processKnowledgeTask (Cloud Tasks worker) |

- Each merged service is one `onCall` taking `{ op, input }`. `op` is validated against a closed list; an unknown `op` is `invalid-argument`. Each operation keeps its existing handler unchanged in behaviour: same auth checks, same App Check enforcement, same input validation, same errors. The router passes the handler a request whose `data` is `input`.
- `ai` keeps the longest timeout, memory and secrets any of its operations needs today; `commands` keeps `maxInstances: 5`, `region: europe-west1`.
- The web keeps its data-access APIs; only the callable name changes to `commands` or `ai` with `op` set to the old export name. E2E route mocks that match old function URLs move to the new ones (matching on `op` where they distinguish operations).
- Production rollout: deploy the new services first, check the app on the preview channel, then delete the 31 old functions (the three that survive unchanged are getSourcePdf, uploadKnowledgePdf and processKnowledgeTask). Use `deploy:functions:routers` for the first deploy; plain `deploy:functions` would abort or, with `--force`, delete the old functions before the web is switched. The deletion is a production change and gets its own approval at that step.

### 5. Warm-up and instance control (owner: npm scripts, documented in AGENTS.md; deploy resets to 0)

- `npm run functions:warm` sends one unauthenticated request to each user-facing service (`commands`, `ai`, `getSourcePdf`). The response is an auth error, but the container starts. Prints each service with its response time. Needs no credentials.
- `npm run functions:instances -- <n>` sets `min-instances` on `commands`, `ai` and `getSourcePdf` with `gcloud run services update` (project `notbad-6be95`, region `europe-west1`), then prints the resulting value per service. `0` turns it off. No redeploy; the next Functions deploy resets it to 0 (owner decision, so a forgotten setting never keeps costing).
- Both are documented in `AGENTS.md` (Deployment section) and in `docs/commands.md`.

### 6. The 103 s attachment read

- Investigate from production logs; fix only if the cause is in our code (for example a missing timeout on a Storage or Data Connect call). Otherwise record the finding.

## Out of scope

- Moving Data Connect code out of the initial bundle (~70 kB unused on `/login`).
- Merging `getSourcePdf` / `uploadKnowledgePdf` (needs a public config change).
- Measuring production Data Connect latency (needs a production sign-in).

## Constraints

- Global rules in `AGENTS.md`: TDD, i18n parity, 300-line logic files, one model per file, no production write without the owner's approval for that step.
- No behaviour change beyond what is listed. All existing unit, web and e2e tests keep passing, updated only where function names or font packages changed on purpose.

## Proof

- Unit test: every used icon is in `icon_names`, list sorted.
- Unit tests: router rejects unknown `op`; every listed `op` reaches its handler with `input` as `data`; auth and App Check behaviour unchanged (existing handler tests run through the router).
- Web unit test: no callable or PDF request is sent before `firebase.appCheck()` resolves.
- Re-run of the audit: Lighthouse on the preview channel `/login` and the throttled tour, before/after table. Target: no font over 200 kB, `/login` LCP under 3 s on Lighthouse mobile, no reCAPTCHA or `iframe.js` request before first render.
- After the rollout: `functions:warm` then one call per service under 1 s; `functions:instances -- 1` shows `min-instances: 1` per service.
