# Spec: Phase 2 — Firebase and GraphQL backend

> Updated 8 October 2026: the current [whole-request/settings contract](../../docs/implementation/shared-contracts.md) and [increment 2b handoff](../../docs/implementation/handoffs/increment-2b.md) define one 1–6 item request, atomic whole-request lifecycle commands and versioned per-salon settings. Stock/settings are verified locally; cloud deployment and migration remain pending. RAG/AI remain future phases.


> Provide an authenticated, transactional backend that can complete the stock workflow without AI.

## Background

Read shared contracts and `docs/05-architecture-how.md` sections 4–6 and 8.5. Use the owner setup record from phase 0. The stock/settings schema and operations exist and are locally verified; this specification tracks cloud deployment and release proof, plus the still-pending knowledge schema/operations.

Read the [approved design extensions](approved-design-extensions.md) for this phase’s approved batch, document-library and PDF-geometry responsibilities.

## Requirements

1. Preserve the existing locally verified stock/settings schema and operations when preparing the cloud deployment. Complete the still-pending knowledge records and browser/server connectors from architecture section 5, including document revisions/revocation/review audit, processing state, page geometry/chunk rectangles, source provenance and the AI usage counter. The stock schema uses `ReplenishmentRequest` headers with 1–6 unique `RequestItem` rows (each quantity 1–99), a `Transfer` header keyed by request with business/warehouse/destination, `TransferItem` rows holding request-item identity and quantities, and `StockMovement` unique by transfer item/type. `SalonSettings` is versioned per salon and defaults to 2. Compile the selected vector type/dimension with the verified embedding configuration before phase 3.
2. Deploy scoped read operations listed in the shared contract and generate browser TypeScript and server SDKs. Product reads require business membership; salon staff see assigned salons, HQ sees its business queue. Knowledge reads verify document scope. Paginate lists.
3. Implement callable submit/approve/reject/dispatch/receive commands with runtime input validation, verified Auth/App Check, server-derived actor identity and consistent domain errors. Submission accepts one complete set of 1–6 unique `{productId, quantity}` items with quantities 1–99. Approval, dispatch and receipt change every item atomically; partial lifecycle transitions are forbidden. Commands call server-only transactional operations; browser access to those operations is denied.
4. Enforce state/revision guards, complete-set validation, available stock checks for every item, nonnegative inventory, unique active request and unique transfer-item movements within each transaction. Implement same-key replay, conflicting-payload rejection and semantic duplicate protection. Check authorization again on replay. Never use an unguarded read-then-write sequence.
5. Use isolated synthetic test fixtures to prove conditional updates and rollback with compiled operations on a deployed demo database. If GraphQL cannot express a required guard, use a narrowly scoped parameterized Native SQL operation as described in the architecture and document the generated contract. Do not claim a mocked transaction proves concurrency safety.
6. Implement the authorized getSourcePdf HTTP endpoint, resolving bucket/path/generation from SQL and verifying identity, App Check and document scope. Deny arbitrary object paths, cross-business access and revoked documents. Return bounded PDF bytes with private no-store caching. Storage rules deny direct browser access.
7. Publish and implement document-library read contracts, HQ upload/version registration and bounded binary upload proxy, review/publish, retry and delete commands from the approved extensions. Wire worker dispatch to the phase-03 implementation; this phase supplies durable status, idempotency and publication/revocation guards, not fake completed ingestion. Prove salon/foreign-user denial, HQ staged preview and concurrent version guards. Keep stock receipts separate from document operation receipts.
8. Add ignore rules for local setup records, UID mappings and credentials before any private configuration is saved. Publish callable schemas, operation names, generated SDK locations and setup/deployment commands in the phase-02 report. Create narrowly scoped operator seed/ingestion operations for phase 3. Establish server-only model configuration and atomic shared quota helper; AI flows are later work.

## Affected Files

| File | Change type | Description |
|---|---|---|
| `dataconnect/` | Create | Schema, scoped connectors and generated SDK configuration |
| `functions/` | Create | Auth, stock commands, PDF endpoint and quota helper |
| `firebase.json and storage.rules` | Create | Backend deployment and private storage rules |
| `scripts/backend-checks/` | Create | Meaningful integration and concurrency checks |
| `docs/implementation/handoffs/phase-02.md` | Create | Contracts, pinned dependencies and validation evidence |

## Existing Patterns to Reuse

- Architecture section 6 defines transaction behavior and repeat-request semantics.
- Reuse generated types across adapters; centralize identity/membership checks.

## Constraints

- No Angular screens, real stock import, AI-generated mutations or general-purpose SQL endpoint.
- Auth credentials live in Firebase Auth; role/salon scope lives in SQL. Model configuration and operator credentials stay server/local only.

## Open Questions

Cloud validation requires the owner’s project/resource settings and test identities from phase 0. Missing credentials block deployment proof, not local schema and function work.

## Acceptance Criteria

- [ ] Generated SDKs compile; scoped read operations and source permissions pass positive/negative checks.
- [ ] The exact 18/2 → 16/4 lifecycle succeeds using commands with stock conservation.
- [ ] Concurrent approval cannot oversell; duplicate dispatch/receipt cannot double move stock; failed checks roll back.
- [ ] Foreign salon/business, missing identity, direct server-operation calls and altered idempotency payloads are rejected.
- [ ] Document APIs enforce HQ scope, byte/hash limits, idempotency and atomic publish/delete guards; incomplete worker work is not exposed as published.
- [ ] Report identifies the actual vector model/dimension and distinguishes emulator tests from deployed verification.
