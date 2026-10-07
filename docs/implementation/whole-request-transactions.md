# Whole-request transaction capability

7 October 2026. Native SQL is unnecessary for the bounded six-item demo.

The isolated connector compiles with pinned firebase-tools 15.32.0 and executes on SQL Connect's PostgreSQL emulator. One `@transaction` supports six aliased mutation groups, each enabled by `@include(if:$useN)`. Each group reads/guards current availability and version, updates inventory with the expected version and checks exactly one affected row, then inserts its item. The final audit insert participates in the same transaction. Skipped groups do not write.

The production adapter must sort product IDs before assigning slots, validate 1–6 distinct items, bind complete version/quantity sets, and validate membership/state inside the transaction. Native GraphQL `_insertMany` can insert heterogeneous item rows; heterogeneous guarded stock updates use the six bounded groups, not independent API calls. Keep fixed slots internal to the connector adapter, not in UI contracts.

Proof operation: `ApproveProbe(requestId:String!, allowed:Boolean!, p0..p5:String!, q0..q5:Int!, v0..v5:Int!, use0..use5:Boolean!)`. Fixture-only `allowed` characterizes a failing transaction guard; it is not production authorization. Production membership/role/salon authorization, all five lifecycle operations, full audit/key tables and canonical request ordering are exercised by Task 3's integration tests.

Seven tests prove successful 1/3/6-item heterogeneous changes, rollback after the first item changes and a later version guard fails, competing overlapping reservations (only one commits), a failing guard leaving no rows, and reservations counting against available stock. Initial missing-operation run failed four positive tests; an additional reservation test failed before adding the availability guard. All seven subsequently pass. Real Cloud SQL concurrency and App Check remain release gates.

Run from repository root in separate terminals:

```sh
./node_modules/.bin/firebase emulators:start --only dataconnect --project demo-whole-request-proof --config tests/capabilities/whole-request/firebase.json
./node_modules/.bin/firebase dataconnect:compile --project notbad-6be95 --config tests/capabilities/whole-request/firebase.json
npx vitest run --config tests/capabilities/whole-request/vitest.config.ts
```

Compilation does not deploy. The fixture uses SQL Connect9599, hub4401, logging4501; its PostgreSQL picked5433 while the demo used5432. Avoid starting two copies. Wait for connector reload after edits before running tests: an immediate test ran the previous operation until the watcher reloaded it. The existing demo service on9399 is untouched. Fixture-generated `.dataconnect` and logs are ignored.
