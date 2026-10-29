# 4B.2 — grounded procedure answer backend

Status, 24 October 2026: **PUBLISHED; authorized hosted SQL/Vertex path verified.** Human claim review remains pending. Task 4B.1 retrieval is deployed and accepted. This task adds the answer backend; UI preview publication is recorded in [4B](increment-4b.md), and human-reviewed answer quality is not yet established.

## Delivered behavior

`functions/src/ai/procedure.ts` exports the `answerProcedureQuestion` callable factory and a stateless Genkit flow. Auth and App Check protect the entry point; AI-0 resolves SQL membership and admits the shared quota before retrieval. English output is enabled in the input contract; Polish remains a validation error.

The flow retrieves at most three eligible chunks before generating. No evidence returns an abstention with no model call. Gemini receives the question and serialized source excerpts as untrusted data, with no stock or document write tools. Its bounded JSON schema supports cited steps, clarification, missing-context retrieval and insufficient evidence. `citations.ts` accepts only retrieved page-local IDs and builds public source metadata from SQL records.

One retry is shared by targeted retrieval and recovery from source changes. It replaces the evidence set. Before returning, `RecheckProcedureSources` verifies fresh membership/business/role/salon assignment and exact chunk, version, document revision, active pointer, readiness, publication, revocation and embedding identity. A changed source consumes the remaining retry or returns retryable `SOURCE_CHANGED`; recovery that finds no eligible evidence also returns `SOURCE_CHANGED`.

The operation shares AI-0's 25-second budget, five model turns and eight tool calls. Generation uses the pinned `gemini-3.8-flash` in `eu`, JSON schema output, a 1,024-token cap and no model tools. Query embeddings retain `gemini-embedding-001`, 768 dimensions, `europe-west3` and the measured retrieval config. The callable maps validation/auth/access/quota/timeout/source-change/provider errors to controlled Firebase errors without exposing SDK details.

## Verification

- Final root unit suite: **33 files / 167 tests passed**.
- Full native PostgreSQL/pgvector integration regression: **21 files / 157 tests passed**. After the cancellation fix, focused retrieval/flow integration: **2 files / 7 tests passed**.
- Root typecheck and Functions build passed. Compiled entry-point loading preserves all twelve existing exports and adds `answerProcedureQuestion`.
- Native races cover valid cited output during withdrawal, successful recovery after publication replacement, SALON access revocation and unchanged inventory/request/transfer/movement snapshots in isolated fixtures. Test generation is deterministic.
- One real synthetic Genkit schema smoke passed: one model call, 2,484 ms, trace `12f0985eb9b797f667041998f47ebe55`, three successful spans. This used operator ADC, not the hosted runtime account, and performed no SQL, Storage or stock operations.
- Independent task review and scoped correction review passed. A generated declaration drift affecting output-only enum aliases was repaired with the existing repository postprocessor; final unit checks include that gate.
- Prepared SQL diff is compatible without migration. Comparing staged sources against accepted 4B.1 shows only the new `RecheckProcedureSources` operation; existing server, schema and vector definitions remain identical.

Evidence is local/ignored under `artifacts/rag-flow/`: `unit-fix-final.log`, `integration-regression-native.log`, `integration-fix-final.log`, `typecheck-fix-final.log`, `structured-runtime-proof.json`, `structured-trace-summary.json`, `deployment-scope.json`. The SQL diff log is `artifacts/rag-retrieval/rag-flow-sql-diff.log`.

## Limits and next step

The owner-approved release added only `RecheckProcedureSources` to the server connector and created `answerProcedureQuestion` in `europe-west1`. Read-back confirms the new function is ACTIVE on `baberhq-runtime@notbad-6be95.iam.gserviceaccount.com`, with the expected public SQL/Storage/embedding parameters and no emulator configuration. All twelve existing Functions have unchanged state/update-time/runtime metadata; schema, browser and vector connector fingerprints are unchanged.

Read-only cloud checks exercised the deployed recheck query with existing HQ and SALON membership: current sources passed; stale document revisions, wrong embedding identities, missing membership, changed roles and empty salon scope were rejected. Document, version, page, chunk, inventory, request, transfer and movement snapshots were equal before and after. These checks used operator ADC with actor identifiers kept in memory; they do not prove the hosted runtime account's downstream access.

Two real requests to the new callable, with missing or invalid Auth/App Check, returned HTTP 401 / `UNAUTHENTICATED`. After a separately approved UI preview release, a real signed-in question also returned 401: middleware logged Auth VALID / App Check MISSING. The browser's reCAPTCHA component reported a connection failure; app/site-key/domain configuration matches cloud metadata. This establishes rejection with valid Auth, but successful generation and runtime SQL/Vertex access still require a request with valid App Check. See the [preview outcome](../rag-ui-preview-review.md).

Release evidence: `artifacts/rag-flow/release-after.json`, `named-recheck-proof.json`, `callable-guards-proof.json`, with sanitized command logs under `artifacts/rag-retrieval/`. After successful function creation, the interactive CLI asked to configure automatic Artifact Registry image deletion; that separate cleanup-policy prompt was cancelled. Function read-back confirms successful creation. No cleanup policy was changed.

Pinned Genkit 1.42 has no public transport cancellation for `embedMany`. The response times out and retrieval checks cancellation before embedding and after it before SQL, so a late embedding cannot start another SQL search or deliver an answer. One already-started embedding may still finish or incur cost. No unsupported SDK patch, direct REST replacement or embedding migration was introduced.

Source eligibility can change after the final check; an already-delivered answer cannot be revoked. Citation membership and a successful JSON schema smoke do not prove claim support or prompt-injection resistance. Preserve the measured retrieval misses in [4B.1](rag-retrieval.md). Human claim review, live end-to-end evaluation, PDF citation UI and language acceptance remain Task 4B.3.

Next resolve the browser reCAPTCHA connection failure and verify a hosted question with valid App Check before accepting live answers. Local UI review and its separately approved preview release are complete. Test emulators and the temporary tmpfs PostgreSQL container were stopped and removed; no demo cloud fixtures were changed.

## Hosted runtime follow-up, 24 October

Five real signed-in questions now returned HTTP 200 with Auth VALID / App Check VALID in 0.54–16.70 s. The rehearsed answer's three cited source sections opened the original PDF at physical page 1 with highlights. Eight corpus/business hashes matched before/after. No source, model, App Check or deployment change was made to obtain these results; the previous connection failure was not reproduced and its root cause remains unknown. The earlier “pending” statements above describe the 22 October gate.

See [live evidence and known replacement-decision miss](../rag-hosted-acceptance-2026-10-24.md) and [human review table](../rag-claim-review-2026-10-24.md). Five successful transports do not establish five supported complete answers. Human review remains mandatory before presentation acceptance.

## Owner claim review received, 24 October

The owner explicitly confirmed all five rehearsed instructions against DAM-001 v1: “Potwierdzam zgodność wszystkich 5 kroków”. This closes the human gate for the captured stage answer only. Earlier pending statements are historical; the known replacement-decision completeness miss and navigation observation remain documented. Continue final integrated release/rehearsal checks; this is not general answer-quality certification.
