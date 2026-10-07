# Increment 1 — local run and Firebase Hosting release

Current status: local implementation verified; **no cloud deployment**. Project/site `notbad-6be95` were read from Firebase. The project's Web apps and Data Connect services were empty on 2026-09-30. `barberhq` service/instance/database and `europe-west1` remain proposed settings, not existing resources.

## Clean installation and local preview

Use Node 22.22.3 (see `.node-version`) and npm 10.9.8. Generated SDKs are committed so both clean installs work without cloud access.

```sh
npm ci
npm --prefix web ci
npx playwright install chromium
npm run configure:emulators
npx firebase emulators:start --only auth,dataconnect --project demo-barberhq
```

Keep that terminal running. In another terminal:

```sh
npm run demo:local
npm --prefix web run start:emulator
```

Open `http://127.0.0.1:4200`. Generated passwords live only in ignored `config/demo-accounts.local.json` (mode 0600); do not paste them into commits, slides or logs. Four local accounts correspond to HQ, Legnicka, Łódzka and Zakładowa. The preparation command preserves existing quantities and writes only to localhost emulators. Restarting emulators without export/import removes local data; rerun preparation.

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

`npm run generate:sdk` regenerates clients after any schema/operation change. Run `npx firebase dataconnect:compile --project notbad-6be95` before committing schema changes. The compiler does not provision or deploy a service. Emulator/compiler version observed: 3.4.21.

## Owner prerequisites for cloud

Follow the [owner checklist](firebase-owner-checklist.md): billing and region decision; register a Web app; enable email/password; create demo users; provision Data Connect/Cloud SQL; configure App Check. No service-account key belongs in this repository or the Angular app. Configure ADC/operator access privately for seed and isolated integration fixtures.

Copy `config/public.example.json` to ignored `config/public.local.json` and replace all remaining public placeholders with actual values. Confirm service/location/connector against generated SDKs. Keep private UID mappings separately in `config/memberships.local.json`:

```json
[{"uid":"ACTUAL_AUTH_UID","role":"SALON","salonKeys":["legnicka"]}]
```

Add one entry per account; HQ uses `role: "HQ", salonKeys: []`. An unassigned account deliberately has no SQL membership.

After owner provisioning and target confirmation, deploy the schema/connectors explicitly (review SQL diff before migration). Do not use `--force` to bypass a destructive migration warning:

```sh
npx firebase dataconnect:sql:diff --project notbad-6be95
npx firebase deploy --only dataconnect --project notbad-6be95
npm run seed -- --config config/public.local.json --memberships config/memberships.local.json --dry-run
npm run seed -- --config config/public.local.json --memberships config/memberships.local.json --apply
```

The dry run reads current data and reports changes without writing. Metadata is upserted; existing stock is preserved. Concurrent seeds may fail on an insert conflict; rerun after the other import finishes. Do not run two seed operators simultaneously. Salon-access assignment is a provisioning operation, so run it before users start the demo.

Cloud verification must exercise real Auth, App Check and deployed operations. The Node integration harness has no browser App Check provider: when enforcement applies, run browser verification against a registered domain and add a supported test App Check setup before treating Node cloud checks as passed. Never switch off enforcement to manufacture passing tests. `BARBERHQ_TEST_CONFIG` and `BARBERHQ_ALLOW_TEST_FIXTURES=notbad-6be95` explicitly opt into isolated cloud fixtures; these are not needed for local tests.

## Build and preview (not executed yet)

```sh
npm run build:production -- --config config/public.local.json --project notbad-6be95
npx firebase hosting:channel:deploy foundation --project notbad-6be95 --expires 7d
```

The build validates an explicit allowlist and project/SDK consistency, emits only public values, compiles Angular and scans `web/dist/barberhq/browser`. It produces ignored `artifacts/build-record.json` with project, site, mode, artifact hash and configuration hash. Firebase's predeploy hook verifies the selected CLI project, site and bytes against that record; emulator artifacts, changed files and unrecorded builds are rejected. Build/deployment never seed data.

Register actual preview/live hostnames in Auth and reCAPTCHA Enterprise/App Check before smoke testing. Preview URL is assigned by Firebase; none has been created yet. Run `npm run check:hosting -- --base-url ACTUAL_PREVIEW_URL`, then real login/access/stock tests on that URL. Do not infer successful sign-in from an HTTP 200.

Once preview evidence is accepted, promote the same version without rebuilding:

```sh
npx firebase hosting:clone notbad-6be95:foundation notbad-6be95:live --project notbad-6be95
```

Record the actual Hosting version ID and URL alongside `{projectId,siteId,buildHash,configHash}` from the build record in the increment handoff. Repeat the smoke/login/read checks on live. The existing site's registered default URL is `https://notbad-6be95.web.app`; it is not evidence that BarberHQ is deployed there.

Official reference: [Firebase Hosting releases and versions](https://firebase.google.com/docs/hosting/manage-hosting-resources). Rollback selects the recorded previous Hosting version; it does not roll back SQL. No previous BarberHQ release exists yet.

## Increment 2 local startup

Use `npm --prefix functions ci` once, then `npm run start:emulators` (Auth, SQL Connect, Functions). Keep that terminal running; run `npm run demo:local` and `npm run start:local` in a second terminal. See [increment 2 handoff](handoffs/increment-2.md) for reset and verification. Older auth/dataconnect-only commands above support the foundation only and cannot execute replenishment actions.
