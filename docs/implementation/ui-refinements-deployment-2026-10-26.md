# Login and delivery UX — published

Date: 2026-10-26. Owner authorization: “publikuj” after the local login and delivery UX reports. Publication scope: Firebase Hosting only.

## Final release

| Identifier | Value |
| --- | --- |
| Preview and live version | `e56c6e784f80e9d1` |
| Frozen candidate | `artifacts/ui-refinements-2026-10-26-final/` |
| Build SHA-256 | `9933e54a48c473b979b49564626a1a84c23e207112b76c9327b15003a5270817` |
| Public configuration SHA-256, unchanged | `04dbe169bf4f8b841d3c3facde86e271a1a56db47cfa508e373197dd6fbb05a5` |
| Backend ready-revision fingerprint, unchanged | `sha256:d3778b7cb487f03bd831c6077f8915b3bd45eae670ce43243649262f67fbf8a9` |
| Previous delivery release | `37b268d53c7d9336` |

All 66 public files, Hosting headers, SPA routes, production configuration and PDF worker were verified against the frozen artifact on preview and live. Live is a pinned clone of the exact preview version. All162 captured source/build-input hashes and release metadata match. The original generated public configuration files and original root build-record presence were restored byte-for-byte after building. Existing551.79kB initial bundle warning remains; configured production build gate passes.

## Included changes

- Login clears the password and its touched/dirty validation state together, avoiding the transient required-password error after valid credentials. Genuine credential errors remain visible.
- The permanent red card border is removed. A delayed red progress indicator occupies a permanently reserved4px slot; field validation and credential-error space are reserved too.
- Check delivery offers Mark all as good as an unsaved edit only.
- Relevant damaged/missing/both suggested questions open Procedures for editing and explicit Ask assistant. The scoped back button returns to the retained inspection draft. Repeated missing-assignment notices are removed; available PDF links remain.
- Product labels/dispatched quantities now use the draft row's product ID instead of assuming response-array order matches draft order.

## Finding during hosted verification

The first candidate was published as interim version `e65a59574eeb44c7` (build `c70c6a2dedc723c35916cc25310b8f860a8944f4f72057d6e357567f3db3ca14`). Its real UI round trip exposed an existing index-based presentation defect: after returning from Procedures, values appeared under a different product label when the fresh response order differed from the retained draft. No receipt was submitted.

A new regression test failed (`5` displayed where product-specific `8` was expected). The fix maps product information by ID while preserving Angular Signal Forms' existing index tracking. An attempted product-value tracking expression produced NG01904 orphan-field errors in tests; that candidate was never published. Final eight receipt tests and the entire176-test Angular suite pass. The rejected artifact `ui-refinements-2026-10-26-fixed/` and interim artifact are retained as evidence, not release candidates. No backend or data migration was needed.

## Verification

- Fresh Angular176/176 across38 files; production build, artifact/predeploy integrity and graph update PASS.
- Final preview: Mark all as good displayed Cement2, Dry Matt3, Matowa1. An unsent Cement classification1good/1damaged → Procedures with editable prefilled question → Check delivery retained Cement1/1, Dry Matt3/0, Matowa1/0 and the test description. No Ask assistant or Record inspection was pressed. The suggestion marker was consumed as intended. Production initially exposed the same flow and led to the regression fix; final live bytes exactly match the corrected tested preview.
- Production login on the existing alternate Hosting domain `notbad-6be95.firebaseapp.com` was tested without logging out the user's web.app session. An intentionally nonexistent `example.invalid` login returned the real controlled error, cleared the password, and showed no required-field errors. Card rectangle was identical before/after: x660,y360.453125,width400,height546.0859375; border-top0, progress slot4. No real account was created or valid credentials supplied. Successful authentication → membership → redirect is covered by the deferred regression test, not a fresh successful cloud login in this publication.
- No Functions/schema/rules/IAM/billing/config changes, stock/receipt/issue/document mutation, reset, model question, staging or commit. Normal authentication failure logs/read traffic are not a claim of zero service activity. The known AI provider error is unchanged and outside this Hosting release.

Proof/logs: `.superpowers/sdd/2026-10-26-ui-refinements-publication/`, including `preview-final-release.json`, `live-final-release.json`, `final-tests.log`, `build-final.log`, `login-layout-proof.json`, `live-login.png`, `live-login-error.png` and `preview-final-return.png`. Earlier local browser-extension failures remain in their local reports; the later hosted checks described here succeeded. No full mobile/Axe pass is claimed for this publication.
