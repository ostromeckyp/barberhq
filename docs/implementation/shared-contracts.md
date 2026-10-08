# Shared implementation contracts

**Current stock/settings contracts · updated 8 October 2026. AI and knowledge contracts remain proposed.** Read this file with the active phase specification and [approved design extensions](../../.claude/specs/approved-design-extensions.md), which own the added batch/document/geometry contracts.

## Product and scope

BarberHQ supports Not Bad Stuff and salons **Legnicka, Łódzka, Zakładowa**, plus a fictional HQ warehouse. Business external key: `not-bad-stuff-demo`. Preserve the six `demoId` values in `docs/not-bad-stuff-products.json`; these are local IDs, not official SKUs. Phase 2 establishes schema IDs; phase 3 records deterministic external-key mappings. Never hardcode Firebase UIDs in committed fixtures.

Use Angular SPA, Firebase Auth, classic Firebase Hosting, SQL Connect (formerly Data Connect) with Cloud SQL PostgreSQL/pgvector, private Firebase Storage, and server-side Genkit/Gemini. GraphQL schemas and operations generate client/server SDKs. No Firestore, SSR, Nx, additional vector database, persistent chat is required. HQ document upload/review/replacement/deletion UI is in scope.

## Two independent scenarios

1. Legnicka requests **2 Pomada Matowa 100 ml**. HQ approves, dispatches; Legnicka receives all 2 intact.
2. Zakładowa asks about fictional damaged delivery `DEMO-DAMAGE-01`. RAG provides instructions, with a visible synthetic label and original-PDF citations. This scenario does not mutate inventory or submit a claim.

| Point | HQ on hand | HQ reserved | In transit | Legnicka on hand |
|---|---:|---:|---:|---:|
| Initial / submitted | 18 | 0 | 0 | 2 |
| Approved | 18 | 2 | 0 | 2 |
| Dispatched | 16 | 0 | 2 | 2 |
| Received | 16 | 0 | 0 | 4 |

`available = onHand - reserved`. Integer units only; request quantities are 1–99. One shared multi-product draft creates **one request with 1–6 unique items**, one idempotency key and one outcome. All commands are whole-request atomic: no partial approval, dispatch or receipt. `SalonSettings.lowStockThreshold` is a versioned per-salon database setting, initially 2; missing settings are errors, never a browser fallback. Persisted request states: `PENDING_APPROVAL`, `RESERVED`, `DISPATCHED`, `RECEIVED`, `REJECTED`; draft is local UI state. Conservation for this transfer: HQ + transit + Legnicka = 20. Partial/damaged receipt cannot mark this transfer received or add saleable stock.

## Interfaces and authorization

Scoped reads: `GetMyMembership`, `ListProducts`, `GetSalonInventory`, HQ-only `GetHqInventory`, `ListActiveRequests`, `GetRequestDetail`, `ListHQQueue`, `ListSalonRequests`, `GetSalonSettings`, `GetSourceSection`, `ListKnowledgeDocuments`, and HQ-only `GetKnowledgeReview`.

Explicit callable commands: `submitRequest`, `approveRequest`, `rejectRequest`, `dispatchTransfer`, `receiveTransfer`. Each carries an idempotency key; transitions also carry the expected request revision, approval a complete per-product `inventoryVersions[]` set. Submit carries `items: {productId,quantity}[]`; receipt carries the complete `items: {productId,receivedQuantity}[]` set and `allIntact: true`. Return `{actionReceiptId, requestId, state, revision, replayed}`. Atomic SQL transactions enforce permissions, state, uniqueness and stock invariants. Retry an unknown outcome with the same key.

HQ document commands: `createDocumentUpload`, `reviewAndPublishDocument`, `retryDocumentProcessing`, `deleteKnowledgeVersion`; authenticated HTTP `uploadKnowledgePdf` accepts bounded binary PDF bytes. Use stable operation keys and document/version revision guards, separate from stock `ActionReceipt` records. Their schemas and semantics are owned by the approved extensions.

AI callables: `prepareReplenishment` returns `PROPOSAL | NEEDS_CLARIFICATION | UNAVAILABLE` with line-level results and excluded active requests; `answerProcedureQuestion` returns `ANSWER | NEEDS_CLARIFICATION | INSUFFICIENT_EVIDENCE`. Shared operational failures use structured errors. Neither flow can invoke stock writes. Server derives business/actor scope from verified identity and SQL membership. Client role claims, route guards and model arguments are never authority.

Limits across both AI endpoints: 2,000 input characters, 25-second flow budget, at most 5 model turns / 8 tool executions, 10 admitted requests per user per hour. No fabricated tool activity. English corpus; Polish answers require separate evaluation.

## Knowledge contract

Original immutable PDF bytes live in **Storage**. PostgreSQL stores document/version/page/chunk records, readable extracted text, embedding vectors and source references. **pgvector is the PostgreSQL extension used to store/search vectors; an embedding is a numerical representation produced by an embedding model.** Storage does not generate embeddings.

PDF → page-aware extraction → normalized Markdown plus page/geometry map → reviewed page-local chunks → embeddings → staged SQL → active-version publication. Markdown is a derived processing artifact, not a replacement for the source PDF. Preserve physical PDF page numbers, PDF page geometry and chunk rectangles. Citations include `versionId`, `chunkId`, page and excerpt; the server validates membership and the viewer transforms rectangles through the PDF viewport. Both document and query embeddings use one pinned compatible model/configuration; dimension is selected after verification, not assumed.

Manifest fields: `documentId`, `version`, `title`, `language`, `businessKey`, `sourceType` (`synthetic-procedure` or `public-product-summary`), `synthetic`, `publicationStatus` (`demo-current` or `retired`), `inputPdf`, `sha256`, `sourceUrls`, `observedOn`. Ingestion adds exact bucket/path/generation, parser/model versions, dimension and extraction hashes. Procedures are synthetic; public product summaries are marked unofficial demo compilations with cited factual sources.

Retrieve only authorized, active, READY versions, filtering inside the similarity query. Initial corpus has three procedures; phase 1 adds a public product guide. The retired procedure is a negative-test fixture. Do not index README, tests, expected answers or slides. HQ imports reuse operator ingestion through a bounded task queue worker. Require every-page review before publication. Store document revision, version revocation, processing/error status and review audit. Delete revokes a selected version and clears its active pointer if necessary; no automatic fallback. Published historical versions remain readable unless revoked.

Source cards are built by the server from retrieved records and open authorized immutable PDFs through `getSourcePdf(versionId)`.

## Deployment contract

Classic Firebase Hosting serves the Angular browser artifact; no SSR or App Hosting runtime/configuration is required. Public Firebase/API settings are resolved at build time and validated against the target project. Backend secrets remain in backend configuration. Phase 4 implements the [deployment specification](../../.claude/specs/firebase-hosting-deployment.md); phase 7 verifies preview, live promotion and frontend rollback. Preview and live share the configured demo backend. Deployment never seeds or resets data.

## Repository and handoff

Planned implementation paths: `web/`, `functions/`, `dataconnect/`, `scripts/`, `data/`, `storage.rules`, `firebase.json`. Reuse the existing `docs/` source assets. Pin compatible dependencies when implementation starts. New phase reports belong in `docs/implementation/handoffs/`; they do not exist until work is performed. No secrets, service-account keys or private UID mappings in committed data.

## Implemented request and settings relations

`ReplenishmentRequest` is the state/revision header; `RequestItem` has a stable derived ID and unique (request, product). `Transfer` shares request identity, `TransferItem` references each request item, and `StockMovement` is unique by transfer item/type. Native SQL Connect transactions use six bounded mutation groups, with full-set validation and deterministic product ordering. Active slots remain unique per business/salon/product. See [transaction proof](whole-request-transactions.md) and [upgrade instructions](replenishment-items-upgrade.md).

`SaveSalonSettings` is an authenticated, version-guarded GraphQL mutation returning its authoritative row. It checks business, assignment and SALON kind inside the transaction. Integer range is 0–2147483647. Seed inserts missing defaults; reset preserves settings. Settings are not stock movements.

Salon routes: `/salons/:salonId` (Inventory), `/salons/:salonId/requests` (All/Active/Received/Rejected; server filtering and pages of 50), `/salons/:salonId/settings`. Details use bounded, authorized return context in router state; direct links default to their salon's All list or HQ queue. The topbar owns workspace selection.

Pending submission format2 contains one immutable payload/key in `barberhq.pending.v2`. Unknown outcomes only reconcile that payload. Legacy/unknown journals remain untouched and block a new submission until operator reconciliation. See [increment 2b handoff](handoffs/increment-2b.md).

## Workspace navigation — approved 8 October 2026

Exactly one URL-derived workspace is active. HQ members choose HQ or an accessible salon from the Workspace selector; salon members never receive an HQ option. Switching to a salon always opens its inventory, switching to HQ opens the salon-request queue. HQ navigation contains Salon requests and HQ stock; salon navigation contains Inventory, Requests, Settings. The brand link opens the active workspace home.

Canonical details are `/hq/requests/:requestId` and `/salons/:salonId/requests/:requestId`. The latter verifies the loaded request belongs to the URL salon before display. Existing `/requests/:requestId` links redirect to an authorized canonical route, retaining only validated matching list context. URL workspace governs actions and Back; router state only preserves matching filter/offset and cannot change perspective.

HQ workspace exposes approval, rejection and dispatch. Salon workspace exposes ordering and receipt, including HQ acting on behalf of its own-business salon. A persistent banner makes that delegation visible. Both roles see the same salon availability and workflow. Actual authenticated HQ UID is retained in ActionReceipt/StockMovement; context never impersonates another identity. Backend membership/business/assignment and atomic whole-request checks remain authoritative. Submission and receipt labels do not infer the actor role from the action type.

HQ-only `/hq/stock` and `GetHqInventory` show onHand, reserved and available independently of a salon selection. Existing Material tables preserve shared columns and contained scrolling. Prefer CDK primitives when further table styling requires them; this navigation change does not replace the table implementation.
