# Delivery receipt transaction capability proof

2026-10-25. Local capability gate for [the delivery plan](../superpowers/plans/2026-10-25-delivery-receipts-and-issues.md), Task1.

## Environment

- Installed Firebase CLI15.32.0; SQL Connect emulator3.4.21.
- Project `demo-delivery-receipt-proof`, service `delivery-receipt-proof`, connector `server`, region `europe-west1`.
- SQL Connect HTTP127.0.0.1:9699, hub4406, logging4506; emulator-owned PostgreSQL127.0.0.1:5432, database `delivery_proof`.
- All mutations use only private `Probe*` tables. No application/cloud records, private config, Auth changes or deployment.

Start with the repository's installed CLI:

```sh
node node_modules/firebase-tools/lib/bin/firebase.js emulators:start --only dataconnect --project demo-delivery-receipt-proof --config tests/capabilities/delivery-receipt/firebase.json
node node_modules/vitest/vitest.mjs run --config tests/capabilities/delivery-receipt/vitest.config.ts
```

## Observed results

RED: after fixing schema setup, all10 tests failed because `RecordProbe` was absent. GREEN: all10 passed after implementing the stored transactions. Logs are retained in `.superpowers/sdd/2026-10-25-delivery-receipts-and-issues/` (`task-1-red.log`, `task-1-green.log`, final task verification log).

| Case | Observed SQL state |
| --- | --- |
| Good8/damaged2 plus good0/missing3 | Two receipt items, balances8/0, one movement8, issue quantities2/3 |
| Stale inventory guard on final zero-good item | Full snapshot unchanged, including first item's balance, receipt, issue and audit |
| Two concurrent replacement requests at revision1 | One winner, one child/link, issue revision2 |
| Foreign receipt scope / stale request revision | Full snapshot unchanged |
| Foreign issue scope / stale issue revision | Full snapshot unchanged |
| Six heterogeneous items | Balances8/0/4/0/5/7, six receipt items, four positive movements |
| Incomplete item classification | Full snapshot unchanged |
| Repeat receipt after first commit | No second receipt or inventory change |

`RecordProbe` uses one `@transaction`, request compare-and-set, receipt uniqueness and separate per-slot `useN`/`moveN` flags. A zero-good item still runs its validation and creates its receipt row. `CreateReplacementProbe` uses issue compare-and-set plus a primary key on the active issue link, in the same transaction as child/audit insertion.

## Decision and limits

Proceed with native GraphQL transactions; no native SQL fallback is needed for these capabilities. This isolated proof verifies atomic writes, conditional zero-good movements, uniqueness and concurrency. It does not establish application authorization, idempotent command replay, replacement entitlement accounting, procedure availability, migration safety or UI behavior; those remain explicit tests in Tasks2–8. The probe's scope variable is test infrastructure, not a browser authorization pattern.
