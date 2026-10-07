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

Final counts and review findings are recorded after the final verification pass below.

## Local run

```sh
npm ci
npm --prefix web ci
npm --prefix functions ci
npm run configure:emulators
npm run start:emulators
```

Keep emulators running. In another terminal:

```sh
npm run demo:local
npm run start:local
```

Open http://127.0.0.1:4200. Local demo credentials remain in ignored `config/demo-accounts.local.json`; do not commit them. A fresh Auth emulator needs `demo:local` again.

Tests (while local services are running):

```sh
npm test
npm run test:web
npm run typecheck
BARBERHQ_TEST_MODE=emulator npm run test:integration
BARBERHQ_TEST_MODE=emulator npm run test:e2e
```

## Reset

Close demo sessions and finish all in-flight requests before resetting. This is an operator declaration of quiescence, not a distributed maintenance lock. Reset deletes requests, active slots, transfers, movements, receipts and key bindings for the demo business, restores the 24 inventory rows, and increases inventory versions. It preserves products and memberships; it does not touch future knowledge tables. Old request links cease to exist. Clear pending browser state before the next rehearsal.

```sh
DATA_CONNECT_EMULATOR_HOST=127.0.0.1:9399 npm run demo:reset -- --project demo-barberhq --business not-bad-stuff-demo --confirm not-bad-stuff-demo --quiescent --dry-run
```

Replace `--dry-run` with `--apply` only when ready; apply also prints its dry-run summary first. Cloud mode permits only `notbad-6be95` and refuses an emulator environment. No reset route/callable exists in the app.

## Remaining cloud gate

Provision/verify Auth, SQL Connect/Cloud SQL, Functions IAM and App Check; configure the real web application; deploy approved schema/connectors/functions and Hosting; rerun cloud concurrency, auth, App Check and browser checks against the explicit project. Only then mark this increment READY. No billing resources or cloud deployments were created by this increment.
