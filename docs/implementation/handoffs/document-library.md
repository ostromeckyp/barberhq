# Document library — deployed handoff

20 October 2026. **Increment 3B is READY for the demo and the subsequent AI work**, with the evidence boundaries recorded below. Tasks 3A/3B are implemented, independently reviewed and deployed to [foundation preview](https://notbad-6be95--foundation-unesffgt.web.app/procedures?tab=documents), renewed through 26 October. No additional owner configuration is required for this library slice.

## Available behavior

- HQ workspace: paginated document/version list, new PDF upload, replacement from any version row, durable processing status and retry, original PDF plus extracted text, explicit every-page review, publication and version withdrawal.
- Salon workspace, including HQ acting for a salon: published documents only, with read-only source access. Management requires switching back to HQ.
- Originals remain private in Storage. SQL Connect stores immutable metadata, extraction, progress, audit and vectors. Publication changes the active version; replacement does not remove the previously published version while extraction/review is pending. Withdrawal clears the active pointer without reactivating an older version and retains private originals/audit.
- Responsive cards use available content width; desktop columns share alignment. New loading indicators use the existing delay. A published review is read-only and does not display stale local review coverage or a queued-publication message.

The feature follows existing Angular data-access and scoped signal-facade boundaries: library, upload and review orchestration are separate from presentation components and the shared PDF renderer. No browser-to-PostgreSQL connection or browser-held backend credentials were introduced.

## Verified against the real preview

An existing signed-in HQ session completed registration → PDF upload → queued extraction → explicit page review → publication → replacement → publication → historical PDF reload → withdrawal. Publication remained disabled after only one of two physical pages had been reviewed. Processing continued after leaving the review page.

The workflow reused the exact owner-approved CAT-001 v1 (two pages) and DAM-001 v2 replacement fixture (one page). No new unreviewed PDF was generated or automatically approved. They were uploaded under a separate test document, `not-bad-stuff-demo:DOC-D84E626C962C4E83A96EC0ABF4B87956`, versions `v1` and `v2`. Canonical DAM-001 v2 was never created or activated.

Both test versions were withdrawn after acceptance. The document has no active version; both original byte hashes and Storage generations remain intact, anonymous downloads return 403, and six completed command audit operations remain. Returning to the withdrawn source shows access denied and renders no PDF canvas. The UI metadata guard was exercised; a separate authenticated raw-PDF revocation request was not part of this check.

The four canonical documents remain current with 13 retrieval-eligible chunks. A canonical deep comparison confirms existing knowledge and stock unchanged: 24 inventories, four replenishment requests, two active requests, two transfers, three transfer items, five movements and ten stock action receipts. Comparison SHA-256: `fd99defbf4433728c7909b27e3c88478314883fc650552ed3e2dd26657eaf168`. Raw JSON hashes differ only in object-key order; recursive canonical equality passed.

HQ salon-context read-only UI was checked before management. Desktop 1280px, midwidth 800px and mobile 390px layouts were checked; measured content had no horizontal overflow or clipped action controls. Dedicated SALON-account checks were subsequently completed on 20 October as recorded below.

Evidence is retained under ignored `artifacts/library-cloud/`: `baseline-verification.json`, `published-v1.json`, `replacement-extracted.json`, `published-v2.json`, `withdrawn-current.json`, `fixture-state.json` and `final-verification.json`.

## Verification and deployment

- Controller: final Angular suite **21 files / 89 tests passed**, root TypeScript check passed, production build passed and verified 57 public files. Three independent UI correction reviews ended without blocking findings.
- Compatible schema/browser connector deployment succeeded; no new SQL migration was required in this slice. Existing server/vector/stock endpoints were preserved.
- Final Hosting build SHA-256: `ad68b094e44d8438d555ff8358d64970b002cb31fdf3d700f4daff5691c0b6df`. Existing `foundation` channel deployment succeeded. Hosted route/asset check passed: three routes and four selected assets. Final published-review smoke shows the actual PDF/text and the read-only Published notice.
- Public-only build input: `artifacts/library-public-config.json`, with `knowledgeEnabled=true`, existing replenishment flag preserved, and both AI flags disabled. Private local configuration was neither read nor changed.

Rebuild with Node 22:

```sh
node --import tsx scripts/config/build-web.ts --config artifacts/library-public-config.json --project notbad-6be95
node_modules/.bin/firebase hosting:channel:deploy foundation --project notbad-6be95 --expires 7d --non-interactive
```

Known non-blocking observations: initial bundle remains 544.92 kB against the 500 kB warning budget; library and review are lazy-loaded. The standalone Storage verifier emitted a Google SDK `MaxListenersExceededWarning` while all assertions passed. Unknown-upload recovery uses imprecise registration wording, but retains the correct same-version upload retry. The pre-existing source viewer displays raw permission-denied details for withdrawn sources.

## Remaining phase boundary

Increment 3B demo acceptance is complete: the local Task 4 checks below cover reset preservation and source revocation; dedicated SALON-account checks, deployed late/repeated delivery and deployed SQL conflicts passed on 20 October. These are complementary checks with different boundaries, not a single hosted concurrency test. An active lease race between real Cloud Tasks workers and a new authenticated raw-PDF read after withdrawal were not separately exercised. The RAG assistant and generated answers are a later phase; this library prepares and governs their source material.

## Upload refinement and Task 4 local acceptance — 19 October

New, replacement and resumed uploads share a single-PDF drag/drop zone and a native Browse button. Both paths use the same typed facade selection API and retain PDF/10 MiB validation, immutable registration identity and explicit Submit. Multiple files are rejected. Busy drops cancel browser navigation without changing selection; the clipped input is outside keyboard tab order and its native value resets so the same PDF can be selected again after an invalid drop. The visible Browse button remains keyboard accessible.

Independent review and scoped correction review approved this refinement. Controller verification: **99 Angular tests**, **149 integration tests**, **128 tooling/backend unit tests**, root typecheck and production build passed. Integration ran only against controller-created empty local Auth/SQL emulators with cloud test configuration explicitly unset. Those processes were stopped cleanly; no user imports, exports or cloud reset occurred.

The integrated reset test compares full knowledge metadata/current pointer, pages and review flags, chunks with all 768 vector dimensions, original bytes and a nonempty durable CREATE audit receipt before/after the real operational reset transaction. The source test verifies superseded bytes remain readable, withdrawal clears the active pointer, SQL identity resolution returns null, and the actual HTTP handler denies a new read while retaining originals. This uses deterministic test embeddings/in-memory private Storage; it is not a deployed race or authentication claim.

Hosted smoke now covers six routes including the documents tab, review/source deep links, four entry assets and JavaScript MIME for the PDF worker. Both deployed PDF endpoints pass exact-preview preflight (204) and reject foreign origins (403 with no allow-origin header). Evidence: `artifacts/library-cloud/task-4-local-acceptance.json` and `task-4-cors.json`.

The first full unit run exposed missing type-only enum aliases in pre-existing generated declarations. Running the repository's existing idempotent `postprocessSdkEnums` helper repaired those declarations; no SDK regeneration or runtime logic change was needed. The complete rerun passed 128/128. The initial bundle warning remains unchanged.

The reviewed upload refinement was deployed to the existing `foundation` channel, renewed through 26 October. Its 57-file public build SHA-256 is `7100ec6a80180768729dfad87061d3c62fa360e1c0d9de4ededeadad88b6c0d1`, superseding the first library build above. No backend, IAM, schema, stock or document data was changed by this refinement.

## Dedicated salon authorization — 20 October

The owner signed into Chrome with the salon account. Its workspace selector contained only Legnicka and no HQ option. The library displayed four current documents with Open PDF only; no upload, replacement or withdrawal controls. DAM-001 v1 rendered physical page 1 of 1 through the deployed source endpoint. Direct navigation to the HQ review route redirected to `/no-access`. A new visit to the withdrawn test v2 source returned `PERMISSION_DENIED` at the metadata layer and rendered zero PDF canvases. The browser was returned to the document library. No credentials were read and no data was changed. Proof: `artifacts/library-cloud/salon-browser-acceptance.json`.

Separately, the deployed browser connector passed seven read-only authorization checks with the Admin SDK's explicit SALON/anonymous policy impersonation: four current documents only, current source readable, HQ list/review denied, withdrawn/retired sources denied, and anonymous library denied. No Storage identity or vector data was exposed by the browser result. This tests deployed SQL policies; it does not impersonate a real browser Firebase Auth/App Check session. Separate Admin app instances avoided the SDK's connector cache keyed only by service/location. Proof: `artifacts/library-cloud/deployed-salon-sql-policy.json`.

Raw revoked-PDF HTTP access was not separately invoked: the browser blocked the request at metadata lookup. Concurrent live lease/CAS races remain outside this proof.

## Deployed late and repeated task delivery — 20 October

Three explicitly scoped Cloud Tasks deliveries reached the private deployed `processKnowledgeTask` worker: two PUBLISH deliveries for the already withdrawn test v2 and one late EXTRACT delivery for withdrawn test v1. Each has an exact trace-correlated HTTP 204 receipt from the expected service, region and worker URL. They were enqueued once; verification did not enqueue additional jobs.

The snapshot before and after these deliveries is identical, SHA-256 `79fb721c32d75c8de6b21a636c923a86a483d79b3af8bcb6fad9f5b63cb81636`. Both fixture versions remain withdrawn, their document has no active pointer, and no chunks or stock changes occurred. The four canonical current versions and 13 eligible chunks remain intact. Evidence: `artifacts/library-cloud/deployed-late-delivery.json` and its referenced saved manifest.

This checks real late/repeated delivery after withdrawal. Active lease and simultaneous publication conflicts require the separate SQL transaction suites; these deliveries alone do not establish those behaviors.

## Deployed SQL transactions and regression — 20 October

The three lifecycle suites (`document-commands`, `document-worker`, `document-races`) passed **74/74** against the actual deployed PostgreSQL service. Coverage includes idempotent registration, queue failure/retry intent, duplicate extraction, lease reclamation and stale writes, withdrawal during publication, and two concurrent publication transactions choosing one winner while preserving the older source. Orchestration runs in the test process with deterministic 768-dimensional vectors and an in-memory bucket; these results establish deployed SQL operations/transactions, not hosted HTTP, Vertex inference or an active Cloud Tasks lease.

The test harness is opt-in with a fixed public target, explicit fixture authorization and emulator exclusion. Separate Admin apps keep server and vector connectors distinct. Independent review found cleanup weaknesses before any cloud run; correction and re-review closed them. Only newly generated `test-knowledge-<UUID>` businesses and fake SQL memberships were mutated. No Auth account, canonical document, stock row, schema or IAM policy was changed.

All test teardowns passed. Vitest suppressed successful-test console output, so the run report did not capture fixture IDs. A separate read-only identifier scan checked every row in each relevant table (all below its 1000-row bound) and found no remaining test-namespace businesses, memberships, documents, versions, command operations, pages or chunks. No broad or recovery deletion was performed. Evidence: `artifacts/library-cloud/cloud-sql/lifecycle-tests.json`, sanitized `lifecycle-tests.log` and `cleanup.json`.

Controller regression: **133/133 unit tests**, root typecheck and standalone compilation of the harness/three suites passed. The complete local integration suite passed **149/149** on dedicated empty Auth/SQL emulators after the harness changes. Those processes stopped cleanly without importing or exporting owner data. Evidence: `artifacts/library-cloud/cloud-sql/emulator-regression.json` and its sanitized log.

Hosted UI acceptance uses the real signed-in browser workflows recorded above. The planned automated `tests/e2e/document-library.spec.ts` suite was not created or run; do not cite that command as passing. The browser checks, deployed SQL tests and actual task receipts provide separate evidence rather than one automated end-to-end suite.

The first final snapshot assertion exposed an ordering-sensitive verifier: raw JSON keys inside chunks could change table-row ordering even when values were identical. A second unmodified read matched the original baseline exactly (`0ac7fb9254d18f8436c7bd96bad473c88e06204cb4fbfe8db70a660691a51869`). An offline regression reproduces that false mismatch. The reviewed correction canonicalizes object keys before sorting table rows and normalizes the historical baseline in memory too; it preserves the saved baseline, every field, nested page/chunk order and all vector dimensions.

The corrected read-only cloud verification passed. Both normalized snapshots have SHA-256 `276cd71d44576a687fc7195dc220d4ea46b23b69c5b9a7b202ed84c437c8392c`; the changed hash reflects stable row ordering, with no database changes. An independent offline semantic comparison also passed. Existing totals remain 24 inventories, four requests, two active requests, two transfers, three transfer items, five movements, ten stock receipts, five logical documents (four canonical plus the withdrawn test document) and seven versions. Evidence: `artifacts/library-cloud/cloud-sql/before.json`, `after.json`, `snapshot-key-order-regression.mjs` and the aggregate `artifacts/library-cloud/increment-3b-acceptance.json`.


## 27 October production continuation

[Fresh technical checks](../hosted-technical-gates-2026-10-27.md) verify HQ upload/extraction/review/withdrawal on production using a separate synthetic fixture, direct SALON review denial, hidden unreviewed content and denied revoked-source metadata. Four canonical current documents, pre-existing knowledge/original metadata and all demo stock were preserved. Fixture DOC-152F5EC7E905430D809207321B90E3DA:v1 was never published and remains withdrawn with its original/audit retained. Protected canonical PDF now also renders in the existing Chrome HQ preview session; prior preview reCAPTCHA failure did not reproduce there. Existing19–20Oct SQL/task/publication proof is retained; no new active real-worker lease race or authenticated raw-PDF-after-withdrawal assertion is implied.
