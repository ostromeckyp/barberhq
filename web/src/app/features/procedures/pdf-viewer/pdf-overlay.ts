import type { PdfRect } from '../../../../../../shared/contracts/knowledge/index';
import type { ScreenRect } from '../models/screen-rect';

export type PdfViewport = {
  convertToViewportRectangle(rect: [number, number, number, number]): readonly number[];
};

export function projectRect(rect: PdfRect, viewport: PdfViewport): ScreenRect {
  const [x1, y1, x2, y2] = viewport.convertToViewportRectangle([
    rect.xMin,
    rect.yMin,
    rect.xMax,
    rect.yMax,
  ]);
  return {
    left: Math.min(x1, x2),
    top: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  };
}
