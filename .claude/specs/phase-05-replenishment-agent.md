# Spec: Phase 5 — agentic replenishment assistant

> Let staff express a stock request naturally and review a proposal backed by live business data.

## Background

Read shared contracts and phase-02/04 reports, plus architecture section 7. The manual workflow is already complete. Add a server-side Genkit/Gemini flow that uses bounded read tools and hands off to the existing explicit submission command.

UI design reference: [views, elements and states](../../docs/design/views-and-states.md). Use Angular Material for standard controls and compose domain-specific components using the shared theme. Use the approved handoff for the shared Assistant/Manual draft and line-level states.

Read the [approved design extensions](approved-design-extensions.md) for this phase’s approved batch, document-library and PDF-geometry responsibilities.

## Requirements

1. Implement prepareReplenishment with verified caller scope, runtime schemas, shared usage admission and configured time/turn/tool limits. Expose only findProduct, getStockContext and calculateProposal; inject membership scope from server context, never from model arguments.
2. Resolve catalog products using exact codes/names/curated aliases; handle ambiguous matte-product wording with explicit choices. Require integer quantities 1–99 per line. Parse multiple products; use bounded array read tools so the same turn/tool budget applies. Read live inventory and active-request information through scoped operations.
3. Rebuild each final line from validated tool results: product ID/name, quantity, HQ available, salon on-hand and inventory versions. Return line-level clarification and excluded existing requests; never discard unresolved products silently. Return PROPOSAL, NEEDS_CLARIFICATION or UNAVAILABLE. A proposal reserves nothing; never include a model-accessible stock write tool.
4. Add natural-language input to the shared phase-04 draft, preserving manual corrections and line provenance. On explicit submission use the same per-row submitRequest orchestration as the manual form. Preserve product/quantity correction controls, unknown-outcome retry behavior and manual fallback.
5. Show only actual tool events if an activity display is included. Record timing and tool names without logging tokens, personal account data or full prompts by default. Do not fabricate a reasoning trace.
6. Run focused cases: exact two-unit Matowa request, three-product request, duplicate product merge/overflow, mixed ready/ambiguous lines, ambiguous product, missing/invalid quantity, insufficient stock, existing active request, foreign salon attempt, quota and timeout. Include an instruction attempting to force direct dispatch and prove it cannot write.

## Affected Files

| File | Change type | Description |
|---|---|---|
| `functions/src/ai/` | Create | Replenishment flow, read tools and validated outputs |
| `web/ salon feature and AssistantApi` | Modify | Natural-language request and review card |
| `scripts/eval/replenishment/` | Create | Focused workflow cases |
| `docs/implementation/handoffs/phase-05.md` | Create | Actual model configuration and evaluation results |

## Existing Patterns to Reuse

- Reuse manual submission, stock context adapters and phase-02 shared quota/auth helpers.
- Architecture section 7 contains the tool allowlist and bounded interaction model.

## Constraints

- No automatic approval, dispatch or receipt; no RAG for counting stock.
- No persistent conversation history or fake tool/progress animations.

## Open Questions

No new decision is required. Use the configured server-side Gemini provider/model and record actual availability.

## Acceptance Criteria

- [ ] Natural language prepares exactly 2 Matowa for Legnicka from current records.
- [ ] Three products populate the shared draft within the unchanged tool budget; partial submission outcomes reuse phase-04 behavior.
- [ ] Ambiguity requests clarification rather than silently choosing a product.
- [ ] Running the flow alone creates no requests, reservations or stock movements.
- [ ] Manual submission and completion still work when the model fails or quota is exceeded.
