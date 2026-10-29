# Delivery receipts/issues — cloud deployment

Date: 2026-10-26. Project/site `notbad-6be95`. Owner authorized deployment, confirmed the application was idle, then explicitly approved the Mattifier stock smoke in Legnicka. No reset was performed. Test history is intentionally retained.

## Published release

| Identifier | Value |
| --- | --- |
| Hosting preview and live | `37b268d53c7d9336` |
| Previous live | `4b833190c12b9244` |
| Frontend SHA-256 | `866ac3f41fb50045787ed432e0fbd4a0c877f272711de5a11df69e3c07b725c0` |
| Public configuration SHA-256 | `04dbe169bf4f8b841d3c3facde86e271a1a56db47cfa508e373197dd6fbb05a5` |
| Implementation source manifest | `61445fa9ccd076e861cae291c0e1c63101dbc157bd7d09275e9366e8763f5ff0` |
| Backend source manifest | `14a3f86e35eea4b2624cf1a2fac2f4d14253e3ea716b9f6b819073de0db6ff20` |
| Schema/connector source manifest | `ef6d7cce574e5dfe588ea8e981f09adf524367ff539cd0d38e9cac9d897ed321` |
| Hosted backend revision fingerprint | `sha256:d3778b7cb487f03bd831c6077f8915b3bd45eae670ce43243649262f67fbf8a9` |

The frozen artifact is `artifacts/delivery-receipts-2026-10-26-reviewed/`. All 65 hosted file bytes, headers, approved public configuration and backend readiness checks passed on preview and live. Live was cloned from the exact verified preview version, with no rebuild. The 68 implementation source hashes, 19 backend files and frozen configurations matched immediately before promotion.

## SQL and functions

The reviewed additive DDL created nine delivery tables and five enum types, appended `RECEIVED_WITH_ISSUE`, and added nullable `replacement_issue_id` with indexes/relations. All three connectors and the schema were deployed to `notbad-6be95-service/europe-west3`. The planned enum addition and retirement of server `ReceiveStock` required explicit breaking-change acknowledgement. No destructive DDL or existing-row rewrite occurred.

All eleven allowlisted stock/delivery functions are ACTIVE in `europe-west1`: `submitRequest`, `approveRequest`, `rejectRequest`, `dispatchTransfer`, `receiveTransfer`, `recordDeliveryReceipt`, `startDeliveryIssueReview`, `addDeliveryIssueNote`, `createDeliveryReplacement`, `setDeliveryProcedure`, `getDeliveryProcedures`. Node 22, maxInstances 5, existing runtime account `baberhq-runtime@notbad-6be95.iam.gserviceaccount.com`, Auth/App Check and SQL target parameters were preserved. Nine unrelated function revisions were unchanged.

The Functions CLI reported a missing Artifact Registry cleanup policy after every function update had succeeded. Independent cloud metadata verified all eleven ACTIVE. No cleanup policy was added and retained images were not deleted.

To respect the repository prohibition on private environment files, exact frozen backend bytes were staged with existing version-checked dependencies outside the packaged source. The two public SQL target parameters were supplied in memory through an adapter for the pinned Firebase CLI 15.32.0 interface. No application/CLI source files were patched and no private environment files were accessed. Operational cost: this adapter is tied to that CLI interface and fails its assertions on version/path drift; it must be rechecked before reuse with another CLI.

Historical backfill inserted two LEGACY receipts and four items, without moving stock. The subsequent dry-run had zero pending receipts and retained snapshot hash `64b4b54f86745593af4adba8eecea72a4b73173210379b8af18b69ba568c45b2`. All 21 original tables matched before/after DDL and backfill, normalizing only the newly added nullable request field.

## Approved hosted stock smoke

The real signed-in Chrome UI on preview used the deployed protected callables and production SQL data. HQ switched into the Legnicka workspace through the existing authorized workspace selector.

| Step | Result |
| --- | --- |
| Request Mattifier ×2, approve and dispatch | HQ 18→16; salon 2; transit 2 |
| Inspect 1 good, 1 damaged, 0 missing | Salon 2→3; transit 0; root `RECEIVED_WITH_ISSUE`; issue OPEN |
| HQ starts review and creates replacement | Linked request for exactly 1 outstanding good unit |
| Approve and dispatch replacement | HQ 16→15; salon 3; transit 1 |
| Inspect replacement: 1 good, 0 damaged/missing | Salon 3→4; transit 0; child RECEIVED; issue automatically RESOLVED; remaining 0 |

Original request: `2f3f6595-d367-453f-a64f-544d2f6c7d67`. Replacement: `36251ebc-0eeb-46ee-becc-82cea2600f66`. Issue: `delivery-issue-8d0f323c2c33978cb8707995a3e0718ae62bba1ca3e61ef6ad4d348806f70606`. Its description explicitly identifies the owner-approved synthetic deployment smoke.

Independent read-only SQL verified both immutable receipts, root/child linkage, resolved issue, cleared active replacement pointer and entitlement 1/1. All original rows in the other 20 application tables remain present with identical row hashes. Exactly two of 24 inventory rows changed by the approved amounts and version increments; all other 22 are identical. The earlier pending request `5d69c184-002d-4b05-90e2-0fae4ec882cb` was preserved.

## Documents and browser verification

Preview: Procedures → Documents → DAM-001 v1 rendered its protected PDF through normal App Check. Its back button returned to the Documents tab. All seven Storage objects retained the exact generation/size/content hash metadata; manifest SHA-256 `5fbc41e5b5fcb0eb44c341b23e6a199ff77d32940a7e9320445047e70c77bfae`. Knowledge rows remained unchanged. No document/procedure assignments were fabricated; damaged/missing procedure bindings remain unassigned and the UI says to contact HQ.

Live: the exact release byte/config/backend gate passed. The signed-in HQ UI shows the retained pending request, original problem receipt and completed replacement with HQ 15 / Legnicka 4 / transit 0. Initial root navigation briefly displayed an empty application surface; after one reload, the HQ session loaded with no captured console errors. No source/security change was made for that observation.

Live DAM-001 v1 also rendered its protected PDF, and the back button returned to `/procedures?tab=documents`. Evidence screenshots: `cloud-live-resolved.png` and `cloud-live-pdf.png` in the private evidence folder. After the final hosted checks the command window was reopened to the owner; there is no application maintenance toggle to change. The owned temporary standalone SQL proxy was stopped.

## Backup and recovery boundary

Cloud SQL No Cost Trial rejected managed backup creation. Instead, a consistent serializable-deferrable `pg_dump` of the public application schema/data was saved privately (332128 bytes, mode 0600, SHA-256 `198b53abb3c50068f55303e6ff570cb5416878dba02c0948b4a48f4b382f049c`). An isolated PGlite restore matched all 21 application tables by counts/content hashes. Source PostgreSQL 18/vector 0.8.5 versus isolated PostgreSQL 17.5/vector 0.8.0 is recorded explicitly. Cloud schema/connector definitions and Storage metadata were archived separately.

This establishes logical application-data recovery evidence, not managed full-instance/IAM/PITR restoration. No billing, IAM, authorized-network or SQL-instance setting was changed. Recovery needs the archived cloud definitions and reconciliation of writes after the backup. After the new partial receipt/replacement writes, the old full-intact receipt writer/five-state UI is incompatible: use a compatible forward fix, or an independently restored and reconciled recovery; do not simply roll Hosting back to the old release.

Exact logs, backup, cloud revisions, release records and verification scripts are private local artifacts in `.superpowers/sdd/2026-10-25-delivery-receipts-and-issues/`. Owner staging and dirty checkout remain intact; no commit/push/worktree deletion. Push/FCM, physical disposal/return accounting, corrections, refunds and photo uploads remain outside this release. Deferred minor: issue event rows lack product names and per-event request links.
