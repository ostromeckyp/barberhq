# BarberHQ — design handoff

Design reference for the Angular + Angular Material (M3) build. The HTML files are a reference, not production code.

Files:
- `BarberHQ Screens.dc.html` — every view, state and variant on one board. Each board is labelled with view, role, state, width and route.
- `BarberApp.dc.html` — clickable prototype of the full demo flow.
- `OrderPanel.dc.html`, `RequestDialog.dc.html`, `StatusChip.dc.html` — component references.

Demo accounts (prototype only, any password): `marta@legnicka.demo` (Legnicka staff), `kuba@zakladowa.demo` (Zakładowa staff), `piotr@hq.demo` (HQ warehouse), `new@…` (signed in, no access).

## 1. Theme (one M3 theme, `mat.theme()`)

| Role | Value | Use |
|---|---|---|
| Primary (brand accent) | `#dc241f` · hover `#b81d19` · on-primary `#ffffff` (4.9:1) | Filled buttons (one primary action per area), tab ink bar, progress bars, focus outline, toolbar underline, cited-region highlight |
| Primary container | `#f6dcda` | Active nav item, selected citation |
| Ink / on-surface | `#171614` | Text, toolbar surface, secondary emphasis |
| On-surface-variant | `#57534c` (muted), `#3b3833` (body secondary) | Labels, hints |
| Surface / background | `#ffffff` cards · `#f6f5f2` app · `#faf9f7` table header | |
| Outline / outline-variant | `#8f897f` fields · `#bdb7ad` stroked buttons · `#cfc9bf` chips · `#e2ded6` cards · `#ece9e3` dividers | |
| Error | `#b3261e` field errors · container `#fdf3f2` / border `#f2c9c5` / text `#8c1d18` | Always paired with an `error` icon, so it can't be confused with the brand red |
| Warning (custom) | container `#fbefd6` / `#fdf7ea`, text `#5c3700` | Stale data, pending, insufficient stock |

Low stock: static `mat-chip` "Low stock" (`warning` icon, `#fbefd6` / `#5c3700`) on a salon stock row when the quantity is ≤ 2. This is one configurable threshold, not a per-product minimum, and the row gets a faint `#fffbf3` tint.

Status chips (`mat-chip`, static, no ripple). Every status has both an icon and a text label:
- Pending approval: `hourglass_top` on `#fbefd6` / `#5c3700`
- Approved · reserved: `lock` on `#dfe6f5` / `#1f3a6b`
- Dispatched: `local_shipping` on `#e3ded4` / `#171614`
- Received: `check_circle` on `#dcebdc` / `#1f4d23`
- Rejected: `cancel` on `#f9dedc` / `#8c1d18`

## 2. Typography

- **Archivo** (Google Fonts) for all UI text. Set it as the theme's brand and plain typeface.
- **IBM Plex Mono** for quantities, IDs, versions and timestamps.
- Icons: **Material Symbols Outlined** (`mat-icon` with `fontSet`).

| Token | Spec |
|---|---|
| Page title | Archivo 750 28/1.1, −0.01em |
| Eyebrow | Plex Mono 500 12, +0.06em, uppercase |
| Card title | Archivo 700 16 |
| Body | Archivo 400 14–15/1.45 |
| Label / hint | Archivo 12–13, `#57534c` |
| Quantity L / M / S | Plex Mono 600 32 / 22–24 / 18 |

Minimum UI text is 12px. On a projector, quantities never drop below 18px.

## 3. Spacing, shape, density

- **Spacing:** 4px grid. Common steps are 4 / 8 / 12 / 16 / 20 / 24 / 28.
- **Padding:** cards 16–18px inside; page padding 24×28px on desktop, 16px on mobile.
- **Gaps:** 20px between cards and columns.
- **Radii:**
  - cards 12px
  - chips 8px
  - fields 6px (M3 outline)
  - buttons full (20px at 40px height)
  - dialogs 28px
  - menus 4px
- **Density:**
  - buttons 40px (M3 default)
  - form fields density 0 (56px); the table filter uses −5 (36px)
  - table rows 56px
  - list items 48px (menus) and 56px (mobile drawer)
- **Touch targets:** at least 40px on desktop and 48px on mobile. Icon buttons are 40–48px.

## 4. Layout and responsive behaviour

| Width | Shell | Content |
|---|---|---|
| ≥ 760px | 60px `mat-toolbar` + 220px `mat-sidenav` (mode `side`) | Two columns: main `flex 1 1 460px` + side column `flex 1 1 320px`, max 400–420px |
| < 760px | 56px toolbar with menu button + 40px context strip (salon · role); `mat-sidenav` mode `over`, 280px | Single column. Order panel below the lists. Sources stack below the answer. |

- There is never horizontal page scrolling.
- The stock table has two columns (Product + size, In salon), so it fits at 320px.
- HQ queue rows wrap: text block → stock figure → chip → action.

## 5. Views → Angular Material vs custom

| View / route | Angular Material | Custom (built from Material parts) |
|---|---|---|
| Shell | `mat-toolbar`, `mat-sidenav` + `mat-nav-list` (`matListItemMeta` count), `mat-menu` (user, reset demo, log out), `mat-chip` (context) | Avatar initials. The context chip is read-only; the salon switcher shows only when the user has more than one assigned salon. |
| 1 Login `/login` | `mat-card`, `mat-form-field` outline, `matSuffix` icon button, `mat-error`, `mat-flat-button`, `mat-progress-bar` | — |
| 2 Salon `/salons/:salonId` | `mat-table`, `mat-tab-group` (Assistant / Manual), `mat-form-field` textarea, `mat-autocomplete` (product), `matInput type=number`, `mat-chip-option` (clarify), `mat-snack-bar` | `OrderPanel`, `OrderProposal`, `ActiveRequestRow`, `EmptyState`, `StaleBanner` |
| 3 Request `/requests/:requestId` | `mat-chip`, `mat-button`, `mat-dialog` | `NextStepCard`, `DeliveryQuantities` (Ordered / Dispatched / Received), `StatusTimeline`, `StockSummary` (rows filtered by role) |
| Dialogs | `mat-dialog` (`disableClose` while sending), `mat-form-field`, `mat-checkbox`, `mat-progress-bar` | Impact rows (e.g. HQ stock 18 → 16), receipt-block warning |
| 4 HQ `/hq` | `mat-card` sections, `mat-list` rows (`mat-table` is optional at 900px and wider), `mat-chip`, `mat-stroked-button` | `QueueRow`. Row actions open the same request details and dialogs; there's no second approval path. |
| 5 Procedures `/procedures` | `mat-form-field` textarea, `mat-chip` (example, citations), `mat-expansion-panel` (sources), `mat-progress-bar` | `SyntheticLabel`, `CitedAnswer`, `SourceExcerpt` |
| 5b Documents `/procedures?tab=documents` | `mat-tab-group`, `mat-list` / `mat-table`, `mat-chip` (Superseded; the "Public product info · unofficial summary" chip appears only on public guides), `mat-stroked-button` (Open). HQ only: `mat-flat-button` (Add document), `mat-icon-button` (Delete), `mat-dialog` + `mat-select` + `mat-form-field` (upload), alert `mat-dialog` (delete) | `DocumentRow` (shared by both roles), `PdfDropZone` |
| 6 PDF viewer `/procedures/sources/:versionId?page=N` | `mat-icon-button` (page, zoom), `mat-stroked-button` (download), `mat-chip` (version, cited page, Superseded) | `PdfViewer`: custom pdf.js canvas, page controls, cited-region overlay |

Keep Material's default behaviour: tabs, autocomplete, dialog focus trap, Esc to close when idle, and checkbox semantics. Theming changes colour, type and density only.

## 5a. Roles

- **Salon staff:** Dashboard, Procedures. Procedures has two tabs: Assistant, and Documents (view only).
- **HQ warehouse:** Request queue, Procedure docs. HQ can add a PDF (optionally replacing an older version, which is then marked Superseded) and delete documents.
- Nav items and actions are rendered only for roles that have them — they're absent, not disabled.

## 5b. Batch requests (manual + assistant)

- **One shared request list** under both input tabs. The Assistant can turn one sentence into several lines (e.g. "2 Pomady Matowe, 3 Sól Morska i 1 olejek Savage"). Manual adds one product at a time with Add, and a duplicate product is merged into its existing line. Each line is tagged "From assistant" or "Added manually".
- **Each line shows** product, a qty stepper (1–99), HQ available and salon now → after, plus a remove button.
- **Line flags:**
  - More than HQ has: a non-blocking warning.
  - Ambiguous product: choice chips, and Submit stays blocked until a product is picked.
  - Already requested: excluded from the submission, with a link to the existing request.
- **Submit** creates **one request per product** (REQ-0412, REQ-0413…), so approval, dispatch and receipt stay per product. There's no partial fulfilment or multi-line request on the backend. The sent confirmation lists every created request.
- **Stock-row "Request" button:** opens Manual with the product filled in.
- **Phase 4:** set `ai=false` to hide the tabs.

## 6. Scenario data (Legnicka · Pomada Matowa 100 ml)

| Stage | HQ stock | Reserved | In transit | Legnicka |
|---|---:|---:|---:|---:|
| Start / submitted | 18 | 0 | 0 | 2 |
| Approved | 18 | 2 | 0 | 2 |
| Dispatched | 16 | 0 | 2 | 2 |
| Received | 16 | 0 | 0 | 4 |

- HQ available = stock − reserved.
- Result: Ordered 2 / Dispatched 2 / Received 2.
- REQ-0409 (Łódzka, Sól Morska × 3) is a separate filler row in the HQ queue.
- Other quantities are fictional.

## 7. Interaction rules

- **AI prepares, people decide.** "Prepare request" produces a draft that isn't saved. Only "Submit request" saves it. HQ approves (which reserves stock) and confirms dispatch as separate steps. The salon confirms receipt.
- **Drafts** disappear on refresh. Clarification never auto-selects a product.
- **Success feedback** (`mat-snack-bar`) appears only after the server responds, never optimistically.
- **Double submits** are blocked with a disabled button and spinner. An unknown result shows "Checking request status…" and retries with the same idempotency key.
- **Stale data or errors** never look like empty stock: show a banner with the last known time, or an error with Retry.
- **Receipt:** if the quantity doesn't match or "All received items are undamaged" is unchecked, Confirm is disabled and the dialog links to Procedures. The request stays Dispatched and stock is unchanged. There's no "Damaged" status.
- **Dialogs:** Cancel before sending saves nothing. Closing while sending doesn't undo the action.
- **Procedure answers** always show "Synthetic demo procedure — not an actual Not Bad Stuff policy." A new question replaces the current answer, and there's no chat history. There are no claim, replacement, stock or email actions. If the sources don't cover the question, show the "not enough information" state, with nothing generated.
- **Procedure text** in the mockups is labelled PLACEHOLDER.
- **Demo PDF:** `docs/damaged-delivery-v1.2.pdf` is a 3-page synthetic file. The cited §2.1 and §2.3 are on page 2, so the mockups say "page 2". Replace it with the real exported document and its extracted page numbers.
- **Hover / press:** Material state layers. In the reference, stroked and text buttons use a `#efece6` hover; filled buttons darken to `#b81d19`.
- **Focus:** 2px primary outline on fields; default Material focus indicators elsewhere.

## 8. Phasing note

Phase 4 ships the manual flows, the document list and the PDF viewer, phase 5 the AI request drafting, and phase 6 the RAG answers. Until a phase is live, hide the Assistant tab and the Procedures assistant rather than showing them as working.
