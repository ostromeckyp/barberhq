# RAG hosted acceptance — 24 October 2026

**Hosted runtime verified; human claim review pending.** Existing Gemini 3.8 Flash in `eu`, unchanged embedding model/threshold, existing `foundation` preview. No model/configuration/source change or new publication was made.

Five real signed-in English questions returned HTTP 200 with **Auth VALID / App Check VALID**, **0.54–16.70 s**. This now proves actual runtime SQL/Vertex access. The previous reCAPTCHA connection failure was not reproduced in these requests; its original cause and any permanent fix are not established.

## Case results

| Case | Observed result | Assessment |
|---|---|---|
| Rehearsed cracked Matowa at fictional Zakładowa | Five cited steps: separate affected units, report details, safe photos, internal report to HQ, HQ disposition/no stock change | Agent found support in DAM-001 v1; **human review pending** |
| Net content of Pomada Matowa | 100 ml, CAT-001 v1 p1, unofficial-public-source label | Expected behavior met |
| Report cracked jar + disinfectant concentration | Supported reporting steps; concentration listed as missing information | Expected partial-answer boundary met; no concentration invented |
| Carrier legal claim deadline | “No eligible source supports this question.” | Expected abstention; no deadline invented |
| Automatic replacement for damaged delivery | Insufficient evidence: supplied evidence describes reporting, not automatic replacement | **Known retrieval/answer completeness miss**. DAM-001 decision contains the answer, but the flow did not deliver it. No automatic promise invented. |

These are **4/5 expected case behaviors**, not five successful grounding verdicts. Five HTTP successes establish transport/runtime acceptance, not answer quality. The existing calibrated replacement-decision miss remains visible; no threshold tuning or question-specific answer mapping was introduced.

## Cited PDFs

The rehearsed answer exposed three distinct DAM-001 v1 chunks on physical page 1: `not-bad-stuff-demo:DAM-001:v1:1:2` (intake), `:1:3` (report), `:1:4` (decision). The real Open PDF link and subsequent observed source routes displayed the correct source text and visible highlights. Screenshots were inspected. Each captured page had nine visible highlight rectangles. The source visibly states it is synthetic, invented demo guidance, not official policy.

The browser actor was **Salon — Legnicka**; the question describes Zakładowa as the independent fictional scenario. This is not proof of a separate Zakładowa login session. Later diagnostic cases preserve visible answer/source text; their complete page-local source-ID arrays were not captured. The rehearsed answer's six citation links/three distinct chunks were captured.

One unexpected return to inventory was observed after direct PDF navigations. Relevant routing/session/viewer code was inspected, but no cause was established and no speculative patch was made. The subsequent in-app Procedures navigation and questions worked. This remains a manual-navigation observation to monitor, not a claimed fix or a demonstrated source authorization failure.

## No-write and replay evidence

All eight corpus/business hashes matched around the full question/PDF test window: documents, versions, pages, chunks, inventory, requests, transfers and movements. No stock command or document mutation was issued; only the ordinary shared AI admission window could change. The five RAG calls followed five ordering calls in the same user/hour; no further model request was sent to evade the shared limit.

`npm run eval:rag -- --input artifacts/rag-retrieval/calibration.json --output artifacts/rag-flow/hosted-2026-10-24/retrieval-evaluation.json` passed strict replay for 20 measured cases. It remains **retrieval-only replay**, not 20 new answer tests or new provider calls.

Ruling against the historical Task 3 tooling step: actual hosted UI questions and separate answer/claim records supply the live-generation evidence; the strict retrieval CLI remains unchanged. This avoids a second provider batch and proves real Auth/App Check/runtime access. The tradeoff is manual answer replay rather than a new automated live-answer CLI mode. No source change required TDD or a new deployment.

## Human gate and next plan

The [five-step source comparison](rag-claim-review-2026-10-24.md) is ready for the owner. The plan explicitly requires a human to assess each rehearsed instruction. Agent support assessment does not replace that judgment, and no full 4B READY verdict is recorded.

After that gate, continue plan 5: view/state/mobile/keyboard coverage; concrete same-version promotion/rollback preparation; scoped reset and two timed six-minute rehearsals. Actual live promotion or a destructive reset remains a separately reviewable action. Full hosted fulfillment and the unconfirmed navigation observation remain open.

Evidence under `artifacts/rag-flow/hosted-2026-10-24/`: `browser-evidence.json`, `acceptance-summary.json`, `runtime-logs-proof.json`, `live-before.json`, `live-after.json`, `retrieval-evaluation.json`, `guidance.jpg`, `source-intake.jpg`, `source-report.jpg`, `source-decision.jpg`. No tokens, credentials or raw personal identifiers were retained in these records. Test tab closed after capture; other user tabs untouched.

## Owner claim review received, 24 October

The owner explicitly confirmed all five rehearsed instructions against DAM-001 v1: “Potwierdzam zgodność wszystkich 5 kroków”. This closes the human gate for the captured stage answer only. Earlier pending statements are historical; the known replacement-decision completeness miss and navigation observation remain documented. Continue final integrated release/rehearsal checks; this is not general answer-quality certification.
