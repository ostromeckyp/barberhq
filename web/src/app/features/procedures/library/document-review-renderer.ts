import { InjectionToken } from '@angular/core';
import { PdfRenderer } from '../pdf-viewer/pdf-renderer';

export const DOCUMENT_PDF_RENDERER = new InjectionToken<PdfRenderer>('DOCUMENT_PDF_RENDERER');
