# Production demo rehearsals — 27 October 2026

**Both functional scenarios completed twice. Timing gate remains open:** repetition1 took5:40.138; repetition2 took6:30.059, including a3:57.413 inspection/resumption gap between receipt and submitting the procedure question. No subtraction is used to claim a second six-minute pass. These instrumented timings include browser/tool/SQL work and exclude login/reset setup; they do not certify presenter narration or the twenty-minute talk.

## Environment and authorization

The owner explicitly approved two resets and two complete trials, confirmed the app idle and subsequently signed in SALON in Chrome and HQ in Codex's browser. Both roles were visibly verified on **https://notbad-6be95.web.app** before reset1. This establishes separate live-origin sessions; it does not establish two Chrome profiles.

Frontend `e56c6e784f80e9d1`, build `9933e54a48c473b979b49564626a1a84c23e207112b76c9327b15003a5270817`; procedure revision `answerprocedurequestion-00004-hun`. Fresh start/final release guards passed66 files, with backend fingerprint `sha256:ab1aafd0e174669e08ddffce4afd94902c366bf174348df82e196bfb11cf8c1c`. No deployment or corpus mutation occurred during the trials.

## Reset and stock proof

Reset1 deleted the approved102 scoped operational rows and reset24 inventories. Reset2 deleted16 rows created by repetition1 and reset24 inventories. Settings, document tables and original metadata were preserved. No third reset occurred.

Both actual UI runs used “Send two units of Pomada Matowa 100 ml to Legnicka”, followed by explicit request submission, HQ approval/dispatch, SALON **Mark all as good**, and explicit **Record inspection**. SQL assertions passed at every phase:

| Phase | HQ on hand | HQ reserved | In transit | Legnicka on hand |
|---|---:|---:|---:|---:|
| Initial |18|0|0|2|
| Reserved |18|2|0|2|
| Dispatched |16|0|2|2|
| Received |16|0|0|4|

Each completed request had requested/dispatched/received2, exactly one DISPATCH2 and one RECEIPT2, one recorded inspection with2 good/0 damaged/0 missing and no issue. Other Matowa salon balances stayed2. The first request `a44e138f-4ee6-4fdd-8dff-7c6abaed7950` was removed by reset2. Retained request: `b6b64a81-6e65-4949-9449-3d76da33f137`, RECEIVED. Final HQ16 / Legnicka4; no active request remains.

One operator assertion initially expected the new receipt transaction not to update transfer received quantity. The deployed GraphQL transaction explicitly updates it to the good quantity; correcting that assertion yielded PASS. This was a verification-script error, not a production fix. An IAB dispatch-dialog wait once timed out; inspection and SQL confirmed DISPATCHED, and the command was not repeated.

## Procedures and original PDF

Each run asked the separate fictional question: “A jar of Pomada Matowa arrived cracked at Zakładowa. What should we do and what should we send HQ?” It did not create an issue, request or stock movement for Zakładowa.

Both returned grounded guidance, opened DAM-001 v1 physical page1 with the actual intake paragraph highlighted and returned through Procedures Back to the retained question/answer. Cloud Run recorded Auth VALID / App Check VALID and HTTP200 in **4.187914992s** and **5.302884320s**. Both generation/recheck paths completed on revision00004; no timeout reproduced. This does not prove earlier intermittent timeouts can never recur.

Agent comparison with [the synthetic source](../synthetic-knowledge/damaged-delivery-v1.md):

| Actual answer instruction, summarized | Citation | Assessment |
|---|---|---|
| Run1: identify affected units separately, keep out of saleable receipt, set aside, ask HQ | intake | Supported |
| Run1: report salon/reference/product/code/quantity/damage/batch or unavailable, safe photos | report | Supported |
| Run1: use established channel to HQ delivery coordinator, retain reference/details | report | Supported |
| Run1: await HQ replacement/return/other disposition; no automatic stock/replacement action | decision | Supported |
| Run2: identify separately, keep affected unit out of saleable stock, set aside pending HQ | intake | Supported |
| Run2: send the specified report details and safe photos through established internal channel | report | Supported |
| Run2: retain reference/report; await HQ instructions without premature stock changes | report + decision | Supported |

Run2 explicitly identified missing product code, shipment reference and internal-channel details; no invented address/deadline/refund entitlement. The [24 October human review](rag-claim-review-2026-10-24.md) covers its captured five-step answer only. These new four-/three-step answers have agent assessment; human certification of a chosen stage answer remains separate.

## Preservation and limitations

Before/after each RAG answer, operational, settings/bindings, knowledge and original-metadata hashes matched exactly. Across both resets, protected hashes remained:

- Settings/bindings: `cdcf2be7c9f563a50d7953693993e55f0c817cdfedc9ee6b12b0341efbb9fbf2`.
-5 documents/7 versions/6 operations/9 pages/19 chunks: `0d5db94d9156dcfc25061525a4ffef843e121066406dbf6ab9e2b0d33a57c52f`.
-7 originals' selected metadata/generations/checksums: `fc69b2293c1f6cb1ec3498de818fe82fc6c02923f68f361a1db94ebddd9cb52c`.

Snapshot scope includes the new delivery tables and excludes expected AI admission-quota updates. This is scoped preservation proof, not a full database backup or byte-for-byte download of every original. Both-role live-origin positive flows now pass. Protected upload, concurrency, remaining negative/exact-origin checks, projector/iPhone acceptance, human answer assessment and spoken timing remain separate gates. Full translation is deferred.

Private evidence: `.superpowers/sdd/2026-10-27-demo-rehearsal/` — reset summaries, phase assertions, hash snapshots, timelines, sanitized Cloud Run stages, release guards, actual answer/source screenshots. Do not publish the private data snapshots. Existing offline fallbacks remain labeled prior-run evidence.
