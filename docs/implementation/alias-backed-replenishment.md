# Alias-backed replenishment and salon shorthand — local implementation

28 October 2026. Implements [increment 3](../superpowers/plans/2026-10-28-alias-backed-replenishment-and-salon-shorthand.md) of the [product knowledge design](../superpowers/specs/2026-10-24-product-knowledge-and-dictated-replenishment-design.md). Local only: no cloud migration, deployment, seed apply, provider call, stock operation, owner emulator reset, Git staging or commit.

## What changed for staff

1. The ordering assistant resolves phrases from SQL: the catalog plus eligible aliases. Tiers: this salon's shorthand → exact name/code/NAME alias → PHONETIC → TYPE/product type → whole-token containment → NONE. The first nonempty tier wins. Several products, or any flagged alias, require a choice; similarity never chooses for the user.
2. Polish inflection (for example plural, genitive and adjective forms) uses a lookup-only normalization applied to both sides. Persisted normalized keys and review hashes are unchanged.
3. Unknown wording offers the complete scoped catalog (up to 200 products) with no default choice. An empty catalog returns UNAVAILABLE. A request still holds at most six lines.
4. When salon staff, or HQ acting for that salon, explicitly choose a product for a clarification, the server learns that phrase as salon shorthand. Next time, the same phrase in that salon resolves directly. Other salons are unaffected. (Owner decision 28 Oct: HQ working in a salon's context teaches that salon; originally HQ never learned.)
5. Salon Settings has a separate **Salon shorthand** section listing phrase → product with Remove for that salon's staff and for HQ acting for the salon. HQ has a read-only **Salon shorthand** page (`/hq/shorthand`) across salons. The low-stock threshold form keeps its own state.
6. If a valid choice is applied but the shorthand cannot be saved, the draft line is kept and the assistant says so.
7. A learned phrase resolves directly, so the assistant does not offer a different product for it. To correct a wrong shorthand, staff remove it in Settings and choose again; the spec's in-flow replacement is not offered in this increment (owner decided 28 Oct to keep this).

## Guarantees

- **Scope.** Only ACTIVE aliases participate: business-global SEED rows without a source, GENERATED/HQ rows from a current published document, and SALON_CONFIRMED rows for the selected salon. Rejected, proposed, retired, foreign-business, other-salon and ACTIVE-under-ineligible-source rows are ignored.
- **Complete snapshot.** Header → product pages (100) → alias pages (1000) → salon alias page → header. Bounds: 200 products, 5000 eligible global alias rows, 200 active shorthand rows per salon; overflow fails explicitly (SERVICE_UNAVAILABLE). A changed catalog or shorthand revision while paging returns SOURCE_CHANGED. Each product carries exact HQ and selected-salon balances and that salon's active request. Final validation re-reads stock; submission CAS is unchanged.
- **Receipts.** Each final product clarification for a SALON actor gets an opaque receipt binding user, business, salon, message SHA-256, span/lineId, the extracted phrase (base-normalized), offered product IDs, catalog revision and expected alias revision. It expires after 10 minutes. No message text is stored. Phrases over 120 characters, HQ actors, the batch-limit guard and client-supplied spans receive none.
- **Learning.** Only an explicit choice that passes final validation (READY or already-active exclusion) with a valid receipt can learn. Confirmation is one native transaction: fresh SALON membership and access, unchanged salon shorthand revision, live unconsumed receipt, unchanged business catalog revision and per-alias revision CAS. Inflected variants of a phrase share one salon alias identity. Conflicting confirmations: one wins; a loser detected before the write reports STALE_STATE, a loser rejected inside the write reports UNAVAILABLE. The write is bound to the receipt's alias and expected revision and fails as a whole. Opposing products for one phrase in a single request stay usable but teach nothing (CONFLICTING_CHOICES). Different phrases are independent.
- **Outcomes.** `shorthandLearning` reports LEARNED, UNCHANGED or NOT_SAVED with NO_RECEIPT, STALE_STATE, EXPIRED, UNAVAILABLE or CONFLICTING_CHOICES. Learning never claims success after an unknown write and never invalidates a verified draft.
- **Removal.** `removeSalonShorthand` (salon staff only) retires the alias as a tombstone with an increasing revision and is journaled by idempotency key. A same-key retry returns the stored result; a changed payload is rejected; a stale expected revision returns SOURCE_CHANGED. A consumed receipt replay never restores a removed meaning. A fresh receipt can teach the phrase again.
- **No stock writes.** Preparation, learning and removal do not touch inventory, requests, documents or PDFs.

## Seed

Aliases are seed data owned by each product: `type`, `keywords` and `aliases` (NAME/TYPE/PHONETIC) sit on the products in `docs/not-bad-stuff-products.json`, flow through `scripts/prepare-data` into `data/seed/business.json`, and the alias seed and demo reset read them from there. No application code knows a phrase or a product; the lookup works only on what the database holds (seed, HQ edits, product cards, salon shorthand). The demo reset also rebuilds the product cards and links each to its product ([full demo reset](full-demo-reset.md)). The former `functions/src/ai/product-aliases.ts` map and the separate `docs/not-bad-stuff-product-aliases.json` file are gone (owner decision 28 Oct: seed data, never app logic).

```sh
DATA_CONNECT_EMULATOR_HOST=127.0.0.1:9399 node --import tsx scripts/seed/product-aliases.ts \
  --project demo-barberhq --business <businessId> --config config/emulator.example.json --dry-run
```

- Explicit project, business, config and exactly one of `--dry-run` / `--apply`. Demo projects require an emulator host; cloud projects refuse one. Application startup never seeds.
- Seed identity: business/product/kind/base-normalized phrase/language. Apply runs as one transaction fenced by the business catalog revision, bumps it once when something changed and is a no-op otherwise. It retires only removed SEED rows and never overwrites HQ, generated or salon rows.
- Dry-run for the demo catalog: 32 aliases and 6 product type/keyword updates; nothing written.
- `Product.seedType` is a fallback: a current published document type assertion overrides it; withdrawal falls back to `seedType`, then null (both publication and withdrawal transactions).

## Schema (additive)

`Product.seedType`, `Product.keywords` (null reads as empty), `Location.productAliasRevision` (default 0), `ProductAlias.revision` (default 1), new server-only `ReplenishmentChoiceReceipt` and `SalonAliasOperation`. The document review snapshot insert now supplies `revision: 1` for payloads without it, so older payloads stay valid.

## Verification (local)

| Gate | Result |
| --- | --- |
| Root unit (incl. lookup, seed, learning orchestration, package, error mapper) | 347 passed |
| Angular unit/component | 212 passed |
| Isolated SQL (native PostgreSQL 17/pgvector + SQL Connect 9499, Auth 9198): lookup, seed, salon shorthand, replenishment agent, AI quota, product drafts/generation/publication, RAG flow/retrieval, salon settings (10 suites) | 68 passed, 1 skipped (existing) |
| Browser (Playwright Chromium, Angular 4215 copy on isolated ports): learn → reuse → remove → re-ask; 1280px and 320px (no horizontal scroll); other salon unaffected; HQ read-only | 3 passed |
| Fixture evaluation `scripts/eval/replenishment/lookup-fixtures.ts` | 13/13; provider calls 0, stock writes 0 |
| Offline schema compile (toolkit 3.4.21), emulator + cloud browser SDK generation, typecheck, Functions build | pass |
| Isolated package `scripts/config/prepare-replenishment-functions.ts` | real module load exports exactly `prepareReplenishment`, `removeSalonShorthand`; no stock, Knowledge or RAG callable |

Browser callables were served by a test adapter around the actual preparation and shorthand services with deterministic extraction; the Functions HTTP wrapper and App Check were not exercised in the browser. The existing replenishment-ai submit case and one salon-settings case need the owner's Functions emulator and port 9399, which the isolated stack does not provide. The model, Vertex and Web Speech quality is unmeasured.

## Rollout notes

Order: additive schema → compatible connectors → Functions + SDK + frontend → explicit reviewed seed dry-run, then apply. No automatic backfill of document aliases. Once salons learn shorthand, an older backend cannot maintain receipts, revisions or the seed fallback; keep a compatible backend or roll forward. Expired receipts remain until a later cleanup job; no scheduler is introduced. Cloud migration, deployment, seed apply and paid evaluation each need separate approval.

The remaining one-turn extraction still runs a preliminary calculation inside the generator before final validation; increment 4 owns the two-turn model, model ordering of ambiguous candidates, more than six lines, number words, dictation and unresolved-phrase learning.
