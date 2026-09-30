# BarberHQ 3A — One PDF to a highlighted source Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish reviewed DAM-001 v1 and open an actual extracted passage in its immutable PDF.

**Architecture:** One TypeScript extraction core is shared by operator ingestion and the future task worker. Storage retains original bytes; PostgreSQL retains text, geometry and embeddings; Angular renders the authorized original.

**Tech Stack:** Private Firebase Storage, Data Connect/pgvector, pdfjs-dist, Genkit embedding provider, TypeScript; local PDF export tooling.

**Spec:** [Approved delivery design](../specs/2026-09-29-barberhq-delivery-design.md), increment 3A; phase1 PDF requirements, phase3 extraction/publication, phase4 viewer, approved extensions §4.

**Status:** Ready for user review; execution not authorized by this file. Read [execution index](2026-09-29-barberhq-execution-index.md) for command conventions and shared types.

## Global Constraints

- Use Angular SPA, Firebase Auth, classic Firebase Hosting, SQL Connect (formerly Data Connect) with Cloud SQL PostgreSQL/pgvector, private Firebase Storage, and server-side Genkit/Gemini.
- AI does not mutate stock. The browser never connects directly to PostgreSQL or receives backend credentials.
- Business external key: `not-bad-stuff-demo`. Preserve the six `demoId` values in `docs/not-bad-stuff-products.json`.
- Integer units only; request quantities are 1–99. Persisted states: `PENDING_APPROVAL`, `RESERVED`, `DISPATCHED`, `RECEIVED`, `REJECTED`.
- No Firestore, SSR, Nx, additional vector database or persistent chat. Keep `.claude/specs/` in place.
- English UI; synthetic procedures visibly labeled. HTML/support.js remain unchanged design references.
- Run only the selected task/plan. Planning files describe future commands; none has been run as proof of implementation.

## Review Focus

- Multiline text with Polish accents must retain both readable text and correct rectangles (tasks 1–2).
- An image-only or mixed incomplete PDF must not pass publication review (task 2).
- Reusing the same version with changed bytes must conflict, not replace existing evidence (task 3).
- A URL with another chunk/version or incorrect page must not show misleading evidence (task 4).
- Cropping, rotation and zoom must transform highlights with the rendered page (task 4).

---

## Prerequisites and file responsibilities

Requires the foundation and stock reports. Local PDF generation/extraction can run before cloud configuration; publication requires private Storage and verified embedding access.

- `scripts/prepare-data/export-pdfs.py`: local authoring export; use the applicable PDF skill during execution and pin the chosen Python tooling.
- `functions/src/knowledge/extract.ts`, `chunk.ts`: shared production extraction core, called by operator wrapper; no second Python ingestion implementation.
- `shared/contracts/knowledge.ts`: source identity/text/geometry DTOs; functions-only vector/provider configuration stays server-side.
- `scripts/ingest/cli.ts`: explicit stage/review/publish commands using the same pipeline as later HQ ingestion.
- `features/procedures/pdf-viewer/`: canvas, text/excerpt and transformed overlay; `KnowledgeApi` handles authenticated bytes.

Use pdfjs-dist as the planned parser and viewer baseline; verify its pinned Node/Functions compatibility with a small real PDF before expanding work. Unsupported parser/runtime behavior blocks this path until resolved explicitly, not silently published.

### Task 1: Canonical PDF and adversarial geometry fixtures

**Files:**
- Create: `scripts/prepare-data/export-pdfs.py`, `scripts/prepare-data/requirements.txt`, `data/knowledge/pdfs/DAM-001-v1.pdf`, `data/knowledge/manifest.json`.
- Create: `tests/fixtures/pdf/geometry.pdf`, `tests/fixtures/pdf/scanned.pdf`, `tests/fixtures/pdf/mixed.pdf`, `tests/unit/pdf-manifest.test.ts`.
- Create: `data/knowledge/reviews/DAM-001-v1.md`.
- Read only: `docs/synthetic-knowledge/damaged-delivery-v1.md`, handoff sample PDF.

**Interfaces:**
- Consumes: canonical authoring Markdown and existing manifest field contract.
- Produces `npm run prepare:pdfs -- --document DAM-001 --version v1` via the root script invoking the pinned exporter.
- Manifest uses the existing fields; a one-document interim manifest contains DAM-001 v1 until 3B expands it. `geometry.pdf` is a test-only artifact excluded from ingestion allowlists.

- [ ] **Step 1: Write the behavioral checks.** Test `canonical_pdf_matches_manifest` with byte/hash/text checks:
```ts
expect(manifest[0]).toMatchObject({documentId:'DAM-001',version:'v1',synthetic:true,publicationStatus:'demo-current'});
expect(sha256(pdfBytes)).toBe(manifest[0].sha256);
expect(pdfBytes.subarray(0,5).toString()).toBe('%PDF-');
```
Export a test PDF containing known multiline accented text, a rotated page, a nonzero crop origin and an optional printed label distinct from its physical page. The test-only scan/mixed fixtures contain visible content that text extraction cannot fully recover.

- [ ] **Step 2: Confirm the relevant check fails.** Run `npm run test:unit -- tests/unit/pdf-manifest.test.ts`. Expected: a failing named behavior before implementation; repair missing test infrastructure first, because an unavailable runner is not behavioral evidence.

- [ ] **Step 3: Implement the task.** Read the PDF skill before creating/inspecting PDF artifacts. Export simple text/heading pages with embedded Polish-capable font, visible “Synthetic demo procedure”, document ID/version and physical page numbering. Preserve canonical text and negations. Inspect handoff v1.2 as a reference and record differences without replacing v1. Make export reproducible (fixed metadata, stable layout); record tool/font versions and hashes. Render every page and record actual visual checks in the review file. Keep derived exports separate from authoring Markdown and preserve already approved byte identities on rerun.

- [ ] **Step 4: Verify the deliverable.** Manifest unit test PASS; extraction can read accents and every rendered page is visually reviewed. Repeated export has identical hash, or a documented exporter nondeterminism is fixed before accepting immutable fixtures. No Storage/embedding call in this task.

- [ ] **Step 5: Record and commit.** Record real results in the increment handoff. Stage only this task’s named files after checking for secrets, then `git commit -m "chore: prepare canonical PDF and geometry fixtures"`. See index for initial Git setup; never claim a commit if unavailable.

### Task 2: Page-aware extraction and chunk mapping

**Files:**
- Create: `shared/contracts/knowledge.ts`, `functions/src/knowledge/pdf-validation.ts`, `functions/src/knowledge/extract.ts`, `functions/src/knowledge/chunk.ts`.
- Create: `tests/unit/pdf-extraction.test.ts`, `tests/unit/pdf-chunks.test.ts`.
- Modify: `functions/package.json` and lockfile; root tooling package/lockfile for operator imports.

**Interfaces:**
- Produces `validatePdf(bytes:Uint8Array):Promise<{pageCount:number}>`, `extractPdf(bytes:Uint8Array):Promise<ExtractedDocument>`, `chunkPages(doc:ExtractedDocument):KnowledgeChunkDraft[]`.
- Types are defined in the index; retain span-to-normalized-text mappings and physical-page geometry. `GeometryStatus = 'VERIFIED'|'UNAVAILABLE'`; extraction verification does not replace human review.
- `chunkPages` uses title/heading/page-local text, target maximum approximately 350 tokens, preserves logical section IDs across pages and unique page-local chunk identities.

- [ ] **Step 1: Write the behavioral checks.** Tests `retains_polish_negation_and_geometry`, `does_not_cross_pages`, `holds_scanned_and_mixed_input`:
```ts
expect(doc.pages[0].text).toContain('Łódzka');
expect(doc.pages[0].physicalPage).toBe(1);
expect(chunks.every(c => c.end <= doc.pages[c.page-1].text.length)).toBe(true);
expect(chunks.every(c => c.text === doc.pages[c.page-1].text.slice(c.start,c.end))).toBe(true);
expect(scanned.quality).toBe('NEEDS_REVIEW');
expect(mixed.quality).toBe('NEEDS_REVIEW');
```
Check exact expected source sentences including “not”; reject encrypted, malformed, >10MiB and >30-page inputs. Assert multiline chunks have multiple valid rectangles within their page view box and no chunk contains text from two pages.

- [ ] **Step 2: Confirm the relevant check fails.** Run `npm run test:unit -- tests/unit/pdf-extraction.test.ts tests/unit/pdf-chunks.test.ts`. Expected: a failing named behavior before implementation; repair missing test infrastructure first, because an unavailable runner is not behavioral evidence.

- [ ] **Step 3: Implement the task.** Disable PDF JavaScript/action execution; parse bounded bytes using pinned pdfjs-dist. Extract spans/page geometry, normalize conservatively and carry original coordinates through normalization. Store rectangles in unrotated PDF user space; do not infer coordinates from final Markdown character counts. Keep headers/footers unless removal retains reviewable mapping. Image-only, mixed, complex or incomplete extraction remains NEEDS_REVIEW and cannot be marked complete by a generic approval. Blank separator pages need explicit recorded review. Use the same module in operator and deployed runtime; no LLM extraction or OCR fallback.

- [ ] **Step 4: Verify the deliverable.** Both suites PASS in the selected Node runtime. Compare extracted text with every canonical rendered page. Confirm geometry fixture overlays visually using an independent rendered-page reference in task4; numerical self-consistency alone is insufficient.

- [ ] **Step 5: Record and commit.** Record real results in the increment handoff. Stage only this task’s named files after checking for secrets, then `git commit -m "feat: extract traceable PDF text and geometry"`. See index for initial Git setup; never claim a commit if unavailable.

### Task 3: Private originals, embeddings and guarded publication

**Files:**
- Create: `dataconnect/schema/knowledge.gql`, `dataconnect/server/knowledge.gql`, `functions/src/knowledge/repository.ts`, `functions/src/knowledge/pipeline.ts`, `functions/src/knowledge/embedding.ts`, `scripts/ingest/cli.ts`, `scripts/ingest/review.ts`, `storage.rules`.
- Create: `scripts/checks/embedding.ts`, `tests/integration/knowledge-publish.test.ts`, `tests/integration/vector-scope.test.ts`.
- Modify: `firebase.json`, `functions/src/index.ts`, generated SDK configurations; owner setup guide for verified values.
- Derived: `data/knowledge/derived/` (operator text/maps/review hashes; no credentials).

**Interfaces:**
- `EmbeddingConfig = {provider:'vertex';modelId:string;dimension:number;documentMode:string;queryMode:string;location:string;configHash:string}`; actual values are recorded only after provider verification.
- `embedTexts(texts:string[],mode:'document'|'query'):Promise<number[][]>`; `stageVersion(input:ManifestEntry,bytes:Uint8Array):Promise<string>`; `extractVersion(versionId:string):Promise<ProcessingResult>`; `recordReview(input:ReviewInput,actor:ActorContext):Promise<void>`; `publishVersion(input:PublishInput):Promise<ProcessingResult>`.
- `ReviewInput = {versionId:string;extractionHash:string;reviewedPhysicalPages:number[]}`; `PublishInput = {versionId:string;expectedDocumentRevision:number}`. `ProcessingResult` is in the index. Operator calls use explicit scoped operator context, not fabricated staff UIDs.

- [ ] **Step 1: Write the behavioral checks.** Tests `immutable_version_conflicts`, `incomplete_review_does_not_publish`, `failed_embedding_preserves_active_version`, `scope_filters_before_top_k`:
```ts
expect(await h.activeVersion('DAM-001')).toBe(publishedId);
await expect(h.stageSameVersion(changedBytes)).rejects.toMatchObject({code:'VERSION_CONFLICT'});
await expect(h.publishWithoutAllPagesReviewed()).rejects.toThrow();
expect(await h.activeVersion('DAM-001')).toBe(publishedId);
expect((await h.searchAsSalon(queryVector)).every(c => c.businessId === h.businessId && c.versionId === publishedId)).toBe(true);
```
Deliberately place a closer foreign/retired vector ahead of an eligible record to prove filtering is inside similarity retrieval. Reject wrong-dimensional/non-finite vectors; interrupted staging must remain ineligible.

- [ ] **Step 2: Confirm the relevant check fails.** Run `npm run test:integration -- tests/integration/knowledge-publish.test.ts tests/integration/vector-scope.test.ts`. Expected: a failing named behavior before implementation; repair missing test infrastructure first, because an unavailable runner is not behavioral evidence.

- [ ] **Step 3: Implement the task.** Owner provisions private bucket/model API/IAM. Run `npm run check:embedding` to make real document/query calls, verify finite dimensions and compatibility; record actual config before compiling vector schema. Use supplied explicit vectors consistently. Add KnowledgeDocument/Version/Page/Chunk with revision/revocation/review/provenance fields from architecture; include server-only retrieval with eligibility predicates and max3 cosine results. Upload hash-addressed immutable bytes with generation preconditions; store bucket/path/generation/hash. Operator CLI exposes stage, extract, review and publish as separate steps: no automatic human review. Publish only reviewed complete vectors in a guarded transaction. Keep retired publication separate from processing readiness. Storage direct client rules deny all; scope server IAM.

- [ ] **Step 4: Verify the deliverable.** Embedding preflight and both deployed suites PASS; one current canonical document has immutable original plus readable chunks and vectors. Operator rerun creates no duplicates, changed bytes conflict, and failed publication preserves prior active pointer. Record counts/hashes/model configuration and derived page map.

- [ ] **Step 5: Record and commit.** Record real results in the increment handoff. Stage only this task’s named files after checking for secrets, then `git commit -m "feat: publish reviewed PDF knowledge privately"`. See index for initial Git setup; never claim a commit if unavailable.

### Task 4: Authorized source endpoint and highlighted Angular viewer

**Files:**
- Create: `functions/src/knowledge/source.ts`, `dataconnect/browser/knowledge.gql`, `web/src/app/core/knowledge-api.ts`.
- Create: `web/src/app/features/procedures/pdf-viewer/pdf-viewer.component.ts`, `pdf-overlay.ts` in the same directory.
- Test: `tests/integration/source-access.test.ts`, `tests/e2e/pdf-viewer.spec.ts`, `web/src/app/features/procedures/pdf-viewer/pdf-overlay.spec.ts`.
- Modify: `web/src/app/app.routes.ts`, public config/Functions exports; create `docs/implementation/handoffs/increment-3a.md`.

**Interfaces:**
- HTTP `getSourcePdf`: accepts only versionId, verified Auth/App Check headers and exact allowed origins; resolves stored object identity on server.
- `GetSourceSection` accepts versionId and optional chunkId: return authorized document metadata plus nullable chunk details. A supplied chunk must belong to the version; its page overrides conflicting URL page. Without a chunk, return metadata for page-only navigation.
- `KnowledgeApi.getSource(versionId:string,chunkId:string):Promise<SourceSection>` and overload `getSource(versionId:string):Promise<DocumentSource>`, `getPdf(versionId:string):Promise<Uint8Array>`; source DTOs in the index.
- `projectRect(rect:PdfRect,viewport:PdfViewport):ScreenRect` uses pdfjs `convertToViewportRectangle`; type-only adapter defines `PdfViewport` by that method and ScreenRect `{left,top,width,height}`.

- [ ] **Step 1: Write the behavioral checks.** Tests `rejects_foreign_and_revoked_pdf`, `chunk_page_is_authoritative`, `overlay_tracks_actual_text`:
```ts
await expect(h.getPdfAsForeign(versionId)).rejects.toThrow();
expect((await h.getSource(versionId,chunkId)).physicalPage).toBe(actualPage);
await expect(page.getByTestId('pdf-page-number')).toHaveText(String(actualPage));
await expect(page.getByText('Exact highlight unavailable', {exact:true})).toBeVisible(); // no-geometry fixture
```
Test direct deep link with mismatched page query, mismatched chunk/version rejection, expired auth, missing App Check and denied CORS. Render the known multiline fixture at 100%/150% and rotations0/90 plus cropped origin; visually compare overlay against actual text, not hardcoded page2.

- [ ] **Step 2: Confirm the relevant check fails.** Run `npm run test:integration -- tests/integration/source-access.test.ts`. Expected: a failing named behavior before implementation; repair missing test infrastructure first, because an unavailable runner is not behavioral evidence.

- [ ] **Step 3: Implement the task.** Stream bounded original bytes after SQL permission checks, with application/pdf and private,no-store. Allow published historical versions and scoped HQ staged preview, deny revoked. Do not expose storage paths/public tokens. Fetch full bounded bytes in Angular; use local pinned PDF.js worker and same viewport for canvas/overlay. Clean up render tasks, bytes and object URLs on navigation/sign-out. Support page/zoom controls, authoritative chunk page and page-only library links. Display provenance/version/excerpt and explicit geometry fallback. Authorized download is permitted; never bypass authorization to recover a failed preview.

- [ ] **Step 4: Verify the deliverable.** Source integration, overlay unit tests and `npm run test:e2e -- tests/e2e/pdf-viewer.spec.ts` PASS; record screenshots/visual review at desktop/mobile and zoom/rotation. On Hosting, refreshing a real source URL preserves identity and highlight. Report one-document success separately from full corpus completion.

- [ ] **Step 5: Record and commit.** Record real results in the increment handoff. Stage only this task’s named files after checking for secrets, then `git commit -m "feat: open authorized PDF citations with highlights"`. See index for initial Git setup; never claim a commit if unavailable.

## Completion and next context

Increment-3a report records parser/runtime/model config, bucket generation/hash, review evidence, chunk/source IDs and a verified source deep link. Next: plan3B plus this report and approved extensions §2. Do not hardcode the example’s actual page number into application behavior.
