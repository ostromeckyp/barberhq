# BarberHQ 2 — Manual replenishment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Frontend structure update (30 September):** follow [Angular architecture](../../implementation/angular-architecture.md). Page components delegate to scoped facades; SDK calls live in feature data-access services. Historical foundation paths are superseded there.

**Goal:** Complete the deployed two-unit flow and safe multi-product submission without AI.

**Architecture:** Explicit callable commands invoke guarded SQL transactions; Angular reloads authoritative records after success. One local basket produces independent single-product requests.

**Tech Stack:** TypeScript Cloud Functions, generated Data Connect SDKs, Angular Material, Vitest, Playwright.

**Spec:** [Approved delivery design](../specs/2026-09-29-barberhq-delivery-design.md), increment 2; original phase 2 stock requirements and phase 4 replenishment UI; approved extensions §1 and §3.

**Status:** User-authorized local implementation and independent review completed on 7 October 2026. Cloud acceptance remains BLOCKED; see the [increment 2 handoff](../../implementation/handoffs/increment-2.md). Read [execution index](2026-09-29-barberhq-execution-index.md) for command conventions and shared types.

## Global Constraints

- Use Angular SPA, Firebase Auth, classic Firebase Hosting, SQL Connect (formerly Data Connect) with Cloud SQL PostgreSQL/pgvector, private Firebase Storage, and server-side Genkit/Gemini.
- AI does not mutate stock. The browser never connects directly to PostgreSQL or receives backend credentials.
- Business external key: `not-bad-stuff-demo`. Preserve the six `demoId` values in `docs/not-bad-stuff-products.json`.
- Integer units only; request quantities are 1–99. Persisted states: `PENDING_APPROVAL`, `RESERVED`, `DISPATCHED`, `RECEIVED`, `REJECTED`.
- No Firestore, SSR, Nx, additional vector database or persistent chat. Keep `.claude/specs/` in place.
- English UI; synthetic procedures visibly labeled. HTML/support.js remain unchanged design references.
- Run only the selected task/plan. Planning files describe future commands; none has been run as proof of implementation.

## Review Focus

- Two approvals competing for the last units cannot oversell (task 1).
- A response lost after commit must replay without a second movement (tasks 1–2).
- Revoked membership must deny an otherwise valid idempotent replay (task 1).
- A mixed-success basket must retain pending keys after refresh and never resubmit confirmed rows (task 2).
- Partial/damaged receipt and duplicate quantities above 99 must remain uncommitted (tasks 2–3).

---

## Prerequisites and file responsibilities

Requires increment-1 READY and actual Auth/SQL identifiers. No AI or Storage prerequisite.

- `shared/contracts/stock.ts`: stock command/read DTOs; `functions/src/stock/`: validators and callable adapters.
- `dataconnect/schema/stock.gql`, `dataconnect/server/stock.gql`: lifecycle, transactional guards and audit.
- `web/src/app/features/salon-dashboard/draft.store.ts`: local basket only; `core/submission.service.ts`: persisted pending submissions and reconciliation.
- `features/request-detail/`, `features/hq-queue/`: one shared action path and role-specific views.
- `scripts/seed/reset.ts`: single operator reset shared with final rehearsal; never a salon menu.

### Task 1: Atomic stock commands and deployed concurrency proof

**Files:**
- Create: `functions/package.json`, `functions/package-lock.json`, `functions/tsconfig.json`, `functions/src/index.ts`, `functions/src/auth/context.ts`, `functions/src/stock/commands.ts`, `functions/src/stock/schemas.ts`, `functions/src/stock/repository.ts`, `shared/contracts/stock.ts`.
- Create: `dataconnect/schema/stock.gql`, `dataconnect/server/stock.gql`, `dataconnect/browser/stock.gql`.
- Generated: `functions/src/generated/` (server connector); update browser/operator generated SDKs.
- Test: `tests/integration/stock.test.ts`, `tests/integration/stock-races.test.ts`, `tests/unit/stock-validation.test.ts`.
- Modify: `firebase.json` with Functions source/runtime/predeploy; `tests/support/cloud.ts`.

**Interfaces:**
- Consumes: authenticated caller plus index DTOs; server derives `ActorContext`, never accepts it from client input.
- Produces callables `submitRequest(SubmitInput)`, `approveRequest(ApproveInput)`, `rejectRequest(RejectInput)`, `dispatchTransfer(TransitionInput)`, `receiveTransfer(ReceiveInput)`, all returning `Promise<CommandResult>`.
- Internal `executeStock(actor:ActorContext, action:StockAction):Promise<CommandResult>` in repository.ts maps to one server-only transaction per action.
- Reads: `ListActiveRequests`, `GetRequestDetail`, `ListHQQueue`; DTOs and domain error codes are in the index.

- [ ] **Step 1: Write the behavioral checks.** Add named cases `conserves_twenty`, `competing_approvals_do_not_oversell`, `lost_response_replays`, `revoked_actor_cannot_replay`, `failure_rolls_back_all_writes`. The cloud harness supplies request/actor fixtures and snapshots:
```ts
expect(await h.goldenFlow(2)).toMatchObject({hqOnHand:16,hqReserved:0,inTransit:0,salonOnHand:4});
expect(await h.movementCount()).toBe(2);
expect((await h.repeatDispatch()).replayed).toBe(true);
expect(await h.movementCount()).toBe(2);
await h.revokeCurrentActor();
await expect(h.repeatDispatch()).rejects.toMatchObject({code:'FORBIDDEN'});
```
Race two requests of quantity 2 against HQ on-hand 3 in isolated fixtures: exactly one approval, reserved 2, available 1. Test same-key races, new-key semantic replay, altered payload keys, stale revisions, wrong role/business and a forced later-write guard failure with unchanged pre/post snapshot.

- [ ] **Step 2: Confirm the relevant check fails.** Run `npm run test:integration -- tests/integration/stock.test.ts tests/integration/stock-races.test.ts`. Expected: a failing named behavior before implementation; repair missing test infrastructure first, because an unavailable runner is not behavioral evidence.

- [ ] **Step 3: Implement the task.** Create Request, ActiveRequest, Transfer, StockMovement and ActionReceipt with architecture-defined uniqueness. Validate qty integer 1–99; rejection reason trimmed 1–500 characters (plan-level UI/API choice); exact full-intact receipt only. Preserve the same action result on replay, check membership again and compare payload hashes. Compile conditional updates plus affected-row checks and verify on deployed SQL before broad UI work. If generated operations cannot enforce a guard, use the specified narrow parameterized Native SQL fallback and document it. Use NO_ACCESS for server operations, verified callable Auth/App Check and scoped business relations. Include reserved-inventory versions and transfer/movement uniqueness in the same transaction; never hold correctness in memory. Pin a supported Functions Node runtime independently of the Angular build runtime; package compiled shared DTO dependencies into the functions artifact and prove it runs without sibling source directories.

- [ ] **Step 4: Verify the deliverable.** Run validation and both integration suites against real deployed transactions: PASS. Verify direct invocation of restricted operations fails for ordinary users. Build functions and load its entry point from a copy of the deployable directory with no parent sources. Record actual SDK transaction syntax/runtime and race outcomes.

- [ ] **Step 5: Record and commit.** Record real results in the increment handoff. Stage only this task’s named files after checking for secrets, then `git commit -m "feat: enforce atomic replenishment commands"`. See index for initial Git setup; never claim a commit if unavailable.

### Task 2: Shared basket and recoverable submission

**Files:**
- Create: `web/src/app/features/salon-dashboard/draft.store.ts`, `order-panel.component.ts`, `order-proposal.component.ts` in that feature directory.
- Create: `web/src/app/core/submission.service.ts`, `web/src/app/core/pending-submission.store.ts`, `shared/contracts/draft.ts`.
- Modify: `web/src/app/features/salon-dashboard/data-access/inventory-api.ts`, `web/src/app/features/salon-dashboard/feature/salon-dashboard.component.ts`.
- Test: `web/src/app/features/salon-dashboard/draft.store.spec.ts`, `web/src/app/core/submission.service.spec.ts`.

**Interfaces:**
- Consumes: `InventoryRow[]`, active requests and `submitRequest`.
- Produces: `DraftStore.add(line:ReadyDraftLine):void`, `merge(lines:DraftLine[]):void`, `editQuantity(lineId:string,quantity:number):void`, `remove(lineId:string):void`, `lines:Signal<DraftLine[]>`, `canSubmit:Signal<boolean>`.
- `SubmissionService.submit(salonId:string,lines:ReadyDraftLine[]):Promise<SubmissionRow[]>`, `resume():Promise<SubmissionRow[]>`; row and pending-state types are in the index. UUID action keys are generated once before each row’s first attempt.

- [ ] **Step 1: Write the behavioral checks.** Tests `overflow_is_editable`, `retains_origin`, `stops_on_unknown`, `refresh_reconciles_same_key`:
```ts
store.add(manualMatowa(98)); store.add(assistantMatowa(2));
expect(store.lines()[0].quantity).toBe(100);
expect(store.lines()[0].origin).toBe('manual');
expect(store.canSubmit()).toBe(false);
expect(api.attemptedKeys).toEqual([firstKey, firstKey, secondKey]);
expect(api.confirmedRequestCount).toBe(2);
```
Use a fake callable adapter whose first call commits then rejects as transport-unknown; its second same-key call returns the stored receipt. Test no subsequent row is sent until reconciliation; logout clears pending state; known validation failure allows only that row to be edited with a new key; shortages permit submit but unresolved lines block it.

- [ ] **Step 2: Confirm the relevant check fails.** Run `npm run test:web -- web/src/app/features/salon-dashboard/draft.store.spec.ts web/src/app/core/submission.service.spec.ts`. Expected: a failing named behavior before implementation; repair missing test infrastructure first, because an unavailable runner is not behavioral evidence.

- [ ] **Step 3: Implement the task.** Use one memory-only editable list, maximum six distinct products. Merge duplicate quantities retaining original origin, never clamp >99. Exclude active products with links. On submit freeze row payloads and save only pending keys/IDs/payloads scoped to current user/business/salon in sessionStorage; validate restored data as untrusted. Submit sequentially and render CREATED/ALREADY_ACTIVE/FAILED/UNKNOWN. Stop on unknown or session loss, retry same immutable payload/key, never confirmed rows. Definitive failure may continue other rows; unknown may not. Clear reconciled rows and all local state on sign-out. Build manual controls using handoff Material components with AI tabs hidden until enabled.

- [ ] **Step 4: Verify the deliverable.** Both unit suites PASS. Browser integration submits three actual products, including one active exclusion; verify links and unique database requests. Refresh during simulated lost response recovers correctly. Report basket partial success separately from per-request full fulfillment.

- [ ] **Step 5: Record and commit.** Record real results in the increment handoff. Stage only this task’s named files after checking for secrets, then `git commit -m "feat: add recoverable multi-product basket"`. See index for initial Git setup; never claim a commit if unavailable.

### Task 3: HQ queue, request lifecycle and stock feedback

**Files:**
- Create: `web/src/app/features/hq-queue/hq-queue.component.ts`, `queue-row.component.ts` in that directory.
- Create: `web/src/app/features/request-detail/request-detail.component.ts`, `request-action-dialog.component.ts`, `status-timeline.component.ts`, `delivery-quantities.component.ts` in that directory.
- Create: `web/src/app/shared/status-chip.component.ts`, `web/src/app/shared/low-stock.component.ts`.
- Modify: `web/src/app/app.routes.ts`, `web/src/app/shell/shell.component.ts`, `web/src/app/features/salon-dashboard/data-access/inventory-api.ts`.
- Test: `tests/e2e/replenishment.spec.ts`, `web/src/app/features/request-detail/request-action-dialog.component.spec.ts`.

**Interfaces:**
- Consumes: RequestDetail, CommandResult, expected request/HQ versions.
- Produces a replenishment data-access service with `getRequest(requestId:string):Promise<RequestDetail>`, `listHQQueue(page:PageInput):Promise<Page<RequestSummary>>`, `runAction(action:StockAction):Promise<CommandResult>`, consumed through a feature facade. Keep inventory reads in `InventoryApi`.
- Reuse the same dialog/action service from detail and queue; no second approval implementation.

- [ ] **Step 1: Write the behavioral checks.** Tests `two_units_move_once`, `damaged_receipt_is_blocked`, `stale_approval_requires_review`:
```ts
await expect(page.getByTestId('hq-on-hand')).toHaveText('16');
await expect(page.getByTestId('salon-on-hand')).toHaveText('4');
await expect(page.getByTestId('in-transit')).toHaveText('0');
await expect(page.getByTestId('low-stock-NBS-MATOWA-100')).toHaveCount(0);
expect(receiptForm.valid).toBe(false); // fixture: received 1 or allIntact false
```
In separate test contexts verify staff cannot see HQ actions, HQ cannot receive as salon staff, rejection requires reason, and stale-state failure refreshes data without success notification.

- [ ] **Step 2: Confirm the relevant check fails.** Run `npm run test:web -- web/src/app/features/request-detail/request-action-dialog.component.spec.ts`. Expected: a failing named behavior before implementation; repair missing test infrastructure first, because an unavailable runner is not behavioral evidence.

- [ ] **Step 3: Implement the task.** Implement /hq and /requests/:requestId with status/timeline/ordered-dispatched-received quantities. Hide unauthorized actions and show server success only after commit. Display projected impacts before confirmation; disable double submission while pending. On stale/conflict reload and require review rather than silently auto-approving. Refresh dependent lists/stock after success and on focus/reconnect. Show low stock at configured default 2; unknown values stay unknown. Use product-scoped marker test IDs; other products may correctly remain low after Matowa receipt. Partial/damaged receipt explains why completion is blocked and links to procedure guidance when that feature becomes available.

- [ ] **Step 4: Verify the deliverable.** Unit test and `npm run test:e2e -- tests/e2e/replenishment.spec.ts` PASS on deployed services with distinct HQ/Legnicka accounts. Inspect dialogs keyboard focus, 1280/360/320 widths and every lifecycle status. Verify golden database totals, not only labels.

- [ ] **Step 5: Record and commit.** Record real results in the increment handoff. Stage only this task’s named files after checking for secrets, then `git commit -m "feat: complete manual replenishment screens"`. See index for initial Git setup; never claim a commit if unavailable.

### Task 4: Repeatable stock setup and increment handoff

**Files:**
- Create: `scripts/seed/reset.ts`, `tests/integration/reset.test.ts`, `docs/implementation/handoffs/increment-2.md`.
- Modify: `scripts/seed/cli.ts`, `dataconnect/server/seed.gql`, `docs/03-demo-runbook.md`.
- Modify: `package.json` with `demo:reset` and the explicit target checks.

**Interfaces:**
- Consumes: BusinessSeed, explicit project/business target and cloud operator identity.
- Produces: `resetDemo(input:{projectId:string;businessKey:string;confirmBusinessKey:string;dryRun:boolean}):Promise<{deletedOperationalRows:number;resetInventoryRows:number}>`.
- Reset scope: demo requests/active slots/transfers/movements/action receipts and inventory only; preserve products, membership and any knowledge records. Require quiescent demo (no active presentation/user writes) before reset.

- [ ] **Step 1: Write the behavioral checks.** Test `reset_refuses_foreign_target_and_restores_seed`:
```ts
await expect(resetDemo(wrongTarget)).rejects.toThrow();
expect(await h.snapshot()).toEqual(beforeWrongTarget);
await resetDemo(confirmedDemoTarget);
expect(await h.inventory()).toMatchObject({hqOnHand:18,hqReserved:0,inTransit:0,salonOnHand:2});
expect(await h.activeRequestCount()).toBe(0);
expect(await h.membershipCount()).toBe(beforeMembershipCount);
```
Also verify dry run changes no rows and ordinary seed remains non-resetting.

- [ ] **Step 2: Confirm the relevant check fails.** Run `npm run test:integration -- tests/integration/reset.test.ts`. Expected: a failing named behavior before implementation; repair missing test infrastructure first, because an unavailable runner is not behavioral evidence.

- [ ] **Step 3: Implement the task.** Implement one scoped transactional reset for business operational rows only, using an allowlisted demo target and explicit confirmation argument. The CLI prints a dry-run summary before apply; never call it from Hosting or staff UI. Retain this implementation for increment5 rather than replacing it. Enable replenishment in public config, deploy the verified feature and record command contracts/domain errors, concurrency evidence and golden replay in the report.

- [ ] **Step 4: Verify the deliverable.** Reset integration PASS. Reset then repeat deployed golden flow: HQ16/salon4/transit0. Record counts and final state, with actual versions and prerequisite files for PDF work.

- [ ] **Step 5: Record and commit.** Record real results in the increment handoff. Stage only this task’s named files after checking for secrets, then `git commit -m "chore: add guarded demo reset and stock handoff"`. See index for initial Git setup; never claim a commit if unavailable.

## Completion and next context

Write increment-2 READY only after deployed concurrency, authorization, manual batch and golden-flow checks pass. Next context: increment-1/2 reports, plan3A, phase1 PDF requirements, phase3 ingestion requirements and architecture §8. Keep the SQL fixture harness reusable for document/AI invariants.
