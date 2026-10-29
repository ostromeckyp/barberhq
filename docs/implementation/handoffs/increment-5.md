# Increment 5 — release and demo rehearsal

## Current checkpoint —27 October

[Both current production scenarios](../demo-rehearsal-2026-10-27.md) completed twice using distinct SALON/HQ live-origin sessions. Current frontend e56c6e784f80e9d1, procedure00004-hun;66-file release guard passes. Times5:40.138/6:30.059 include instrumentation and a3:57 gap in run2; presenter timing/human answer/readability acceptance remain open. [Technical continuation](../hosted-technical-gates-2026-10-27.md) adds32 HTTP assertions (24 CORS/anonymous plus8 independent valid-Auth App Check negatives),7 deployed SQL race/authorization cases, production HQ upload/extraction/withdrawal, SALON denial and protected preview PDF. No App Check weakening, reset or publication occurred. The separately approved temporary unassigned Auth identity was tested and deleted, with independent absence/data-preservation checks. Compact login stays local by owner decision. This checkpoint supersedes older current-state/pending statements below; historical proof retains its original scope.


25 October 2026. **NOT READY for final demonstration acceptance.** Live and `foundation` serve `4b833190c12b9244`; controlled rollback/restoration passed. [Two authorized reset-based rehearsals](../demo-rehearsal-2026-10-25.md) passed stock, preserved knowledge/original metadata and produced genuine offline fallbacks. First full scoped run 5:23; second RAG call and retry timed out. Full protected-origin gates and two successful stage repetitions remain open. Diagnostic instrumentation is published; one production answer passed in5.32s. The previous timeout is not explained, preview App Check fails and an unset→20 max-instance difference remains open. See [diagnostic results](../rag-phase-diagnostics-2026-10-25.md). Historical sections below preserve their original scope and dates.

## Later local verification and new product requests

[Local scenario verification](../demo-local-verification-2026-10-25.md): added the missing two-repeat scenario and provider-outage/manual-submission case. Full72/72 browser and131/131 Angular checks pass after three real contrast failures were corrected in two stylesheets. A59-file UI candidate is prepared with unchanged approved public configuration; CSS independent review was interrupted by the account usage limit, so publication is not claimed. These local controlled AI/PDF checks do not replace hosted rehearsals or access-security checks.

[Delivery exceptions and Firebase notifications](../future-work.md) record the owner's new requirement: accept good units immediately, report remaining damaged/missing units, and keep physical handling grounded in accessible procedure documents. The owner chose separate receipt/issue records and an HQ-created linked replacement request. The [written design](../../superpowers/specs/2026-10-25-delivery-receipts-and-issues-design.md) was approved by the owner; its [eight-task implementation plan](../../superpowers/plans/2026-10-25-delivery-receipts-and-issues.md) is prepared for review before implementation. It is not folded into the current release or the product-knowledge/dictation specification.

## 25 October continuation

- [Six local browser cases](../ui-state-coverage.md): queue/detail/library loading and failed-read recovery, busy/unknown/stale action retry with the same payload/key, failed/corrupt PDF recovery and download, and a nonblocking shortage warning. Real isolated Auth/SQL with controlled failure injection; no new application behavior was needed.
- [Release verification tooling](../release-verification.md): local preflight checks actual bundled public values and independently reconstructs the configuration hash. Hosted mode checks all 59 bytes, exact origin/version, backend ready revisions and local artifact stability. `validatePromotion` rejects identity drift. 28 release/Hosting unit checks and root TypeScript pass.
- Fresh read-only live record `artifacts/releases/2026-10-25-live-final.json` identifies version `4b833190c12b9244`, build `c8003c2ef7bd0794d09c006523ac43d4c2aae9ca90edaad7a4e12e58fc3f2f70`, config `04dbe169bf4f8b841d3c3facde86e271a1a56db47cfa508e373197dd6fbb05a5`; frontend and backend ready-revision fingerprints were stable across checks. No operational-state preservation claim follows from those fingerprints alone.
- Existing local operational reset check and published-knowledge reset-preservation check each pass. Knowledge test uses isolated SQL and fixture originals; this is not a cloud Storage/reset rehearsal.
- Independent review P2 issues corrected: read actual SQL inventory rows instead of absent helper fields; verify configHash instead of trusting build metadata. RED→GREEN evidence retained; no deferred findings.
- [Acceptance index](../acceptance-coverage.md) now enumerates all 59 original phase/extension/Hosting checkboxes with evidence and explicit remaining gates. Runbook/slides describe one atomic multi-item request, deployed Procedures, target rather than measured timings, and unavailable final offline fallback files honestly.
- After explicit owner approval, pinned Hosting clone updated preview, briefly selected live `6dca66a0ba4ae78d`, then restored `4b833190c12b9244`. Full hosted checks passed for preview, rollback and restored live. All scoped data hashes/counts matched before, during and after. Existing SALON preview/HQ live sessions rendered DAM-001 v1 and returned to Documents through Back. The pinned promotion attempt was rejected because live already served the same version; no new release was created at that step.
- No new model call, dependency reinstall, application rebuild, backend/schema/rules/security change, stage/commit, stock/document mutation or live reset in this continuation. No Angular source changed; prior application build/131-test evidence remains historical.
- Next-step reset preparation found a stale generated SDK target. The operator CLI now validates explicit cloud configuration and sanitizes SDK errors; four focused tests RED→GREEN, root TypeScript and independent review pass. Corrected read-only dry-run reports 41 operational rows and 24 inventories; no reset was applied.

Later owner continuation authorized the separate reset/rehearsal scope. Both resets and stock flows have now executed; this supersedes earlier “no reset” statements within the dated local/rollback-only entries above. First full run passed; second reached two real 25s RAG timeouts. No third reset or speculative latency fix was applied. The subsequent approved [diagnostic publication and control question](../rag-phase-diagnostics-2026-10-25.md) are complete, with the configuration difference explicitly unclosed. Next: complete the unresolved acceptance gates. The controlled rollback remains independently documented in [release verification](../release-verification.md).

## Task 1 local deliverable

Implemented the approved in-memory return from a cited PDF to its current question/answer. `AssistantFacade` now belongs to the application session; its existing account/business/workspace effect and generation guards clear stale state and discard late responses. Citation links carry the literal `returnTo=assistant`; the PDF viewer preserves it during page navigation and selects Back to answer. Markerless links retain the existing workspace return.

Corrected the ordering assistant field's hint area using Material dynamic subscript sizing plus an 8px margin. RED measured a −16px hint/button overlap; the focused browser regression now passes.

Named production files:

- `web/src/app/features/procedures/assistant.facade.ts`
- `web/src/app/features/procedures/procedure-assistant.component.ts`
- `web/src/app/features/procedures/source-excerpt.component.ts`
- `web/src/app/features/procedures/pdf-viewer/pdf-viewer.facade.ts`
- `web/src/app/features/procedures/pdf-viewer/pdf-viewer.component.html`
- `web/src/app/features/replenishment/ui/assistant-input.ts`

Tests: new `tests/e2e/ui-states.spec.ts`; extended `procedure-rag.spec.ts`, assistant/citation unit tests; corrected legacy `pdf-viewer.fixture.ts` canonical IDs. Angular 22.2's test builder default `isolate=false` caused four Firebase adapter mock failures only in the whole suite. Focused subsets passed; the complete suite passed with isolation enabled. `web/angular.json` now explicitly enables test-file isolation. Production callable code was unchanged.

The [coverage inventory](../ui-state-coverage.md) maps every approved view/state, role, route and available evidence. Rows marked S are inspected source awaiting final visual checks; they do not count as fresh browser passes. Prototype per-product partial success is superseded by the approved atomic multi-item request. Both original HTML references were inspected in the browser and left unchanged.

## Fresh verification

| Check | Actual result |
|---|---|
| `npm run test:web` | 28 files / 125 tests PASS |
| Independent assistant/citation rerun | 2 files / 6 tests PASS; no review findings |
| UI states + procedure RAG browser suites | 15/15 PASS; isolated Auth/SQL, intercepted AI/PDF |
| Procedure browser suite at 320×900 | 4/4 PASS |
| Existing markerless PDF Back | 1/1 PASS after fixture identity repair |
| Final hint geometry/screenshot | 1/1 PASS |
| Root TypeScript | PASS |
| Optimized production build | PASS, 58 public files; existing 545.02kB warning |
| Artifact project/site/hash/file guard | PASS |
| Local Hosting routes/headers/assets/worker | PASS: 6 SPA routes, 4 entry assets, JavaScript PDF worker |
| Code review graph | Incremental update completed; untracked procedure/fixture sources absent and inspected directly |

Evidence directory: `.superpowers/sdd/2026-09-29-barberhq-05-demo-release/`. Logs distinguish test setup corrections (actual empty-state labels, exact arrow label, legacy fixture IDs), sandbox startup denials and observed application regressions. Screenshots `hint-desktop.png` and `return-answer-320.png` were visually inspected after waiting for the actual tab/answer state. The first transitional tab screenshot was replaced before use as evidence.

The temporary local Hosting config initially returned 404 because its public directory used an absolute path with the installed emulator. A path relative to that config fixed the local setup; the unchanged frozen package then passed the route/header check. No hosted smoke is inferred from this local result.

## Prepared preview candidate

Read the [publication review and result](../ui-state-preview-review.md). Published frozen package: `artifacts/ui-state-release/ux-update/`. Build hash `942442d2f3365753a3d17f407fefb7cfb15a21702056737c1cf70efae9c86ea3`; config hash `04dbe169bf4f8b841d3c3facde86e271a1a56db47cfa508e373197dd6fbb05a5`. Configuration matches the accepted ordering preview. The earlier `484917…` package remains historical. Current Hosting version `f97f1aa60feaf08c`, previous preview `52d04eb83cf361b3`; published 24 October, expires 31 October. Live channel unchanged.

## Task 1A UX/UI follow-up

The [application/design comparison](../ux-ui-design-review.md) records tab icons, aligned X controls, stationary sheet chrome, request examples, a clickable procedure example and removed hints. The owner's concurrent formatting was retained. The new replenishment specification requires data-driven product examples, so names come from scoped inventory rather than literals. Alias/document-kind/dictation backend work was not folded into this slice.

Latest verification: **20/20 browser tests**, **125/125 Angular**, root typecheck, optimized production build (58 files, 545.07kB initial bundle warning), exact artifact guard and local Hosting six-route/four-asset/worker check. One independent P2 accessible-name finding was fixed with RED→GREEN verification; no other scoped source issues. A final screenshot-only rerun of the example case passed. Polish input produced one grounded English answer and one abstention on the already published backend; see review for the interrupted extra submission and quality limits.

The current ordering backend uses the already-approved Flash-Lite EU update; RAG keeps its separately accepted model/retrieval setup. Hosted evidence and the known replacement-decision retrieval miss remain in [RAG acceptance](../rag-hosted-acceptance-2026-10-24.md). Owner confirmation of the five stage instructions is recorded in [claim review](../rag-claim-review-2026-10-24.md).

## Remaining plan 5 work

1. Complete the remaining source-only rare-state visual checks in the coverage table. The exact UX preview publication and scoped authenticated smoke are complete: 58 hosted files byte-equal, six routes/worker pass, two real Auth/App Check-valid HTTP 200 questions, grounded PDF/retained-answer return, examples, markerless Back and stationary sheet chrome at 320px. Existing SALON session reused; fresh login/HQ replay not part of this slice. Controller test drafts were not submitted; concurrent original-tab edits were preserved. See publication proof for scope and consumed calls.
2. Implement/verify target- and version-aware release records; verify same-version live promotion, rollback and restoration with unchanged operational/knowledge snapshots. A frontend rollback is not a data reset.
3. Prepare the precise operator reset/rehearsal scope, perform two timed stock + guidance runs within six minutes, create verified offline fallback screenshots and complete original acceptance mappings. Final slides/runbook timing remains to be measured.

No staging or commit was performed, following the owner's existing checkout preference. No cloud reset, stock action, corpus change, backend release or live promotion was performed during task 1. Final READY requires the remaining release/rehearsal evidence; this report does not waive it.

Cleanup: all controller-owned Auth/SQL, Angular, reference HTTP and Hosting servers were stopped; their five application ports have no listeners. The two public generated config files were restored byte-for-byte and the original root build-record absence restored. The frozen preview package and local evidence remain available.
