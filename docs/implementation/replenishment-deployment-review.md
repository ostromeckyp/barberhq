# Ordering assistant — approved publication record

Prepared 22 October 2026; **owner-approved publication completed 23 October 2026**. Server connector, `prepareReplenishment` and the `foundation` preview are published. Three real signed-in preparations verified valid Auth/App Check, runtime SQL/Vertex access, active exclusion and editable single-/multi-product proposals. Operational state remained unchanged. See the [handoff](handoffs/increment-4a.md).

## Candidate changes

Target project/site: **`notbad-6be95`**. Prepared artifacts: `artifacts/replenishment-release/`.

1. Publish only connector **server** in `notbad-6be95-service` / `europe-west3`, adding `ReadReplenishmentContext`. Candidate config: `artifacts/replenishment-release/cloud/firebase.json`. Read-only API comparison confirms existing server definitions and schema match. SQL diff is compatible without migration. Browser/vector connectors, schema, seed and business data are outside this publication scope.
2. Publish only **prepareReplenishment**, codebase `stock`, region `europe-west1`, runtime account `baberhq-runtime@notbad-6be95.iam.gserviceaccount.com`. Candidate config: `artifacts/replenishment-release/release/firebase.json`. It uses Vertex `gemini-3.8-flash` in `eu`, existing shared AI-0 admission and the compiled App Check guard. Thirteen existing cloud Functions are preserved; the candidate has fourteen exports. Thirty-six existing compiled modules match the accepted RAG package byte-for-byte; only the index adds the export and six ordering modules are new. Concurrent RAG diagnostic changes in the checkout are excluded from this package. Candidate import and unauthenticated handler checks passed.
3. Update existing Hosting preview **foundation**, expiry seven days, with **58 public files**, SHA-256 **`357d4bc2d25f2f2447044a8994075867a4038594b2eab461296dbb915f5482a0`**. Isolated artifact: `artifacts/replenishment-release/ui-preview/site`; record: adjacent `build-record.json`; config: adjacent `firebase.json`. Only `replenishmentAiEnabled` differs from the accepted public RAG preview configuration. Registered Firebase Web app, the enabled flags in the compiled artifact, and production artifact/project/site checks passed. The dedicated predeploy check verifies this isolated artifact and record. Generated source configuration and the root build-record state were restored after building. No live Hosting promotion is included.

```sh
firebase deploy --only dataconnect:notbad-6be95-service:server \
  --project notbad-6be95 --config artifacts/replenishment-release/cloud/firebase.json --non-interactive

firebase deploy --only functions:stock:prepareReplenishment \
  --project notbad-6be95 --config artifacts/replenishment-release/release/firebase.json --interactive

firebase hosting:channel:deploy foundation \
  --project notbad-6be95 --expires 7d --non-interactive \
  --config artifacts/replenishment-release/ui-preview/firebase.json
```

The commands above were executed for the approved scope on 23 October. Public Functions parameter defaults were confirmed interactively. The CLI created its parameter file in the isolated release directory; the agent did not read or copy environment files. After the successful function creation, the unrelated Artifact Registry image cleanup-policy prompt was cancelled. This produced CLI exit 2 after creation; API read-back confirmed ACTIVE, so the function was not redeployed merely to obtain a zero exit.

Immediately before publication, source/package/Hosting hashes and current cloud metadata matched the candidate. After publication, `publication-after.json` confirmed exact server source, unchanged schema/browser/vector fingerprints, unchanged metadata for all thirteen earlier Functions, the correct runtime account/public SQL parameters and no emulator environment. The scoped compiled package preserved unrelated checkout work. No schema migration, model upgrade, manual IAM/Auth modification or live Hosting promotion was performed.

## Acceptance record and remaining rehearsal

- Six hosted route/asset checks matched the approved artifact bytes. Missing and invalid Auth/App Check requests were rejected with HTTP 401.
- Existing signed-in Legnicka browser session: `2 Matowa` correctly linked its active request (4.89 s); `2 Dry Matt` produced quantity 2 (6.26 s); `2 Dry Matt, 3 Sól Morska and 1 Savage` produced quantities 2/3/1 (5.28 s).
- Cloud middleware logged **Auth VALID / App Check VALID** for all three real preparations. This verifies actual runtime SQL/Vertex access for these cases, beyond the earlier operator-ADC evaluation.
- Server-computed hashes of nine operational data categories before and after the tests matched. No raw records or user identifiers were persisted. Only AI admission was permitted to write its shared quota window.
- The three-product proposal remains an **unsubmitted draft** in the user's browser. No stock command was issued. A full hosted submit/approve/dispatch/receive rehearsal and the remaining hosted edge cases below are not claimed complete.

Preview: https://notbad-6be95--foundation-unesffgt.web.app/salons/not-bad-stuff-demo:legnicka . Expires 30 October 2026. The screenshot and `hosted-ui-proof.json` record the reviewable draft.

Remaining hosted rehearsal:

- Verify hosted ambiguity/quantity clarification, shortage warnings, preserved manual edits, stale-result rejection and controlled timeout/quota fallback. The active request link has already passed above.
- Through explicit ordinary actions, submit and complete one owner-approved synthetic request; verify exact expected quantities and no duplicate movements.
- Keep the preview separate from live until the owner accepts the result. Roll back the feature by disabling its public flag and restoring the prior Hosting version; the ordinary ordering workflow remains available.

Evidence under `artifacts/replenishment-release/`: `candidate-before.json`, `candidate-manifest.json`, `package-proof.json`, `sql-diff.log`, `provider-evaluation.json`, `publication-after.json`, `http-after.json`, `runtime-logs-proof.json`, `stock-{before,after}.json`, `hosted-ui-proof.json`, `hosted-proposal.jpg`, `deploy-server-approved.log`, `deploy-functions-transcript.json`, `deploy-preview-approved.log` and `ui-preview/{build-record.json,production-build.log}`.

Owner approval was given explicitly on 23 October: “zatwierdzam”. Further live promotion or business-data rehearsal remains separate from the completed preview publication.

## Follow-up candidate, 23 October

Subsequent hosted edge tests encountered Vertex 429/timeouts. A separate [Flash-Lite EU update](replenishment-lite-update-review.md) was prepared with 12/12 real-provider cases, then **approved and published on 24 October**. Five hosted calls passed Auth/App Check in 0.98–2.48 seconds with unchanged operational hashes. The original approval and publication record above remain tied to Gemini 3.8.
