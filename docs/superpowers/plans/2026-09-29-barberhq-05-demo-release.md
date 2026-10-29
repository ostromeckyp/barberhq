# BarberHQ 5 — Release and demo rehearsal Implementation Plan

## 27 October checkpoint

[Fresh production rehearsals](../../implementation/demo-rehearsal-2026-10-27.md) supersede the25 October timeout outcome: both stock and RAG/PDF flows completed, with separate SALON and HQ sessions on the live origin. Two approved resets preserved settings/knowledge/original metadata; per-RAG operational hashes matched. Timings5:40.138 and6:30.059 include instrumentation and a3:57 inspection/resumption gap in the second run. Do not count the latter as a second six-minute pass. Human stage-answer review, uninterrupted spoken timing, protected upload/concurrency and remaining acceptance rows stay open. Full translation is deferred.


> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a verified Hosting release and repeat both scenarios within a six-minute demonstration.

**Architecture:** Reuse completed application/backend checks, the scoped reset and immutable corpus. Promote the tested frontend version, verify rollback separately from data, and align presentation Markdown with measured behavior.

**Tech Stack:** Firebase Hosting/CLI, existing Functions/SQL/Storage, Playwright, operator reset, Markdown runbook/slides.

**Spec:** [Approved delivery design](../specs/2026-09-29-barberhq-delivery-design.md), increment5; original phase7, full Hosting specification and remaining UI-state coverage.

**Status:** Ready for user review; execution not authorized by this file. Read [execution index](2026-09-29-barberhq-execution-index.md) for command conventions and shared types.

**24 October owner update:** Add Task 1A below before any new preview publication. The owner identified visual/interaction gaps after the functional checks. The prepared 24 October frontend package is held pending this review and a new build. Existing inline execution and no-stage/no-commit preferences remain in force.

## 25 October execution checkpoint

Published live and preview UI is version `4b833190c12b9244`. Six additional local state/recovery cases and 28 release/Hosting unit checks pass; root TypeScript and two scoped local reset checks pass. The owner-approved controlled rollback to `6dca66a0ba4ae78d` and restoration passed with scoped operational/knowledge/original-metadata snapshots unchanged. [Release tooling, trial evidence and next reset scope](../../implementation/release-verification.md) and [59-item acceptance index](../../implementation/acceptance-coverage.md) are current. No cloud reset or stock/document mutation was performed.

Task1/1A automated design/state work is recorded, with remaining source-only/projector acceptance explicit in coverage. Task2 verifier/preflight, exact pinned preview/live identity, controlled rollback/restoration and scoped data comparisons are complete; the promotion attempt was a same-version no-op. Full protected-command/upload smoke remains pending, so Task2 steps3/4 stay partially open. Task3 runbook/slide corrections and criterion mapping are prepared; corrected reset dry-run reports 41 operational rows/24 inventories, but apply, two measured deployed repetitions and offline fallback capture remain pending. Existing owner no-stage/no-commit/no-workspace-removal preference supersedes generic commit/cleanup steps.

**Later 25 October rehearsal checkpoint:** The owner continued the explicit reset scope. Reset1 applied 41 operational deletions/24 inventories; reset2 applied 14/24. Both real stock flows passed every quantity/state assertion. First full mixed-origin repetition passed in 5:23.368; repetition2 failed with a 25s RAG timeout and its procedure-only retry also timed out. Knowledge and seven original metadata snapshots matched throughout; three actual offline JPEG fallbacks now exist and decode locally. [Full rehearsal evidence and a diagnostic-only publication candidate](../../implementation/demo-rehearsal-2026-10-25.md) supersede the earlier “not applied” checkpoint. No diagnostic deployment occurred during those rehearsal attempts, and no third reset was performed. The subsequent approved [diagnostic publication](../../implementation/rag-phase-diagnostics-2026-10-25.md) returned one production answer in5.32s, with full stage timings. Previous timeout cause, preview App Check and the unset→20 max-instance difference remain open. Two successful stage repetitions, full protected-origin coverage and presenter/projector acceptance remain open; Task3 is not complete.

**Later local verification checkpoint:** [Task3 scenario tests](../../implementation/demo-local-verification-2026-10-25.md) now exist and pass: two emulator repetitions preserve source data; provider failure leaves manual submission usable. Initial full suite69/72 exposed three contrast failures, reproduced unchanged and corrected in two stylesheets; final72/72 browser,131/131 Angular, typecheck, build and local artifact/config preflight pass. The UI candidate is prepared, not published; CSS independent review was interrupted by account usage limits. This does not close the two successful hosted-rehearsal gate. Latest read-only reset count34/24 is not reset authorization. Owner clarified their PDF success was on production. New [partial-receipt/issue and Firebase notification ideas](../../implementation/future-work.md) are a separate proposed extension; existing lifecycle constraints below remain the implemented model.

## Global Constraints

- Use Angular SPA, Firebase Auth, classic Firebase Hosting, SQL Connect (formerly Data Connect) with Cloud SQL PostgreSQL/pgvector, private Firebase Storage, and server-side Genkit/Gemini.
- AI does not mutate stock. The browser never connects directly to PostgreSQL or receives backend credentials.
- Business external key: `not-bad-stuff-demo`. Preserve the six `demoId` values in `docs/not-bad-stuff-products.json`.
- Integer units only; request quantities are 1–99. Persisted states: `PENDING_APPROVAL`, `RESERVED`, `DISPATCHED`, `RECEIVED`, `REJECTED`.
- No Firestore, SSR, Nx, additional vector database or persistent chat. Keep `.claude/specs/` in place.
- English UI; synthetic procedures visibly labeled. Owner update: remove the “English questions only” hint and separately evaluate Polish procedure questions; do not infer proven Polish support from the copy change. HTML/support.js remain unchanged design references.
- Run only the selected task/plan. Planning files describe future commands; none has been run as proof of implementation.

## Review Focus

- Preview and live share stock; release verification must not assume backend isolation (task2).
- Restoring an older frontend must not reset stock or change published knowledge (task2).
- Final mobile and keyboard paths must include dialogs, failed submissions and PDF controls (task1).
- Reset after document publication must preserve original/citation identities (task3).
- A live model/network failure must leave an honest presenter fallback, not fabricated success (task3).

---

## Prerequisites and file responsibilities

Requires reports1,2,3A,3B,AI-0,4A,4B. Missing required deployed checks remain blockers; this plan does not waive them.

- `tests/e2e/`: integrated route/state and scenario checks.
- `scripts/release/`: target/version-aware verification and release record.
- `docs/implementation/ui-state-coverage.md`, `acceptance-coverage.md`, `deployment-runbook.md`: evidence indexes.
- `docs/03-demo-runbook.md`, `docs/02-slide-outline.md`: presenter artifacts; no deck generation here.

### Task 1: Complete approved view/state coverage

**Files:**
- Create: `tests/e2e/ui-states.spec.ts`, `docs/implementation/ui-state-coverage.md`.
- Modify as findings require: the existing components under `web/src/app/features/`, `shell/` and `shared/`; name actual files in each fix before editing.
- Read only: `docs/design/views-and-states.md`, handoff SPEC and both HTML boards.

**Interfaces:**
- Consumes: existing routes/services and role-specific fixtures; no new endpoint or feature.
- Produces a row per approved view/state with route, role, viewport, check/evidence and result. Map prototype deviations explicitly: real Auth, no ordinary reset menu, server-generated IDs/pages, explicit reviewed publication.
- Extend existing e2e fixture helpers rather than introducing a second browser framework.

- [ ] **Step 1: Write the behavioral checks.** Test `all_routes_fit_320`, `keyboard_dialogs_restore_focus`, `role_actions_are_absent`:
```ts
expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
await expect(salonPage.getByRole('button',{name:'Approve',exact:true})).toHaveCount(0);
await expect(triggerButton).toBeFocused(); // after closing idle dialog
```
Enumerate loading/empty/error/stale/submitting/partial-success/unknown states, request statuses, document states and RAG abstention/source failures. Use controlled failure injection for UI checks and label it; actual integrations remain independently required.

- [ ] **Step 2: Confirm the relevant check fails.** Run `npm run test:e2e -- tests/e2e/ui-states.spec.ts`. Expected: a failing named behavior before implementation; repair missing test infrastructure first, because an unavailable runner is not behavioral evidence.

- [ ] **Step 3: Implement the task.** Inspect the actual handoff board/prototype in a browser. Map every approved state to implementation; correct only missing agreed behavior. Verify one M3 theme, Archivo/Plex Mono, brand/error distinction, ≥12px text and readable projector quantities, 760px responsive boundary, desktop 1280/mobile 360 and no page scroll at 320. Preserve Material dialog/tab/autocomplete semantics; move focus and announce actual server outcomes. Identify source loss/unauthorized state rather than showing placeholder success.

- [ ] **Step 4: Verify the deliverable.** State suite PASS and visual/keyboard inspection recorded. Newly fixed behaviors receive a focused regression check; do not rerun unrelated suites without reason. Coverage table has no unexplained missing approved state.

- [ ] **Step 5: Record and commit.** Record real results in the increment handoff. Stage only this task’s named files after checking for secrets, then `git commit -m "fix: complete approved demo interface states"`. See index for initial Git setup; never claim a commit if unavailable.

### Task 1A: UX/UI review of the application against the designs

**Local completion, 24 October:** [review and evidence](../../implementation/ux-ui-design-review.md). All reported controls corrected; 20 browser/125 Angular tests pass. A new frozen preview candidate is prepared; publication is still pending. Later owner steering removes the entire six-item hint and requires catalog-derived examples under the new replenishment design.

**Purpose:** Review the running application against both exported HTML references and `design_handoff_barberhq/SPEC.md`, then correct demonstrated visual and interaction gaps. Functional/state tests alone do not establish design fidelity.

**Files:**
- Create: `docs/implementation/ux-ui-design-review.md` with findings, design references, application screenshots, status and verification.
- Inspect/fix as confirmed: `web/src/app/features/replenishment/ui/order-panel.html`, `order-panel.ts`, `order-panel.scss`, `assistant-input.ts`; `web/src/app/features/salon-dashboard/feature/salon-dashboard.component.ts`; `web/src/app/features/procedures/procedure-page.component.ts`, `procedure-assistant.component.ts`; name any additional close-button/sheet style source before editing.
- Extend only relevant checks in `tests/e2e/responsive-order.spec.ts`, `ui-states.spec.ts` and existing component tests. Read `functions/src/ai/procedure.ts` for the separately reported Polish-language constraint; no model/corpus change is implied by removing UI copy.

**Interfaces:** Consumes the existing Material components, draft and session facades. Produces a reviewed application/design comparison and a new frozen frontend candidate; Task 2 must use that candidate rather than the older package. Preserve draft, explicit Submit, role controls, keyboard semantics and cited-source identity.

- [x] **Step 1: Inspect and record discrepancies.** Compare actual application and design at desktop 1280px and mobile 360/320px, including expanded tabs, a populated request list and a bottom sheet tall enough to scroll. Record the source reference and actual screenshot for each finding. Owner seed findings (open, not yet independently verified):
  - Missing icons in tabs: review Assistant/Manual and Assistant/Documents against their design labels.
  - Vertically misaligned X icons: inspect close/remove controls in panels, request rows and dialogs, including focus and hit area.
  - Mobile Request products bottom-sheet top divider/drag handle scrolls away: keep it stationary within the sheet while the content scrolls; verify the close control and content remain usable.
  - Remove “English questions only” below the procedure Question field.
  - Missing example buttons/chips in request preparation: restore the design examples; selecting one fills the request input without calling AI or submitting automatically. Preserve an existing manual draft.
  - Continue the comparison for other small missing icons, controls, spacing, alignment and interaction states; the seed list is not the whole review.
- [x] **Step 2: Reproduce before fixing.** Capture current layout/scroll evidence. For behavior changes, add focused failing regressions: the sheet handle keeps the same viewport position during content scroll; example selection only fills input and keeps manual lines; tab accessible names/keyboard navigation remain correct. Use screenshot/visual inspection for decorative icon alignment rather than brittle pixel-perfect DOM tests.
- [x] **Step 3: Apply scoped corrections.** Use the existing Material/theme/icon system and confirmed design intent. For the sheet, separate the stationary header/handle from its scrolling body. Remove the language hint. Track any remaining English-only assumptions separately: the current procedure prompt explicitly requests an English question. Evaluate a Polish counterpart of the accepted damage question and an unsupported question, checking grounding, citations and honest abstention; report the result before claiming Polish readiness or selecting backend changes.
- [x] **Step 4: Verify in the application.** Repeat scrolling with a long request list, keyboard tab/close/example interactions, 320px overflow and desktop alignment. Record before/after screenshots from the running application. Use controlled AI/PDF fixtures for UI checks and label them; real Polish provider/retrieval quality requires separate evidence. Run only affected tests, the production build and `npm run graph:update` after source changes; obtain the independent source review required by the execution workflow.
- [x] **Step 5: Update the release candidate and handoff.** Close or explicitly list each finding, update UI coverage and increment 5, rebuild/freeze a new artifact and replace the publication review with its exact identity. Retain the old artifact as historical evidence. Do not mark the earlier candidate as containing these fixes. Respect the owner’s no-stage/no-commit preference.

### Task 2: Preview, same-version promotion and rollback

**Files:**
- Create: `scripts/release/verify.ts`, `tests/unit/release-record.test.ts`, `tests/e2e/release-smoke.spec.ts`.
- Modify: `docs/implementation/deployment-runbook.md`, `scripts/checks/hosting.ts`, public config and backend origin allowlists only as needed.
- Record: ignored `artifacts/releases/` raw evidence and redacted version record in runbook.

**Interfaces:**
- Consumes: the new candidate produced after Task 1A UX/UI corrections and review.
- `verifyRelease(input:{projectId:string;siteId:string;channelId:string;baseUrl:string;expectedBuildHash:string}):Promise<ReleaseRecord>`.
- `ReleaseRecord = {projectId:string;siteId:string;channelId:string;hostingVersionId:string;buildHash:string;configHash:string;baseUrl:string;backendRevision:string;verifiedAt:string}`.
- Root `check:release` command validates target/artifact/version; it does not reset or ingest data.

- [x] **Step 1: Write the behavioral checks.** Test `rejects_version_drift_and_cross_project_config`:
```ts
expect(() => validatePromotion(previewRecord,changedPreviewRecord)).toThrow();
expect(() => validatePromotion(previewRecord,matchingRecord)).not.toThrow();
expect(hostingConfig.public).not.toBe('.');
```
`validatePromotion(before:ReleaseRecord,current:ReleaseRecord):void` lives in verify.ts; require same project/site/Hosting version/build/config. Smoke tests cover Auth/App Check, direct routes, protected GraphQL/callables, PDF read/upload and CORS from exact preview/live origins.

- [x] **Step 2: Confirm the relevant check fails.** Run `npm run test:unit -- tests/unit/release-record.test.ts`. Expected: a failing named behavior before implementation; repair missing test infrastructure first, because an unavailable runner is not behavioral evidence.

- [ ] **Step 3: Implement the task.** Clean-install from root/web/functions lockfiles, build reviewed code and record backend compatibility. Deploy backend/schema/worker/rules separately where changes require it; do not run seed/reset from frontend deploy. Use explicit verified project ID in every CLI command. Deploy production artifact to a temporary preview, configure exact origins and run smoke scenarios using scoped test records. Record Hosting version before/after verification; promote that same version using pinned CLI hosting:clone. Do not rebuild or republish preview between verification/promotion. Record previous good frontend; rollback through release history and restore intended version. Missing first previous release can use a known compatible earlier increment release, never an invented version.

- [ ] **Step 4: Verify the deliverable.** Unit test PASS. Production build, emulator route/header checks and `npm run test:e2e -- tests/e2e/release-smoke.spec.ts` PASS on preview/live with enforcement enabled. Compare operational/knowledge snapshots immediately around rollback with no concurrent user actions: unchanged. Record exact URLs, CLI version, version IDs, build/config identity and rollback/restoration outcomes.

- [ ] **Step 5: Record and commit.** Record real results in the increment handoff. Stage only this task’s named files after checking for secrets, then `git commit -m "chore: verify Firebase release and rollback"`. See index for initial Git setup; never claim a commit if unavailable.

### Task 3: Reset, two rehearsals and complete requirement coverage

**Files:**
- Create: `tests/e2e/demo-scenarios.spec.ts`, `docs/implementation/acceptance-coverage.md`, `docs/implementation/handoffs/increment-5.md`.
- Modify: `docs/03-demo-runbook.md`, `docs/02-slide-outline.md`, `README.md` with actual implementation status only.
- Reuse: `scripts/seed/reset.ts`; no new reset path.
- Capture: local `artifacts/demo-fallback/stock-completed.png`, `guidance.png`, `source-highlight.png` from the verified deployed rehearsal.

**Interfaces:**
- Consumes: reviewed deployed release, all handoff reports, scoped reset and source IDs.
- Produces final readiness report with scenario timing, requested/dispatched/received totals, source checks and known limitations.
- Acceptance coverage uses phase IDs P1–P7 and checkbox ordinal AC1… in current original specs, plus extensions E1…E8 and Hosting H1…H7; exact mappings in execution index.

- [x] **Step 1: Write the behavioral checks.** Local cases implemented and verified; see later checkpoint for fixture/model limits. Test `repeatable_two_scenarios_preserve_knowledge`:
```ts
expect(await h.inventory()).toMatchObject({hqOnHand:16,hqReserved:0,inTransit:0,salonOnHand:4});
expect(await h.transferQuantities()).toEqual({requested:2,dispatched:2,received:2});
expect(await h.knowledgeSnapshot()).toEqual(knowledgeBeforeReset);
expect(await h.businessSnapshot()).toEqual(beforeDamageQuestion);
```
Run reset/replenishment/RAG twice, preserving source versions. Test provider-unavailable UI once with controlled failure; ensure manual workflow remains usable.

- [ ] **Step 2: Confirm the relevant check fails.** Run `npm run test:e2e -- tests/e2e/demo-scenarios.spec.ts`. Expected: a failing named behavior before implementation; repair missing test infrastructure first, because an unavailable runner is not behavioral evidence.

- [ ] **Step 3: Implement the task.** Pause ordinary demo interactions, dry-run then explicitly reset only demo operational records. Perform two timed rehearsals with distinct HQ/Legnicka sessions and independent Zakładowa damage question. Record actual highlights/answers and verify supported claims. Keep full talk 20min/demo 6min; admin extensions need correctness checks but not equal stage time. Update slide/runbook Markdown with exact prompts, initial/final counts, auth/session preparation and a failure branch: continue manual stock flow; capture and show clearly labeled screenshots of the verified stock result, grounded answer and highlighted PDF; verify the files open without network access. If those files are unavailable during the talk, explain the unavailable RAG path instead of fabricating a result. Map every original acceptance item to real test/report evidence and list limitations. Do not present scheduled future work as complete.

- [ ] **Step 4: Verify the deliverable.** Both repetitions pass and fit 6min demo; talk outline fits 20min. All three fallback screenshots exist, contain actual verified results and open offline; record their locations in the runbook. Original phase/extension/Hosting coverage has evidence or an explicit blocker, never silent exclusions. READY requires all required criteria; if a missing criterion remains, report BLOCKED with completed independent work and precise next action.

- [ ] **Step 5: Record and commit.** Record real results in the increment handoff. Stage only this task’s named files after checking for secrets, then `git commit -m "docs: record verified DevFest rehearsal and readiness"`. See index for initial Git setup; never claim a commit if unavailable.

## Completion and next context

Final report links release IDs/URLs, all increment evidence, acceptance/UI coverage, test/evaluation outcomes, two rehearsal timings and known limitations. User receives the deployed app plus updated Markdown presentation materials. No production-readiness or business-savings claims are inferred from this demo.
