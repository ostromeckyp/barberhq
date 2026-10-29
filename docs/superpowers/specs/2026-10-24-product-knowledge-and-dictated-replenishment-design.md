# BarberHQ — product knowledge, catalog aliases and dictated replenishment

24 October 2026 design. Increment1 was approved and implemented locally on27 October; see the [implementation and migration handoff](../../implementation/knowledge-kind-origin.md). Cloud rollout is pending separate approval. Increment2 is implemented locally on28 October; see the [product review handoff](../../implementation/product-document-alias-review.md). Its cloud/provider gates remain pending. Increments3–4 remain planned.

## Intent and authority

Salon staff should be able to stand in front of a shelf and dictate what is missing into a phone: "potrzebujemy 4 olejki, 2 cementy, 4 matowe, 4 klasyczne". The assistant should turn that into an editable request draft with correctly identified catalog products. Today it cannot.

Observed failure (salon Legnicka, request containing "4 olejek do brody"): the line returned `NEEDS_CLARIFICATION` with `candidates: []`. The user had nothing to choose from and had to remove the item. The cause is not model strength:

- The model (`gemini-3.5-flash-lite`, one turn) only extracts `{originalWording, productQuery, quantity}`. It never sees the catalog.
- `findProduct` and `getStockContext` are called by server code after the model turn and their results are discarded (`functions/src/ai/replenishment-model.ts`). `calculateProposal` runs twice; the first result is discarded.
- The matcher (`functions/src/ai/replenishment-tools.ts`, `matches`) accepts an exact normalized match, or a query that *contains* a whole alias. "olejek do brody" is contained in the product name, not the other way round, so nothing matches. "matowe" does not match the alias "matowa". Aliases are a hard-coded map in `functions/src/ai/product-aliases.ts`.
- Product fields that would help (`Product.category`, `summaryEn`, `scentPl`) exist in SQL but `ReadReplenishmentContext` does not read them. That query reads at most 7 products and the repository schema rejects more than 6.

Confirmed in conversation:

- Every replenishment tool must contribute to the result. Tool output must reach the model or the decision, not only telemetry.
- Orchestration is **server-driven with two model turns**, not a free agent loop.
- When the model identifies exactly one product unambiguously, the line is **READY**. When several products fit, the line is a clarification with a **non-empty** candidate list, the model's best guess first.
- Aliases are recognized **when a product document is added**, reviewed by HQ, and then used by replenishment to find candidates.
- The document library must record the **kind** of document (procedure, policy, product card) separately from its provenance.
- Product knowledge for matching is structured data in SQL. PDFs are an input to alias generation, not a runtime retrieval source for matching.

Unchanged: Angular/Material, Firebase Auth and App Check, SQL Connect/PostgreSQL, server-validated scope (never from model arguments), the AI budget (25 s, 5 model turns, 8 tool calls), quota admission, verbatim source spans (`originalWording` bound to `line-<start>-<end>`), no stock mutation by the assistant, human review before anything generated becomes active. "Product similarity does not authorize substitution" (`docs/04-not-bad-stuff-catalog.md`) still holds: a type-level match is accepted only when the catalog contains a single product of that type.

## Goals, non-goals, anti-goals

Goals:

- Dictated Polish (and English) shelf orders with inflected forms, number words and speech-to-text noise resolve to catalog products or to clarifications that always offer real choices.
- Product knowledge is maintained by HQ through the document library, not by deploying code.
- Each salon's own shorthand ("matowe" means Pomada Matowa in Legnicka) is learned from confirmed choices.
- Simple requests that aliases fully resolve cost no more than today (one model turn).

Non-goals:

- A cosmetic recommendation chatbot or substitution suggestions.
- Retrieval (embeddings) for product matching.
- Partial fulfilment, multi-salon orders, or any change to the request lifecycle.
- Automatic publication of generated aliases or document links.

Anti-goals (failure even if it technically works):

- The model can pick any catalog product for a phrase that does not textually support it.
- A clarification with an empty candidate list when the catalog has a plausible product.
- A wrong salon alias silently and permanently redirects orders with no way for staff to see or remove it.
- Adding a product changes what existing phrases resolve to without HQ being shown that effect.
- Any product knowledge hard-coded in application code or prompts (see below).

## No hard-coded product knowledge

**This is a hard rule for every increment.** Nothing that describes a specific product, product type or catalog lives in application code, prompts or tool descriptions. Adding, renaming or removing a product, alias or type must never require a code change or deploy.

Must come from data (SQL, written through the document library, HQ review or salon confirmation):

- product names, codes, types, categories and traits;
- every alias: `NAME`, `TYPE`, `PHONETIC`, salon shorthand;
- which phrases are ambiguous and which products they map to;
- the catalog card sent to the model.

Must not appear in application code or prompts:

- product names, brand names or product-specific words ("matowa", "Savage", "olejek", "matte");
- product-specific rules or examples. Today's `findProduct` description ("Generic matte wording is ambiguous") and `functions/src/ai/product-aliases.ts` both violate this and are removed. Prompt examples use neutral placeholders ("Product A", "type X");
- product IDs, demo IDs or EANs, except in seed data files and test fixtures.

Allowed in code, because it is language or system behavior rather than product knowledge:

- Polish inflection suffixes and number words used by normalization (kept in one module, covered by tests);
- matching tiers, ambiguity and validation rules;
- budget, limits and model configuration.

Seed data (`docs/not-bad-stuff-products.json` and a seed alias file) and test/eval fixtures may name real products; they are data loaded through the same tables, not logic. A test asserts that the replenishment prompts and tool descriptions contain no product name or alias from the seeded catalog.

## Increments

Four increments, in order. Each ships separately and gets its own implementation plan.

| # | Increment | Depends on |
|---|---|---|
| 1 | Document kind and origin | — |
| 2 | Product documents: product links, alias generation, collision check, HQ review | 1 |
| 3 | Alias-backed `findProduct` and salon shorthand | 2 (works with seeded aliases before 2 ships) |
| 4 | Two-turn replenishment and dictation | 3 |

Increment 3 can start on aliases seeded from `docs/not-bad-stuff-products.json` plus the current `product-aliases.ts` content moved into a seed data file, so the replenishment fix does not wait for the full review UI.

## Increment 1 — document kind and origin

`KnowledgeVersion.sourceType` (`SYNTHETIC_PROCEDURE | PUBLIC_PRODUCT_SUMMARY`) conflates two properties, and `synthetic: Boolean` duplicates part of it. Replace with:

```graphql
enum KnowledgeDocumentKind { PROCEDURE  POLICY  PRODUCT_CARD  PRODUCT_CATALOG }
enum KnowledgeOrigin       { OFFICIAL  PUBLIC_COMPILATION  SYNTHETIC }
```

- `PRODUCT_CARD` describes one product; `PRODUCT_CATALOG` describes several (CAT-001).
- `synthetic` becomes derived (`origin == SYNTHETIC`). Labels shown in the UI ("Synthetic demo procedure", "Unofficial public-product compilation") are derived from kind + origin.
- `PUBLIC_COMPILATION` keeps the existing requirement for `sourceUrls` and `observedOn`.
- Data migration: `SYNTHETIC_PROCEDURE → PROCEDURE + SYNTHETIC`; `PUBLIC_PRODUCT_SUMMARY → PRODUCT_CATALOG + PUBLIC_COMPILATION`.
- The upload dialog asks for kind and origin as two fields.
- Retrieval for procedure answers filters by kind. It includes all four kinds (product documents stay searchable, see Decisions); the filter exists so later features can narrow it.

Touches `dataconnect/schema/knowledge.gql`, `dataconnect/server|browser/knowledge.gql`, `shared/contracts/knowledge.ts`, `functions/src/knowledge/*` (pipeline, schemas, document commands), `functions/src/ai/retrieval.ts`, the web library/upload/review/label components and mappers, the corpus manifest and their tests. PDF hashes do not change; manifest metadata does.

No new behavior in this increment beyond the split and the filter.

## Increment 2 — product documents

For `PRODUCT_CARD` and `PRODUCT_CATALOG`, the existing pipeline (upload → extract → review → publish) gains steps. Procedure and policy documents are unaffected.

```
upload → extract pages (existing) → link sections to products → generate aliases → collision check → HQ review → publish
```

### Link sections to products

- A section is linked to a `Product` by `sourceCode` (EAN) when present: deterministic.
- Otherwise by name, proposed by the model, confirmed by HQ.
- A `PRODUCT_CARD` links to exactly one product; a `PRODUCT_CATALOG` links each product section separately.
- Unlinked sections are shown in review and produce no aliases.

### Generate aliases

One model call per linked product. Input: the extracted facts for that product and the current catalog with its active aliases (needed to avoid conflicts). Output schema:

```json
{ "aliases": [ { "phrase": "olejek do brody", "kind": "TYPE",     "lang": "pl" },
               { "phrase": "savage",          "kind": "NAME",     "lang": "pl" },
               { "phrase": "sawedż",          "kind": "PHONETIC", "lang": "pl" } ],
  "type": "olejek do brody" }
```

- `NAME` identifies one product. `TYPE` names a product category. `PHONETIC` covers likely speech-to-text renderings of foreign names ("dry matt" → "draj mat").
- Inflected forms are not generated; normalization handles them (increment 3).

### Collision check (deterministic, no model)

- A `NAME` alias already active for another product is flagged as ambiguous; it can only ever produce a clarification.
- A `TYPE` shared by more than one product resolves to all of them at lookup time. Ambiguity is computed when matching, not stored, so adding a second beard oil automatically makes "olejek do brody" a clarification.
- Review shows the effect on existing phrases: "after publishing, 'olejek do brody' will match 2 products instead of 1".

### HQ review and publish

- HQ accepts, rejects, edits or adds aliases and confirms product links. Nothing is active before acceptance.
- Publishing writes `Product.type` and `ProductAlias` rows with `source: GENERATED` (or `HQ` for manually added), `sourceDocumentVersion`, and `status: ACTIVE`.
- Retiring a document version retires the aliases that came only from that version.

### Data model

```graphql
enum ProductAliasKind   { NAME  TYPE  PHONETIC }
enum ProductAliasSource { GENERATED  HQ  SALON_CONFIRMED  SEED }
enum ProductAliasStatus { PROPOSED  ACTIVE  REJECTED  RETIRED }

type ProductAlias @table {
  id: String!
  business: Business!
  product: Product!
  salon: Location            # set only for SALON_CONFIRMED
  phrase: String!
  normalized: String!
  kind: ProductAliasKind!
  source: ProductAliasSource!
  status: ProductAliasStatus!
  ambiguous: Boolean!
  sourceDocumentVersion: KnowledgeVersion
  createdBy: String!
  createdAt: Timestamp!
}
```

`Product` gains `type: String`. Existing `category`, `summaryEn`, `scentPl` stay and feed the catalog card used in increment 4.

## Increment 3 — alias-backed `findProduct` and salon shorthand

### Normalization

Extend `normalizeProduct` with light Polish suffix stripping applied to both the query and aliases (e.g. -e, -i, -y, -ów, -ej, -ach), so "olejki", "cementy" and "matowe" meet "olejek", "cement" and "matowa". Diacritics handling stays as today. The exact suffix list is the builder's call, fixed by tests.

### Lookup order

`ReadReplenishmentContext` also returns active aliases for the business plus salon aliases for the current salon, and product `type`, `category`, `summaryEn`, `scentPl`. Matching runs in memory. The 6/7-product caps are removed; set a sane bound for products and aliases.

For each query, the first tier that produces any hit wins; lower tiers do not add candidates:

1. Salon shorthand (`SALON_CONFIRMED`, this salon).
2. Product code, product name, `NAME` alias: exact.
3. `PHONETIC` alias: exact.
4. `TYPE` alias / `Product.type`: exact.
5. Containment in either direction (query in name/alias, or alias in query).

`findProduct` output:

```json
{ "query": "olejek do brody", "match": "TYPE", "ambiguous": false,
  "candidates": [ { "productId": "…", "productName": "Olejek do brody — Savage 50 ml",
                    "via": { "phrase": "olejek do brody", "kind": "TYPE", "source": "GENERATED" } } ] }
```

`match` is `SALON | NAME | PHONETIC | TYPE | CONTAINS | NONE`. `ambiguous` is true when there is more than one candidate or a flagged alias matched.

### Salon shorthand

- When staff resolve a clarification by choosing a product, the server records `ProductAlias {salon, product, phrase, source: SALON_CONFIRMED, status: ACTIVE}`. The phrase is turn 1's `productQuery` for that span (normalized), not the whole `originalWording` with its quantity. *Designer's call:* recording happens in `prepareReplenishment` when a clarification with `productId` passes validation, because the submit payload carries no source wording; a choice later removed from the draft still creates the alias, which staff can remove in Settings.
- The salon Settings page lists the salon's shorthand with a remove action. *Designer's call:* HQ sees every salon's shorthand read-only on its overview page. *Owner decision 28 Oct:* HQ acting in a salon's workspace creates and removes that salon's shorthand like its staff.
- A confirmed choice that contradicts an existing salon alias replaces it.

### Seed

The content of `product-aliases.ts` moves into a seed data file (JSON next to `docs/not-bad-stuff-products.json`), together with types and keywords for the six products. The seed writes these as `ProductAlias` rows with `source: SEED` and `Product.type`. `product-aliases.ts` is deleted; no code path reads aliases from anywhere but SQL.

## Increment 4 — two-turn replenishment and dictation

### Flow

```
Turn 1 (model)   {message, clarifications} → items[{originalWording, productQuery, quantity}]   (as today)
Server           bindSourceLines → lineId per item
Server           findProduct(all productQuery)                → matches per line (+ catalog card if any NONE)
Server           getStockContext(all candidate product IDs)   → stock, active requests
Turn 2 (model)   only lines that are not resolved; input: lines + candidates + catalog card + stock
                 → calculateProposal({ items[{ lineId, productId | null, candidateIds[], reason? }] })
Server           calculateProposal (once) → ProposalResult
```

Turn 2 is skipped when every line is either a clarification choice from the user, or a non-ambiguous match with exactly one candidate at tiers `SALON`, `NAME`, `PHONETIC` or `TYPE` (*designer's call:* a single-product type is unambiguous by the confirmed rule, so the model adds nothing). Ambiguous lines go to turn 2 only to order candidates; they still end as clarifications. Lines that already have an explicit user choice never go to turn 2.

Every tool now contributes: `findProduct` supplies candidates and the catalog card, `getStockContext` supplies stock context for turn 2 and the final lines, `calculateProposal` produces the validated result. The second, redundant `calculateProposal` in `replenishment.ts` is removed; the single final call still re-reads scope, catalog, active requests and stock.

### Turn 2 contract

Input per line: `lineId`, `originalWording`, `quantity`, `match`, `candidates`. Shared: the salon's catalog card (`productId`, name, type, category, keywords, short traits from `summaryEn`/`scentPl`) and stock (`hqAvailable`, `salonOnHand`, `activeRequestId`; inventory versions stay on the server).

Output (the `calculateProposal` input schema, with `.describe()` on every field):

```json
{ "items": [ { "lineId": "line-13-21", "productId": null,
               "candidateIds": ["p-matowa", "p-drymatt", "p-cement"],
               "reason": "„matowe” fits several pomades; closest is Pomada Matowa" },
             { "lineId": "line-34-51", "productId": "p-savage", "candidateIds": ["p-savage"] } ] }
```

The model does not restate wording or quantity; those come from turn 1 and the bound span.

### Server validation in `calculateProposal`

- `lineId` must exist in the bound lines; unknown or duplicate IDs → `INVALID_MODEL_OUTPUT`.
- `productId` and every `candidateIds` entry must be in the salon's catalog.
- For lines with `match ≠ NONE`, `productId` must be among that line's `findProduct` candidates.
- For `match = NONE`, `productId` is accepted only if the normalized wording overlaps the product's type, keywords or name (deterministic guard). Otherwise the line becomes a clarification with the model's `candidateIds` that pass the same guard, falling back to the full catalog.
- A line becomes **READY** only if exactly one product survives and it is not ambiguous. Otherwise **NEEDS_CLARIFICATION**, candidates ordered with the model's choice first, never empty while the catalog is not empty.
- Quantity, active-request exclusion, duplicate merging and status are unchanged.

### Limits

- The six-item limit is raised to fit a shelf order. The exact value is the builder's call within the budget; turn-2 input size grows with lines × candidates.
- `findProduct` and `getStockContext` accept the raised number of queries/IDs.
- Budget use: 2 of 5 model turns and 3 of 8 tool calls; unchanged budget values.

### Dictation

- A microphone action in the replenishment assistant on mobile. Speech becomes text in the message field via the **browser Web Speech API** (decided); the user can edit it before sending. The text, not audio, goes to `prepareReplenishment`, so verbatim span binding still works.
- Web Speech cannot be given a product vocabulary (Chrome ignores `SpeechGrammarList`), so brand names will be misheard. This is handled downstream, never by rewriting the transcript:
  - Turn 1 drops filler words ("dobra", "to", "do tego jeszcze"), converts Polish number words ("dwie", "dwa", "cztery") to quantities, and tolerates missing punctuation. A product phrase with no number gets `quantity: null` (never a default of 1).
  - Inflection is handled by normalization (increment 3).
  - Misheard foreign names are handled by `PHONETIC` aliases. Alias generation (increment 2) must propose Polish phonetic renderings for every foreign-language product name (Dry Matt → "dramat", "draj mat", "dry mat"; Mattifier → "matifajer"; Savage → "sawedż").
  - Anything still unresolved becomes a clarification (turn 2).
- **No separate model step that rewrites the transcript into catalog names.** It would silently turn "dramaty" into Dry Matt and guesses into products, hiding the substitution from the user and breaking the "similarity does not authorize substitution" rule.
- Switching to Gemini transcription with the catalog as context is a later option, taken only if the dictation evaluation shows brand-name accuracy is too low. Phonetic aliases stay useful with any provider.

Reference transcript (real Web Speech output, Polish):

> Dobra to dwie matowe dwa olejki do tego jeszcze dramaty i Mat po mate

| Fragment | Expected line |
|---|---|
| "Dobra to", "do tego jeszcze", "i" | dropped |
| "dwie matowe" | quantity 2, clarification Matowa / Dry Matt / Cement with Matowa first (READY if the salon has that shorthand) |
| "dwa olejki" | quantity 2, READY Olejek do brody — Savage |
| "dramaty" | Dry Matt via `PHONETIC`, quantity missing → quantity clarification |
| "Mat po mate" | no quantity; clarification Matowa / Dry Matt / Mattifier |

### Learning loop

Phrases that end as `NONE` or as clarifications later removed by the user are recorded (phrase, salon, outcome; no personal data) and shown to HQ as alias proposals.

## Evaluation and acceptance evidence

- Unit tests for normalization (inflection), lookup tiers, ambiguity, collision check, and every `calculateProposal` validation rule, including "model picks an unrelated product for `NONE`" being rejected.
- `eval:replenishment` gains dictated cases on a frozen catalog: inflected plurals, number words, ASR misspellings of foreign names, unknown product ("klasyczne" → full-catalog clarification), duplicates, more than six items, mixed PL/EN. Measured: correct READY, correct clarification with the expected product among candidates, no empty candidate list, number of model turns.
- Alias generation has its own eval on CAT-001: expected aliases present, conflicting `NAME` aliases flagged.
- Dictation set: about 20 real Web Speech recordings of shelf orders, starting with the reference transcript above, stored as transcript + expected lines. Brand-name accuracy on this set decides whether Gemini transcription is needed.
- Regression: the observed failure ("4 olejek do brody" → empty candidates) resolves to READY Savage when it is the only beard oil.
- Existing procedure RAG evaluation still passes after the kind/origin split.

## Decisions made after the first draft

Decided by the presenter:

- **Speech-to-text:** Web Speech API first, with the dictation evaluation; Gemini transcription only if brand-name accuracy is too low.
- **Unknown products** ("klasyczne" with no matching name or type): clarification offering the salon's full catalog, the model's suggestion first. The choice creates salon shorthand like any other clarification. A candidate list is never empty.
- **Product documents stay in procedure RAG:** `PRODUCT_CARD` and `PRODUCT_CATALOG` chunks remain searchable, so product-fact questions keep cited answers (as CAT-001 does today). The retrieval filter in increment 1 therefore includes all four kinds; it exists so later features can narrow it.
- **Salon shorthand activates after one confirmation**, visible and removable in salon Settings.

Designer's calls (check while reading):

- `POLICY` is added to the enum now because it costs nothing, but it behaves exactly like `PROCEDURE` until a feature needs different answer formatting.
- Salon shorthand is recorded in `prepareReplenishment` on a validated explicit choice (the submit payload has no source wording); HQ sees salon shorthand read-only.
- A single-candidate `TYPE` match skips turn 2 and is READY.
- Salon shorthand phrase is turn 1's normalized `productQuery`, not the full wording.

## Left to the builder

- Exact Polish suffix list and tests.
- Raised item and product/alias bounds within the existing budget.
- Prompt wording for turn 1, turn 2 and alias generation.
- UI layout of alias review and salon shorthand list, following existing library and Settings patterns.
- Whether the learning-loop proposals live in the same review screen as document aliases.

## Next step

28 October: increments 1–3 are implemented and verified locally; cloud rollout remains pending. See the [classification handoff](../../implementation/knowledge-kind-origin.md), [product-review handoff](../../implementation/product-document-alias-review.md) and [alias-backed replenishment handoff](../../implementation/alias-backed-replenishment.md). Increment 3 adds SQL-backed lookup, lookup-only inflection, complete-catalog candidates for unknown wording and removable salon shorthand learned from receipted explicit choices. Owner decision (28 Oct): kept as built — a learned salon phrase resolves directly, so "a confirmed choice that contradicts an existing salon alias replaces it" is reachable only after removing the shorthand in Settings; an in-flow "not this product" path is not built. Two-turn model orchestration and dictation remain increment 4. Visible demo/synthetic text cleanup is recorded separately and does not authorize deleting source documents or data.
