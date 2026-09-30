# Not Bad Stuff — real catalog for the demo

Collected on **22 September 2026**, using **Chrome** to read six public product detail pages on [notbadstuff.pl](https://notbadstuff.pl/). This is a dated research snapshot, not a live catalog or inventory integration. The salon replenishment assistant is confirmed as the demo direction.

## Confirmed business context

- Cosmetics brand: **Not Bad Stuff** — confirmed by the user and the public website.
- Salons: **Legnicka, Łódzka, Zakładowa** — supplied by the user; these names were not independently verified through the product pages.
- Main demo: Legnicka requests **Pomada Matowa 100 ml**.
- Other salons: Łódzka and Zakładowa; Zakładowa hosts the separate damaged-delivery question.
- “BarberHQ” remains the working application name, not an existing Not Bad Stuff product.

## Extracted product facts

Prices are the displayed public retail prices in PLN at collection time, not wholesale prices, transfer values or a promise of future pricing. “Code” preserves the site's **KOD** field; it is not relabeled as an official SKU or verified barcode standard.

| Product / source | Published code | Net contents | Displayed price | Website category |
|---|---|---|---:|---|
| [Pomada Matowa](https://notbadstuff.pl/produkt/pomada-matowa-do-wlosow-100ml) | `5905191055165` | 100 ml | 69.00 PLN | Pomady |
| [Pomada Dry Matt](https://notbadstuff.pl/produkt/pomada-dry-matt-do-wlosow-100ml) | `5905191055035` | 100 ml | 69.00 PLN | Pomady |
| [Pomada Cement](https://notbadstuff.pl/produkt/pomada-cement-do-wlosow-100ml) | `5905191055127` | 100 ml | 69.00 PLN | Pomady |
| [Sól Morska](https://notbadstuff.pl/produkt/sol-morska-do-wlosow-200ml) | `5905191055080` | 200 ml | 49.00 PLN | Lekka Stylizacja |
| [Olejek do brody — Savage](https://notbadstuff.pl/produkt/olejek-do-brody-savage-50ml) | `5905191055974` | 50 ml | 78.00 PLN | Broda zarost i golenie |
| [Mattifier](https://notbadstuff.pl/produkt/notbad-mattifier-100ml) | `5905191055479` | 100 ml | 79.00 PLN | Lekka Stylizacja |

The Savage page displays its title as “Olejek do brody | Savage”; the structured snapshot preserves that punctuation. Product names and diacritics should remain unchanged in the UI even if explanatory text is English.

## Useful distinctions for catalog lookup

These brief summaries paraphrase the linked brand descriptions; they are not independent product tests.

- **Pomada Matowa:** matte, medium-strong hold for classic, controlled styling; grape scent.
- **Dry Matt:** stronger, dry-texture styling; forest-fruit scent.
- **Cement:** volume and airy, fluffy texture; mango/passion-fruit scent.
- **Sól Morska:** light-hold texturizing spray, usable alone or before pomade.
- **Savage:** care for medium/long beards, with softening and detangling positioning.
- **Mattifier:** cream prestyler; the brand discourages use on very fine, limp hair.

“Matowa pomada” is a useful ambiguity case: it can describe several products, although **Pomada Matowa** is also an exact product name. An explicit catalog selection/code or clearly named product resolves it; casual “ta matowa” / “the matte stuff” should trigger clarification among Matowa, Dry Matt and Cement. Product similarity does not authorize substitution.

Keep lookup grounded in these distinctions without expanding the MVP into a cosmetic recommendation chatbot. Public product descriptions can support catalog identification; internal replenishment documents support the transfer explanation. Keep their source types distinct.

## Local identifiers and structured snapshot

[not-bad-stuff-products.json](not-bad-stuff-products.json) contains the six records, source URLs, observation date, net contents, prices and short summaries.

| Invented demo ID | Product |
|---|---|
| `NBS-MATOWA-100` | Pomada Matowa 100 ml |
| `NBS-DRYMATT-100` | Pomada Dry Matt 100 ml |
| `NBS-CEMENT-100` | Pomada Cement 100 ml |
| `NBS-SOL-200` | Sól Morska 200 ml |
| `NBS-SAVAGE-50` | Olejek do brody — Savage 50 ml |
| `NBS-MATTIFIER-100` | Mattifier 100 ml |

These IDs are for future demo seeding only. Preserve the separate `sourceCode` value as a string. The JSON is a research artifact, not application implementation.

## Facts versus demo assumptions

| Data | Provenance / treatment |
|---|---|
| Names, product codes, net contents, displayed prices | Observed public product pages |
| Salon names | User confirmation |
| Initial HQ 18, Legnicka 2; request 2 individual units | Synthetic demo fixture; not inferred from the website |
| Approval/dispatch/receipt roles and procedure text | Proposed workflow assumptions pending business validation |
| B2B prices or internal stock | Not collected; public site links to a separate B2B area |
| Package dimensions, shipping weight, actual case quantities | Not established by the collected pages; JSON fields remain null |

Net contents in millilitres do not establish weight or external package dimensions. The Savage page also carried a temporary notice about shipping plastic bottles while remaining stock lasts. That does not establish which packaging a future order will receive; recheck before using packaging data in a later packing workflow.

The stage arithmetic is **2 requested → 2 dispatched → 2 received**, using Pomada Matowa at Legnicka: HQ stock 18 → 16 and salon stock 2 → 4. The separate damaged-delivery RAG case uses the [synthetic corpus](synthetic-knowledge/README.md) and does not change stock. The UI should label its stock and policy data “Demo” so the audience can distinguish the real business/catalog from the simulated operation.
