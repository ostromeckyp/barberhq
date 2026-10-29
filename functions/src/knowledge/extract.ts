import { createHash } from 'node:crypto';
import { OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';
import type {
  ExtractedDocument,
  ExtractedPage,
  PdfRect,
} from '../../../shared/contracts/knowledge/index.js';
import { openPdf, validatePdf } from './pdf-validation.js';

export { validatePdf };
export const PDF_PARSER_VERSION = 'pdfjs-dist@6.4.299';

type TextItem = {
  str: string;
  transform: number[];
  width: number;
  height: number;
  fontName: string;
  hasEOL: boolean;
};

function isTextItem(item: unknown): item is TextItem {
  return typeof item === 'object' && item !== null && 'str' in item && 'transform' in item;
}

function closeEnough(value: number, target: number): boolean {
  return Math.abs(value - target) < 1e-5;
}

function rectFor(
  item: TextItem,
  style: { ascent?: number; descent?: number },
): { rect: PdfRect; supported: boolean } | undefined {
  const [a, b, c, d, originX, originY] = item.transform;
  if (![a, b, c, d, originX, originY, item.width, item.height].every(Number.isFinite))
    return undefined;
  const horizontalLength = Math.hypot(a, b);
  const verticalLength = Math.hypot(c, d);
  if (horizontalLength < 1e-6 || verticalLength < 1e-6 || item.width < 0) return undefined;
  const fontSize = Math.max(item.height, verticalLength);
  const ascent = (style.ascent ?? 0.8) * fontSize;
  const descent = (style.descent ?? -0.2) * fontSize;
  const hX = (a / horizontalLength) * item.width;
  const hY = (b / horizontalLength) * item.width;
  const vX = c / verticalLength;
  const vY = d / verticalLength;
  const points = [
    [originX + vX * ascent, originY + vY * ascent],
    [originX + hX + vX * ascent, originY + hY + vY * ascent],
    [originX + vX * descent, originY + vY * descent],
    [originX + hX + vX * descent, originY + hY + vY * descent],
  ];
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  const rect = {
    xMin: Math.min(...xs),
    yMin: Math.min(...ys),
    xMax: Math.max(...xs),
    yMax: Math.max(...ys),
  };
  // Only axis-aligned horizontal or vertical text is promoted to complete extraction.
  const horizontalText = closeEnough(b, 0) && closeEnough(c, 0) && a > 0 && d > 0;
  const verticalText = closeEnough(a, 0) && closeEnough(d, 0) && b > 0 && c < 0;
  return { rect, supported: horizontalText || verticalText };
}

function hasComplexTextLayout(items: TextItem[], pageWidth: number): boolean {
  const meaningful = items.filter((item) => item.str.trim().length > 0 && item.str.length >= 4);
  const originGroups: { x: number; count: number }[] = [];
  for (const item of meaningful) {
    const x = item.transform[4];
    const group = originGroups.find((candidate) => Math.abs(candidate.x - x) <= 8);
    if (group) {
      group.x = (group.x * group.count + x) / (group.count + 1);
      group.count += 1;
    } else originGroups.push({ x, count: 1 });
  }
  const repeatedColumns = originGroups
    .filter((group) => group.count >= 2)
    .sort((a, b) => a.x - b.x);
  for (let index = 1; index < repeatedColumns.length; index += 1) {
    if (repeatedColumns[index].x - repeatedColumns[index - 1].x > pageWidth * 0.18) return true;
  }

  const lines = new Map<number, TextItem[]>();
  for (const item of items) {
    const line = Math.round(item.transform[5] * 2) / 2;
    const group = lines.get(line) ?? [];
    group.push(item);
    lines.set(line, group);
  }
  for (const line of lines.values()) {
    const ordered = line
      .filter((item) => item.width > 0)
      .sort((a, b) => a.transform[4] - b.transform[4]);
    for (let index = 1; index < ordered.length; index += 1) {
      const prior = ordered[index - 1];
      const current = ordered[index];
      const gap = current.transform[4] - (prior.transform[4] + prior.width);
      const fontSize = Math.max(prior.height, current.height, 1);
      if (gap > Math.max(36, fontSize * 3)) return true;
    }
  }
  return false;
}

function textForPage(
  items: unknown[],
  styles: Record<string, { ascent?: number; descent?: number }>,
  viewBox: [number, number, number, number],
) {
  let text = '';
  let pendingBlankLine = false;
  let prior: { item: TextItem; y: number; fontSize: number } | undefined;
  let unsupported = false;
  const spans: ExtractedPage['spans'] = [];
  const viewRect = { xMin: viewBox[0], yMin: viewBox[1], xMax: viewBox[2], yMax: viewBox[3] };
  let geometryValid = true;

  const visualOrder = items.filter(isTextItem).sort((left, right) => {
    const leftLine = Math.round(left.transform[5] * 2) / 2;
    const rightLine = Math.round(right.transform[5] * 2) / 2;
    return rightLine - leftLine || left.transform[4] - right.transform[4];
  });
  if (hasComplexTextLayout(visualOrder, viewBox[2] - viewBox[0])) unsupported = true;
  for (const candidate of visualOrder) {
    if (!isTextItem(candidate)) continue;
    const item = candidate;
    const style = styles[item.fontName] ?? {};
    if (!item.str) {
      if (item.hasEOL) pendingBlankLine = true;
      continue;
    }
    const geometry = rectFor(item, style);
    if (!geometry) geometryValid = false;
    if (geometry && !geometry.supported) unsupported = true;

    if (text.length > 0) {
      if (pendingBlankLine) text += text.endsWith('\n') ? '\n' : '\n\n';
      else if (prior) {
        const y = item.transform[5];
        const currentSize = Math.max(item.height, Math.hypot(item.transform[2], item.transform[3]));
        const baselineGap = Math.abs(prior.y - y);
        if (baselineGap > Math.max(prior.fontSize, currentSize) * 1.8) text += '\n\n';
        else if (baselineGap > Math.max(prior.fontSize, currentSize) * 0.35) text += ' ';
        else {
          const priorEndX = prior.item.transform[4] + prior.item.width;
          if (item.transform[4] > priorEndX + 0.5) text += ' ';
        }
      }
    }
    pendingBlankLine = false;
    const start = text.length;
    text += item.str;
    const end = text.length;
    if (geometry) {
      const r = geometry.rect;
      const insidePage =
        r.xMin >= viewRect.xMin - 0.5 &&
        r.xMax <= viewRect.xMax + 0.5 &&
        r.yMin >= viewRect.yMin - 0.5 &&
        r.yMax <= viewRect.yMax + 0.5;
      if (!insidePage) geometryValid = false;
      spans.push({ start, end, rect: r });
    }
    prior = {
      item,
      y: item.transform[5],
      fontSize: Math.max(item.height, Math.hypot(item.transform[2], item.transform[3])),
    };
  }
  const leadingTrim = text.match(/^\s*/)?.[0].length ?? 0;
  const trailingTrim = text.match(/\s*$/)?.[0].length ?? 0;
  const endLimit = text.length - trailingTrim;
  const normalizedText = text.slice(leadingTrim, endLimit);
  const output = spans.flatMap((span) => {
    const start = Math.max(span.start, leadingTrim);
    const end = Math.min(span.end, endLimit);
    return end > start ? [{ ...span, start: start - leadingTrim, end: end - leadingTrim }] : [];
  });
  const pageQuality =
    normalizedText.length > 0 && geometryValid && !unsupported ? 'COMPLETE' : 'NEEDS_REVIEW';
  return {
    text: normalizedText,
    spans: output,
    quality: pageQuality as ExtractedPage['quality'],
    geometryValid,
  };
}

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

function hasUnsupportedVisibility(operatorList: {
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

function hasImages(fnArray: number[]): boolean {
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

export async function extractPdf(bytes: Uint8Array): Promise<ExtractedDocument> {
  const { pdf, close } = await openPdf(bytes);
  try {
    const metadata = await pdf.getMetadata();
    const info = metadata.info as {
      Title?: string;
      IsAcroFormPresent?: boolean;
      IsXFAPresent?: boolean;
    };
    const formNeedsReview = Boolean(info.IsAcroFormPresent || info.IsXFAPresent);
    const pages: ExtractedPage[] = [];
    let allComplete = true;
    for (let physicalPage = 1; physicalPage <= pdf.numPages; physicalPage += 1) {
      const page = await pdf.getPage(physicalPage);
      const viewBox: [number, number, number, number] = [
        page.view[0],
        page.view[1],
        page.view[2],
        page.view[3],
      ];
      const [content, operatorList, annotations] = await Promise.all([
        page.getTextContent({ disableNormalization: true }),
        page.getOperatorList(),
        page.getAnnotations({ intent: 'display' }),
      ]);
      const normalized = textForPage(content.items, content.styles, viewBox);
      const quality =
        normalized.quality === 'COMPLETE' &&
        !formNeedsReview &&
        annotations.length === 0 &&
        !hasImages(operatorList.fnArray) &&
        !hasUnsupportedVisibility(operatorList)
          ? 'COMPLETE'
          : 'NEEDS_REVIEW';
      if (quality !== 'COMPLETE') allComplete = false;
      pages.push({
        physicalPage,
        text: normalized.text,
        markdown: normalized.text,
        spans: normalized.spans,
        quality,
        viewBox,
        userUnit: page.userUnit,
        rotation: page.rotate,
      });
      page.cleanup();
    }
    const metadataTitle =
      typeof info.Title === 'string' && info.Title.trim() && !/^untitled$/i.test(info.Title.trim())
        ? info.Title.trim()
        : undefined;
    const firstSpan = pages[0]?.spans[0];
    const title =
      metadataTitle ??
      (firstSpan ? pages[0].text.slice(firstSpan.start, firstSpan.end).trim() : undefined) ??
      'Untitled PDF';
    const extractionHash = createHash('sha256')
      .update(JSON.stringify({ parser: PDF_PARSER_VERSION, title, pages }))
      .digest('hex');
    return {
      title,
      pages,
      quality: allComplete ? 'COMPLETE' : 'NEEDS_REVIEW',
      parserVersion: PDF_PARSER_VERSION,
      extractionHash,
    };
  } finally {
    await close();
  }
}
