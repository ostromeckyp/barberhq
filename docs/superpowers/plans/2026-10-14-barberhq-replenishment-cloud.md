# BarberHQ — manual replenishment in the cloud Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the existing multi-item request workflow in the foundation preview with authenticated callable Functions and measurable stock changes.

**Architecture:** Preserve Angular facades and SQL transactions. Select an explicit SQL target in stock Functions and package only reviewed stock code plus its generated runtime SDK into an ignored artifact. Deploy five commands first, then enable the public replenishment flag and publish the verified Angular artifact.

**Tech Stack:** Angular SPA, Firebase Auth/App Check, Functions v2 Node22, SQL Connect/PostgreSQL, classic Hosting.

**Spec:** Existing approved [delivery design](../specs/2026-09-29-barberhq-delivery-design.md), [multi-item request design](../specs/2026-10-07-replenishment-requests-and-salon-settings-design.md), and [increment 2](../../implementation/handoffs/increment-2.md). This closes deployment of existing behavior. User authorized the described deploy/flag/build continuation on 14 October.

## Global Constraints

- Business key `not-bad-stuff-demo`; salons Legnicka, Łódzka, Zakładowa; preserve six product IDs.
- One request contains 1–6 distinct items, integer quantities 1–99; no partial fulfillment.
- States: `PENDING_APPROVAL`, `RESERVED`, `DISPATCHED`, `RECEIVED`, `REJECTED`.
- AI does not mutate stock. No Firestore, SSR, Nx or persistent chat.
- Follow AGENTS private-file restrictions. No reset/reseed, IAM grant, account creation, schema migration, commit/push or live promotion.
- Preserve `baberhq-runtime@notbad-6be95.iam.gserviceaccount.com`, production App Check, source endpoint and local SDK.
- Production SQL: `notbad-6be95-service/europe-west3`, connector `server`; local: `demo-barberhq`, `barberhq/europe-west1`, loopback SQL emulator.
- PDF/AI/library flags remain unchanged. Publish existing `foundation` preview only.

## Review Focus

- Cloud code must not query a local service or accept an emulator host with production profile.
- Package must load without parent dependencies, expose five callables, exclude private/root configuration.
- Response loss retains the same idempotency key; transaction logic remains unchanged.
- Approval reserves stock; dispatch subtracts HQ; full receipt adds exact quantities; rejection preserves stock.
- Enabling request UI preserves PDF and local operation.

### Task 1: Explicit runtime target and isolated package

**Files:** Modify `functions/src/stock/commands.ts`; create `functions/src/stock/runtime.ts`, `scripts/config/prepare-stock-functions.ts`, `tests/unit/stock-runtime.test.ts`, `tests/unit/stock-functions-package.test.ts`. Extract the existing account scanner into `scripts/config/functions-runtime.ts` if needed rather than duplicate it; preserve source packager tests/behavior.

**Interfaces:** `stockConnectorConfig({emulator,projectId,emulatorHost,serviceId,location})` returns `{connector:'server',serviceId,location}`. Parameters `STOCK_SQL_SERVICE` / `STOCK_SQL_LOCATION` default to approved cloud values; emulator uses explicit local constants. `prepareStockFunctions({root,outputRoot})` writes only `artifacts/stock-functions/{firebase.json,functions/...}`.

- [ ] Write failing behavior tests: actual cloud target; production refuses emulator host/wrong target; local exact project/loopback target; package byte preservation, five exports/account/runtime/pinned dependencies, exact SDK runtime allowlist, rerun preserves installed artifacts, symlink/unknown-file rejection and unchanged prior output on invalid input.
- [ ] Observe named failures before implementation.
- [ ] Implement callable target selection preserving Auth/App Check/errors/idempotency. Package only compiled `commands/repository/errors/schemas/intent/runtime.js` and explicitly named generated SDK runtime files; no recursive root copy, PDF/AI dependencies or lifecycle hooks. Every SDK operation supplies validated explicit Data Connect instance; check actual SDK overload behavior.
- [ ] Run focused tests, root typecheck and Functions build. Discover five exports from isolated installed package with public parameters only.
- [ ] Record scoped report/review and fixes. Preserve unrelated staged files; keep work uncommitted.

### Task 2: Publish and accept real browser workflow

**Files:** Create `docs/implementation/handoffs/replenishment-cloud.md`; update `docs/implementation/deployment-runbook.md`; update allowed public `artifacts/cloud-public-config.json` only.

**Interfaces:** Five callables `submitRequest`, `approveRequest`, `rejectRequest`, `dispatchTransfer`, `receiveTransfer`, Node22/west1/existing SA. Backend-first publication before enabling UI.

- [ ] Read-only Functions/SQL operations/inventory preflight without account identifiers or tokens. Deploy server connector only if operation definitions differ; no schema migration.
- [ ] Install isolated dependencies with `--ignore-scripts`; deploy five explicit selectors and use `--interactive` for two public parameters. Leave repository cleanup policy unchanged; independently check ACTIVE if cancelling its optional post-deploy prompt.
- [ ] Set only `replenishmentEnabled:true`; optimized production build and release gate; publish foundation and verify URL/expiry/App Check domain.
- [ ] Existing authenticated HQ operates for Legnicka: one two-product request; approve, dispatch, receive full quantities. Record baseline/final inventory and movement counts. Submit/reject another demo request and prove unchanged inventory. Retain normal history; no reset/cleanup. Verify form, mobile entry and PDF deeplink refresh. Request owner login only if required; never request passwords.
- [ ] Focused checks and broad review; record actual cloud results separately from emulator races/roles. Do not claim cloud concurrency/SALON-role proof without performing it.

Execution method and exact preview scope are already authorized; no new routine confirmation gate. Stop for an actual destructive/security expansion or required login after independent work is complete.
