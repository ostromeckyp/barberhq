# Delivery receipts upgrade

Runbook date:2026-10-25. Cloud deployment was separately approved and executed on2026-10-26; see [deployment report](delivery-deployment-2026-10-26.md). No reset was performed. The steps below remain the operational sequence for future upgrades, with the recorded trial-backup exception for this execution.

## Behavior

A salon inspects each dispatched product as good/damaged/missing. Its good units enter stock immediately. The immutable inspection ends transit; an affected root receipt opens one delivery issue. HQ organizes an ordinary linked replacement request for outstanding good units. Approval and dispatch retain the normal stock workflow. A rejected child reopens review; a partly damaged child reduces entitlement only by its good units. Final good receipt resolves the issue automatically. Original facts remain visible.

Procedure assignments are business scoped and HQ managed. The app links selected versioned sources to the inspection/issue. Handling damaged goods follows that procedure; absent/unavailable procedures do not fabricate instructions or prevent recording facts. No push notifications or Firebase Cloud Messaging infrastructure are provisioned in this change.

## Local migration

`scripts/migrations/delivery-receipts.ts` exports the pure planner, paginated snapshot reader and guarded insert/verify executor. It reads original requests/items/transfers/actions/movements, balances, keys, business configuration and full knowledge/source metadata with stable ordering and100-row pages. Only a consistent old RECEIVED request with one actual RECEIVE action and matching per-product receipt movements can acquire a LEGACY receipt. Actor and time come from that action. DISPATCHED is never inferred as received. Existing conflicting receipts stop execution; no overwrites or new stock commands occur.

Dry-run is the CLI default. Every target is explicit. Example for an operator-owned emulator business:

```sh
DATA_CONNECT_EMULATOR_HOST=127.0.0.1:9399 node --import tsx scripts/migrations/delivery-receipts.ts --project demo-barberhq --service barberhq --location europe-west1 --business BUSINESS_ID
```

Apply additionally requires `--apply --confirm BUSINESS_ID --quiescent --snapshot-hash HASH_FROM_DRY_RUN`. The caller must keep all commands stopped throughout. The executor checks the actual Admin SDK project/service/location/server connector, rechecks the original snapshot hash before each receipt transaction, verifies the exact plan, and verifies everything afterward. Each header/items insert is atomic. A failed transport after one committed receipt is resumable with the original hash; the already committed receipt is verified and skipped. A native guard also verifies unchanged historical actor/time at insertion.

The local SQL target is `barberhq/europe-west1`; the approved cloud SQL target is `notbad-6be95-service/europe-west3`. Callable region remains `europe-west1`, with maxInstances5 and the existing runtime service account.

## Legacy client limits

The actual historical receipt dialog stores a frozen unknown StockAction in memory. There is no persistent old receipt-journal format to migrate. The backend authorizes and replays an existing old key; a new old-format RECEIVE gets CLIENT_UPDATE_REQUIRED without writes. Current compatibility code retains the original frozen command on that result. New delivery commands use a separate scoped recovery namespace. No unrelated browser storage is cleared.

An already cached older JavaScript bundle cannot gain persistence retroactively. Before rolling out, reconcile open old receipt dialogs while their memory is still available; then reload into the new UI. Do not promise recovery of a discarded old tab's memory. Browser compatibility tests exercise the real old wire payload/key through protected local callables, rather than claiming to execute an archived old bundle.

## Publication sequence — approval required

1. Stop all stock, issue, procedure-assignment and document commands; confirm no open unrecognized old receipt attempts. Record the current Hosting version, all affected function revisions, SQL schema/connectors and application manifests. Take an on-demand Cloud SQL backup and record its ID/status; rehearse restore to a separate instance and verify counts/hashes. Preserve original PDF objects and their generation/hash manifest. Do not point the application at an unverified restore.
2. Compare the prepared schema/connector manifest with the current source and generate the SQL migration review. Add tables, nullable links and terminal enum value with compatible schema validation. Review actual generated DDL and its rollback boundary before applying it.
3. Publish only the exact eleven stock/delivery function names in the isolated backend manifest. Preserve account, Auth/App Check, regions, quotas and `STOCK_SQL_SERVICE` / `STOCK_SQL_LOCATION` values. No AI, PDF, worker or document functions are in this package. Never run an unfiltered Functions deploy.
4. Run cloud dry-run with explicit project/service/location/business. Review the pending count and snapshot hash; then separately approved apply/verify while still quiescent. Preserve the operator report. No production reset is part of this upgrade.
5. Publish the exact frontend artifact to preview. Reload actual HQ/salon browsers, verify current App Check and private PDF access, then run an approved controlled stock/issue smoke and compare protected balances/source manifests. Local fixtures do not establish a hosted smoke pass.
6. After approval publish the same frontend artifact to live, verify its exact Hosting/build/config identifiers, and reopen commands.

## Recovery boundary

Before any new receipt/issue writes, rollback can restore the previously recorded compatible application/backend/schema state under the same stopped-command window, after proving no writes would be lost.

After the first partial inspection or replacement write, the old full-intact receipt writer and old five-state UI are incompatible. Do not roll back to them. Keep commands stopped and use a compatible read-only/forward-fix release. A backup restore must first be restored and verified in isolation, with all later real writes reconciled; never overwrite subsequent production activity with an older backup. Hosting rollback alone does not roll back SQL or function state.

## Evidence and pending work

Task reports and logs are retained in `.superpowers/sdd/2026-10-25-delivery-receipts-and-issues/`. Final artifact identifiers, review and gates are recorded in the handoff and review report. The2026-10-26 cloud execution completed additive DDL, backfill, eleven Functions, preview/live publication and approved hosted smoke. Managed backups are unsupported on this Cloud SQL No Cost Trial: a consistent logical dump and isolated application-data restore were used, with all21 tables matching. This does not establish managed full-instance/IAM/PITR recovery; see the deployment report for the exact boundary.

The approved Cloud SQL instance is `notbad-6be95-instance`, database `notbad-6be95-database`, project `notbad-6be95`. Backup/restore commands belong to the separately approved operator window: create an on-demand backup on that instance, wait for SUCCESSFUL, and record the exact returned backup ID. Test restore into a separately named isolated instance first; do not issue an in-place production restore as a generic rollback. The prepared schema bundle is a local source artifact, not an applied cloud migration or a backup.
