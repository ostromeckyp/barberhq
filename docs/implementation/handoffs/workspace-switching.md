# HQ and salon workspaces

Approved 8 October 2026 after the HQ refinement. One active workspace controls navigation, presentation and operations, without changing the authenticated identity.

## User flow

1. HQ starts at Salon requests; its other menu entry is HQ stock.
2. Workspace → Salon — Legnicka opens that salon's Inventory, with Requests and Settings in its menu.
3. A persistent “Acting on behalf of salon Legnicka” banner accompanies all salon pages for HQ. Availability and ordering match the salon view.
4. A submitted request opens `/salons/:salonId/requests/:requestId`, with no HQ approve/reject/dispatch buttons.
5. Workspace → HQ returns to the queue; opening the same request uses `/hq/requests/:requestId`, with HQ lifecycle actions.
6. After dispatch, switching back to the salon allows HQ to confirm a complete intact receipt. Audit records retain the real HQ user.

## Boundaries

Workspace comes from the URL, survives reload and does not grant backend authorization. HQ routes are guarded. Salon details verify the URL salon matches the loaded request; incompatible details are unavailable. Return context preserves only bounded filter/offset matching that workspace. Old generic request links redirect after an authorized read. The logo returns to the current workspace using a UrlTree, avoiding double encoding of business/salon IDs.

Backend receipt checks now allow own-business HQ or assigned salon staff. Foreign HQ and unassigned salon requests remain forbidden, including replay. Full quantities, intact confirmation, atomic inventory updates and idempotency are unchanged. No schema migration, reset or cloud deployment.

## Verification

The browser workflow covers HQ ordering → HQ approval/dispatch → salon-perspective HQ receipt, actual HQ audit UID, HQ stock 18→16 and salon stock 2→4, unavailable wrong-salon detail, legacy deep-link redirect, reload, Back, restricted salon user access, 320/360/1280px and Axe checks. Existing full replenishment, lost-response and settings scenarios were rerun with workspace routes.

The initial browser run passed 11/13 and found a real double-encoded logo URL plus a five-second assertion too short for a callable cold start. The UrlTree fix and the existing 20-second submit-test convention resolved these; the affected 7 scenarios passed. All 13 scenarios have passing evidence. A final mobile layout adjustment moved the workspace selector into its own row; both workspace E2E tests passed again and the 320px screenshot was visually reviewed.

Final checks: Angular 43/43, emulator integration 35/35, TypeScript checking, Functions build and emulator Hosting build passed. Hosting output contains 45 verified public files. The existing initial bundle warning remains: 546.62 kB against a 500 kB warning budget. Logs are in `artifacts/workspace-switching/`.

Implementation was delegated to GPT-6 Luna for backend and Angular slices; both reached their usage limit. The parent finished the remaining routes, policies and tests. User-staged skill files and original demo data were preserved.
