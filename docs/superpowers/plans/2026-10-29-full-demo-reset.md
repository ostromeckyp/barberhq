# Full Demo Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `scripts/seed/reset.ts --apply` wipes all knowledge of the demo business (DB + Storage) and rebuilds procedures, catalog and six product cards from the repo, with every product linked to its card.

**Architecture:** The knowledge seed is `data/knowledge/manifest.json` (+ `productDemoId` on cards) and approval receipts in `data/knowledge/reviews`. A new `scripts/seed/knowledge.ts` runs preflight → native-SQL wipe → Storage prefix delete → `KnowledgePipeline` stage/extract/review → operator product review (cards/catalog) → publish → card attachments. The operator publish path is extended to product kinds, gated by an operator-recorded product review hash.

**Tech Stack:** TypeScript (tsx), Firebase Admin (Data Connect, Storage), Data Connect native SQL (`dataconnect/server/*.gql`), Vitest unit + isolated SQL integration (PostgreSQL 17 + SQL Connect 9499 + Auth 9198), Vertex embeddings via `createVertexEmbeddingAdapter`.

**Spec:** `docs/superpowers/specs/2026-10-29-full-demo-reset-design.md`

## Global Constraints

- Never read/print/grep/copy/edit `*.local.json` or `.env`; scripts may take them as `--config` / `--memberships` args.
- Reset guards unchanged: project ∈ {`notbad-6be95`, `demo-barberhq`}, business `not-bad-stuff-demo`, `--confirm` equal, `--quiescent`, exactly one of `--dry-run` / `--apply`.
- Prod writes (connector deploy, `--apply` on `notbad-6be95`) each need explicit owner approval in chat.
- No model calls during reset. No app/runtime code names a document or product.
- Approval receipts are written only from owner text given in chat; never invented.
- Storage paths stay `knowledge/<businessId>/<code>/<version>/<sha>.pdf`.
- TDD: each test is run and seen failing before the implementation.
- After any `.gql` change: `npm run generate:sdk -- --project demo-barberhq` before unit tests; `npm run build:functions`.
- No commits unless the owner asks.

## Review Focus

1. Storage object deleted by hand while DB row remains → reset still succeeds and ends with a live object (Task 4 test `repairs a manually deleted storage object`).
2. Reset fails mid-rebuild (embedder throws on 3rd document) → rerun `--apply` reaches the full baseline (Task 4 test `a failed rebuild completes on rerun`).
3. Missing/mismatched receipt or PDF sha → nothing is deleted (Task 4 test `preflight failure deletes nothing`).
4. HQ-added document plus its card attachment and document-sourced aliases → gone after reset, seed aliases intact (Task 2 test).
5. Operator path must not let a product card publish without its operator product review (Task 3 test `operator publish of a card without product review is refused`).

---

### Task 1: Knowledge seed: card entries with `productDemoId`

**Files:**
- Modify: `functions/src/knowledge/pipeline.ts` (`ManifestEntry` gains `productDemoId?: string`)
- Create: `scripts/seed/knowledge-seed.ts`
- Modify: `data/knowledge/manifest.json` (+6 entries)
- Test: `tests/unit/knowledge-seed.test.ts`

**Interfaces:**
- Produces:
  - `readKnowledgeSeed(opts?: { manifest?: string; reviews?: string; businessSeed?: BusinessSeed }): Promise<KnowledgeSeed>`
  - `type KnowledgeSeed = { entries: (ManifestEntry & { bytes: Uint8Array; receipt: ReviewReceipt | null })[] }`
  - `validateKnowledgeSeed(seed, businessSeed): string[]` returns problems; empty = OK.
  - `ReviewReceipt` reused from `scripts/ingest/review.ts`.

- [ ] **Step 1: Write failing tests** in `tests/unit/knowledge-seed.test.ts`:
  - `manifest has one product-card entry per product card PDF` — 6 entries with `kind === 'product-card'`, `inputPdf` under `data/knowledge/pdfs/product-cards/`, `language 'pl'`, `origin 'public-compilation'`, distinct `productDemoId`, each present in `data/seed/business.json` products.
  - `card title, sourceUrls and observedOn come from the product` — the title equals `` `${product.name} — karta produktu` ``, `sourceUrls` equals `[product.sourceUrl]`, and `observedOn` equals `product.observedOn`.
  - `reports a sha mismatch` — a tampered byte gives the problem `CARD-NBS-SAVAGE-50 v1: PDF_HASH_MISMATCH`.
  - `reports a missing receipt` — an entry without a receipt gives the problem `<code> <version>: RECEIPT_MISSING`.
  - `reports a receipt for another sha` — the problem is `RECEIPT_MISMATCH`.
  - `rejects productDemoId on non-card kinds and requires it on cards` — `PRODUCT_LINK_INVALID`.
- [ ] **Step 2: Run** `npx vitest run tests/unit/knowledge-seed.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** `scripts/seed/knowledge-seed.ts` and the 6 manifest entries (sha256 = `shasum -a 256` of each repo PDF; `publicationStatus: 'demo-current'`). The receipt file is `data/knowledge/reviews/<code>-<version>.approval.json`; absent → `receipt: null`.
- [ ] **Step 4: Run** the same test plus `tests/unit/corpus-manifest.test.ts tests/unit/pdf-manifest.test.ts tests/unit/knowledge-scope.test.ts`. Expected: knowledge-seed passes except the `RECEIPT_MISSING` expectations for the real cards (asserted as exactly the 6 card codes until Task 5). Existing manifest tests pass, or are updated only where they count entries.
- [ ] **Step 5: Run** `npm run typecheck`. Expected: pass.

### Task 2: Knowledge wipe (SQL + Storage)

**Files:**
- Modify: `dataconnect/server/seed.gql` (new `WipeDemoKnowledge`, `ReadKnowledgeWipeCounts`)
- Create: `scripts/seed/knowledge-wipe.ts`
- Test: `tests/integration/knowledge-wipe.test.ts`

**Interfaces:**
- Produces:
  - `wipeKnowledge(dc: DataConnect, bucket: Bucket, businessId: string, dryRun: boolean): Promise<WipeCounts>`
  - `type WipeCounts = { documents: number; versions: number; chunks: number; cardAttachments: number; documentAliases: number; storageObjects: number }`
  - `Bucket` is the same type as in `functions/src/knowledge/repository.ts`.

- [ ] **Step 1: Write failing integration test** `wipes every knowledge row of the business and keeps seed aliases`:
  - Setup: isolated fixture.
    - Stage, extract and publish one procedure via `createKnowledgeHarness`-style pipeline with the fake embedder.
    - Plus one HQ-style product card with a `product_card_attachment`, a `knowledge_product_link`, a `knowledge_product_profile`, and a `product_alias` with `source_document_version_id`.
    - Plus seed aliases (`runProductAliasSeed`).
    - Plus a foreign business document.
  - Assert, after `wipeKnowledge(..., false)`:
    - 0 rows in `knowledge_document/version/page/chunk/operation`, `knowledge_product_link/profile`, `product_knowledge_operation` and `product_card_attachment` for the business;
    - document-sourced aliases gone;
    - SEED aliases unchanged (count + revisions);
    - `product.type` = `seed_type`, `type_source_version_id` null;
    - the foreign business untouched;
    - fake bucket has no `knowledge/<businessId>/` objects, foreign prefix kept.
  - Second test `dry-run counts without deleting`.
- [ ] **Step 2: Run** `npm run test:integration -- tests/integration/knowledge-wipe.test.ts` (isolated env vars). Expected: FAIL (mutation missing).
- [ ] **Step 3: Implement**
  - `WipeDemoKnowledge($businessId)`: `@auth(level: NO_ACCESS) @transaction`, one native SQL statement. Order:
    1. null `knowledge_document.active_version_id` and alias `source_document_version_id` refs;
    2. delete attachments, product ops, links, profiles and doc aliases;
    3. delete chunks, pages, operations, versions and documents;
    4. reset product type to `seed_type`;
    5. bump `business.product_knowledge_revision` once.

    It returns 1 and carries `@check(expr: "this == 1")`.
  - Storage: `bucket.getFiles({ prefix: 'knowledge/<businessId>/' })` → delete each (ignore 404).
  - Extend the fake bucket in `tests/support/knowledge.ts` with `getFiles` / `delete` if absent.
- [ ] **Step 4: Run** the test, then `npm run generate:sdk -- --project demo-barberhq && npm run test:unit`. Expected: PASS; unit all green.

### Task 3: Operator product review and publication for product kinds

**Files:**
- Modify: `dataconnect/server/knowledge.gql` (`SetOperatorKnowledgePublishIntent`, `PublishKnowledgeVersion` actor clause)
- Modify: `dataconnect/server/product-knowledge.gql` (new `RecordOperatorProductReview`)
- Modify: `functions/src/knowledge/pipeline.ts` (+ `recordOperatorProductReview`)
- Modify: `functions/src/knowledge/repository.ts` (call for the mutation)
- Test: `tests/integration/knowledge-operator-product.test.ts`

**Interfaces:**
- Consumes: `productKnowledgeHash`, `passageKey` from `functions/src/knowledge/product-knowledge-rules.ts` / `-model.ts` (same hash the HQ accept uses).
- Produces: `KnowledgePipeline.recordOperatorProductReview(input: { versionId: string; productId: string | null }): Promise<{ reviewedHash: string }>`. The input is valid only after `recordReview` with an operator actor, before publish.
  - Card (`productId` set): one confirmed link for the whole first chunk (`start 0`, `end text.length`); all other chunks acknowledged unlinked; no profiles.
  - Catalog (`productId: null`): no links, `emptyKnowledgeAcknowledged: true`, every chunk acknowledged.
  - It sets `product_knowledge_reviewed_hash` and `product_knowledge_catalog_revision` to the business's current revision, and bumps `product_knowledge_revision` from 0 to 1.

- [ ] **Step 1: Write failing tests:**
  - `operator-reviewed card publishes with its product link`. Flow: stage → extract → `recordReview` (operator) → `recordOperatorProductReview({productId})` → `publishVersion`. Assert:
    - `isActive`;
    - one `knowledge_product_link` (confirmed, product id);
    - `business.product_knowledge_revision` +1;
    - no `product_alias` with that source.
  - `operator-reviewed catalog publishes with empty knowledge acknowledged`.
  - `operator publish of a card without product review is refused`: `publishVersion` throws `NOT_READY` or `STALE_STATE`, and nothing is published.
  - `operator product review is refused for an HQ-reviewed version and after publish`: `STALE_STATE`.
  - `procedure operator publish unchanged`: the existing `knowledge-publish.test.ts` passes.
- [ ] **Step 2: Run** `npm run test:integration -- tests/integration/knowledge-operator-product.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement**
  - `RecordOperatorProductReview` (NO_ACCESS, transaction): CAS on `reviewed_by LIKE 'operator:%'`, `published_at IS NULL`, `revoked_at IS NULL`, `product_knowledge_revision=0`, kind in product kinds. For a card, the product must belong to the business. It inserts the link.
  - `SetOperatorKnowledgePublishIntent`: product kinds allowed iff `productKnowledgeReviewedHash != null` and `productKnowledgeCatalogRevision == business.productKnowledgeRevision`. It then copies them into the `pending_product_knowledge_*` columns.
  - `PublishKnowledgeVersion`: the reviewed-hash branch accepts `EXISTS(actor) OR v.reviewed_by LIKE 'operator:%'`.
  - Regenerate the SDK.
- [ ] **Step 4: Run** the new test, `knowledge-publish`, `knowledge-lifecycle`, `product-knowledge-publication` and `product-card-attachment` integration suites, plus `npm run test:unit`. Expected: all PASS.

### Task 4: Rebuild + reset wiring

**Files:**
- Create: `scripts/seed/knowledge.ts`
- Modify: `scripts/seed/reset.ts` (call rebuild after product/alias reset; Storage + embedder deps; dry-run report)
- Modify: `dataconnect/server/seed.gql` (new `SeedProductCardAttachment`)
- Modify: `scripts/ingest/cli.ts` only if shared helpers move (behaviour unchanged)
- Test: `tests/integration/reset-knowledge.test.ts`, `tests/unit/reset-knowledge-plan.test.ts`

**Interfaces:**
- Consumes:
  - `readKnowledgeSeed` / `validateKnowledgeSeed` (Task 1);
  - `wipeKnowledge` (Task 2);
  - `recordOperatorProductReview` (Task 3);
  - `KnowledgePipeline`.
- Produces:
  - `rebuildKnowledge(deps: { dc: DataConnect; vectorDc: DataConnect; bucket: Bucket; embedder: Embedder; businessId: string; businessSeed: BusinessSeed }, dryRun: boolean): Promise<{ wiped: WipeCounts; ingested: string[]; cards: number; embeddingTexts: number }>`
  - `resetRecords(dc, businessId, dryRun, knowledge?: Omit<RebuildDeps,'dc'|'businessId'|'businessSeed'>)`. Without `knowledge` it behaves as today, so the existing reset tests keep passing.

- [ ] **Step 1: Write failing integration tests** (fake embedder, fake bucket, test receipts generated in the test from the real extraction hash):
  - `full reset leaves exactly the manifest documents`. Seed an extra HQ document and card attachment, then reset. Assert:
    - document codes equal the manifest codes;
    - each version's `objectPath` exists in the bucket with matching sha and generation;
    - demo-current versions are active and retired ones are not;
    - six `product_card_attachment` rows with status PUBLISHED, `[]` suggestions and the right product;
    - `searchChunks` returns a card chunk.
  - `repairs a manually deleted storage object`: delete one object, then reset. The object exists again.
  - `a failed rebuild completes on rerun`: the embedder throws on its 3rd call, so the reset rejects. A rerun reaches the same assertions as the first test.
  - `preflight failure deletes nothing`: remove one receipt. The reset rejects with `KNOWLEDGE_SEED_INVALID: <code> <version>: RECEIPT_MISSING`, and the row counts are unchanged.
  - `rerun is idempotent in outcome`: two resets give the same document codes, attachments and alias counts.
  - Unit test `dry-run reports wipe counts, entries and embedding text count without writes`.
- [ ] **Step 2: Run** both tests. Expected: FAIL.
- [ ] **Step 3: Implement** `rebuildKnowledge`:
  1. **Preflight:** run `validateKnowledgeSeed`; any problem → throw `KNOWLEDGE_SEED_INVALID: …` before any write.
  2. **Wipe:** run `wipeKnowledge`.
  3. **Ingest each entry in manifest order:**
     - `stageVersion`, then `extractVersion`;
     - assert the receipt's `extractionHash` equals the version's, else throw `KNOWLEDGE_EXTRACTION_CHANGED: <code>`;
     - `recordReview(receipt.review, receipt.actor)`;
     - for product kinds, `recordOperatorProductReview` (card → `${businessId}:${productDemoId}`, catalog → null);
     - publish if `demo-current`.
  4. **Attachments:** `SeedProductCardAttachment($businessId, $productId, $documentId, $versionId)` upserts with status `PUBLISHED`, suggestions `[]`, revision 1, and `actorUid 'seed'`.

  Wire into `resetRecords` after `runProductAliasSeed`. Rerun safety comes from wipe-first.

  In `resetDemo`, build the bucket, embedder and vector DC:
  - **Prod:** the bucket comes from config (`firebaseStorageBucket` in `config/knowledge-cloud.json`, as the ingest CLI does) and Vertex from `createEmbeddingConfig`.
  - **Local:** require `FIREBASE_STORAGE_EMULATOR_HOST` on loopback, use the bucket `demo-barberhq.appspot.com`, and use the same Vertex config.
  - The CLI prints the dry-run, including `embeddingTexts`.
- [ ] **Step 4: Run** the new tests and the existing `reset.test.ts`, `seed.test.ts`, `knowledge-*` and `product-*` integration suites, plus `npm run test:unit`, `npm run typecheck` and `npm run build:functions`. Expected: all PASS.

### Task 5: Owner approval of the six cards

**Files:**
- Create: `data/knowledge/reviews/CARD-NBS-{CEMENT-100,DRYMATT-100,MATOWA-100,MATTIFIER-100,SAVAGE-50,SOL-200}-v1.approval.json`
- Create: `data/knowledge/derived/CARD-…-v1-extraction.json` (from the ingest `extract` output format)

- [ ] **Step 1:** On the isolated stack, stage and extract each card. Write the derived extraction (pages markdown, chunks, `extractionHash`). Render each card's pages to PNG in the scratchpad and show them to the owner, with the page count.
- [ ] **Step 2:** Ask the owner per card (or all at once if they say so) for approval text. Stop until given.
- [ ] **Step 3:** Write the receipts in the CAT-001 format:
  - `actor {kind:'operator', id:<owner email as in CAT-001>, businessId}`;
  - `review {versionId, pdfSha256, extractionHash, reviewedPhysicalPages: all, approvalText: <owner's exact words>, approvedAt: '2026-10-29' or the day given}`.
- [ ] **Step 4: Run** `npx vitest run tests/unit/knowledge-seed.test.ts` with the `RECEIPT_MISSING` exception removed. Expected: PASS, with `validateKnowledgeSeed` returning `[]` for the real seed.

### Task 6: Docs, local run, prod rollout

**Files:**
- Modify: `docs/implementation/alias-backed-replenishment.md` (Seed section: reset now rebuilds knowledge)
- Create: `docs/implementation/full-demo-reset.md` (what is wiped, order, guards, dry-run, cost, rerun)
- Modify: `docs/implementation/deployment-runbook.md` (connector deploy before reset)

- [ ] **Step 1:** Run a local reset against the owner's emulators:
  ```sh
  DATA_CONNECT_EMULATOR_HOST=127.0.0.1:9399 FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199 \
    node --import tsx scripts/seed/reset.ts --project demo-barberhq --business not-bad-stuff-demo \
    --confirm not-bad-stuff-demo --quiescent --dry-run
  ```
  Then `--apply`. Expected: the dry-run lists the counts, and the apply succeeds. In the UI, every product shows its card and the Documents list shows the manifest only.
- [ ] **Step 2:** Write the docs.
- [ ] **Step 3: Prod (each needs explicit owner approval):**
  1. Connectors deploy (cloud SDK staging + `firebase deploy --only dataconnect`).
  2. Functions + web deploy if the shared pipeline changed.
  3. `reset.ts --project notbad-6be95 … --dry-run`; show the counts.
  4. `--apply`.
  5. Verify on the live product screens and Documents.
