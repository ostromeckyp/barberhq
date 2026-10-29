# Approved interface state coverage — 24 October 2026

Scope: plan 5, task 1. Source requirements: [views and states](../design/views-and-states.md), [handoff SPEC](../../design_handoff_barberhq/SPEC.md), and the approved whole-request upgrade. Both exported HTML references were opened in a browser. They remain unchanged.

**Owner follow-up, 24 October:** functional evidence below does not close visual design fidelity. Added plan 5 Task 1A: compare the running application against the designs, including missing tab icons, vertically aligned X controls, a stationary mobile bottom-sheet handle while scrolling, request example buttons/chips and removal of “English questions only”. Findings remain open until actual application verification; Polish-language answer quality is separately unverified. Publication of the earlier candidate is held for this review and a fresh build.

**Later 24 October result:** the [Task 1A review](ux-ui-design-review.md) closes the reported controls locally, also removing the redundant six-item hint at the owner's request. Combined UX/state/citation suites pass 20/20; Angular 125/125. New catalog-derived example tests verify input-only action and retained draft; the old hint-spacing test is superseded by hint removal plus example/action spacing. The new preview candidate is frozen separately. Polish input has two captured hosted outcomes, with English answers under the existing contract; see the review for limits.

**Publication follow-up:** owner approved the frozen UX package; `foundation` version `f97f1aa60feaf08c` is deployed through 31 October. [Hosted smoke](ui-state-preview-review.md) adds actual SALON-session evidence for examples, both removed hints/tab icons, original PDF with nine highlights, retained question/answer, markerless workspace Back and a 320px sheet scrolling 555px with a stationary handle. The rest of the table retains its explicit evidence dates and source-only limits.

## Evidence boundaries

- **F**: fresh browser PASS on 24 October, isolated Auth/SQL; `ui-states.spec.ts` (11), `procedure-rag.spec.ts` (4 desktop and 4 at 320px), and the markerless PDF Back check (1). AI answers and HTTP PDF bytes are controlled fixtures, not provider/Storage acceptance.
- **U**: fresh Angular suite PASS, 28 files / 125 tests. Facade tests exercise state transitions with controlled dependencies; they do not prove the layout of every state.
- **H**: earlier browser/integration evidence, retained in the linked handoff; not rerun or claimed as fresh here.
- **S**: source implementation inspected, no dedicated fresh browser assertion. These are explicit final visual/rehearsal checks, not invented test passes.
- **D**: approved design deviation; the old prototype behavior is superseded.

Local raw evidence: `.superpowers/sdd/2026-09-29-barberhq-05-demo-release/`. `ui-final.log`: 15/15 desktop; `pdf-mobile-final.log`: 4/4 at 320; `pdf-back-final.log`: 1/1; `hint-final.log`: 1/1; `web-final.log`: 125/125. The extra hint run only updates the screenshot after the tab animation. The old PDF fixture identity was repaired to obey the current schema; no authorization guard was relaxed.

Viewport column: `—` means state/unit/source evidence without a new viewport assertion. Browser route coverage is 1280×900, 360×900 and 320×900 for salon routes; HQ routes and both idle dialogs are checked at 320×900. New PDF/answer controls are checked at desktop and 320. Earlier library inspection used 1280/800/390; see its handoff.

Abbreviations: **salon** = `/salons/:salonId`; **detail** = `/salons/:salonId/requests/:id` or `/hq/requests/:id`; **docs** = `/procedures?tab=documents`; **source** = `/procedures/sources/:versionId`; **review** = `/procedures/review/:versionId`. These are the implemented scoped detail routes.

## Shell and login

| Approved state | Route / role | Viewport | Evidence / result |
|---|---|---|---|
| Salon navigation | salon / SALON | 320/360/1280 | F route checks; unauthorized management actions absent |
| HQ navigation | `/hq`, `/hq/stock` / HQ | 320 | F route checks; H workspace switching in `hq-workspace.spec.ts` |
| Mobile menu | all / both | 320 | H `foundation.spec.ts`, responsive handoff |
| Loading permissions | `/login` / signed in | — | U SessionFacade; S `checkingAccess` and disabled submit |
| No assigned access | `/no-access` / unassigned | — | U SessionFacade; H foundation browser check |
| Expired/signed-out session | guarded routes / both | — | U late membership/inventory responses discarded; H sign-out route check |
| Forbidden resource | detail/review/source / wrong scope | — | H [library salon checks](handoffs/document-library.md); S route guards |
| Unknown route | unknown / both | — | S route fallback; final browser visual check remains |
| Initial login | `/login` / anonymous | 320 | F actual sign-ins; H keyboard login |
| Invalid email/password fields | `/login` / anonymous | 320/1280 | H `responsive-order.spec.ts`; S field error markup |
| Signing in / duplicate blocked | `/login` / anonymous | — | S `LoginFacade.busy`, submit guard, delayed progress; final held-response browser check remains |
| Authentication/network error | `/login` / anonymous | — | S caught sign-in error with retryable form; final injected browser check remains |
| Checking access | `/login` / authenticated | — | U membership state; S visible “Checking access…” |
| Access denied | `/no-access` / authenticated | — | U SessionFacade; H foundation unassigned-account check |
| Successful role routing | `/login` → salon/HQ | 320/1280 | F real isolated sign-in for both roles |

## Salon inventory and request composer

| Approved state | Route / role | Viewport | Evidence / result |
|---|---|---|---|
| Inventory loading; no fake zero | salon / SALON | — | U SalonInventoryFacade first-read/error distinction |
| Six products / quantities / low stock | salon / SALON | 320/360/1280 | F actual fixture quantities and fit; U threshold; H settings/compact-grid checks |
| No active requests | salon / SALON | — | H foundation; S separate empty request list |
| Read error / retry | salon / SALON | — | U inventory failure/retry; H foundation injected read failure |
| Refreshing / last-known stale / offline | salon / SALON | — | U inventory stale/reconnect/focus; H foundation failed refresh |
| Initial assistant / manual available | salon / SALON | 1280 | F wrapped hint spacing, screenshot; U assistant input |
| Manual add / edit / remove / 1–99 | salon / SALON or HQ salon context | — | U DraftStore; H responsive order and replenishment browser suites |
| Shared list across tabs and mobile sheet | salon / SALON | 320/360/1280 | H responsive order: close/reopen, resize, Escape and focus restoration |
| AI preparing | salon / SALON | — | U ReplenishmentAssistantFacade; H intercepted AI browser suite |
| Ambiguous product / quantity clarification | salon / SALON | — | U line-specific clarification; H AI browser checks and [hosted Lite acceptance](replenishment-lite-update-review.md) |
| Proposal ready / no reservation / projection | salon / SALON | — | U latest-draft merge; H real hosted proposal and three-product quantities |
| Insufficient HQ stock warning | salon / SALON | — | F25 320px shortage warning remains nonblocking; exact SQL inventory snapshot unchanged after draft dismissal; U all-item approval validation |
| Already active product | salon / SALON | — | H replenishment active-product exclusion; S `activeFor` and existing-request link |
| AI failure / limit / timeout, manual fallback | salon / SALON | — | U provider failure retains draft; H intercepted quota fallback |
| Submitting / duplicate blocked | salon / SALON or HQ context | — | U SubmissionService double-click and scope guard; H lifecycle |
| Unknown outcome / reconcile same key after reload | salon / both | — | U frozen payload/key, session error and reopen; H committed-lost-response browser test |
| Confirmed created / request link | salon / both | — | H two-unit and three-product lifecycle; U scope-bound result |
| Partial success per product | salon / both | — | D replaced by one atomic multi-item request; retries preserve one whole payload/key; no per-line fulfillment |

## Request detail, dialogs and HQ queue

| Approved state | Route / role | Viewport | Evidence / result |
|---|---|---|---|
| Pending approval | detail / both | 320/360/1280 | F pending route and SALON action absence |
| Reserved / dispatch available to HQ | detail / HQ | — | H lifecycle; U workspace-specific allowed actions |
| Dispatched / receipt available to destination | detail / SALON | — | H lifecycle and HQ acting-for-salon checks; U action validation |
| Received / 2–2–2 / no duplicate receipt | detail / both | — | H lifecycle; U duplicate/partial receipt blocked |
| Rejected / history and reason | detail / both | — | H rejected request browser test; U reason validation (existing accepted upgrade) |
| Loading | detail / both | — | F25 held read shows actual Loading request; failed/retried read recovers real quantity with no fabricated figures |
| Missing/forbidden | detail / wrong scope | — | S common unavailable message; H scoped access checks |
| Insufficient approval stock | detail / HQ | — | U validation checks every product; H integration/backend conflict checks |
| State changed / stale approval | detail / HQ | — | H replenishment browser stale approval; requires refresh/review |
| Action error | detail dialog / permitted actor | — | S RequestActionFacade alert and editable retry; H action integration tests |
| Action in flight | detail dialog / permitted actor | — | F25 held approval shows Saving action, disabled Cancel/confirm, Escape blocked while busy |
| Unknown action outcome | detail dialog / permitted actor | — | F25 unknown alert and Retry same action visible at320; keyboard retry retains entire payload/key; controlled stale result closes dialog with honest message |
| Confirmed/replayed success | detail / permitted actor | — | H lifecycle and repeated-command checks; no optimistic stock success |
| Approval dialog ready / idle cancel | detail / HQ | 320 | F Enter/Escape, trigger focus restored; SQL proves no reservation |
| Reject dialog ready | detail / HQ | — | H rejection browser flow; S shared Material dialog semantics |
| Dispatch dialog ready | detail / HQ | — | H lifecycle; S shared dialog |
| Receipt dialog ready | detail / destination | — | H lifecycle/mobile detail evidence; S shared dialog |
| Damaged/missing/partial receipt | detail / destination | — | U all-item validation; H browser rejection of bad receipt; request remains dispatched |
| HQ queue loading | `/hq` / HQ | — | F25 held ListHQQueue read shows Loading requests at320 |
| Pending queue | `/hq` / HQ | 320 | F real fixture queue fit |
| Reserved queue / removed after dispatch | `/hq` / HQ | — | H lifecycle; S shared filtered queue and detail action flow |
| One section empty / whole queue empty | `/hq` / HQ | — | F25 whole empty queue at320; prior H pending/one-section-empty evidence |
| HQ stock shortage / busy / handled elsewhere | `/hq` → detail / HQ | — | Same detail/command evidence above; no second queue action implementation |
| HQ read error / retry | `/hq` / HQ | — | F25 injected read failure/Retry recovers the real empty queue at320 |

## Procedure assistant

| Approved state | Route / role | Viewport | Evidence / result |
|---|---|---|---|
| Initial / example / question | `/procedures` / both | 320/360/1280 | F route fit and question availability |
| Searching/preparing | `/procedures` / SALON | desktop | F deferred response, live status, duplicate submission/Clear disabled |
| Cited answer / provenance / excerpt | `/procedures` / HQ | desktop/320 | F exact source/version/physical page; U markup escaping; H [actual hosted answer](rag-hosted-acceptance-2026-10-24.md) |
| Clarification | `/procedures` / SALON | 320 | F controlled response; U distinct presentation |
| Insufficient evidence | `/procedures` / SALON | 320 | F no fabricated steps; H hosted legal-deadline abstention |
| Error / quota / timeout | `/procedures` / SALON | 320 | F controlled provider unavailable retains question; U stable adapter error mapping covers limit/timeout |
| Source changed during answer | `/procedures` / SALON | 320 | F controlled 409, no current-answer presentation |
| Return from cited PDF | source → `/procedures` / HQ | desktop/320 | F question/answer retained, one model request; U account/workspace change clears state |

Human acceptance: owner confirmed all five rehearsed DAM-001 v1 instructions on 24 October in the [claim review](rag-claim-review-2026-10-24.md). This does not waive the known retrieval-completeness miss in the separate automatic-replacement question.

## Library and PDF source

| Approved state | Route / role | Viewport | Evidence / result |
|---|---|---|---|
| Library loading | docs / both | — | F25 held read announces Loading documents and hides empty result; U polling visibility and destruction |
| Empty library | docs / both | 320 (salon also 360/1280) | F honest empty state; HQ Add document only |
| Library error / retry | docs / both | — | F25 injected library read failure/Retry at320; empty result appears only after successful read |
| Add/replace PDF dialog | docs / HQ | 320 | F keyboard idle cancel/focus; U Browse/drop same selector and frozen replacement identity |
| Upload / processing / return later | docs/review / HQ | — | U upload/registration recovery; H [hosted lifecycle](handoffs/document-library.md) |
| Unsupported PDF / size / encryption / scan | docs / HQ | — | U multi-file/10 MiB checks; H parser/worker integration; S visible failed/needs-review state; not all error layouts newly rendered |
| Every-page human review | review / HQ | — | U rendered-and-checked requirement; H two-page hosted review blocks early publication |
| Published / replacement / superseded | docs/review / both | H 1280/800/390 | U read-only published review; H hosted v1→v2, historical PDF |
| Processing failure / retry | docs / HQ | — | U stable stage retryability and identical retry command; H worker/lifecycle checks |
| Publication conflict / fresh review | review / HQ | — | U conflict clears page checks; H deployed SQL conflict checks |
| Unknown publication outcome / reopen | review / HQ | — | U same frozen command/key survives reopening |
| Withdrawal dialog / confirmed withdrawal | docs / HQ | — | U confirmed outcome message; H named hosted withdrawal and retained audit/original |
| No authority / revoked source | docs/review/source / SALON | H desktop/mobile | H dedicated SALON browser checks, no management controls and no canvas after withdrawal |
| PDF fetching | source / both | — | S delayed actual loading; no invented progress percentage |
| Cited physical page / exact highlight | source / authorized | desktop/320 | F two verified marks; H real DAM source and pixel/geometry tests |
| Zoom / rotation / keyboard | source / authorized | desktop/320 | F Enter controls, 125%, two highlights and Back; H cropped/rotated geometry suite |
| Missing geometry | source / authorized | — | H PDF fixture fallback check; S explicit unavailable notice and excerpt |
| Bad chunk/version | source / authorized | — | H no-evidence browser check; S metadata authorization before rendering |
| Fetch error / retry | source / authorized | — | F25 controlled503 fetch error, usable Back, explicit Retry and successful authorized PDF recovery at320 |
| Render error / download | source / authorized | — | F25 corrupt PDF decode error/Retry, valid canvas recovery and real browser PDF download; direct canvas-render failure remains source-only |
| Revoked/foreign source | source / forbidden | — | H PDF access suite and dedicated hosted revoked-source check; no preview/download |
| Historical version | source / authorized | — | H hosted superseded version; S explicit historical notice |
| Invalid page / safe bounds | source / authorized | — | H page-99/chunk-page tests; S bounded previous/next |
| Transcript / unavailable extracted text | source / authorized | — | H keyboard transcript and missing-text browser cases |
| Library/direct source Back | source → Procedures Documents / HQ salon context | desktop | F markerless regression preserves authorized salon workspace and returns to Documents; assistant marker returns to retained answer |

## Visual and scope conclusions

Fresh screenshots were visually inspected: `hint-desktop.png` and `return-answer-320.png`. The tab-animation capture was corrected before using it as evidence. The reference uses the same Archivo/Plex Mono typography, brand red, neutral surfaces and Material controls as the application. Existing responsive handoffs cover the 760px layout switch, minimum type sizes and dialog/list accessibility; the current route suite adds 22 overflow measurements. Projector readability and all rows marked S still need the final human rehearsal. This is not a claim of exhaustive visual state certification.

Approved deviations are explicit: real Auth replaces fake prototype roles; reset stays operator-only; one atomic request replaces per-product partial success; physical pages/rectangles come from extraction (DAM v1 page 1, not the sample page 2); publication requires explicit review; there is no persistent chat, auto-send, stock mutation by AI or automatic replacement. Library management calls withdrawal rather than deletion because audit/private originals remain.

Task 1's demonstrated fixes and focused regressions are complete locally. The state inventory has no silent omissions; S rows remain explicit final acceptance work. Plan 5 as a whole is **not READY**: the current frontend is published and scoped hosted smoke is recorded; controlled same-version promotion/rollback, remaining exact-origin/deployed gates and two timed, owner-controlled rehearsals are still outstanding.


## 25 October continuation

**F25** denotes six fresh local Playwright cases in `tests/e2e/ui-failures.spec.ts`, with isolated real Auth/SQL records and explicitly intercepted read/callable/PDF failures. They cover queue/detail/library loading/error/recovery, busy/unknown/stale approval identity, fetch/corrupt-PDF recovery/download and a nonblocking shortage draft. Screenshots under `.superpowers/sdd/2026-09-29-barberhq-05-demo-release/remaining-states/`; approval-unknown and draft-shortage screenshots visually inspected. All6pass; initial harness mistakes (operation case, heading ambiguity, inventory shape and PDF header) were corrected without application changes. This is not a live provider-failure rehearsal.

Current production is Back-button version `4b833190c12b9244`. The [release verification](release-verification.md) separately checks actual hosted bytes, complete public configuration and version/backend drift. A 320px Chromium viewport is not physical iPhone/Safari certification. Original source-only rare states and projector acceptance remain explicitly scoped above; no complete state-certification claim.
