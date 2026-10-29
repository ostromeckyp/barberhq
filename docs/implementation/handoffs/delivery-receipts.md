# Delivery receipts/issues — release handoff

Date:2026-10-26. Branch `codex/foundation`, HEAD `8baf9e9ac04b13596cd31f74e9ccb521912fff87`. Owner staging and existing dirty work are preserved; no commit/push/new worktree. The reviewed candidate was subsequently deployed with owner approval; see [cloud deployment report](../delivery-deployment-2026-10-26.md).

## Prepared candidate

Artifact folder: `artifacts/delivery-receipts-2026-10-26-reviewed/`.

| Identifier | SHA-256/value |
| --- | --- |
| Frontend build,65 public files | `866ac3f41fb50045787ed432e0fbd4a0c877f272711de5a11df69e3c07b725c0` |
| Public config | `04dbe169bf4f8b841d3c3facde86e271a1a56db47cfa508e373197dd6fbb05a5` |
| Isolated backend code manifest | `14a3f86e35eea4b2624cf1a2fac2f4d14253e3ea716b9f6b819073de0db6ff20` |
| SQL schema/connector sources | `ef6d7cce574e5dfe588ea8e981f09adf524367ff539cd0d38e9cac9d897ed321` |
| Implementation source manifest | `61445fa9ccd076e861cae291c0e1c63101dbc157bd7d09275e9366e8763f5ff0` |

`site/`, `build-record.json`, `public-config.json`, `schema/`, `backend/` and `source-manifest.json` are the frozen preparation outputs. Preview and live now serve Hosting version `37b268d53c7d9336`; all eleven allowlisted functions are ACTIVE. The source manifest identifies68 exact implementation files and matched before promotion. The artifact-only and hosted release guards passed against the actual build hash and full approved public configuration. Production build has a551.79kB initial bundle warning against a500kB warning budget; it passes the configured build gate.

## Function allowlist

`backend/release-manifest.json` carries the exact `deployOnly` filters for the existing `stock` codebase:

- `submitRequest`, `approveRequest`, `rejectRequest`, `dispatchTransfer`, `receiveTransfer`.
- `recordDeliveryReceipt`, `startDeliveryIssueReview`, `addDeliveryIssueNote`, `createDeliveryReplacement`, `setDeliveryProcedure`, `getDeliveryProcedures`.

Node22, Firebase Admin14.5.0, Functions7.4.0, Zod4.6.5, existing service account `baberhq-runtime@notbad-6be95.iam.gserviceaccount.com`, callable region `europe-west1`, maxInstances5 and existing Auth/App Check behavior. SQL cloud target is `notbad-6be95-service/europe-west3`, unlike local `barberhq/europe-west1`. Preserve the corresponding `STOCK_SQL_SERVICE` / `STOCK_SQL_LOCATION` parameters. Package creation installs no dependencies and includes no AI/document/PDF runtime files.

## Verification

Current evidence lives in `.superpowers/sdd/2026-10-25-delivery-receipts-and-issues/`:

- Native transaction capability10/10.
- Root unit254/254; Angular164/164; root typecheck and Functions build PASS.
- Final scoped integration92/92, including all five migration cases; populated knowledge/PDF metadata, guarded historical actor/time, resumed partial backfill and>100-row paging verified.
- Complete browser suite104/104 with local RAG/PDF fixture flags, including seven new review regressions. The fixtures control provider responses/PDF bytes; Auth, SQL, delivery and stock commands use the real local services.
- Production build, local artifact-only release guard and graph update PASS.

Independent review status and any one-pass fixes: [delivery-receipts-review.md](../delivery-receipts-review.md). Exact logs, not historical earlier feature results, support these claims.

## Cloud execution

The owner approved the quiescent window, deployment and specific stock smoke. SQL additive migration, exact function publication, two-receipt historical backfill, real preview stock/PDF verification and exact-version live promotion completed. Trial Cloud SQL rejected managed backups; the consistent logical application backup restored in isolation with all21 table counts/hashes matching. That is not full-instance/IAM/PITR recovery proof. The [deployment report](../delivery-deployment-2026-10-26.md) records exact evidence, stock changes and limitations. No production reset occurred. After the partial receipt/replacement writes the old receipt writer/five-state UI is an unsafe rollback; use a compatible forward fix or a reconciled isolated restore.

Old pending receipt dialogs have in-memory recovery only. Reconcile them before discarding/reloading their tabs. The new delivery journal cannot reconstruct already discarded old tab memory.

The frozen candidate includes its own Hosting `firebase.json` (`public: site`) and `check-hosting.ts` predeploy gate. That gate checks the exact Hosting configuration hash, explicit project and existing artifact-only release checks against the frozen build hash. It passed locally. `release-integrity.json` also fingerprints schema/runtime/Hosting configuration files. Original generated public configuration files and the originally absent root build record were restored; publish from the frozen candidate rather than an arbitrary later development build.

The predecessor `artifacts/delivery-receipts-2026-10-25/` is preserved but superseded by this reviewed candidate. One independent review returned five Important UI/recovery defects; one author fix pass verified all of them with RED→GREEN and the full suite. Manifest coverage and operator parameter names were also corrected. Deferred minor: issue event quantity rows still lack product names and per-event request links. Review limitations and all author rulings are recorded in the linked report/ledger.
