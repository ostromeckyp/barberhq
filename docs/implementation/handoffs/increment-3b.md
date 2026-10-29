# Increment 3B — document corpus and library

Status (20 October): **READY for the demo and the next AI phase.** HQ lifecycle, dedicated SALON browser/SQL policy checks, actual late/repeated Cloud Tasks delivery, 74 deployed SQL lifecycle/conflict checks and 149 local integration checks passed. Test data was removed; the existing corpus and stock remain unchanged. See the [current library handoff](document-library.md) for evidence and limits: SQL tests use local orchestration/deterministic embeddings/in-memory Storage, and hosted UI acceptance was performed in the real signed-in browser rather than the planned automated library E2E file. The dated sections below retain earlier deployment history; their pending statements are superseded by the current handoff.

15 October 2026. Five initial PDF versions are now privately stored, extracted, reviewed and embedded in the existing Firebase project. Four are published/current; retired DAM-001 v0 remains inactive. The separate DAM-001 v2 replacement fixture remains local. Existing approved DAM-001 v1 bytes, extraction, generation, publication time, revision and active document pointer are unchanged. The local preparation on 14 October performed no cloud operations; this continuation applied the reviewed additive schema change and deployed schema/server/vector operations. Functions and Hosting were not redeployed.

## Owner review

Owner explicitly approved all six new physical pages: “Zatwierdzam wszystkie 6 stron do demo”. Recorded on 15 October 2026; exact original approval time was not captured. Approval means suitability and readability for the DevFest demo, not official company-policy approval. Identity-bound review receipts are stored under `data/knowledge/reviews/`; retired v0 and replacement v2 approval does not authorize activation.

| PDF | Pages | Intended use |
| --- | ---: | --- |
| [DIS-001 v1](../../../data/knowledge/pdfs/DIS-001-v1.pdf) | 1 | Synthetic instructions for missing/wrong products |
| [REP-001 v1](../../../data/knowledge/pdfs/REP-001-v1.pdf) | 1 | Synthetic explanation of replenishment and full receipt |
| [CAT-001 v1](../../../data/knowledge/pdfs/CAT-001-v1.pdf) | 2 | Unofficial six-product compilation from the 22 September snapshot |
| [DAM-001 v0](../../../data/knowledge/pdfs/DAM-001-v0.pdf) | 1 | Retired negative fixture; exclude from current guidance |
| [DAM-001 v2](../../../data/knowledge/replacements/DAM-001-v2.pdf) | 1 | Separate replacement test fixture; no automatic activation |

The five initial inputs include the unchanged [DAM-001 v1](../../../data/knowledge/pdfs/DAM-001-v1.pdf), which already has owner approval. The replacement is outside that initial manifest.

The [corpus review record](../../../data/knowledge/reviews/corpus.md) records exact PDF identities, rendered-page hashes, extraction hashes, toolchain and source boundaries. All seven pages were independently inspected by the controller without clipping or overlap. All six PDFs returned COMPLETE from the application parser. CAT-001 has two chunks with unavailable highlight geometry; page-level citation fallback remains available.

## Verification

- Controller: six focused unit files / 21 tests passed; root TypeScript check passed.
- Export checks preserve all six PDFs, both manifests and all six provenance records on repetition; changed authoring source is rejected.
- DAM-001 v1 PDF SHA-256 remains `b6f877bd6ed8842e9b5e9fd1c679bf1d05322fae8dcad86a7deb7836b52f1edd`.
- Independent task review and scoped re-review: approved; README and CAT metadata corrections verified. Final metadata type guard passed controller TypeScript and focused corpus checks.

## Cloud acceptance — 15 October 2026

| Version | Processing | Publication | Chunks |
| --- | --- | --- | ---: |
| DAM-001 v1 | READY | Current/active; original identity retained | 4 |
| DIS-001 v1 | READY | Current/active | 3 |
| REP-001 v1 | READY | Current/active | 3 |
| CAT-001 v1 | READY | Current/active; factual compilation | 3 |
| DAM-001 v0 | READY | RETIRED; inactive and unpublished | 2 |

Cloud target: `notbad-6be95-service/europe-west3`; originals: `notbad-6be95.firebasestorage.app`. The five versions belong to four logical documents. PostgreSQL holds 15 vectors of 768 dimensions from `gemini-embedding-001`, including two inactive retired-fixture vectors. Only 13 current chunks are eligible for retrieval.

The migration added enum `KnowledgePublicationStatus` and `knowledge_version.publication_status`, with a compatible `DEMO_CURRENT` default. Stage binds canonical document/version identities and persists manifest classification. Both pipeline and compiled publication reject retired versions. Both vector query definitions filter publication classification before similarity top-k while retaining existing scope/readiness/active/revocation/model checks.

Controller checks:

- 14 focused unit checks, 36 knowledge/source/vector integration checks, root typecheck, Functions build and cloud-target schema compilation passed. Independent backend review and scoped correction review passed. Temporary empty SQL/Auth test emulators were stopped cleanly; no user emulator exports were imported or overwritten.
- All five Storage originals match approved SHA-256 identities, contain reviewed COMPLETE pages and correct provenance, and return 403 to anonymous download requests.
- The deployed compiled publication operation rejects retired READY v0 with `NOT_READY`; its state and current DAM-001 pointer remain unchanged.
- Actual Polish damage-query retrieval returns three current passages, including DAM-001 report/intake; no retired fixture. The deployed compiled `SearchKnowledgeChunks` operation matches repository-query results. A nonexistent-business search returns no hits; foreign-fixture filtering was separately tested locally.
- Repeating all five stages and four already-current publications preserves revisions, active pointers, extraction/PDF identities and Storage generations. v2 has no SQL version and was not imported.
- Exact inventory/request snapshot comparison is unchanged: 24 inventory rows, 3 requests, 1 active request row, 2 transfers, 3 transfer items, 5 movements and 9 action receipts. Canonical snapshot SHA-256: `31868efc5c19bc7c1530c106efddb079a9b08a40b5fd1f1b4d7d0b8a23de7e8f`.
- Existing signed-in HQ preview opened CAT-001 page 2 and rendered the actual PDF with “Public product summary”. Screenshot: `artifacts/corpus-cloud/catalog-page-2.png`. This is a source-viewer smoke check, not a new library or generated RAG answer.

Proof records: `artifacts/corpus-cloud/verification.json`, `compiled-search.json`, `idempotency.json`, `stock-before.json`, `stock-after.json`, `migration-review.txt`. The standalone download verifier emitted SDK `MaxListenersExceededWarning` messages while validating Storage bytes; all hash/authorization assertions passed. No warning suppression or dependency workaround was added.

## Remaining work

Task 1's retired-version backend prerequisite and deployed corpus acceptance are complete. CAT-001's two chunks with unavailable span geometry retain the documented page-level fallback. The replacement fixture is approved for later tests, not activated.

Those lifecycle and library slices were subsequently completed; the dated progress below records their deployment sequence. Follow the [3B implementation plan](../../superpowers/plans/2026-09-29-barberhq-03b-document-library.md); do not mark 3B READY until the remaining Task 4 checks pass.

Task 2 local backend completed on 16 October 2026: registration/withdrawal, bounded PDF upload, durable queue dispatch/retry, complete-history cursor backfill, leased EXTRACT processing, HQ review/PUBLISH, runtime adapters and narrow packaging passed independent review gates. Final controller verification: six knowledge integration suites **110/110**, full unit suite **125/125**, SDK generation, typecheck and Functions build. The real isolated package installs and imports successfully with exactly six new exports; its task metadata confirms region, timeout, retry/backoff/concurrency and restricted invoker.

The owner subsequently approved the [concrete backend deployment](../lifecycle-deployment-review.md). The reviewed knowledge migration, schema/server/vector connectors, four allocation cursors, Tasks API, runtime self-act-as permission and six new Functions were deployed. Existing browser connector and stock endpoints were preserved. Before/after canonical snapshots are deeply equal apart from the intentional new cursor fields; proof: `artifacts/lifecycle-cloud/baseline-verification.json`.

On 19 October, read-only cloud checks confirm the worker is ACTIVE with the dedicated runtime account and 300-second timeout. The queue grants Enqueuer to that runtime account. Firebase CLI 15.32.0 failed while reading an initially empty queue IAM bindings array; the exact queue-specific binding was applied separately. HTTP checks pass **5/5**: anonymous worker 403, exact preview-origin upload preflight 204, foreign-origin preflight 403, anonymous upload 401 and anonymous callable 401. Proof: `artifacts/lifecycle-cloud/http-access.json`. These checks do not establish authenticated upload, extraction or publication through the UI; those remain pending.

At that checkpoint, Angular data access was undergoing review and library components were pending. The later authenticated UI results supersede this checkpoint; see the [library handoff](document-library.md).

The extraction lease lasts 360 seconds and all writes check the attempt revision, lease token and PDF hash. The intended queue retry backoff is at least 360 seconds, with a 300-second worker timeout, three attempts and two concurrent dispatches. A successful extraction stops for explicit every-page human review; stale publication never substitutes a new document revision automatically. The concrete owner/deployment checks are in [document worker setup](../document-worker-setup.md); full 3B readiness still requires the remaining Task 4 acceptance.
