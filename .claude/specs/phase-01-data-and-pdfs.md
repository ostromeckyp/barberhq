# Spec: Phase 1 — product fixtures and source PDFs

> Prepare a reviewable catalog, fictional stock fixtures and clearly labeled PDFs without touching cloud data.

## Background

Read `docs/implementation/shared-contracts.md`, `docs/not-bad-stuff-products.json`, `docs/04-not-bad-stuff-catalog.md` and `docs/synthetic-knowledge/README.md`. Six real products were already collected using Chrome on 22 September 2026. Reuse that snapshot; a refresh is optional, not a prerequisite.

Read the [approved design extensions](approved-design-extensions.md) for this phase’s approved batch, document-library and PDF-geometry responsibilities.

## Requirements

1. Validate all six product records and preserve source URLs, observation dates, website code strings and local demo IDs. If refreshing, scrape only the listed public product pages with Firecrawl if available, otherwise Chrome. Inspect actual page status and content; an extraction-service success is not proof of a valid product page. Record the method/date and review changes before replacing the snapshot.
2. Keep net contents separate from physical packaging dimensions. Leave unknown weight, dimensions and transfer pack size null. Public retail PLN prices are not wholesale prices; stock quantities and policies are invented. Store money as integer grosz in the eventual seed representation.
3. Create deterministic fictional stock fixtures for HQ and the three salons across six products. Set HQ Matowa to 18 and Legnicka Matowa to 2, with zero reservations and no active transfers. Record every other quantity as synthetic. Keep damaged delivery DEMO-DAMAGE-01 as a separate scenario fixture, not a received transfer.
4. Reuse the existing three current procedure Markdown files and retired DAM-001 v0. Create one concise product-guide Markdown file summarizing the six catalog entries with source URLs and observation dates. Do not invent medical claims, chemical/disinfection instructions or official internal policies.
5. Export five simple text-based PDFs: three current procedures, one retired procedure and the public product guide. Use a PDF-capable tool/skill and a font supporting Polish characters. Put the synthetic-policy or unofficial-product-compilation label on every page, plus document ID/version and page numbers. Preserve headings, procedure steps and source references.
6. Create a manifest conforming to the shared contract. For the product guide use document ID CAT-001, v1, sourceType public-product-summary, synthetic false; explain that the compilation/layout is demo-created and not an official company document. Four procedure PDFs remain synthetic true. Include content hashes after export.
7. Inspect the handoff sample `design_handoff_barberhq/docs/damaged-delivery-v1.2.pdf` as a design reference; do not silently replace canonical DAM-001 v1 or assume its page numbers. Prepare a separate synthetic replacement-version fixture for publication/deletion tests, outside the initial five-PDF active manifest. Include a multiline citation for geometry checks.
8. Render and visually inspect every PDF page; verify text extraction, Polish accents, section order and labels. Record review evidence and outputs in the phase-01 handoff. Do not embed or upload yet.

## Affected Files

| File | Change type | Description |
|---|---|---|
| `data/seed/` | Create | Validated product/location/stock/scenario fixtures |
| `docs/synthetic-knowledge/product-guide-v1.md` | Create | Public-source product guide, distinct from fictional policies |
| `data/knowledge/pdfs/` | Create | Five reviewed PDF artifacts |
| `data/knowledge/manifest.json` | Create | Explicit ingestion allowlist and provenance |
| `scripts/prepare-data/` | Create | Reproducible validation/export commands |
| `docs/implementation/handoffs/phase-01.md` | Create | Counts, hashes and PDF review evidence |

## Existing Patterns to Reuse

- Existing catalog JSON and procedure documents are the source assets; do not rewrite the business scenario.
- The evaluation table in the knowledge README defines expected procedure behavior; never export it into the corpus.

## Constraints

- No live website inventory assumptions, login scraping, cloud writes or embedding calls.
- Firecrawl is an optional preparation tool; it is not installed or used as part of this specification. Its official scrape guide is https://docs.firecrawl.dev/features/scrape .

## Open Questions

No owner decision blocks this phase. Use the dated six-product snapshot unless a refresh is explicitly included in the implementation task.

## Acceptance Criteria

- [ ] Six products, four locations and explicit fictional stock fixtures validate; required 18/2 quantities match.
- [ ] Five PDFs have correct labels, readable text, correct Polish characters and recorded visual review.
- [ ] Manifest includes four synthetic procedures (one retired) and one unofficial factual guide; each hash matches its PDF.
- [ ] Handoff sample review is recorded; replacement fixture and cited-region test passages are clearly identified.
- [ ] Rerunning preparation does not duplicate records or silently change approved artifacts.
