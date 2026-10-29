# BarberHQ 3B — Reviewed document library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the five-PDF corpus and let HQ upload, review, publish, replace and withdraw versions.

**Architecture:** HQ commands register immutable versions and enqueue the shared pipeline. SQL stores durable progress; library/read permissions remain independent from queue execution.

**Tech Stack:** Cloud Functions task queues, Cloud Tasks, private Storage, Data Connect, Angular Material, shared PDF core.

**Spec:** [Approved delivery design](../specs/2026-09-29-barberhq-delivery-design.md), increment 3B; phase1 remaining PDFs, phase2 document APIs, phase3 worker and phase4 library; approved extensions §2.

**Status (20 October 2026): READY for the demo and subsequent AI work.** Implementation, independent reviews, authenticated HQ lifecycle and dedicated SALON browser checks passed. Actual late/repeated tasks reached the private deployed worker; all three lifecycle suites passed against deployed SQL (74 checks), with the local integration suite passing 149 checks. Existing corpus/stock remain unchanged and no test-namespace rows remain. Acceptance adjustment: the planned automated library E2E file was not added; real signed-in browser workflow checks supply the hosted UI evidence. SQL conflict tests use local orchestration, deterministic vectors and in-memory Storage; they are not hosted active-worker lease tests. See [library handoff](../../implementation/handoffs/document-library.md) and [increment handoff](../../implementation/handoffs/increment-3b.md) for exact evidence/limits. The historical task checklist below is not a record of executed commands or commits. User authorized execution in conversation; this file alone is not authorization. Read [execution index](2026-09-29-barberhq-execution-index.md) for command conventions and shared types.

## Global Constraints

- Use Angular SPA, Firebase Auth, classic Firebase Hosting, SQL Connect (formerly Data Connect) with Cloud SQL PostgreSQL/pgvector, private Firebase Storage, and server-side Genkit/Gemini.
- AI does not mutate stock. The browser never connects directly to PostgreSQL or receives backend credentials.
- Business external key: `not-bad-stuff-demo`. Preserve the six `demoId` values in `docs/not-bad-stuff-products.json`.
- Integer units only; request quantities are 1–99. Persisted states: `PENDING_APPROVAL`, `RESERVED`, `DISPATCHED`, `RECEIVED`, `REJECTED`.
- No Firestore, SSR, Nx, additional vector database or persistent chat. Keep `.claude/specs/` in place.
- English UI; synthetic procedures visibly labeled. HTML/support.js remain unchanged design references.
- Run only the selected task/plan. Planning files describe future commands; none has been run as proof of implementation.

## Review Focus

- Upload accepted but enqueue failed must remain visible and retryable (tasks 2–3).
- A duplicate worker delivery cannot publish twice or duplicate chunks (task 2).
- Withdrawal racing publication must never resurrect a revoked version (task 2).
- Incomplete/unsupported extraction cannot be approved through direct API calls (task 2).
- A salon user cannot manage documents or discover staged files through UI or direct calls (tasks 2–3).

---

## Prerequisites and file responsibilities

Requires increment-3a READY and its shared pipeline/source endpoint. Add task queue IAM/configuration before deployed upload tests. No reasoning-model prerequisite.

- Expand the existing manifest; do not regenerate accepted DAM-001 v1 bytes unnoticed.
- `functions/src/knowledge/document-commands.ts`, `upload.ts`, `worker.ts`, `queue.ts`: registration, binary ingress, processing and enqueue.
- `KnowledgeOperation`: document idempotency separate from stock receipts.
- Angular library/review/dialog components use real processing states, not invented progress percentages.

### Task 1: Full corpus and replacement fixture

**Files:**
- Create: `docs/synthetic-knowledge/product-guide-v1.md`, remaining four PDFs under `data/knowledge/pdfs/`, `data/knowledge/replacements/DAM-001-v2.pdf`, `data/knowledge/replacement-manifest.json`.
- Modify: `scripts/prepare-data/export-pdfs.py`, `data/knowledge/manifest.json`.
- Create: `data/knowledge/reviews/corpus.md`, `tests/unit/corpus-manifest.test.ts`; modify `docs/synthetic-knowledge/README.md` only after actual generation.

**Interfaces:**
- Consumes: three current procedure Markdown files, retired damage procedure and existing six-product snapshot.
- Produces initial IDs DAM-001 v1, DIS-001 v1, REP-001 v1, DAM-001 v0 and CAT-001 v1; v0 is retired. Replacement DAM-001 v2 is a separate synthetic test fixture, never implicitly part of initial active corpus.
- Reuse the same manifest validation/export entry points from3A; no second exporter.

- [ ] **Step 1: Write the behavioral checks.** Test `five_inputs_four_current_and_correct_provenance`:
```ts
expect(manifest).toHaveLength(5);
expect(manifest.filter(d => d.publicationStatus === 'demo-current')).toHaveLength(4);
expect(manifest.filter(d => d.synthetic)).toHaveLength(4);
expect(manifest.find(d => d.documentId === 'CAT-001')).toMatchObject({synthetic:false,sourceType:'public-product-summary'});
expect(manifest.some(d => d.version === 'v2')).toBe(false);
```
Reject README/evaluation files from the allowlist. Product guide facts must retain all source URLs/observation dates and must not invent packaging dimensions or policy.

- [ ] **Step 2: Confirm the relevant check fails.** Run `npm run test:unit -- tests/unit/corpus-manifest.test.ts`. Expected: a failing named behavior before implementation; repair missing test infrastructure first, because an unavailable runner is not behavioral evidence.

- [ ] **Step 3: Implement the task.** Generate the remaining PDFs, using one unofficial public-product compilation label for CAT-001 and synthetic labels for all procedures on every page. Prepare replacement fixture with a clearly distinguishable supported sentence and multiline citation, without adding real-company claims. Visually review every page and extraction, record hashes/fonts/tooling and keep replacements separate. Import/review all five using3A pipeline, with DAMv0 processed but inactive.

- [ ] **Step 4: Verify the deliverable.** Manifest check PASS; every page reviewed; deployed SQL has five initial versions with four active and retired v0 excluded from search. Repeating preload preserves approved byte identities and existing stock.

- [ ] **Step 5: Record and commit.** Record real results in the increment handoff. Stage only this task’s named files after checking for secrets, then `git commit -m "chore: complete reviewed demo knowledge corpus"`. See index for initial Git setup; never claim a commit if unavailable.

### Task 2: HQ document lifecycle and bounded worker

**Files:**
- Create: `functions/src/knowledge/document-commands.ts`, `upload.ts`, `worker.ts`, `queue.ts`, `schemas.ts`.
- Modify: `dataconnect/schema/knowledge.gql`, `dataconnect/server/knowledge.gql`, `functions/src/knowledge/repository.ts`, `pipeline.ts`, `functions/src/index.ts`.
- Create: `tests/integration/document-commands.test.ts`, `tests/integration/document-races.test.ts`, `tests/integration/document-worker.test.ts`.
- Modify: `shared/contracts/knowledge.ts`, owner setup guide with concrete queue/IAM/runtime settings.

**Interfaces:**
- Callables: `createDocumentUpload(input:CreateDocumentInput):Promise<VersionStatus>`, `reviewAndPublishDocument(input:ReviewDocumentInput):Promise<VersionStatus>`, `retryDocumentProcessing(input:RetryDocumentInput):Promise<VersionStatus>`, `deleteKnowledgeVersion(input:DeleteVersionInput):Promise<VersionStatus>`; DTOs in index.
- HTTP `uploadKnowledgePdf`: versionId plus bounded bytes; `enqueueKnowledge(job:KnowledgeJob):Promise<void>`; `processKnowledge(job:KnowledgeJob):Promise<ProcessingResult>`.
- `KnowledgeJob = {versionId:string;stage:'EXTRACT'|'PUBLISH';expectedDocumentRevision:number;extractionHash?:string}`; server-registered metadata is authority, not arbitrary URL/actor fields in jobs.

- [ ] **Step 1: Write the behavioral checks.** Tests `enqueue_failure_is_retryable`, `duplicate_job_is_idempotent`, `delete_wins_against_publish`, `incomplete_review_is_rejected`:
```ts
await h.uploadWithQueueFailure();
expect((await h.version()).status).toBe('FAILED');
await h.retryAndDeliverJobTwice();
expect(await h.duplicateChunkCount()).toBe(0);
await h.withdrawWhilePublishPaused(); await h.resumePublish();
expect((await h.version()).revokedAt).not.toBeNull();
expect(await h.activeVersion('DAM-001')).not.toBe(h.withdrawnId);
await expect(h.salon.createDocumentUpload(validInput)).rejects.toMatchObject({code:'FORBIDDEN'});
```
Also test >10MiB bytes despite false Content-Length, hash/signature conflict, direct worker invocation denied, incomplete/changed extraction review, expired auth, same-key changed payload, concurrent replacement and old-version access.

- [ ] **Step 2: Confirm the relevant check fails.** Run `npm run test:integration -- tests/integration/document-commands.test.ts tests/integration/document-races.test.ts tests/integration/document-worker.test.ts`. Expected: a failing named behavior before implementation; repair missing test infrastructure first, because an unavailable runner is not behavioral evidence.

- [ ] **Step 3: Implement the task.** Register a staged version before upload, derive business/actor/provenance server-side and enforce HQ. Stream/count bounded binary ingress, verify SHA/signature and immutable generation; configure exact-origin CORS/Auth/App Check. Track KnowledgeOperation payload hashes and results independently of ActionReceipt. Enqueue only registered IDs; select maxAttempts=3, concurrency=2 and worker timeout=300s as initial demo operational settings, verify deployed support and record any justified adjustment. EXTRACT stops at EXTRACTED for every-page human review; PUBLISH requires matching review/extraction hashes, complete vectors and atomic expected revision/nonrevoked guards. Record retryable failures durably; retries recheck current state and reuse verified work. Delete revokes selected version and clears only its active pointer, without falling back or deleting original bytes. Use server task identity invocation and least required bucket/queue rights.

- [ ] **Step 4: Verify the deliverable.** All three deployed suites PASS. Verify task queue limits/IAM with actual configuration, processing status survives leaving/reopening UI, duplicate delivery creates no extra chunks, and old active content survives failed replacement. No unrestricted callable worker entry point or public bucket access.

- [ ] **Step 5: Record and commit.** Record real results in the increment handoff. Stage only this task’s named files after checking for secrets, then `git commit -m "feat: manage reviewed PDF versions through queued processing"`. See index for initial Git setup; never claim a commit if unavailable.

### Task 3: Library, review and version controls

**Files:**
- Create: `web/src/app/features/procedures/document-library.component.ts`, `document-row.component.ts`, `document-review.component.ts`, `document-upload-dialog.component.ts`, `document-delete-dialog.component.ts`.
- Modify: `web/src/app/core/knowledge-api.ts`, `web/src/app/app.routes.ts`, `shell/shell.component.ts`, `dataconnect/browser/knowledge.gql`.
- Test: `tests/e2e/document-library.spec.ts`, `web/src/app/features/procedures/document-review.component.spec.ts`.

**Interfaces:**
- Reads: `ListKnowledgeDocuments(page:PageInput):Page<DocumentRow>`, `GetKnowledgeReview(versionId:string):KnowledgeReview` mapped from generated reads; types in index.
- `KnowledgeApi.listDocuments(page:PageInput):Promise<Page<DocumentRow>>`, `getReview(versionId:string):Promise<KnowledgeReview>`, plus methods named after document callables with matching DTOs.
- Upload uses XMLHttpRequest/fetch bytes with explicit Auth/App Check headers; UI progress refers only to measured upload bytes, processing uses durable statuses.

- [ ] **Step 1: Write the behavioral checks.** Tests `salon_is_read_only`, `every_page_review_required`, `replace_then_withdraw`:
```ts
await expect(salonPage.getByRole('button',{name:'Add document'})).toHaveCount(0);
await expect(hqPage.getByRole('button',{name:'Publish'})).toBeDisabled(); // one page unchecked
await expect(hqPage.getByText('Private originals and audit records are retained.',{exact:true})).toBeVisible();
```
Complete a real HQ upload/review/publication, reopen during processing, replace current version, open superseded source and withdraw it. Test stale-revision conflict refreshes review rather than silently retrying publication.

- [ ] **Step 2: Confirm the relevant check fails.** Run `npm run test:web -- web/src/app/features/procedures/document-review.component.spec.ts`. Expected: a failing named behavior before implementation; repair missing test infrastructure first, because an unavailable runner is not behavioral evidence.

- [ ] **Step 3: Implement the task.** Implement `/procedures?tab=documents` with role-filtered navigation and actions. HQ sees registered processing/failed states and explicit Retry; staff sees allowed published versions. Reuse PDF viewer for staged HQ preview and show extracted text per physical page with explicit review coverage. Disable publication if incomplete, but rely on backend checks. Require selected-version confirmation for withdrawal, using exact retention copy above. Render synthetic/unofficial/superseded labels from metadata; escape text. Refresh statuses only while library/review visible and stop polling on navigation/sign-out; use modest 5s polling without fake progress.

- [ ] **Step 4: Verify the deliverable.** Component test and `npm run test:e2e -- tests/e2e/document-library.spec.ts` PASS against deployed services. Inspect upload errors, unsupported content, review, failed/retry/current/superseded/revoked states at desktop/mobile widths and with keyboard.

- [ ] **Step 5: Record and commit.** Record real results in the increment handoff. Stage only this task’s named files after checking for secrets, then `git commit -m "feat: add HQ document library and review screens"`. See index for initial Git setup; never claim a commit if unavailable.

### Task 4: Corpus, access and publication handoff

**Files:**
- Create: `tests/integration/knowledge-lifecycle.test.ts`, `docs/implementation/handoffs/increment-3b.md`.
- Modify: `tests/integration/reset.test.ts`, `scripts/checks/hosting.ts`, `docs/implementation/deployment-runbook.md`.
- Modify: public configuration with knowledgeEnabled true and required read/upload URLs.

**Interfaces:**
- Consumes: existing worker/library/source API and `resetDemo()`.
- Produces integrated evidence for initial corpus, replacement/revocation and reset preservation; no new business endpoint.
- Extend source test fixtures with superseded/withdrawn versions and initial four-current baseline.

- [ ] **Step 1: Write the behavioral checks.** Test `reset_preserves_published_knowledge` and `revocation_denies_new_reads`:
```ts
const knowledgeBefore = await h.knowledgeSnapshot();
await h.resetOperationalDemo();
expect(await h.knowledgeSnapshot()).toEqual(knowledgeBefore);
await h.deleteActiveVersion();
expect(await h.activeVersion('DAM-001')).toBeNull();
await expect(h.getDeletedPdf()).rejects.toThrow();
expect(await h.retainedOriginalExists()).toBe(true);
```
Verify the original four-active baseline on separate clean fixtures; do not assume a corpus remains four-active after replacement/deletion tests.

- [ ] **Step 2: Confirm the relevant check fails.** Run `npm run test:integration -- tests/integration/knowledge-lifecycle.test.ts tests/integration/reset.test.ts`. Expected: a failing named behavior before implementation; repair missing test infrastructure first, because an unavailable runner is not behavioral evidence.

- [ ] **Step 3: Implement the task.** Run extension acceptance against scoped test documents, keeping the stage canonical document active. Record exact version IDs, review coverage, hashes and query-filter evidence. Extend Hosting smoke checks for document-tab/source deep links and both HTTP CORS preflights; backend/worker deploy separately. Record bounded corpus limitations and ensure no evaluation file was indexed.

- [ ] **Step 4: Verify the deliverable.** Lifecycle/reset and relevant deployed UI/source checks PASS. Four canonical current documents remain eligible, retired v0 ineligible, replacement fixture isolated; no stock mutation from document operations. Report READY only after actual worker/API/UI evidence.

- [ ] **Step 5: Record and commit.** Record real results in the increment handoff. Stage only this task’s named files after checking for secrets, then `git commit -m "test: verify knowledge lifecycle and preserve demo corpus"`. See index for initial Git setup; never claim a commit if unavailable.

## Completion and next context

Increment-3b report links corpus review, runtime/queue settings, source IDs and lifecycle/access results. Next plans4A/4B read it plus the relevant earlier report. AI flows are independent; shared AI-0 infrastructure is defined once in plan4A and may be executed from4B without executing the replenishment flow.
