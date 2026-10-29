# Readability refactor — design

29 October 2026. Roadmap item 3, before i18n and the UI review.

## Why

The owner finds the code hard to navigate. Models live in a few large files (7 schema files hold 42 tables and 19 enums; `shared/contracts/knowledge.ts` alone exports 24 types), connector files reach 1,500 lines, and about 20 logic files exceed 300 lines. The next items (i18n, UI review) touch most screens, so the structure gets fixed first.

## Goal

A reader finds any model by its name and any operation or piece of logic by its domain, in files short enough to read in one sitting. Behavior, database and UI stay exactly as they are.

## Decisions

Owner decisions:

1. **Every database entity (table) is its own file.**
2. **GraphQL operations are split into smaller topic groups.**
3. **TypeScript models get the same treatment.**
4. **Large logic files are split as well** ("podziel i porządkuj").

Calls made by the assistant (owner can overturn):

5. **Enums** also get one file each, next to the tables of their domain.
6. **Layout:**
   - Schema: `dataconnect/schema/<domain>/<TypeName>.gql`, domains = today's file names (`ai`, `business`, `delivery`, `knowledge`, `product-knowledge`, `products`, `stock`).
   - Operations: `dataconnect/<connector>/<domain>/<topic>.gql`. Verified on 29 Oct: the emulator and SDK generator both read `.gql` files in subdirectories of the schema and connector directories.
   - Shared contracts: `shared/contracts/<domain>/<model-name>.ts`, one exported model per file, plus `index.ts` re-exporting the domain. Node code (Functions, scripts, tests) imports `.../contracts/<domain>/index.js`; Angular keeps its extensionless `.../contracts/<domain>`, which resolves to the index.
   - Functions models: `functions/src/<domain>/models/<model-name>.ts`. Web models used across a feature: `web/src/app/features/<feature>/models/<model-name>.ts`.
   - `functions/src/knowledge/product-knowledge-*.ts` move to `functions/src/product-knowledge/` without the prefix.
7. **What counts as a model:** an exported `interface` or `type` describing data (records, inputs, results, unions of states). Non-exported helper types stay where they are used. Type guards and parse functions stay with their logic, not in model files.
8. **Size target:** logic files above 300 lines in `web/src/app`, `functions/src`, `shared` and `scripts/{config,seed,ingest}` are split by responsibility (components into subcomponents or separate template/style files, facades and repositories by use case, pipelines by stage) to roughly 300 lines or less. One-off `scripts/migrations/*` and `scripts/eval/*` are out of scope.
9. **Dead code removed:** the partial-deploy packaging scripts `scripts/config/prepare-{stock,delivery,source,knowledge,replenishment}-functions.ts`, `scripts/config/functions-runtime.ts` (only those scripts use it) and their unit tests. Production deploys the whole `stock` codebase (`npm run deploy:functions`); these scripts already drift from the code.

## Constraints

- **Zero behavior change.** No SQL, field, type, operation or route is renamed or altered; only files move and code is extracted. GraphQL operation names drive the generated SDKs, so moving operations between files must leave every SDK's exported API identical.
- **Database untouched.** `npm run deploy:db:diff` reports the prod schema as compatible with no changes before and after.
- `scripts/config/prepare-knowledge-cloud.ts` (used by `deploy:db` and `build:cloud-sdk`) collects `.gql` files from one directory level today; it must read the new subdirectories, with its unit test updated.
- Match existing idioms: Angular standalone components, facades and data-access layers per [angular-architecture.md](../../implementation/angular-architecture.md); ESM imports with explicit `.js` extensions; Prettier formatting.
- Respect AGENTS.md: never read `*.local.json` or `.env` files; use the code-review-graph MCP for impact checks and run `npm run graph:update` after moves.
- No prod deploy is part of this work. The next normal release carries it.

## Proof of no change

Each area's commit must pass:

- `npm run typecheck`, `npm run test:unit`, `npm run test:web`, `npm run build:functions`, `npm run build:emulator`;
- `npm run generate:sdk -- --project demo-barberhq` then a check that the set of exported names in every generated SDK (`scripts/generated/*`, `functions/src/generated`, `web/src/app/core/generated`) is unchanged;
- once, at the end: `BARBERHQ_TEST_MODE=emulator npm run test:integration` and `npm run test:e2e`, plus `npm run deploy:db:diff` and `npm run build:cloud-sdk`.

## Non-goals

- Renaming domains, operations, fields or components; changing naming conventions.
- Splitting test files under `tests/`. Their imports are updated to the new paths, nothing else.
- Updating historical docs under `docs/implementation/` and `docs/superpowers/` that mention old paths. `README.md` and `docs/commands.md` stay correct.
- New libraries, path aliases, lint rules or architectural layers.

## Anti-goals

- A diff where moved code is also "improved". Moves and extractions only; anything else is a separate change.
- Files so small that one concept is scattered (e.g. a 5-line component split into three files).
- Any visible change in the app.

## Left to the builder

- Exact topic groups and file names for operations and for split logic, following the domain layout above. Example for `server/knowledge.gql` (33 operations): `knowledge/registration.gql`, `extraction.gql`, `review.gql`, `publication.gql`, `retrieval.gql`, `cursors.gql`, `metadata.gql`.
- Order of domains. One commit per area (schema, operations, contracts, functions per domain, web per feature, dead code).
