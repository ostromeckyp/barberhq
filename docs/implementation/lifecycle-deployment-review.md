# Document lifecycle — deployment review

Prepared 16 October 2026 as the concrete proposal approved by the owner. Execution update, 19 October: the scoped migration, cursor backfill, API/IAM changes, schema/server/vector connectors and six knowledge Functions have been deployed. Worker/queue configuration and unauthenticated HTTP access checks pass; full authenticated lifecycle and Angular library acceptance remain pending. The sections below preserve the reviewed proposal; actual evidence is in the [increment handoff](handoffs/increment-3b.md).

## Target and scope

- Project: `notbad-6be95`.
- SQL Connect: `notbad-6be95-service`, `europe-west3`; publish schema and the `server`/`vector` connectors explicitly, preserving the existing browser connector.
- New Functions codebase: `knowledge`, region `europe-west1`, Node 22. Only six new functions: `createDocumentUpload`, `reviewAndPublishDocument`, `retryDocumentProcessing`, `deleteKnowledgeVersion`, `uploadKnowledgePdf`, `processKnowledgeTask`.
- Existing stock functions and `getSourcePdf` remain in their existing codebase. Private PDF originals, active corpus and stock rows must be checked before/after deployment.

## SQL migration reviewed in preview

The CLI SQL diff proposes two enums (`knowledge_operation_action`, `knowledge_pending_stage`), a nullable allocation cursor on `knowledge_document`, nullable upload/dispatch/lease fields on `knowledge_version`, and a new `knowledge_operation` table with business/actor/key uniqueness. The six original-file metadata columns become nullable so registration can precede upload. It proposes no table or row deletion and no stock-table change.

After schema/connector deployment, the cursor helper first scans the complete version history in dry-run mode. The four existing documents are expected to receive cursor 2; application registration remains closed for a document with a null cursor. Apply only the inspected results, then verify corpus identities, active pointers, revisions and stock snapshot remain unchanged.

Cloud-target compiler build reported **zero fatal errors and 16 compatibility acknowledgements**. They cover nullable original/page metadata and changed server-only extraction/import/publication operation signatures. Existing deployed stock commands do not invoke those knowledge operations. The source endpoint uses its own scoped lookup, and the frontend validates page count before opening a source. Existing PDF rows keep their non-null metadata. Operator scripts and the new runtime use the regenerated SDK.

Pinned Firebase CLI 15.32.0's `dataconnect:compile` asks for `--force` but does not register that option. The controller collected diagnostics through the same CLI build API without deployment; `artifacts/corpus-cloud/lifecycle-build-review.json` preserves the warnings. Acknowledgement during a later deployment must be limited to these reviewed changes; any new diagnostic requires inspection.

## Queue and IAM changes

Cloud Tasks API was checked on 16 October and is disabled. Enable it, then give `baberhq-runtime@notbad-6be95.iam.gserviceaccount.com` `roles/iam.serviceAccountUser` on itself for task OIDC attachment. The task declaration restricts invocation to that account. Firebase deployment should grant queue-specific Enqueuer and worker-specific Cloud Run Invoker; inspect actual policies afterward.

Queue: `processKnowledgeTask`, `europe-west1`, three attempts, two concurrent dispatches, minimum retry backoff 360 seconds. Worker timeout is 300 seconds; the extraction lease lasts 360 seconds. An anonymous direct worker request must be rejected by Cloud Run IAM. No task header is treated as authentication.

Detailed owner commands and verification are in [document worker setup](document-worker-setup.md). Existing bucket-scoped access and approved Vertex/SQL/Auth runtime roles remain the baseline.

## Acceptance before enabling the UI

Verify real authenticated/App Check upload, durable queue failure/retry, extraction stopping for human page review, publication/replacement, stale conflict and withdrawal. Use separate test document IDs; preserve the four canonical active documents and retired v0. Verify anonymous Storage/worker denial, exact queue limits and runtime identity, complete cursor backfill, and unchanged stock snapshot. Only then enable the Angular library against the deployed endpoints.
