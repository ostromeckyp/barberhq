# Ordering model update — publication and hosted verification record

Prepared 23 October; **owner-approved publication and hosted checks completed 24 October 2026**. Frozen package: `artifacts/replenishment-release/lite-update/`.

## Reason and scope

Hosted edge checks after the approved preview publication recorded two 25-second timeouts and one HTTP 503 with upstream Vertex 429 `RESOURCE_EXHAUSTED`. Auth and App Check were valid. These observations do not establish a permanent provider outage. The 429 is distinct from the application's shared ten-calls-per-user hourly admission (raised to 20 on 2026-11-03).

The proposed update selects **Gemini 3.5 Flash-Lite in `eu`** for `prepareReplenishment` only. A frozen server configuration is reused by the generator, flow and evaluation. The runtime allowlist adds this exact model alongside Gemini 3.8 Flash; project/provider/EU restrictions remain enforced. RAG continues to select Gemini 3.8 Flash. LOW thinking, output limit, 25-second deadline, one generation turn, shared quota, tools and authorization are unchanged.

Only three compiled modules differ from the approved published package: `ai/runtime.js`, `ai/replenishment-model.js`, `ai/replenishment.js`. The other 40 compiled modules, including the accepted RAG implementation, are byte-identical. Concurrent RAG diagnostics remain excluded. The package manifest records exact hashes. There is no SQL, Hosting, schema, IAM or account change in this update.

## Evidence

- Hosted timeout fallback preserved a manual Dry Matt quantity of **5**, with Manual and Submit available. No request was submitted. Nine operational data hashes before/after matched. The separate test tab was closed; the user's original three-product draft was left untouched.
- Same-prompt, same-budget diagnostic comparison: 3.8 passed 1/3 cases (3.83 s; two 25 s timeouts); Flash-Lite passed 3/3 (1.02–1.24 s). This is a small operational sample, not a latency guarantee.
- Full real Vertex Flash-Lite evaluation with isolated synthetic local SQL/Auth: **12/12**, **0.82–2.40 s**, all twelve no-stock-write checks passed. This used the production generator with the candidate model injected before changing the default; default-routing regression and compiled-package checks verify the subsequent configuration wiring. It is not hosted runtime-service-account acceptance of Lite.
- Two new regression checks observed RED for rejected Lite configuration and old default routing, then GREEN. Root suite **37 files / 186 tests**, focused suite **7 tests**, isolated SQL integration **2 tests**, root typecheck and Functions build passed. Graph updated; untracked source coverage remains incomplete and sources were inspected directly.
- Independent scoped review: **no findings**. It covered the six source/test changes and their consumers; package overlay and eventual hosted behavior were outside that review. Local package verification independently confirmed the exact three-module delta, fourteen exports, runtime account, region, App Check guard and unauthenticated rejection.

Evidence: `artifacts/replenishment-release/edge-tests/{request-diagnostic.json,fallback-proof.json,fallback.jpg,stock-before.json,stock-after.json,model-comparison.json,lite-evaluation/report.json,lite-red.log,lite-green.log,lite-unit.log,lite-typecheck.log,lite-functions.log,lite-integration.log,lite-graph.log}`; `lite-update/{manifest.json,package-proof.json,verify-package.mjs}`.

## Publication and rollback

**Owner approved this exact update on 24 October: “zatwierdzam”.** The scope below was executed; the frozen manifest retains its original preparation status as historical package metadata. Publication status is recorded separately in `deployment-status.json`. Earlier approval covered the frozen Gemini 3.8 package. Published only `functions:stock:prepareReplenishment` using the candidate `firebase.json`, after rechecking all 51 package hashes, six source/test hashes and current cloud metadata. The CLI may generate a parameter file; the agent must not read or copy it. Use existing SQL parameter defaults only after comparison with allowed cloud metadata.

After publication, API read-back confirmed ACTIVE, the expected runtime account and SQL parameters, and unchanged metadata for all thirteen other Functions. Schema/server/browser/vector fingerprints also remained unchanged. No live promotion or fulfillment rehearsal is included.

Rollback: redeploy only the same callable from the preserved `artifacts/replenishment-release/release/` package, restoring Gemini 3.8. Its prior intermittent upstream failures remain a known limitation; Manual ordering remains available.

## Remaining acceptance

Hosted Lite acceptance passed for ambiguity, missing quantity, manual-edit preservation and three-product preparation. Further hosted shortage/stale-result checks and the full owner-controlled stock lifecycle remain open. One earlier hosted attempt unexpectedly reset the Assistant tab/input before a controlled failure; its cause is unconfirmed and the model update is not claimed to fix it. Later timeout testing preserved the manual draft. Continue watching this behavior during hosted acceptance. Hosted clarification/shortage/stale-result checks and the separate approved stock fulfillment rehearsal remain open.

Model capability/location reference: [Google model documentation](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-5-flash-lite). Provider error reference: [Google 429 documentation](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/deploy/error-code-429).

## 24 October publication evidence

The first two CLI attempts stopped before source upload because Firebase CLI detects agents and forces noninteractive mode. Explicit `--interactive` allowed confirmation of nine existing public parameter defaults. The CLI generated its parameter file; the agent did not read, copy or edit it. CLI reported a successful function update. Its subsequent unrelated Artifact Registry cleanup-policy question was cancelled, producing exit 2 after successful publication; API read-back independently confirmed ACTIVE. No deployment was repeated merely to change the exit code.

Five real browser callable requests passed with **Auth VALID / App Check VALID**, HTTP 200, **0.98–2.48 seconds**:

1. `2 Dry Matt and 2 matte pomade` preserved the ambiguity instead of guessing.
2. Explicit Mattifier ×2 clarification replaced the unresolved row; a manually edited Dry Matt quantity of **5** was preserved.
3. `Sól Morska` requested a whole quantity.
4. Explicit quantity **3** produced the verified Sól Morska row.
5. `2 Dry Matt, 3 Sól Morska and 1 Savage` produced **2/3/1**, with Submit available.

No request was submitted. All nine operational hashes matched before/after. Missing and invalid Auth/App Check requests both returned HTTP 401. These five successes are the measured sample, not a permanent provider availability guarantee. No production source changed during this publication. The separate test tab was closed after saving screenshots; other user tabs were untouched.

Evidence in `artifacts/replenishment-release/lite-update/`: `cloud-before.json`, `cloud-after.json`, `deploy-transcript.json`, `deployment-status.json`, `runtime-logs-proof.json`, `http-guards.json`, `stock-before.json`, `stock-after.json`, `hosted-ui-proof.json`, `clarification.jpg`, `hosted-proposal.jpg`, `acceptance-summary.json`.
