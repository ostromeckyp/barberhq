# BarberHQ — two-use-case demo runbook

Updated 26 October 2026: the application and both assistants are deployed on [production](https://notbad-6be95.web.app), frontend version `e56c6e784f80e9d1`. Procedure backend `answerprocedurequestion-00004-hun` includes the [bounded429 retry and successful control question](implementation/rag-provider-capacity-2026-10-26.md). [Polish procedure-input checks](implementation/polish-procedure-inputs-2026-10-26.md) passed for supported and unsupported examples; full translation is deferred. [Latest production rehearsals](implementation/demo-rehearsal-2026-10-27.md): both stock/RAG/PDF flows completed with separate SALON/HQ live sessions. Times5:40.138 and6:30.059 include operator checks and a3:57 inspection/resumption gap in run2. A second uninterrupted six-minute/presenter pass remains open. The schedule below remains a six-minute **target** for the spoken demo. Real brand, products and salon names; synthetic inventory and procedures. Simulate physical dispatch/receipt with explicit confirmations.

Before the stage run, use the [release check](implementation/release-verification.md), [acceptance index](implementation/acceptance-coverage.md) and [current handoff](implementation/handoffs/increment-5.md). Preview/live share data. Reset requires an agreed quiet window and an explicit scope; ordinary seeding preserves stock and does not replace reset.

## A. Measurable replenishment — first 3:45

Product: Pomada Matowa 100 ml, demo ID `NBS-MATOWA-100`. Initial HQ on hand 18, reserved 0; Legnicka on hand 2. No open transfer. Individual retail units, no six-unit packs or automatic target stock.

Prompt: **“Send two units of Pomada Matowa 100 ml to Legnicka.”**

Polish option: **“Wyślijcie na Legnicką dwie sztuki Pomady Matowej 100 ml.”**

| Time | Action | Visible proof |
|---|---|---|
| 00:00–00:30 | Show initial stock and selected salon | HQ 18; Legnicka 2 |
| 00:30–01:15 | Submit the prompt; inspect product/stock tool events | Requested quantity 2; availability confirmed |
| 01:15–02:00 | Send request; switch to HQ and approve | On hand 18, reserved 2, available 16 |
| 02:00–02:45 | HQ confirms dispatch of 2 | On hand 16, reserved 0, in transit 2 |
| 02:45–03:30 | Legnicka opens Check delivery, uses Mark all as good, verifies2 good/0 damaged/0 missing and explicitly records the inspection | Salon on hand4, in transit0 |
| 03:30–03:45 | Show completed timeline | Requested 2 / dispatched 2 / received 2 |

Say: “We asked for two and received two. HQ has two fewer, Legnicka has two more. The model understood the request; ordinary application actions updated stock.” Do not pretend goods physically traveled during the stage demo.

## B. Damaged delivery guidance — next 1:45

Switch to the procedure assistant and the **separate fictional Zakładowa delivery scenario `DEMO-DAMAGE-01`**. It is not the completed Legnicka transfer and has no stock ledger effects.

Prompt: **“A jar of Pomada Matowa arrived cracked at Zakładowa. What should we do and what should we send HQ?”**

Polish option: **“Na Zakładową dotarł pęknięty słoik Pomady Matowej. Co mamy zrobić i co przekazać do centrali?”**

| Time | Action | Visible proof |
|---|---|---|
| 03:45–04:00 | Introduce independent scenario and synthetic documents | “Synthetic demo procedure” label |
| 04:00–04:45 | Ask the question; show retrieval event | Current DAM-001 v1 intake/report sections retrieved |
| 04:45–05:15 | Inspect answer and open the PDF citation at its highlighted passage | Instructions supported by the original section text |
| 05:15–05:30 | Explain read-only boundary | No report sent, no replacement promised, no stock changed |

Expected answer content, paraphrased from the synthetic corpus: identify affected units separately; do not count them as saleable receipt; prepare salon/delivery/product/quantity/damage details, readable batch identifier if available and appropriate photos; report through the established channel to the HQ delivery coordinator. HQ determines the resolution. Do not invent a reporting address, claim deadline or refund entitlement.

## Last 30 seconds

Contrast the business outcomes: **complete a stock movement** and **find the relevant procedure**. Return to slides by minute 10 of the talk. Omit extra ambiguity examples if time is short; keep both primary use cases.

## Source data

- [Six real products](04-not-bad-stuff-catalog.md), including Matowa, Dry Matt, Cement, Sól Morska, Savage and Mattifier.
- Real salons supplied by the presenter: Legnicka, Łódzka, Zakładowa.
- [Synthetic corpus](synthetic-knowledge/README.md): current damage/discrepancy/replenishment documents and a retired damage document for filtering proof.
- Do not index the corpus README or this runbook as company procedures. They contain test expectations and presenter instructions.

## Failure plan

- At 15 seconds of AI waiting, explain what the tool is checking. At 25 seconds, use a clearly labeled offline fallback only if that verified file has actually been captured; otherwise explain the unavailable path and continue without inventing a result.
- Manual product/quantity entry remains available for the replenishment path.
- If sources are missing or irrelevant, show the insufficient-evidence response. Do not improvise procedure content as though retrieved.
- If a transition fails, inspect current state; do not repeat a different action to force completion. A retry must use the same action identity.
- Network/auth failure: explicitly introduce the actual previous run, then open [stock completed](../artifacts/demo-fallback/stock-completed.jpg), [grounded guidance](../artifacts/demo-fallback/guidance.jpg) and [highlighted source](../artifacts/demo-fallback/source-highlight.jpg). These native JPEGs were captured from repetition1 and decoded locally without network dependencies. Full offline presenter handling/projector readability still needs a human check; no recording is promised.
- Never portray screenshots, cached responses or recordings as a fresh live run.

## Rehearsal checklist

- [ ] Two browser profiles are signed into salon/HQ roles with correct permissions.
- [x] Two approved operational resets restored HQ18/reserved0 and Legnicka2 with no open request. The last run is now completed at HQ16 / Legnicka4; request a new quiet window before a later reset.
- [ ] Each stock transition matches the specification; duplicate dispatch/receipt cannot change stock twice.
- [ ] Current synthetic sources are ingested; retired/foreign/revoked sources are excluded before retrieval; the cited region is highlighted from actual extraction geometry.
- [ ] HQ library upload/review/replace/withdrawal and one atomic multi-item request pass readiness checks using separate fixtures; keep the stage corpus fixed.
- [ ] At Legnicka2 the Low stock marker appears; after receipt at4 it disappears. Multi-product drafts remain available but the timed stock proof uses the single Matowa line.
- [ ] All corpus retrieval cases are checked; answer text actually follows its cited evidence.
- [x] Damaged-delivery scenario is separate and read-only; operational hashes before/after RAG matched in each rehearsal, including the timeout retry.
- [ ] Synthetic labels are visible; public product information is identified separately.
- [ ] Polish prompts are validated separately if chosen for the talk. Current procedure positive/unsupported examples have [bounded production evidence](implementation/polish-procedure-inputs-2026-10-26.md); the exact stage prompts and dictated replenishment are not certified by those two cases. Full translation is deferred.
- [ ] Two required full repetitions record correctness and actual elapsed time; additional practice is optional. No numerical savings are claimed without pilot evidence.
- [x] Three genuine fallback JPEGs exist and decode from the local filesystem; always label them as the previous successful run.
- [ ] Projector readability and the presenter's complete offline fallback handling are checked.
- [ ] Both scenarios finish within six minutes; the whole talk is twenty minutes excluding Q&A.

## Implemented manual replenishment rehearsal

See [increment 2 handoff](implementation/handoffs/increment-2.md) for startup and guarded reset, and the later [cloud evidence](implementation/handoffs/replenishment-cloud.md) for its scope and outstanding gates. Use distinct HQ and Legnicka browser profiles for final live-origin acceptance. Request2, approve, dispatch2, confirm exactly2 intact: target HQ16, Legnicka4, transit0. [25 October rehearsals](implementation/demo-rehearsal-2026-10-25.md) reused SALON-preview/HQ-live sessions: stock passed twice, full guidance/highlight/Back passed once; second RAG call/retry timed out. The earlier captured five-step answer has [human approval](implementation/rag-claim-review-2026-10-24.md), which does not automatically approve a different generated answer.

Reset is an operator CLI action, never a staff menu. Close user sessions first; ordinary `dev:seed` preserves stock and does not reset completed transfers.
