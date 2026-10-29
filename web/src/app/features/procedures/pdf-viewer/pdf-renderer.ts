import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import type { PdfRect } from '../../../../../../shared/contracts/knowledge/index';
import { projectRect, type ScreenRect } from './pdf-overlay';

GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

export class PdfRenderer {
  private loading?: PDFDocumentLoadingTask;
  private document?: PDFDocumentProxy;
  private rendering?: RenderTask;
  private epoch = 0;

  get pageCount(): number {
    return this.document?.numPages ?? 0;
  }

  async open(bytes: Uint8Array): Promise<void> {
    this.dispose();
    const epoch = this.epoch;
    // PDF.js may transfer its input to a worker; retain an independent buffer for download.
    this.loading = getDocument({ data: bytes.slice(), stopAtErrors: true });
    const document = await this.loading.promise;
    if (epoch !== this.epoch) return;
    this.document = document;
  }

  async render(
    canvas: HTMLCanvasElement,
    pageNumber: number,
    zoom: number,
    rotation: number,
    rects: PdfRect[],
  ): Promise<{ width: number; height: number; rects: ScreenRect[] }> {
    this.rendering?.cancel();
    const epoch = ++this.epoch;
    const document = this.document;
    if (!document || pageNumber < 1 || pageNumber > document.numPages)
      throw new Error('PDF page is unavailable.');
    const page = await document.getPage(pageNumber);
    if (epoch !== this.epoch) throw new Error('Rendering was cancelled.');
    const viewport = page.getViewport({ scale: zoom, rotation: (page.rotate + rotation) % 360 });
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.ceil(viewport.width * ratio);
    canvas.height = Math.ceil(viewport.height * ratio);
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas rendering is unavailable.');
    this.rendering = page.render({
      canvas,
      canvasContext: context,
      viewport,
      transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
    });
    await this.rendering.promise;
    if (epoch !== this.epoch) throw new Error('Rendering was cancelled.');
    this.rendering = undefined;
    return {
      width: viewport.width,
      height: viewport.height,
      rects: rects.map((rect) =>
        projectRect(rect, {
          convertToViewportRectangle: ([xMin, yMin, xMax, yMax]) => [
            ...viewport.convertToViewportPoint(xMin, yMin),
            ...viewport.convertToViewportPoint(xMax, yMax),
          ],
        }),
      ),
    };
  }

  cancelRender(): void {
    this.epoch++;
    this.rendering?.cancel();
    this.rendering = undefined;
  }

  dispose(): void {
    this.cancelRender();
    void this.loading?.destroy();
    this.loading = undefined;
    this.document = undefined;
  }
}
