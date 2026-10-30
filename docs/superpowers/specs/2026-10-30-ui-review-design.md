# UI review fixes — design

30 October 2026. Roadmap item 6 (item 5, dictation, was dropped by the owner). The owner asked to fix every finding below as one plan.

## Why

A review of every screen on a 390 px phone (Polish) and 1280 px desktop (English), plus a run with the backend slowed by 4 s, found missing loaders, mobile layout breaks and inconsistent patterns. Salon staff use the app on phones; the demo audience sees both widths.

## Goal

Every screen shows that it is loading instead of a blank page or a false empty state, no control wraps or overlaps on a 390 px phone, and the same thing (back, refresh, quantities, empty states) looks the same everywhere.

## Findings and decisions

All decisions are the assistant's calls; the owner approved fixing the whole list.

### Loading

1. **Blank page on cold start.** Fix: a static splash inside `<app-root>` in `web/src/index.html` (BarberHQ wordmark + thin indeterminate bar, inline CSS, colors from the theme, no text besides the brand, `prefers-reduced-motion` stops the animation). Angular replaces it on bootstrap.
2. **Edit product shows an empty, editable form while loading.** Fix: delayed progress bar; form disabled and Save disabled until the product has loaded; a load failure shows `app-empty-state` with retry.
3. **HQ "Salon requests" shows "0 / No requests in this section" while loading.** Fix: while the first load runs, sections show the loader, not counts or empty text.
4. **Pager "Previous / Next" shown with one page or while loading.** Fix: render the pager only when a previous or next page exists (every list using `common.actions.previous`).

### Mobile layout (390 px)

5. **Salon request filter wraps to two rows.** Fix: the toggle group stays on one row and scrolls horizontally when it does not fit; no wrapping.
6. **HQ "Requests / Delivery issues" are two stacked pill buttons.** Fix: one `mat-button-toggle-group`, same look as the salon filter, side by side.
7. **"Add product" and "Refresh" touch** on HQ stock. Fix: 8 px gap in page-header actions (fixes every page).
8. **Floating "Request products" button covers the last product card.** Fix: bottom padding on the dashboard list equal to the button height + 16 px on mobile.
9. **"Back to …" differs per page** (right-aligned stroked button, full-width pill). Fix: one shared `app-back-link` (`shared/ui/back-link/back-link.ts`): text button with `arrow_back` icon, left-aligned above the page header, inputs `link` (router commands) and `label`. Used on every page that has a back action.
10. **Documents page uses 32 px side padding**, others 16 px. Fix: same page padding as other pages.

### Consistency

11. **"Stock now" card** in request detail: five label/hint rows per product and a double divider between products. Fix: one compact table, a row per product, columns HQ stock / Reserved / Available / In transit / `<salon>` stock; the hints move to a short legend under the table. On mobile the same table, numbers only, product name as a full-width row above its numbers. Test ids `hq-on-hand` and `salon-on-hand` stay.
12. **Quantities** use sans on the salon dashboard and monospace on HQ stock and request lists; "szt." / "pcs" repeats under every number. Fix: all quantities use the body font with `font-variant-numeric: tabular-nums` via one shared class in `shared/styles`; the unit appears once (column header or a single inline suffix), never on its own line under a number.
13. **Refresh button has three styles.** Fix: everywhere a `mat-button` with the `refresh` icon and the label, in the page-header actions; disabled while loading.
14. **Empty states differ** (bare text on HQ shorthand, left-aligned card on Documents). Fix: page-level empty states use `app-empty-state`; empty sections inside a card keep a one-line muted text.
15. **Desktop side nav truncates "Salon shortha…".** Fix: nav labels wrap to two lines instead of ellipsis.
16. **Salon dashboard repeats "Stan magazynowy salonu"** (eyebrow and card title). Fix: card title becomes "Produkty na stanie" / "Products in stock".
17. **Order panel outcome shows raw status words** (UTWORZONO / NIEPOWODZENIE / NIEZNANY) and the conflict link shows a product ID. Fix: drop the status word line; CREATED → "Zamówienie złożone." / "Request submitted." plus the existing link; FAILED → existing failure message only; UNKNOWN → "Nie wiemy, czy zamówienie zostało złożone. Sprawdź listę zamówień." / "We could not confirm the request. Check your request list."; conflict link names the product, falling back to the ID only when the name is unknown.

## Out of scope (reported only)

- Retail price entered in grosze on the product form.
- Offline / PWA.

## Constraints

- Angular 22 standalone, signals, zoneless; Angular Material; shared UI rules in `web/src/app/shared/ui/README.md`.
- Every new or changed text is a Transloco key in both `en.json` and `pl.json` (`tests/unit/i18n-keys.test.ts` must pass). Polish copy: short, natural UI Polish.
- Code-structure rules (`tests/unit/code-structure.test.ts`): one model per file, logic files ≤ ~300 lines.
- No behavior change beyond what is listed; no backend change.
- Existing web unit and e2e tests keep passing; e2e selectors updated only where the markup changed on purpose.

## Proof

- Web unit tests for: pager hidden with one page; product editor disabled while loading; HQ queue shows no counts while loading; outcome copy per status and product name in the conflict link; `app-back-link` renders its link and label.
- A new e2e spec at 390 px: request filter on one row; HQ toggle buttons on one row; last dashboard card not covered by the floating button; no horizontal page overflow on the main screens.
- Before/after screenshots of all 15 screens at 390 px and 1280 px, plus the slowed-backend run, reviewed by the assistant.
