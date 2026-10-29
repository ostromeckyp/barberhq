# Back buttons in nested navigation

24 October 2026. Owner requested replacing breadcrumbs with Back buttons everywhere navigation opens a detail view.

## Scope and behavior

Route audit identifies three detail components: request detail (HQ, salon and canonical routes), source PDF, and document review. Primary sidebar destinations remain inventory, requests/queue, stock, settings and Procedures. Dialog dismissal and PDF page controls are separate actions.

- All three detail components use one narrowly scoped navigation style with an arrow icon, 40px desktop/48px mobile height, 8px leading/12px trailing padding, 20px icon and 6px icon gap. Navigation spacing below is 16px desktop/12px mobile.
- Source PDF replaces the remaining breadcrumb with a Procedures button. It navigates using the existing UrlTree: cited assistant source returns to the retained answer; direct/library source returns to Documents.
- Document review uses the same button with the Documents label and its existing destination.
- Request detail keeps its existing Request queue/Requests labels, authorized return destination, filter and offset. Its styles now come from the same shared module.
- No breadcrumbs remain in application source. No browser-history guessing or business command changes.

## Verification

Evidence: `.superpowers/sdd/2026-09-29-barberhq-05-demo-release/back-buttons/`.

- RED: review component initially lacked the shared button; source return browser case initially lacked a Procedures button.
- Found and fixed Material style precedence after extraction. Actual browser metrics initially showed 16px/16px padding and 18px icon/8px gap; the scoped `button.app-back-button[mat-button]` selector now passes the requested exact dimensions at 1280px and 320px.
- Full Angular suite: 29 files, 131 tests pass.
- Focused browser suite: 15/15 pass. Includes retained answer without another model call, keyboard source return after PDF zoom/rotation, markerless Documents return preserving authorized salon workspace, five request states and filtered HQ/salon list return.
- TypeScript and production build pass. Initial bundle warning is 546.09kB/500kB; the previous request component style warning is removed.
- Graph updated; incomplete untracked-file coverage supplemented by direct source inspection. Independent scoped review found no actionable issues.
- Frozen artifact guard passes for 59 public files and 52 source snapshots.

## Publication state

Final published artifact: `artifacts/ui-state-release/back-buttons-corrected/`, version `4b833190c12b9244`, released 24 October 2026 at 23:15:51 Warsaw to https://notbad-6be95.web.app.

Final build SHA-256: `c8003c2ef7bd0794d09c006523ac43d4c2aae9ca90edaad7a4e12e58fc3f2f70`.

### Publication correction

Owner authorized publication with “publikuj back button”. The initial `back-buttons` package was briefly released as `0b189a01a769b9a9` at 23:12:41 Warsaw. Browser smoke exposed missing Procedures navigation and an App Check 400/throttled PDF error. Comparing its *actual bundled runtime configuration to the previous working live bundle* revealed disabled feature flags, a different Firebase app identity and changed endpoint fields. Earlier comparison against the saved generated-file baseline was insufficient; the prior report's inference that the hash change was only serialization/comment formatting was incorrect.

Restored the exact request-view artifact at 23:14:46 as `318ce34d0792290b`. Rebuilt the unchanged Back-button source using the previous working artifact's explicitly extracted **public** runtime configuration, without reading or changing private configuration files. New `configuration-proof.json` asserts complete semantic equality of the bundled public runtime values, including all four enabled feature flags and Firebase app identity. Config SHA-256 is again `04dbe169bf4f8b841d3c3facde86e271a1a56db47cfa508e373197dd6fbb05a5`. Corrected build passes; initial bundle warning546.00kB/500kB.

Final deploy CLI and artifact guard pass. All 59 hosted files match frozen bytes; six SPA routes, four entry assets, headers and PDF worker checks pass. Existing signed-in HQ session visibly rendered DAM-001 v1 PDF, showed Back instead of breadcrumb, and keyboard Return navigated to `/procedures?tab=documents`. Screenshot and browser/HTTP/publication records are saved with the corrected artifact. No new model call or production business mutation; no physical iPhone/Safari test. Prior local responsive evidence remains15/15 and Angular131/131 because application source is unchanged.

Baseline generated file restored byte-for-byte after freezing the corrected build; root build record restored to its original absence. No local servers started for publication. Historical rejected artifact and intermediate release/restore evidence retained.

Frontend publication complete. Foundation preview remains unchanged. No staging, commit, backend change or production business operation. Broader plan 5 operational/release rehearsals remain separate.
