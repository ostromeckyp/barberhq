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
BARBERHQ_TEST_MODE=emulator npm run test:e2e      # needs the dev server on 4200
npm run format:check
```

Integration tests need emulators; the isolated stack used for SQL-heavy suites is described in [full demo reset](implementation/full-demo-reset.md#verification-local-isolated).

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

The script runs `gcloud run services update <service> --min-instances <n>` and then prints each service's `minScale`. The next `npm run deploy:functions` resets the minimum to 0, so run it again after any Functions deploy.

## Roll back

- Web app: `npx firebase hosting:clone notbad-6be95@<VERSION_ID> notbad-6be95:live --project notbad-6be95`. Version IDs are in the Firebase console, Hosting → release history.
- Functions: check out the previous commit and run `npm run deploy:functions`.
- Database: no automatic rollback. Schema changes must stay additive.

## Security notes

- The browser API key only works from the prod, preview and `localhost:4200` origins. Node scripts that use the client SDK against prod (`tests/support/cloud.ts`, enabled with `BARBERHQ_TEST_CONFIG`) are refused.
- Self sign-up is disabled; accounts are created by the seed scripts (Admin SDK).
- App Check is enforced on all callable Functions, not yet on Data Connect.
