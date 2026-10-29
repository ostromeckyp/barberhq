# Delivery receipt — local verification

2026-10-25, implementation plan Task3. Prepared locally; not published or migrated in the cloud.

## Behavior

`recordDeliveryReceipt` uses the existing SQL runtime target resolver, Auth/App Check policy, region `europe-west1` and maxInstances5. It authorizes the current actor before looking up an idempotency result. A fixed six-slot GraphQL transaction rechecks scope, request revision/state, every dispatched item, destination inventory, selected published sources, and the active request slots.

One commit records the immutable receipt, distinct good/damaged/missing quantities, positive good-unit movements, final request state, optional root issue/items/event and command/key. Zero good units still produce an inspected receipt and problem, with no zero-valued stock movement. A source that is foreign, revoked or never published aborts the entire transaction with SOURCE_CHANGED. Facts can be resubmitted without that unavailable reference.

The old `receiveTransfer` path only reconciles an existing legacy result/key. A fresh old RECEIVE returns CLIENT_UPDATE_REQUIRED. The old stock-writing ReceiveStock operation is removed from the generated server connector/SDK. Historical ActionReceipt rows and keys remain readable.

## Evidence

- RED: all4 receipt-classification unit tests failed before validation/alignment;13 receipt integration assertions failed against the non-writing placeholder and legacy full-receipt path.
- GREEN:23 receipt integration cases plus5 access cases passed on local Auth/SQL emulators. Full root unit suite238/238, root typecheck and Functions build passed.
- Eight good/two damaged or missing: HQ8/reserved0, salon10 from initial2; one receipt/issue/event/key, terminal RECEIVED_WITH_ISSUE, no active request slot.
- All-good10: salon12, RECEIVED, no issue. Zero-good/missing10: salon2, explicit issue10, no RECEIPT movement.
- Six products retain independent quantities, with positive receipt movements1/5/7/8 and five affected issue lines.
- A failure on the last destination inventory rolls back earlier product writes and all receipt/issue/audit records.
- Invalid SKU, omitted/swapped quantities, stale revision and unauthorized actor leave the full SQL snapshot unchanged.
- Concurrent distinct keys produce one receipt; concurrent identical keys return the same command. A simulated transport failure after a real commit is reconciled with the original key.
- Access revoked before retry denies the result. An already committed legacy key returns its historical result without another stock movement.

Logs: `.superpowers/sdd/2026-10-25-delivery-receipts-and-issues/task-3-*`. A test run during schema file formatting briefly saw emulator schema reload failures; it was discarded and repeated after sources stabilized (28/28). Do not edit GraphQL while acceptance tests run. Run final SDK generation after emulator regeneration to preserve enum postprocessing.

HQ replacement accounting, bindings/read models, UI, backfill/reset and the final release package remain Tasks4–8; this report does not establish those acceptance conditions.
