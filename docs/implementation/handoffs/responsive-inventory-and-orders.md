# Responsive inventory and ordering — 9 October 2026

HQ availability is now a numeric column beside salon stock in the existing Material table. Available quantities exclude reserved units. The separate HQ availability card is no longer rendered. Desktop keeps the order panel beside the table with a 24px gap; tablet stacks the panel below. The action column has enough width for its Request button.

At widths up to 759px, Request products and each product row open a Material bottom sheet. It uses the page-scoped OrderFacade and DraftStore through the existing view container. Dismissal and desktop resize preserve the list; submission remains explicit. Navigation, workspace/identity changes and permission loss dismiss the sheet. Journal reconciliation remains available inside it. The sheet has an accessible name, Escape/backdrop dismissal, an explicit close control, focus restoration and a scrollable height bound. Its white Material theme matches the application cards and passes contrast checks.

Login fields use dynamic validation-message height and a 12px gap, including wrapped messages on narrow screens.

## Verification

Angular tests: 43/43. TypeScript checking and emulator Hosting build passed (46 public files). Initial bundle warning remains: 546.68 kB against 500 kB.

Browser suite: 14/15 initially passed; the remaining mobile-menu test sent Escape before Material moved focus into its opening drawer. The test now waits for focus before pressing Escape and verifies focus restoration after closing. Its focused rerun passed. All 15 scenarios have passing evidence; no new backend or schema behavior was introduced.

New browser coverage checks column values, login error spacing, mobile draft preservation across close/reopen and desktop resize, actual submission, navigation dismissal, 320px overflow and Axe accessibility. Screenshots of desktop inventory, mobile sheet and login validation were visually inspected. Logs/screenshots are in `artifacts/responsive-ui/`. All test stock changes were scoped to disposable fixture businesses.

Implementation of the two UI slices was delegated to GPT-6 Luna; the parent reviewed, adjusted layout/theme details and verified the result. Existing staged skill files were preserved.
