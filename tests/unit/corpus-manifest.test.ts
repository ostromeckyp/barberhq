import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { describe, expect, it } from 'vitest';
import { extractPdf } from '../../functions/src/knowledge/extract.js';
import { chunkPages } from '../../functions/src/knowledge/chunk.js';

const root = process.cwd();
const manifestPath = resolve(root, 'data/knowledge/manifest.json');
// Product cards are seed data for the demo reset, covered by knowledge-seed.test.ts.
const manifest = (
  JSON.parse(readFileSync(manifestPath, 'utf8')) as Array<Record<string, unknown>>
).filter((document) => document.kind !== 'product-card');

async function pdfText(path: string): Promise<string[]> {
  const data = new Uint8Array(readFileSync(resolve(root, path)));
  const pdf = await getDocument({ data, useSystemFonts: true }).promise;
  const result: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    result.push(
      content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim(),
    );
  }
  return result;
}

describe('initial knowledge corpus', () => {
  it('four_inputs_three_current_and_correct_provenance', async () => {
    expect(manifest).toHaveLength(4);
    expect(
      manifest.filter((document) => document.publicationStatus === 'demo-current'),
    ).toHaveLength(3);
    expect(manifest.filter((document) => document.origin === 'synthetic')).toHaveLength(4);
    // Product facts live on the per-product cards (knowledge-seed.test.ts); no catalog compilation.
    expect(manifest.some((document) => document.documentId === 'CAT-001')).toBe(false);
    expect(manifest.some((document) => document.version === 'v2')).toBe(false);
    expect(
      manifest.find((document) => document.documentId === 'DAM-001' && document.version === 'v0'),
    ).toMatchObject({ publicationStatus: 'retired', origin: 'synthetic' });

    const expectedInputs = [
      'data/knowledge/pdfs/DAM-001-v1.pdf',
      'data/knowledge/pdfs/DIS-001-v1.pdf',
      'data/knowledge/pdfs/REP-001-v1.pdf',
      'data/knowledge/pdfs/DAM-001-v0.pdf',
    ];
    expect(manifest.map((document) => document.inputPdf)).toEqual(expectedInputs);
    expect(
      manifest.every(
        (document) =>
          typeof document.sha256 === 'string' && /^[a-f0-9]{64}$/.test(document.sha256 as string),
      ),
    ).toBe(true);
    expect(manifest.some((document) => /README|evaluation/i.test(String(document.inputPdf)))).toBe(
      false,
    );

    const sourceByPdf: Record<string, string> = {
      'data/knowledge/pdfs/DAM-001-v1.pdf': 'docs/synthetic-knowledge/damaged-delivery-v1.md',
      'data/knowledge/pdfs/DIS-001-v1.pdf': 'docs/synthetic-knowledge/delivery-discrepancy-v1.md',
      'data/knowledge/pdfs/REP-001-v1.pdf': 'docs/synthetic-knowledge/routine-replenishment-v1.md',
      'data/knowledge/pdfs/DAM-001-v0.pdf':
        'docs/synthetic-knowledge/damaged-delivery-v0-retired.md',
    };
    for (const document of manifest) {
      const pages = await pdfText(String(document.inputPdf));
      expect(pages.length).toBeGreaterThan(0);
      const digest = createHash('sha256')
        .update(readFileSync(resolve(root, String(document.inputPdf))))
        .digest('hex');
      expect(digest).toBe(document.sha256);
      const productionExtraction = await extractPdf(
        new Uint8Array(readFileSync(resolve(root, String(document.inputPdf)))),
      );
      const chunks = chunkPages(productionExtraction);
      expect(productionExtraction.quality).toBe('COMPLETE');
      expect(productionExtraction.pages.map((page) => page.quality)).toEqual(
        pages.map(() => 'COMPLETE'),
      );
      expect(chunks.length).toBeGreaterThan(0);
      const verifiedGeometry = chunks.filter((chunk) => chunk.geometryStatus === 'VERIFIED').length;
      const unavailableGeometry = chunks.filter(
        (chunk) => chunk.geometryStatus === 'UNAVAILABLE',
      ).length;
      expect(verifiedGeometry + unavailableGeometry).toBe(chunks.length);
      expect(verifiedGeometry).toBeGreaterThan(0);
      expect(verifiedGeometry).toBe(chunks.length);
      const provenance = JSON.parse(
        readFileSync(
          resolve(
            root,
            `data/knowledge/provenance/${document.documentId}-${document.version}.json`,
          ),
          'utf8',
        ),
      );
      expect(provenance).toMatchObject({
        documentId: document.documentId,
        version: document.version,
        pdfSha256: digest,
      });
      expect(provenance.sourceSha256).toBe(
        createHash('sha256')
          .update(readFileSync(resolve(root, sourceByPdf[String(document.inputPdf)])))
          .digest('hex'),
      );
      if (document.origin === 'synthetic')
        expect(pages.every((page) => page.includes('SYNTHETIC'))).toBe(true);
    }

    const replacement = JSON.parse(
      readFileSync(resolve(root, 'data/knowledge/replacement-manifest.json'), 'utf8'),
    );
    expect(replacement).toHaveLength(1);
    expect(replacement[0]).toMatchObject({
      documentId: 'DAM-001',
      version: 'v2',
      origin: 'synthetic',
      publicationStatus: 'demo-current',
    });
    expect(replacement[0].inputPdf).toBe('data/knowledge/replacements/DAM-001-v2.pdf');
    const replacementPages = await pdfText(String(replacement[0].inputPdf));
    const replacementPdf = readFileSync(resolve(root, String(replacement[0].inputPdf)));
    const replacementHash = createHash('sha256').update(replacementPdf).digest('hex');
    expect(replacementHash).toBe(replacement[0].sha256);
    const replacementProvenance = JSON.parse(
      readFileSync(resolve(root, 'data/knowledge/replacements/DAM-001-v2.provenance.json'), 'utf8'),
    );
    expect(replacementProvenance).toMatchObject({
      documentId: 'DAM-001',
      version: 'v2',
      pdfSha256: replacementHash,
    });
    expect(replacementProvenance.sourceSha256).toBe(
      createHash('sha256')
        .update(
          readFileSync(
            resolve(root, 'docs/synthetic-knowledge/damaged-delivery-v2-replacement.md'),
          ),
        )
        .digest('hex'),
    );
    const replacementExtraction = await extractPdf(new Uint8Array(replacementPdf));
    const replacementChunks = chunkPages(replacementExtraction);
    expect(replacementExtraction.quality).toBe('COMPLETE');
    expect(replacementChunks.length).toBeGreaterThan(0);
    expect(replacementChunks.every((chunk) => chunk.geometryStatus === 'VERIFIED')).toBe(true);
    expect(replacementPages).toHaveLength(1);
    expect(replacementPages[0]).toContain('SYNTHETIC REPLACEMENT TEST FIXTURE');
    expect(replacementPages[0]).toContain(
      'An absent item is a delivery discrepancy, not a damaged item.',
    );
    expect(replacementPages[0]).toContain('Source document: DIS-001 v1');
    expect(replacementPages[0]).toContain(
      'Source file: docs/synthetic-knowledge/delivery-discrepancy-v1.md',
    );
  });
});
