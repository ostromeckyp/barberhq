# BarberHQ 4B — Grounded procedure answers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Answer damaged-delivery questions using eligible PDF evidence with verified citations and abstention.

**Architecture:** Always retrieve scoped current text before generation. The model produces structured cited steps; the server validates source membership and rechecks publication status before returning the answer.

**Tech Stack:** Genkit/Gemini, existing embedding adapter, Data Connect cosine search, Angular source cards/PDF viewer.

**Spec:** [Approved delivery design](../specs/2026-09-29-barberhq-delivery-design.md), increment 4B; phase6, shared knowledge contract and approved citation/revocation behavior.

**Status (24 October 2026):** Tasks 1–2 and the reviewed UI are published. Task 3 now has five real signed-in HTTP 200/Auth/App Check calls, verified highlighted PDFs, no-write hashes and recorded answer-level results (4/5 expected behaviors; known replacement-decision miss retained). Human support review of all five rehearsed steps remains pending. See [current handoff](../../implementation/handoffs/increment-4b.md). The ledgered hosted-UI evaluation ruling replaces a new automated answer CLI mode; strict retrieval replay remains separate. Existing no-commit/no-workspace-removal instructions supersede historical steps below. Read [execution index](2026-09-29-barberhq-execution-index.md) for command conventions and shared types.

## Global Constraints

- Use Angular SPA, Firebase Auth, classic Firebase Hosting, SQL Connect (formerly Data Connect) with Cloud SQL PostgreSQL/pgvector, private Firebase Storage, and server-side Genkit/Gemini.
- AI does not mutate stock. The browser never connects directly to PostgreSQL or receives backend credentials.
- Business external key: `not-bad-stuff-demo`. Preserve the six `demoId` values in `docs/not-bad-stuff-products.json`.
- Integer units only; request quantities are 1–99. Persisted states: `PENDING_APPROVAL`, `RESERVED`, `DISPATCHED`, `RECEIVED`, `REJECTED`.
- No Firestore, SSR, Nx, additional vector database or persistent chat. Keep `.claude/specs/` in place.
- English UI; synthetic procedures visibly labeled. HTML/support.js remain unchanged design references.
- Run only the selected task/plan. Planning files describe future commands; none has been run as proof of implementation.

## Review Focus

- A closer foreign/retired chunk must not displace eligible evidence (task1).
- A question absent from policy must abstain rather than borrow product marketing facts (tasks1–2).
- A valid citation ID can still support a false claim; human claim review is required (task3).
- Withdrawal/publication while generation runs must prevent delivery of stale guidance (task2).
- Document prompt injection and model failure must not change permissions, create actions or expose raw source HTML (tasks2–3).

---

## Prerequisites and file responsibilities

Requires3A/3B knowledge evidence and shared AI-0 from plan4A task1. If AI-0 is absent, execute that task only and write its report; do not build the replenishment assistant as a prerequisite.

- `functions/src/ai/retrieval.ts`: scoped search and eligibility.
- `functions/src/ai/procedure.ts`, `citations.ts`: retrieval-first answer and server-built sources.
- `scripts/eval/rag/`: calibration/evaluation cases, with expected answers excluded from indexed PDFs.
- `features/procedures/`: question form, cited answer and source excerpts; reuse existing library/viewer.

### Task 1: Scoped retrieval and calibrated abstention boundary

**Files:**
- Create: `functions/src/ai/retrieval.ts`, `scripts/eval/rag/cases.json`, `scripts/eval/rag/calibrate.ts`, `scripts/eval/rag/run.ts`.
- Modify: `dataconnect/server/knowledge.gql` if needed; reuse embedding.ts.
- Test: `tests/integration/rag-retrieval.test.ts`.
- Create: `functions/config/rag-retrieval.json` with actual calibrated distance threshold/config hash during execution.

**Interfaces:**
- `retrieveProcedure(input:{question:string;limit:3},ctx:ActorContext):Promise<RetrievedChunk[]>`; `RetrievedChunk = SourceSection & {cosineDistance:number;documentRevision:number;embeddingConfigHash:string}`.
- Use `embedTexts([question],'query')` from3A with identical configured dimension/model compatibility.
- Configuration `{maxChunks:3,maxCosineDistance:number,embeddingConfigHash:string,evaluationSetHash:string}` pins distance semantics (smaller cosine distance is closer), not a universal guessed cutoff.

- [ ] **Step 1: Write the behavioral checks.** Test `filters_before_similarity_limit` and `unsupported_question_has_no_usable_evidence`:
```ts
expect(chunks.length).toBeLessThanOrEqual(3);
expect(chunks.every(c => eligibleVersionIds.has(c.versionId))).toBe(true);
expect(chunks.every(c => c.embeddingConfigHash === corpusConfigHash)).toBe(true);
await expect(retrieveWithMismatchedEmbedding()).rejects.toThrow();
```
Use an intentionally closest foreign/retired/unready/revoked vector in isolated SQL fixtures. Include damage, missing-item, product-fact, disinfection, missing deadline and mixed questions; inspect retrieval evidence before deciding threshold.

- [ ] **Step 2: Confirm the relevant check fails.** Run `npm run test:integration -- tests/integration/rag-retrieval.test.ts`. Expected: a failing named behavior before implementation; repair missing test infrastructure first, because an unavailable runner is not behavioral evidence.

- [ ] **Step 3: Implement the task.** Reuse actual vector query but enforce business/access, active pointer, READY, not revoked and matching embedding configuration inside SQL before top3 selection. Do not filter corpus language to nonexistent Polish docs. Calibrate threshold using labeled positive/negative cases from knowledge README plus added cases; retain a small separate paraphrase set to check the choice. Record measured threshold/rationale and distance semantics, never hardcode question→answer mappings. No useful matches returns an empty evidence set; retrieval/provider failures throw controlled operational errors, not false no-evidence claims.

- [ ] **Step 4: Verify the deliverable.** Deployed retrieval test PASS. Run `npm run eval:rag:calibrate`; record chosen threshold and per-case retrieved IDs/distances, including limitations where similarity alone cannot distinguish unsupported claims. Threshold is one signal; flow must still abstain for unsupported instructions.

- [ ] **Step 5: Record and commit.** Record real results in the increment handoff. Stage only this task’s named files after checking for secrets, then `git commit -m "feat: retrieve eligible procedure evidence"`. See index for initial Git setup; never claim a commit if unavailable.

### Task 2: Grounded flow and verified citation response

**Files:**
- Create: `functions/src/ai/procedure.ts`, `functions/src/ai/citations.ts`, `tests/unit/rag-citations.test.ts`, `tests/integration/rag-flow.test.ts`.
- Modify: `shared/contracts/ai.ts`, `functions/src/ai/schemas.ts`, `functions/src/index.ts`.
- Add: server read operation for final eligibility recheck in `dataconnect/server/knowledge.gql`.

**Interfaces:**
- Callable `answerProcedureQuestion(input:ProcedureInput):Promise<ProcedureResult>`; types in index.
- `validateCitations(steps:CitedStep[],retrieved:RetrievedChunk[]):SourceSection[]` rejects unknown IDs and constructs sources from database records.
- `recheckEligibility(sources:RetrievedChunk[],ctx:ActorContext):Promise<boolean>` compares active pointers/revisions/readiness/revocation before response.
- Every `sourceSectionId` equals one retrieved page-local chunkId; logical sectionId remains a separate field.

- [ ] **Step 1: Write the behavioral checks.** Tests `invented_citation_rejected`, `withdrawal_during_generation_blocks_answer`, `no_evidence_abstains`, `document_injection_is_data`:
```ts
expect(() => validateCitations([{text:'Do X',sourceSectionIds:['invented']}],retrieved)).toThrow();
expect(emptyEvidenceResult.status).toBe('INSUFFICIENT_EVIDENCE');
expect(emptyEvidenceModelCalls).toBe(0);
await expect(pausedAnswer).rejects.toMatchObject({code:'SOURCE_CHANGED'}); // retry already consumed
expect(await h.businessSnapshot()).toEqual(beforeQuestion);
```
Use a paused provider response to race real withdrawal/publication. Model-supplied title/page/path and hostile document instructions must not override source metadata or permissions. Test timeout, mismatched vectors and model/retrieval failure as operational errors.

- [ ] **Step 2: Confirm the relevant check fails.** Run `npm run test:unit -- tests/unit/rag-citations.test.ts`. Expected: a failing named behavior before implementation; repair missing test infrastructure first, because an unavailable runner is not behavioral evidence.

- [ ] **Step 3: Implement the task.** Admit through AI-0; retrieve first, give Gemini question plus labeled readable evidence only. Require structured steps with supporting IDs and missing-information notes; no external search or general-company-policy filling. One targeted retrieval retry maximum across missing-context and publication-change recovery, within 25s / 5 turns / 8 tools; replace context with at most 3 chunks, not accumulate unlimited evidence. Unknown citations/invalid output after allowed recovery yield controlled failure. Recheck eligibility immediately before returning; if changed, use remaining one retry or return retryable SOURCE_CHANGED. Scope recheck closes the measured race window but cannot revoke an answer already delivered. No stock/document-write tools.

- [ ] **Step 4: Verify the deliverable.** Citation tests and `npm run test:integration -- tests/integration/rag-flow.test.ts` PASS; no-evidence makes no generation call, raced changes never return stale answer, and inventory/requests are unchanged. Document exact error mapping and retry accounting.

- [ ] **Step 5: Record and commit.** Record real results in the increment handoff. Stage only this task’s named files after checking for secrets, then `git commit -m "feat: generate grounded procedure answers"`. See index for initial Git setup; never claim a commit if unavailable.

### Task 3: Cited answer UI and real grounding evaluation

**Files:**
- Create: `web/src/app/features/procedures/procedure-assistant.component.ts`, `cited-answer.component.ts`, `source-excerpt.component.ts`, `synthetic-label.component.ts`.
- Modify: `web/src/app/core/assistant-api.ts`, routes/library tab container, `scripts/eval/rag/run.ts`, config ragEnabled flag.
- Test: `tests/e2e/procedure-rag.spec.ts`, `web/src/app/features/procedures/cited-answer.component.spec.ts`.
- Create: `docs/implementation/handoffs/increment-4b.md`.

**Interfaces:**
- `AssistantApi.answerProcedureQuestion(input:ProcedureInput):Promise<ProcedureResult>`.
- CitedAnswer consumes server steps/sources; builds existing viewer route from versionId/chunkId/physicalPage, never model-provided URL.
- `npm run eval:rag` writes ignored raw evidence plus a shareable redacted report of retrieved IDs, supported claims, abstentions and latency. Checked-in cases are evaluation fixtures only.

- [ ] **Step 1: Write the behavioral checks.** Tests `opens_supporting_pdf`, `escapes_source_markup`, `unsupported_question_has_no_invented_instruction`:
```ts
await expect(page.getByText('Synthetic demo procedure',{exact:true}).first()).toBeVisible();
await page.getByRole('link',{name:/Open PDF/}).first().click();
await expect(page.getByTestId('cited-highlight')).toBeVisible();
expect(rendered.querySelector('script')).toBeNull();
```
Render malicious source markup as text. Test no-evidence, clarification, operational error, superseded-readable citation and revoked deep link. Use separate Zakładowa DEMO-DAMAGE-01 scenario, not the intact stock transfer.

- [ ] **Step 2: Confirm the relevant check fails.** Run `npm run test:web -- web/src/app/features/procedures/cited-answer.component.spec.ts`. Expected: a failing named behavior before implementation; repair missing test infrastructure first, because an unavailable runner is not behavioral evidence.

- [ ] **Step 3: Implement the task.** Add question/loading/answer/clarification/no-evidence/error states using Material controls. Show title/version/physical page, exact excerpt and synthetic/unofficial provenance alongside every source; safe escaped text or sanitized Markdown only. Preserve no persistent conversation history. Run English cases from knowledge README and added product/mixed/absent-policy cases with actual models. A human marks support for every returned instruction and highlights failures, including unsupported deadlines, disinfection and automatic replacement promises. Evaluate Polish paraphrases separately; enable Polish stage prompts only if verified, otherwise keep English.

- [ ] **Step 4: Verify the deliverable.** Component test and `npm run test:e2e -- tests/e2e/procedure-rag.spec.ts` PASS. Run `npm run eval:rag`, review claims against source PDFs and record successes/failures honestly; all rehearsed answers must be supported with verified highlights. Confirm no business writes before/after questions.

- [ ] **Step 5: Record and commit.** Record real results in the increment handoff. Stage only this task’s named files after checking for secrets, then `git commit -m "feat: present verified procedure guidance and citations"`. See index for initial Git setup; never claim a commit if unavailable.

## Completion and next context

Report4B records actual model/embedding/threshold identities, case-by-case retrieval/grounding evidence, language decision, source deep links and unsupported cases. Do not claim a small synthetic evaluation proves general policy accuracy. Increment5 consumes both AI reports and all earlier readiness evidence.
