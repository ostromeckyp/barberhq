# HQ workspace refinement — 8 October 2026

Extends increment 2b in the existing checkout. No cloud deployment or data reset.

## Behavior

- HQ can create one whole request on behalf of a salon in its business. Both the UI and transactional backend authorize this; audit records retain the real HQ user. Same-key recovery works for HQ and salon users.
- Request capabilities are derived from membership, authorized salon and state, independently of the originating list. HQ approves/rejects pending requests and dispatches reserved requests. Salon users confirm receipt; expanding HQ receipt was not part of this implementation.
- The same detail component supports observation and the authorized operations. Back navigation preserves the originating HQ or salon list; it does not influence permissions.
- HQ salon Dashboard retains ordering and hides the redundant availability panel. Salon users keep availability. `/hq/stock` is an HQ-only lazy feature with its own facade, data access and business-scoped GraphQL query, showing On hand / Reserved / Available.
- Requests, salon stock and HQ stock use Material tables with consistent columns, existing design tokens and contained keyboard-accessible scrolling on narrow screens.
- Timeline submission label is `Requester`, since the command no longer implies a salon actor. The actual actor UID remains in the database audit.

## Runtime and verification

The reported UNKNOWN approval/rejection had an unavailable callable backend: Functions5001 were stopped for the earlier migration gate. The owner explicitly authorized reopening without reset. Functions now use preserved Auth9099/SQL9399. Legacy recovery checks and idempotency are retained; no original request was approved/rejected merely for testing.

Verified 43 Angular tests, 33 emulator integration tests, root typecheck, Functions build and Angular public build. Browser suite verified all 13 scenarios: initial run passed12 and exposed a test navigation timing issue; after fixing its wait, both HQ scenarios passed. These prove HQ submission/audit, approval from a salon list, rejection from HQ queue, direct-link capabilities, reservation arithmetic18/2/16, salon route denial, column alignment, mobile320/360, accessibility, existing full receipt and lost-response recovery. All writes used isolated fixture businesses.

Initial bundle remains over the existing500kB warning budget:545.84kB. Budget unchanged. Cloud authorization/App Check/deployment checks remain separate release gates.

Implementation began with bounded GPT-6 Luna delegation. The agents reached their usage limit after backend/table work; the parent completed the remaining UI wiring, recovery authorization and verification.
