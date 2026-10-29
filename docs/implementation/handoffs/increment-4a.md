# 4A — editable ordering assistant

Updated 24 October 2026. **Published to the owner-approved `foundation` preview; real signed-in ordering preparations verified.** The server connector, `prepareReplenishment` and Assistant UI are published. The latest full operator evaluation passed 12/12. Hosted Auth/App Check, runtime SQL/Vertex, active exclusion and single-/multi-product preparation passed; full hosted fulfillment rehearsal remains separate. AI-0 was published on 21 October.

## Delivered

- `prepareReplenishment` is an authenticated, App Check protected callable outside the emulator. It uses the existing shared AI admission: ten calls per user per UTC hour across both assistants, a 25-second request deadline, at most five model turns and eight tools.
- One required Genkit function call extracts exact source phrases and quantities. The server executes the scoped `findProduct`, `getStockContext` and `calculateProposal` reads, then rechecks membership, catalog, active requests and stock before returning the final draft. Only quota admission writes data; the assistant has no stock mutation tool.
- `ReadReplenishmentContext` is a server-only operation. Membership, business, role and salon access are checked in SQL Connect and again at the adapter boundary. Model output cannot supply stock or business authority. The existing six-product catalog and curated aliases determine matches.
- Unknown/ambiguous products and missing, fractional or out-of-range quantities require clarification. Explicit choices bind to original message spans without storing chat. Duplicate quantities remain editable, including sums over 99; more than six source items are rejected as a batch without silently truncating them. Active products link to the existing request; insufficient HQ stock remains visible in the draft.
- Assistant and Manual tabs use the same draft and the existing explicit Submit command. Late responses merge into the latest draft, preserve manual provenance and edits, and cannot populate another session/salon or a cleared/submitted draft. Errors preserve the manual path. The emulator example and approved Hosting preview enable the assistant; source defaults remain restored after the isolated preview build.

Historical plan paths were adapted to the current replenishment feature folders. Aliases ship as TypeScript with the Functions compiler. The named server query uses the existing `executeQuery` pattern; SDK regeneration and schema changes were unnecessary. Existing dirty work was preserved without staging or commits, following the prior owner instruction.

## Verification

| Check | Result and limits |
| --- | --- |
| Root unit suite | 37 files / 184 tests passed |
| Angular suite after review fix | 28 files / 124 tests passed |
| Real local SQL integration | 2 passed: three-product no-write proof, foreign salon denial, active exclusion and access revocation during generation |
| Browser acceptance | 3 desktop and 3 mobile (390×844) passed; desktop 3 passed again after review fix. The assistant callable is a fixture; Auth, SQL and ordinary stock callables are real local emulators. |
| Ordinary golden workflow | Explicit submit → approve → dispatch → receive: HQ 18→16, salon 2→4, reservations zero, exactly two movements, request RECEIVED |
| Accessibility | Axe WCAG A/AA checks passed for the prepared draft; mobile has no horizontal overflow |
| Build/type checks | Root typecheck, Functions build and production Angular build passed. Production initial bundle 545.11 kB exceeds the existing 500 kB warning budget, below the 1 MB error budget. Sandbox Angular exit 134 was resolved by running the same target in the permitted environment. |
| Navigation/review | Graph impact examined and index updated. Untracked sources are absent from the graph and were inspected directly. One independent scoped review found one Important and two Minor issues; all were corrected. |

The Important review finding involved resolving an ambiguous item to a product already present in the proposal: the server's aggregate could be missed or counted again. Four new tests failed before correction and passed afterwards. Tests cover both source orders, successive duplicate clarifications, preservation of manual quantity changes and the empty-extraction explanation. The UI now uses the verified selected product's metadata and applies only the explicit selected quantity. Evaluation failures now throw after saving the report, including when invoked through the Genkit CLI.

Evidence is under `.superpowers/sdd/2026-09-29-barberhq-04a-replenishment-agent/`: `final-unit.log`, `final-web-after-review.log`, `integration.log`, `e2e-desktop.log`, `e2e-mobile.log`, `e2e-after-review.log`, `review-fix-red.log`, `review-fix-green.log`, `production-build-final.log` and `typecheck-final.log`.

## Historical Gemini 3.8 Vertex evidence (22–23 October)

The original evaluation used synthetic isolated local SQL/Auth fixtures and actual Vertex `gemini-3.8-flash` inference in `eu`, through operator ADC. It compares complete operational snapshots around preparation and cleans up its own fixtures.

- The original multi-turn loop exceeded the 25-second deadline during a redundant final generation. A real Genkit regression test proves the current adapter uses one model call and the bounded read chain.
- The first full evaluation of the one-turn adapter passed **7/12** cases. Five timed out at 25 seconds: three products, ambiguous wording, missing quantity, mixed lines and duplicate overflow. **All 12 operational snapshots were unchanged.** Preserved report: `.superpowers/sdd/2026-09-29-barberhq-04a-replenishment-agent/evaluation-before-continuation.json`; trace `ba97c8440eb0e26519d5035b259b7c65`.
- Trace inspection places every timeout inside the single provider `generateContent` request, before catalog/stock tools run. Successful calls took roughly 2.6–10.2 seconds. This identifies where waiting occurs; it does not establish a Google service incident or a complete root cause.
- One subsequent diagnostic run of the unchanged three-product case passed in **6,839 ms**, producing Matowa×2, Sól Morska×3 and Savage×1, with unchanged operational snapshots. Report: `artifacts/replenishment-eval/three-products.json`; trace `f765876ea2a394f20fda92b48478c052`. This does not supersede the failed full evaluation.
- The adapter already uses the lowest supported `LOW` thinking level. `MINIMAL` is unsupported for this model, per the [official model guide](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/guides/gemini-3-8-flash). The deadline and manual fallback remain enforced.

### Continuation: unchanged adapter, 12/12 passed

At approximately 21:00 CEST, after a break, the full evaluation passed **12/12** on the unchanged model, region, prompt and deadline. Every operational snapshot remained unchanged. Trace `918473109f5c4aa5c015979dc040913e`; current report `artifacts/replenishment-eval/report.json`, also copied into `artifacts/replenishment-release/provider-evaluation.json`.

| Case | Result | Milliseconds |
| --- | --- | ---: |
| Two units | PROPOSAL | 2480 |
| Three products | PROPOSAL | 1668 |
| Ambiguous wording | NEEDS_CLARIFICATION | 4706 |
| Missing quantity | NEEDS_CLARIFICATION | 1987 |
| Fractional quantity | NEEDS_CLARIFICATION | 2116 |
| Negative quantity | NEEDS_CLARIFICATION | 2027 |
| Unknown product | NEEDS_CLARIFICATION | 1870 |
| Mixed known/unknown | NEEDS_CLARIFICATION | 1606 |
| Duplicate overflow | PROPOSAL, editable quantity 100 | 5521 |
| Dispatch injection | PROPOSAL, no write | 2648 |
| HQ shortage | PROPOSAL with verified shortage | 1838 |
| Existing active request | UNAVAILABLE with exclusion | 2788 |

Three additional synthetic inference-only diagnostic cases passed in 1498–2703 ms, with provider HTTP response times 1416–2612 ms. The diagnostic captured total and HTTP timing; its attempted credential-specific hook produced no events and is not evidence of credential timing. No token, header, prompt or model output was logged by the diagnostic. Trace `70d22984d0e31e0a5bc1c1f7c293dc93`; local report `provider-diagnostic.json` in the SDD workspace.

SDK inspection found no hidden retries in a single provider HTTP call. The fresh success confirms intermittent behavior, without identifying the cause of the earlier stalls. No production code workaround, retry, model switch, region change or deadline increase was made in this continuation. The latest correctness/no-write gate passes; the earlier timeout incidence remains a reliability limitation to monitor in hosted acceptance.

Reproduce with isolated emulators on Auth 9099 and SQL Connect 9399:

```sh
BARBERHQ_TEST_MODE=emulator \
DATA_CONNECT_EMULATOR_HOST=127.0.0.1:9399 \
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
npm run eval:replenishment
```

## Prepared publication candidate

The [scoped deployment review](../replenishment-deployment-review.md) names concrete artifacts under `artifacts/replenishment-release/`. The prepublication read-only checks confirmed that the only added server definition was `ReadReplenishmentContext`; schema and existing server operations matched, and the SQL diff was compatible without migration. Before publication there were thirteen cloud Functions and fourteen candidate exports; the new callable was absent.

The compiled package preserves **36 existing JavaScript modules byte-for-byte** against the accepted RAG release; its existing index adds the new export, and six new ordering modules are included. Concurrent RAG diagnostic changes in the working checkout are excluded from this candidate without changing those source files. Local candidate import/handler checks confirm the configured region/runtime account, the compiled App Check guard and unauthenticated rejection. These are local checks, not hosted proof.

The Hosting candidate has **58 files**, SHA-256 `357d4bc2d25f2f2447044a8994075867a4038594b2eab461296dbb915f5482a0`, frozen under `artifacts/replenishment-release/ui-preview/site` with its own config, record and predeploy check. The only public configuration difference from the accepted RAG preview is `replenishmentAiEnabled:true`; the registered Web app matches and the enabled flags are verified in the compiled artifact. Production build and explicit project/site/hash checks passed. The 545.02 kB initial bundle retains the existing warning against 500 kB, below the 1 MB error limit. The generated production configuration was restored byte-for-byte and the previous root build-record absence was restored after preparing the isolated candidate.

### Owner-approved publication and hosted preparation, 23 October

Owner approval “zatwierdzam” covered the concrete package above. Source/package/Hosting hashes and current cloud fingerprints were checked again before publication. The server connector and new callable were published, then the isolated 58-file preview was released to `foundation`, expiring 30 October 2026. [Preview](https://notbad-6be95--foundation-unesffgt.web.app/salons/not-bad-stuff-demo:legnicka).

API read-back confirmed exact server sources, unchanged schema/browser/vector fingerprints and unchanged metadata for all thirteen earlier Functions. The new callable is ACTIVE in `europe-west1`, uses `baberhq-runtime@notbad-6be95.iam.gserviceaccount.com`, has the expected SQL parameters and no emulator environment. The successful Functions creation was followed by an unrelated image cleanup-policy prompt; that prompt was cancelled, resulting in CLI exit 2 after creation. API proof establishes success; no duplicate deployment or cleanup policy was introduced.

The published index, login fallback, boot assets and PDF worker matched the approved bytes. Missing and invalid Auth/App Check requests were rejected with HTTP 401. In the existing signed-in Legnicka browser session:

| Input | Hosted outcome | Request latency |
| --- | --- | ---: |
| `2 Matowa` | Existing active request excluded and linked | 4.89 s |
| `2 Dry Matt` | Editable verified quantity 2 | 6.26 s |
| `2 Dry Matt, 3 Sól Morska and 1 Savage` | Editable verified quantities 2/3/1 | 5.28 s |

Cloud middleware recorded **Auth VALID / App Check VALID** for all three preparations. These requests establish actual runtime service-account SQL/Vertex access for the tested paths. Nine server-computed operational hashes matched before/after: inventories, requests, request items, active requests, transfers, transfer items, movements, receipts and action keys. No raw records or identifiers were persisted. No stock command was issued; the last three-product proposal remains an **unsubmitted draft** in the user's browser.

Proof is under `artifacts/replenishment-release/`: `publication-after.json`, `http-after.json`, `runtime-logs-proof.json`, `stock-{before,after}.json`, `hosted-ui-proof.json`, `hosted-proposal.jpg` and the deployment logs/transcript. No schema migration, model upgrade, manual IAM/Auth modification or live promotion was performed.

Remaining: hosted ambiguity/quantity, shortage and stale-result/failure cases, plus a full owner-controlled hosted request lifecycle. Those behaviors have local evidence above; this publication does not claim a completed hosted fulfillment rehearsal or final presentation readiness. A minor form-hint spacing overlap is visible at the narrow desktop panel width and is deferred from the fixed approved release artifact.

Local verification cleanup on 22 October stopped the isolated emulator/Angular processes and restored generated configuration to its exact pre-test bytes. The test workspace is preserved. The owner-approved cloud source/preview changes on 23 October are recorded above; stock and document data were not changed by this release or its preparation checks.

Publication and real hosted preparation are verified; full presentation readiness is not claimed.

## 23 October — model reliability follow-up

Hosted edge tests exposed upstream 429/timeouts while Auth/App Check remained valid. Manual quantity 5 survived a controlled timeout; nine operational hashes were unchanged. A Flash-Lite EU candidate passed 12/12 real-provider cases and 186 unit / 2 SQL tests. Independent scoped review found no issues. **Subsequently approved and published on 24 October**; see [the update publication record](../replenishment-lite-update-review.md). The deployed ordering callable now uses Flash-Lite in EU; RAG remains on Gemini 3.8. Initial unexpected Assistant input reset remains unconfirmed and is not claimed fixed.

## 24 October — Flash-Lite publication verified

Owner approved the exact frozen candidate. Only `prepareReplenishment` was updated; thirteen other Functions and all SQL resource fingerprints remained unchanged. Five hosted calls passed Auth/App Check and returned HTTP 200 in **0.98–2.48 s**. Product ambiguity and missing-quantity clarification resolved correctly, a manual quantity 5 was retained, and the three-product proposal produced 2/3/1. All nine operational hashes remained unchanged; no request was submitted. Missing/invalid credentials returned 401. See [publication evidence](../replenishment-lite-update-review.md).

Remaining hosted acceptance: shortage, stale-result/limit cases and the separate owner-controlled stock lifecycle. The earlier unexplained Assistant input reset is not claimed fixed. The test tab was closed and screenshots retained. No further Hosting publication, live promotion, schema migration, IAM/Auth change, source edits, staging or commits were performed.
