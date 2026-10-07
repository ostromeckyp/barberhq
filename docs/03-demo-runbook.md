# BarberHQ — two-use-case demo runbook

Planning only; no working application is claimed. Six minutes inside the 20-minute talk. Real brand, products and salon names; synthetic inventory and procedures. Simulate physical dispatch/receipt with explicit operator confirmations.

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
| 02:45–03:30 | Legnicka confirms intact receipt of 2 | Salon on hand 4, in transit 0 |
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

- At 15 seconds of AI waiting, explain what the tool is checking. At 25 seconds, stop waiting and show the labeled recording for that AI segment.
- Manual product/quantity entry remains available for the replenishment path.
- If sources are missing or irrelevant, show the insufficient-evidence response. Do not improvise procedure content as though retrieved.
- If a transition fails, inspect current state; do not repeat a different action to force completion. A retry must use the same action identity.
- Network/auth failure: use a local recording of both use cases, explicitly labeled prerecorded.
- Never portray screenshots, cached responses or recordings as a fresh live run.

## Rehearsal checklist

- [ ] Two browser profiles are signed into salon/HQ roles with correct permissions.
- [ ] Fixture reset restores HQ 18/reserved 0 and Legnicka 2; no open transfer exists.
- [ ] Each stock transition matches the specification; duplicate dispatch/receipt cannot change stock twice.
- [ ] Current synthetic sources are ingested; retired/foreign/revoked sources are excluded before retrieval; the cited region is highlighted from actual extraction geometry.
- [ ] HQ library upload/review/replace/delete and multi-product partial-submit behavior pass readiness checks using separate fixtures; keep the stage corpus fixed.
- [ ] At Legnicka2 the Low stock marker appears; after receipt at4 it disappears. Multi-product drafts remain available but the timed stock proof uses the single Matowa line.
- [ ] All corpus retrieval cases are checked; answer text actually follows its cited evidence.
- [ ] Damaged-delivery scenario is separate and read-only; guidance leaves the ledger unchanged.
- [ ] Synthetic labels are visible; public product information is identified separately.
- [ ] Polish prompts are validated separately if chosen for the talk.
- [ ] Ten rehearsals record correctness/latency; no numerical savings are claimed without pilot evidence.
- [ ] A successful local recording is ready and readable on the projector.
- [ ] Both scenarios finish within six minutes; the whole talk is twenty minutes excluding Q&A.

## Implemented manual replenishment rehearsal

See [increment 2 handoff](implementation/handoffs/increment-2.md) for startup, test and guarded reset commands. Use separate browser profiles for HQ and Legnicka. Request 2 Pomada Matowa; HQ approves and dispatches; Legnicka confirms exactly 2 intact units. End state: HQ16, Legnicka4, transit0. The procedures/RAG scenario remains a later increment.

Reset is an operator CLI action, never a staff menu. Close user sessions first; ordinary `demo:local` preserves stock and does not reset completed transfers.
