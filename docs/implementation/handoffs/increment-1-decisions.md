# Increment 1 — implementation decisions and review

Status: local foundation implemented; cloud acceptance remains **BLOCKED**.

## Decisions

- work in current folder on codex/foundation — user explicitly chose this folder; no existing code checkout needed protection — changes remain in the original workspace.
- use project-local Angular CLI via npx, not a global install — approved plan explicitly selects local repeatable tooling — no global CLI convenience.
- cloud tasks cannot be marked complete without an owner project; implement and verify independent local/emulator work, report deployed gates BLOCKED — required by approved design — deployment proof remains outstanding.
- Angular22 CLI calls the Codex preset open-ai-codex, not agents — used its actual supported option — generated instructions may differ from older CLI docs.
- invoke TypeScript tools using node --import tsx — tsx CLI cannot create its IPC pipe in this sandbox — no application behavior change.
- use explicitly proposed local service/instance barberhq in europe-west1 until owner confirms — SDK compilation can proceed without cloud provisioning — must regenerate if chosen settings differ.
- use local emulator evidence to continue independent UI work — deployed database absent — cloud behavior/App Check still unproven.
- introduce a localhost-only emulator Angular build profile to verify UI before owner setup — actual Auth/SQL SDK paths are exercised — emulator results cannot establish cloud App Check behavior.
- commit coupled UI and Hosting preparation together — emulator/profile configuration is needed by both acceptance paths — rollback is one larger commit.
- cloud login/authorization/App Check/Hosting remain unjudged and BLOCKED — the owner service/Web app/config are missing and no deployed success is claimed — cloud differences may require changes.
- stock-changing commands, replenishment, PDFs and AI remain outside increment 1 — approved later increment boundaries — this foundation does not yet demonstrate the complete talk scenario.
- pagination beyond six products is not certified by current evidence — six is the approved fixture scope; runtime reads paginate — a larger catalog requires additional coverage and may expose page-join assumptions.
- concurrent membership provisioning remains unsupported — runbook requires one operator before the demo; stock inserts fail safely — concurrent provisioning could leave incomplete assignments and needs retry/reconciliation.
- preserve the plan workspace and branch while cloud gates are pending — increment 1 is not complete, so completion/merge cleanup is premature — a future run must resume the remaining gates from this ledger.

## Independent review

One read-only whole-branch review on `1e32ef7..d70b10a`, using the prescribed fresh reviewer. No Critical/Important issues confirmed. The reviewer inspected source and recorded evidence; they did not rerun the suites.

Deferred minor: add a direct regression test that holds an inventory response, signs out, releases it, and asserts that old rows remain absent. The dashboard has a generation guard; existing deferred-response tests cover membership, and browser tests cover sign-out after a completed inventory load.

No merge, push, remote branch or cloud release was performed. Work remains on `codex/foundation` in the original workspace for the owner configuration checkpoint.
