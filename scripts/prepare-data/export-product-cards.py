#!/usr/bin/env python3
"""Export one PRODUCT_CARD PDF per catalog product from the public research snapshot.

Facts come only from docs/not-bad-stuff-products.json. Aliases are not written into cards:
HQ generates and reviews them in Product knowledge after upload.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
export_pdfs = __import__("export-pdfs")

ROOT = Path(__file__).resolve().parents[2]
SOURCE_DIR = ROOT / "docs/synthetic-knowledge/product-cards"
PDF_DIR = ROOT / "data/knowledge/pdfs/product-cards"
LABEL = "UNOFFICIAL PUBLIC PRODUCT CARD"


def card(product: dict, catalog: dict) -> str:
    price = product["displayedRetailPrice"]
    size = product["netContent"]
    scent = product.get("scentPl") or "brak informacji"
    return f"""# {product['name']} — karta produktu

**UNOFFICIAL PUBLIC PRODUCT CARD — compiled from the public research snapshot observed {catalog['observedOn']}. Not a live inventory feed.**

## Identyfikacja produktu

Produkt: {product['name']}. Marka: {product['brand']}. Kod (pole KOD ze strony): {product['sourceCode']}. Kategoria: {product['category']}. Pojemność netto: {size['value']} {size['unit']}.

## Opis

{product['summaryEn']} Zapach: {scent}.

## Cena i źródło

Publiczna cena detaliczna: {price['amount']} {price['currency']}. Źródło: {product['sourceUrl']}. Stan obserwacji: {product['observedOn']}.
"""


def main() -> None:
    catalog = json.loads((ROOT / "docs/not-bad-stuff-products.json").read_text(encoding="utf-8"))
    SOURCE_DIR.mkdir(parents=True, exist_ok=True)
    for product in catalog["products"]:
        code = f"CARD-{product['demoId']}"
        source = card(product, catalog)
        (SOURCE_DIR / f"{code}.md").write_text(source, encoding="utf-8")
        export_pdfs.render_pdf(source, PDF_DIR / f"{code}-v1.pdf", code, "v1", LABEL, product["name"],
                               author="DevFest public product card")
        print(code, PDF_DIR / f"{code}-v1.pdf")


if __name__ == "__main__":
    main()
