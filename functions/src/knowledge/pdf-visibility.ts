import { OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';

function isNearWhiteColor(value: string): boolean {
  const normalized = value.replaceAll(' ', '').toLowerCase();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(normalized)?.[1];
  if (hex) {
    const channels =
      hex.length === 3
        ? [...hex].map((channel) => Number.parseInt(channel + channel, 16))
        : [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
    return channels.every((channel) => channel >= 240);
  }
  const rgb = /^rgb\((\d+),(\d+),(\d+)\)$/.exec(normalized);
  return Boolean(rgb && rgb.slice(1).every((channel) => Number(channel) >= 240));
}

export function hasUnsupportedVisibility(operatorList: {
  fnArray: number[];
  argsArray: unknown[];
}): boolean {
  const visibilityOps = new Set([
    OPS.fill,
    OPS.eoFill,
    OPS.fillStroke,
    OPS.eoFillStroke,
    OPS.closeFillStroke,
    OPS.closeEOFillStroke,
    OPS.rawFillPath,
    OPS.shadingFill,
    OPS.setTextRenderingMode,
    OPS.setGState,
    OPS.clip,
    OPS.eoClip,
  ]);
  if (operatorList.fnArray.some((fn) => visibilityOps.has(fn))) return true;
  const textOps = new Set([
    OPS.showText,
    OPS.showSpacedText,
    OPS.nextLineShowText,
    OPS.nextLineSetSpacingShowText,
  ]);
  const hasTextPaint = operatorList.fnArray.some((fn) => textOps.has(fn));
  if (
    hasTextPaint &&
    operatorList.fnArray.some((fn, index) => {
      const args = operatorList.argsArray[index];
      if (!Array.isArray(args)) return false;
      if (fn === OPS.setFillRGBColor || fn === OPS.setFillColor) {
        return args.some((value) => typeof value === 'string' && isNearWhiteColor(value));
      }
      if (fn === OPS.setFillGray)
        return args.some((value) => typeof value === 'number' && value >= 0.99);
      if (fn === OPS.setFillCMYKColor)
        return (
          args.length >= 4 &&
          args.slice(0, 4).every((value) => typeof value === 'number' && Math.abs(value) < 0.01)
        );
      return false;
    })
  )
    return true;
  return operatorList.fnArray.some((fn, index) => {
    if (fn !== OPS.constructPath) return false;
    const args = operatorList.argsArray[index];
    if (!Array.isArray(args) || typeof args[0] !== 'number') return false;
    return visibilityOps.has(args[0]);
  });
}

export function hasImages(fnArray: number[]): boolean {
  const imageOps = new Set([
    OPS.paintImageXObject,
    OPS.paintInlineImageXObject,
    OPS.paintImageMaskXObject,
    OPS.paintImageMaskXObjectGroup,
    OPS.paintImageXObjectRepeat,
    OPS.paintImageMaskXObjectRepeat,
    OPS.paintSolidColorImageMask,
  ]);
  return fnArray.some((fn) => imageOps.has(fn));
}
