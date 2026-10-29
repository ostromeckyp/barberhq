# Procedures and request cards — original design follow-up, 24 October 2026

**Status: PUBLISHED to production live Hosting after owner approval “wdroz to bede patrzyl na prodzie”, 24 October 2026, 18:57 Warsaw.** Existing foundation publication remains the previous UX package. This follows the owner’s request to approach the original design, then the explicit correction to link instruction paragraphs directly to the original PDF and replace Back with a breadcrumb.

## Changes against the original

| Area | Implemented |
|---|---|
| Procedures page | Common heading before compact icon tabs; shell padding used once; white question card, example and action row |
| What to do | Numbered steps with compact **[source] § section · Page** links. Each link opens its exact original PDF version/chunk/physical page, with verified highlights where extraction supports them |
| Sources | One card per source section, beside the answer on wide content and below it on narrow content; Material disclosure keyboard behavior, exact excerpts and provenance |
| Demo provenance | Dark banner only when synthetic sources are included; mixed-source wording stays truthful. No fake policy names, paragraph numbers, prototype placeholder text or invented PDF pages |
| PDF navigation | **Procedures › source title** breadcrumb replaces Back. Cited instruction returns to Assistant; direct/library source returns to Documents. URL built as a Router UrlTree, with tab in query params |
| Search state | Current edited question, submitted question and answer retained in memory across source navigation. A next unsubmitted question does not relabel the old answer. No repeat AI call on return; existing account/business/workspace clearing remains |
| Documents | PDF icon, provenance/status below title, version/page count and actual Published/Added date; management conditions retained. Data has no general Updated timestamp, so none is invented |
| Request item card | Bordered compact card with origin icon/name/remove header for READY and unresolved items; editable quantity stepper, HQ availability, projected salon stock and shortage explanation. Whole-request submission retained |

Existing atomic requests, real Auth, immutable versions and reviewed publication remain authoritative over obsolete prototype behavior. Product examples continue to derive from inventory under the separate product knowledge specification. State is not persisted across page reloads.

## Verification

- Angular: **28 files / 127 tests pass**; root typecheck and optimized production build pass.
- Browser: full 37-case run had 36 passes and one assertion comparing encoded colons differently from Angular. The test now compares parsed version/chunk/page/return marker identities; its focused rerun passes. All 37 scenarios are covered by the completed run plus that correction. Two mixed ready/ambiguous proposal cases also pass.
- Actual local Auth/SQL fixtures, controlled AI/PDF responses. Direct PDF/citation route, highlights, keyboard breadcrumb return, unchanged AI call count, next-input retention, chosen salon context, source access revocation and 320/1280 layout verified. No hosted/model-quality claim for this new package.
- Scoped independent review: unresolved items initially missed the shared header; regression reproduced and corrected. Final review of paragraphs, breadcrumbs and state found no actionable issues.
- Graph update ran; these untracked procedure sources remain incompletely indexed, so relevant relationships were checked directly.
- Existing initial-bundle warning: **545.30kB** against 500kB warning, below 1MB error budget.

Interrupted browser runs lost their owned local servers and are retained as incomplete infrastructure runs, not acceptance evidence. One real breadcrumb query construction bug was caught before completion and corrected with UrlTree.

## Frozen package

`artifacts/ui-state-release/design-fidelity/`: 59 public files, 38 named source snapshots, public configuration unchanged, standalone Hosting config and exact artifact guard. Build SHA-256 `371a3cca460e4eef76ac005aab0c7823e67575e55098d89457934cab4cf93a5e`.

Owner approved publication to production. Local Hosting and post-deploy HTTP checks passed. It has no backend deployment configuration. Plan 5 operational rehearsal/promotion gates remain outstanding.

## Actual app screenshots

Evidence directory: `.superpowers/sdd/2026-09-29-barberhq-05-demo-release/design-fidelity/`.

- `procedures-1280.png`, `procedures-320.png`: instruction/source layout with original submitted question.
- `pdf-breadcrumb.png`: exact original PDF with breadcrumb and highlights.
- `documents-1280.png`, `documents-320.png`: real fixture version metadata and existing HQ lifecycle controls.
- `request-cards-1280.png`, `request-sheet-320.png`: compact item cards and fixed mobile sheet chrome.
- `original-procedures.jpg`, `original-request.jpg`: source design inspected in the browser.

## Production publication

- Live URL: [BarberHQ production](https://notbad-6be95.web.app). Hosting version `abf76e9f28d40c47`, FINALIZED, released 24 October 2026 at 18:57 Warsaw.
- The exact frozen build above was deployed with isolated `--only hosting` configuration; predeploy hash guard passed. All59 remote public files are byte-equal to the candidate. Six SPA routes, four entry assets, no-cache/nosniff headers and PDF worker pass.
- Actual Chrome check shows the production sign-in page; authenticated feature flow was not repeated on this origin. Local authenticated checks remain described above. The user will review after signing in.
- Before deployment the live channel had no release in CLI metadata. The unchanged foundation preview keeps version `f97f1aa60feaf08c` as the previous accepted frontend reference; no automatic rollback was executed.
- Clean publication identity and checks: `artifacts/ui-state-release/design-fidelity/publication-record.json`. Raw channel listings may contain owner account metadata and are retained locally. No backend deployment or stock/document command was performed.
