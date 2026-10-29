import { createRequire } from 'node:module';
import { dirname, join, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

export const MAX_PDF_BYTES = 10 * 1024 * 1024;
export const MAX_PDF_PAGES = 30;
const require = createRequire(import.meta.url);
const standardFontDataUrl = pathToFileURL(
  `${join(dirname(require.resolve('pdfjs-dist/package.json')), 'standard_fonts')}${sep}`,
).href;

export class PdfValidationError extends Error {
  constructor(
    message: string,
    readonly code: 'EMPTY' | 'TOO_LARGE' | 'MALFORMED' | 'ENCRYPTED' | 'TOO_MANY_PAGES',
  ) {
    super(message);
    this.name = 'PdfValidationError';
  }
}

export function assertPdfSize(bytes: Uint8Array): void {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0)
    throw new PdfValidationError('PDF input is empty', 'EMPTY');
  if (bytes.byteLength > MAX_PDF_BYTES)
    throw new PdfValidationError('PDF exceeds the 10 MiB limit', 'TOO_LARGE');
  const header = Buffer.from(bytes.subarray(0, Math.min(bytes.length, 1024))).toString('latin1');
  if (!header.includes('%PDF-')) throw new PdfValidationError('PDF header is missing', 'MALFORMED');
}

export async function openPdf(bytes: Uint8Array) {
  assertPdfSize(bytes);
  // PDF.js parsing/text APIs do not execute document actions; no scripting or annotation-action API is invoked here.
  const loadingTask = getDocument({
    data: new Uint8Array(bytes),
    disableFontFace: true,
    useWorkerFetch: false,
    standardFontDataUrl,
    verbosity: 0,
  });
  try {
    const pdf = await loadingTask.promise;
    if (pdf.numPages < 1) throw new PdfValidationError('PDF has no pages', 'MALFORMED');
    if (pdf.numPages > MAX_PDF_PAGES)
      throw new PdfValidationError('PDF exceeds the 30 page limit', 'TOO_MANY_PAGES');
    if ((await pdf.getPermissions()) !== null)
      throw new PdfValidationError('Encrypted PDFs are not accepted', 'ENCRYPTED');
    return { pdf, close: () => loadingTask.destroy() };
  } catch (error) {
    await loadingTask.destroy().catch(() => undefined);
    if (error instanceof PdfValidationError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    if (/password|encrypt/i.test(message))
      throw new PdfValidationError('Encrypted PDFs are not accepted', 'ENCRYPTED');
    throw new PdfValidationError(`PDF could not be parsed: ${message}`, 'MALFORMED');
  }
}

export async function validatePdf(bytes: Uint8Array): Promise<{ pageCount: number }> {
  const opened = await openPdf(bytes);
  try {
    return { pageCount: opened.pdf.numPages };
  } finally {
    await opened.close();
  }
}
