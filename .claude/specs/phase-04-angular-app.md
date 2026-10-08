# Spec: Phase 4 — Angular application and manual workflow

> Updated 8 October 2026: the implemented [whole-request/settings contract](../../docs/implementation/shared-contracts.md) and [increment 2b handoff](../../docs/implementation/handoffs/increment-2b.md) supersede earlier single-product, per-row submission and public-threshold descriptions. RAG/AI remain future phases.


> Build the complete authenticated stock workflow and source viewer before introducing AI.

## Background

Read shared contracts and phase-02/03 handoffs, plus architecture section 3 and the [Firebase Hosting deployment specification](firebase-hosting-deployment.md). This phase owns its production-build, public-configuration, SPA-routing and caching requirements; phase 7 owns integrated release and rollback verification. Implement an Angular SPA using the pinned stable compatible package set chosen at implementation time. Use the seeded business data and generated SDK; no replacement mock backend is an acceptance substitute.

UI design reference: [views, elements and states](../../docs/design/views-and-states.md). Use Angular Material for standard controls and compose domain-specific components using the shared theme. Read the approved handoff SPEC and AGENTS instructions for theme/layout/component mapping. HTML remains reference material; visual acceptance is still an implementation check.

Read the [approved design extensions](approved-design-extensions.md) for this phase’s approved batch, document-library and PDF-geometry responsibilities.

## Requirements

1. Create standalone Angular routes for sign-in, /salons/:salonId, /requests/:requestId, /hq, /procedures (including ?tab=documents) and /procedures/sources/:versionId?page=N&chunk=CHUNK_ID. Use feature-local signals and small SessionService, StockApi, KnowledgeApi and AssistantApi boundaries; defer actual AI integration to phases 5/6.
2. Integrate configured Firebase Auth and App Check. Resolve membership through SQL Connect after sign-in; show a useful no-access screen for authenticated users without membership. Route guards guide navigation while backend rules enforce access. Provide sign-out and consistent session expiry handling.
3. Use the generated GraphQL read SDK for products, stock, requests and queue views. Implement a shared manual multi-product draft with quantity 1–99, duplicate merging, active-request exclusion, nonblocking shortage warnings and whole-request submission/recovery. Create one request with all items via submitRequest; then implement HQ approval/rejection/dispatch and destination full-intact receipt via callable commands. Use stable action idempotency keys through retries and uncertain outcomes.
4. Display on-hand, reserved, available, in-transit and received quantities with status/actor timeline. Refresh affected server records after success and on focus/reconnect; include manual Refresh. Do not optimistically change inventory. Stale versions require refreshed review.
5. Handle loading, empty queue, invalid quantity, insufficient stock, duplicate request, unauthorized scope and unavailable backend. If receipt is short/damaged, explain that the happy path cannot close; link to procedures without adding stock. Maintain the independent damaged-delivery demo scenario.
6. Implement the private PDF viewer using the authorized endpoint and a compatible PDF.js dependency. Open the cited physical page and transform validated chunk rectangles to the viewport for highlighting; support zoom, rotation and direct deep links. Handle invalid chunk/version combinations and missing geometry explicitly. Show document/version/synthetic or superseded labels, and offer authorized download on preview failure. Clean up temporary object URLs; never expose raw bucket URLs.
7. Build the document library, salon read-only view and HQ upload/review/publish/replace/delete/retry controls. Show actual processing states, complete page review and conflict recovery. Add low-stock indicators using public lowStockThreshold default 2. Hide actions by role and hide Assistant tabs until phases 5/6 provide real flows.
8. Use accessible controls and readable stock numbers suitable for a projected demo. Implement the linked Hosting specification: validated public build configuration, a repeatable `build:production` script, explicit site/browser output, SPA fallback and initial no-cache headers. Keep function secrets and local `.env` files out of the published artifact. Deliver a manual flow smoke test and a concise phase report.

## Affected Files

| File | Change type | Description |
|---|---|---|
| `web/` | Create | Angular application, Auth integration and generated read SDK consumer |
| `firebase.json` | Modify | Explicit Hosting site, browser output, SPA routing and caching alongside backend config |
| `docs/implementation/deployment-runbook.md` | Create | Build/configuration instructions; phase 7 completes verified release steps |
| `docs/implementation/handoffs/phase-04.md` | Create | Run/deploy instructions and manual flow evidence |

## Existing Patterns to Reuse

- Reuse phase-02 contracts/errors and phase-03 fixtures; do not duplicate stock arithmetic in client code.
- Reuse source permissions and PDF endpoint rather than adding direct Storage access.

## Constraints

- No SSR, global state framework, PDF content editor or AI dependency in the stock lifecycle. HQ document administration is required.
- Keep existing backend folders/configuration intact when generating the Angular app.

## Open Questions

No product decision blocks implementation. Use the owner-configured Auth provider and the phase-02 contract; choose/pin compatible Angular and viewer packages during implementation.

## Acceptance Criteria

- [ ] Production build and focused UI integration checks pass; build validates public configuration and targets the actual browser output.
- [ ] Hosting emulator serves assets and direct SPA routes correctly; no backend secrets or private PDF sources are published.
- [ ] Using distinct HQ and Legnicka accounts, request2/approve/dispatch/receive produces HQ16, Legnicka4, transit0.
- [ ] Wrong salon and unassigned users cannot act or view protected data; direct URL navigation does not bypass scope.
- [ ] Retry and stale-state UI preserve command safety; AI is unnecessary for completing the flow.
- [ ] A seeded source citation opens the correct authorized PDF page and highlighted region with its provenance label.
- [ ] Manual multi-product submission handles partial success and lost responses without duplicate requests; review/projection controls follow the approved handoff.
- [ ] HQ can upload/review/replace/delete; salon sees authorized readable documents without management controls.
- [ ] Low-stock indicator changes from visible at 2 to absent at 4; desktop/mobile layouts and keyboard operation pass.
