# Spec: approved Claude Design scope

> Implement the deliberately expanded handoff while preserving independent stock transactions and verifiable document evidence.

## Background

**29 September 2026 · approved scope, planning only.** The user confirmed that the Claude Design extensions are intentional. The [handoff SPEC](../../design_handoff_barberhq/SPEC.md) owns visual tokens, layout and component references; exported HTML is a reference, not application code. This document owns the cross-phase behavior needed to implement those additions. It supplements the [master](barberhq-master.md) and [shared contracts](../../docs/implementation/shared-contracts.md).

The four approved additions are multi-product drafts, a document library with HQ management, low-stock indicators and cited-region PDF highlighting. Retry behavior, publication review and deletion semantics below are implementation defaults derived from existing safety and traceability requirements, not claims that the prototype implements them.

## Requirements

### 1. One draft, separate requests

Assistant and Manual share an in-memory list. Manual adds one product at a time; Assistant can prepare several. Each resolved row has a stable local line ID, product, integer quantity **1–99**, origin (`assistant` or `manual`), current HQ availability, salon on-hand and a clearly conditional “after full receipt” quantity. No displayed projection changes real stock.

Merge repeated products by adding quantities; keep the row's original origin. A sum above 99 produces an editable invalid row, never silent clamping. Manual edits survive changing tabs. New assistant results merge into the draft only after a successful response. Use the six active catalog products as the initial maximum distinct-line count. Unknown/ambiguous products and quantities remain explicit clarification rows; submission is blocked until resolved or removed. An already-active product is excluded and links its request. If every row is excluded or the list is empty, disable Submit. HQ shortage warns but permits submission; full approval remains subject to actual available stock.

`prepareReplenishment` accepts `salonId`, `message` and optional selected clarification fields keyed by line ID. It returns `PROPOSAL | NEEDS_CLARIFICATION | UNAVAILABLE`, with `lines[]` and excluded existing requests. Each line is `READY` or `NEEDS_CLARIFICATION`; ready lines include verified product ID/name, quantity, HQ available, salon on-hand and inventory versions. Clarification lines include original wording, reason and authorized catalog candidates. Server-calculated numbers replace model numbers. The three read tools accept bounded arrays so multi-product preparation fits the existing five-turn/eight-tool-call budget. Do not truncate a longer request silently.

On Submit, snapshot valid rows and call the existing `submitRequest` once per product, sequentially. Each row gets its own stable idempotency key and independent SQL transaction. There is **no batch entity, multi-line persisted request or all-or-nothing batch transaction**. Record each outcome as `CREATED`, `ALREADY_ACTIVE`, `FAILED` or `UNKNOWN` and show links for all confirmed requests. Stop on unknown outcome or session loss, reconcile with the same key, then resume unsent rows. Never resubmit confirmed rows. A rejected validation permits editing only that uncommitted row and then creating a new action key. Persist only pending submission IDs/keys and immutable payloads in session storage for recovery after refresh; clear after reconciliation or sign-out. Ordinary unsent drafts remain memory-only. Recheck authorization on every retry.

Partial batch success means some independent requests exist; it is not partial fulfillment of one request. Each created request follows its own unchanged approval, dispatch and full-intact receipt lifecycle. The two-unit Matowa scenario remains the stage proof.

### 2. Document library and HQ management

`/procedures?tab=documents` lists authorized published/current and superseded documents for salon staff, with Open. HQ sees its business's processing states and Add document, Review/publish, Retry and Delete actions. HQ navigation follows the handoff's Procedure docs entry; salon navigation provides Assistant and Documents. Hide unsupported actions and enforce the same roles on the server.

Use these proposed contracts, with runtime validation and generated SQL reads:

| Interface | Contract |
|---|---|
| `ListKnowledgeDocuments` | Scoped paginated list; salon excludes staged/failed/revoked versions, HQ includes processing status |
| `GetKnowledgeReview` | HQ-only page extraction, geometry and review coverage for one version |
| `createDocumentUpload` | HQ; title, language, source type, provenance, optional existing document ID/expected revision, file hash and idempotency key; returns staged version ID |
| `uploadKnowledgePdf` | Authenticated HTTP binary upload to that version ID; verifies HQ, Auth/App Check, hash, signature and 10 MiB limit; returns accepted processing status |
| `reviewAndPublishDocument` | HQ; version ID, extraction hash, reviewed physical pages, expected document revision and idempotency key; queues embedding/publication after complete review |
| `retryDocumentProcessing` | HQ; same version/hash and operation key; resumes verified unfinished work |
| `deleteKnowledgeVersion` | HQ; version ID, expected document/version revisions and idempotency key; removes that version from use |

Business identity, access scope, audit actor and times come from the server. Uploaded demo procedures always remain synthetic and visibly labeled; publication is not certification of real company policy. Replacing means a new immutable version under the existing document ID, never overwriting bytes. The library's delete confirmation names the selected version and explains that access is revoked while audit records/private originals are retained. Deleting the active version clears the active pointer; it does not reactivate an older policy automatically. Deleting a superseded version leaves the current version unchanged. Source endpoints and retrieval deny deleted versions. Already downloaded bytes cannot be recalled.

Upload and initial operator preload share the same validation/extraction/review/chunk/embedding pipeline. Use a server-enqueued task queue function for extraction and, after review, embedding/publication. This is one bounded ingestion worker, not a generic workflow engine. Queue retries must be idempotent; cap attempts/concurrency and expose a retryable failure. HQ can leave/reopen the page while processing. SQL is the progress authority, not simulated percentages. A staged version whose enqueue failed can be resumed through Retry.

States stay `STAGED → EXTRACTED → REVIEWED → EMBEDDED → READY`, with `NEEDS_REVIEW` and `FAILED`; revocation is separate. At EXTRACTED, HQ compares extracted text with every rendered page and explicitly approves review. Unsupported scans/layouts cannot be approved past missing-content errors; supply a supported replacement PDF instead. Only verified complete embeddings may publish. Publication checks the captured document revision and version revocation atomically; concurrent replacement/deletion returns a conflict and requires fresh review. The prior active version remains available until successful replacement. Worker retries cannot resurrect a deleted version. Failed imports never become staff-visible evidence.

Storage still denies direct client reads/writes. The upload proxy writes immutable originals using IAM; the private source endpoint also permits scoped HQ preview of its staged versions for review. The worker consumes only server-registered version IDs. Do not execute PDF actions or send arbitrary URLs to ingestion. Configure allowed origins for both HTTP endpoints. Firebase documents [task queue functions](https://firebase.google.com/docs/functions/task-functions); phase 3 must verify the chosen runtime/parser and deployed worker limits.

### 3. Low-stock indicator

One shared public demo setting `lowStockThreshold`, default **2**, marks salon on-hand quantities ≤ threshold. It is a static warning icon/chip and subtle row tint, not a reorder target, AI inference or automatic request. Unknown/stale data retains its data-state warning; missing quantities are never interpreted as zero. No per-product threshold table or configuration screen is needed.

### 4. Exact cited region in the original PDF

Use a PDF.js-based Angular viewer with an overlay driven by extraction metadata. The [PDF.js examples](https://mozilla.github.io/pdf.js/examples/) describe viewport transforms; pin a compatible version and verify overlay mapping during implementation.

`KnowledgePage` stores physical page, PDF view box, user unit and intrinsic rotation. `KnowledgeChunk` stores normalized text offsets plus `rects[]` in unrotated PDF user-space coordinates (`xMin`, `yMin`, `xMax`, `yMax`) and a geometry status. Keep token/span-to-PDF mappings while normalizing to Markdown. A multiline passage can have several rectangles; a page-spanning passage is already split into page-local chunks. Coordinates come from extraction, never Gemini or a hardcoded demo rectangle.

Source cards include immutable `versionId`, `chunkId`, page and excerpt. In the answer contract, each `sourceSectionId` identifies one retrieved page-local chunk, not a reusable heading ID; keep the logical section ID separately so cross-page sections resolve unambiguously. Link to `/procedures/sources/:versionId?page=N&chunk=CHUNK_ID`. The server checks chunk/version membership and access; the chunk determines the authoritative page if the URL disagrees. Transform stored rectangles through the same viewport as the rendered page, including zoom/rotation/crop. Refreshing the deep link must restore the correct highlight. Retain page-only links for document-library browsing. Missing geometry opens the page and excerpt with an explicit “Exact highlight unavailable” state; it must not invent a highlight. The rehearsed citations require verified geometry and actual highlights to pass.

### 5. Handoff boundaries

Follow the supplied Angular Material M3 theme, responsive layout and domain components; use the planned `web/src/app/` project root. Keep HTML/support.js unchanged as reference. Prototype emails/password acceptance, hardcoded IDs, PDF pages and Reset demo data behavior are not production auth/data contracts. Reset remains the existing explicit operator tool; omit the prototype reset menu from ordinary salon/HQ UI. Adding a privileged UI reset is a separate decision.

The handoff's `docs/damaged-delivery-v1.2.pdf` is a design sample. Phase 1 reviews it as a candidate/reference; it does not silently replace canonical DAM-001 v1 or establish real policy. Actual generated version IDs, pages and highlights must come from ingestion.

## Affected Files

| Phase | Responsibility |
|---|---|
| 1 | Review sample PDF; prepare initial fixtures and replacement/deletion test assets |
| 2 | Schema/guards, document APIs, source permissions, per-request validation |
| 3 | Reusable extraction worker, page geometry, review/publication/retry/revocation |
| 4 | Manual batch, library/HQ controls, low-stock indicator, highlighted viewer |
| 5 | Multi-product natural language into the same draft |
| 6 | Sources with chunk identity; replacement/revocation retrieval checks |
| 7 | Integrated checks, Hosting origins/deep links, unchanged stage timing |

## Existing Patterns to Reuse

Reuse stock commands and transaction guards, private PDF serving, versioned staged publication, the existing phase order and the design handoff's Material components. No new stock lifecycle or vector store.

## Constraints

No OCR, PDF editing, autonomous mutations, bulk approval, partial receipt, generic CMS or persistent chat. No app implementation or cloud changes in this specification update.

## Open Questions

No scope confirmation is needed. Implementation must prove parser/viewport mapping, runtime compatibility and queued processing limits. A real pilot still needs approved company documents and retention policy; retained demo originals are not a promise of permanent deletion.

## Acceptance Criteria

- [ ] Manual and assistant can prepare three products; each submission creates independent requests with honest per-row outcomes and safe lost-response recovery.
- [ ] Unknown/ambiguous lines block submission; shortage warns without blocking submission; approval still prevents overselling.
- [ ] Salon can open allowed documents; only HQ can upload, review, replace or delete, including when endpoints are called directly.
- [ ] Failed/repeated uploads preserve current evidence; concurrent publish/delete cannot revive revoked content or publish incomplete text.
- [ ] HQ replacement becomes searchable only after review; superseded citations remain readable unless revoked.
- [ ] Low-stock marker appears at 2 and disappears at 4 using real refreshed quantities.
- [ ] Demo citations highlight the exact extracted region across zoom, rotation, direct navigation and mobile layouts.
- [ ] Golden stock totals and read-only RAG behavior remain unchanged; the six-minute demo still fits.
