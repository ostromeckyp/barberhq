# Full demo reset — procedures, products and product cards

29 October 2026. Implements the [full demo reset design](../superpowers/specs/2026-10-29-full-demo-reset-design.md) and [plan](../superpowers/plans/2026-10-29-full-demo-reset.md).

`scripts/seed/reset.ts` now brings the demo business to the repo baseline, knowledge included. Storage references are never seeded: the run uploads each PDF and writes the bucket, path and generation it got back, so no reference can point at a missing object.

## What one `--apply` does

1. Stock, requests and deliveries (unchanged).
2. HQ product administration and seed aliases (unchanged).
3. **Preflight.** `data/knowledge/manifest.json` is read with the PDFs and the owner approval receipts in `data/knowledge/reviews/<code>-<version>.approval.json`. Every PDF is extracted locally and must still match the extraction hash its owner approved. A sha mismatch, missing or mismatched receipt, changed extraction, invalid card product (`productDemoId`) or invalid procedure binding stops the reset before anything is deleted, with the error naming the document (for example `KNOWLEDGE_SEED_INVALID: REP-001 v1: RECEIPT_MISSING`).
4. **Wipe.** All knowledge rows of the business go: documents, versions, pages, chunks, product links/profiles/operations, document-sourced aliases, card attachments and knowledge operations. Product types asserted by documents fall back to `seedType`. Every Storage object under `knowledge/<businessId>/` is deleted. Documents HQ added in the UI are deleted too (owner decision 29 Oct).
5. **Rebuild**, in manifest order: upload → local extraction → review from the receipt (the extraction hash must match) → for a card, an operator product review linking the whole card to its product → publish (Vertex embeddings) for demo-current entries.
6. **Card attachments.** Each product gets its card attachment row as PUBLISHED with no suggestions.
7. **Bindings.** Each delivery problem kind is bound to its seeded procedure (`deliveryProblemKind` in the manifest: DAMAGED → DAM-001, MISSING → DIS-001). A binding HQ changed returns to the seed.

A run that fails part-way (for example on Vertex) is completed by running `--apply` again: the wipe comes first and everything rebuilt, bindings included, comes from the repo. Run it with the demo quiet (`--quiescent`): an upload or salon action during the reset window is not protected, and salon-confirmed shorthand plus pending choice receipts survive the reset.

## Seed

| Data | Where |
| --- | --- |
| Procedures DAM-001 v1, DIS-001, REP-001; DAM-001 v0 retired | `data/knowledge/manifest.json`, `data/knowledge/pdfs/` |
| Six product cards (`kind: product-card`, `productDemoId`) | manifest, `data/knowledge/pdfs/product-cards/` |
| Delivery procedure bindings (`deliveryProblemKind`) | manifest |
| Owner approvals | `data/knowledge/reviews/*.approval.json` (cards approved in chat on 29 Oct) |
| Products, type, keywords, aliases | `docs/not-bad-stuff-products.json` → `data/seed/business.json` |

The CAT-001 product guide is no longer part of the baseline (owner decision 29 Oct): the cards carry the same facts per product. Its PDF, source and approval stay in the repo as history.

## Publication path

Operator-reviewed product documents may now publish without an HQ member: `RecordOperatorProductReview` stores the product review hash (card → one confirmed link, `method: hq`; catalog → empty knowledge acknowledged), `SetOperatorKnowledgePublishIntent` accepts product kinds carrying that hash, and `PublishKnowledgeVersion` accepts `reviewed_by` `operator:…` in place of the HQ actor. A card without its operator product review is still refused. These are connector changes: deploy connectors before the first cloud reset.

## Commands

```sh
# Local (SQL Connect 9399 plus a Storage emulator; `npm run dev:emulators` does not start Storage,
# so the local knowledge runtime needs one started separately, default port 9199)
DATA_CONNECT_EMULATOR_HOST=127.0.0.1:9399 FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199 \
  node --import tsx scripts/seed/reset.ts --project demo-barberhq --business not-bad-stuff-demo \
  --confirm not-bad-stuff-demo --quiescent --dry-run

# Cloud (explicit owner approval for each run)
node --import tsx scripts/seed/reset.ts --project notbad-6be95 --business not-bad-stuff-demo \
  --confirm not-bad-stuff-demo --quiescent --config <public config> --dry-run
```

The dry-run prints what the wipe would remove (documents, versions, chunks, card attachments, document aliases, Storage objects), the entries to rebuild and the number of chunks to embed. Swap `--dry-run` for `--apply` after review. Each apply makes one embedding call per chunk of the demo-current documents (Vertex `gemini-embedding-001`, also locally).

## Verification (local, isolated)

| Gate | Result |
| --- | --- |
| Unit (seed validation, extraction preflight, bindings, card facts, corpus, exporter, reset wiring and error codes) | 373 passed |
| SQL integration: knowledge wipe, operator product review/publish, rebuild (baseline, manually deleted object, failed run + rerun, preflight deletes nothing, idempotent rerun, dry-run), reset, seed | 16 passed |
| Related knowledge/product/RAG/document suites | passed; `document-library-access` needs Auth on 9099 (isolated stack uses 9198) |
| Typecheck, Functions build | pass |

Not yet done: a run against the owner's emulators, connector deployment and a cloud reset. The RAG evaluation cases now expect the cards; a paid evaluation run has not confirmed retrieval quality.
