# AGENTS.md — BarberHQ UI implementation

You're implementing the BarberHQ salon-ordering app in **Angular + Angular Material (M3)** from the design references in this folder.

## Read first
1. `README.md`: what's in this package and how to use it.
2. `SPEC.md`: the source of truth for theme tokens, typography, spacing, layout, the Material-vs-custom split, roles, scenario data and interaction rules.
3. `BarberHQ Screens.dc.html`: every view, state and variant. Open it in a browser. Each board is labelled `ID · view · role · state · width · route`.
4. `BarberApp.dc.html`: clickable prototype of the full flow (sign in → order → approve → dispatch → receive).

## Rules
- The HTML files are **design references, not code to port**. Don't copy their inline styles, their DOM structure or the `support.js` runtime. Rebuild the UI with Angular Material components and one `mat.theme()` theme.
- Use a standard Material component wherever the SPEC's section 5 table says so. Build the listed custom components (`OrderPanel`, `QueueRow`, `StatusTimeline`, `PdfViewer`, …) as standalone Angular components composed from Material parts.
- Theming changes colour, type and density only. Keep Material's default behaviour (focus traps, keyboard handling, a11y).
- Brand red `#dc241f` is used only for primary actions, active nav and focus. Errors use `#b3261e` and always have an `error` icon.
- Actions and nav items that a role doesn't have aren't rendered at all. They are never shown disabled.
- Show success only after the server responds (no optimistic UI). Block double submits and use idempotency keys.
- Submitting a batch creates **one request per product**.
- Match SPEC's scenario numbers exactly in seed/mock data (Legnicka · Pomada Matowa 100 ml: HQ 18 → 16, salon 2 → 4).
- All UI copy is English, as in the references. Demo procedure text is marked PLACEHOLDER.

## Suggested structure
```
src/app/
  core/        auth, role guard, api services, idempotency
  shell/       toolbar + sidenav
  features/
    login/
    salon-dashboard/   (stock table, OrderPanel, active requests)
    request-detail/    (NextStepCard, DeliveryQuantities, StatusTimeline, dialogs)
    hq-queue/
    procedures/        (assistant, documents, pdf viewer)
  shared/      StatusChip, EmptyState, StaleBanner, theme.scss
```

## Done when
Every board in `BarberHQ Screens.dc.html` has a matching route and state in the app (desktop at 1280 and mobile at 360 or wider), with no horizontal scroll at 320px.
