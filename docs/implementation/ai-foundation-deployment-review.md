# AI foundation — proposed SQL deployment

Status, 21 October 2026: owner approved; migration and publication completed. Cloud quota checks and exact-fixture cleanup passed, existing demo-data fingerprints matched, and browser/vector connector fingerprints were preserved. See the [completed handoff](handoffs/ai-foundation.md) for results and remaining business-flow checks. The reviewed scope below is retained as the deployment record.

The shared AI runtime prepares the two planned assistants without adding a public AI endpoint yet. Both will share ten admitted requests per user per UTC hour; SQL chooses the hour and increments the counter atomically. Model failures still consume an admitted request.

## Exact proposed change

Target: Firebase project `notbad-6be95`, SQL Connect service `notbad-6be95-service`, region `europe-west3`, existing Cloud SQL database `notbad-6be95-database`.

The read-only schema diff proposes only:

```sql
CREATE TABLE "public"."ai_usage_window" (
  "uid" text NOT NULL,
  "hour_start" timestamptz NOT NULL,
  "business_id" text NOT NULL,
  "count" integer NOT NULL,
  PRIMARY KEY ("uid", "hour_start")
);
```

The server connector gains `ReadAiActor`, `AdmitAiWindow` and `ReadAiCurrentWindow`, all `NO_ACCESS` for browser callers. Admission checks current membership and uses one parameterized conditional UPSERT. Both assistant names charge the same UID/hour key. No prompt, response, chat history or model reasoning is stored in this table.

Existing stock and knowledge operations are retained. The prepared artifact includes the unchanged vector connector. No inventory/request/document update, reset, seed, Auth account, IAM grant, Functions export or Hosting release is part of this deployment.

## Model and verification boundary

Genkit and the Vertex plugin remain pinned at 1.42.0. The verified reasoning target is `gemini-3.8-flash` at `eu`; embedding remains `gemini-embedding-001`, 768 dimensions, `europe-west3`.

The 20 October direct provider probe passed; the 21 October budgeted runtime probe passed under Genkit CLI with one recorded model span, zero tools and four model turns remaining. These calls used operator ADC. A read-only IAM check found the existing runtime account's Vertex AI User binding; a hosted service-account model call remains a later business-flow acceptance check. See `artifacts/ai-foundation/provider-probe.json` and `runtime-probe.json`.

The current local result and independent review are recorded in the [AI foundation handoff](handoffs/ai-foundation.md). The planned procedure answer and replenishment proposal flows are not implemented by this slice.

## Apply and verify

Before applying, compare existing demo-business/knowledge rows in memory and record only counts and SHA-256 fingerprints; confirm the proposed schema diff is still create-table only. Apply the compatible schema and publish the reviewed server operations, without regeneration from a different config or deployment of unrelated code. Then exercise quota concurrency using newly generated isolated test businesses/UIDs and delete only those exact fixtures. Compare the existing business fingerprints afterward. Production API requests are not used as test fixtures. A full row export was rejected by automatic review; the accepted fingerprint-only alternative does not persist business records and is not a restorable backup.

Applied configuration: `artifacts/ai-foundation/cloud/firebase.json`; fresh approved SQL review: `artifacts/ai-foundation/sql-diff-approved.log`. Execution logs: `migration-approved.log` and `deployment-approved.log`; postdeployment comparison: `sql-diff-after.log`. Preparation and schema comparison alone do not execute a migration; the owner-approved migration and publication were separate commands.

## Recovery and limits

If verification fails, keep both AI feature flags disabled and do not publish a business AI endpoint. Existing manual replenishment and document features remain the usable path. The new table can remain unused; do not drop it or erase counters as an automatic rollback. Any later cleanup is a separate reviewed operation.

This is a demo UTC-hour admission limit, not a rolling-hour billing quota. Old windows are retained; a production retention policy is outside this demo slice. SDK timeouts can discard late results but cannot undo a quota statement already committed after its client stopped waiting.
