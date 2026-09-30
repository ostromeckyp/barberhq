# BarberHQ 4A — Replenishment agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn natural language into an editable, verified multi-product basket without stock writes.

**Architecture:** A server Genkit flow exposes three scoped read tools and reconstructs results from live records. Existing manual submission remains the sole path for creating requests.

**Tech Stack:** Genkit/Gemini through Vertex AI, Firebase callable Functions, Data Connect, Angular shared draft.

**Spec:** [Approved delivery design](../specs/2026-09-29-barberhq-delivery-design.md), increment 4A; phase5 and approved extensions §1; AI limits in shared contracts.

**Status:** Ready for user review; execution not authorized by this file. Read [execution index](2026-09-29-barberhq-execution-index.md) for command conventions and shared types.

## Global Constraints

- Use Angular SPA, Firebase Auth, classic Firebase Hosting, SQL Connect (formerly Data Connect) with Cloud SQL PostgreSQL/pgvector, private Firebase Storage, and server-side Genkit/Gemini.
- AI does not mutate stock. The browser never connects directly to PostgreSQL or receives backend credentials.
- Business external key: `not-bad-stuff-demo`. Preserve the six `demoId` values in `docs/not-bad-stuff-products.json`.
- Integer units only; request quantities are 1–99. Persisted states: `PENDING_APPROVAL`, `RESERVED`, `DISPATCHED`, `RECEIVED`, `REJECTED`.
- No Firestore, SSR, Nx, additional vector database or persistent chat. Keep `.claude/specs/` in place.
- English UI; synthetic procedures visibly labeled. HTML/support.js remain unchanged design references.
- Run only the selected task/plan. Planning files describe future commands; none has been run as proof of implementation.

## Review Focus

- Concurrent calls across both AI endpoints must share one shared 10-per-hour admission limit (AI-0).
- Model-supplied stock, product IDs or business scope must never become authoritative (task2).
- A message mentioning more than six products or duplicate overflow must not be silently truncated (task2).
- A late assistant response must not erase manual edits or populate a different salon’s draft (task3).
- Timeout, provider failure or a request to dispatch directly must preserve manual usability and write nothing (tasks2–3).

---

## Prerequisites and file responsibilities

Requires increment2 for the manual basket and stock APIs. In the agreed delivery order,3B is already complete; replenishment itself does not depend on PDF retrieval.

**Shared task AI-0:** task1 below owns shared AI budget/provider infrastructure. Plan4B may execute AI-0 directly if absent, without implementing tasks2–3 here. Complete it once and record evidence in `docs/implementation/handoffs/ai-foundation.md`; there is no dependency between the two business flows.

- `functions/src/ai/runtime.ts`, `budget.ts`: provider configuration and shared admission.
- `functions/src/ai/replenishment-tools.ts`, `replenishment.ts`: scoped reads and validated proposal.
- `shared/contracts/ai.ts`: public request/result DTOs; runtime schemas stay server-side.
- `scripts/eval/replenishment/`: checked-in cases and local result artifacts; no persistent end-user chat.

### Task 1: AI-0: shared authenticated AI runtime and limits

**Files:**
- Create: `functions/src/ai/runtime.ts`, `functions/src/ai/budget.ts`, `functions/src/ai/schemas.ts`, `shared/contracts/ai.ts`, `dataconnect/schema/ai.gql`, `dataconnect/server/ai.gql`.
- Test: `tests/integration/ai-quota.test.ts`, `tests/unit/ai-budget.test.ts`.
- Modify: `functions/package.json`/lockfile, generated server SDK; create `docs/implementation/handoffs/ai-foundation.md`.

**Interfaces:**
- `admitAiCall(actor:ActorContext,endpoint:'replenishment'|'procedure',input:string,now:Date):Promise<AiBudget>`.
- `AiBudget = {deadlineMs:number;modelTurnsRemaining:number;toolCallsRemaining:number}`; `consumeModelTurn(budget:AiBudget):void`, `consumeToolCall(budget:AiBudget):void`, `assertTimeRemaining(budget:AiBudget):void` throw typed limit errors.
- `createAiRuntime(config:ReasoningConfig)` returns the configured Genkit instance; `ReasoningConfig = {provider:'vertex';projectId:string;location:string;modelId:string}` is private server config.
- SQL admission uses verified user identity and UTC hour; invalid/unauthorized inputs are rejected before admission, admitted provider failures still count.

- [ ] **Step 1: Write the behavioral checks.** Tests `one_shared_quota_under_concurrency`, `deadline_and_tool_budget_stop_work`:
```ts
const results = await Promise.allSettled(Array.from({length:11},(_,i) => h.admit(i%2 ? 'procedure':'replenishment')));
expect(results.filter(x => x.status === 'fulfilled')).toHaveLength(10);
expect(await h.admissionsInCurrentHour()).toBe(10);
expect(() => consumeToolCall(exhaustedBudget)).toThrow();
expect(() => assertTimeRemaining(expiredBudget)).toThrow();
```
Test 2000 chars accepted/2001 rejected, 5 model turns/8 tool executions maximum, new UTC hour admits again, forged actor rejected and server time used for SQL quota. Use a fake clock for deadline unit checks, real SQL for quota races.

- [ ] **Step 2: Confirm the relevant check fails.** Run `npm run test:unit -- tests/unit/ai-budget.test.ts`. Expected: a failing named behavior before implementation; repair missing test infrastructure first, because an unavailable runner is not behavioral evidence.

- [ ] **Step 3: Implement the task.** Owner enables/authorizes the selected Gemini provider; make a small real provider probe and record actual model/location/version. Reuse embedding config separately; do not change its dimension. Implement atomic AIUsageWindow increment shared by endpoint names and user, not one counter per flow. Budget applies 25s wall time to retrieval/tools/provider work; stop/cancel outstanding work where supported and discard late results. No automatic quota refund. Enforce Auth/App Check before flow execution. Log IDs/timing/tool names only by default, never tokens/full prompts/hidden reasoning. Runtime/test helpers must be reusable by4B.

- [ ] **Step 4: Verify the deliverable.** Unit checks and `npm run test:integration -- tests/integration/ai-quota.test.ts` PASS; real model probe recorded. Compile the shared DTOs and provider adapter. Write ai-foundation report with runtime and limit checks; do not claim either business flow exists yet.

- [ ] **Step 5: Record and commit.** Record real results in the increment handoff. Stage only this task’s named files after checking for secrets, then `git commit -m "feat: add shared bounded AI runtime"`. See index for initial Git setup; never claim a commit if unavailable.

### Task 2: Verified read tools and multi-line proposal flow

**Files:**
- Create: `functions/src/ai/replenishment-tools.ts`, `functions/src/ai/replenishment.ts`, `functions/src/ai/proposal.ts`, `data/seed/product-aliases.json`.
- Modify: `shared/contracts/ai.ts`, `functions/src/index.ts`, `dataconnect/server/stock.gql` only for scoped tool reads.
- Test: `tests/unit/replenishment-tools.test.ts`, `tests/integration/replenishment-agent.test.ts`.
- Create: `scripts/eval/replenishment/cases.json`, `scripts/eval/replenishment/run.ts`.

**Interfaces:**
- `findProduct(queries:string[],ctx:ActorContext):Promise<ProductMatch[]>`; `getStockContext(input:{salonId:string;productIds:string[]},ctx:ActorContext):Promise<StockContext[]>`; `calculateProposal(input:{salonId:string;items:RequestedItem[]},ctx:ActorContext):Promise<ProposalResult>`.
- `RequestedItem = {lineId:string;productId:string;quantity:number}`; tool list arrays max6 and no hidden write tool.
- Callable `prepareReplenishment(input:PrepareInput):Promise<ProposalResult>` uses index DTOs. Model outputs are parsed candidates; final names/numbers/versions/exclusions are rebuilt server-side from current tool results.

- [ ] **Step 1: Write the behavioral checks.** Tests `ignores_fabricated_stock`, `clarifies_ambiguous_matte`, `refuses_dispatch_instruction`:
```ts
expect(result.lines[0]).toMatchObject({status:'READY',productId:matowaId,quantity:2,hqAvailable:18,salonOnHand:2});
expect(ambiguous.status).toBe('NEEDS_CLARIFICATION');
expect(ambiguous.lines[0].candidates.length).toBeGreaterThan(1);
expect(await h.businessSnapshot()).toEqual(beforeFlow);
expect(registeredToolNames.sort()).toEqual(['calculateProposal','findProduct','getStockContext']);
```
Cover3 actual products (Matowa, Sól Morska, Savage), duplicate sum 100, missing/fractional/negative quantity, unavailable shampoo, mixed ready/unknown, more than six distinct lines, existing active request, low availability, foreign salon and prompt forcing dispatch. Server must replace fabricated stock 999 with actual 18.

- [ ] **Step 2: Confirm the relevant check fails.** Run `npm run test:unit -- tests/unit/replenishment-tools.test.ts`. Expected: a failing named behavior before implementation; repair missing test infrastructure first, because an unavailable runner is not behavioral evidence.

- [ ] **Step 3: Implement the task.** Resolve exact local demo IDs, source-code strings, names and curated aliases; ambiguous generic matte wording must present authorized candidates rather than guess among Matowa/Dry Matt/Mattifier. Do not manufacture a shampoo absent from the catalog. Inject ActorContext outside model-controlled arguments. Bound arrays without silently discarding extra wording; report clarification for unresolved lines. Call calculateProposal against current scoped stock/active requests before final response. Expose PROPOSAL/NEEDS_CLARIFICATION/UNAVAILABLE with line states/exclusions from the index. For stateless clarification, include the original wording in each selected clarification and validate it occurs in the submitted message. Treat the selected product/quantity as fresh user input: validate catalog membership, bounds and stock again, use its supplied lineId for the resolved row, and do not add that same clarified item a second time from model parsing. Ambiguous matching asks again rather than dropping or duplicating a line. Add a repeated-clarification case proving one resolved row, with no server chat storage. Use shared AI-0 admission/budgets and actual tool events only. Model has no import/reference to stock/document writes.

- [ ] **Step 4: Verify the deliverable.** Unit and `npm run test:integration -- tests/integration/replenishment-agent.test.ts` PASS. Run `npm run eval:replenishment` against the actual provider and seeded data; record each case’s inputs/result/timing/no-write snapshot evidence locally. A deterministic stub test alone does not certify model behavior.

- [ ] **Step 5: Record and commit.** Record real results in the increment handoff. Stage only this task’s named files after checking for secrets, then `git commit -m "feat: prepare verified replenishment proposals"`. See index for initial Git setup; never claim a commit if unavailable.

### Task 3: Assistant UI, manual fallback and handoff

**Files:**
- Create: `web/src/app/core/assistant-api.ts`, `web/src/app/features/salon-dashboard/assistant-input.component.ts`.
- Modify: `web/src/app/features/salon-dashboard/order-panel.component.ts`, `draft.store.ts`, `shared/contracts/ai.ts` only for verified alignment.
- Test: `web/src/app/features/salon-dashboard/assistant-input.component.spec.ts`, `tests/e2e/replenishment-ai.spec.ts`.
- Create: `docs/implementation/handoffs/increment-4a.md`; modify public config to enable replenishmentAiEnabled.

**Interfaces:**
- `AssistantApi.prepareReplenishment(input:PrepareInput):Promise<ProposalResult>` wraps the callable.
- Reuse `DraftStore.merge()` and `SubmissionService.submit()` from increment2; no new submit endpoint.
- Request context captures session generation, salonId and draft edit revision; only responses for current context may merge. Merge successful lines into the latest draft preserving manual edits/origins; never replace the whole list.

- [ ] **Step 1: Write the behavioral checks.** Test `late_response_does_not_replace_manual_edits` and `provider_failure_keeps_manual_path`:
```ts
expect(store.lines().find(x => x.productId === manuallyEditedId)?.quantity).toBe(5); // edited product is absent from returned proposal
await expect(page.getByRole('tab',{name:'Manual',exact:true})).toBeEnabled();
await expect(page.getByText('Request created', {exact:true})).toHaveCount(0); // preparation only
```
For a duplicate returned product, separately assert additive merging with original origin (manual5 + assistant2 =7), as required by the shared draft contract. Start a request, change salon/sign out, resolve old response and assert no draft insertion. Test clarification choices bind to lineId, a mixed proposal blocks submit until resolved, and timeout/quota displays actionable manual fallback.

- [ ] **Step 2: Confirm the relevant check fails.** Run `npm run test:web -- web/src/app/features/salon-dashboard/assistant-input.component.spec.ts`. Expected: a failing named behavior before implementation; repair missing test infrastructure first, because an unavailable runner is not behavioral evidence.

- [ ] **Step 3: Implement the task.** Enable Assistant/Manual tabs sharing the same list. Display actual activity only if wired; otherwise ordinary loading is sufficient. Preserve edits and line provenance on tab changes, show quantity/product clarification and shortage/exclusion states, and require explicit Submit. Model/network errors never erase the draft. Complete model-prepared golden flow through unchanged ordinary commands; refresh true stock afterwards.

- [ ] **Step 4: Verify the deliverable.** Component tests and `npm run test:e2e -- tests/e2e/replenishment-ai.spec.ts` PASS. Record real provider two-unit and multi-product results, manual fallback, golden stock totals and no-write preparation proof. Update report, not presentation claims until verified.

- [ ] **Step 5: Record and commit.** Record real results in the increment handoff. Stage only this task’s named files after checking for secrets, then `git commit -m "feat: connect replenishment assistant to shared basket"`. See index for initial Git setup; never claim a commit if unavailable.

## Completion and next context

Report4A includes model configuration, evaluated cases, honest latency/error results, read-tool allowlist and database no-write evidence.4B needs only ai-foundation plus3A/3B; no replenishment flow dependency. Final readiness reads both flow reports.
