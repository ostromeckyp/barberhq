# BarberHQ — incremental delivery design

> Supersession (8 October 2026): request grouping, recovery journals, salon navigation and settings now follow [the approved whole-request plan](../plans/2026-10-07-replenishment-requests-and-salon-settings.md) and [current contracts](../../implementation/shared-contracts.md). Historical acceptance evidence below is retained; future AI drafts must submit through the current one-request items[] contract.


**29 September 2026 · Architectural brainstorming · Written design accepted for implementation planning.**

The user approved the delivery approach and all five increments in conversation. The user subsequently invoked `superpowers:writing-plans` after receiving this document, authorizing the planning transition. The [execution index](../plans/2026-09-29-barberhq-execution-index.md) now links the detailed plans awaiting review. No application code, canonical PDFs or cloud resources have been created by this work.

## Intent and success

Build a small, credible application for a 20-minute DevFest talk about business-aware development. Demonstrate two outcomes in approximately six minutes: complete a two-unit salon replenishment and answer a damaged-delivery question using cited PDF evidence. Preserve the approved Claude Design extensions and Angular Material handoff.

Real context: Not Bad Stuff and salons Legnicka, Łódzka and Zakładowa. Product facts use the existing six-product snapshot. Inventory, delivery scenarios and internal procedures are explicitly synthetic. The user confirmed that no Firebase project exists yet.

Success means a deployed application whose quantities, permissions and citations can be checked, plus repeatable demo preparation and accurate slide Markdown. Production rollout and measured business savings are not claimed.

## Sources and authority

- [Master specification](../../../.claude/specs/barberhq-master.md): product scope and relationships.
- [Shared contracts](../../implementation/shared-contracts.md): names, states, quantities and cross-component interfaces.
- [Approved design extensions](../../../.claude/specs/approved-design-extensions.md): multi-product drafts, HQ document management, low-stock marking and PDF highlighting.
- [Architecture](../../05-architecture-how.md): transactions, authorization and knowledge processing.
- [UI inventory](../../design/views-and-states.md) and [Claude Design handoff](../../../design_handoff_barberhq/SPEC.md): views, states and visual implementation reference.
- [Presenter setup guide](../../06-firebase-setup-guide.md) and [Hosting specification](../../../.claude/specs/firebase-hosting-deployment.md): configuration and deployment requirements.

This document owns the newly approved **execution sequence**. Existing phase specifications remain requirement packages; their numbers no longer require finishing an entire technical layer before another begins. This design supersedes their whole-phase scheduling prerequisites only where the mapping below explicitly splits the work. Business contracts and acceptance criteria remain binding. A partial increment must not be reported as completion of an entire original phase.

## Approach and alternatives

**Selected: small working increments across UI, backend and storage.** Each increment proves a user-visible result using real integrations. Start Hosting early, complete manual replenishment before AI, and prove PDF extraction-to-highlight before expanding document administration.

Alternatives considered:

1. Complete backend, ingestion and frontend layers in order: clear ownership, but delays integration feedback.
2. Complete the frontend against mock data first: fast visual progress, but delays verification of permissions, transactions and document contracts.

The selected approach changes delivery order without removing approved scope. Fixtures and PDF preparation can proceed locally while the owner prepares cloud access; this does not require parallel agents.

## Architecture and boundaries

One Angular SPA on classic Firebase Hosting uses Firebase Auth and generated Data Connect GraphQL read interfaces. Cloud Functions expose explicit stock commands, document commands, authorized PDF serving and server-side Genkit flows. PostgreSQL holds business records and scoped knowledge text/vectors; private Storage holds immutable source PDFs.

| Unit | Responsibility and interface | Dependencies |
|---|---|---|
| Angular UI | Authenticated views, shared draft, explicit actions, PDF viewer | Auth, generated reads, typed backend contracts |
| Business backend | Submit, approve/reject, dispatch and receive; atomic guards and retry protection | Auth/App Check, SQL membership and transactional operations |
| Data preparation | Validated catalog, fictional stock and reviewed synthetic PDFs | Existing repository sources; no cloud needed for preparation |
| Knowledge pipeline | Extract, review, chunk, embed and publish; operator and queued HQ entry points share processing code | Private Storage, knowledge schema, embedding access |
| Source endpoint and viewer | Authorize an exact PDF version and highlight extraction-derived coordinates | Membership, document metadata, original bytes, PDF.js viewport mapping |
| Replenishment agent | Resolve intent using bounded read tools; return draft lines | Catalog, live stock and active requests; existing manual draft contract |
| Procedure RAG | Retrieve authorized current chunks and return supported guidance with sources | Reviewed corpus, query embeddings and Gemini |

AI does not mutate stock. The browser never connects directly to PostgreSQL or receives backend credentials. Storage denies direct browser access; authorized server endpoints handle PDF upload/read. No Firestore, SSR, App Hosting, persistent chat, OCR or generic CMS is added.

## Increment 1 — sign in and read real data

### Owner and agent responsibilities

The owner creates the dedicated Firebase project, supplies billing/account choices and enables the agreed authentication provider with demo identities. The agent prepares actionable setup instructions and the application configuration. Verify compatible service locations before provisioning; provision Storage and model access when increment 3 needs them.

The agent establishes the Angular/Material shell from the handoff, Auth, the minimal business schema, scoped GraphQL reads and generated SDK. Prepare and load six products, HQ plus three salons, fictional initial inventory and user memberships. Reuse stable fixture IDs and the existing catalog rather than scrape again by default.

Prepare ignore rules before private UID mappings or local setup records are written. Separate public build-time settings from secrets. Integrate applicable App Check configuration and verify protected requests as those endpoints are introduced; do not defer data authorization to final rehearsal.

Deploy the sign-in and inventory views to classic Firebase Hosting. This first release needs no stock-changing commands or knowledge tables. Whole-phase requirements to configure vector dimensions or ingest documents do not block this increment.

### Completion evidence

- Legnicka signs in and sees its actual SQL inventory, including two Matowa units; initial HQ quantity is 18.
- Unassigned users and unauthorized salon/business reads are denied by backend operations, not only hidden UI.
- A direct application URL survives refresh on Hosting; sign-out removes protected UI state.
- Loading, empty data, request failure and retry are distinct; a failed read never appears as zero stock.
- Repeating the structured seed preserves existing operational changes.

## Increment 2 — complete manual replenishment

Add the manual multi-product draft, HQ queue, request detail/timeline, rejection with reason and explicit submit/approve/dispatch/receive commands. Keep one persisted request per product. Low stock is a visible indicator at salon on-hand ≤2, not an automatic ordering rule.

| Action | HQ on-hand | Reserved | In transit | Legnicka on-hand |
|---|---:|---:|---:|---:|
| Submit two Matowa units | 18 | 0 | 0 | 2 |
| Approve | 18 | 2 | 0 | 2 |
| Dispatch | 16 | 0 | 2 | 2 |
| Confirm full intact receipt | 16 | 0 | 0 | 4 |

Reservation is part of HQ stock, not additional stock. Approval leaves 16 available. Total accounted physical units remain 20.

Commands enforce membership, state/revision guards, availability, idempotency and atomic stock effects. Prove critical transactional expressions early in this increment before completing all related screens. Use the existing architecture's narrowly scoped Native SQL fallback if needed; never weaken invariants to fit a connector.

Batch submission uses per-line results and stable retry keys. Partial batch success does not introduce partial fulfillment of an individual request. Lost responses are reconciled before continuing uncertain submissions; stale data triggers refresh and a clear message. A shortage may warn during preparation, but approval enforces available stock.

### Completion evidence

- The deployed manual flow ends with requested/dispatched/received two, HQ16, Legnicka4 and transit0; the low-stock marker disappears.
- Multi-product submissions report independent outcomes and recover without duplicate requests.
- Real integration checks prove concurrent approval cannot oversell, retries cannot duplicate stock movements and failed guarded writes roll back.
- Unauthorized and out-of-order actions fail; rejection preserves stock.

## Increment 3 — traceable PDF knowledge and document management

Split this increment into two small implementation plans sharing one pipeline.

### 3A: one PDF through the complete path

Prepare and visually review canonical synthetic DAM-001 v1. The handoff's sample PDF remains a design reference; do not assume its version, text or page coordinates match. Provision private Storage, source-serving runtime and embedding access. Verify and pin the embedding model, dimension and supported configuration before defining/compiling vector fields or creating vectors.

Store immutable PDF bytes, extract page-aware text/Markdown with a separate geometry map, review every page, create page-local chunks, embed and publish to PostgreSQL. Preserve exact version, hash, physical page and extraction-derived rectangles. Authoring Markdown must not bypass PDF extraction.

Serve the original through an authorized endpoint. Open a known stored chunk in the Angular PDF viewer using `/procedures/sources/:versionId?page=N&chunk=CHUNK_ID`. Use actual viewport transforms for zoom/rotation; no coordinates generated by Gemini. A missing rectangle produces an explicit page/excerpt fallback, but rehearsed citations must have verified highlights.

Local extraction/geometry checks may happen earlier during data preparation. End-to-end cloud publication follows provisioned resources. This first checkpoint uses a known citation, not generated RAG advice.

### 3B: complete the corpus and HQ workflow

Prepare the full initial five-PDF corpus and separate replacement fixture. Four initial versions are active; retired DAM-001 v0 remains a negative retrieval fixture. Preserve provenance labels and keep evaluation answers outside the corpus.

Add the document library, HQ upload, processing status, page/text review, publication, replacement, retry and withdrawal. Use the shared bounded task-queue worker with durable progress. Salon users can read permitted documents; only HQ can manage them.

Failed or incomplete replacement preserves the previous active version. Publication requires review and successful embedding, with revision/revocation checks. Deletion withdraws future access/retrieval and retains private originals/audit; the confirmation must explain this. Never silently fall back to an older policy. Superseded published citations remain readable unless revoked.

### Completion evidence

- Version/page/chunk identity and multiline highlighting survive direct navigation, zoom, rotation and mobile layout.
- Source and management endpoints reject unauthorized calls, including direct requests outside the UI.
- All corpus pages have recorded visual/extraction review and matching source hashes.
- Retried jobs do not duplicate publication; concurrent replacement/deletion cannot revive revoked evidence.
- Scoped vector retrieval returns eligible evidence and excludes retired, incomplete or foreign records before model generation is introduced.

## Increment 4 — two independent AI flows

Plan 4A and 4B separately; neither requires the other. Both build on working manual/document contracts.

### 4A: replenishment preparation

The Genkit/Gemini agent interprets natural language, resolves one or several products and uses bounded tools for catalog, inventory and active-request reads. Verified draft lines populate the same editable manual basket. Ambiguity prompts clarification, existing active requests are identified, and the user explicitly submits.

Model failure or quota exhaustion leaves manual preparation usable. Existing shared timeout, tool-call and usage limits apply; this increment introduces no autonomous stock commands.

### 4B: procedure RAG

Embed the question, retrieve authorized current nonrevoked document chunks and send their readable text to Gemini. Validate returned source identities and provide PDF links with verified highlights. Insufficient evidence produces a clear abstention. Recheck source eligibility before returning an answer if documents changed during generation.

Keep the damaged-delivery fixture separate from the intact replenishment scenario. The response does not file a claim, promise replacement or modify inventory.

### Completion evidence

- Natural-language requests prepare exactly two Matowa units and a multi-product basket using live records.
- Ambiguous inputs and model failures have usable outcomes, without stock/request changes from preparation alone.
- Damage guidance is supported by actual retrieved passages; a human checks every rehearsed instruction, not just citation IDs.
- Unsupported questions abstain and excluded documents never enter model context.
- Limits are exercised. English is the default; Polish stage prompts are used only if evaluation supports them.

## Increment 5 — complete and rehearse the release

Finish any remaining approved UI states and verify desktop/mobile layouts and keyboard operation. Each earlier increment owns its immediate error states and access checks; this is integrated verification, not a deferral of correctness.

Provide and verify an explicit operator-only reset for demo operational records, preserving published knowledge. Use the existing scoped reset mechanism, not a second reset implementation or an ordinary staff menu.

Check preview/live configuration, Auth/App Check, source endpoints, direct links, release promotion and frontend rollback. A frontend rollback does not revert database contents. Backend/schema deployment stays separate from Hosting.

Run both deployed scenarios after reset, repeat, and time the demonstration. Update the slide Markdown and presenter runbook to describe only verified behavior, including a clear way to continue the presentation if a live dependency fails.

### Completion evidence

- Both scenarios pass on the final Hosting release and can be repeated after reset without breaking citations.
- Deployment/rollback and all approved extension checks have recorded outcomes.
- The live demo fits six minutes within the 20-minute talk.
- The readiness report lists material limitations and distinguishes local, emulator and deployed checks.

## Mapping to existing requirement packages

| Original package | Where its requirements are implemented |
|---|---|
| 0 — Owner setup | Increment 1: project/Auth/database/Hosting; increment 3: Storage/embedding/worker; increment 4: reasoning-model access; increment 5: final configuration checks |
| 1 — Data and PDFs | Increment 1: catalog and stock fixtures; increment 3A/3B: reviewed PDFs, manifest and replacement fixture |
| 2 — Backend | Increment 1: business schema/auth/reads; increment 2: stock transactions; increment 3: knowledge schema/document/source APIs; increment 4: shared AI limits/configuration |
| 3 — Seed and ingest | Increment 1: structured seed/memberships; increment 3: PDF pipeline/worker; increment 5: verified reset and replay |
| 4 — Angular | Increment 1: shell/login/inventory/Hosting; increment 2: replenishment views; increment 3: library/viewer; increment 5: full UI review |
| 5 — Replenishment agent | Increment 4A |
| 6 — RAG | Increment 4B |
| 7 — Readiness | Increment 5; deployed integration evidence accumulates from increment 1 |

## Planning and handoff contract

After written-design approval, use `superpowers:writing-plans` to create a small master execution index and bounded plans for increments 1, 2, 3A, 3B, 4A, 4B and 5. The master is a dependency/coverage map, not one giant implementation task. No execution method or automatic agent delegation has been selected yet.

Each plan must specify concrete files, small ordered tasks, prerequisites, owner setup steps, meaningful checks and handoff outputs. Read only relevant sections of the original requirement packages. Package/model versions and cloud capabilities must be verified when selecting the concrete implementation; this design does not assert they have been tested.

Reports belong under `docs/implementation/handoffs/increment-<id>.md`. Record implemented scope, actual versions/contracts, public configuration, validation results, remaining limitations and the next context pack. Include original requirement IDs or numbered acceptance items covered. Keep secrets and private UID mappings out of reports.

`READY` means the selected increment's acceptance checks passed, including required cloud checks; `BLOCKED` identifies missing prerequisites and completed independent work. Never mark the whole original phase ready using only one partial report. The final coverage review checks every original phase criterion and approved extension.

## Risks and decision handling

| Risk | Planned response |
|---|---|
| No Firebase project/access yet | Separate owner setup; complete independent fixture/configuration preparation locally; do not claim deployed proof |
| Transaction guards unsupported as first expressed | Verify early in increment 2; use the specified narrowly scoped SQL fallback and update the contract explicitly |
| PDF text and highlight geometry diverge | Prove a real PDF-to-viewer path in 3A before broadening administration; unsupported documents remain unpublished |
| Model or region unavailable | Verify before provisioning dependent pieces/pinning schema dimensions; never mix embedding configurations silently |
| Scope overwhelms the stage demo | Implement approved extensions, but keep the main rehearsal focused on the two agreed business outcomes |

No unresolved business decision blocks this written-design review. Technical choices are explicit verification tasks for the relevant plans, not permission to weaken requirements.

## Review and next gate

- Context, approach and all five increments: approved in conversation.
- Written design: accepted for planning through the user’s explicit writing-plans request.
- Detailed implementation plans: written and awaiting review; execution method not selected.
- Implementation/cloud provisioning: not started.

The workspace is not currently a Git repository, so this design cannot be committed here yet. Repository initialization belongs to the future implementation setup; no repository was created merely to record this document.
