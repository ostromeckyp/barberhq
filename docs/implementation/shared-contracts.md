# Shared implementation contracts

**Proposed contracts, not existing code · updated 29 September 2026.** Read this file with the active phase specification and [approved design extensions](../../.claude/specs/approved-design-extensions.md), which own the added batch/document/geometry contracts.

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

`available = onHand - reserved`. Integer units only; request quantities are 1–99. One shared multi-product UI draft creates one independent request per product. Per-row submission outcomes and retry keys are specified in the approved extensions; batch partial success never means partial fulfillment. `lowStockThreshold` is one public setting, default 2, applied to salon on-hand quantities. Persisted request states: `PENDING_APPROVAL`, `RESERVED`, `DISPATCHED`, `RECEIVED`, `REJECTED`; draft is local UI state. Conservation for this transfer: HQ + transit + Legnicka = 20. Partial/damaged receipt cannot mark this transfer received or add saleable stock.

## Interfaces and authorization

Scoped reads: `GetMyMembership`, `ListProducts`, `GetSalonInventory`, `ListActiveRequests`, `GetRequestDetail`, `ListHQQueue`, `GetSourceSection`, `ListKnowledgeDocuments`, and HQ-only `GetKnowledgeReview`.

Explicit callable commands: `submitRequest`, `approveRequest`, `rejectRequest`, `dispatchTransfer`, `receiveTransfer`. Each carries an idempotency key; transitions also carry the expected request revision, approval the expected HQ inventory version. Receipt carries exact received quantity and `allIntact: true`. Return `{actionReceiptId, requestId, state, revision, replayed}`. Atomic SQL transactions enforce permissions, state, uniqueness and stock invariants. Retry an unknown outcome with the same key.

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
