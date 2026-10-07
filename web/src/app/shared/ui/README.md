# Shared UI library

Standalone Angular/Material components with no Firebase, router or feature-state dependencies. Import directly from the indicated file; no package build step.

| Component | API | Customization |
|---|---|---|
| `brand/brand.ts` — `app-brand` | `large`, `inverse` inputs | BarberHQ/DEMO lockup |
| `page-header/page-header.ts` — `app-page-header` | `title`, `eyebrow`, `description`; projected actions | Heading spacing and responsive action layout |
| `low-stock-chip/low-stock-chip.ts` — `app-low-stock-chip` | Static warning | Material chip overrides; warning tokens |
| `empty-state/empty-state.component.ts` — `app-empty-state` | `title`, `message`, `icon`; projected actions | Loading failure / missing-record presentation |
| `stale-banner/stale-banner.component.ts` — `app-stale-banner` | `message`; projected retry action | Warning surface and announcement |

Colors and shared shapes are in `../styles/_tokens.scss`; Material defaults in `../theme.scss`. Use Material buttons, fields, tables and dialogs directly. Add custom components when they express repeated visual meaning, not just to rename a Material control.

Feature-specific presentation stays in the feature's `ui/` folder. See [architecture](../../../../../docs/implementation/angular-architecture.md) for state and data-access boundaries.
