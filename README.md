# DevFest demo: BarberHQ

Updated 25 October 2026: login, inventory, manual replenishment, the document library, both AI assistants and unified Back buttons are published on [production](https://notbad-6be95.web.app), version `4b833190c12b9244`. The foundation preview serves the same verified version. Controlled rollback/restoration preserved scoped data. Two authorized reset-based rehearsals completed stock correctly; the first full run passed in 5:23, while the second hit a real RAG timeout twice. Knowledge and seven original PDF metadata snapshots survived both resets unchanged. Three genuine offline fallback images now exist. [Single-function diagnostics are published](docs/implementation/rag-phase-diagnostics-2026-10-25.md): one production question passed in5.32s. Timeout cause, preview App Check and an unset→20 max-instance difference remain open, along with final demo acceptance. [Rehearsal report](docs/implementation/demo-rehearsal-2026-10-25.md) · [Current handoff](docs/implementation/handoffs/increment-5.md) · [59-item acceptance index](docs/implementation/acceptance-coverage.md) · [Local72/72 verification and prepared contrast fix](docs/implementation/demo-local-verification-2026-10-25.md) · [Delivery exceptions / Firebase notifications](docs/implementation/future-work.md).

**Confirmed demo: two use cases for Not Bad Stuff.**

1. **Replenishment:** Legnicka requests two Pomada Matowa units; HQ approves and dispatches; Legnicka confirms receipt. HQ stock 18 → 16, salon stock 2 → 4. Requested 2 / received 2.
2. **Damaged delivery guidance:** a separate staff question retrieves instructions and citations from synthetic procedures. Read-only; no automatic stock adjustment or replacement.

The business outcomes are a completed stock movement and access to relevant operating knowledge.

Start with the [master project specification](.claude/specs/barberhq-master.md) for the purpose, component relationships and links to each implementation phase.

**Implementation planning:** the user approved five working increments. The [delivery design](docs/superpowers/specs/2026-09-29-barberhq-delivery-design.md) is accepted for planning. The [master execution index and seven detailed plans](docs/superpowers/plans/2026-09-29-barberhq-execution-index.md) are being executed in Native mode, starting with increment 1 in the existing DevFest folder. They preserve the existing phase requirements.

## Deliverables

1. [Candidate comparison and technical feasibility](docs/01-research-and-recommendation.md)
2. [Application implementation specification](.claude/specs/barberhq-replenishment-assistant.md)
3. [Slide content and speaker notes — 20 minutes](docs/02-slide-outline.md)
4. [Live demo script, fixtures, and rehearsal checklist](docs/03-demo-runbook.md)
5. [Six real Not Bad Stuff products and source notes](docs/04-not-bad-stuff-catalog.md) · [structured catalog snapshot](docs/not-bad-stuff-products.json)
6. [Synthetic RAG documents and evaluation cases](docs/synthetic-knowledge/README.md)
7. [How: architectural design](docs/05-architecture-how.md)
8. [Phased implementation handoffs](docs/implementation/README.md)
9. [Firebase setup guide for the presenter](docs/06-firebase-setup-guide.md)
10. [Firebase Hosting deployment specification](.claude/specs/firebase-hosting-deployment.md) — phase 4 build/configuration and phase 7 preview, release and rollback
11. [UI views, elements and states — design handoff (Polish)](docs/design/views-and-states.md)
12. [Approved Claude Design scope](.claude/specs/approved-design-extensions.md) — multi-product drafts, HQ document library, low-stock marker and PDF citation highlights; [design reference](design_handoff_barberhq/SPEC.md)

For implementation, read the master specification and delivery design first, then use the selected reviewed increment plan, shared contracts, relevant phase requirements and prerequisite reports. Read the research for rationale, the specification for requirements, and the architectural design for implementation boundaries and execution flows. Slide content is Markdown for a future deck, not a generated presentation.

## Confirmed context and proposed technical decisions

- Angular, Firebase Authentication, Firebase SQL Connect / Cloud SQL PostgreSQL, pgvector, Gemini through Genkit, Cloud Functions, Firebase Hosting.
- Real cosmetics brand: **Not Bad Stuff**. Real salons: **Legnicka, Łódzka, Zakładowa**. Scope: one demo warehouse; multi-product drafts create one atomic request containing all items.
- AI interprets language, selects read tools, and explains evidence. Ordinary code calculates quantities. Staff explicitly approve, dispatch and receive the transfer. RAG supports the separate procedure question; it is not required for stock arithmetic.
- Store original procedure PDFs in private Firebase Storage; normalize extracted PDF text to page-aware Markdown, then keep indexed text and embeddings in PostgreSQL. Preloaded text PDFs and HQ upload/review/replacement/deletion are in scope. Preserve page geometry for citation highlights; OCR remains deferred.
- Use SQL Connect's vector search to match the supplied abstract. Firestore Vector is a documented alternative, not a second required database.
- Seeded fictional stock and policies; no carrier booking, WhatsApp integration, production scheduling, or claims of measured business savings.

## Before live business use

Replenishment is confirmed as the demo. Validate the remaining operational rules with the business owner. In particular: are stock counts trustworthy, who confirms dispatch/receipt, and which approved procedures will replace the synthetic corpus? Individual-unit transfers are the chosen demo assumption. SQL Connect/pgvector is the implementation baseline; requiring Firestore would be an explicit change. The documents use explicit demo assumptions until those answers are available.

Research checked on **22 September 2026** using Context7 and official Firebase/Genkit documentation. Feasibility is documentation-based; deployment, model availability, and concurrency behavior still need the small validation steps listed in the research.

The phased handoffs and owner setup guide were added on **27 September 2026**. On **29 September 2026**, the Claude Design handoff and its intentional product extensions were incorporated into the specs. Canonical PDFs, ingestion and application increments have since been implemented; dated verification records are in the [handoff index](docs/implementation/README.md). Reuse the existing six-product snapshot without another scrape. The handoff sample PDF remains a visual reference; actual citations use the reviewed corpus and extracted physical pages.

## Local implementation

[Angular facades, data-access boundaries and UI customization](docs/implementation/angular-architecture.md) describe the current frontend structure.

`web/` contains the Angular SPA; `dataconnect/` owns schema and generated GraphQL operations; `scripts/` prepares fixtures, seeds safely and checks builds; `shared/contracts/` contains browser-safe types.

Follow the [runbook](docs/implementation/deployment-runbook.md) for clean installs, emulator startup, generated private local accounts and verification commands. The [owner checklist](docs/implementation/firebase-owner-checklist.md) records environment setup. Manual replenishment startup includes the Functions emulator; see the [increment 2 run instructions](docs/implementation/handoffs/increment-2.md). Current deployed feature evidence is linked from the [implementation index](docs/implementation/README.md).

### Delivery inspection and linked replacements

The local delivery upgrade lets salons accept good units and report damaged/missing units independently; HQ handles the issue through linked ordinary replacement requests. See [upgrade and recovery sequence](docs/implementation/delivery-upgrade.md) and [release handoff](docs/implementation/handoffs/delivery-receipts.md). Cloud migration/publication needs its own approval; this feature is prepared as one coordinated release.
