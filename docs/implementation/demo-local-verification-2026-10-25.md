# Local demo scenario verification — 25 October 2026

## Scope and result

Added `tests/e2e/demo-scenarios.spec.ts` from plan5 Task3. **Two focused cases pass**, with a complete final browser suite **72/72**, Angular **131/131**, root TypeScript and production build passing. This is local acceptance evidence, not two additional hosted stage rehearsals.

The new scenarios use isolated real Auth, SQL Connect and stock callable Functions emulators. The AI replies and PDF response bytes are controlled fixtures. Each stock request still travels through the actual current stock callable/repository/transaction. Cloud fixtures are refused explicitly.

1. Reset the same isolated business twice through the existing reset transaction, complete request2 → approval → dispatch → intact receipt, then ask the separate damage question, open the exact cited PDF/highlights and return to retained guidance. Compare operational snapshots around the question and document/version/page/chunk/vector snapshots across each reset and question. Verify each run yields HQ16/reserved0, salon4, one received request, requested/dispatched/received2, two movements and four action receipts/keys. The base citation fixture is unpublished for HQ review, so this test creates its own salon-readable published fixture; publication-pipeline correctness is not claimed by that setup.
2. Inject provider-unavailable responses for both assistants, verify no stock effects or fabricated guidance, switch to Manual and actually create a pending request through the stock callable without an inventory movement.

Initial startup failures were sandbox port/Chromium restrictions and test cleanup initialization. A malformed test-only collection name (`salonSettings` instead of `salonSettingss`) was corrected. The source access failure was expected authorization: the shared fixture was unpublished for HQ, not a salon-readable source. Correcting only the scenario fixture yielded2/2. No missing application behavior or invented RED phase is claimed for this existing-behavior verification.

## Actual contrast defects found by the full suite

The first complete run was **69/72**, not green. An unchanged-source focused repeat reproduced all three failures:

- `replenishment-ai.spec.ts` / `Then two units move once and the request is fully received`: AXE found white Prepare proposal text on an interaction ripple background with ratio4.26 instead of4.5.
- `replenishment.spec.ts` / `two_units_move_once_and_damaged_receipt_blocks_whole_request`: Refresh text ratio4.46 on the cream background.
- The corresponding `three_products_move_once_and_damaged_receipt_blocks_whole_request`: the same Refresh contrast failure.

Narrow fixes:

- Shared Material theme: black filled-button state layer/ripple darkens the red during interaction, preserving white text contrast. Base brand red stays unchanged.
- Request detail: use Material's scoped `text-label-text-color` override for Refresh. The prior ordinary `color:var(--muted)` declaration was overridden by Material; the intended muted color is now effective.

Existing failing cases pass unchanged after the correction; focused10/10 and final full72/72 pass. An exploratory held-button test did not reproduce the release ripple and was archived only as investigation evidence; it is not presented as a permanent regression test or a RED observation. The existing AXE tests supply actual RED→GREEN proof.

## Prepared frontend package

`artifacts/ui-state-release/contrast-corrected/` is **PREPARED_NOT_PUBLISHED_REVIEW_PENDING**:

- 59 public files; build `31ee56f42bc4e9e54b553b8ad27538c3c993d525dab82ecc6489d107e6d91786`.
- Config hash `04dbe169bf4f8b841d3c3facde86e271a1a56db47cfa508e373197dd6fbb05a5`, independently checked against the known working public snapshot by local release preflight.
- 53 source snapshots. Compared with the accepted Back package's52 files, only the two named stylesheets changed; the new scenario test is the extra snapshot.
- Build warning: initial546.10kB against500kB. No component stylesheet warning.
- Independent review of the new scenario and diagnostic report found no actionable findings. The subsequent review of the two CSS fixes was interrupted by the account usage limit; it did not complete. Author inspected the installed Material tokens and the exact scoped diff. Do not claim a completed independent CSS review.

Production Hosting remains `4b833190c12b9244`; the [separately approved diagnostic function publication](rag-phase-diagnostics-2026-10-25.md) is already deployed. This UI package contains no partial-receipt, issue-management or notification feature.

No stage/commit, dependency reinstall or further cloud reset/stock mutation was performed. The latest read-only reset count is34 operational rows/24 inventories, rather than the older14-row snapshot; a future reset needs a new approved quiet window and fresh counts. The owner clarified their successful PDF check used production, not preview.

Evidence: `.superpowers/sdd/2026-09-29-barberhq-05-demo-release/demo-scenarios/`, including `browser-suite.log`, `contrast-repeat-red.log`, `contrast-green.log`, `browser-suite-final.log`, `angular-final.log`, `typecheck-final.log`, `production-build-escalated.log`, `preflight-final.log`, `next-reset-dry.log` and exact named-file baselines. Original generated public config and root build-record absence restored byte-for-byte; test servers stopped. Graph update completed; untracked test and styles remain outside useful graph coverage and were inspected directly.
