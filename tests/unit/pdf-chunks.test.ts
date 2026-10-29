import { describe, expect, it } from 'vitest';
import type { ExtractedDocument, ExtractedPage } from '../../shared/contracts/knowledge/index.js';
import { chunkPages } from '../../functions/src/knowledge/chunk.js';
import { extractPdf } from '../../functions/src/knowledge/extract.js';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const page = (physicalPage: number, text: string): ExtractedPage => ({
  physicalPage,
  text,
  markdown: text,
  viewBox: [0, 0, 612, 792],
  userUnit: 1,
  rotation: 0,
  spans: [{ start: 0, end: text.length, rect: { xMin: 20, yMin: 20, xMax: 500, yMax: 60 } }],
  quality: 'COMPLETE',
});

describe('traceable PDF chunks', () => {
  it('keeps chunk text mapped to exact source slices and never crosses pages', () => {
    const text = `# Receiving\nDo not mark an affected unit as received in saleable stock.\n\n## Escalation\n${'Contact the supplier before taking action. '.repeat(80)}`;
    const document: ExtractedDocument = {
      title: 'Operations',
      pages: [
        page(1, text),
        page(2, '## Follow-up\nThe next physical page has separate guidance.'),
        page(3, 'The section continues onto this physical page.'),
      ],
      quality: 'COMPLETE',
      parserVersion: 'test',
      extractionHash: 'test-hash',
    };
    const chunks = chunkPages(document);
    expect(chunks.length).toBeGreaterThan(2);
    expect(
      chunks.every(
        (chunk) => chunk.text === document.pages[chunk.page - 1].text.slice(chunk.start, chunk.end),
      ),
    ).toBe(true);
    expect(chunks.every((chunk) => chunk.end <= document.pages[chunk.page - 1].text.length)).toBe(
      true,
    );
    expect(chunks.every((chunk) => (chunk.text.match(/\S+/g) ?? []).length <= 350)).toBe(true);
    expect(chunks.filter((chunk) => chunk.page === 1).map((chunk) => chunk.sectionId)).toContain(
      chunks.find((chunk) => chunk.text.includes('Do not mark'))?.sectionId,
    );
    expect(chunks.find((chunk) => chunk.text.includes('Do not mark'))?.text).toContain('Do not');
    expect(chunks.find((chunk) => chunk.page === 2)?.sectionId).toBe('follow-up');
    expect(chunks.find((chunk) => chunk.page === 3)?.sectionId).toBe('follow-up');
    expect(new Set(chunks.map((chunk) => `${chunk.page}:${chunk.ordinal}`)).size).toBe(
      chunks.length,
    );
  });

  it('maps multiline geometry spans into multiple valid page rectangles', async () => {
    const bytes = new Uint8Array(
      await readFile(resolve(process.cwd(), 'tests/fixtures/pdf/geometry.pdf')),
    );
    const document = await extractPdf(bytes);
    const chunks = chunkPages(document);
    const multiline = chunks.find((chunk) => chunk.rects.length > 1);
    expect(multiline).toBeDefined();
    expect(multiline!.rects.length).toBeGreaterThan(1);
    expect(
      multiline!.rects.every(
        (rect) => rect.xMin >= 28 && rect.xMax <= 560 && rect.yMin >= 35 && rect.yMax <= 800,
      ),
    ).toBe(true);
  });

  it('retains real procedure section headings across PDF extraction', async () => {
    const document = await extractPdf(
      new Uint8Array(await readFile(resolve(process.cwd(), 'data/knowledge/pdfs/DAM-001-v1.pdf'))),
    );
    const chunks = chunkPages(document);
    expect(chunks.map((chunk) => chunk.sectionId)).toEqual(
      expect.arrayContaining([
        'intake-identify-the-affected-items',
        'report-prepare-a-damage-report-for-hq',
        'decision-await-the-hq-disposition',
      ]),
    );
  });

  it('does not claim precise geometry when a chunk cuts through one source span', () => {
    const longText = `${'detailed-word '.repeat(900)}end`;
    const chunks = chunkPages({
      title: 'Long section',
      pages: [page(1, longText)],
      quality: 'COMPLETE',
      parserVersion: 'test',
      extractionHash: 'test',
    });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].geometryStatus).toBe('UNAVAILABLE');
  });
});
