# Request view — original design review

24 October 2026. Owner correction: restore original Back navigation and match the request detail design, particularly spacing, title/status, dividers and history. This cancels blanket breadcrumbs; the previously approved PDF breadcrumb remains.

## Changes

- Back control matches the reference: 40px desktop height, 8px leading/12px trailing padding, 6px icon gap, and surrounding spacing; mobile retains a 48px touch target. Existing facade preserves authorized list/filter/offset return context.
- Request reference and route sit above the product/quantity title. Status is alongside the title on desktop and wraps on mobile.
- Separate Next step, Delivery quantities and Status history cards reproduce the original composition. Delivery columns have vertical dividers; stock rows have horizontal dividers. Multiple products retain their own quantities.
- History is a vertical sequence of submitted, approved, dispatched and received stages, with actual event metadata and quantity labels. Future stages are Pending; missing past events are explicitly unavailable. Rejected requests show the actual rejection and reason without invented future events.
- Existing action labels, handlers, permissions and whole-request semantics are preserved. No backend or schema change.

## Evidence

Evidence directory: `.superpowers/sdd/2026-09-29-barberhq-05-demo-release/request-design/`.

| Check | Result |
| --- | --- |
| History helper RED → GREEN | Three assertions failed against the initial empty helper; corrected implementation passes |
| Browser RED → GREEN | Missing Status history observed before implementation |
| Full Angular suite | 29 files, 130 tests pass |
| Focused browser suite | 25 tests pass: five request stages, two keyboard returns, procedure/PDF retained state, responsive UI states and multi-item compact grids |
| TypeScript | Pass |
| Production build | Pass, 59 public files; initial bundle warning 545.30kB/500kB and request stylesheet warning 4.01kB/4kB (10 bytes over) |
| Graph | Incremental update complete; new untracked helper inspected directly |
| Independent scoped review | No actionable findings |
| Artifact guard | Pass against the frozen candidate |

Original V4 screenshot and actual desktop/320px screenshots were compared. Earlier abandoned blanket-breadcrumb failures and unavailable Functions-emulator command tests are retained in scratch evidence; they are not represented as passing acceptance checks. The focused suite does not claim full operational E2E coverage.

## Candidate and publication

Published artifact: `artifacts/ui-state-release/request-view/`.

- Build SHA-256: `db7d08b2c616e87cedba747846a145a1e32d13a965d8dad4b0a15ee2e99086a8`.
- Public configuration SHA-256: `04dbe169bf4f8b841d3c3facde86e271a1a56db47cfa508e373197dd6fbb05a5`.
- 59 public files and 48 named source snapshots.
- Owner authorized production publication with “wdrażaj”. Released 24 October 2026 at 22:56:46 Warsaw to https://notbad-6be95.web.app, finalized version `6dca66a0ba4ae78d`, replacing `abf76e9f28d40c47`. The historical design-fidelity artifact is preserved; foundation preview version remains unchanged.
- Fresh predeploy artifact guard and 48 source snapshots verified. Deploy CLI exited 0; all 59 hosted files match the frozen bytes. Six SPA routes, four entry assets, no-cache/nosniff headers and PDF worker checks pass.
- Existing signed-in salon session opened the actual pending request on production. Title/status, delivery dividers and history visibly render; Back returns to `?filter=ALL&offset=0`. Screenshot: `artifacts/ui-state-release/request-view/production-request.jpg`. Read-only smoke; no request/stock/document mutation. Other live request states were not exercised.

Owned local servers stopped; ports 4210, 4270, 9099 and 9399 closed. Generated public configuration restored byte-for-byte; root build record restored to its original absence. No staging, commit, backend deployment or production business operation. Remaining broader plan 5 release/rehearsal work is unchanged.
