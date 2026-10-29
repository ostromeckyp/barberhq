# Local corpus review package

Status: **owner approved all six new physical pages; initial corpus imported and verified in cloud**. DAM-001 v1's existing approval and publication remain unchanged.

Owner replied “Zatwierdzam wszystkie 6 stron do demo”. Approval was recorded on 15 October 2026 against the final identities below; exact original approval time was not captured. Identity-bound receipts for each new version are stored beside this record. Approval of retired v0 and separate replacement v2 does not authorize activating either version.

This package contains the five initial manifest inputs and a separate replacement fixture. `DIS-001` is the delivery discrepancy procedure. `DAM-001 v0` is retired and must remain excluded from current retrieval. The replacement `DAM-001 v2` is stored in its own manifest and folder and is not an initial corpus input.

## PDFs and identity

| Input | Pages | SHA-256 | Manifest state |
|---|---:|---|---|
| `data/knowledge/pdfs/DAM-001-v1.pdf` | 1 | `b6f877bd6ed8842e9b5e9fd1c679bf1d05322fae8dcad86a7deb7836b52f1edd` | demo-current, synthetic; preserved approved bytes |
| `data/knowledge/pdfs/DIS-001-v1.pdf` | 1 | `f4151a551d563b38f9c5a091e12351ae12a89ad5372ac606cb58ca2aa6b2cbe1` | demo-current, synthetic delivery discrepancy |
| `data/knowledge/pdfs/REP-001-v1.pdf` | 1 | `6e77d188584821a51b33d9f3a7e619b98d854e0e56b681f56f0580be516c302b` | demo-current, synthetic |
| `data/knowledge/pdfs/DAM-001-v0.pdf` | 1 | `3223bd53e7468e446b7133c940749022bd3b1c5dd0b47a7342c4fccdc6346deb` | retired, synthetic |
| `data/knowledge/pdfs/CAT-001-v1.pdf` | 2 | `e49dd14c6701df281b45c5915fe25044c1abcc59daeb182e637b283e86a2af11` | demo-current, public-product-summary; not synthetic |
| `data/knowledge/replacements/DAM-001-v2.pdf` | 1 | `25f6ce1feeb3b43626b1ffe32f067823bb91c7b3bab959d218b6cc9d75289d99` | separate replacement fixture |

The initial manifest has five entries: four `demo-current`, four synthetic, and one non-synthetic `CAT-001`. The replacement manifest contains only `DAM-001 v2`. Every generated PDF has a matching source/PDF provenance record with its own document ID and version.

## Product guide source boundary

`CAT-001 v1` was built only from `docs/not-bad-stuff-products.json`; no live product pages were fetched. It carries all six product names, recorded codes, net contents, public retail prices, category/summary facts, source URLs, and the `2026-09-22` observation date. Both pages are labeled **UNOFFICIAL PUBLIC-PRODUCT COMPILATION**. The PDF `/Author` metadata is `DevFest public-product compilation`. The PDF says that prices are public retail prices, sizes are net contents, and the website KOD field was not independently verified. It adds no package dimensions, shipping weights, transfer pack sizes, or policies.

## Page review and extraction artifacts

The six PDFs above rendered to seven 120 dpi PNG pages with Ghostscript 10.07.0. Visual inspection of each rendered page found legible headings/body text, visible per-page labels and physical page footers, and no clipped text or overlap. The product guide spans two pages; both pages carry the unofficial compilation label. This is preparation review only and does not record owner approval.

Rendered pages are in `artifacts/corpus-review/rendered/`:

| Page | SHA-256 |
|---|---|
| `DAM-001-v1-page-01.png` | `741ae34a65320e859df12fb9bfd1ecb9023f753bbc4c1792e914b434e8e3b0ac` |
| `DIS-001-v1-page-01.png` | `6cf3866e0115ab4e2473e293674fba08d0ba1501525eeaa50691cc2b93cf9cd1` |
| `REP-001-v1-page-01.png` | `9960dc295cc2c94461549abc10e8f9682a47c1350ecf05bdd58026970e788379` |
| `DAM-001-v0-page-01.png` | `89b623ec8c591c028b738475c12d77280bcf0012b092ff66812a6f6967b98ba2` |
| `CAT-001-v1-page-01.png` | `01f68c137634b91fbd4f3328ee05a4a4916ddfad40ad1165e2b2bc79d2f928c1` |
| `CAT-001-v1-page-02.png` | `42ff05104b67bf2bf70c3b40257ff16bb4318e7acab9fa17c20c522d0601c3c0` |
| `DAM-001-v2-page-01.png` | `37d50b3cc91f761f029949d095fd6a8907482b9f95edb2a185f8704b1a315628` |

Actual PDF.js text extraction (pdfjs-dist 6.4.299), not Markdown authoring text, is saved per PDF in `artifacts/corpus-review/extracted/`:

| Extracted pages | SHA-256 |
|---|---|
| `DAM-001-v1.json` | `c1ccb3acc169bfe6de75cee28d400bb5ccf10d66885317e85f52ab6cad3a11b0` |
| `DIS-001-v1.json` | `35b64a844d58d5ed058819a6fd259d424f5cee140efdfa768c7ca20978b43200` |
| `REP-001-v1.json` | `12f671a7e56f2e7a539c38b4a591852bdd8cbf4f35d194d293cedf4fc8699d75` |
| `DAM-001-v0.json` | `60e9e858eed6cf4630556828b4b4725605d11c6f67e7854035ed6f62f09909f3` |
| `CAT-001-v1.json` | `91bab49391198d68b4c21691149dea9831094b2d55bcb09ba16716812e2f23f1` |
| `DAM-001-v2.json` | `bc5666395f3d2421e8f1073bd288924296fd3539ab922d979cdde206f1979128` |

The production parser/chunker (`functions/src/knowledge/extract.ts` and `chunk.ts`) was also run against every PDF. All pages returned `COMPLETE`; page-local chunks were produced for every input. Geometry results:

| PDF | Parser extraction hash | Pages | Chunks | Geometry verified / unavailable |
|---|---|---:|---:|---:|
| DAM-001 v1 | `5162f3631d6e7a49b64a857fe2a9bc0689484fb5710174638db2d3c3ddf2c9ca` | 1 | 4 | 4 / 0 |
| DIS-001 v1 | `1e72bbcc0803c0172f7eabc0f0955afa168a1efdea42d658b24d43a9aceefbe1` | 1 | 3 | 3 / 0 |
| REP-001 v1 | `067ee8b74066204dfc36cffac0b19a3d3a2e4509e70a237d5498fc034923d74c` | 1 | 3 | 3 / 0 |
| DAM-001 v0 | `4ae1356ef79ca93ae40502809214ba37d6c9b31e657572a2be21c4ab2cdf60eb` | 1 | 2 | 2 / 0 |
| CAT-001 v1 | `311a3270995e6408a8a7231422eb3eeb2795852343249122b4baac482e6c70b2` | 2 | 3 | 1 / 2 |
| DAM-001 v2 replacement | `d8627763e00602f2cfd5bf520797eebc3002f549d8e5e3b8800d4431dd5e2277` | 1 | 1 | 1 / 0 |

CAT-001 page text extraction is complete, but two of its three chunks have unavailable span geometry. Review those source locations before any workflow that relies on chunk rectangles. Page-level citations remain available.

## Reproducibility and cloud handling

Exports used Python 3.12.14 from the bundled Codex Python runtime, ReportLab 4.4.9, pypdf 6.10.0, Pillow 12.3.0, and the bundled DejaVu Sans font (SHA-256 `7da195a74c55bef988d0d48f9508bd5d849425c1770dba5d7bfc6ce9ed848954`). PDF.js extraction used Node.js v22.22.3. Re-running `--all` and `--replacement` preserved all 14 manifest, PDF, and provenance file hashes, including the existing DAM-001 v1 approved PDF hash.

The 14 October local-preparation slice performed no cloud writes. On 15 October the approved five-version initial corpus was imported after adding durable publication classification and verifying retired-version guards. Four versions are current and active; DAM-001 v0 is READY, RETIRED, inactive and unpublished. The v2 replacement remains local. PostgreSQL holds 15 vectors of 768 dimensions, 13 eligible for retrieval; the compiled search/publication guards and repeat-import idempotency were checked in cloud. Existing DAM-001 v1 and all stock/request data are unchanged. See the [cloud acceptance handoff](../../../docs/implementation/handoffs/increment-3b.md) for commands, proof records and remaining HQ library scope.
