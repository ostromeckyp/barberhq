# Polish procedure input — bounded production verification

26 October 2026. Two captured Polish-input cases pass on production backend `answerprocedurequestion-00004-hun`. **Full translation is deferred by the owner.** Inputs are Polish; answers and interface remain English. This is not an exhaustive language-quality or demo-readiness certification.

Target: [production Procedures](https://notbad-6be95.web.app/procedures), frontend `e56c6e784f80e9d1`.

## Supported question

The preceding approved [provider-retry publication smoke](rag-provider-capacity-2026-10-26.md) asked “Otrzymaliśmy uszkodzony produkt. Co powinniśmy zrobić?”. That captured call is reused here; it was not submitted again for this report.

| Captured instruction | Support in DAM-001 v1, page 1 | Agent assessment |
| --- | --- | --- |
| Identify affected units separately; do not receive them as saleable stock; set them aside while requesting HQ handling instructions. | `intake — Identify the affected items` states each action. | Supported |
| Prepare a report with salon, delivery/transfer reference, product/code, affected quantity, visible damage and batch ID or its unavailability. | `report — Prepare a damage report for HQ` lists those fields. | Supported |
| Include safe photos without people or customer information. | The report section specifies these limits. | Supported |
| Send through the established internal channel to the HQ delivery coordinator and retain the reference/details. | The report section specifies the recipient, channel and retention; no address is invented. | Supported |

The visible answer contains four steps and two source sections, each with a paragraph/PDF link. Authoring source: [damaged-delivery-v1.md](../synthetic-knowledge/damaged-delivery-v1.md); visible excerpts were captured with the published answer. This is agent source assessment, not a new human approval. The owner's earlier approval applies to the separate captured five-step answer documented in [claim review](rag-claim-review-2026-10-24.md).

## Unsupported question

One new question was submitted through the normal production HQ session: “Jaki środek dezynfekcyjny i w jakim stężeniu zastosować po rozlaniu uszkodzonego produktu?”. Expected behavior was recorded before submission: do not invent a disinfectant or concentration, and expose the lack of supporting instructions.

Result: **No supported answer / No eligible source supports this question.** No agent, concentration or handling instructions were invented. DAM-001 v1 explicitly excludes spill cleanup, chemical exposure, disinfection and disposal methods.

Cloud trace confirms HTTP200 with Auth and App Check VALID. Actor, admission and retrieval completed successfully; retrieval took443.68ms. **Generation was not invoked** because no eligible evidence passed retrieval. This verifies the retrieval abstention path, not model-level refusal with irrelevant evidence supplied. The UI's missing-evidence response was distinct from the generic unavailable/error state.

The call's POST latency was1.197s; its cold preflight took8.397s. No UI timing is inferred from the interval between manual observations.

## Scope and continuation

No code, model, prompt, config or document changes and no deployment, stock command or reset occurred. Normal AI admission recorded the authorized question. Existing owner tabs were preserved; a separate test tab shows the captured result. No broad before/after business snapshot comparison is claimed.

The planned positive/unsupported Polish-input check has evidence on the current backend. Full Polish output, dictated replenishment quality, two successful full demo rehearsals and presenter/mobile/projector acceptance remain separate work. The existing parser still permits only `answerLanguage: 'en'`; the owner explicitly deferred full translation.

Local evidence: `.superpowers/sdd/2026-10-26-polish-procedure-verification/`: `cases.json`, `unsupported-phases.json`, `verification-proof.json`, `unsupported-live.png`. Positive evidence is retained in the provider-retry publication folder. An additional **read-only** query counted102 operational rows, including5 requests/3 active slots/1 issue, and24 inventory rows for a possible later rehearsal reset. This is not a reset, a claim that the app is idle, or reset authorization.

Rehearsal preparation found the existing Chrome production session is HQ. An independent in-app browser production tab opens the ordinary sign-in screen, so a separate SALON login is still needed before both-role live-origin testing. No credentials were read or supplied. Do not reset while waiting for that session and explicit quiet-window/reset confirmation.
