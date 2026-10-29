# Delivery receipts/issues — final review record

Plan: `docs/superpowers/plans/2026-10-25-delivery-receipts-and-issues.md`; approved local implementation only.

## Verification before independent review

Task reports describe the schema/authorization, native transactions, receipt/replacement accounting, read models/procedure bindings and HQ/salon UI. Logs and baseline copies are retained in `.superpowers/sdd/2026-10-25-delivery-receipts-and-issues/`.

Before independent review, gates were: root254/254, Angular158/158, main integration90/90 plus expanded migration5/5, complete browser97/97, types/Functions/production build and artifact-only guard PASS. The focused delivery browser final25-case gate follows the last corruption validation/fixture changes. Earlier failed runs are preserved and corrected; no failing assertion or Axe rule is suppressed.

Local10→8good+2affected→replacement2→resolved provesHQ6/salon12/dispatch12, immutable original8, zero outstanding.1good+1bad child leaves1 outstanding and next child quantity1. Zero-good, wrong per-SKU sums, foreign scope/source, stale revision, concurrent commands, lost responses, active ordinary order, rejected child, PDF returns and verified identity/workspace changes have focused coverage.

## Review status

The independent whole-feature review completed on2026-10-26. All five Important findings and the two release-integrity/operator findings regraded Important were addressed in one author fix pass, as detailed below. One Minor history-label finding remains deferred. Final gates: root254/254, Angular164/164, integration92/92, complete browser104/104, root types/Functions/production build, manifest verification, artifact-only/Hosting predeploy guards and graph update PASS. The source manifest now covers68 implementation files; all19 frozen backend files match the rebuilt package. No second reviewer was dispatched.

The dirty HEAD diff includes unrelated owner work; committing/staging was prohibited. The empty standard commit range is replaced by scoped files, captured integration baselines and the manifest. This limits the review to the delivery feature.

## Deployment limits

See [handoff](handoffs/delivery-receipts.md) for candidate hashes and [upgrade](delivery-upgrade.md) for the coordinated publication/backup/recovery sequence. No new cloud release, actual production backup, DDL apply, cloud backfill or hosted smoke is claimed. Bundle warning551.79kB/500kB is retained as a build warning, without unrelated optimization work.

## Independent review and single fix pass — 2026-10-26

The same fresh `delivery_final_review` reviewer resumed after a usage-limit interruption and returned its final verdict. No second reviewer or re-review was dispatched. It found no Critical issue or stock-accounting/transaction defect, and five Important browser defects. The author accepted all five:

1. A denial before replay lookup is not proof of no earlier commit. Receipt and HQ issue facades now retain the frozen journal on FORBIDDEN/UNAUTHENTICATED and lock commands until reopening with restored authorization. Two unit regressions failed on deleted recovery entries before the fix, then passed. A real callable/browser scenario commits, loses the response, removes salon access, receives FORBIDDEN, restores access, reloads and reconciles the same key with one receipt/movement.
2. Selected references now remain visible and explicitly removable even after reclassification to all-good. Browser regression failed on the absent Remove source reference button, then passed through SOURCE_CHANGED → explicit removal → ten good units recorded once.
3. Issue pages fetch current procedures through the existing scoped getDeliveryProcedures callable, separately from immutable original-inspection references. Unassigned/unavailable states remain explicit. Browser regressions cover no historical selection, and revoked v1 versus available published v2; revoked metadata remains denied while current PDF opens.
4. Receipt/PDF navigation carries normalized filter/offset; issue/PDF navigation carries normalized issueStatus/issueOffset. The receiving workspace still validates identity, salon and target. Unit regressions reject invalid offsets/filter values and arbitrary redirect fields; browser round trips preserve salon ACTIVE/20 and HQ ALL/20. Old defaults remain unchanged when no context is supplied.
5. Procedure settings persist a frozen SET_PROCEDURE command by user/business/kind before POST, restore it on dialog recreation and reload, preserve it across unknown/access-denied outcomes, and clear only a known outcome. Two unit regressions failed before the change; browser proof closes/reloads/reopens after a real committed/lost response and replays the same key with one setting audit.

The incomplete implementation source manifest and incorrect operator parameter names were regraded Important by effect: release integrity and SQL target selection matter during publication. The reviewed candidate includes the four omitted implementation files (`request.mapper.ts`, `replenishment-api.ts`, `status-chip.ts`, `request-detail.presentation.ts`) and correct `STOCK_SQL_SERVICE` / `STOCK_SQL_LOCATION` names. Its predecessor is retained and superseded, not silently overwritten.

Deferred minor: event quantity rows do not label products or link their particular delivery. Named product totals, original inspection and replacement request links remain available; multi-SKU event-history polish is a later change.

### Review limitations ruled on

Actual cloud backup/restore, production DDL, migration, deployment and hosted smoke remain unexecuted pending separate approval. Archived old bundle memory cannot be retroactively persisted; reconcile open old tabs first. Unrelated owner changes are outside this scoped review. Receipt corrections, physical returns/disposal, refunds, photo upload and push remain deferred product scope. All four rulings, effects and costs are in the plan ledger.

### Test-run qualification

The first new browser launch was blocked by the macOS sandbox MachPort permission and supplied no behavioral evidence. The same local tests ran through normal escalation; no security/configuration bypass was introduced. The first successor-version fixture lacked required PDF metadata; corrected fixture now seeds complete bytes/metadata/pages before its behavioral RED. Two root tests (`knowledge-scope` alternate Storage-host guard and `pdf-exporter` provenance) timed out at5s while all runners competed for CPU; the unchanged complete root suite passed254/254 when run alone in2.90s. No timeout or assertion was weakened. Focused post-fix browser7/7 and Angular164/164 passed; the complete browser suite passed104/104 after the fixes. A sandbox integration attempt failed to connect to localhost (EPERM); the same92-case suite passed through normal escalation without code changes.

## Final candidate

See [handoff](handoffs/delivery-receipts.md) for the exact approved-public-config snapshot and all hashes. Current folder: `artifacts/delivery-receipts-2026-10-26-reviewed/`; build `866ac3f41fb50045787ed432e0fbd4a0c877f272711de5a11df69e3c07b725c0`; source `61445fa9ccd076e861cae291c0e1c63101dbc157bd7d09275e9366e8763f5ff0`. The predecessor is preserved and superseded. Original generated local configurations match the captured baselines byte-for-byte; root build-record is absent as before preparation. At local review completion, cloud readiness still required the separately approved backup/DDL/migration/hosted checks; their subsequent execution is recorded below.

## Cloud follow-through

The separately approved deployment and hosted stock/PDF verification are recorded in [delivery-deployment-2026-10-26.md](delivery-deployment-2026-10-26.md). These are operator observations after the local review, not an expansion of that review's source coverage.

