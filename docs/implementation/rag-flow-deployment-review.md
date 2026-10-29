# Grounded procedure backend — publication review

Prepared 21 October 2026; updated 22 October. **Owner-approved backend publication completed; authorized hosted acceptance pending.** This release added a new callable and a final source-check query. See the [handoff](handoffs/rag-flow.md) for read-back evidence and the remaining browser acceptance gate.

## Scope

Target project: `notbad-6be95`.

1. Publish only SQL Connect connector `server` in `notbad-6be95-service` / `europe-west3`, adding `RecheckProcedureSources`. Prepared config: `artifacts/rag-flow/cloud/firebase.json`. Existing operations, schema and vector connector match accepted 4B.1 sources; the read-only SQL diff is compatible without migration.
2. Deploy only `answerProcedureQuestion` in existing Functions codebase `stock`, region `europe-west1`, using the configured runtime account `baberhq-runtime@notbad-6be95.iam.gserviceaccount.com`. The built source preserves the twelve existing exports. The measured retrieval JSON remains in `functions/config/` and is included by the Functions source configuration.

```sh
firebase deploy --only dataconnect:notbad-6be95-service:server \
  --project notbad-6be95 --config artifacts/rag-flow/cloud/firebase.json --non-interactive

firebase deploy --only functions:stock:answerProcedureQuestion \
  --project notbad-6be95 --non-interactive
```

Publication used an isolated, already-compiled source package at `artifacts/rag-flow/release/firebase.json`, preserving existing exports without copying private environment files. Firebase CLI 15.32.0 required explicit `--interactive` to collect public parameter defaults in this agent session. The separate Artifact Registry cleanup-policy prompt was cancelled after successful function creation; no automatic image-deletion policy was introduced. Do not rerun the commands merely to obtain a successful CLI exit: API read-back verifies the deployed function is ACTIVE.

No Hosting release or browser feature-flag change is included. No seed, migration, source publication, IAM change, model upgrade or business-data edit is proposed. The new authenticated callable may incur model cost when invoked, subject to AI-0 admission and limits.

## Evidence and acceptance

The [implementation handoff](handoffs/rag-flow.md) records final unit/native integration/build/typecheck results, independent review and a real single-call JSON schema smoke. Operator ADC smoke success does not establish hosted runtime permissions.

Before publication, read back deployed definitions against the accepted 4B.1 fingerprints. After publication, compare them with the staged new server sources and confirm schema/browser/vector are unchanged. Check the new function's region, runtime service account and App Check enforcement. Exercise authentication/access rejection and an authorized synthetic question, checking fresh source identities and unchanged business state. Keep the UI disabled if hosted checks fail; report the precise failed gate without resetting data. Actual staff guidance and demo claim-support acceptance remain Task 4B.3.

The 25-second response limit does not guarantee provider-side cancellation of a query embedding already in flight: pinned Genkit 1.42 exposes no supported cancellation hook for that path. Late results are discarded and cannot initiate another SQL search. This is an explicit release limitation.
