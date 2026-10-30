# Shared UI library

Standalone Angular/Material components with no Firebase, router or feature-state dependencies. Import directly from the indicated file; no package build step.

| Component                                                            | API                                                  | Customization                                                                                                                                                |
| -------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `brand/brand.ts` — `app-brand`                                       | `large`, `inverse` inputs                            | BarberHQ/DEMO lockup                                                                                                                                         |
| `boot-splash/boot-splash.ts` — `app-boot-splash` | None | Full-screen wordmark and loading bar shown by `App` until the first navigation ends; same look as the static splash in `index.html` |
| `page-header/page-header.ts` — `app-page-header`                     | `title`, `eyebrow`, `description`; projected actions | Heading spacing and responsive action layout                                                                                                                 |
| `back-link/back-link.ts` — `app-back-link` | `link` (router commands, optional), `label`, `back` output when no link | Text button with `arrow_back`, left-aligned above the page header |
| `low-stock-chip/low-stock-chip.ts` — `app-low-stock-chip`            | Static warning                                       | Material chip overrides; warning tokens                                                                                                                      |
| `empty-state/empty-state.component.ts` — `app-empty-state`           | `title`, `message`, `icon`; projected actions        | Loading failure / missing-record presentation                                                                                                                |
| `stale-banner/stale-banner.component.ts` — `app-stale-banner`        | `message`; projected retry action                    | Warning surface and announcement                                                                                                                             |
| `delayed-loading/delayed-loading.ts` — `*appDelayedLoading="active"` | Boolean active expression                            | Renders its content after a fixed 200 ms; removes it immediately when inactive. Does not change the source loading state, disabled controls, or `aria-busy`. |
| `language-select/language-select.ts` — `app-language-select` | None; reads and sets `Language` | Polski / English dropdown, each label in its own language |
| `app-date.pipe.ts` — `value \| appDate: format : timezone` | Date string, `Date` or null | `formatDate` in the current UI language (`en-GB` / `pl`); `''` for null |

Global class `.qty` (`../styles/_quantity.scss`): quantities in the body font with tabular numerals; no monospace. Show the unit once (column header or one suffix).

Colors and shared shapes are in `../styles/_tokens.scss`; Material defaults in `../theme.scss`. Use Material buttons, fields, tables and dialogs directly. Add custom components when they express repeated visual meaning, not just to rename a Material control.

Feature-specific presentation stays in the feature's `ui/` folder. See [architecture](../../../../../docs/implementation/angular-architecture.md) for state and data-access boundaries.
