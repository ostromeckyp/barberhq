# Readability Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One model per file, operations and logic grouped by domain in files of roughly 300 lines or less, with zero behavior change.

**Architecture:** Pure moves and extractions. A structure test (`tests/unit/code-structure.test.ts`) encodes the rules and grows one rule per task; existing suites, builds and the generated-SDK export lists prove nothing else changed.

**Tech Stack:** Firebase Data Connect GraphQL, TypeScript (NodeNext for Node, Angular bundler resolution for web), Vitest, Angular 20, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-29-readability-refactor-design.md`

## Global Constraints

- Zero behavior change: no SQL, field, type, operation, route, selector, input/output or public function is renamed or altered. Moves and extractions only.
- Database untouched: `npm run deploy:db:diff` must report the prod schema as compatible, with no changes.
- Every generated SDK keeps the same exported names (see "SDK export check").
- Node imports use explicit `.js` extensions; shared contracts are imported as `.../contracts/<domain>/index.js` from Node and `.../contracts/<domain>` from Angular.
- Never read `*.local.json` or `.env` files. Run `npm run graph:update` after each task's moves.
- Commit once per task (owner allows commits for this plan). Messages end with the `Co-Authored-By` trailer from the session.
- Size target: logic files ≤ ~300 lines in `web/src/app`, `functions/src`, `shared`, `scripts/{config,seed,ingest}`. `scripts/migrations/*`, `scripts/eval/*`, generated code and tests are exempt.

### SDK export check

Before Task 1, record the baseline in the plan workspace:

```sh
for f in scripts/generated/server/index.d.ts scripts/generated/browser/index.d.ts functions/src/generated/index.d.ts web/src/app/core/generated/index.d.ts; do
  echo "== $f"; grep -oE '^export (declare )?(const|function|interface|type|enum|class) [A-Za-z0-9_]+' "$f" | sort
done > "$WORKSPACE/sdk-exports.before"
```

After any task that touches `dataconnect/`, run `npm run generate:sdk -- --project demo-barberhq`, produce `sdk-exports.after` the same way and `diff` the two. Expected: no output.

## Review Focus

1. **Prod staging drops nested operations.** `prepare-knowledge-cloud.ts` reads one level today; if nested `.gql` files are missed, `deploy:db` would publish connectors without those operations and prod callables would fail. Task 2 pins it with a nested-file test; the reviewer checks the staged tree contains every operation.
2. **Component split loses behavior.** Inputs, outputs, `@if`/`@for` tracking, host bindings, `ChangeDetectionStrategy.OnPush` and providers must survive extraction into subcomponents; e2e and web tests are the guard.
3. **Barrel cycles.** `index.ts` re-exports can create import cycles between domains (e.g. `knowledge` ↔ `product-knowledge`); a cycle shows as `undefined` at runtime in Functions. Task 6 runs `npm run build:functions` and loads the compiled entry.
4. **Duplicate or lost GraphQL operations.** A move can duplicate an operation (compile error) or drop one (SDK export diff). The structure test counts operations per connector before/after.
5. **Angular template/style extraction.** Moving inline templates to `.html` must keep `styleUrl`/`templateUrl` paths and view encapsulation; the web build plus visual e2e catch misses.

---

### Task 1: Remove dead partial-deploy packaging

**Files:**
- Delete: `scripts/config/prepare-{stock,delivery,source,knowledge,replenishment}-functions.ts`, `scripts/config/functions-runtime.ts`
- Delete: `tests/unit/{stock,delivery,source,knowledge,replenishment}-functions-package.test.ts`
- Check: `git grep -n "prepare-.*-functions\|functions-runtime" -- ':!docs'` returns nothing

- [ ] **Step 1:** Record the SDK export baseline (see above).
- [ ] **Step 2:** Delete the files. Run `git grep` above. Expected: no output.
- [ ] **Step 3:** Run `npm run typecheck && npm run test:unit`. Expected: PASS (5 fewer test files).
- [ ] **Step 4:** Commit `chore: remove unused partial Functions packaging scripts`.

### Task 2: Stage nested GraphQL files for prod

**Files:**
- Modify: `scripts/config/prepare-knowledge-cloud.ts` (`gqlFiles`)
- Test: `tests/unit/cloud-knowledge-config.test.ts`

**Interfaces:** Produces staged files at the same relative path (`dataconnect/<dir>/<sub>/<file>.gql`).

- [ ] **Step 1: Failing test** `stages gql files from nested domain folders`: fixture with `schema/stock/RequestState.gql` and `server/stock/lifecycle.gql`; after `prepareKnowledgeCloud`, expect both files at the same relative paths, byte-identical, and still no `generate:` block in staged `connector.yaml`.
- [ ] **Step 2:** Run `npx vitest run tests/unit/cloud-knowledge-config.test.ts`. Expected: FAIL (files missing).
- [ ] **Step 3:** Make `gqlFiles` walk subdirectories (ordinary files only, symlinks rejected as today), preserving relative paths.
- [ ] **Step 4:** Run the test file and `tests/unit/cloud-browser-sdk.test.ts`. Expected: PASS.
- [ ] **Step 5:** Commit `fix: stage nested Data Connect gql files`.

### Task 3: One schema type per file

**Files:**
- Replace: `dataconnect/schema/*.gql` → `dataconnect/schema/<domain>/<TypeName>.gql` (61 files: 42 tables, 19 enums)
- Create: `tests/unit/code-structure.test.ts`

- [ ] **Step 1: Failing test** `schema: one type or enum per file, named after it`: for every `.gql` under `dataconnect/schema` (recursive), exactly one `^(type|enum) (\w+)` and the file name is `<name>.gql`; no `.gql` directly in `dataconnect/schema`.
- [ ] **Step 2:** Run it. Expected: FAIL listing the 7 domain files.
- [ ] **Step 3:** Split each file; keep each type's text byte-identical including its doc comments; a comment above a type moves with it.
- [ ] **Step 4:** Run the structure test (PASS), the SDK export check (no diff) and `npm run deploy:db:diff` (compatible, no changes).
- [ ] **Step 5:** Commit `refactor(dataconnect): one schema type per file`.

### Task 4: Operations in topic groups

**Files:**
- Replace: `dataconnect/{server,browser,vector}/*.gql` → `dataconnect/<connector>/<domain>/<topic>.gql`
- Modify: `tests/unit/code-structure.test.ts`

- [ ] **Step 1: Failing test** `operations: grouped by domain, files ≤ 300 lines unless a single operation`: every connector `.gql` lives in a domain subfolder; files over 300 lines contain exactly one operation; the sorted operation-name list per connector equals the list captured from `HEAD` before this task (store it in the test as a literal array: 103 server / 22 browser / 2 vector).
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Move operations verbatim. Group by lifecycle step, e.g. `server/knowledge/{registration,extraction,review,publication,retrieval,cursors,metadata}.gql`, `server/seed/{business,stock,knowledge,aliases}.gql`, `server/stock/{context,submit,decide,dispatch}.gql`.
- [ ] **Step 4:** Structure test PASS; SDK export check no diff; `npm run build:cloud-sdk` succeeds; `npm run deploy:db:diff` no changes.
- [ ] **Step 5:** Commit `refactor(dataconnect): group operations by topic`.

### Task 5: Shared contracts, one model per file

**Files:**
- Replace: `shared/contracts/<domain>.ts` → `shared/contracts/<domain>/<model-name>.ts` + `index.ts` (10 domains)
- Modify: every importer in `web/src`, `functions/src`, `scripts`, `tests`
- Modify: `tests/unit/code-structure.test.ts`

- [ ] **Step 1: Failing test** `contracts: one exported model per file`: each non-index file under `shared/contracts` exports exactly one `interface`/`type`, named in PascalCase matching the kebab-case file name; each domain has `index.ts`; no `.ts` directly in `shared/contracts`.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Split; exported constants or functions in a contract file go to their own kebab-case file. Update imports per Global Constraints.
- [ ] **Step 4:** `npm run typecheck`, `npm run test:unit`, `npm run test:web`, `npm run build:functions`, `npm run build:emulator`. Expected: PASS.
- [ ] **Step 5:** Commit `refactor(contracts): one model per file`.

### Task 6: Functions by domain

**Files:**
- Move: `functions/src/knowledge/product-knowledge-*.ts` → `functions/src/product-knowledge/<name>.ts`
- Create: `functions/src/<domain>/models/*.ts`
- Split (≤ ~300 lines): `knowledge/pipeline.ts` (494), `product-knowledge/commands.ts` (443), `delivery/repository.ts` (417), `knowledge/source.ts` (384), `ai/retrieval.ts` (362), `knowledge/extract.ts` (340), `knowledge/queue.ts` (312), `knowledge/review-publish.ts` (306)
- Modify: `tests/unit/code-structure.test.ts`, importers in `tests/` and `scripts/`

- [ ] **Step 1: Failing test** `functions: models in models/, logic ≤ 300 lines`: no exported `interface`/`type` outside `functions/src/*/models/` (except generated); no `functions/src` file over 300 lines; no `product-knowledge-*` file in `knowledge/`.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Move and split by responsibility (e.g. pipeline stages stage/extract/review/publish; repository reads vs writes). Keep `functions/src/index.ts` exports identical.
- [ ] **Step 4:** `npm run build:functions`, then `node --input-type=module -e "const m=await import('./functions/lib/functions/src/index.js'); console.log(Object.keys(m).sort().join(','))"` and compare with the same command at `HEAD` (expect identical list of 35 functions); `npm run typecheck`; `npm run test:unit`.
- [ ] **Step 5:** Commit per domain group if large; at least `refactor(functions): models and domains`.

### Task 7: Web models and large components

**Files:**
- Create: `web/src/app/features/<feature>/models/*.ts` for exported data types used outside their file
- Split (≤ ~300 lines): `hq-products/feature/product-editor.component.ts` (577), `procedures/product-knowledge-review.component.ts` (527), `procedures/library/product-knowledge-review.facade.ts` (363), `procedures/library/document-review.facade.ts` (359), `delivery/feature/delivery-issue.facade.ts` (354), `delivery/ui/delivery-procedure-settings.ts` (340), `delivery/feature/delivery-receipt.facade.ts` (335), `procedures/library/document-upload.facade.ts` (320)
- Modify: `tests/unit/code-structure.test.ts`, co-located specs' imports

- [ ] **Step 1: Failing test** `web: no logic file over 300 lines`: every non-spec `.ts` under `web/src/app` (except `core/generated*`) ≤ 300 lines.
- [ ] **Step 2:** Run it. Expected: FAIL listing the eight files.
- [ ] **Step 3:** Extract subcomponents (standalone, OnPush, same selectors prefix), move large inline templates/styles to `.html`/`.scss`, split facades by use case behind the same public facade API.
- [ ] **Step 4:** `npm run test:web`, `npm run build:emulator`, `npm run typecheck`, structure test. Expected: PASS.
- [ ] **Step 5:** Commit `refactor(web): models per feature and smaller components`.

### Task 8: Whole-system proof

- [ ] **Step 1:** Start the isolated stack (see `docs/implementation/full-demo-reset.md`), run `BARBERHQ_TEST_MODE=emulator npm run test:integration`. Expected: same pass set as before the plan (known env-only failure: `document-library-access` port 9099).
- [ ] **Step 2:** `npm run dev:emulators` + `npm run dev:seed` + `npm run dev:web`, then `BARBERHQ_TEST_MODE=emulator npm run test:e2e`. Expected: PASS.
- [ ] **Step 3:** `npm run deploy:db:diff` (no changes), `npm run build:cloud-sdk`, `npm run graph:update`, `npm run format:check`.
- [ ] **Step 4:** Update paths in `README.md` and `docs/commands.md` if any moved. Commit `docs: refresh paths after refactor`.
