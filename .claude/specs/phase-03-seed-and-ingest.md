# Spec: Phase 3 — seed PostgreSQL and ingest PDFs

> Load structured demo records into SQL and publish a traceable PDF-derived knowledge corpus.

## Background

Read shared contracts, phase-01 and phase-02 handoff reports, and architecture section 8. Initial preload uses the reviewed phase-01 manifest and compiled phase-02 operator interfaces. HQ uploads use server-registered metadata and the same pipeline. Provisioned Storage, SQL Connect and embedding access are prerequisites for cloud loading.

Read the [approved design extensions](approved-design-extensions.md) for this phase’s approved batch, document-library and PDF-geometry responsibilities.

## Requirements

1. Validate the explicit target project/business and provide a dry-run summary before writing. Upsert products, locations and initial inventory by stable external keys; load membership assignments from a local ignored UID mapping. Ordinary reruns must not reset stock or erase requests. Provide a separate explicit reset command scoped to demo business operational records, refusing non-demo targets.
2. Validate each PDF against its manifest, file signature, 10 MiB/30-page demo limits and hash. Upload under an immutable document/version/hash path, recording exact object generation. Same version with different bytes is a conflict. Reject encrypted/malformed PDFs; hold unsupported scanned or complex layouts for review.
3. Extract the exact stored PDF version page by page, using pinned tooling. Normalize to Markdown while retaining a separate machine-readable page map with one-based physical page numbers, offsets, PDF view boxes/user units/rotation and text-span coordinates. Maintain this mapping through Markdown normalization. Operator runs store derived artifacts locally under data/knowledge/derived/ with parser version and hashes; deployed jobs keep authoritative page/chunk text, geometry, hashes and review coverage in SQL. Worker temporary files are disposable; durable progress must survive retries. Do not ingest the original authoring Markdown instead.
4. Review extraction against every rendered PDF page, retaining negations, step order and headings. Mark uncertain/mixed scanned pages NEEDS_REVIEW; do not silently publish incomplete text. Record reviewed page coverage.
5. Create page-local chunks from headings/paragraphs, initially capped near 350 tokens; overlap only within one page. Store section IDs, normalized page-text offsets, titles, readable text and extraction-derived bounding rectangles in unrotated PDF user space. Validate multiline/zoom/rotation mapping; never invent coordinates. Embed title + heading + chunk using the pinned model/configuration. Validate finite numeric values and exact dimensions for every vector.
6. Stage KnowledgeDocument/Version/Page/Chunk records with extraction/embedding provenance. Verify all artifacts before marking READY and atomically selecting a document’s active version. Retain retired DAM-001 v0 as a fully ingested negative fixture without making it active. Failure or interrupted work must preserve the previous published version.
7. Implement a reusable bounded task queue ingestion worker used by HQ upload/review/retry APIs. Extract first, stop for human review, then embed/publish after review authorization. Recheck revocation and captured document revision before publication. Track failures and resumable progress in SQL; cap attempts/concurrency and prove queue retry safety. Share core processing code with operator ingestion.
8. Make retries idempotent by business/document/version/hash and record partial progress without exposing partial versions to retrieval. Verify filtered vector retrieval can return current authorized evidence and excludes retired/foreign records. Record counts, published version IDs and citation page mapping; do not build the answer flow yet.

## Affected Files

| File | Change type | Description |
|---|---|---|
| `scripts/seed/` | Create | Dry-run, scoped upsert and explicit demo reset |
| `scripts/ingest/` | Create | Operator wrapper around shared ingestion pipeline |
| `functions/src/knowledge/` | Create | Reusable extraction/geometry pipeline, task worker, review and publication |
| `data/knowledge/derived/` | Create | Extracted Markdown, page maps and review manifests |
| `docs/implementation/handoffs/phase-03.md` | Create | Seed counts, object identities, active versions and retrieval checks |

## Existing Patterns to Reuse

- Reuse phase-01 fixtures/PDF manifest and phase-02 generated operator SDK.
- Reuse architectural staged publication; Storage and SQL cannot share a transaction.

## Constraints

- Never commit credentials, private UID mappings or raw tokens in reports.
- No OCR, automatic background Storage trigger or managed web crawling at runtime. The worker is explicitly enqueued by trusted document commands; Angular upload/review UI belongs to phase 4.
- Procedure vectors are derived search data, never the source of inventory quantities.

## Open Questions

No new business decision is needed. Resolve model availability/dimension in phase 2 before creating vectors; unavailable model access blocks embedding/publication, not extraction.

## Acceptance Criteria

- [ ] SQL contains six products, four locations and scoped memberships; initial Matowa figures match and ordinary reruns preserve changed stock.
- [ ] Five original PDFs are private and hash-verified; four versions are active and DAM-001 v0 is retired.
- [ ] Every indexed chunk maps to reviewed text and a physical page of the exact stored PDF; rehearsed citations have verified rectangles.
- [ ] HQ import/review/replacement/deletion and interrupted worker retries preserve publication invariants; revoked versions cannot be resurrected.
- [ ] Interrupted/repeated ingestion creates no duplicate published chunks and leaves the prior active corpus usable.
- [ ] Retired, incomplete and foreign-business test content never appears in eligible retrieval results.
