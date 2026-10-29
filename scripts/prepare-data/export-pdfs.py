#!/usr/bin/env python3
"""Deterministically export the approved synthetic knowledge PDFs."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from html import escape

import PIL
import pypdf
import reportlab
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import HRFlowable, Paragraph, SimpleDocTemplate, Spacer
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[2]
FONT = Path(__file__).with_name("fonts") / "DejaVuSans.ttf"
FONT_SHA256 = "7da195a74c55bef988d0d48f9508bd5d849425c1770dba5d7bfc6ce9ed848954"


def parse_source(text: str) -> tuple[str, list[tuple[str, str]]]:
    lines = text.splitlines()
    title = next(line[2:].strip() for line in lines if line.startswith("# "))
    sections: list[tuple[str, str]] = []
    heading = ""
    body: list[str] = []
    for line in lines:
        if line.startswith("## "):
            if heading:
                sections.append((heading, " ".join(x.strip() for x in body if x.strip())))
            heading, body = line[3:].strip(), []
        elif heading and line.strip() and not line.startswith("#") and not line.startswith("**SYNTHETIC"):
            body.append(line.strip())
    if heading:
        sections.append((heading, " ".join(x.strip() for x in body if x.strip())))
    return title, sections


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def require_pinned_tools(font: Path) -> None:
    if (reportlab.Version, pypdf.__version__, PIL.__version__) != ("4.4.9", "6.10.0", "12.3.0"):
        raise SystemExit(f"install pinned tools from requirements.txt (found reportlab={reportlab.Version}, pypdf={pypdf.__version__}, Pillow={PIL.__version__})")
    if not font.is_file() or sha256(font) != FONT_SHA256:
        raise SystemExit("bundled DejaVu font is missing or its pinned hash changed")


def write_provenance(path: Path, source_hash: str, pdf_hash: str, document_id: str = "DAM-001", version: str = "v1") -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    data = {"documentId": document_id, "version": version, "sourceSha256": source_hash, "pdfSha256": pdf_hash}
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def render_pdf(source: str, output: Path, document_id: str, version: str, page_label: str, title: str,
               author: str = "DevFest synthetic fixture") -> None:
    require_pinned_tools(FONT)
    output.parent.mkdir(parents=True, exist_ok=True)
    title, sections = parse_source(source)
    pdfmetrics.registerFont(TTFont("DejaVu", str(FONT)))
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle("CorpusTitle", parent=styles["Title"], fontName="DejaVu", fontSize=21, leading=27, textColor=colors.HexColor("#16324F"), alignment=TA_LEFT, spaceAfter=5*mm))
    styles.add(ParagraphStyle("CorpusSection", parent=styles["Heading2"], fontName="DejaVu", fontSize=13, leading=17, textColor=colors.HexColor("#176B68"), spaceBefore=5*mm, spaceAfter=2*mm, keepWithNext=True))
    styles.add(ParagraphStyle("CorpusBody", parent=styles["BodyText"], fontName="DejaVu", fontSize=10, leading=15, spaceAfter=3*mm, textColor=colors.HexColor("#25313A"), splitLongWords=1))
    styles.add(ParagraphStyle("CorpusLabel", parent=styles["BodyText"], fontName="DejaVu", fontSize=8, leading=11, textColor=colors.HexColor("#176B68")))
    candidate = output.with_name(f".{output.name}.candidate")
    doc = SimpleDocTemplate(str(candidate), pagesize=A4, rightMargin=22*mm, leftMargin=22*mm, topMargin=23*mm, bottomMargin=22*mm, title=title, author=author, subject=f"{page_label}: {document_id} {version}", invariant=1)
    story = [Paragraph(escape(page_label), styles["CorpusLabel"]), Spacer(1, 5*mm), Paragraph(escape(title), styles["CorpusTitle"]), Paragraph(escape(f"{document_id} · Version {version} · {page_label}"), styles["CorpusBody"])]
    for line in source.splitlines():
        if line.startswith("**SYNTHETIC") or line.startswith("**UNOFFICIAL"):
            story.append(Paragraph(escape(line.strip("*")), styles["CorpusBody"]))
            break
    story.append(HRFlowable(width="100%", color=colors.HexColor("#D8E1E8"), thickness=0.8, spaceBefore=1*mm, spaceAfter=4*mm))
    for heading, body in sections:
        story += [Paragraph(escape(heading), styles["CorpusSection"]), Paragraph(escape(body), styles["CorpusBody"])]
    doc.build(story, onFirstPage=lambda canvas, page_doc: draw_page(canvas, page_doc, document_id, version, page_label), onLaterPages=lambda canvas, page_doc: draw_page(canvas, page_doc, document_id, version, page_label))
    candidate.replace(output)


def draw_page(canvas, doc, document_id: str = "DAM-001", version: str = "v1", page_label: str = "Synthetic demo procedure") -> None:
    canvas.saveState()
    width, _ = A4
    canvas.setFont("DejaVu", 8)
    canvas.setFillColor(colors.HexColor("#60717F"))
    canvas.drawString(22*mm, 13*mm, f"{document_id} {version} · {page_label}")
    canvas.drawRightString(width - 22*mm, 13*mm, f"Physical page {doc.page}")
    canvas.restoreState()


def corpus_entry(root: Path, document_id: str, version: str, source_rel: str, output_rel: str,
                 publication_status: str = "demo-current", synthetic: bool = True,
                 source_type: str = "synthetic-procedure", source_urls: list[str] | None = None,
                 observed_on: str | None = None, label: str = "SYNTHETIC DEMO PROCEDURE") -> dict:
    source_path = root / source_rel
    source = source_path.read_text(encoding="utf-8")
    title, _ = parse_source(source)
    output = root / output_rel
    source_hash = sha256(source_path)
    manifest_path = root / "data/knowledge/manifest.json"
    prior = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else []
    old_entry = next((item for item in prior if item.get("documentId") == document_id and item.get("version") == version), None)
    if document_id == "DAM-001" and version == "v1":
        if not output.is_file() or sha256(output) != "b6f877bd6ed8842e9b5e9fd1c679bf1d05322fae8dcad86a7deb7836b52f1edd":
            raise SystemExit("accepted DAM-001 v1 bytes changed; restore the approved PDF before corpus export")
        provenance_path = root / "data/knowledge/provenance/DAM-001-v1.json"
        if not provenance_path.is_file():
            raise SystemExit("accepted PDF provenance is missing; restore it before rerunning the exporter")
        provenance = json.loads(provenance_path.read_text(encoding="utf-8"))
        if provenance.get("sourceSha256") != source_hash or provenance.get("pdfSha256") != sha256(output):
            raise SystemExit("accepted DAM-001 v1 source/provenance identity changed; preserve it and create v2")
        if not old_entry or old_entry.get("sha256") != sha256(output):
            raise SystemExit("accepted DAM-001 v1 manifest identity changed; restore its approved entry")
        return old_entry
    if output.exists():
        if not old_entry or old_entry.get("sha256") != sha256(output):
            raise SystemExit(f"refusing to replace untracked or changed PDF bytes for {document_id} {version}")
        prov_path = root / "data/knowledge/provenance" / f"{document_id}-{version}.json"
        if not prov_path.is_file():
            raise SystemExit(f"accepted PDF provenance is missing for {document_id} {version}")
        provenance = json.loads(prov_path.read_text(encoding="utf-8"))
        if provenance.get("sourceSha256") != source_hash or provenance.get("pdfSha256") != old_entry["sha256"]:
            raise SystemExit(f"source/provenance identity changed for {document_id} {version}")
        return old_entry
    author = "DevFest public-product compilation" if source_type == "public-product-summary" else "DevFest synthetic fixture"
    render_pdf(source, output, document_id, version, label, title, author)
    digest = sha256(output)
    write_provenance(root / "data/knowledge/provenance" / f"{document_id}-{version}.json", source_hash, digest, document_id, version)
    return {
        "documentId": document_id, "version": version, "title": title, "language": "en",
        "businessKey": "not-bad-stuff-demo", "kind": "procedure" if synthetic else "product-catalog", "origin": "synthetic" if synthetic else "public-compilation",
        "publicationStatus": publication_status, "inputPdf": output_rel, "sha256": digest,
        "sourceUrls": source_urls or [], "observedOn": observed_on,
    }


def export_all(root: Path) -> None:
    sources = [
        ("DAM-001", "v1", "docs/synthetic-knowledge/damaged-delivery-v1.md", "data/knowledge/pdfs/DAM-001-v1.pdf", "demo-current", True, "synthetic-procedure", [], None, "SYNTHETIC DEMO PROCEDURE"),
        ("DIS-001", "v1", "docs/synthetic-knowledge/delivery-discrepancy-v1.md", "data/knowledge/pdfs/DIS-001-v1.pdf", "demo-current", True, "synthetic-procedure", [], None, "SYNTHETIC DEMO PROCEDURE"),
        ("REP-001", "v1", "docs/synthetic-knowledge/routine-replenishment-v1.md", "data/knowledge/pdfs/REP-001-v1.pdf", "demo-current", True, "synthetic-procedure", [], None, "SYNTHETIC DEMO PROCEDURE"),
        ("DAM-001", "v0", "docs/synthetic-knowledge/damaged-delivery-v0-retired.md", "data/knowledge/pdfs/DAM-001-v0.pdf", "retired", True, "synthetic-procedure", [], None, "SYNTHETIC RETIRED TEST FIXTURE"),
    ]
    entries = [corpus_entry(root, *spec) for spec in sources]
    path = root / "data/knowledge/manifest.json"
    # Entries this exporter does not render (product cards) stay as they are.
    exported = {(entry["documentId"], entry["version"]) for entry in entries}
    prior = json.loads(path.read_text(encoding="utf-8")) if path.exists() else []
    entries += [item for item in prior if (item.get("documentId"), item.get("version")) not in exported]
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(entries, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    for entry in entries:
        print(f"Corpus {entry['documentId']} {entry['version']} sha256={entry['sha256']}")


def export_replacement(root: Path) -> None:
    source_rel = "docs/synthetic-knowledge/damaged-delivery-v2-replacement.md"
    output_rel = "data/knowledge/replacements/DAM-001-v2.pdf"
    source_path = root / source_rel
    source = source_path.read_text(encoding="utf-8")
    title, _ = parse_source(source)
    output = root / output_rel
    manifest_path = root / "data/knowledge/replacement-manifest.json"
    old = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else []
    old_entry = next((item for item in old if item.get("documentId") == "DAM-001" and item.get("version") == "v2"), None)
    if output.exists():
        if not old_entry or old_entry.get("sha256") != sha256(output):
            raise SystemExit("refusing to replace untracked or changed DAM-001 v2 replacement bytes")
        provenance_path = root / "data/knowledge/replacements/DAM-001-v2.provenance.json"
        if not provenance_path.is_file():
            raise SystemExit("replacement PDF provenance is missing")
        provenance = json.loads(provenance_path.read_text(encoding="utf-8"))
        if provenance.get("sourceSha256") != sha256(source_path) or provenance.get("pdfSha256") != old_entry["sha256"]:
            raise SystemExit("replacement source/provenance identity changed")
        print(f"Preserved replacement DAM-001 v2 sha256={old_entry['sha256']}")
        return
    render_pdf(source, output, "DAM-001", "v2", "SYNTHETIC REPLACEMENT TEST FIXTURE", title)
    digest = sha256(output)
    entry = {"documentId": "DAM-001", "version": "v2", "title": title, "language": "en", "businessKey": "not-bad-stuff-demo", "kind": "procedure", "origin": "synthetic", "publicationStatus": "demo-current", "inputPdf": output_rel, "sha256": digest, "sourceUrls": [], "observedOn": None}
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps([entry], ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    provenance_path = root / "data/knowledge/replacements/DAM-001-v2.provenance.json"
    provenance_path.parent.mkdir(parents=True, exist_ok=True)
    provenance_path.write_text(json.dumps({"documentId": "DAM-001", "version": "v2", "sourceSha256": sha256(source_path), "pdfSha256": digest}, indent=2) + "\n", encoding="utf-8")
    print(f"Replacement DAM-001 v2 sha256={digest}")


def source_matches_pdf(source: str, pdf_path: Path) -> bool:
    text = " ".join(" ".join(PdfReader(str(pdf_path)).pages[0].extract_text().split()).split())
    title, sections = parse_source(source)
    blocks = [title, next(line.strip("*") for line in source.splitlines() if line.startswith("**SYNTHETIC"))]
    for heading, body in sections:
        blocks.extend((heading, body))
    return all(" ".join(block.split()) in text for block in blocks)


def ensure_fixtures(fixtures: Path, font: Path) -> None:
    fixtures.mkdir(parents=True, exist_ok=True)
    expected = {"geometry.pdf", "scanned.pdf", "mixed.pdf"}
    missing = expected - {path.name for path in fixtures.glob("*.pdf")}
    if "geometry.pdf" in missing:
        build_geometry_fixture(fixtures, font)
    if missing & {"scanned.pdf", "mixed.pdf"}:
        build_scan_fixtures(fixtures, font, missing & {"scanned.pdf", "mixed.pdf"})
    for name in expected:
        path = fixtures / name
        if not path.is_file() or not PdfReader(str(path)).pages:
            raise SystemExit(f"invalid test fixture {path}; restore it from a clean export")
    geometry = PdfReader(str(fixtures / "geometry.pdf")).pages[0]
    geometry_text = " ".join(geometry.extract_text().split())
    if geometry.get("/Rotate") != 90 or list(geometry.cropbox.lower_left) != [28, 35] or "Łódzka" not in geometry_text:
        raise SystemExit("invalid geometry fixture; restore it from a clean export")
    scanned_text = " ".join(PdfReader(str(fixtures / "scanned.pdf")).pages[0].extract_text().split())
    mixed_text = " ".join(PdfReader(str(fixtures / "mixed.pdf")).pages[0].extract_text().split())
    if scanned_text or "Selectable text: keep affected units separate." not in mixed_text or "VISIBLE SCAN TEXT" in mixed_text:
        raise SystemExit("invalid scan/mixed fixture extraction contract; restore it from a clean export")


def main() -> None:
    parser = argparse.ArgumentParser()
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument("--all", action="store_true", help="export the five initial corpus PDFs")
    modes.add_argument("--replacement", action="store_true", help="export the separate DAM-001 v2 replacement fixture")
    parser.add_argument("--document")
    parser.add_argument("--version")
    parser.add_argument("--root", type=Path, default=ROOT, help=argparse.SUPPRESS)
    args = parser.parse_args()
    root = args.root.resolve()
    if args.all:
        if args.document or args.version:
            parser.error("--all cannot be combined with --document or --version")
        export_all(root)
        return
    if args.replacement:
        if args.document or args.version:
            parser.error("--replacement cannot be combined with --document or --version")
        export_replacement(root)
        return
    if (args.document, args.version) != ("DAM-001", "v1"):
        parser.error("use --all, --replacement, or the legacy --document DAM-001 --version v1 mode")
    source_path = root / "docs/synthetic-knowledge/damaged-delivery-v1.md"
    output = root / "data/knowledge/pdfs/DAM-001-v1.pdf"
    manifest_path = root / "data/knowledge/manifest.json"
    provenance_path = root / "data/knowledge/provenance/DAM-001-v1.json"
    fixtures = root / "tests/fixtures/pdf"
    source_bytes = source_path.read_bytes()
    source_hash = hashlib.sha256(source_bytes).hexdigest()
    if output.exists() or manifest_path.exists() or provenance_path.exists():
        old_manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else []
        old_entry = next((item for item in old_manifest if item.get("documentId") == args.document and item.get("version") == args.version), None)
        if not output.exists() or not old_entry or old_entry.get("sha256") != sha256(output):
            raise SystemExit("refusing to replace accepted PDF bytes or manifest identity for this version; create a new version")
        if provenance_path.exists():
            provenance = json.loads(provenance_path.read_text(encoding="utf-8"))
            if provenance.get("sourceSha256") != source_hash:
                raise SystemExit("canonical authoring source changed for accepted DAM-001 v1; preserve its PDF and create v2")
            if provenance.get("pdfSha256") != old_entry["sha256"]:
                raise SystemExit("export provenance does not match the accepted DAM-001 v1 PDF; restore its provenance")
        else:
            raise SystemExit("accepted PDF provenance is missing; restore its provenance before rerunning the exporter")
        ensure_fixtures(fixtures, FONT)
        print(f"Preserved accepted {args.document} {args.version} sha256={old_entry['sha256']}")
        return
    source = source_bytes.decode("utf-8")
    require_pinned_tools(FONT)

    output.parent.mkdir(parents=True, exist_ok=True)
    fixtures.mkdir(parents=True, exist_ok=True)
    title, sections = parse_source(source)
    pdfmetrics.registerFont(TTFont("DejaVu", str(FONT)))
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle("DocTitle", parent=styles["Title"], fontName="DejaVu", fontSize=21, leading=27, textColor=colors.HexColor("#16324F"), alignment=TA_LEFT, spaceAfter=5*mm))
    styles.add(ParagraphStyle("Section", parent=styles["Heading2"], fontName="DejaVu", fontSize=13, leading=17, textColor=colors.HexColor("#176B68"), spaceBefore=5*mm, spaceAfter=2*mm, keepWithNext=True))
    styles.add(ParagraphStyle("BodyDejaVu", parent=styles["BodyText"], fontName="DejaVu", fontSize=10, leading=15, spaceAfter=3*mm, textColor=colors.HexColor("#25313A")))
    styles.add(ParagraphStyle("Label", parent=styles["BodyText"], fontName="DejaVu", fontSize=8, leading=11, textColor=colors.HexColor("#176B68")))
    candidate = output.with_name(f".{output.name}.candidate")
    doc = SimpleDocTemplate(str(candidate), pagesize=A4, rightMargin=22*mm, leftMargin=22*mm, topMargin=23*mm, bottomMargin=22*mm, title=title, author="DevFest synthetic fixture", subject="Synthetic demo procedure DAM-001 v1", invariant=1)
    disclaimer = next(line.strip("*") for line in source.splitlines() if line.startswith("**SYNTHETIC"))
    story = [Paragraph("SYNTHETIC DEMO PROCEDURE", styles["Label"]), Spacer(1, 5*mm), Paragraph(title, styles["DocTitle"]), Paragraph("DAM-001 · Version v1 · Synthetic demo procedure", styles["BodyDejaVu"]), Paragraph(disclaimer.replace("&", "&amp;"), styles["BodyDejaVu"]), HRFlowable(width="100%", color=colors.HexColor("#D8E1E8"), thickness=0.8, spaceBefore=1*mm, spaceAfter=4*mm)]
    for heading, body in sections:
        story += [Paragraph(heading.replace("&", "&amp;"), styles["Section"]), Paragraph(body.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"), styles["BodyDejaVu"])]
    doc.build(story, onFirstPage=draw_page, onLaterPages=draw_page)
    ensure_fixtures(fixtures, FONT)
    candidate_hash = sha256(candidate)
    candidate.replace(output)
    entry = {
        "documentId": "DAM-001", "version": "v1", "title": title,
        "language": "en", "businessKey": "not-bad-stuff-demo", "synthetic": True,
        "sourceType": "synthetic-procedure", "publicationStatus": "demo-current",
        "inputPdf": "data/knowledge/pdfs/DAM-001-v1.pdf", "sha256": candidate_hash,
        "sourceUrls": [], "observedOn": None,
    }
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps([entry], ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    write_provenance(provenance_path, source_hash, candidate_hash)
    print(f"Exported {output.relative_to(root)} sha256={entry['sha256']}")


def build_geometry_fixture(fixtures: Path, font: Path) -> None:
    from pypdf import PdfWriter
    from reportlab.pdfgen import canvas as canvas_module
    from io import BytesIO

    buf = BytesIO()
    c = canvas_module.Canvas(buf, pagesize=A4, pageCompression=0, invariant=1)
    pdfmetrics.registerFont(TTFont("DejaVu", str(font)))
    c.setFont("DejaVu", 13)
    c.drawString(80, 740, "Łódzka salon - first accented line")
    c.drawString(80, 718, "Second line: affected item is not saleable")
    c.drawString(80, 696, "Printed page label: 7; physical page: 1")
    c.showPage()
    c.save()
    reader = PdfReader(BytesIO(buf.getvalue()))
    page = reader.pages[0]
    page.rotate(90)
    page.cropbox.lower_left = (28, 35)
    page.cropbox.upper_right = (560, 800)
    writer = PdfWriter()
    writer.add_page(page)
    with (fixtures / "geometry.pdf").open("wb") as stream:
        writer.write(stream)


def build_scan_fixtures(fixtures: Path, font_path: Path, names: set[str]) -> None:
    from io import BytesIO
    from PIL import Image, ImageDraw, ImageFont
    from reportlab.lib.utils import ImageReader
    from reportlab.pdfgen import canvas as canvas_module

    fixtures.mkdir(parents=True, exist_ok=True)
    pdfmetrics.registerFont(TTFont("DejaVu", str(font_path)))
    font = ImageFont.truetype(str(font_path), 34)
    image = Image.new("RGB", (1200, 500), "white")
    draw = ImageDraw.Draw(image)
    draw.text((60, 70), "VISIBLE SCAN TEXT: HOLD DAMAGED UNIT", font=font, fill="#111111")
    draw.text((60, 150), "IMAGE WORDS: REPORT BATCH WHEN READABLE", font=font, fill="#111111")
    for name, mixed in (("scanned.pdf", False), ("mixed.pdf", True)):
        if name not in names:
            continue
        buf = BytesIO()
        c = canvas_module.Canvas(buf, pagesize=A4, pageCompression=0, invariant=1)
        if mixed:
            c.setFont("DejaVu", 12)
            c.drawString(54, 760, "Selectable text: keep affected units separate.")
            c.drawImage(ImageReader(image), 54, 530, width=480, height=200)
        else:
            c.drawImage(ImageReader(image), 54, 570, width=480, height=200)
        c.showPage()
        c.save()
        path = fixtures / name
        path.write_bytes(buf.getvalue())


if __name__ == "__main__":
    main()
