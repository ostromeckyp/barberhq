# Delivery reads and procedures — local verification

2026-10-25, implementation plan Task5. Local implementation; cloud resources and corpus unchanged.

- Request detail derives good/damaged/missing quantities per product from its final receipt. Inspected shipments have zero transit, including zero-good receipts. Legacy full receipts remain compatible.
- New receipts appear once in status history; LEGACY backfill points to its actual old RECEIVE event without duplicating it. Replacement creation uses the real CREATE_REPLACEMENT issue event.
- The Received filter includes RECEIVED and RECEIVED_WITH_ISSUE. The active request stages remain unchanged. Delivery issues have separately authorized reads and an independent open count.
- DeliveryApi provides scoped receipt context, issue summaries/detail/history, HQ procedure settings and current published document choices. It does not add transit to InventoryRow or AI context.
- HQ procedure bindings use expected revision/key and retain revision when disabled. Missing bindings start at revision0. Foreign/unpublished sources cannot be assigned.
- The protected getDeliveryProcedures callable connects the planned server resolver to the salon form; it uses the existing SQL runtime target, Auth/App Check, region and instance limit. Missing/revoked procedures return explicit MISSING/UNAVAILABLE; no generated replacement instructions or RAG call.
- A published older version remains a valid historical receipt reference after supersession, subject to existing source access/revocation rules. Current links resolve the new published version.
- The standalone Delivery procedures dialog was generated with the installed Angular22.2 CLI. It supports published document choices, disabling a binding, pagination, revision-aware saves and same-selection retry. Task7 attaches it to the HQ issue area.

## Evidence

RED:2 quantity assertions, all6 initial procedure integration cases, and3 mapper/history assertions failed before implementation. GREEN:242/242 root unit,135/135 Angular unit,54/54 combined delivery integration, root typecheck, Functions build and Angular development build passed. The integration suite also verifies actual open counts and published document choices excluding foreign/unpublished sources.

The first Angular build in the sandbox exited134 after “Building…” without a diagnostic; the same build outside the sandbox passed in2.44s. An initial full root unit run again caught missing output-only SDK enum aliases after emulator regeneration; explicit postprocessing after stable sources restored the declarations, then all242 tests passed. SDK regeneration remains explicit `--project demo-barberhq`.

Logs: `.superpowers/sdd/2026-10-25-delivery-receipts-and-issues/task-5-*`. Receipt/issue browser flows, PDF return, migration/reset and final release review remain Tasks6–8.
