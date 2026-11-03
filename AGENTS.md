# Agent rules

## Secrets and local config

- Never read, print, grep, copy or edit `*.local.json` files (`config/public.local.json`, `config/memberships.local.json`, `config/demo-accounts.local.json`). They hold per-environment config, personal data and demo passwords.
- Never read `.env` files; `.env.example` / `.env.sample` are fine.
- For structure, read `config/public.example.json` or `config/emulator.example.json`.
- To check that a file exists, use `test -f <file>`; repo scripts may still take these files as `--config` / `--memberships` arguments.
- Enforced by `.agents/hooks/block-local-json.py` (Claude: `.claude/settings.json`, Codex: `.codex/hooks.json`).

## Code Review Graph

- Use the project `code-review-graph` MCP for code navigation and review: start with `get_minimal_context_tool`, then query relationships or impact for explicit task files. Read the relevant source and run appropriate checks before making conclusions.
- Run `npm run graph:update` after source changes; `npm run graph:build` rebuilds the index. `npm run graph:review` reports impact against `HEAD`, not a completed code review.
- Respect `.code-review-graphignore` and the privacy rules above. Never override exclusions to populate the graph. The graph and Python environment remain local in ignored `.code-review-graph/`.
- Full builds index Git-tracked files; newly untracked code may be absent. Check coverage and inspect allowed source directly when missing. Angular templates, DI, GraphQL and runtime links can be incomplete; an empty graph result does not prove there are no dependencies.
- Setup and usage: `docs/implementation/code-review-graph.md`.

## MCP servers

- Project MCP config: `.mcp.json` (Claude) and `.codex/config.toml` (Codex), kept in sync. Both start `angular-cli` (`@angular/cli@22.2.0 mcp`), `firebase` (`firebase-tools@15.32.0 mcp`) and `code-review-graph`. Pin versions to the ones in `web/package.json` and `package.json`.
- Angular work: call `list_projects` and `get_best_practices` before writing code; use `search_documentation` for API questions.
- Firebase MCP acts with your logged-in Firebase CLI account. Read-only calls are fine; anything that writes to `notbad-6be95` follows the Deployment rules below.

## Project

- BarberHQ: salon stock and replenishment demo for "Not Bad Stuff" (DevFest talk). HQ manages products and stock; salons see inventory, request products, receive deliveries; a RAG assistant answers procedure questions from cited PDFs.
- Stack: Angular 22 (standalone, signals, zoneless, Angular Material, Signal Forms, Transloco) in `web/`; Firebase Functions + Genkit in `functions/`; Firebase SQL Connect (Data Connect) schema and operations in `dataconnect/`; Auth and Storage; types shared by web and functions in `shared/contracts/`; tooling, seed, ingest and checks in `scripts/`.
- Firebase projects: `demo-barberhq` is the local emulator project, `notbad-6be95` is production. Hosting serves `web/dist/barberhq/browser`, with a preview channel `foundation` and `live`.
- Commands: `docs/commands.md`. Angular layering and signal patterns: `docs/implementation/angular-architecture.md`. Shared UI rules: `web/src/app/shared/ui/README.md`. Design authority: `design_handoff_barberhq/SPEC.md`.

## Git and GitHub

- Repo: https://github.com/ostromeckyp/barberhq (public). `main` is protected: changes land only through a pull request, no force push, no direct push, admins included.
- Work on a branch, commit with Conventional Commits, push the branch and open a PR with `gh pr create`. Commit, push or open a PR only when the owner asks.
- Commit authorship uses the GitHub noreply address. Never commit personal emails, phone numbers or real customer data; the repo and its history are public.

## Code rules

- Web layering: route component → feature facade → data-access → generated SDK. Components never call Firebase directly. Folders: `core/`, `features/<name>/{data-access,feature,ui,models}`, `shared/ui`, `shared/styles`, `shell/`.
- `tests/unit/code-structure.test.ts` enforces: one exported model per file, named after it (web models in `features/<feature>/models/`, function models in `models/`); logic files at most 300 lines. Split a file before it grows past the limit.
- Reuse shared UI before adding new patterns: `app-page-header`, `app-back-link`, `app-empty-state`, `app-stale-banner`, `*appDelayedLoading` (200 ms), `app-boot-splash`, the `.qty` class for quantities, the `.app-page-toolbar` layout.
- Every user-visible text is a Transloco key in both `web/public/i18n/en.json` and `web/public/i18n/pl.json`; `tests/unit/i18n-keys.test.ts` checks parity. Polish copy is short, natural UI Polish.
- TDD: write the failing test first (Vitest for web and unit tests, Playwright for e2e), watch it fail, then fix.

## Verification

- `npm run typecheck`, `npm run test:unit`, `npm run test:web`, `npm run format:check`.
- E2E needs the emulators (`npm run dev:emulators`, seed once with `npm run dev:seed`) and the web dev server (`npm run dev:web`), then `BARBERHQ_TEST_MODE=emulator npm run test:e2e`. Run specs one file group at a time when they share emulator data; parallel files can collide.
- Starting the emulators regenerates `scripts/generated/browser/index.d.ts` and `web/src/app/core/generated/index.d.ts`. Revert them with `git checkout --` and never commit them.
- When done, stop the emulators with `npm run dev:stop` (it exports their data) and stop the web dev server.

## Deployment

- Every write to production (`notbad-6be95`: deploy, seed, reset, database migration) needs the owner's explicit approval for that specific change.
- Web release: `npm run build:prod` (the Hosting predeploy check rejects dev or emulator builds), then `npm run deploy:preview`, and the owner tests the `foundation` channel. Promote with `npm run deploy:promote` only after the owner says so.
- Functions: `npm run deploy:functions`. Database: `npm run deploy:db:diff` first, then `npm run deploy:db`. Details and rollback are in `docs/commands.md`.
- User-facing Functions are the Cloud Run services `commands`, `ai` and `getSourcePdf`; `uploadKnowledgePdf` and the `processKnowledgeTask` worker are unchanged. `commands` and `ai` each have `maxInstances: 5` shared by all their operations (several knowledge and product callables were uncapped before the merge).
- Demo day: `npm run functions:warm` pings `commands`, `ai` and `getSourcePdf` and prints `name status ms`; it needs no credentials and exits 0 when every request got an HTTP response. `npm run functions:instances -- <0..3>` sets Cloud Run `--min-instances` on `commands`, `ai` and `getsourcepdf` through `gcloud` and prints the resulting `minScale`. It is a production change, so it needs the owner's approval, and it costs money while above 0. The next Functions deploy resets it to 0; set it again after deploying and set 0 after the demo.
- Voice order: the shared AI limit is 20 calls/user/hour. `transcribeOrder` is an operation of `ai`; audio is never stored or logged. For this change deploy Functions before the database (old `admission.ts` rejects counts above 10), then seed the new aliases.
- App Check enforcement stays off until after the demo.
- Logs: `npm run logs -- --uid <uid> --since 2h` (read-only; see `docs/commands.md` "Logs"). Log events never carry user content: no transcript, message, answer, audio, note, email, name or token; only allow-listed fields (`shared/contracts/logging`).
- PWA and push: the service worker exists only in the production build (`serviceWorker: false` in the emulator config). `messaging.vapidKey` in the local config enables the salon push section; without it the section is hidden. Push needs the FCM API enabled and `roles/firebasecloudmessaging.admin` on `baberhq-runtime`; the `push_token` table needs `deploy:db:diff` then `deploy:db`. iOS needs the app installed to the Home Screen; preview and live origins have separate installs and permissions. Steps: `docs/commands.md` "PWA and push".
