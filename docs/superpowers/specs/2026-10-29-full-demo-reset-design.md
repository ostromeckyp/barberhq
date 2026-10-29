# Full demo reset: procedures, products and product cards from the repo

29 October 2026. Owner request: "Musimy mieć seed script, który wrzuci nam doci do storage i doda odnośniki w bazie, czyli pełny reset z procedurami, produktami i kartami produktów."

## Why

Today the demo reset (`scripts/seed/reset.ts`) restores stock, requests, products and aliases, but:

- it never touches documents, so a document deleted by hand (DB row or Storage object) stays broken;
- it deletes every product → card link (`product_card_attachment`), so after a reset the six published cards no longer belong to any product;
- the six product cards exist only on prod (uploaded through the UI), so a fresh environment has none.

Storage references cannot live in the seed: the bucket and `objectGeneration` differ per environment and are assigned on upload. The seed holds the stable identity (repo PDF path, sha256, document code, version, product). The reset uploads the PDF and writes the references.

## Goal

One reset command (the existing `scripts/seed/reset.ts`, same guards: approved project, exact business confirmation, `--quiescent`, `--dry-run` / `--apply`) brings the demo business to exactly the repo baseline:

1. Stock, requests, deliveries (existing).
2. Products and seed aliases (existing).
3. **Knowledge: wipe.** All of the business's knowledge goes: documents, versions, pages, chunks and embeddings, product knowledge (links, profiles, document-sourced aliases), card attachments, knowledge operation journals, and every Storage object under `knowledge/<businessId>/`. This includes documents HQ added in the UI (owner decision 29 Oct: full wipe).
4. **Knowledge: rebuild** from `data/knowledge/manifest.json`, in manifest order, for every entry (demo-current and retired, as today):
   - upload the repo PDF to Storage at the path the app already uses (`knowledge/<businessId>/<code>/<version>/<sha>.pdf`) and record `bucket`, `objectPath`, `objectGeneration`;
   - extract locally (pdfjs, deterministic);
   - record review from the approval receipt in `data/knowledge/reviews/<code>-<version>.approval.json`;
   - for a product card: link the whole card to its product (the same one-passage link the UI makes); no model call and no generated aliases;
   - publish demo-current entries (Vertex embeddings); retired entries stay retired as today.
5. **Card attachments.** Each product with a card gets its `product_card_attachment` row: status PUBLISHED, no suggestions, pointing at the rebuilt version.

After a reset, every reference in the DB points at an object the same run uploaded. There are no dangling references.

## Seed data

- `data/knowledge/manifest.json` gains six entries, one per card in `data/knowledge/pdfs/product-cards/`:
  - `kind: "product-card"`, `origin: "public-compilation"`, `language: "pl"`;
  - title `<product name> — karta produktu` (as the UI names it);
  - `sourceUrls: [product sourceUrl]`, `observedOn` from the product;
  - sha256 of the repo file;
  - new field `productDemoId` naming the product.

  `productDemoId` is required for `product-card` and forbidden for other kinds. Each seeded product has at most one card.
- Six approval receipts `data/knowledge/reviews/CARD-…-v1.approval.json` in the CAT-001 format. The owner approves the pages in chat after seeing them (owner decision 29 Oct). Nobody writes these receipts on the owner's behalf.
- Aliases stay on products in the business seed (owner decision 28 Oct). Card-generated suggestions are not part of the seed.

## Safety

- **Preflight before anything is deleted:**
  - every manifest PDF exists and matches its sha256;
  - every entry has a receipt whose versionId and pdfSha256 match;
  - every `productDemoId` exists in the business seed.

  Any failure aborts with nothing changed.
- The extraction hash is checked against the receipt after extraction. A mismatch stops the run with a clear error naming the document. This should not happen, because extraction is deterministic.
- **Rerunnable.** A run that fails part-way, for example on a Vertex error, leaves a business that the next `--apply` brings to the baseline. It never leaves a half-linked state that blocks a rerun.
- **Dry-run** prints: documents, versions, chunks, card attachments and Storage objects to delete; entries to ingest; the expected number of embedding calls.
- Prod: running `--apply` on `notbad-6be95` is a prod write and needs the owner's explicit approval each time, as now. Vertex cost is about one embedding per chunk across all manifest documents.
- **Local:** requires the Data Connect and Storage emulators on loopback. Embeddings use the same approved Vertex runtime the local Functions use. The reset never runs at app startup.
- No application code learns a document or product. Everything comes from the manifest, the receipts and the business seed.

## Non-goals

- No backup or export of documents HQ added in the UI. They are deleted.
- No model calls (alias generation) during reset.
- No UI change. No new callable. The reset stays a CLI and test fixture.
- No scheduler or automatic reset.

## Anti-goals

- A reset that deletes and then fails without a rerun path.
- A DB reference to a Storage object the run did not upload.
- Card or document data hard-coded in app logic.

## Left to the builder

- Deletion order inside the knowledge wipe (FKs, vector rows), as one or more native SQL mutations bound to the business.
- Reusing `KnowledgePipeline` (`stageVersion` / `extractVersion` / `recordReview` / `publishVersion`) and extending the operator publish path to satisfy product-card publication (product-knowledge reviewed hash), instead of a parallel pipeline.
- How `scripts/ingest/cli.ts` shares that code. One-document ingest stays available.
- Isolated SQL integration test:
  - seed with UI-like extra documents and a card attachment;
  - delete a Storage object by hand;
  - reset;
  - assert: only manifest documents remain, each with a live object of matching sha and generation; every seeded card linked to its product; search returns card chunks; rerun is a no-op in outcome.

  Use the fake embedder in tests.

## Calls I made (owner may override)

- The product link lives in the manifest entry (`productDemoId`), not on the product in the business seed. All document data stays in one file.
- Retired manifest entries (DAM-001 v0) are rebuilt as retired, as the manifest says.
- Local reset uses the real Vertex runtime, because local Functions already do. Tests use the fake embedder.
