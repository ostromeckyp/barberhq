# 4B — procedure questions and cited PDFs

24 October 2026. **IN PROGRESS: real hosted answers and cited PDFs verified; human claim review pending.** Five real calls passed Auth/App Check and runtime SQL/Vertex access. See [hosted acceptance](../rag-hosted-acceptance-2026-10-24.md).

## Implemented

The [retrieval handoff](rag-retrieval.md) records the calibrated, scoped SQL search. The [answer backend](rag-flow.md) adds a stateless English answer flow, shared AI admission/budget, source-derived citations and a final source/access recheck. Both server queries and the new callable are published in `notbad-6be95`. Runtime read-back and unauthenticated rejection passed. On 24 October five authorized hosted questions returned HTTP 200 with valid Auth/App Check; the rehearsed answer opened three real cited PDF sections with highlights.

The Angular `/procedures` page offers Assistant and Documents tabs when both knowledge and RAG are enabled. Existing `?tab=documents` links and the document-only experience remain available. The shell label follows the enabled capability. A typed Firebase callable adapter supplies controlled errors and rejects malformed or uncited answers. A feature facade keeps transient state, prevents duplicate submission, resets on account/workspace changes and ignores stale completions.

The assistant distinguishes loading, answer, clarification, insufficient evidence and operational failure. Existing delayed-loading behavior suppresses short flashes. Each cited step shows escaped text, exact source excerpt, title, version, physical page and synthetic/unofficial provenance, with a link into the existing PDF viewer. Historical-version and revoked-source handling remain with that viewer. The Zakładowa `DEMO-DAMAGE-01` example is separate from replenishment and performs no stock action.

## Verification

- Full Angular suite: **26 files / 112 tests passed**; root typecheck passed.
- Standard development and production Angular builds passed with Node 22.22.3 and `NG_BUILD_MAX_WORKERS=2`. The worker's sandboxed development build exited 134 without diagnostics; the same target passed in the controller's permitted environment without an application workaround.
- Isolated browser tests: **2 passed on desktop; 2 passed at 390×844**. They verify visible source provenance/excerpt and the version/chunk/page link into a rendered PDF with two highlights. The callable response and PDF download are fixtures; SQL/Auth and viewer rendering run locally. This is UI proof, not model-grounding proof.
- Independent scoped review passed after correcting the browser test's URL encoding and highlight cardinality assertions. Graph update passed; the graph does not include untracked source and is not a substitute for the scoped diff review.
- Production candidate: 57 public files; SHA-256 `8c3162d55865acb1f12a77a8ca042207c970d3037a82173e8280b4961abd3c61`. Artifact inspection and explicit project/site verification passed. Angular emitted a non-blocking initial bundle warning: 545.02 kB against the 500 kB warning budget, below the 1 MB error budget.

Evidence: `artifacts/rag-flow/ui-test/e2e-final.log`, `e2e-mobile.log` and mobile screenshots; `artifacts/rag-flow/ui-preview/production-build.log` and `build-record.json`. The scoped implementation/review records are under `.superpowers/sdd/2026-09-29-barberhq-04b-procedure-rag/`.

The controller stopped the isolated Angular/Auth/SQL processes, removed its auto-removing tmpfs PostgreSQL container and restored both generated public configuration files to their exact pre-test bytes. Existing cloud fixtures and stock data were not changed.

## Hosted acceptance, 24 October

- Five real English browser questions passed Auth/App Check and returned HTTP 200 in **0.54–16.70 s**. Actual runtime SQL/Vertex access is now verified; no provider or App Check configuration change was needed. The earlier reCAPTCHA connection failure was not reproduced; its cause is not established.
- The rehearsed cracked Matowa scenario returned five steps with DAM-001 v1 citations. Three distinct chunks opened physical page 1 with correct excerpts and visible highlights. The authenticated browser actor was Legnicka; Zakładowa was the separate fictional scenario in the question, not a verified second login.
- Product fact returned 100 ml from CAT-001 v1. The mixed question disclosed missing disinfectant concentration; an absent carrier deadline abstained. The automatic-replacement question also abstained despite a decision section existing in the corpus: retain this **known completeness miss**. Four of five expected case behaviors were met; five HTTP 200s are not five grounding successes.
- All eight corpus/business hashes stayed equal. No stock command, document mutation, schema/config/source edit or new publication was performed.
- Strict `npm run eval:rag` replay passed for the existing 20 measured retrieval cases. It remains retrieval-only; live answer results are separate hosted-browser evidence, per the ledgered Task 3 tooling ruling.

Full evidence and limits: [24 October report](../rag-hosted-acceptance-2026-10-24.md). Raw/local artifacts: `artifacts/rag-flow/hosted-2026-10-24/`.

## Remaining acceptance

1. **Human review of every rehearsed instruction**: [five-step comparison](../rag-claim-review-2026-10-24.md) prepared; owner response pending. Citation validity and agent analysis do not replace the human judgment required by plan 4B.
2. Keep the known retrieval misses and one unconfirmed return-to-inventory observation visible. No speculative routing/model fix was made. Polish output remains disabled.
3. Complete final integrated mobile/state/release/rollback and two timed rehearsal gates in plan 5. No complete 4B READY verdict or final presentation-readiness claim is made before the human gate and remaining required evidence.

The 25-second deadline cannot cancel an embedding already in flight in the pinned SDK; late results cannot continue to SQL or reach the user. Test browser tab closed after capture; other user tabs untouched.

## Owner claim review received, 24 October

The owner explicitly confirmed all five rehearsed instructions against DAM-001 v1: “Potwierdzam zgodność wszystkich 5 kroków”. This closes the human gate for the captured stage answer only. Earlier pending statements are historical; the known replacement-decision completeness miss and navigation observation remain documented. Continue final integrated release/rehearsal checks; this is not general answer-quality certification.
