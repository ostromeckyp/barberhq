import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { extractPdf, validatePdf } from '../../functions/src/knowledge/extract.js';
import { validatePdf as validatePdfBytes } from '../../functions/src/knowledge/pdf-validation.js';

const root = process.cwd();
const readPdf = (name: string) => readFile(resolve(root, name));

function blankPdf(pageCount: number): Uint8Array {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${Array.from({ length: pageCount }, (_, index) => `${index + 3} 0 R`).join(' ')}] /Count ${pageCount} >>`,
    ...Array.from(
      { length: pageCount },
      () => '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Resources << >> >>',
    ),
  ];
  let body = '%PDF-1.4\n';
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(body, 'latin1'));
    body += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(body, 'latin1');
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) body += `${String(offset).padStart(10, '0')} 00000 n \n`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new Uint8Array(Buffer.from(body, 'latin1'));
}

function pdfWithContent(content: string): Uint8Array {
  const streamLength = Buffer.byteLength(content, 'latin1');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${streamLength} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let body = '%PDF-1.4\n';
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(body, 'latin1'));
    body += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(body, 'latin1');
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) body += `${String(offset).padStart(10, '0')} 00000 n \n`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new Uint8Array(Buffer.from(body, 'latin1'));
}

describe('page-aware PDF extraction', () => {
  it('retains canonical Polish text, negation, page identity, and geometry', async () => {
    const document = await extractPdf(await readPdf('data/knowledge/pdfs/DAM-001-v1.pdf'));
    expect(document.pages[0].text).toContain('affected unit as received in saleable stock');
    expect(document.pages[0].text).toContain('does not specify spill cleanup');
    expect(document.pages[0].text).toContain(
      'Do not mark an affected unit as received in saleable stock merely because the parcel arrived.',
    );
    expect(document.pages[0].text).toContain(
      'A damage report does not automatically authorize replacement stock, a refund, a carrier claim or disposal.',
    );
    expect(document.pages[0].text).toContain(
      'it does not submit the report or execute those workflows.',
    );
    expect(document.quality).toBe('COMPLETE');
    expect(document.pages[0].physicalPage).toBe(1);
    expect(document.pages[0].spans.length).toBeGreaterThan(0);
    expect(
      document.pages[0].spans.every(
        (span) =>
          span.start < span.end &&
          span.rect.xMin < span.rect.xMax &&
          span.rect.yMin < span.rect.yMax,
      ),
    ).toBe(true);
    expect(
      document.pages[0].spans.every(
        (span) =>
          document.pages[0].text.slice(span.start, span.end).length === span.end - span.start,
      ),
    ).toBe(true);

    const geometry = await extractPdf(await readPdf('tests/fixtures/pdf/geometry.pdf'));
    expect(geometry.pages[0].text).toContain('Łódzka salon - first accented line');
    expect(geometry.pages[0].text).toContain('affected item is not saleable');
    expect(geometry.pages[0].physicalPage).toBe(1);
    expect(geometry.pages[0].rotation).toBe(90);
    expect(
      geometry.pages[0].spans.every(
        (span) =>
          span.rect.xMin >= 28 &&
          span.rect.xMax <= 560 &&
          span.rect.yMin >= 35 &&
          span.rect.yMax <= 800,
      ),
    ).toBe(true);
  });

  it('holds scanned and mixed pages for human review', async () => {
    const scanned = await extractPdf(await readPdf('tests/fixtures/pdf/scanned.pdf'));
    const mixed = await extractPdf(await readPdf('tests/fixtures/pdf/mixed.pdf'));
    expect(scanned.quality).toBe('NEEDS_REVIEW');
    expect(mixed.quality).toBe('NEEDS_REVIEW');
    expect(mixed.pages[0].text).toContain('Selectable text: keep affected units separate.');
  });

  it('holds white text on the default white page for human review', async () => {
    const bytes = pdfWithContent(
      ['1 1 1 rg', 'BT /F1 12 Tf 50 740 Td (Do not sell damaged items) Tj ET'].join('\n'),
    );
    const document = await extractPdf(bytes);
    expect(document.pages[0].text).toContain('Do not sell damaged items');
    expect(document.quality).toBe('NEEDS_REVIEW');
    expect(document.pages[0].quality).toBe('NEEDS_REVIEW');
  });

  it('holds near-white #fefefe text for human review', async () => {
    const bytes = pdfWithContent(
      ['0.996 0.996 0.996 rg', 'BT /F1 12 Tf 50 740 Td (Do not sell damaged items) Tj ET'].join(
        '\n',
      ),
    );
    const document = await extractPdf(bytes);
    expect(document.quality).toBe('NEEDS_REVIEW');
  });

  it('holds text covered by a filled vector shape for human review', async () => {
    const bytes = pdfWithContent(
      [
        'BT /F1 12 Tf 50 740 Td (Do not sell damaged items) Tj ET',
        '1 1 1 rg 45 735 190 22 re f',
      ].join('\n'),
    );
    const document = await extractPdf(bytes);
    expect(document.pages[0].text).toContain('Do not sell damaged items');
    expect(document.quality).toBe('NEEDS_REVIEW');
    expect(document.pages[0].quality).toBe('NEEDS_REVIEW');
  });

  it('holds multi-column text for review instead of presenting visual-order guesses as complete', async () => {
    const bytes = pdfWithContent(
      [
        'BT /F1 12 Tf 50 740 Td (Left column begins here) Tj 0 -20 Td (Second left column line) Tj ET',
        'BT /F1 12 Tf 330 740 Td (Right column begins here) Tj 0 -20 Td (Second right column line) Tj ET',
      ].join('\n'),
    );
    const document = await extractPdf(bytes);
    expect(document.quality).toBe('NEEDS_REVIEW');
  });

  it('rejects malformed, encrypted, oversized, and overlong PDFs', async () => {
    await expect(validatePdfBytes(new Uint8Array([1, 2, 3]))).rejects.toThrow();
    await expect(validatePdfBytes(new Uint8Array(10 * 1024 * 1024 + 1))).rejects.toThrow();
    await expect(validatePdfBytes(blankPdf(31))).rejects.toThrow();
    const encrypted = Buffer.from(
      'JVBERi0xLjMKJeLjz9MKMSAwIG9iago8PAovUHJvZHVjZXIgPDAyYjczMTEwZWY+Cj4+CmVuZG9iagoyIDAgb2JqCjw8Ci9UeXBlIC9QYWdlcwovQ291bnQgMQovS2lkcyBbIDQgMCBSIF0KPj4KZW5kb2JqCjMgMCBvYmoKPDwKL1R5cGUgL0NhdGFsb2cKL1BhZ2VzIDIgMCBSCj4+CmVuZG9iago0IDAgb2JqCjw8Ci9UeXBlIC9QYWdlCi9SZXNvdXJjZXMgPDwKPj4KL01lZGlhQm94IFsgMC4wIDAuMCAxMDAgMTAwIF0KL1BhcmVudCAyIDAgUgo+PgplbmRvYmoKNSAwIG9iago8PAovViAyCi9SIDMKL0xlbmd0aCAxMjgKL1AgNDI5NDk2NzI5MgovRmlsdGVyIC9TdGFuZGFyZAovTyA8MGU1MjI5MjVhM2U0ZTg3NGMzY2ZhY2JlZjUxMWE3M2FjNGVjMmJkODY1ZGNkM2Q0NjI3NjE0OTE3YWJmZDdlND4KL1UgPGI3ZDVmNzQ3NTY1ZmJiOWM0NjNjYjU5OWQ4NmNmYjEzMjhiZjRlNWU0ZTc1OGE0MTY0MDA0ZTU2ZmZmYTAxMDg+Cj4+CmVuZG9iagp4cmVmCjAgNgowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMTUgMDAwMDAgbiAKMDAwMDAwMDA1OSAwMDAwMCBuIAowMDAwMDAwMTE4IDAwMDAwIG4gCjAwMDAwMDAxNjcgMDAwMDAgbiAKMDAwMDAwMDI2MSAwMDAwMCBuIAp0cmFpbGVyCjw8Ci9TaXplIDYKL1Jvb3QgMyAwIFIKL0luZm8gMSAwIFIKL0lEIFsgPDMwMzkzNTMzMzE2NjYzMzg2MTM3MzAzMTYzMzczMDYyMzc2MzM3MzIzMzMwMzAzNjM4MzUzNjMyMzYzODY0NjM+IDwzMDM5MzUzMzMxNjY2MzM4NjEzNzMwMzE2MzM3MzA2MjM3NjMzNzMyMzMzMDMwMzYzODM1MzYzMjM2Mzg2NDYzPiBdCi9FbmNyeXB0IDUgMCBSCj4+CnN0YXJ0eHJlZgo0NzYKJSVFT0YK',
      'base64',
    );
    await expect(validatePdfBytes(new Uint8Array(encrypted))).rejects.toThrow();
    await expect(
      validatePdf(await readPdf('tests/fixtures/pdf/geometry.pdf')),
    ).resolves.toMatchObject({ pageCount: 1 });
  });
});
