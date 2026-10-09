# Compact mobile grids — 9 October 2026

Below 760px, salon stock, HQ stock and request history/queue render semantic compact lists. Desktop retains the existing Material tables. Only one variant is present in the DOM, so hidden controls, duplicate test IDs and duplicate accessibility content are avoided.

- Salon stock: product/size, labeled salon and HQ quantities, low-stock status and the existing Request action opening the sheet.
- HQ stock: product/size and aligned On hand, Reserved, Available values; pieces are documented in the footer.
- Requests: request number, salon/date, status, item count and total units, the first two product lines plus a remaining-item count, and the existing context-aware detail link. Details still expose every item.

`ResponsiveLayout` shares the 759px breakpoint between the compact records and order sheet. A shared SCSS mixin owns spacing and metric labels. Feature components continue consuming their existing inputs/facades, preserving authorization, pagination, filters, request history and stock semantics. RequestList markup/styles are extracted into adjacent files for readability.

## Verification

Angular tests 43/43; TypeScript and final emulator Hosting build passed. The build retains the existing initial bundle warning: 546.75/500 kB, with 46 public files.

Full browser suite initially passed 15/16. The remaining workflow was still awaiting a callable after the five-second dialog assertion; its wait now matches the existing 20-second submission allowance. The final compact-list and replenishment rerun passed 5/5. All 16 scenarios have passing evidence. A new browser test verifies live values, compact/desktop switching, rejected and pending status, multi-item summaries, both detail-route perspectives, order-sheet opening, no horizontal overflow and Axe checks at 320/360px. Screenshots were visually reviewed; redundant pieces suffixes were removed from metric labels to keep HQ values aligned.

Evidence: `artifacts/compact-grids/`. Stock mutations were restricted to disposable test businesses. No schema or cloud deployment changes. Two GPT-6 Luna agents implemented the stock/request presentation slices; the parent integrated shared responsive state, reviewed and verified the result.
