# Delivery issue UI — local verification, 2026-10-25

Plan Task7, local emulator fixtures only. No publication or cloud state changes.

HQ queue has a Delivery issues view with an independently queried authorized open count, OPEN/ALL filter and bounded URL pagination. Procedure assignment opens the Task5 dialog. The issue shows the immutable original inspection, outstanding good units, actual replacement states and paginated issue history.

HQ can start review, add a note and create one linked replacement. The normal request view handles approval/dispatch; every child links to its root issue. The salon sees the same authorized facts without HQ commands. There is no manual Resolve action. Full accepted replacement resolves the root automatically; rejected/partially damaged children keep the remaining entitlement.

Unsent notes stay in memory for the exact user/business/issue/workspace. PDF returns use the bounded delivery-issue marker. Submitted unknown commands reuse the separate Task6 journal with their original immutable payload/key; changing workspace cannot authorize an HQ replay in salon context.

Evidence: task-7-browser-verified.log14/14, task-7-web-all.log156/156 and task-7-typecheck.log in `.superpowers/sdd/2026-10-25-delivery-receipts-and-issues/`. Browser cases include double click, normal child approval/dispatch,1good+1bad→remaining1, active-order conflict, salon and HQ deep-link permissions, selected PDF/unsent-note return, committed lost response/reload/replay, rejected child, resolved balances, zero-good facts and keyboard/full Axe/no overflow at320/360/1280px. Screenshots `screenshots/issue-*.png`.

First browser run was behavioral RED on the absent Delivery issues selector. Intermediate failures found a new Refresh button contrast issue (fixed with its Material text color) and test readiness/fixture errors: wait for the newly added child, and read actual inventory versions when dispatching a second fixture request. These are retained in the evidence logs, not counted as successful runs.
