# Increment 2 — manual replenishment

Status: LOCAL IMPLEMENTATION, cloud release gate still BLOCKED. This is not deployed concurrency/App Check proof. Project `notbad-6be95` still requires the owner configuration described in increment 1.

## Implemented

- Five authenticated callable commands: `submitRequest`, `approveRequest`, `rejectRequest`, `dispatchTransfer`, `receiveTransfer` (Node 22, europe-west1). App Check enforcement is enabled outside the Functions emulator.
- Generated SQL Connect admin SDK; server connector operations use `NO_ACCESS`. Transactions combine state/revision guards, inventory versions, affected-row checks, reservations, transfers and audit movements.
- Request state: PENDING_APPROVAL → RESERVED → DISPATCHED → RECEIVED, or PENDING_APPROVAL → REJECTED. Quantity 1–99; full/intact receipt only; trimmed rejection reason 1–500.
- ActiveRequest uniqueness prevents duplicate active salon/product requests. ActionReceipt stores the original result. ActionKey binds every actor/business/idempotency key, including semantic retries, to an immutable result and payload hash.
- Angular facades/data-access/UI separation, manual basket, sequential submission, sessionStorage recovery, role-scoped queue/detail views and Material confirmation dialogs.
- Operator-only transactional demo reset, with explicit project/business/quiescence confirmation. Ordinary seeding still preserves inventory.

## Verification

Local Auth + SQL Connect (PostgreSQL) + Functions emulators exercised by integration tests and Playwright with distinct authenticated users. The golden flow proved HQ 18→16, salon 2→4, transit 0 and exactly two movement rows. Tests cover competing approvals, simultaneous same-key submissions, lost-response replay, new-key semantic replay and key binding, revoked membership, wrong role/business, stale revision/version, partial receipt, and rollback after a later transfer guard fails.

Browser coverage: golden flow, blocked damaged/partial receipt, three-product batch interrupted after the first server commit and recovered after reload with the same key, active product exclusion, stale approval requiring review, rejection reason, plus existing foundation tests. Accessibility checked with Axe; detail layout checked at 1280/360/320px.

Final verification (7 October 2026): root unit tests **28/28**, Angular tests **21/21**, Auth/SQL integration **12/12**, Playwright **9/9**. Root typecheck, Functions build and optimized emulator build passed. An isolated copy of the deployable Functions directory loaded all five callable exports after installing production dependencies, without parent project sources.

One independent review found two important recovery issues; both were reproduced before fixing and verified after: transient membership-read errors now preserve unresolved keys/rows, and a saved basket can only resume from its original salon page. The UI names that salon and provides a return link. No additional reviewer findings were deferred. Build still warns that the initial bundle is ~542 kB versus the 500 kB warning budget; it remains below the configured error limit.

The completed code is on `codex/foundation`; no merge, push or cloud deployment was performed. User-staged skills and local settings were preserved.

## Local run

```sh
npm ci
npm --prefix web ci
npm --prefix functions ci
npm run dev:configure
npm run dev:emulators
```

Keep emulators running. In another terminal:

```sh
npm run dev:seed
npm run dev:web
```

Open http://127.0.0.1:4200. Local demo credentials remain in ignored `config/demo-accounts.local.json`; do not commit them. A fresh Auth emulator needs `dev:seed` again.

Tests (while local services are running):

```sh
npm run test:unit
npm run test:web
npm run typecheck
BARBERHQ_TEST_MODE=emulator npm run test:integration
BARBERHQ_TEST_MODE=emulator npm run test:e2e
```

## Reset

Close demo sessions and finish all in-flight requests before resetting. This is an operator declaration of quiescence, not a distributed maintenance lock. Reset deletes requests, active slots, transfers, movements, receipts and key bindings for the demo business, restores the 24 inventory rows, and increases inventory versions. It preserves products and memberships; it does not touch future knowledge tables. Old request links cease to exist. Clear pending browser state before the next rehearsal.

```sh
npm run dev:reset -- --dry-run
```

Replace `--dry-run` with `--apply` only when ready (`dev:reset` targets the local emulator; cloud reset runs `scripts/seed/reset.ts` directly with `--project notbad-6be95`); apply also prints its dry-run summary first. Cloud mode permits only `notbad-6be95` and refuses an emulator environment. No reset route/callable exists in the app.

## Remaining cloud gate

Provision/verify Auth, SQL Connect/Cloud SQL, Functions IAM and App Check; configure the real web application; deploy approved schema/connectors/functions and Hosting; rerun cloud concurrency, auth, App Check and browser checks against the explicit project. Only then mark this increment READY. No billing resources or cloud deployments were created by this increment.

## Implementation decisions and limits

- Continued in the existing user-selected workspace and retained the accepted facade/data-access/UI layout. This requires explicit path staging to preserve unrelated changes.
- Implemented locally despite missing cloud prerequisites; emulator results do not establish deployed Cloud SQL/App Check behavior.
- The repository derives actor scope from verified UID instead of accepting an externally constructed actor object; each SQL transaction rechecks authorization.
- Unused server context branches use empty ID sentinels because nullable key inputs were rejected at runtime. Public IDs must remain nonempty.
- Added ActionKey for semantic retry aliases; one small SQL table and an extra transactional write prevent conflicting reuse of a replay key.
- Reset requires an operator declaration of quiescence; concurrent writes are unsupported during rehearsal reset.
- Combined the already accepted uncommitted Angular refactor and replenishment implementation into one scoped implementation commit, followed by the review-fix commit; this increases the first diff size but preserves connected interfaces.
- Deployed concurrency/App Check, concurrent reset and future AI/PDF were outside the review's evidence/scope. Cloud verification remains mandatory; reset stays quiescent-only; PDF/RAG follow in their own increments.
