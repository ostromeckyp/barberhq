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
