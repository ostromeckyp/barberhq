# Spec: Phase 6 — damaged-delivery RAG

> Answer a staff procedure question using authorized document excerpts and verifiable PDF citations.

## Background

Read shared contracts, phase-03/04 reports, architecture section 9 and the evaluation table in `docs/synthetic-knowledge/README.md`. Ingestion is complete; this phase queries existing vectors. Phase 5 is not a dependency.

UI design reference: [views, elements and states](../../docs/design/views-and-states.md). Use Angular Material for standard controls and compose domain-specific components using the shared theme. Use the approved handoff for citations and highlighted PDF navigation.

Read the [approved design extensions](approved-design-extensions.md) for this phase’s approved batch, document-library and PDF-geometry responsibilities.

## Requirements

1. Implement answerProcedureQuestion as a retrieval-first server Genkit flow. Verify caller identity/scope, question size and shared quota before model calls. Embed the query with the same compatible model/dimension as the corpus, using its query mode where applicable.
2. Retrieve at most three chunks by cosine similarity, with business/document access, active-version, non-revoked and READY eligibility inside the SQL query. Calibrate a relevance threshold against the checked-in evaluation cases; record distance semantics and chosen threshold. Do not hardcode expected answers or use a test question as a retrieval key.
3. Give Gemini only the question and labeled retrieved text as evidence. Require structured steps with sourceSectionIds. No useful evidence means INSUFFICIENT_EVIDENCE; do not fill missing company policies from general knowledge or online search. Permit at most one targeted retrieval retry within the existing flow budget.
4. Validate response shape and referenced IDs; construct source cards from actual SQL records. Recheck version eligibility before responding. Citation membership is necessary but not proof that a claim is supported; evaluate claim support separately. Treat document instructions attempting to change permissions/tool behavior as untrusted content.
5. Connect /procedures to the flow with the independent Zakładowa damaged-delivery example. Show synthetic guidance prominently, exact supporting excerpts, title/version/physical page and Open PDF through the existing viewer with server-resolved version/chunk/page and rectangle metadata. No report submission, replacement promise or inventory change occurs.
6. Evaluate all existing cases plus product-guide questions about sourced facts, a mixed product/policy question and absent information. Product summaries must not become evidence for damage policy or chemical safety. Test retired and unauthorized distractors, prompt injection, embedding mismatch, retrieval/model failure and publication changes. Exercise HQ replacement, failed import, deletion during generation, old cited-version access and revoked deep links.
7. Record retrieved IDs, supported claims, abstentions and latency for each case. Evaluate Polish equivalents separately before enabling Polish in the live talk. Retain raw evaluation evidence locally without storing end-user chat history. Produce a phase-06 report with explicit limitations of this small synthetic corpus.

## Affected Files

| File | Change type | Description |
|---|---|---|
| `functions/src/ai/` | Create | Query embedding, retrieval, guidance flow and citation validation |
| `dataconnect/ server connector` | Modify | Scoped retrieval operations if not already sufficient |
| `web/ procedures feature and AssistantApi` | Modify | Questions, cited answers and source navigation |
| `scripts/eval/rag/` | Create | Retrieval, grounding and abstention evaluation |
| `docs/implementation/handoffs/phase-06.md` | Create | Threshold, evidence and language results |

## Existing Patterns to Reuse

- Reuse phase-03 indexed chunks/model config and phase-04 authorized viewer.
- Reuse the knowledge README expected behaviors; the evaluation material stays outside the corpus.

## Constraints

- No stock command tools, embeddings in the browser, Firestore or second vector store.
- The embedding is used to find text; Gemini reads the retrieved text, not the PDF path or vector numbers.

## Open Questions

No owner policy is needed because this is explicitly synthetic. Polish live use remains conditional on evaluation; English is the default.

## Acceptance Criteria

- [ ] Cracked/leaking product queries retrieve current DAM-001 v1 and give supported guidance with correct PDF pages and verified highlighted regions.
- [ ] Missing/wrong product questions retrieve the corresponding discrepancy procedure.
- [ ] Unsupported disinfection/deadline questions abstain; no automatic replacement is promised.
- [ ] Retired/foreign/unready chunks never enter model context; every returned source ID was actually retrieved.
- [ ] Human review checks support of every demo instruction, beyond citation-ID validity; all failures are reported.
- [ ] Newly reviewed/published versions are retrieved; superseded/deleted versions are excluded, and deletion during generation blocks stale evidence.
- [ ] RAG leaves requests, inventory and stock movements unchanged.
