# Angular implementation architecture

Updated 30 September 2026. Applies to the implemented login/inventory increment and subsequent UI work. Uses Angular 22.2, standalone components, Angular Material and Signal Forms. The refactor follows the feature/data-access separation in the supplied currency-converter reference.

## Ownership and dependency direction

```text
route component → feature facade → data-access service → generated Firebase SDK
       ↓                ↓
feature UI         session facade / browser lifecycle
       ↓
shared UI + Material + design tokens
```

| Location under `web/src/app/` | Owns | Must not own |
|---|---|---|
| `core/` | Firebase initialization, public config, generated SDK, guards, browser lifecycle | Feature form or inventory state |
| `features/auth/data-access/` | Auth SDK callbacks, sign-in/out, generated membership query and mapping | Router or component state |
| `features/auth/feature/session.facade.ts` | Auth/membership lifecycle, readonly session and salon signals, access helpers | Rendering |
| `features/<name>/data-access/` | Typed remote reads and pure DTO mapping | Loading/error UI, navigation |
| `features/<name>/feature/` | Page component + feature facade, commands and async state | Raw Firebase queries in components |
| `features/<name>/ui/` | Domain-specific presentation using signal inputs | Network calls, routing, session access |
| `shared/ui/` | Reusable branded UI composed with Material | Feature services, Firebase, domain workflow |
| `shared/styles/` and `shared/theme.scss` | App tokens, shared surfaces, supported Material theme overrides | Backend behavior |
| `shell/` | Shell facade for navigation/session actions; component for drawer/breakpoints | Feature data fetching |

This is a local component library inside one app. No extra workspace, state framework or published package is needed. Import components directly from their source paths; introduce a separate package only if another application actually consumes it.

## Existing facades

- `SessionFacade` is a root service. It consumes the `SESSION_GATEWAY` port, handles membership races, and exposes readonly state. The Firebase adapter lives in `auth/data-access` and is wired in `app.config.ts`.
- `LoginFacade` is provided by the login page. It owns submission/error/checking-access state and allowed return navigation. The component owns the Signal Form model, validation, password visibility and password clearing.
- `SalonInventoryFacade` is provided by the salon page. It reads the route, authorized session and browser refresh events. It exposes name, quantities, loading/error/stale state and a `refresh()` command.
- `ShellFacade` derives role/context/navigation and handles sign-out and session redirects. The shell component owns the Material drawer and responsive view state.
- `AccessFacade` handles retry and navigation for the existing access/HQ-placeholder/not-found pages. When HQ gains its real workflow, give it its own feature facade.

Feature services use `@Service({ autoProvided: false })` with component `providers`; root services use `@Service()`. Leaving a page destroys its resource and subscriptions. UI components receive data with `input()` and use content projection for actions. Use `output()` when a presentation component needs to emit an intent; do not wrap every Material control in a custom component.

## Signals and async reads

- Keep mutable source signals private; publish readonly signals or `computed` selectors. Local form/presentation controls can remain writable in their component.
- Use `computed` for derived values. Do not copy signal state with effects.
- Inventory and membership queries explicitly use `QueryFetchPolicy.SERVER_ONLY`. SDK default `PREFER_CACHE` must not make Refresh or Retry access appear to revalidate stale server data. The facade snapshot is the single deliberate fallback for an offline/error state.
- `resource({ params, loader })` owns inventory loading/error/reload. Unauthorized or absent scope produces undefined params and no new query.
- Scope includes the current session and salon. A linked snapshot retains the last successful resource value only while the exact scope is unchanged. Refresh errors show the last known quantities with a stale banner; a failed first read shows an error, never invented zeroes. Logout, salon changes and session changes clear the exposed snapshot.
- `linkedSignal` manages the scope-dependent snapshot without an effect that writes other signals. Guard `resource.value()` with `hasValue()` because reading an errored resource value can throw.
- Firebase's generated query Promise cannot cancel its HTTP request. The data-access service checks the provided AbortSignal before/after each page; the resource rejects obsolete results by request identity. Do not promise network cancellation when a scope becomes idle. Tests prove that late results cannot restore signed-out/previous-salon data.
- `toSignal` owns RxJS interop and automatic cleanup for router/browser events. BrowserActivity only reports events; the inventory facade decides to reload. Effects are reserved for imperative router navigation.
- Future stock writes remain explicit facade commands calling data-access functions, not resource loaders. Reload authoritative stock after confirmation; never optimistically subtract units.

Reviewed using the installed Angular MCP server (`list_projects`, `get_best_practices`, `search_documentation`) and project-local Angular skill references. Official references: [signals](https://angular.dev/guide/signals), [linkedSignal](https://angular.dev/guide/signals/linked-signal), [resources](https://angular.dev/guide/signals/resource), [effects](https://angular.dev/guide/signals/effect).

## UI customization

1. Change palette and common CSS variables in `shared/styles/_tokens.scss`.
2. Change supported Material component overrides in `shared/theme.scss`; avoid private MDC DOM/CSS internals.
3. Change reusable branding/header/warning/empty/stale elements in `shared/ui/`.
4. Change stock table/HQ availability presentation in `features/salon-dashboard/ui/`.
5. Change page composition in the adjacent `.component.html` and `.component.scss`, not the facade.

The Claude handoff remains the design authority: `design_handoff_barberhq/SPEC.md`. Implemented refinements include the dark login backdrop and red-edged card, dark toolbar, BarberHQ/DEMO branding, outlined fields, mobile salon/role context, two-column salon table and static Material low-stock chips. HQ availability is a read-only side card (below stock on smaller screens), retaining the existing increment's data until the future order panel is implemented. No inactive ordering or AI controls are presented as working features. Real product names/current fixtures take precedence over prototype sample rows. Minimum 12px text and keyboard/contrast requirements take precedence over smaller prototype labels.

## Verification and next increment

Run from the repository root:

```sh
npm run test:web
BARBERHQ_TEST_MODE=emulator npm run test:e2e
npm run build:emulator
```

The E2E suite requires the local Auth/Data Connect emulators and Angular server; see the deployment runbook. It verifies real emulator authentication, quantities, error/retry, sign-out, keyboard navigation, responsive overflow and AXE. Facade tests additionally control delayed requests, route/session changes, stale cache and recovery; mapper tests enforce quantity mapping and missing-record errors.

Replenishment should add its own feature facade and data-access adapter, reusing the existing session and UI components. Historical plan paths referring to `core/session.service.ts` or `core/stock-api.ts` are superseded by the structure above. Cloud validation remains a separate owner/setup gate; this refactor does not certify deployment.

## Manual replenishment (increment 2)

- `features/replenishment/data-access`: generated browser queries, callable adapter and validated sessionStorage persistence. No component invokes Firebase directly.
- `features/replenishment/feature`: `DraftStore` owns the editable list; page-scoped `OrderFacade` composes inventory, active requests and draft; singleton `SubmissionService` freezes and reconciles submitted rows across navigation.
- `features/replenishment/ui`: reusable `StatusChip`, `RequestList` and Material-based order panel.
- `features/request-detail/feature`: scoped detail and confirmation facades; pure `action-input.ts` validation/building. `RequestActions` opens the shared Material dialog. The queue links to this same detail/action path.
- `features/hq-queue/feature`: paged authoritative queue, divided into pending, reserved and other requests.

Drafts stay in memory. Only explicitly submitted, unresolved rows are stored in sessionStorage, with user/business/salon scope and immutable action keys. Confirmed rows are removed; logout clears pending storage. SQL remains the authority for authorization and quantities.
