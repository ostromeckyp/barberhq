# UI state preview update — prepared 24 October 2026

**Status: PUBLISHED to `foundation` after owner approval “publikuj”, 24 October 2026.** The [design review](ux-ui-design-review.md) records the fixes and remaining boundaries. This is not final release/rehearsal acceptance. The earlier package at `artifacts/ui-state-release/site` is retained as historical evidence; the published package is its separate `ux-update` subdirectory.

## Visible changes

1. Open a cited PDF, then use **Back to answer**: the current question and answer remain in memory without another model call. Account/business/workspace changes clear this state. Direct/library PDF links retain **Back to workspace**.
2. The ordering assistant's redundant six-item hint and the procedure assistant's English-only hint are removed.
3. Icons are restored in both tab groups; quantity remove buttons are vertically aligned.
4. The mobile request sheet keeps its handle/close control stationary while its body scrolls.
5. Example / Several products fill text from the current salon catalog without preparing/submitting. The procedure example is a generic Polish question button. Primary action icons/style and the Request list heading match the reference intent.

Test-only changes enable Angular test-file isolation and align the old PDF fixture IDs with the current schema. The [state inventory](ui-state-coverage.md) lists fresh checks, previous evidence and remaining final visual checks. Independent source/fixture reviews found no actionable issues.

## Exact candidate

| Identity | Value |
|---|---|
| Project / site | `notbad-6be95` / `notbad-6be95` |
| Channel | Existing `foundation`, renew for 7 days |
| Preview | [BarberHQ foundation](https://notbad-6be95--foundation-unesffgt.web.app) |
| Public directory | `artifacts/ui-state-release/ux-update/site` — 58 files |
| Build SHA-256 | `942442d2f3365753a3d17f407fefb7cfb15a21702056737c1cf70efae9c86ea3` |
| Config SHA-256 | `04dbe169bf4f8b841d3c3facde86e271a1a56db47cfa508e373197dd6fbb05a5` |
| Configuration | Byte-equivalent public input and same config hash as the accepted ordering preview |
| Source record | `artifacts/ui-state-release/ux-update/source-manifest.json`, 20 named source/test/config files with frozen copies |
| Published Hosting version | `projects/notbad-6be95/sites/notbad-6be95/versions/f97f1aa60feaf08c` |
| Previous preview version | `52d04eb83cf361b3` |
| Publication / expiry | 24 October 2026, 17:59 Warsaw / 31 October 2026 |

The package has its own `firebase.json`, build record and predeploy guard. It contains no backend deployment configuration. Existing callable endpoints, flags, App Check configuration and SQL SDK target are preserved. The artifact scanner passed; the 545.07kB initial bundle retains the existing 500kB warning and remains below the 1MB error budget.

## Verification and publication boundary

Latest local results: Angular **125/125**, combined UX/state/citation browser checks **20/20**, plus one final example screenshot check. Root typecheck, production build, exact artifact guard and local Hosting **6 SPA routes / 4 entry assets / PDF worker** pass. The independent UX review's single accessible-name issue was reproduced and corrected; no other scoped correctness findings. Earlier 320px citation/markerless navigation evidence remains in the increment handoff.

The owner-approved publication executed successfully from this frozen package, with the exact hash guard passing:

```sh
GCLOUD_PROJECT=notbad-6be95 node --import tsx artifacts/ui-state-release/ux-update/check-hosting.ts
node node_modules/firebase-tools/lib/bin/firebase.js hosting:channel:deploy foundation --project notbad-6be95 --config artifacts/ui-state-release/ux-update/firebase.json --expires 7d --non-interactive
```

Postpublication read-back confirms FINALIZED version `f97f1aa60feaf08c`; the live channel is unchanged. All 58 public files match the frozen bytes. Six SPA routes, four entry assets, headers and the PDF worker pass against the real preview.

The existing signed-in SALON session verified both tab icon sets, removed hints, catalog-derived examples, a real grounded answer, nine original-PDF highlight rectangles, retained question/answer on Back, and library/direct-PDF Back to workspace. At 320px, the sheet body scrolled 555px while the handle stayed at y=92, close remained visible and horizontal page overflow was zero. Test drafts were not submitted. A concurrently edited original browser tab was preserved; the controlled test continued in a separate tab, which was closed after restoring the viewport.

Two real question submissions passed Auth VALID / App Check VALID and HTTP 200 (5.41s and 5.58s server latency). The first response was not captured because the initial tab navigated during concurrent activity; the separate-tab response and PDF return were captured. This is scoped signed-in acceptance, not a fresh login or a new human approval of generated claims. No stock/document command, reset, Functions/SQL deployment or live promotion was performed by the controller.

Proof under `artifacts/ui-state-release/ux-update/`: `publication-record.json`, `hosted-http-proof.json`, `hosted-browser-proof.json`, `runtime-logs-proof.json`, `hosted-request-desktop.png`, `hosted-answer.png`, `hosted-source.png`, `hosted-return.png` and `hosted-sheet-mobile.png`. No complete cloud data snapshot was taken; unchanged whole-business state is not inferred from the read-only smoke.

Polish question input was tried separately on the currently published backend: one grounded answer and one honest abstention were captured. Answers remain English under the existing contract; the new product-knowledge/alias/dictation specification is separate future work.
