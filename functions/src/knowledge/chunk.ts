import type {
  ExtractedDocument,
  ExtractedPage,
  KnowledgeChunkDraft,
  PdfRect,
} from '../../../shared/contracts/knowledge.js';

const TARGET_TOKENS = 320;

function tokenEstimate(value: string): number {
  return Math.max(1, Math.ceil(value.length / 4));
}

function slug(value: string): string {
  const result = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 72);
  return result || 'section';
}

function headingLine(line: string): string | undefined {
  const markdown = line.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/);
  if (markdown) return markdown[1].trim();
  const named = line.trim().match(/^[a-z][a-z0-9-]{1,24}\s+[—–:-]\s+.{3,100}$/i);
  if (named) return line.trim();
  const shortUppercase =
    line.trim().length > 0 &&
    line.trim().length <= 90 &&
    /[A-Z]/.test(line) &&
    line.trim() === line.trim().toLocaleUpperCase();
  return shortUppercase ? line.trim() : undefined;
}

function mergeRects(rectangles: PdfRect[]): PdfRect[] {
  const result: PdfRect[] = [];
  for (const rect of rectangles) {
    const sameLine = result.find(
      (candidate) =>
        Math.abs(candidate.yMin - rect.yMin) < 0.5 &&
        Math.abs(candidate.yMax - rect.yMax) < 0.5 &&
        rect.xMin <= candidate.xMax + 0.5 &&
        candidate.xMin <= rect.xMax + 0.5,
    );
    if (sameLine) {
      sameLine.xMin = Math.min(sameLine.xMin, rect.xMin);
      sameLine.xMax = Math.max(sameLine.xMax, rect.xMax);
    } else result.push({ ...rect });
  }
  return result;
}

function sliceGeometry(page: ExtractedPage, start: number, end: number) {
  const sourceSpans = page.spans.filter((span) => span.end > start && span.start < end);
  const rects = mergeRects(sourceSpans.map((span) => span.rect));
  const words = [...page.text.slice(start, end).matchAll(/\S+/g)];
  const geometryStatus =
    words.length > 0 &&
    sourceSpans.every((span) => span.start >= start && span.end <= end) &&
    words.every((word) => {
      const wordStart = start + (word.index ?? 0);
      const wordEnd = wordStart + word[0].length;
      return sourceSpans.some((span) => span.start <= wordStart && span.end >= wordEnd);
    })
      ? 'VERIFIED'
      : 'UNAVAILABLE';
  return { rects, geometryStatus } as const;
}

function findHeadings(
  page: ExtractedPage,
): { start: number; heading: string; sectionId: string }[] {
  const headings: { start: number; heading: string; sectionId: string }[] = [];
  let offset = 0;
  for (const line of page.text.split('\n')) {
    const heading = headingLine(line);
    if (heading)
      headings.push({ start: offset, heading, sectionId: slug(heading.replace(/^#+\s*/, '')) });
    offset += line.length + 1;
  }
  return headings;
}

export function chunkPages(doc: ExtractedDocument): KnowledgeChunkDraft[] {
  const chunks: KnowledgeChunkDraft[] = [];
  let activeSectionId = slug(doc.title);
  let activeHeading = doc.title;

  for (const page of doc.pages) {
    const headings = findHeadings(page);
    const tokens = [...page.text.matchAll(/\S+/g)];
    let tokenIndex = 0;
    let headingIndex = 0;
    let ordinal = 1;

    while (tokenIndex < tokens.length) {
      const token = tokens[tokenIndex];
      const start = token.index ?? 0;
      while (headingIndex < headings.length && headings[headingIndex].start <= start) {
        activeSectionId = headings[headingIndex].sectionId;
        activeHeading = headings[headingIndex].heading;
        headingIndex += 1;
      }
      const nextHeadingStart = headings[headingIndex]?.start ?? Number.POSITIVE_INFINITY;
      let endTokenIndex = tokenIndex;
      let estimatedTokens = tokenEstimate(token[0]);
      while (endTokenIndex + 1 < tokens.length && estimatedTokens < TARGET_TOKENS) {
        const next = tokens[endTokenIndex + 1];
        if ((next.index ?? 0) >= nextHeadingStart) break;
        endTokenIndex += 1;
        estimatedTokens += tokenEstimate(next[0]);
      }
      const end = (tokens[endTokenIndex].index ?? 0) + tokens[endTokenIndex][0].length;
      const text = page.text.slice(start, end);
      const { rects, geometryStatus } = sliceGeometry(page, start, end);
      chunks.push({
        page: page.physicalPage,
        ordinal,
        sectionId: activeSectionId,
        heading: activeHeading,
        text,
        start,
        end,
        rects,
        geometryStatus,
      });
      ordinal += 1;
      tokenIndex = endTokenIndex + 1;
    }
  }
  return chunks;
}
