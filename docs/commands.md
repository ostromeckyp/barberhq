# Command guide

How to run BarberHQ locally, test it, and publish each part to production (`notbad-6be95`). Run every command from the repository root unless noted.

## One-time setup

| What | Command / note |
|---|---|
| Node | 22.22.3 (`.node-version`), npm 10 |
| Java | 21+, needed by the Firebase emulators |
| Dependencies | `npm ci && npm --prefix web ci && npm --prefix functions ci` |
| Browser for e2e | `npx playwright install chromium` |
| Firebase CLI login (prod only) | `npx firebase login` |
| Google credentials (prod scripts, local embeddings) | `gcloud auth application-default login` |
| Production web config | `config/public.local.json`, copied from `config/public.example.json`. Never commit it. |

Firebase CLI is pinned in `package.json`; `npx firebase` and the npm scripts use that version.

## Run locally

Three terminals:

```sh
# 1. Emulators: Auth 9099, SQL Connect 9399, Functions 5001, Storage 9199, UI http://127.0.0.1:4000
npm run dev:configure          # once, or after config changes
npm run dev:emulators

# 2. Demo data and accounts (first start, or after deleting .emulator-data/)
npm run dev:seed

# 3. Web app on http://127.0.0.1:4200
npm run dev:web
```

- Demo accounts and their generated passwords are in `config/demo-accounts.local.json`.
- Data survives restarts in `.emulator-data/`. Stop with Ctrl+C or `npm run dev:stop`; both export. Delete `.emulator-data/` for a clean start.
- `npm run dev:emulators:all` also serves the built app through the Hosting emulator on port 5002.

### Reset the local demo

Wipes requests, stock movements and all documents, then rebuilds products, stock, procedures and product cards from `data/`. It calls the real Vertex embedding model, so Google credentials are required.

```sh
npm run dev:reset -- --dry-run   # what would change
npm run dev:reset -- --apply
```

## Test

```sh
npm run typecheck
npm run test:unit
npm run test:web                                  # Angular unit tests
BARBERHQ_TEST_MODE=emulator npm run test:integration
BARBERHQ_TEST_MODE=emulator npm run test:e2e      # starts or reuses emulators and the dev server
npm run format:check
```

Integration tests need emulators; the isolated stack used for SQL-heavy suites is described in [full demo reset](implementation/full-demo-reset.md#verification-local-isolated).

E2E against preview or live: App Check is enforced, and headless Chromium may not get a reCAPTCHA token. Register a debug token (Firebase console → App Check → Apps → web app → Manage debug tokens) and put it in the git-ignored `.env.e2e` at the repo root; `playwright.config.ts` loads it unless `BARBERHQ_TEST_MODE=emulator`, and shell variables win:

```sh
BARBERHQ_BASE_URL=https://notbad-6be95--foundation-<id>.web.app
BARBERHQ_APPCHECK_DEBUG_TOKEN=<debug token>
```

Every browser context then starts with that token (`tests/e2e/test.ts`; specs import `test` from there). The token bypasses App Check for whoever holds it: never commit it, and revoke it in the console when you no longer need it.

After changing any `.gql` file or the schema, regenerate the SDKs and commit them:

```sh
npm run generate:sdk -- --project demo-barberhq
```

## Publish to production

Preview (`foundation` channel) and live share one backend: connectors, Functions and data are live as soon as they are deployed. Only the web app has a preview step. Deploy in this order, each step only when its part changed:

### 1. Database schema and connectors

```sh
npm run deploy:db:diff   # stages artifacts/cloud-knowledge and compares with the prod database
npm run deploy:db        # schema + server, vector and browser connectors
```

If the diff reports the database as incompatible, review the SQL it prints, then migrate from the staged folder before `deploy:db`:

```sh
cd artifacts/cloud-knowledge
../../node_modules/.bin/firebase dataconnect:sql:migrate --project notbad-6be95 --config firebase.json
```

Never use `--force` to skip a destructive migration warning.

### 2. Functions

```sh
npm run deploy:functions
```

**Release that merged the 31 callables into `commands` and `ai` (one-time rollout).** Production still runs the 31 old functions and the live web calls them. Plain `deploy:functions` finds them missing from source: non-interactive it aborts, interactive it prompts (default No keeps them), and with `--force` it deletes all 31 at once and breaks the live web. Never use `--force` on the first deploy after this change. Order:

1. `npm run deploy:functions:routers` deploys only `commands` and `ai`, alongside the old functions.
2. Build and deploy the web to the preview channel (step 3), sign in and check it.
3. `npm run deploy:promote` to put that web version live.
4. Only then delete the 31 old functions (production change, needs the owner's approval):

```sh
firebase functions:delete submitRequest approveRequest rejectRequest dispatchTransfer receiveTransfer recordDeliveryReceipt startDeliveryIssueReview addDeliveryIssueNote createDeliveryReplacement setDeliveryProcedure getDeliveryProcedures removeSalonShorthand getProductAdmin createProduct updateProduct setHqStock listProductAliases saveProductAliases attachProductCard getProductCardAttachment createDocumentUpload reviewAndPublishDocument retryDocumentProcessing deleteKnowledgeVersion saveKnowledgeProductReview acceptKnowledgeProductReview prepareReplenishment answerProcedureQuestion suggestKnowledgeProductLink generateKnowledgeProductAliases processProductCard --region europe-west1 --project notbad-6be95
```

5. From now on the normal `npm run deploy:functions` is safe again.

`getSourcePdf`, `uploadKnowledgePdf` and `processKnowledgeTask` are unchanged and stay.

Public settings (SQL service, bucket, Vertex model, allowed origins) live in `functions/config/cloud.json`. The deploy asks no questions. Functions hold no secrets; a future secret belongs in Secret Manager (`defineSecret`), never in the repo.

### 3. Web app

```sh
npm run build:cloud-sdk    # browser SDK for the prod service
npm run build:prod         # validated public config + Angular production build
npm run deploy:preview     # https://notbad-6be95--foundation-unesffgt.web.app, expires in 7 days
npm run check:hosting -- --base-url https://notbad-6be95--foundation-unesffgt.web.app
```

Sign in on the preview and check the change. Then publish exactly that version to live:

```sh
npm run deploy:promote     # https://notbad-6be95.web.app
```

Full release verification (bundle hashes, headers, backend revisions) is in [release verification](implementation/release-verification.md).

Deploy note: the user-facing functions are two Cloud Run services, `commands` and `ai`. Each has `maxInstances: 5` shared by all its operations; before the merge several knowledge and product callables were uncapped, so heavy parallel use now queues behind that cap.

### 4. Demo data reset (optional)

Same as the local reset, against production. It deletes everything salons and HQ did since the last reset, including uploaded documents.

```sh
npm run reset:prod -- --dry-run
npm run reset:prod -- --apply
```

## Voice order (dictation) and AI matching

Staff tap the microphone in the salon assistant, speak an order, and the text lands in the input for review before **Prepare proposal**. The `ai` operation `transcribeOrder` sends the recording to Gemini once and returns cleaned text; audio is never stored or logged, only size, language and duration. `prepareReplenishment` then runs a second Gemini turn (`matchProducts`) over the unresolved wordings: confident picks become draft lines labelled "Matched by AI" with a Change action, unsure ones become clarifications with suggested candidates. Each transcription counts once and each prepare counts once against the shared limit of 20 AI calls per user per hour; the matching turn runs inside prepare and does not count separately, so a voice order is 2 calls. The mic is hidden unless `replenishmentAiEnabled` is true and the browser supports `MediaRecorder`.

Owner steps for production, in this order (each is a production write and needs the owner's approval):

1. `npm run deploy:functions` first. The old `admission.ts` rejects counts above 10 as `INVALID_CONFIG`, so the database limit must not be raised before the new Functions are live.
2. `npm run deploy:db:diff`, then `npm run deploy:db` (hourly limit 20 in `admission.gql`).
3. Seed the new phonetic aliases (dry run first, then apply; the config file is passed as an argument only):

```sh
node --import tsx scripts/seed/product-aliases.ts --project notbad-6be95 --business not-bad-stuff-demo --config config/public.local.json --dry-run
node --import tsx scripts/seed/product-aliases.ts --project notbad-6be95 --business not-bad-stuff-demo --config config/public.local.json --apply
```

The seed needs Application Default Credentials for the cloud project and refuses to run when `DATA_CONNECT_EMULATOR_HOST` is set.

4. `npm run build:prod`, then `npm run deploy:preview`.
5. Test on an iPhone (Safari and the installed PWA) on the `foundation` channel: allow the microphone, dictate, prepare, change an AI match.
6. `npm run deploy:promote` only after the owner's OK.

Rollback: rolling Functions back while this web build is live breaks prepare (the old schema rejects `language`), so roll back web (re-promote the previous Hosting release) together with Functions.

Evaluating dictation quality (read-only Vertex calls with your `gcloud` application-default credentials, no data is written): put the recordings (`*.m4a`, `*.webm`) and a `keyboard.txt` with one typed line per recording, in file name order, in a folder, then run:

```sh
node --import tsx scripts/dev/evaluate-dictation.ts --dir <folder> --out <report.md> --transcribe-only [--language pl|en]
```

The Markdown report lists each recording with its keyboard text and cleaned transcript.

## Demo day

Cold starts make the first call to each function slow. Warm them shortly before going on stage:

```sh
npm run functions:warm     # no credentials; prints "name status ms" for commands, ai, getSourcePdf
```

To keep instances alive during the demo, set a minimum (0 to 3) on `commands`, `ai` and `getsourcepdf`. This needs `gcloud` logged in with access to `notbad-6be95` and the owner's approval like any production change. It costs money while above 0.

```sh
npm run functions:instances -- 1   # keep one instance of each service warm
npm run functions:instances -- 0   # back to scale-to-zero after the demo
```

The script runs `gcloud run services update <service> --min-instances <n>` and then prints each service's `minScale`. The next `npm run deploy:functions` (or `deploy:functions:routers`) resets the minimum to 0, so run it again after any Functions deploy.

## Logs

The browser and the backend log to Cloud Logging in `notbad-6be95`. Every entry has `uid`, `event` (dotted, e.g. `dictation.stop`, `call.submitRequest`, `commands.submitRequest`), `outcome` (`ok`/`error`), an error `code` and `durationMs`. Browser entries also have `source: "web"`, `sessionId`, `build` (the commit of `build:prod`) and `channel` (`live`, `preview` or `local`). Preview and live share the backend, so filter by `channel`. No entry holds user content: no transcript, message, answer, audio, note, email or token. Retention is the Cloud Logging default (30 days).

To find one user's case, take the uid (Firebase console → Authentication) and the approximate time:

```sh
npm run logs -- --uid <uid> --since 2h                 # browser + backend, oldest first, times in UTC
npm run logs -- --uid <uid> --since 30m --channel preview
npm run logs -- --uid <uid> --since 1d --source web
```

It only reads (`gcloud logging read`, with your gcloud login). In Logs Explorer, the same query is `jsonPayload.uid="<uid>"` with a time range. Add `jsonPayload.event=~"^request\."` for the order path, `jsonPayload.event=~"^dictation\."` for voice order, or `severity>=WARNING` for failures only.

The browser keeps events in `localStorage` (at most 500) and sends them in batches to the `clientLog` function, also after coming back online. `clientLog` accepts only signed-in users from the live and preview origins and no App Check, so logs still arrive when App Check is the step that hangs.

## PWA and push

The installable app and push notifications ship with the production build only. The service worker is off in the emulator and dev builds, so the salon settings "Notifications" section is hidden there. It is also hidden in a production build whose local config has no `messaging.vapidKey`.

Owner steps for production, in order (each is a production change that needs the owner's approval):

1. Firebase console → Project settings → Cloud Messaging → Web Push certificates → Generate key pair. Put the public key in the local config as `messaging.vapidKey` and confirm `firebase.messagingSenderId`.
2. `gcloud services enable fcm.googleapis.com --project notbad-6be95`
3. `gcloud projects add-iam-policy-binding notbad-6be95 --member="serviceAccount:baberhq-runtime@notbad-6be95.iam.gserviceaccount.com" --role="roles/firebasecloudmessaging.admin" --condition=None`
4. `npm run deploy:db:diff`, then `npm run deploy:db` (adds `push_token`).
5. `npm run deploy:functions`
6. `npm run build:prod`, then `npm run deploy:preview`. On the phone open the preview URL, install the app, enable notifications in salon settings, then approve, reject or dispatch from HQ on the laptop with the app closed. Tapping the notification opens the request.
7. Promote (`npm run deploy:promote`) only after the owner's OK.

iOS delivers push only to the app opened from the Home Screen. Notifications and installs are per origin, so the preview and live URLs are separate and each needs its own install and permission.

## Roll back

- Web app: `npx firebase hosting:clone notbad-6be95@<VERSION_ID> notbad-6be95:live --project notbad-6be95`. Version IDs are in the Firebase console, Hosting → release history.
- Functions: check out the previous commit and run `npm run deploy:functions`.
- A web rollback to a version from before the `commands`/`ai` release also needs the Functions from that commit (the old function names). Deploying them will prompt to delete `commands` and `ai`; answer only after the rolled-back web is live, and never use `--force` while the current web still calls them.
- Database: no automatic rollback. Schema changes must stay additive.

## Security notes

- The browser API key only works from the prod, preview and `localhost:4200` origins. Node scripts that use the client SDK against prod (`tests/support/cloud.ts`, enabled with `BARBERHQ_TEST_CONFIG`) are refused.
- Self sign-up is disabled; accounts are created by the seed scripts (Admin SDK).
- App Check is enforced in code on all callable Functions and both PDF endpoints. Storage and Data Connect are enforced from the console (below).

## App Check

The web app initialises App Check (reCAPTCHA Enterprise) when Firebase is created, before Data Connect, so every query carries a token. The browser never uses the Storage SDK (rules deny all; PDFs go through `uploadKnowledgePdf` and `getSourcePdf`), so Storage enforcement has no effect on the app.

Turning enforcement on is a production change. In the Firebase console → App Check → APIs:

1. Check the metrics: verified requests should be close to 100% for the release you are testing.
2. **Cloud Storage** → Enforce.
3. **Data Connect** → Enforce, only after the web release with early App Check is live. Test the `foundation` preview first (sign in, salon inventory, HQ lists, assistant).
4. Undo: the same screen → Unenforce. It takes effect within minutes, no deploy.

Enforcement applies only to client SDK traffic. The console, Cloud SQL Studio, `gcloud`, the Admin SDK (seed scripts, Functions) and the Firebase MCP keep working. A client SDK script or a hand-written request against prod needs a debug token from App Check → Apps → Manage debug tokens; never commit it.
