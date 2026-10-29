import { expect, it } from 'vitest';
import { projectRect } from './pdf-overlay';

const rect = { xMin: 20, yMin: 30, xMax: 80, yMax: 50 };

it.each([
  { zoom: 1, rotation: 0, result: { left: 20, top: 150, width: 60, height: 20 } },
  { zoom: 1.5, rotation: 0, result: { left: 30, top: 225, width: 90, height: 30 } },
  { zoom: 1, rotation: 90, result: { left: 30, top: 20, width: 20, height: 60 } },
])('projects a rectangle at $zoom zoom and $rotation degrees', ({ zoom, rotation, result }) => {
  const viewport = {
    convertToViewportRectangle: ([xMin, yMin, xMax, yMax]: [number, number, number, number]) => {
      if (rotation === 90) return [yMin * zoom, xMin * zoom, yMax * zoom, xMax * zoom] as const;
      return [xMin * zoom, (200 - yMin) * zoom, xMax * zoom, (200 - yMax) * zoom] as const;
    },
  };
  expect(projectRect(rect, viewport)).toEqual(result);
});

it('uses the PDF viewport for a page with a nonzero crop origin', () => {
  const viewport = {
    convertToViewportRectangle: ([xMin, yMin, xMax, yMax]: [number, number, number, number]) =>
      [xMin - 10, 180 - yMin, xMax - 10, 180 - yMax] as const,
  };
  expect(projectRect(rect, viewport)).toEqual({ left: 10, top: 130, width: 60, height: 20 });
});
