# Increment 2b — whole requests, salon history and settings

Updated 8 October 2026. Implemented locally on `codex/foundation` using the approved Native plan. Cloud `notbad-6be95` has not been deployed or migrated. RAG/PDF/agent phases remain future work.

## Delivered behavior

- One request contains 1–6 distinct products (1–99 units each), one state/revision, one submission key and one timeline. Approval, dispatch and receipt apply atomically to every item. Damaged/incomplete receipt is blocked; no partial workflow.
- One saved immutable payload recovers a committed-but-lost submit response without duplicates. Legacy/unrecognized journals are preserved and block new submissions.
- Dashboard / Requests / Settings navigation. Salon identity/selection lives in the topbar. History defaults to All and includes Active, Received and Rejected; server filtering precedes pagination. Details preserve rejection reasons and return to bounded authorized list context.
- Versioned salon-specific low-stock settings in PostgreSQL, default2, integer0–2147483647. No client fallback. Concurrent writes require the expected version. Seed/reset preserve edited settings; missing defaults are inserted only.
- Angular Material, Archivo, signals, feature facades and data-access separation preserved. No component calls Firebase directly.

## Local verification

| Check | Result |
|---|---|
| `npm test` | 38 tests pass |
| `npm run test:web` | 39 tests pass, including final review regressions |
| `npm run typecheck` | Pass |
| `BARBERHQ_TEST_MODE=emulator npm run test:integration` | 30 tests pass |
| Browser suite | 11 scenarios verified; full pass initially found one contrast issue, affected foundation scenarios rerun after correction |
| `npm --prefix functions run build` | Pass; emitted `functions/lib/functions/src/index.js` loads all five exports |
| `npm run build:emulator` | Pass; public artifact inspection passes. Existing initial budget warning ~544kB vs500kB remains |

Browser evidence covers single-product 18→16 / 2→4, three-item quantities2/3/1 with HQ16/15/17 and salon4/5/3, six movements, one request/timeline, blocked damaged receipt, committed lost-response recovery with one key, rejection history/back context, settings isolation, 320/360/1280px and Axe/keyboard/dialog cancellation focus. Every test uses its own isolated business fixture. Screenshots are under ignored `artifacts/`.

Final independent review found one settings concurrency issue: a background read could advance the write version while retaining an older draft. The fix binds the draft to its reviewed version, preserves edits, displays a differing server threshold and blocks saving until explicit reload. Regressions cover dirty/pristine focus refresh and differing UNKNOWN recovery; a matching recovery read does not falsely confirm a save. Both settings browser scenarios passed again after the fix. Implementation fixes and documentation cleanup were delegated to GPT-6 Luna as requested; the parent reviewed the diff and independently verified the affected suites and build.

## Migration and current runtime

The original local demo was exported before schema edits to `artifacts/replenishment-upgrade/emulators-v1`; strict business backup is `before.json`. An isolated copy rehearsed conversion, repeat apply and full old-schema rollback.

Actual local restoration preserved Auth and PostgreSQL, imported10 missing item/movement records, then a second apply inserted0. Verification matched all6 original requests,4 active slots,2 transfers,2 movements,11 receipts,11 keys and24 inventory rows. Original4 Auth UIDs verified. Missing settings were inserted for all3 salons without changing inventory. No stock commands were replayed.

**Operator gate still pending:** the open user's browser recovery journal is not accessible through the browser tool. User was asked to evaluate `sessionStorage.getItem('barberhq.pending.v1') === null` in that tab. If false, save/reconcile the journal with the [upgrade guide](../replenishment-items-upgrade.md); never delete unknown evidence to unblock the UI. Auth/SQL are restored; stock Functions remain stopped until this check is resolved. Do not describe the interactive cutover as complete yet.

A separate `emulators-v2` export preserves the migrated state for restart. Preserve the v1 export and matching old schema/build for rollback. Never start a fresh empty emulator and seed over the preserved business for convenience.

## Implementation decisions and limits

- Six bounded native SQL Connect mutation groups passed real emulator atomicity/concurrency proofs; no SQL escape hatch added. Generator owns repeated operations.
- Stable hashed item IDs plus unique(request,product) avoid nested foreign-key complexity. Movement data moved additively into physical `stock_item_movement`; old table/backup retained until verification.
- Disabled mutation-group expressions use safe fallback indexes because `_expr` evaluates even when a group is skipped.
- Timestamp comparisons normalize trailing fractional zeros while preserving nonzero precision.
- Threshold chips are suppressed while settings are unavailable; stock remains independently visible.
- The migration CLI originally deadlocked on a dynamic circular import. Static import fixed it; actual CLI returned verified:true on first and repeat apply.
- Secondary navigation uses ink text and history rows use a white card surface to meet AA contrast. Cancelling a dialog no longer reloads/disables its focus target.
- Existing user-staged skills were preserved; no push, merge or cloud deployment performed.

## Remaining release gates

Complete browser-journal reconciliation and reopen local commands. Then independently verify provisioned Cloud SQL/SQL Connect, real project auth/concurrency, App Check enforcement, explicit schema migration review, Hosting preview/deployment/rollback, and the owner checklist. Emulator proof does not certify those gates. Continue the PDF/RAG/agent work only under its next approved increment, using the updated whole-request contracts.
