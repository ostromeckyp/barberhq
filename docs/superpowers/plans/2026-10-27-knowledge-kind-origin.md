# Knowledge document kind and origin — increment1 implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan inline. Steps use checkbox (`- [ ]`) syntax for tracking. Preserve the owner's existing Native execution preference; one independent final review.

**Goal:** Implement independent document kind and origin throughout the library, ingestion and procedure retrieval, with a repeatable metadata migration and existing PDF/citation identities preserved.

**Architecture:** Add canonical `kind`/`origin` fields; read old rows through a strict compatibility adapter until backfilled. Keep legacy storage fields during this increment, while new application contracts derive synthetic labels from origin. Deploying this schema/backend/frontend is a coordinated, separately approved operation; implementation and verification here are local.

**Tech Stack:** Existing Angular22.2/Material, TypeScript, Zod, Firebase Auth/App Check, SQL Connect/PostgreSQL, existing Vertex embeddings and Genkit procedure flow. No new dependency.

**Spec:** [Product knowledge and dictated replenishment](../specs/2026-10-24-product-knowledge-and-dictated-replenishment-design.md), increment1 and its Decisions section.

**Authority/status:** On27 October the owner explicitly deferred the three remaining demo-acceptance groups and instructed moving to expansion. This plan implements only increment1. Approved by the owner and implemented locally on27 October under Superpowers executing-plans; the existing design decisions are reused, not reopened. No deployment, migration apply or resetting cloud data is authorized by this file.

## Global constraints

- Use the existing Angular/Material, Firebase Auth/App Check, SQL Connect/PostgreSQL and server-side Genkit/Gemini stack.
- Preserve the AI budget:25 seconds,5 model turns,8 tool calls. No new model call or changed model/retrieval threshold.
- No stock mutation by the assistant; preserve request/receipt/issue workflows and server-derived business scope.
- GraphQL kinds: `PROCEDURE`, `POLICY`, `PRODUCT_CARD`, `PRODUCT_CATALOG`; origins: `OFFICIAL`, `PUBLIC_COMPILATION`, `SYNTHETIC`.
- Public TypeScript values use existing kebab-case conventions: `procedure|policy|product-card|product-catalog` and `official|public-compilation|synthetic`. Fields are named `kind` and `origin` consistently.
- Procedure retrieval includes **all four kinds**, including product documents; kind filtering occurs in SQL before ranking/LIMIT and in the final source recheck. No client-selected scope.
- No new product names, aliases, types, product-specific examples or matching rules in implementation code/prompts. Existing matcher replacement belongs to increment3.
- No alias generation/review, product links, shorthand learning, two-turn matching or microphone in this increment. Those retain separate plans.
- Preserve IDs, active pointers, document/version revisions, original bytes/hashes/generations, page/chunk geometry, embeddings, review/audit records and saved citation URLs during metadata backfill. Include retired/withdrawn and uploaded test versions, not only the five manifest inputs.
- Preserve dirty/staged owner work. No staging, commit, dependency reinstall, checkout cleanup or emulator reset. Never access private configuration files. Approved public snapshots/examples may configure commands.
- The compact-login work remains local by owner instruction. Verification builds are not authorization to publish it with this increment; record that pre-existing delta separately.

## Review focus

1. A saved pre-upgrade upload has an unknown outcome: retry must retain its original payload/key/hash and recover the same version, never silently upgrade it into another CREATE.
2. A backfilled row is already withdrawn/retired or has an inconsistent legacy flag: classification must not reactivate it, change audit history or guess through contradictory metadata.
3. A synthetic product card or an official policy is uploaded: labels must reflect both properties, never automatically call every synthetic document a procedure or every non-synthetic document a public summary.
4. A product document is the best answer source: it must remain eligible in procedure retrieval after the split; publication/revocation/config/scope guards remain before LIMIT and after generation.
5. A migration repeats, exceeds one result page, or meets an edited row: no duplicate/reclassification or partial blind overwrite; stop on conflict and retain a precise resumable report.

---

## Task 1 — additive metadata helpers and compatible request parser

**Files:** Create `shared/knowledge-metadata.ts`, `tests/unit/knowledge-metadata.test.ts`. Modify `shared/contracts/knowledge.ts`, `functions/src/knowledge/schemas.ts`, `tests/unit/knowledge-command-schemas.test.ts`.

**Interfaces:**
- `KnowledgeDocumentKind` and `KnowledgeOrigin` use the public values above; `KnowledgeMetadata = {kind: KnowledgeDocumentKind; origin: KnowledgeOrigin}`.
- Add `DocumentSourceV2` carrying canonical metadata and derived synthetic. Existing `DocumentSource` stays unchanged until the cohesive Task2 cutover; do not break current consumers in this additive task.
- Add `CreateDocumentInputV2` as the metadata-bearing request and an explicitly defined `LegacyCreateDocumentInput` matching the old payload. `CreateDocumentRequest` is their strict union. Existing `CreateDocumentInput` retains the legacy shape until Task2 switches consumers.
- Add `parseCreateDocumentRequest(value:unknown):CreateDocumentRequest` and `normalizeCreateDocument(input:CreateDocumentRequest):CreateDocumentInputV2`. Preserve existing `parseCreateDocument` for current consumers until Task2 switches them. Legacy mapping never mutates the original request.
- `knowledgePayloadHash('CREATE', request)` retains the exact existing legacy array/hash. New requests use a distinct canonical prefix `CREATE_METADATA_V2`, then title/language/kind/origin/provenance/hash/document/revision fields. URL order still matters; operation key does not.
- Pure helpers in `shared/knowledge-metadata.ts`: `metadataFromLegacy(sourceType:LegacyCreateDocumentInput['sourceType']):KnowledgeMetadata`, `metadataFromStorage(record:unknown):KnowledgeMetadata`, `knowledgeProvenanceLabel(metadata:KnowledgeMetadata):string`, `isSyntheticSource(metadata:KnowledgeMetadata):boolean`.

- [x] **Step1: Write contract regressions.** Assert legacy synthetic→procedure/synthetic; public summary→product-catalog/public-compilation. All12 new kind/origin combinations are accepted when their provenance is valid. PUBLIC_COMPILATION requires1–10 valid http(s) URLs plus a valid observed date for **any** kind in the new parser. Keep the existing legacy parser/hash semantics for frozen retries; enforce the provenance requirement on new legacy registrations, after checking any original replay. Reject missing/unknown enum values, mixed legacy/new payloads, client-supplied synthetic/authority fields and partial classification. Pin an actual pre-change legacy CREATE hash before implementation; assert it remains identical after normalization support. New kind/origin changes produce different hashes.
- [x] **Step2: Run focused tests before implementation.** `npm run test:unit -- tests/unit/knowledge-metadata.test.ts tests/unit/knowledge-command-schemas.test.ts`; expected named new behaviors FAIL, existing cases pass.
- [x] **Step3: Implement the types/helpers/parser/hash.** Storage enum translation is strict. Fallback to legacy metadata only when **both** new fields are null/absent; one missing field, unknown values, or contradictory legacy/synthetic metadata is an error. For a new combination without an exact legacy representation, legacy sourceType must be null. `synthetic` always equals origin===synthetic.
- [x] **Step4: Run the focused tests GREEN, the root unit suite and `npm run typecheck`.** The additive types/parser must leave existing consumers compiling; a transitional type error is a failure, not an expected pass. Do not weaken types or delete coverage.
- [x] **Step5: Record task results in this plan's ledger; no commit.**

**Label decisions:** Preserve “Synthetic demo procedure”; use kind-specific “Synthetic demo policy/product card/product catalog”. PUBLIC_COMPILATION labels are “Unofficial public procedure/policy/product card/product catalog compilation”. OFFICIAL labels are “Official procedure/policy/product card/product catalog”. These labels record HQ-declared provenance, not cryptographic verification of an issuer.

## Task 2 — cohesive classification cutover across storage, API, RAG and UI

**Task boundary:** Parts A–C below are one contract migration and one deliverable. They must not be independently marked complete with broken consumers. Switch `DocumentSource`/`CreateDocumentInput` to their V2 forms, update every producer/consumer and fixture, and keep explicit legacy request/storage adapters. The final gate is all affected code compiling and all unit/Angular/integration cases passing.

### Part A — schema, writes, manifest and repeatable metadata backfill

**Files:** Modify `dataconnect/schema/knowledge.gql`, `dataconnect/server/knowledge.gql`, `functions/src/knowledge/document-commands.ts`, `functions/src/knowledge/pipeline.ts`, `data/knowledge/manifest.json`, relevant ingestion validation in `scripts/ingest/cli.ts`. Create `scripts/ingest/backfill-knowledge-metadata.ts`, `tests/unit/knowledge-metadata-backfill.test.ts`, `tests/integration/knowledge-metadata.test.ts`. Update `tests/unit/{corpus-manifest,pdf-manifest,sdk-enums}.test.ts`, `tests/support/knowledge.ts` and affected document lifecycle fixtures.

**Interfaces:**
- Add nullable SQL `kind:KnowledgeDocumentKind` and `origin:KnowledgeOrigin` for expand/backfill. Retain `sourceType` temporarily as nullable and stored `synthetic` as a compatibility projection. No field/table removal in this increment.
- New writes always populate kind/origin and derive stored synthetic. Populate sourceType only for the two exact legacy combinations above; otherwise null. Legacy request adapters write the same canonical fields.
- Existing `RegisterKnowledgeVersion`, `StageKnowledgeVersion`, `KnowledgeVersionState` retain scope/CAS behavior and gain canonical metadata. `DocumentCommandService` switches to `parseCreateDocumentRequest`, hashes the original request first, then normalizes for storage. No new browser-writable classification mutation.
- Add server-only paginated `KnowledgeMetadataPage(businessId,after,limit)` and CAS `BackfillKnowledgeMetadata(...)`: assert exact business/version, original legacy values and new fields null-or-already-equal; update **only kind/origin**, not revisions/status/timestamps/publication/audit.
- `backfillKnowledgeMetadata(dc,{businessId,apply}):Promise<MetadataMigrationReport>` with counts scanned/changed/alreadyCorrect/conflicts, row identity and before/after preservation proof. Default CLI dry-run; apply requires explicit project/business confirmation, quiescent flag and allowed public config. Follow the existing cursor-backfill CLI style; no new SQL escape hatch.

- [x] **Step1: Add migration/writer tests.** Cover all existing version states, including withdrawn fixture rows; idempotent repeat returns changed0; >100 rows traverse cursors; unknown/inconsistent legacy state or partly assigned new fields produce a conflict; a concurrent classification edit aborts its CAS. Compare all pre-existing knowledge/page/chunk/vector/audit fields and stock before/after, excluding only the two new classification values. Fake in-memory Storage original bytes remain identical. Legacy committed CREATE retry returns the original version/operation and hash; changing its classification with the same key conflicts. New nonlegacy kinds persist without a false legacy label. Manifest still references the same5 PDF paths/hashes and4 current/1 retired inputs, but uses kind/origin and derives synthetic.
- [x] **Step2: Run those cases RED on dedicated test emulators.** Reuse existing isolated harness patterns; no owner emulator reset/import, no cloud mode. If a required local service is absent, prepare an isolated launcher using unused ports and log setup separately from behavioral failure.
- [x] **Step3: Implement schema/operations/writers/migration/manifest.** Native GraphQL transactions and generated server SDK. Preserve old request hashes before normalization in CREATE replay lookup. Reuse existing SHA/provenance/physical-page/lease constraints.
- [x] **Step4: Compile and regenerate SDKs with the pinned CLI.** `node node_modules/firebase-tools/lib/bin/firebase.js dataconnect:compile --project demo-barberhq`; `npm run generate:sdk -- --project demo-barberhq`. Expected valid operations and generated enum types. Include the existing cloud-browser staging mechanism if production-target SDK output changes; do not hand-edit generated runtime or deploy connectors. Re-run enum postprocessing as the established generator does.
- [x] **Step5: Run Task1 and Part A tests GREEN and the affected document command/worker/race integration suites.** Continue Parts B/C in the same task before claiming cutover completion. No fresh Vertex embeddings or re-ingestion of existing documents is needed. Record results; no commit.

**Migration/runbook decision:** Keep deprecated storage columns until a separately planned cleanup. The application contract is replaced now; physical retention supports safe expansion and recovery. A cloud rollout needs an owner-approved quiet window, all pending/unknown uploads reconciled, workers drained, additive schema/connectors, dry-run+reviewed backfill, compatible backend and frontend, then reload of existing tabs. Old open UI versions are not silently certified against new metadata combinations. Before any new nonlegacy classification is written, record the rollback boundary; afterward use a compatible forward fix or separately reconciled recovery, not a blind old-frontend rollback.

### Part B — SQL eligibility and metadata propagation through RAG/PDF

**Files:** Modify `dataconnect/browser/knowledge.gql`, existing retrieval/recheck SQL in `dataconnect/server/knowledge.gql`, `functions/src/ai/retrieval.ts`, `web/src/app/core/knowledge-api.ts`, `web/src/app/features/procedures/data-access/knowledge.mapper.ts`, procedure/citation fixtures as needed. Extend `tests/integration/rag-retrieval.test.ts`, `tests/unit/rag-citations.test.ts`, `tests/unit/rag-procedure.test.ts`, `web/src/app/features/procedures/data-access/knowledge-documents-api.spec.ts`.

**Interfaces:** All browser source/list/review operations return kind/origin plus legacy fields only for compatibility mapping. `metadataFromStorage` is the single classification resolver. Extend `RetrievalRepository.search` with an internally supplied `kinds:readonly KnowledgeDocumentKind[]`; the procedure retriever supplies all4. SQL receives a validated server-created kind list, never an HTTP/model scope argument. Final source recheck uses the same allowed kinds. Existing source/version/chunk IDs and result type shapes otherwise retain their semantics.

- [x] **Step1: Add eligibility regressions.** Actual SQL retrieval accepts each of the4 kinds, including PRODUCT_CARD/CATALOG. With an explicit narrower internal kind list, ineligible nearest rows cannot consume the LIMIT3 slots. Empty/unknown kind lists fail before search. Retired/foreign/unready/revoked/wrong-config rows remain excluded, including revoke/change during generation. Browser source/list/review maps legacy and new rows coherently, deriving synthetic; inconsistent metadata fails closed. Existing seeded PDF links/geometry resolve unchanged after backfill.
- [x] **Step2: Run the new tests RED.** Existing RAG/provider/model failure tests retain their scope; deterministic local embeddings do not claim provider quality.
- [x] **Step3: Update SQL/mappers/propagation using Task1 metadata helpers.** Existing native vector SQL is retained; add a positional, validated kind filter before ORDER BY/LIMIT and final recheck. Do not change vectors, distance threshold, limit3, model or25s budget. Regenerate affected SDK outputs through Part A commands.
- [x] **Step4: Run the affected RAG/source/knowledge suites GREEN.** Preserve cited-page rectangles and original hashes in integration proof. Continue Part C in the same cutover before the full compilation/completion gate. Record results; no commit.

### Part C — upload selection, provenance labels and safe recovery UI

**Files:** Modify `web/src/app/features/procedures/document-upload-dialog.component.ts`, `library/document-upload.facade.ts`, `synthetic-label.component.ts`, `document-row.component.ts`, `source-excerpt.component.ts`, `cited-answer.component.ts` only where classification is consumed. Extend existing upload/facade/library/review/cited-answer specs. Create `tests/e2e/knowledge-metadata.spec.ts` for the focused user flow.

**Interfaces:** `UploadFormValue` replaces sourceType with kind/origin. New uploads default to procedure/synthetic, preserving current demo intent. Four kind options and three origin options use the metadata contract. `KnowledgeApi.createDocumentUpload` accepts `CreateDocumentRequest` for exact legacy recovery; newly created forms submit only V2. Existing pending-storage namespace/key and immutable frozen payload remain intact.

- [x] **Step1: Add UI regressions.** Two independently labeled selects; PUBLIC_COMPILATION requires URLs/date for every kind; changing kind never silently changes origin. A synthetic product card and official policy display correct shared provenance labels in library/review/source/cited answer. Restore old UNKNOWN registration without changing its original key/hash/body; form displays mapped metadata, but retry submits the frozen legacy request. A newly recovered V2 request retains both fields. Switching account/workspace closes the form and clears stale values using existing guards. No automatic publish or alias-generation claim.
- [x] **Step2: Run focused Angular tests RED.** Existing signed-in/out fixtures remain synthetic and isolated.
- [x] **Step3: Implement the two fields and derived labels with existing Material layout/components.** Reuse the pure helper; keep the historical component selector unless renaming is necessary. Recovery is read-compatible; do not delete an unresolved journal to simplify the migration.
- [x] **Step4: Run root typecheck, complete root/Angular suites GREEN and actual local browser flow.** HQ uploads/reviews a synthetic product card and official policy on isolated services; SALON sees only published authorized documents. Verify new labels at320px and desktop without horizontal overflow; use supported CUA browser tools for UI. AI/PDF interceptions, if required, are explicitly labeled and do not replace actual storage/extraction proof from integration tests. Record results; no commit.

## Task 3 — focused regression, packaging and migration handoff

**Files:** Create `docs/implementation/knowledge-kind-origin.md`. Update the spec's status/next-step and metadata references in `docs/synthetic-knowledge/README.md` only as needed. Inspect `scripts/config/prepare-knowledge-functions.ts` and its tests for the new shared runtime helper; update its exact allowlist if necessary. Existing AI frozen packaging is inspected when preparing a later deployable candidate, not silently rewritten now.

- [x] **Step1: Add a packaging regression if the new runtime helper is omitted.** Knowledge Functions must discover/load with all required runtime imports present; no additional function exports. If the existing package omits the shared helper, require the named dependency before implementation of the allowlist correction.
- [x] **Step2: Run complete root unit and Angular suites, root typecheck, Functions build and affected local SQL integration suites.** Commands: `npm run test:unit`, `npm run test:web`, `npm run typecheck`, `npm --prefix functions run build`. Use controller-owned emulator target overrides for integration; never switch an integration suite to production for convenience. Expected all relevant cases PASS; report existing warnings/failures by name.
- [x] **Step3: Build Angular using an allowed explicit public configuration; verify artifact project/config/bytes.** Use `node --import tsx scripts/config/build-web.ts --config artifacts/ui-refinements-2026-10-26-final/public-config.json --project notbad-6be95` or an isolated verification staging copy. Restore generated public configs/build-record state afterward. Build may contain the owner's pre-existing local login change: record it separately and mark publication ineligible until owner approves exact future scope.
- [x] **Step4: Run `npm run graph:update`; perform one independent final review of the increment-only diff and preservation proof.** Graph omissions do not waive source/template/GraphQL inspection. Resolve material findings with meaningful regressions. No staging/commit/workspace removal.
- [x] **Step5: Write the handoff with actual results, exact migration dry-run/apply commands, preserved fields and scope, compatible rollout order and rollback boundary.** No claim that the local implementation fixed the as-yet-unimplemented product matching issue. Record the owner's deferred demo acceptance as deferred, not PASS. Increment2 gets its own plan after this handoff; do not implement it under this plan.

## Self-review and acceptance

- Increment1 requirement coverage: shared helpers/parser Task1; schema/writer/manifest/backfill Task2A, retrieval Task2B, UI/labels/recovery Task2C; complete verification/package/handoff Task3.
- Each Review Focus has a named owning test in Tasks1/2. The coupled wire-contract changes share one Task2 gate so there is no intentionally broken intermediate deliverable. Existing auth/provenance/lease checks remain server-enforced.
- A local increment is complete only when new tests fail before the fix and pass afterward, existing affected suites/builds pass, pending-upload replay and metadata migration preserve identities, and final review is resolved. This does not mark the deferred demo release READY.
- Builder decisions made explicit: kebab-case public enum values, temporary retained legacy columns, strict legacy fallback, preserved pre-upgrade payload hash, locally verified implementation before separately approved cloud rollout. Cost if wrong: deployment must wait for a revised compatibility/migration plan; no live data has been changed by preparing this document.
