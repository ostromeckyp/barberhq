# BarberHQ — requests with items, request history and salon settings

7 October 2026. Written design for review; application changes are not implemented by this document.

## Intent and authority

The presenter wants replenishment to reflect a business request: one submission contains one or more products, with one request identity and one lifecycle. Salon navigation should describe activities rather than repeat the salon name. Staff must be able to find rejected requests and configure the low-stock warning for their salon.

Confirmed in conversation:

- A request contains one or several items; products are not separate requests.
- No partial requests/fulfillment for the demo. Approval, dispatch and receipt apply to all items together.
- Salon navigation includes a dashboard, requests and configuration.
- Salon identity belongs in the top bar.
- Request details have a back button.
- Rejected requests must remain visible.

This change supersedes the one-request-per-product, per-row submission recovery and global-only low-stock setting rules in the September delivery design, approved design extensions, shared contracts, architecture and increment-2 plan. Their existing descriptions remain an accurate record of the implemented baseline until the implementation updates them. The Claude HTML handoff remains a visual reference and is not edited.

Unchanged: Angular/Material, facades and data-access services, Firebase Auth, SQL Connect/PostgreSQL, server-validated stock commands, classic Hosting, integer units, scoped access, no autonomous stock mutation. Cloud verification remains required before release. PDF/RAG is a later increment.

## Chosen approach and alternatives

Use a request header with item rows and a single whole-request lifecycle. Keep the existing five states: PENDING_APPROVAL, RESERVED, DISPATCHED, RECEIVED, REJECTED. Inventory effects are per product, committed together in one transaction.

A visual group around independent product requests would leave the existing split outcomes and would not satisfy the requested business model. Independent item lifecycles within one request would support partial fulfillment, which the user explicitly excluded. Neither is selected.

## User experience

### Navigation and salon context

Salon navigation has **Dashboard**, **Requests**, and **Settings**. It contains no salon-name entries. The current salon stays in the top bar; a user with multiple assigned salons gets a salon switcher there. Switching salons on Dashboard, Requests or Settings retains the activity but loads only the newly selected salon's data. Switching from request details opens the destination salon's Requests page; it never relabels the previous request as belonging to another salon.

Routes:

| Route | Purpose |
|---|---|
| `/salons/:salonId` | Dashboard: stock, low-stock indicators and request draft |
| `/salons/:salonId/requests` | Salon requests, including history |
| `/salons/:salonId/settings` | Salon configuration |
| `/requests/:requestId` | One request with its item list, status and timeline |
| `/hq` | HQ request queue using the same request model |

Dashboard may show an active-request count and link to Requests; the full list belongs on the dedicated page. Existing active-item conflict links remain available while building a draft.

### Requests and rejected history

Label the navigation item **Requests**, not Active requests. Provide filters **All** (default), **Active**, **Received**, and **Rejected**. Active means PENDING_APPROVAL, RESERVED or DISPATCHED. Received and rejected records are retained, queryable and reopenable; neither disappears from history when its active slots are released.

Filtering and pagination happen on the server within the authorized salon/business. Order by creation time descending with request ID as a stable tie-breaker. List entries display request reference, product/item summary, item count, total units, time and one status chip. HQ entries also display salon name. Empty/loading/error states are distinct for each selected filter.

Rejected details display the rejection reason and timestamp in the timeline. Rejection does not delete the request or modify stock. Staff can start a new request afterward; rejected records remain immutable history. No automatic cloning or editing of submitted requests is added.

### Request details and return navigation

Display one request reference/status, all products and requested/dispatched/received quantities per product, the shared timeline and next allowed action. Quantity totals may supplement but never replace product-level quantities. Each product shows its relevant stock effects.

Provide **Back to requests** above the detail content. Salon staff return to that request's salon list; HQ returns to the HQ queue. Preserve a known list filter/page when entered from the list. A direct link has a deterministic authorized fallback to the appropriate list, independent of browser history. Return state is bounded list context, not an arbitrary redirect URL.

### Settings

Start with one section, **Inventory**, and one field, **Low-stock threshold**. Persist a nonnegative integer per salon, default 2, applying to all its products. Mark stock as low when on-hand is less than or equal to this value. At threshold 0, only zero stock is low. This is a warning, not a reorder quantity or automatic replenishment trigger.

Assigned salon staff may read/change their own salon setting; HQ may manage salons in its business. Enforce this in the data operation. Reject fractional, negative or out-of-range SQL integers. Use a version guard against overwriting another user's update. Show Save, saving, saved, validation failure, access failure and stale-version states. After confirmed save, refresh the dashboard's authoritative threshold. A failed settings read must not silently substitute the old public-build setting or invent a value.

Retain an ordinary typed settings model and a page with sections. Do not build a generic configuration engine, per-product overrides or empty future settings.

## Domain and command contracts

### Request items and draft

A draft contains 1–6 distinct products, matching the current demo catalog. Quantities remain integers 1–99 per product. Duplicate additions merge quantities without clamping; an invalid merged quantity remains editable and blocks submission. Unresolved assistant lines continue to block submission when that later feature is enabled.

Submitting sends one immutable payload containing `salonId`, `items: [{productId, quantity}]` and one idempotency key. Server validation rejects an empty list, duplicates, invalid quantities and foreign products. Persist every item and the request header together, or persist nothing. Canonicalize item ordering for payload comparison so reordering identical items does not change the intent.

Maintain the existing active-product exclusion for each salon/product. A conflict for any item rejects the entire submission, returning the conflicting product(s) and existing request link(s). The user explicitly edits the draft before submitting a new payload/key. Never silently submit only the non-conflicting items.

### Whole-request actions

| Action | Atomic behavior |
|---|---|
| Submit | Create header, all items, all active product slots, receipt and action-key binding; no stock movement |
| Approve | Check every item's HQ availability and expected inventory version; reserve every quantity; create transfer/item records; change status once |
| Reject | Pending requests only; require one trimmed reason of 1–500 characters; release all active slots; preserve request/items/audit; no stock change |
| Dispatch | Reserved requests only; subtract every quantity from HQ on-hand and reserved; record one dispatch movement per item; change status once |
| Receive | Dispatched requests only; validate exact quantities for every item and confirmation all are intact; increase all salon balances, record receipt movements, release all slots; change status once |

A shortage, stale version, missing item, malformed receipt or any later guard failure rolls back the entire command. No subset of reservations, movements or items may commit. One insufficient product leaves the request pending; one damaged or missing product leaves the entire request dispatched and unchanged in salon stock. Explain the blocked receipt and direct staff to HQ; future procedure guidance stays read-only.

Keep expected request revision and per-product inventory versions where approval relies on the displayed stock. Authorization, item membership and state guards run server-side inside the transaction. Process product locks/updates in deterministic order. Never split the whole-request command into independent per-item function calls or application-level transactions.

Use generated, server-only GraphQL transactions if the actual supported batch syntax proves these guarantees. If the connector cannot express them, use the existing narrow parameterized SQL fallback, behind the same command interface, after documenting the failed capability check. The implementation plan must prove the transaction shape before broad UI changes.

### Replay and recovery

One submitted request has one frozen item list and one retry key. Store only unresolved submitted state, scoped to user/business/salon. A lost response retries that same payload/key, rather than issuing per-item requests. A confirmed result identifies one request and clears its pending journal.

Keep ActionReceipt and ActionKey protections: authorize before replay, bind semantic retries to immutable intent, reject conflicting key reuse, never repeat stock movements. Transient session/read errors preserve pending state and block writes. Explicit sign-out or a verified incompatible identity clears local state. Recovery from another salon routes back to the saved salon and names that destination. Definitive submission failure leaves the complete draft available to correct and retry with a new key.

## Storage and application boundaries

| Record/unit | Responsibility |
|---|---|
| ReplenishmentRequest | Request ID, business/salon, shared state/revision and timestamps |
| RequestItem | Unique request/product; requested quantity; stable item identity |
| ActiveRequest | Unique business/salon/product slot pointing to its parent request; many slots may reference one request |
| Transfer / TransferItem | One transfer header per request, with per-product quantity and dispatch/receipt quantities |
| StockMovement | Unique transfer-item/movement-type; product quantity, actor and timestamp |
| ActionReceipt / ActionKey | Whole-command result and immutable retry-key bindings |
| SalonSettings | Salon identity, low-stock threshold, version and update timestamp |

Continue separate feature facades, data-access adapters and small Material UI components. The request list and detail consume item-aware read DTOs; components do not call Firebase directly. The draft remains editable feature state; submission recovery owns only its frozen whole-request payload. Settings and selected salon context must not leak between users or salons.

The later replenishment agent still prepares draft items and cannot mutate stock. Its implementation must use the new whole-request submission contract.

## Transition from the implemented demo

No production deployment has occurred. Use a coordinated local/demo schema and client transition rather than introduce indefinite dual-write compatibility.

Preserve existing requests as one-item requests with the same IDs, status, stock effects and rejection history. Backfill item/transfer-item associations and audit links without rerunning a stock command. Validate quantities, counts and balances before retiring single-product header fields. Do not silently reset business data or ordinary user settings.

Perform migration only with commands quiescent and an explicit target/backup. Old browser sessions must reload. Detect legacy per-item pending journals rather than interpreting them as a new whole-request submission or silently deleting unknown keys. Reconcile them against the retained action receipts/keys using the documented upgrade procedure before enabling new submission. A migration may require operator-assisted reconciliation; do not claim transparent old-client compatibility.

Ordinary seeding creates missing default settings without overwriting salon changes. Extend the explicit demo reset for new operational item tables; preserve salon settings along with products and memberships. Test fixtures get default settings independently for repeatable tests.

## Acceptance evidence

1. Three products submitted together create one request, three items and one status/timeline. A one-item request remains supported.
2. A conflict in any item creates no subset request. Duplicate/invalid/foreign items fail without writes.
3. Approval shortage on one product leaves every item's reserved stock unchanged. Competing overlapping requests cannot oversell.
4. Dispatch/receipt update each product exactly once. A later-item failure rolls back earlier-item effects.
5. Missing/damaged/partial receipt leaves the full request dispatched and all salon balances unchanged.
6. Lost response and refresh recover the original whole-request ID/key with no duplicate items or movements, including session error and salon-switch cases.
7. Rejected requests appear in All and Rejected, with their item lists, reason and timeline; received requests appear in All and Received.
8. Navigation uses Dashboard, Requests and Settings. Direct details show the right salon and deterministic Back to requests; multi-salon switching cannot change the target of a saved request.
9. Changing Legnicka's threshold persists after reload, changes its warning chips and leaves Łódzka/Zakładowa unchanged. Invalid/stale/unauthorized setting writes fail.
10. Existing one-item history/audit and stock balances survive conversion; legacy pending state is detected and reconciled rather than discarded.
11. Angular unit, real SQL transaction, authorization and browser tests cover these behaviors. Material keyboard/focus/Axe and 320/360/1280px checks remain required.
12. Repeat the original Matowa proof: HQ18→16, salon2→4, transit0. Cloud tests/App Check/deployment remain separate release gates.

## Next step

Review this written design, then prepare the implementation plan with a transaction-capability check, schema/DTO transition, whole-request commands/recovery, Requests navigation/history, salon settings and end-to-end verification. Do not mark any of these changes implemented based on this design document.
