# Suggested procedure question from delivery inspection

The owner chose: open Procedures with an editable suggested question; staff explicitly click Ask assistant. The inspection remains unsent and its existing scoped draft survives the detour.

## Approaches

- Chosen: reuse the existing Procedures assistant, prefill a fixed question for damaged/missing/both, and provide a bounded return to Check delivery. Reuses existing answer/citation/PDF UI.
- Inline assistant answer in the receipt: considered and not selected; would add another answer surface and loading/error flow.

## Small change

Replace repeated unassigned-procedure notices with one instruction: “Check your salon procedure before handling damaged or missing products.” Keep available source PDF buttons. Add a suggested-question button only when an affected quantity exists and RAG/knowledge are enabled. Clicking opens the assistant with the fixed Polish prompt for the selected problem types. No AI call until explicit submission; no claim or receipt command is sent. Return preserves the existing draft, request filter and list page. Source PDF → Procedures retains the edited question and delivery return.

Only an enum problem marker and already bounded delivery return IDs/filter/page travel in the URL. No description, batch or product data is copied. Consume the suggestion marker after prefill so tab changes/PDF return cannot overwrite edits. Revalidate the return against current membership/workspace; clear it with the assistant scope. A manual Clear keeps the return action. Model/provider failure remains a separately diagnosed issue and cannot block return or receipt entry.

Implementation choices above are author details within the selected navigation variant. Preserve the current dirty checkout/staging; no commits, deployment, new worktree or dependency changes.

## Follow-up requested by owner

Check delivery also offers “Mark all as good”. This explicit reversible edit sets each product's good quantity to its dispatched quantity and damaged/missing to zero. It preserves the report/draft fields and does not record the inspection. The action is disabled while the inspection is locked. It does not alter the backend or stock until Record inspection is pressed.
