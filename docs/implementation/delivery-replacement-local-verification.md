# Linked replacements — local verification

2026-10-25, implementation plan Task4. No cloud migration or publication.

## Implemented

- HQ starts review, adds immutable notes, and creates a replacement for exactly the current positive outstanding quantities.
- One issue compare-and-set, child request, request items, active product slots, active-child pointer, issue event and command/key commit together.
- Approval/dispatch retain the pointer. Rejection clears it and returns the issue to IN_REVIEW in the same stock rejection transaction.
- A child receipt updates accepted good units on the original issue. It clears the pointer and resolves only when every original affected product has been satisfied. Child damage/missing units do not create another entitlement.
- Ordinary active orders block replacement creation. Ordinary unlinked receipts do not resolve the issue. Creating a pending replacement does not reserve or move stock.
- All commands authorize current HQ/business scope before replay. There is no manual Resolve command.

Replacement creation uses its DeliveryIssueEvent/DeliveryCommandReceipt rather than a stock SUBMIT receipt. Task5 derives the child creation timeline from this actual event; subsequent approval/dispatch/rejection keep existing stock receipts.

## Evidence

RED:14 of16 new HQ/replacement tests failed before implementation. GREEN:47/47 combined delivery receipt/access/replacement/race integration tests passed on actual local Auth/SQL. Root unit suite238/238, typecheck and Functions build passed.

| Scenario | Verified result |
| --- | --- |
| Original10 →8 good/2 affected → replacement2 good | Original receipt8, child2, one resolved issue, total dispatch12, salon12 from initial2, HQ6 from18 |
| Replacement2 →1 good/1 damaged → next replacement1 | Original affected quantity stays2; accepted1 then2; one issue, five ordered revision events |
| Two affected SKUs, one fully satisfied on first replacement | Next request contains only the remaining SKU quantity1; final accepted quantities2/3 |
| Zero-good child | No additional receipt movement; original outstanding2, IN_REVIEW, no active child |
| Reject pending child | Pointer and active slots cleared atomically, no stock delta, outstanding retained |
| HQ shortage on approval | Child stays pending and issue stays active; no partial reservation |
| Concurrent create keys / identical-key retries | At most one active child and one event per revision; retries return the immutable command |
| Note/create race, duplicate receipt, reject/receipt race | One revision winner, no double stock or entitlement |
| Foreign actor / stale issue / role revoked before replay | Denied without effects |

A native guard regression was also reproduced with a real SQL call: an optional valid report allowed a malformed internal product order through because OR subexpressions were joined without individual parentheses. The new regression failed before the fix and passes after grouping every guard clause. Public repository validation and the separate actor guard already rejected unauthorized/malformed external commands; this strengthens the internal transaction boundary. The same combined suite covers the fix.

Logs: `.superpowers/sdd/2026-10-25-delivery-receipts-and-issues/task-4-*`. Read models/procedure bindings, UI, migration/reset and the release package remain Tasks5–8.
