# Spec: BarberHQ replenishment and procedure assistant

> Updated 8 October 2026: the implemented [whole-request/settings contract](../../docs/implementation/shared-contracts.md) and [increment 2b handoff](../../docs/implementation/handoffs/increment-2b.md) supersede earlier single-product, per-row submission and public-threshold descriptions. RAG/AI remain future phases.


> Complete a measurable two-unit replenishment and, in a separate use case, retrieve cited instructions for a damaged delivery.

Project overview and document relationships: [master specification](barberhq-master.md). This document owns the detailed application requirements. The [approved design extensions](approved-design-extensions.md) define the deliberately expanded handoff approved on 29 September 2026.

## Background

Planning only: no application has been implemented. The presenter confirmed two distinct use cases for a 20-minute DevFest talk. The real cosmetics brand is Not Bad Stuff; the real salons are Legnicka, Łódzka and Zakładowa. Six products were researched in Chrome; see the [catalog](../../docs/04-not-bad-stuff-catalog.md). Real internal procedures reportedly exist but are unavailable, so the [synthetic knowledge pack](../../docs/synthetic-knowledge/README.md) supplies explicitly fictional demo sources.

Proposed stack: Angular SPA, Firebase Auth, SQL Connect / PostgreSQL with pgvector, Genkit + Gemini in Cloud Functions, and Firebase Hosting. The [research](../../docs/01-research-and-recommendation.md) records feasibility and the Firestore alternative. This revision replaces the earlier pack-rounded shortage demonstration with individual-unit transfers and actual dispatch/receipt recording.

Implementation design: [How the application will work](../../docs/05-architecture-how.md), including transaction algorithms, API boundaries, RAG ingestion and build order.

## Requirements

### 1. Two independent use cases

**A — Replenishment:** Legnicka requests two additional units of Pomada Matowa 100 ml. The assistant identifies the product, checks inventory and prepares a request. HQ explicitly approves and confirms dispatch; Legnicka explicitly confirms receipt. The UI shows requested 2 / dispatched 2 / received 2 and the corresponding stock movements.

**B — Damaged delivery guidance:** in a separate scenario, staff ask what to do about a damaged delivered product. The assistant retrieves the current synthetic procedure, returns supported instructions and displays the source sections. It does not submit a report, alter stock, open a replacement request or imply this is actual company policy.

Do not connect scenario B to the completed, intact delivery in A. Use a separate fictional context such as Zakładowa's sample delivery `DEMO-DAMAGE-01`, with no inventory mutation or ledger linkage.

### 2. Replenishment quantities and lifecycle

One persisted request contains 1–6 distinct products, integer quantities 1–99, individual retail units. A shared manual/assistant draft submits one items[] payload with one lifecycle and retry key. All transitions apply to every item; no partial fulfillment. “Send two” means two additional units. No target-stock inference or six-unit pack rounding. Unclear product/quantity means clarification; ambiguous “the matte stuff” offers Matowa, Dry Matt and Cement. Unknown products require clarification; multi-product requests produce editable separate lines. No silent substitutions.

Main product: Pomada Matowa 100 ml, local demo ID `NBS-MATOWA-100`, published code `5905191055165`. The demo ID is invented; net contents are ml, not mass or external dimensions.

| State | HQ on hand | HQ reserved | HQ available | In transit | Legnicka on hand |
|---|---:|---:|---:|---:|---:|
| Initial / request submitted | 18 | 0 | 18 | 0 | 2 |
| HQ approves 2 | 18 | 2 | 16 | 0 | 2 |
| HQ confirms dispatch of 2 | 16 | 0 | 16 | 2 | 2 |
| Legnicka confirms intact receipt of 2 | 16 | 0 | 16 | 0 | 4 |

Initial and final physical totals are both 20. Reservations are a subset of warehouse stock, not an additional stock location. In-transit units are counted separately after dispatch.

Request/transfer state: `DRAFT → PENDING_APPROVAL → RESERVED → DISPATCHED → RECEIVED`; `REJECTED` is available from pending. The UI must not label approval as shipment or dispatch as receipt. Record actor and timestamp at every transition.

- Insufficient availability: show a nonblocking submission warning, then block full approval if availability is still insufficient. Partial fulfillment and production-demand aggregation are deferred.
- No stock movement while typing, generating or merely reading a request.
- An existing active salon/SKU request is linked instead of duplicated; received/rejected requests no longer block a new one.
- A reported count contradicting the database triggers clarification; chat cannot overwrite stock.
- Receipt accepts only the exact full dispatched quantity confirmed intact for this demo. A damaged, missing or wrong delivery cannot be confirmed as an ordinary full receipt; show guidance/manual escalation and leave the transfer unresolved. An inventory-adjustment/discrepancy-resolution workflow is out of scope.
- Manual product/quantity entry uses the same validations and lifecycle when AI is unavailable.

### 3. Screens

| Screen | Required behavior |
|---|---|
| Salon workspace | Own salon stock, timestamp, low-stock marker (default ≤2), shared multi-product draft, clarification, active transfers, confirm receipt |
| Request detail | Product, unit quantity, availability, status timeline, actors, requested/dispatched/received counts |
| Document library | Salon view-only; HQ upload, extraction review, publish/replace, retry and delete versions |
| HQ queue | Approve/reject pending request; confirm dispatch of reserved transfer; refresh counts |
| Procedure assistant | Question, sourced guidance, visible synthetic-data label, source title/version/section and full section viewer and authorized original-PDF viewer with the cited region highlighted |

Show actual tool events, not model thoughts. Present stock movements in large, readable numbers. Both use cases share navigation but have separate actions and success conditions.

### 4. Data stored in PostgreSQL

Logical contract; final schema syntax is an implementation decision. Server supplies timestamps/actors and verifies business scope.

| Entity | Essential fields / constraints |
|---|---|
| Membership | user ID, business ID, salon/HQ role, allowed salon IDs; server-managed |
| Location | ID, business ID, name, salon/warehouse type; HQ address unspecified |
| Product | local demo ID, published source code as string, name, net contents/unit, source URL/date, aliases, active flag |
| Inventory | location/product key, onHand, reserved, version, countedAt; nonnegative; reserved ≤ onHand |
| ReplenishmentRequest | ID, salon/product, quantity, source text, state, revision, creator/timestamps |
| Transfer | unique request ID, origin/destination/product, quantity, dispatched/received quantities, state, revision, transition actors/timestamps |
| StockMovement | transfer ID, dispatch/receipt type, quantity, origin/destination, actor/time; unique transfer/type |
| ActionReceipt | request/transfer, action, expected revision, idempotency key, result; unique successful transition per entity/action |
| KnowledgeDocument / KnowledgeVersion | stable document/active-version pointer and revision; version revocation, processing/review audit; versioned title, scope, status, language, synthetic flag, PDF bucket/path/generation/hash, page count, parser version and ingestion state |
| KnowledgePage | version and physical page number, extracted text, optional printed label, extraction review state, PDF view box/user unit/rotation |
| KnowledgeChunk | document/version/section, physical page and text offsets, extraction-derived rectangles/geometry status, extracted text, vector, embedding model/dimension/hash; immutable cited versions |

No DemandSignal, replenishment-target table or production scheduler is required for these two use cases. Public product prices may remain in the research catalog but are not inputs to inventory calculations.

### 5. Agent boundary

Use a small server-side assistant with two entry points: `prepareReplenishment` and `answerProcedureQuestion`. A visible UI mode supplies intent; no general autonomous task planner is needed.

| Allowed tool | Use |
|---|---|
| `findProduct(descriptions[])` | Resolve catalog candidates; verify user selection |
| `getStockContext(salonId, productIds[])` | Scoped live stock, version and existing active request |
| `calculateProposal(salonId, lines[])` | Deterministic revalidation; no model-supplied inventory counts |
| `searchProcedures(question)` | Up to three scoped current document sections with source IDs |

Replenishment output is a validated multi-line draft, line-level clarification or unavailable result. The bounded tools can process arrays within the existing call budget; see the approved extensions. Procedure output is supported guidance with source IDs or an explicit insufficient-evidence result. Validate returned IDs against actual tool output. All quantities shown and committed come from application/database validation.

Stock mutations are separate authenticated commands: submit, approve/reject, dispatch and receive. They are not model tools. Procedure guidance has no write tools at all. No arbitrary SQL, shell, URL fetch, email or carrier tools.

Start with a five-turn / eight-tool-call maximum, capped output and a 25-second overall deadline, enforced server-side. No automatic retry loop. Keep model credentials on the server. Firebase Auth and deployed App Check complement, not replace, business authorization.

### 6. RAG: purpose, corpus and retrieval

The business purpose is to help staff find the applicable procedure without searching a handbook or interrupting HQ. It is not needed to subtract two units from stock. Use the authored [corpus and evaluation cases](../../docs/synthetic-knowledge/README.md).

- Export the authored synthetic procedures to visibly labeled text-based PDFs during implementation; allow later company PDFs through the same pipeline. Store immutable originals privately in Firebase Storage. Embed page-aware extracted sections from DAM-001 v1, DIS-001 v1 and REP-001 v1. Load DAM-001 v0 as a retired filtering fixture only. The stage retrieval must use PDF extraction, not bypass it by indexing the original authoring Markdown. Normalize PDF extraction into derived Markdown with a physical-page map before chunking. Phase 1 also adds CAT-001 v1, an unofficial product guide based on the six-product snapshot, as a fourth current document; distinguish sourced product facts from synthetic procedures.
- Keep document ID, version, section, scope, language, source type and synthetic flag with every chunk. Procedure chunks have `synthetic: true`; CAT-001 contains sourced facts and carries the unofficial-compilation label. `demo-current` never means real business approval.
- Preload through an operator task before rehearsal and support HQ uploads through the same reviewed pipeline with asynchronous processing. Start with 10 MiB/30-page limits. Reject malformed/encrypted files; hold scans, mixed-content and complex-layout documents for review. OCR and table/diagram interpretation are out of scope. Visually verify extraction before publication.
- Retain PDF physical page numbers, page geometry, chunk rectangles and original object generation/hash. Activate only fully reviewed/embedded versions; failure keeps the prior version active. SQL and Storage publication must be staged because they do not share a transaction.
- Use the same pinned embedding model/dimension for ingestion and queries. Filter by authorized business and current status before similarity search. Tune relevance cutoffs against evaluation examples, not invented universal scores.
- Every procedural claim must be supported by a retrieved section. Preserve source versions with answers; cite the exact section and physical PDF page. Serve original PDFs through an authenticated, scope-checked endpoint; direct client Storage access is denied. Never treat text inside documents as tool authorization.
- When sources do not establish an answer, say so. In particular, the corpus contains no disinfection recipe, exposure guidance, refund guarantee or carrier/legal deadline.
- Always display “Synthetic demo procedure — not an actual Not Bad Stuff policy.” Stock availability must come from structured queries, never stale document text.
- The small synthetic corpus is a demonstration, not a validation of retrieval over the inaccessible real company documents. Replace it with owner-approved sources before a real pilot.

### 7. State transitions, permissions and retry safety

Salon staff access only their permitted salons; HQ acts within its business. Confirm receipt requires permission for the destination salon. Server tools and generated read operations enforce the same scope; privileged SDKs are not an authorization shortcut.

Each action uses expected revision and idempotency key and reads trusted stored quantities. Approval atomically checks pending state and available inventory, increments HQ reserved, creates the transfer and action receipt, and changes state. Dispatch atomically checks reserved state, reduces HQ onHand and reserved by two, creates the unique dispatch movement and changes state to dispatched. Receipt atomically checks dispatched state and intact full-quantity confirmation, increases destination onHand by two, creates the unique receipt movement and marks received. Advance affected inventory/entity versions.

Condition writes on expected versions and stock/state invariants, verify affected rows and roll back on failure. A transaction alone is not proof against competing updates. Two approvals competing for the last two units must allow at most one success. Duplicate dispatch/receipt and retries after a lost response return the existing action receipt without another stock movement. Do not allow receipt before dispatch. Prevent concurrent duplicate active salon/SKU requests with a database-backed guard. Exact SQL Connect expressions remain a feasibility gate.

### 8. Measurement and operation

- Primary demo proof: request 2, dispatch 2, receive 2; HQ 18 → 16; Legnicka 2 → 4; in-transit 0 after receipt.
- Knowledge proof: relevant current procedure, correctly supported answer, visible source/version, no mutation.
- Pilot measures: time to completed replenishment, corrections, ledger discrepancies, time to find a procedure, HQ follow-up questions. No unmeasured savings claims.
- Log run ID, tool/status/duration, source IDs, model/prompt versions, available usage, validation outcome and action receipts; avoid raw messages/documents in routine logs.
- Demo-only project, synthetic operational data, 2,000 input characters and initially 10 generations/user/hour. Configurable AI disable switch; manual path stays usable.
- Refresh inventory and timelines after each committed action. Timeout/quota error must not mutate stock. AI latency target: at least 9 of 10 rehearsed runs below 15 seconds; hard deadline 25 seconds. Targets are not measurements.

## Affected Files

No implementation files are created in this planning task. Suggested later locations:

| File | Change Type | Description |
|---|---|---|
| `web/src/app/features/replenishment/` | Future create | Request, transfer timeline and receipt UI |
| `web/src/app/features/hq/` | Future create | Approval and dispatch |
| `web/src/app/features/procedures/` | Future create | Read-only guidance and source viewer |
| `dataconnect/schema/schema.gql` | Future create | Business records, ledger and document chunks |
| `dataconnect/connector/` | Future create | Scoped reads and guarded transitions |
| `functions/src/` | Future create | Two AI entry points and separate action commands |
| `data/seed/` | Future create | Inventory seed and corpus ingestion |
| `tests/` | Future create | State, concurrency, permission and retrieval proof |
| `docs/synthetic-knowledge/` | Created documentation | Clearly labeled synthetic procedure corpus and evaluation |

## Existing Patterns to Reuse

No application code exists. Use Firebase generated SDKs, Auth, callable functions and Hosting as documented in the [research](../../docs/01-research-and-recommendation.md). The [README](../../README.md) links this specification for later implementation.

## Constraints

Planning only. One Angular SPA, one small server package and one database. SQL Connect/pgvector remains the proposed default; resolve a mandatory Firestore requirement before implementation. Do not build an agent swarm or generic workflow engine.

PDF preload and HQ upload/review/replacement/deletion are in scope. The design handoff includes a sample PDF; canonical corpus export/ingestion is still implementation work.

Out of scope: OCR, complex-layout/table/diagram extraction, automated replenishment targets, pack rounding, partial fulfillment, production aggregation, damage claims/report submission, replacements, refunds, discrepancy stock adjustments, external messages, carrier booking, packing optimization and PDF content editing. Recording dispatch/receipt is in scope; physically moving goods is represented by explicit simulated operator confirmations.

## Open Questions

- [x] Two use cases: complete two-unit replenishment; separate damaged-delivery guidance.
- [x] Synthetic internal documents are necessary and authorized for this demo.
- [x] Use real Not Bad Stuff products and the three user-confirmed salons.
- [x] SQL Connect/pgvector is the implementation baseline; a mandatory Firestore requirement would need an explicit design change.
- [ ] Select English or Polish stage prompts after retrieval rehearsal.
- [ ] Before a real pilot, validate inventory source, roles, unit-transfer rules and owner-approved procedures.

## Acceptance Criteria

- [ ] Approved batch, document management, low-stock and PDF-highlight acceptance checks pass.
- [ ] Golden path exactly matches every row in the stock-state table; requested/dispatched/received all equal 2.
- [ ] Approval only reserves; dispatch reduces HQ stock; receipt increases salon stock. Total accounted units remain 20.
- [ ] Duplicate/retried approve, dispatch and receipt produce one effect each; out-of-order transitions fail.
- [ ] Concurrent approvals cannot oversell; concurrent duplicate requests cannot create two active actions.
- [ ] Ambiguous product/quantity prompts clarification; insufficient stock blocks full approval.
- [ ] Damaged or incomplete receipt cannot silently become a full intact receipt.
- [ ] Damaged-delivery guidance is a separate read-only example with no stock or request changes.
- [ ] All eight positive retrieval cases in the corpus README return required evidence within the retrieved top three; unsupported questions abstain and retired/foreign/injected content is handled as specified.
- [ ] A cited passage opens the correct immutable PDF version at the extracted physical page with the cited region highlighted; unauthorized/revoked source access fails.
- [ ] Scanned, encrypted and malformed inputs cannot be published silently; reviewed PDF extraction matches the original; failed/partial ingestion preserves the active version.
- [ ] Answer source IDs exist, displayed text supports claims, and the synthetic label appears on answers and source cards.
- [ ] Salon/HQ/business permissions hold at UI data, callable and retrieval boundaries.
- [ ] Manual replenishment remains usable during AI failure; unsupported guidance does not fabricate instructions.
- [ ] Ten complete rehearsals validate correctness and record latency; the two-use-case demo fits six minutes with a labeled recording fallback.

## Deployment

Classic Firebase Hosting is confirmed for the Angular SPA. Follow the [deployment specification](firebase-hosting-deployment.md) for public build configuration, SPA routing, preview/live releases and rollback. Backend services deploy separately; frontend releases do not seed/reset data. Phase 4 implements configuration and phase 7 proves deployment.

## Phased agent handoffs

Implementation tasks are split in [the phase index](../../docs/implementation/README.md). Each task reads the shared contracts, its phase specification and prerequisite completion reports. The presenter uses the separate [Firebase setup guide](../../docs/06-firebase-setup-guide.md). These refine the requirements above; they do not indicate implementation has started.
