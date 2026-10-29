# Code Review Graph

Code Review Graph 2.3.9 provides a local Tree-sitter/SQLite code index for Codex navigation and change-impact analysis. It is development tooling, independent of Firebase and the application's RAG pipeline.

## Setup

Python 3.10+ is required. From the repository root:

```sh
npm run graph:setup
npm run graph:build
npm run graph:status
```

The isolated Python environment and graph database are under ignored `.code-review-graph/`. No global Python packages, Git hooks or existing agent hooks are modified. This setup uses structural analysis without embedding providers or API keys. The launcher disables FastMCP's automatic dotenv loading.

The project MCP entry is in `.codex/config.toml`. Restart Codex after adding it so the server's tools become available. Its `cwd` points to this checkout; update that path if moving the repository. The existing Angular and Firebase MCP entries remain intact.

## Workflow

```sh
npm run graph:update
npm run graph:review
# Optional foreground watcher; Ctrl+C stops it:
npm run graph:watch
```

In Codex, start with `get_minimal_context_tool` for the current task. Use `query_graph_tool` for callers/importers/tests, and `get_impact_radius_tool` or `get_review_context_tool` with explicit `changed_files` to keep results focused. `detect_changes_tool` provides review context and priorities; it does not verify correctness or replace tests and source review.

Only the selected navigation, review and local index maintenance tools are exposed through MCP. Automatic refactor application, wiki generation, embedding and cross-repository tools are not part of this integration.

## Privacy and coverage

`.code-review-graphignore` excludes private configuration, agent configuration, generated SDKs, dependencies and build output before indexing. Keep these exclusions in force when rebuilding. The graph is derived local data and must not be committed.

A full build uses `git ls-files`, so untracked files may be missing until added to Git by the developer. This setup does not stage files. A watcher can index subsequent file edits; verify coverage rather than assuming it. Missing graph results require direct inspection of allowed source. Angular templates and dependency injection, GraphQL operations, generated SDK calls and other dynamic links can be incomplete.

## References

Verified on 2026-10-21: isolated installation and `pip check`, full build, incremental update, status and change-impact CLI commands, plus an actual MCP initialize/list-tools/call-tool session. The final index reports 125 files, 740 nodes and 9,578 edges; the MCP file-summary query finds `SalonDashboardComponent`. Ten selected MCP tools are available from the configured subprocess. Codex must reload the configuration before they appear in a chat.

- [Official project and installation](https://github.com/tirth8205/code-review-graph)
- [Official usage guide](https://github.com/tirth8205/code-review-graph/blob/staging/docs/USAGE.md)
- [Codex MCP configuration](https://developers.openai.com/codex/mcp/)
