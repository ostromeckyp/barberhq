# Login validation and progress — local verification

Date: 2026-10-26. Local verification record; the separately authorized publication is documented in [UI refinements deployment](ui-refinements-deployment-2026-10-26.md).

## Cause and fix

`LoginComponent.signIn()` cleared the password model in `finally` after marking the form touched. The required validator then displayed “Password is required” during membership resolution or before redirect, even after successful authentication. The password field now uses the installed Angular Signal Forms `reset('')` API, which clears its value and touched/dirty state together. Email is retained; actual authentication failures still show the existing controlled error.

The permanent red card border is removed. The existing delayed progress bar now occupies a permanent 4 px slot at the card top, with brand-red active indicator and transparent track. Both fields reserve their validation subscript space. The authentication-error region reserves exactly the same message content/layout while idle, with visibility hidden, no alert role and aria-hidden, so displaying a real failure does not insert a new block into the centered card.

## Evidence

- Three original regression tests failed before implementation: touched password after accepted credentials, absent reserved feedback and absent progress slot.
- Four login tests now pass: accepted credentials → pending membership → redirect without required error; real rejection; empty-field validation; delayed progress appears/disappears within the same slot and retains feedback layout content.
- Full Angular suite: 175/175 in 38 files. Development build, graph update, scoped Prettier and diff whitespace checks passed.
- Chrome DOM measurement confirmed idle card width400 px, height546.0859375 px, top border0 px and progress slot4 px. Browser actions/screenshots repeatedly failed through the extension; no full real-browser authentication, layout comparison or Axe pass is claimed. Tests use deferred session requests; no real accounts, cloud writes or private configuration access.

Evidence and four original source baselines are in `.superpowers/sdd/2026-10-26-login-feedback/`. Existing delayed-loading behavior and other uncommitted work are preserved. No dependency/security/backend change, staging/commit or deployment. The earlier delivery UX changes remain local too.
