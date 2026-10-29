# Deployed technical checks — 27 October 2026

**Completed scoped checks:32 HTTP assertions (24 CORS/anonymous plus8 valid-Auth App Check negatives),7 deployed SQL cases, real HQ upload/extraction/withdrawal and SALON access denial.** This supplements [today's two functional rehearsals](demo-rehearsal-2026-10-27.md). It is not a blanket READY or a new publication. The owner chose to retain the compact-login candidate locally.

## Actual browser and endpoint checks

Existing SALON Chrome and HQ Codex sessions were verified on production. SALON's library lists exactly the4 current documents, with no add/replace/withdraw controls. HQ uploaded the existing approved synthetic `DAM-001-v1.pdf` into a separate fixture:

- Document `not-bad-stuff-demo:DOC-152F5EC7E905430D809207321B90E3DA`, version `v1`.
- Title “Acceptance upload · unpublished fixture · 2026-10-27”.
- Registration HTTP200 (`createdocumentupload-00001-qol`, Auth VALID/App Check VALID), original upload HTTP200 (`uploadknowledgepdf-00001-bog`), actual private extraction-task HTTP204 (`processknowledgetask-00002-hig`).
- HQ review rendered the original and complete extracted text for1 physical page;0/1 pages checked and Publish disabled. No publication command was submitted.
- SALON still saw4 current documents; direct fixture review redirected to `/no-access`.
- The fixture was withdrawn through the normal UI. Auth/App Check-valid withdrawal HTTP200 (`deleteknowledgeversion-00001-vup`); private original and audit retained. SALON direct source metadata returned PERMISSION_DENIED and rendered0 canvases. This does not separately test authenticated raw-PDF HTTP after withdrawal.

The existing Chrome HQ session on the exact foundation preview origin opened canonical DAM-001 v1 as a rendered1-page protected PDF. The prior preview reCAPTCHA failure did not reproduce in this session. This slice did not repeat preview upload or every stock command; the [19–20 October library evidence](handoffs/document-library.md) and [26 October delivery publication](delivery-deployment-2026-10-26.md) retain their own boundaries.

Read-only HTTP checks:

- PDF source/upload OPTIONS from exact live and foundation origins:204 with the matching allow-origin header.
- Foreign-origin preflight and actual request:403 with no allow-origin header; originless OPTIONS:403.
- Anonymous source/upload requests:401. Ten anonymous stock/delivery/document/AI callable checks:401 UNAUTHENTICATED.

Both Auth and App Check were omitted in those anonymous requests. They do **not** isolate enforcement of missing App Check with otherwise valid Auth. A runner initially used a nonexistent callable name (`registerKnowledgeDocument`,404); the export is `createDocumentUpload`. Corrected request and other document callables passed; original failed output is retained as an operator correction, not an application defect.

## Deployed SQL concurrency and authorization

The reviewed verifier used random `test-stock-gates-<UUID>` businesses, fake SQL actor IDs and the actual deployed server connector. No Firebase Auth users/tokens were created. StockRepository/DeliveryRepository orchestration ran locally; SQL transactions ran in the real deployed PostgreSQL service. These results do **not** represent two concurrent hosted Functions requests or real Auth/App Check verification.

Final7 cases passed:

1. Two same-key submissions produce one request and one replay.
2. Changing the same key's quantity yields IDEMPOTENCY_CONFLICT without state changes.
3. Salon approval and another salon's replay are FORBIDDEN without writes.
4. Two approvals for2 units each with only3 in HQ choose one winner; loser has STALE_STATE/INSUFFICIENT_STOCK, HQ remains3 with2 reserved, winner RESERVED and loser PENDING_APPROVAL.
5. Concurrent same-key dispatch plus lost-response retry produce one dispatch movement2, HQ1/reserved0/version3, one DISPATCHED request and requested/dispatched2/received0.
6. Concurrent same-key receipt plus retry produce one receipt, one delivery command and one RECEIPT2 movement; salon2→4/version2, HQ remains1, request RECEIVED/revision4 and transfer received2.
7. A revoked synthetic SQL membership cannot replay its earlier committed submission.

The final fixture and all seeded/touched rows were deleted by exact generated business ID and their absence verified. An earlier6-case pass also cleaned up. The first receipt-verifier attempt used a nonexistent GraphQL field `deliveryCommands` instead of aliasing `deliveryCommandReceipts`; no receipt proof was obtained from that failed attempt. The fixture deletion succeeded, but the same typo broke its cleanup-verification query. A corrected independent read found all seeded/touched rows absent. Corrected final run then passed7/7 and its full cleanup check. No broad recovery deletion occurred.

Pre-run independent review strengthened the losing-approval error/state checks, HQ/transfer/receipt assertions and cleanup coverage. All concurrent pairs use allSettled so teardown waits for both operations even on failure.

## Independent App Check denial — completed after owner approval

The owner explicitly approved creating/deleting one temporary unassigned Auth identity. The reviewed script created it with a random identity/password, signed in using in-memory persistence, obtained a genuine Auth ID token, then tested4 deployed endpoints with missing and invalid App Check tokens. No SQL membership or custom token was created; credentials and bearer tokens were never persisted or printed.

| Endpoint | Valid Auth, no App Check | Valid Auth, invalid App Check |
|---|---|---|
| getSourcePdf |401 APP_CHECK_REQUIRED|401 APP_CHECK_REQUIRED|
| uploadKnowledgePdf |401 APP_CHECK_REQUIRED|401 APP_CHECK_REQUIRED|
| submitRequest |401 UNAUTHENTICATED|401 UNAUTHENTICATED|
| answerProcedureQuestion |401 UNAUTHENTICATED|401 UNAUTHENTICATED|

All8 assertions passed,27 October09:58:25–09:58:51UTC. Cloud Run independently records Auth VALID paired with App Check MISSING and INVALID for both tested callables, so their401 responses are attributable to App Check rather than a failed login. PDF handlers' distinct APP_CHECK_REQUIRED responses occur only after their Auth verification succeeds.

The script deleted the exact newly created identity. An independent Admin read confirmed user-not-found and a SQL read confirmed no membership. A fresh final scoped snapshot exactly matches the pre-probe snapshot, including all demo operational rows, settings, knowledge and original metadata. No valid stock/document command, model generation, reset, publication or security configuration change occurred.

This closes the selected deployed negative App Check gate. It tests4 endpoints; it does not certify every deployed callable or every possible token condition. Existing accounts and permissions were not modified.

## Preservation

Independent before/after snapshots show the demo operational tables, settings and delivery bindings unchanged. Every pre-existing knowledge row and all7 prior originals' selected generation/checksum metadata match. The only lasting canonical-business additions are the separate withdrawn fixture document/version, its extracted page/command audit and one private original. It never had an active pointer or publishedAt; reviewedPageCount remains0. Existing4 current sources and19 indexed chunks are unchanged. No reset, deployment, configuration/IAM/security change, source-code edit or real-account modification occurred.

The stock SQL fixture assertions are additional technical proof; they are not substituted for the successful separate-role live workflows. Historical document SQL74/74, late/repeated deployed Tasks and authenticated lifecycle proof remain indexed in the [library handoff](handoffs/document-library.md); no active real-worker lease race is claimed here.

## Remaining acceptance boundaries

- A fresh authenticated raw-PDF request after withdrawal and an active simultaneous real-worker lease race are not covered by this slice; local/deployed SQL guards have their separately documented proof.
- Full exact-origin command matrix, remaining rare UI states and H1 clean-install requirement retain their existing scope; do not infer all59 criteria from these checks.
- Human assessment of the selected new answer, uninterrupted presenter timing and projector/physical-iPhone acceptance remain open. Full translation remains deferred.

Private evidence: `.superpowers/sdd/2026-10-27-hosted-gates/`, including `appcheck-negative.json`, sanitized `appcheck-cloud-requests.json`, independent `appcheck-cleanup-verified.json` and `appcheck-proof.json`; scoped snapshots in `.superpowers/sdd/2026-10-27-demo-rehearsal/gates-*`. Raw data snapshots remain private. No staging, commit or worktree cleanup occurred.
