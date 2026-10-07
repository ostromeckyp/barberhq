# Replenishment item upgrade

This is a coordinated preproduction upgrade. Do not reset the demo to bypass migration. Old browsers cannot continue writing while the schema and client contract change.

## Preparation and export

Stop command traffic: close other browser sessions and stop Functions while leaving Auth/SQL Connect available. A `--quiescent` declaration is an operator promise, not a distributed lock. Inventory reads may remain available. Keep the exact old schema/connectors from commit197f93c available for restoration. Backups cover the operational stock tables and inventories; unchanged business/catalog/member tables must remain in place.

Use an ignored private directory, for example `artifacts/replenishment-upgrade/`, and explicit target:

```sh
mkdir -p artifacts/replenishment-upgrade
DATA_CONNECT_EMULATOR_HOST=127.0.0.1:9399 npm run migrate:replenishment -- --project demo-barberhq --business not-bad-stuff-demo --confirm not-bad-stuff-demo --quiescent --export --backup artifacts/replenishment-upgrade/before.json
npm run migrate:replenishment -- --project demo-barberhq --business not-bad-stuff-demo --confirm not-bad-stuff-demo --quiescent --verify --backup artifacts/replenishment-upgrade/before.json
```

Export reads every page, writes mode0600 with exclusive creation, records counts/checksum and validates references, states, audit, movements and reservations. Verification is read-only. Restore requires the same project/business and preserved unchanged parent tables. Never apply a schema change before verifying the backup. Import/apply is added and rehearsed as part of the item-schema implementation; the tools at this stage deliberately cannot apply changes.

## Reconcile old browser submissions

Before closing each demo browser, inspect sessionStorage `barberhq.pending.v1`. If present, save its JSON to a private file; never paste passwords or auth tokens. Do not delete the entry merely to unblock the new app.

```sh
npm run reconcile:legacy-pending -- --journal artifacts/replenishment-upgrade/session.json --backup artifacts/replenishment-upgrade/before.json --report artifacts/replenishment-upgrade/session-report.json
```

The tool only reads files and writes a new report; it never sends stock commands. COMMITTED means the actor/key/payload match a retained receipt and request. Keep that request link. NOT_COMMITTED requires complete quiescent evidence with no matching key; manually recreate that line in the new draft only after the upgrade and explicit review. UNRESOLVED means mismatched or incomplete evidence: stop reconciliation and investigate. Unknown journal formats fail closed. The owner may clear the old entry only after the report is saved and every row resolved. A checksum detects corruption, not malicious tampering; keep backup files private.

## Conversion and cutover contract

Existing request IDs/states/timestamps remain. Stable item IDs hash the request/product pair; uniqueness of that pair is also a database constraint. Transfer headers retain request identity; transfer items reference the request item. Movement identity changes to transfer item/type while quantities/actors/timestamps remain byte-for-byte data values. Action receipts, original hashes and alias keys are retained unchanged. Conversion does not run approval/dispatch/receipt commands or alter inventory balances.

Install the target schema only while writers are stopped, import the verified conversion, compare all reconstructed records and inventory values, create missing salon settings at2 without overwriting existing settings, then deploy/rebuild matching Functions and Angular. Remove obsolete `lowStockThreshold` from private web config before rebuilding after Settings is implemented. Reload every client and verify the same history/stock. Partial import is not a successful upgrade; remain offline and resume using the same verified backup or restore the old schema/data. Exact apply/restore commands and disposable-database evidence must be added before cutover.

Cloud `notbad-6be95` uses the same explicit targeting rules and refuses emulator configuration. No cloud deployment or data mutation is authorized merely by running export/verify. Real Cloud SQL verification remains a release gate.
