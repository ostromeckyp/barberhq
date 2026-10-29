# RAG — human review of the rehearsed answer

24 October 2026. **Owner confirmed all five steps on 24 October 2026:** “Potwierdzam zgodność wszystkich 5 kroków”. Actual hosted Gemini 3.8 answer, not a fixture. The authenticated browser session was Salon — Legnicka; the question describes the separate fictional Zakładowa case and performs no stock action.

Question: “A jar of Pomada Matowa arrived cracked at Zakładowa. What should we do and what should we send HQ?”

Source: **DAM-001 v1, physical page 1**, explicitly labeled **Synthetic demo procedure**. This is invented demonstration guidance, not an actual company policy. The [authoring source](../synthetic-knowledge/damaged-delivery-v1.md) and original PDF were compared by the agent; human approval is recorded from the explicit owner response.

| Step returned by the model | Source section and support observed | Human judgment |
|---|---|---|
| Identify the affected product and quantity separately from intact items, do not mark the cracked jar as received in saleable stock, and set the affected item aside from stock intended for sale or salon use. | **intake**: separate damaged/intact units; do not mark damaged units as saleable receipt; set aside. | Supported — owner confirmed 24 October |
| Prepare a damage report detailing the salon (Zakładowa), delivery or transfer reference, product name (Pomada Matowa) and code, number of affected units, a short description of the visible damage, and the batch identifier (or state that it is unavailable if unreadable). | **report**: all listed fields, readable batch ID or record unavailable. Salon/product come from the question. | Supported — owner confirmed 24 October |
| Include photos of the affected product and relevant packaging taken safely, avoiding people and customer information. | **report**: photos when safe; avoid people and customer information. | Supported — owner confirmed 24 October |
| Send the report through the salon's established internal reporting channel to the HQ delivery coordinator and retain the delivery reference and report details. | **report**: established internal channel, HQ delivery coordinator, retain reference/details; no address invented. | Supported — owner confirmed 24 October |
| Await HQ disposition for handling instructions, as HQ will determine whether replacement, return, or another resolution applies. Do not alter inventory merely from reporting. | **intake + decision**: HQ supplies handling instructions/decides resolution; no automatic replacement, refund, claim or disposal; no stock change from guidance. | Supported — owner confirmed 24 October |

The three distinct cited chunks opened DAM-001 v1, page 1, with the correct quoted section and visible PDF highlights. Screenshot evidence is under `artifacts/rag-flow/hosted-2026-10-24/`: `guidance.jpg`, `source-intake.jpg`, `source-report.jpg`, `source-decision.jpg`; exact visible answer and source routes are in `browser-evidence.json`.

Agent assessment: the five steps agree with the cited text. No reporting deadline, disinfectant concentration, refund entitlement or automatic replacement promise was introduced. The separate required human review is now recorded above.

Approval applies to this captured answer; the model can produce a different answer on a later request.
