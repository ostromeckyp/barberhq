import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const pdfPath = resolve(root, 'data/knowledge/pdfs/DAM-001-v1.pdf');
const manifestPath = resolve(root, 'data/knowledge/manifest.json');

async function readPdf(path: string) {
  const bytes = new Uint8Array(readFileSync(path));
  const document = await getDocument({ data: bytes, useSystemFonts: true }).promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push({
      rotate: page.rotate,
      view: page.view,
      text: content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim(),
    });
  }
  return { document, pages };
}

describe('canonical_pdf_matches_manifest', () => {
  it('matches the exact manifest contract and preserves every canonical text block', async () => {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const pdfBytes = readFileSync(pdfPath);
    const damV1 = manifest.find(
      (item: { documentId: string; version: string }) =>
        item.documentId === 'DAM-001' && item.version === 'v1',
    );
    expect(damV1).toMatchObject({
      documentId: 'DAM-001',
      version: 'v1',
      origin: 'synthetic',
      publicationStatus: 'demo-current',
      businessKey: 'not-bad-stuff-demo',
      kind: 'procedure',
      language: 'en',
      observedOn: null,
      inputPdf: 'data/knowledge/pdfs/DAM-001-v1.pdf',
      sourceUrls: [],
      deliveryProblemKind: 'DAMAGED',
    });
    expect(Object.keys(damV1).sort()).toEqual(
      [
        'businessKey',
        'deliveryProblemKind',
        'documentId',
        'inputPdf',
        'language',
        'observedOn',
        'publicationStatus',
        'sha256',
        'kind',
        'sourceUrls',
        'origin',
        'title',
        'version',
      ].sort(),
    );
    expect(createHash('sha256').update(pdfBytes).digest('hex')).toBe(damV1.sha256);
    expect(pdfBytes.subarray(0, 5).toString()).toBe('%PDF-');

    const { document, pages } = await readPdf(pdfPath);
    expect(document.numPages).toBeGreaterThan(0);
    const extracted = pages.map((page) => page.text).join(' ');
    const source = readFileSync(
      resolve(root, 'docs/synthetic-knowledge/damaged-delivery-v1.md'),
      'utf8',
    ).replace(/^---[\s\S]*?---\s*/, '');
    const blocks = source
      .split(/\n\s*\n/)
      .map((block) =>
        block
          .replace(/^#+\s*/, '')
          .replace(/\*\*/g, '')
          .replace(/\s+/g, ' ')
          .trim(),
      )
      .filter(Boolean);
    for (const block of blocks) expect(extracted).toContain(block);
    expect(extracted).toContain(
      'SYNTHETIC DEMO PROCEDURE — invented for DevFest, not an actual Not Bad Stuff policy.',
    );
    expect(extracted).toContain('Do not mark an affected unit as received in saleable stock');
    expect(extracted).toContain('does not automatically authorize replacement stock');
  });

  it('keeps geometry, raster scan, and mixed fixtures out of the ingestion manifest', async () => {
    const geometry = await readPdf(resolve(root, 'tests/fixtures/pdf/geometry.pdf'));
    expect(geometry.document.numPages).toBe(1);
    expect(geometry.pages[0].rotate).toBe(90);
    expect(geometry.pages[0].view).toEqual([28, 35, 560, 800]);
    expect(geometry.pages[0].text).toContain('Łódzka salon - first accented line');
    expect(geometry.pages[0].text).toContain('Printed page label: 7; physical page: 1');

    const mixed = await readPdf(resolve(root, 'tests/fixtures/pdf/mixed.pdf'));
    expect(mixed.pages[0].text).toContain('Selectable text: keep affected units separate.');
    expect(mixed.pages[0].text).not.toContain('VISIBLE SCAN TEXT');
    const scanned = await readPdf(resolve(root, 'tests/fixtures/pdf/scanned.pdf'));
    expect(scanned.pages[0].text).toBe('');
    expect(
      JSON.parse(readFileSync(manifestPath, 'utf8')).map(
        (item: { inputPdf: string }) => item.inputPdf,
      ),
    ).not.toContain('tests/fixtures/pdf/geometry.pdf');
    expect(
      JSON.parse(readFileSync(manifestPath, 'utf8')).map(
        (item: { inputPdf: string }) => item.inputPdf,
      ),
    ).not.toContain('tests/fixtures/pdf/scanned.pdf');
    expect(
      JSON.parse(readFileSync(manifestPath, 'utf8')).map(
        (item: { inputPdf: string }) => item.inputPdf,
      ),
    ).not.toContain('tests/fixtures/pdf/mixed.pdf');
  });
});
