# 4B.1 — scoped procedure retrieval and calibration

Status, 21 October 2026: **READY for Task 4B.1 retrieval only, including deployed named-query acceptance.** The owner approved the bounded server publication. No answer generation, callable, assistant UI or feature flag is delivered by this task.

## Implementation

`functions/src/ai/retrieval.ts` exports the candidate/calibrated retriever factories, SQL adapter and runtime entry point. `dataconnect/server/knowledge.gql` adds one parameterized `NO_ACCESS` read, `SearchEligibleProcedureChunks`. Membership, business and valid SALON assignment authorize the read in the same SQL statement. A false authorization result throws `FORBIDDEN`, not empty evidence. Document active pointer, current/READY/active/published/nonrevoked state, matching version/chunk embedding configuration, embedding model and 768 dimensions filter candidates before the top-three limit. Source identities, exact excerpt, page geometry, synthetic/unofficial provenance and document revision are reconstructed from SQL records. Provider/config/SQL errors are distinct from empty evidence.

The public function shape remains `retrieveProcedure({question,limit:3}, ActorContext)`. Query embeddings reuse the existing Vertex adapter in `RETRIEVAL_QUERY` mode; no document was re-embedded. The future user-facing flow must compose AI-0 admission/deadline and generation with this retriever. Operator calibration does not consume end-user quota.

`functions/config/rag-retrieval.json` pins:

- cosine distance cutoff: `0.3253804210784045` (smaller is closer);
- max chunks: 3;
- embedding identity: `gemini-embedding-001` / 768 / `europe-west3` / `notbad-6be95`;
- embedding config hash: `be8d7e6a9f33cc6235d296af7c3b74345d9745266ab160588685eb34252759ba`;
- evaluation-set hash: `7704be1556b9e7ce1056d20df15f50d2c75262a3655a20ea9d940ca0913e477d`.

`cases.json`, `calibrate.ts` and `run.ts` under `scripts/eval/rag/` are outside the indexed corpus. Calibration scores all required evidence sections, using an exact chunk ID for CAT-001's broad shared section; document hits are a separate diagnostic. Both replay CLIs require the same case-set hash, exact questions, exactly one entry per ID and labeled hit metadata. Regression checks reject stale questions/hashes, duplicate/missing/extra IDs and wrong-section/right-document successes.

## Measured results

The real read-only run used the existing four active versions and 13 chunks. Genkit CLI 1.42.0 trace `04afa9477cdff5884b84da67d1873dcd` recorded 20 successful embedding spans, zero errors and zero reasoning-model calls; total batch time was 7.883 seconds. It used operator ADC, not a hosted runtime account. The existing demo HQ UID was resolved only in memory and omitted from traces/reports.

| Split | Required-section hits on supported cases | Unsupported questions with no accepted evidence |
| --- | --- | --- |
| Calibration | 8/9 | 3/3 |
| Separate English held-out | 2/3 | 1/1 |
| Separate Polish probes | 1/2 | No negative probes; output remains disabled |

The automatic-replacement question's decision section was absent from the first three candidates. The held-out Dry Matt net-content question fell outside the cutoff. Polish shortage did not retrieve its required section. These are explicit misses; a matching document or close distance is not proof of claim support. Mixed questions can retrieve evidence for only part of the question. Task 4B.2 must use its bounded retry/abstention path, and Task 4B.3 must evaluate generated claims with human review. This small synthetic dataset does not establish production accuracy.

Review corrected two initial evidence gaps. The original 20 distances were reused with added source-section annotations; every original question and label was checked unchanged and each question matched exactly one actual trace embedding input. The provenance records the old/new evaluation identity. There was no new provider call, changed question, altered distance or tuning on held-out cases.

## Verification

Final independent controller checks passed:

- unit: 31 files / 154 tests;
- integration: 20 files / 155 tests against native PostgreSQL 17.11 and pgvector 0.8.7 behind the SQL Connect emulator;
- root typecheck and Functions build;
- strict calibration/evaluation replay CLIs;
- independent task review and scoped correction re-review, both original P2 findings closed.

SQL tests include closer foreign/retired/unready/revoked/pointer-mismatched/config-mismatched distractors, exact source metadata, missing-member denial, SALON deny → grant → revoke, and fixture cleanup. PGlite repeatedly produced WASM/protocol failures after partial passes; those partial results are not the final acceptance evidence. Native PostgreSQL used an isolated local Docker container with loopback-only port, tmpfs and automatic removal, without user directories or named volumes. The pinned Firebase CLI supports this through `FIREBASE_DATACONNECT_POSTGRESQL_STRING`; this is a test environment choice, not an application stack change.

Ignored evidence is under `artifacts/rag-retrieval/`: `integration-regression-native.log`, `unit-final.log`, `typecheck-final.log`, `build-final.log`, `trace-summary.json`, `calibration.json`, `evaluation.json`, and `measured-candidates-section-labeled.json`. The last file preserves trace/reannotation provenance. Corpus metadata and connector source fingerprints were checked read-only. The SQL diff is compatible: no migration is proposed.

## Publication acceptance and next context

After owner approval, published only `dataconnect:notbad-6be95-service:server`. Fresh SQL diff confirmed compatibility without migration. Read-back fingerprints match the reviewed server sources; schema, browser and vector definitions remain unchanged. Actual `SearchEligibleProcedureChunks` calls through the runtime SQL adapter succeeded for existing HQ and assigned SALON memberships, returning three source sections with exact identities, excerpts, page metadata and configuration hash. Missing-member and foreign-business probes returned `FORBIDDEN`. Existing actor UIDs and one stored vector were used only in memory; no provider call, fixture write, corpus mutation, Auth/IAM change, Functions release or Hosting release occurred. Before/after hashes for documents, versions, pages and chunks were identical.

Evidence: `artifacts/rag-retrieval/deployment-approved.log`, `publication-before.json`, `publication-after.json`, `named-query-proof.json`. This stored-vector self-match verifies the deployed operation and adapter, not natural-language answer quality; the measured retrieval limitations above remain applicable.

Then read Task 2 in `2026-09-29-barberhq-04b-procedure-rag.md`, this report, the AI-0 handoff and execution-index AI DTOs. Implement retrieval-first structured answers, verified citations, final eligibility recheck and bounded retry/abstention; preserve the known retrieval misses as evaluation cases. UI and human claim-support acceptance remain Task 3.
