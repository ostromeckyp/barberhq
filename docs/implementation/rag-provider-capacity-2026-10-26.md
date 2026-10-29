# Procedures provider capacity — published recovery fix

26 October 2026. **Published; one authenticated production control question passed.** Owner authorization: “Publikuj i sprawdź pytanie”. Test at [notbad-6be95.web.app/procedures](https://notbad-6be95.web.app/procedures). Frontend release remains `e56c6e784f80e9d1`; the procedure backend is now `answerprocedurequestion-00004-hun`.

## Confirmed diagnosis

Read-only Cloud Logging inspection identified the underlying error for the reported fast `PROVIDER_UNAVAILABLE` failures: Vertex AI returned HTTP429, `RESOURCE_EXHAUSTED`, from `gemini-3.8-flash` on the EU endpoint. At11:18:51UTC the generation phase failed after99.59ms; the immediately preceding SDK log records the429. Several earlier failures show the same pattern. The app currently normalizes the provider exception into a generic public error.

The generic provider message does not distinguish a fixed project quota from shared-capacity exhaustion. It is not evidence of a billing-plan problem or a failure to assign delivery procedures. No quota, billing, IAM or location change was made. The installed gcloud CLI does not provide the attempted `services quota list` command; no component was installed to work around that.

Later the same deployed model completed generation in11.829s and passed the source recheck at13:26:44UTC. Separately, generation hit the existing25-second budget at11:23:36UTC. The429 recovery change below does not resolve an individual slow generation exceeding that deadline.

Google recommends delayed, bounded retries for429 responses. It documents both quota and shared-capacity causes. References: [Vertex API errors](https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/api-errors), [429 handling](https://cloud.google.com/vertex-ai/generative-ai/docs/error-code-429).

## Prepared behavior

- Only the structured procedure generator retries, once per generation, after a genuine Genkit `RESOURCE_EXHAUSTED` exception.
- Backoff is1000–1999ms with jitter, extended when the provider supplies a longer `Retry-After`. A hint at least25 seconds long is not shortened into an earlier retry.
- Both calls share the original abort signal/deadline. Each actual provider call consumes a model turn; the existing5-turn/8-tool budget remains in force. Authentication, quota admission and retrieval are not repeated by this retry.
- Other provider errors and invalid structured outputs are not retried. A second429 remains a controlled `PROVIDER_UNAVAILABLE`; SDK detail stays out of the public error.
- Model `gemini-3.8-flash`, EU routing, prompt, schema, output budget, access checks and source recheck remain unchanged. This mitigation cannot guarantee availability during sustained exhaustion.

## Verification

- Regression proof against the original runtime:5 named failures,10 passes. Initial test setup used the CommonJS SDK class, which differed from the runtime's ESM class; corrected tests use the installed ESM SDK. The corrected original-runtime RED is saved separately.
- Final full unit suite: **264/264 across45 files**. Runtime review independently reran all15 runtime tests.
- Typecheck, Functions build, scoped formatting/whitespace checks and graph update pass. Graph coverage does not include these untracked AI modules; direct source inspection supplied review coverage.
- Independent focused source review: no actionable findings.
- Compiled frozen-package smoke uses a controlled provider429 followed by valid output. It verifies delayed recovery, two calls and two consumed turns. This is local behavior evidence, not a real cloud recovery-rate measurement.

## Frozen publication candidate

`artifacts/rag-provider-retry-2026-10-26/` contains46 manifest files. Manifest SHA-256: `804cbe71bcb270f968126cffd9fc11cda94dc113e3ea26c2cbde45364dc2f1e1`. Runtime source SHA-256: `768f11fb57eb3431a95633f9d4adc8b02b0f451652cfccabb1fd639046756076`.

Relative to the published diagnostic package, only compiled `ai/runtime.js` changes. The current shared runtime also already contains the Flash-Lite allowlist addition for the separately deployed replenishment flow; the freeze guard identifies that pre-existing difference and proves the other baseline runtime semantics match. The procedure's selected model remains Flash3.8. The other45 files, including the callable factory, are byte-identical to the diagnostic baseline. The package retains its13 original exports; the deployment filter must select only `functions:stock:answerProcedureQuestion` so that newer delivery endpoints and all other deployed functions are outside the publication scope.

The target's current settings were read back: ACTIVE, Node22, runtime account `baberhq-runtime@notbad-6be95.iam.gserviceaccount.com`,1CPU,256Mi memory,60s function timeout,80 concurrency,maxInstances20,ALLOW_ALL ingress. Preserve these settings during publication; the earlier unset→20 scaling difference is historical and is not silently repaired here.

## Publication and production control

Only `functions:stock:answerProcedureQuestion` was deployed, from the frozen46-file package. Cloud Build `21651d93-52d1-4086-9bcb-51da4350a245` is SUCCESS. Revision changed from `answerprocedurequestion-00003-biv` to **`answerprocedurequestion-00004-hun`**, ACTIVE with all traffic on the latest revision. A strict API comparison passed: all target environment/secrets hashes and runtime settings above are unchanged, and the other19 functions retain their exact previous metadata/revisions.

The pinned CLI's programmatic deploy returned exit1 with its generic failure handler. The underlying CLI failure cause was not established; do not attribute it to image-cleanup policy without evidence. Deployment success is independently supported by Cloud Build SUCCESS, the new ACTIVE revision, strict configuration preservation and the real protected control call. No second deploy was attempted merely to obtain exit0.

One question was submitted through the normal production HQ browser session: “Otrzymaliśmy uszkodzony produkt. Co powinniśmy zrobić?”. Auth and App Check were VALID. The UI displayed four English instructions with paragraph links to two DAM-001 v1 sections. The source recheck passed; the new backend's phase logs show:

| Stage | Duration |
| --- | ---: |
| Actor | 186.65ms |
| Admission | 97.19ms |
| Retrieval | 593.03ms |
| Generation | 3794.80ms |
| Source recheck | 35.49ms |

No429 was observed in this control call. Recovery from a real cloud429 was therefore not exercised by this one question; local tests and the compiled-package smoke establish the retry behavior. Sustained capacity exhaustion and slow individual generations remain possible. This single call does not close the two-full-rehearsal or Polish-output acceptance gates.

The question was tested in a separate production tab, preserving the owner's existing inventory/request input. A screenshot is saved as `live-answer.png` and the successful answer tab was retained. No additional Ask assistant, stock command, reset or document mutation was performed. Normal AI quota admission does record this authorized call.

The subsequent live release gate passed all66 frontend file comparisons, routes/headers/worker/configuration and backend readiness checks. Hosting version/build/configuration remain unchanged. New backend fingerprint: `sha256:ab1aafd0e174669e08ddffce4afd94902c366bf174348df82e196bfb11cf8c1c`. The frozen candidate's original `review.json` remains the historical prepared review; `publication.json` records the completed publication. No commit or staging was performed.

Local evidence: `.superpowers/sdd/2026-10-26-rag-provider-retry/`, especially `red-esm.log`, `unit.log`, `typecheck.log`, `build.log`, `graph.log`, `artifact-proof.json`, `metadata-before.json`, `metadata-after.json`, `build-result.json`, `live-question-phases.json`, `publication-proof.json` and `live-release-after.json`.
