# Deployed demo rehearsal — 25 October 2026

**NOT READY: one scoped repetition passed; the second reached the real RAG timeout.** Both stock scenarios completed correctly. Two successful full repetitions and the remaining acceptance gates are still required.

## Authorization and environment

The owner continued after reviewing the exact reset/rehearsal scope. The initial browser action was previously stopped by the automatic approval reviewer's usage limit; no reset ran during that interruption. This continuation resumed on 25 October after that limit cleared.

- Project/site `notbad-6be95`, business `not-bad-stuff-demo`; production and foundation serve `4b833190c12b9244`.
- Existing SALON session on [foundation](https://notbad-6be95--foundation-unesffgt.web.app); existing HQ session on [live](https://notbad-6be95.web.app). Separate authenticated sessions share the backend and exact frontend artifact. This does **not** establish both roles on the live origin or two isolated browser profiles.
- Fresh live-start and preview/live-final release checks passed all 59 files, build `c8003c2ef7bd0794d09c006523ac43d4c2aae9ca90edaad7a4e12e58fc3f2f70`, config `04dbe169bf4f8b841d3c3facde86e271a1a56db47cfa508e373197dd6fbb05a5`, backend ready-revision fingerprint `sha256:154c843bba85f0d9624532f4215021f2f3a3980a4bd9b9cb2a7d8563ad685771`. `validatePromotion` confirmed the final identities match.
- No deployment, IAM/rules/origin change, upload, withdrawal or corpus mutation occurred during rehearsal.

## Resets and stock results

Both resets used the reviewed operator CLI with the named public configuration, explicit project/business confirmation and `--quiescent`. Each `--apply` first performed its own read-only count. Reset1 deleted 41 operational rows; reset2 deleted the 14 operational rows created by repetition1. Each reset updated exactly 24 inventories to HQ18 / salons2, reserved0. Products, memberships, settings and knowledge tables are outside that reset transaction.

Both repetitions used: **“Send two units of Pomada Matowa 100 ml to Legnicka.”** The actual assistant prepared one Matowa line with quantity2; the operator explicitly submitted, approved, dispatched and confirmed intact receipt.

| Phase, Matowa only | HQ on hand | HQ reserved | In transit | Legnicka on hand |
| --- | ---: | ---: | ---: | ---: |
| Initial | 18 | 0 | 0 | 2 |
| Approved | 18 | 2 | 0 | 2 |
| Dispatched | 16 | 0 | 2 | 2 |
| Received | 16 | 0 | 0 | 4 |

Read-only SQL assertions passed at all four phases in each repetition. Each final request had exactly one Matowa item, requested/dispatched/received2 and two stock movements of quantity2. Other Matowa salon locations stayed2/reserved0. Final retained request: `74a78e73-c26a-4f21-b3e8-b2ecea21f100`, RECEIVED. The first request `caf28aa0-5496-4cba-9612-1693d0bf981a` was deliberately removed by the authorized second reset. No third reset was run; the final Matowa state remains HQ16 / Legnicka4.

## Timing and procedure outcome

Times are measured browser-control wall time, including tool round trips, SQL checks and screenshot work. They exclude login/reset setup and **do not measure spoken stage narration or the twenty-minute talk**.

| Repetition | UTC start | Stock completed | Full result |
| --- | --- | --- | --- |
| 1 | 07:08:22.978 | 3:36.812 | Scoped PASS in **5:23.368**, including genuine guidance, highlighted original PDF and Back to retained question/answer |
| 2 | 07:15:15.837 | 3:22.456 | **FAILED_RAG_TIMEOUT**; timeout observed at 4:58.261. A single procedure-only retry also timed out. This is not a second six-minute PASS |

Both procedure calls used the separate fictional Zakładowa case: **“A jar of Pomada Matowa arrived cracked at Zakładowa. What should we do and what should we send HQ?”** No stock action was used for that case.

### Repetition1 answer assessment

Actual Gemini output had four instructions and three cited DAM-001 v1 chunks on physical page1. Agent comparison against the [synthetic authoring source](../synthetic-knowledge/damaged-delivery-v1.md):

| Returned instruction, summarized | Cited support | Agent assessment |
| --- | --- | --- |
| Identify damaged units separately, keep them out of saleable receipt, set aside and ask HQ for instructions | intake | Supported |
| Record salon, delivery reference, product details, affected quantity, damage and readable batch identifier or its unavailability | report | Supported; the question supplies salon/product identity |
| Take appropriate safe photos excluding people/customer data and use the established internal channel to the HQ coordinator | report | Supported |
| Retain report/reference and await HQ's disposition before inventory changes or disposal | report + decision | Supported; the answer does not itself authorize disposal or replacement |

The actual intake citation opened the original DAM-001 v1 PDF with a visible region highlight. Procedures Back retained the question and four-step answer. No reporting address, deadline, automatic replacement or refund entitlement was invented. The [earlier human approval](rag-claim-review-2026-10-24.md) covers its captured five-step answer, not a new blanket certification of this four-step output.

### Repetition2 timeout evidence

Cloud Run `answerprocedurequestion` recorded HTTP504 after **25.189878145s**, then **25.194011516s** for the explicit UI retry. The UI displayed “The answer took too long. Please try again.” These are real deployed failures, not injected faults. Existing logs do not identify whether admission, retrieval, generation or source recheck consumed the deadline; no cause or latency fix is claimed.

The accepted backend artifact lacks the repository's phase instrumentation. Raising the deadline or changing the model without stage evidence would hide the unknown cause. The next prepared publication below adds diagnostic metadata only.

## Data preservation

Knowledge and original-metadata digests matched before reset1, after each reset and after both procedure attempts:

| Scope | Unchanged SHA-256 |
| --- | --- |
| 5 documents, 7 versions, 6 operations, 9 pages, 19 chunks | `0d5db94d9156dcfc25061525a4ffef843e121066406dbf6ab9e2b0d33a57c52f` |
| Selected metadata/checksums and generations of 7 private originals | `fc69b2293c1f6cb1ec3498de818fe82fc6c02923f68f361a1db94ebddd9cb52c` |

Operational digests matched immediately before/after RAG in **each** repetition, including the second repetition's retry. Original bytes were not downloaded by the snapshot script; unrelated businesses/tables are outside this proof. No persisted chat or operational action followed from the procedure response.

After both resets, the existing HQ live session opened the original repetition1 intake citation again: DAM-001 v1, physical page1, exact chunk identity and visible PDF region highlight. Evidence: `rehearsal/source-after-both-resets.jpg`. This confirms the saved citation still resolves even though generating a new answer timed out.

## Genuine offline fallback

Captured from repetition1 and decoded from the local filesystem with the image viewer; the files have no network dependencies. Native screenshot bytes are JPEG, so `.jpg` replaces the plan's proposed `.png` names without re-encoding or editing the evidence.

- [Completed stock movement](../../artifacts/demo-fallback/stock-completed.jpg)
- [Actual grounded guidance](../../artifacts/demo-fallback/guidance.jpg)
- [Highlighted original source](../../artifacts/demo-fallback/source-highlight.jpg)

These are **a previous verified run**, never a fresh live answer. Actual projector readability and full offline presenter/browser handling have not been certified. No recording is promised.

## Diagnostic publication — executed

The owner subsequently authorized and continued the reviewed single-function publication. [Actual diagnostic result](rag-phase-diagnostics-2026-10-25.md): function ACTIVE on `answerprocedurequestion-00003-biv`; one production question HTTP200 in5.32s with all five stages measured. Previous timeouts did not reproduce and are not claimed fixed. Other13 functions and scoped data match baseline; `maxInstanceCount` changed from absent to20 and remains an unresolved configuration-preservation difference. Preview App Check still fails before protected calls; production Auth/App Check are valid. No further reset or stock action occurred.

The historical prepared candidate review remains available in `artifacts/rag-phase-diagnostics-2026-10-25/review.json`; it is not a current publication-status record.

## Remaining gates

1. Locate and resolve the real timeout, then obtain two successful full repetitions within six minutes with presenter narration checked separately.
2. Complete exact-origin protected-command/upload/concurrency gates and both-role live-origin coverage; this mixed-origin rehearsal does not waive them.
3. Confirm the chosen stage answer with the required human judgment, and check projector/mobile readability plus the full twenty-minute presentation.

Evidence: `.superpowers/sdd/2026-09-29-barberhq-05-demo-release/rehearsal/` holds timelines, SQL phase assertions, reset logs, sanitized Cloud Run metadata, screenshots and candidate build/review output. Hash/count snapshots are named `rehearsal-*` in the sibling `rollback/` directory. Fresh release records: `artifacts/releases/2026-10-25-rehearsal-{live-start,preview-final,live-final}.json`.
