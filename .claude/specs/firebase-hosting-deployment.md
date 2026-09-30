# Spec: Firebase Hosting deployment

> Build and release the Angular SPA to classic Firebase Hosting with repeatable configuration, preview checks and frontend rollback.

## Background

**Confirmed choice · 27 September 2026 · specification only.** The frontend uses **Firebase Hosting**, with Angular rendering in the browser. App Hosting, Angular SSR and `apphosting.yaml` are outside this deployment design. Read the [master specification](barberhq-master.md) and [shared contracts](../../docs/implementation/shared-contracts.md).

This is a cross-phase specification: [phase 4](phase-04-angular-app.md) implements build/Hosting configuration; [phase 7](phase-07-demo-readiness.md) performs the integrated release and rehearsal. It does not create an additional implementation phase. Backend functions, SQL Connect, Auth and private document Storage retain their existing responsibilities.

## Requirements

### 1. Explicit deployment target

Use one configured demo Firebase project and one Hosting site, initially its provided `web.app` URL. Record project ID, site ID, functions region, SQL service/connector locations and exact Storage bucket. Pass an explicit project ID in deployment commands; reject missing or conflicting target settings. A custom domain and automated GitHub deployments are optional future work.

Pin the Firebase CLI used by the project and use repeatable package installation from lockfiles. Preserve existing `firebase.json` backend settings when adding Hosting configuration. Never run initialization in a way that replaces reviewed configuration unnoticed.

### 2. Angular production build

Provide a documented `web/` package script named `build:production` that validates/generates public configuration and runs the Angular production build. Inspect the real build output and set `hosting.public` to the directory containing the browser `index.html` and assets, often an Angular `dist/.../browser` directory. Do not guess that path or deploy the repository root, server output, source PDFs or operator files.

Hosting uploads built files; it does not build Angular or provide a Node runtime for the frontend. Fail the release if configuration or `index.html` is missing. Record build identity and public configuration identity with the release.

### 3. Public configuration and backend secrets

Use an explicit typed public configuration contract containing Firebase web configuration, functions region, SQL Connect identifiers/location, PDF read/upload endpoint URLs, public lowStockThreshold (default 2) and public App Check settings. Resolve it at build time from a selected nonsecret configuration file or an allowlisted build-environment generator. Validate required fields and project consistency before compiling.

If a developer uses a local `.env`, a build script must explicitly load and map the permitted values. Do not copy `.env` into Hosting or expose the complete environment. No browser `process.env`, App Hosting console-variable dependency or SSR is required. Changing compiled settings requires rebuilding and redeploying the frontend.

Model credentials, operator identity, private UID mappings and App Check debug tokens never enter public configuration. Server configuration/secrets belong to the separately deployed functions/provider setup. Document the selected configuration source and generated file behavior so local and release builds use the same path.

### 4. SPA routing and caching

Configure a final catch-all rewrite to `/index.html`. Direct navigation and browser refresh must work on `/hq`, `/salons/:salonId`, `/requests/:requestId`, `/procedures` and the document tab (?tab=documents) and PDF viewer route with its page/chunk query parameters. Existing assets must retain their proper content types. Let Angular display its not-found view for unknown application routes.

For this small demo, set `Cache-Control: no-cache` on all hosted files initially, ensuring root and rewritten routes are covered. More aggressive caching of fingerprinted assets is optional later. Do not add a service worker/offline cache in this phase. Verify actual deployed headers and that a new release loads on refresh. These rules concern public frontend assets; the private PDF function retains its own `private, no-store` response policy.

Use generated SDK/callable access to backend services and the configured PDF read/upload HTTP endpoints directly. Hosting API rewrites are not needed for the baseline. Any later specific function rewrite must precede the SPA fallback and document its release coupling. See [Hosting configuration](https://firebase.google.com/docs/hosting/full-config) and [cache behavior](https://firebase.google.com/docs/hosting/manage-cache).

### 5. Backend readiness and preview

Before release, verify deployed SQL schema/connectors, functions, Storage rules/IAM and seeded data using the existing phase checks. Frontend deployment neither provisions those resources nor runs ingestion/reset scripts.

Publish a temporary preview channel using the production artifact. Configure the exact preview/live hostnames for Auth and App Check as required, plus origins allowed by both PDF HTTP endpoints; verify CORS preflight, authenticated PDF access and HQ upload. Verify the ingestion worker/queue is deployed separately before the library smoke test. Do not disable enforcement to make preview work.

Preview channels isolate frontend releases, **not backend data**. For this single-project demo, both preview and live use the same demo backend. Preview stock commands therefore affect demo inventory; reset deliberately before the stage rehearsal. Preview URLs are shareable frontend URLs, not an authorization boundary.

### 6. Promote the tested release

Provide the following documented command sequence using the pinned CLI. These are templates: replace `PROJECT_ID`, `SITE_ID` and `CHANNEL_ID` with verified values; no resources are deployed by this specification.

```bash
npm --prefix web ci
npm --prefix web run build:production
firebase hosting:channel:deploy CHANNEL_ID --project PROJECT_ID --expires 7d
firebase hosting:clone SITE_ID:CHANNEL_ID SITE_ID:live --project PROJECT_ID
```

Build and test preview before cloning that same Hosting version to live. Do not publish another build to the selected preview channel between verification and promotion; record its version ID. Backend deployments remain separate and must be compatible with both the candidate and previous frontend during the release window. See [preview and deployment](https://firebase.google.com/docs/hosting/test-preview-deploy).

### 7. Rollback and operational record

Record the previous good Hosting release/version and document how to restore it from the site's release history. Verify frontend rollback once with compatible backend versions, then restore the intended release and recheck it. A Hosting rollback does not undo SQL migrations, function deployments, document publication or stock movements. Do not reset business data automatically during frontend deployment/rollback. See [release management](https://firebase.google.com/docs/hosting/manage-hosting-resources).

Write a deployment runbook with exact build/deploy commands, configuration inputs, target IDs, preview/live URLs, backend prerequisites and rollback steps. Keep credentials out of that document. Phase reports record actual verification results, not just a successful upload.

## Affected Files

| File | Change Type | Description |
|---|---|---|
| `firebase.json` | Future modify | Explicit Hosting site, browser output, rewrites and headers |
| `web/package.json` and lockfile | Future create/modify | Repeatable production build and dependencies |
| `web/src/app/` configuration module | Future create | Typed public settings used by Firebase/API initialization |
| `scripts/` | Future create/modify | Target validation and configuration generation if needed |
| `.gitignore` | Future modify | Exclude local credentials, private settings and generated artifacts as appropriate |
| `docs/implementation/deployment-runbook.md` | Future create | Exact verified release/rollback procedure |
| Phase 04 and 07 handoff reports | Future create | Build configuration and deployed evidence |

## Existing Patterns to Reuse

- Reuse the [presenter setup guide](../../docs/06-firebase-setup-guide.md) and the existing generated SDK/backend endpoints.
- Reuse phase-03's explicit demo reset; do not couple reset or embedding generation to a Hosting deploy.
- Reuse phase-04 UI smoke checks and phase-07 end-to-end scenarios.

## Constraints

No deployment is performed while writing specifications. No App Hosting backend, SSR, frontend secrets, public source-PDF directory or automatic database reset. Backend authorization remains necessary even though Angular assets are publicly served.

## Open Questions

No hosting-product decision remains: classic Firebase Hosting is selected. The owner supplies the project/site identity; phase 4 records the actual Angular output path and configuration inputs. Custom domain and CI automation are not prerequisites.

## Acceptance Criteria

- [ ] A clean dependency installation and production build generate the correct browser artifact from documented public settings.
- [ ] Missing/mismatched project settings stop deployment preparation; published files contain no backend credentials or private source PDFs.
- [ ] Preview and live load over HTTPS; direct navigation/refresh works on all application routes and a cited PDF page/region and the document tab.
- [ ] Auth, App Check, scoped GraphQL, callable commands and PDF read/upload endpoints/CORS work from preview and live origins.
- [ ] The tested Hosting version is promoted to live and its version/URLs recorded.
- [ ] Rollback is demonstrated without changing stock/database state; the intended release is restored and checked.
- [ ] Full stock and RAG scenarios pass on the live URL, with frontend release and backend state recorded separately.
