# Delivery receipt UI — local verification, 2026-10-25

Approved plan: `docs/superpowers/plans/2026-10-25-delivery-receipts-and-issues.md`, Task6. Local Auth/SQL/Functions emulators only; no publication or cloud writes.

- Salon request `Check delivery` opens the guarded receipt route. HQ receives only through an explicitly selected authorized salon workspace.
- Whole nonnegative quantities are checked per dispatched product. Good units enter stock; damaged/missing units create the existing root issue. Zero-good receipts are valid, without zero stock movements.
- Memory drafts retain quantities, description, batch and explicitly selected source across PDF navigation. The PDF Back button returns to the authorized receipt in its current workspace; other source returns retain their previous behavior.
- Only submitted commands enter the separate delivery recovery namespace. Unknown outcomes lock editing and preserve the original immutable payload/key across reload. Account/workspace changes never reassign saved commands. Definitive errors refresh authoritative context and preserve editable fields and source references for explicit correction.
- Explicit sign-out clears the departing user's delivery recovery entries only. A transient auth/read failure locks access without deleting drafts. Inaccessible browser storage prevents a new submission; it does not prevent sign-out.
- Full Axe exposed missing landmark semantics in the existing shell; toolbar/banner and drawer/navigation roles fix that without suppressing checks.

## Evidence

`.superpowers/sdd/2026-10-25-delivery-receipts-and-issues/task-6-tests.log`:

- Angular150/150; new journal/draft/facade/return and explicit sign-out coverage included.
- Browser9/9:8good+2damaged, all-good, zero-good/missing, invalid sum, PDF return, actual commit followed by controlled lost response and reload/replay, keyboard/full Axe/no overflow at320/360/1280px.
- Root TypeScript, Angular development build, graph update PASS.
- Screenshots in the same workspace `screenshots/receipt-*.png`; inspected mobile320 and desktop1280 manually. The app scrolls within its main container; screenshots show its viewport, not every section at once.

The first attempted browser launch was not executed when approval infrastructure hit an account quota; after the advertised reset a normally approved fresh launch produced the expected behavioral RED for the absent Check delivery action. Earlier logs with compiler setup failures are not behavioral evidence.

Remaining plan work: HQ issue UI, legacy backfill/reset compatibility, release preparation and independent review. Production remains unchanged.
