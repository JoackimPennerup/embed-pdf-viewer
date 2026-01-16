import { PdfDocumentObject, PdfEngine, PdfTextRectObject, Rect, uuidV4 } from '@embedpdf/models';
import {
  DocumentTextIndex,
  RawRedactionSuggestion,
  RedactionSuggestion,
  RedactionSuggestionOccurrence,
  TextContentSlice,
} from './types';

function cloneRect(rect: Rect): Rect {
  return {
    origin: { x: rect.origin.x, y: rect.origin.y },
    size: { width: rect.size.width, height: rect.size.height },
  };
}

function getBoundingRect(rects: Rect[]): Rect | null {
  if (!rects.length) return null;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const rect of rects) {
    const { origin, size } = rect;
    minX = Math.min(minX, origin.x);
    minY = Math.min(minY, origin.y);
    maxX = Math.max(maxX, origin.x + size.width);
    maxY = Math.max(maxY, origin.y + size.height);
  }

  if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
    return null;
  }

  return {
    origin: { x: minX, y: minY },
    size: { width: maxX - minX, height: maxY - minY },
  };
}

export async function buildDocumentTextIndex(
  engine: PdfEngine,
  document: PdfDocumentObject,
): Promise<DocumentTextIndex> {
  const slices: TextContentSlice[] = [];
  let fullText = '';
  let cursor = 0;

  for (const page of document.pages) {
    let rects: PdfTextRectObject[] = [];
    try {
      rects = await engine.getPageTextRects(document, page).toPromise();
    } catch (error) {
      const wrappedError =
        error instanceof Error
          ? error
          : new Error(`Failed to extract text rectangles for page ${page.index + 1}`);
      throw wrappedError;
    }

    for (const rect of rects) {
      const content = rect.content ?? '';
      if (!content.length) continue;

      const start = cursor;
      const end = start + content.length;

      slices.push({
        pageIndex: page.index,
        start,
        end,
        rect: cloneRect(rect.rect),
        content,
      });

      fullText += content;
      cursor = end;
    }
  }

  return {
    document,
    slices,
    text: fullText,
  };
}

interface TransformOptions {
  minScore?: number;
}

export function transformSuggestions(
  raw: RawRedactionSuggestion[],
  index: DocumentTextIndex,
  options: TransformOptions = {},
): RedactionSuggestion[] {
  const minScore = options.minScore ?? 0;
  const { slices, text } = index;
  const textLength = text.length;

  const suggestions: RedactionSuggestion[] = [];

  for (const suggestion of raw) {
    if (!suggestion) continue;
    if (!suggestion.occurrences?.length) continue;
    if (Number.isFinite(minScore) && suggestion.average_score < minScore) continue;

    const occurrences: RedactionSuggestionOccurrence[] = [];

    for (const occ of suggestion.occurrences) {
      const occurrenceId = uuidV4();
      const start = Math.max(0, Math.min(textLength, Math.max(0, occ.start)));
      const end = Math.max(start, Math.min(textLength, Math.max(occ.end, occ.start)));
      const textSnippet = text.slice(start, end) || suggestion.entity;

      const overlappingSlices = slices.filter((slice) => start < slice.end && end > slice.start);

      if (!overlappingSlices.length) {
        occurrences.push({
          id: occurrenceId,
          start,
          end,
          text: textSnippet,
          items: [],
          pages: [],
          status: 'unmapped',
          reason: 'Unable to locate matching text in the document',
        });
        continue;
      }

      const perPage = new Map<number, Rect[]>();
      for (const slice of overlappingSlices) {
        const list = perPage.get(slice.pageIndex);
        const rectClone = cloneRect(slice.rect);
        if (list) list.push(rectClone);
        else perPage.set(slice.pageIndex, [rectClone]);
      }

      const items = Array.from(perPage.entries()).flatMap(([pageIndex, rects]) => {
        const rect = getBoundingRect(rects);
        if (!rect) return [];
        return [
          {
            id: occurrenceId,
            kind: 'text' as const,
            page: pageIndex,
            rect,
            rects,
          },
        ];
      });

      const pages = Array.from(perPage.keys()).sort((a, b) => a - b);

      occurrences.push({
        id: occurrenceId,
        start,
        end,
        text: textSnippet,
        items,
        pages,
        status: items.length ? 'ready' : 'unmapped',
        reason: items.length ? undefined : 'Unable to derive redaction rectangles',
      });
    }

    const readyOccurrences = occurrences.filter((occ) => occ.status === 'ready');

    suggestions.push({
      id: uuidV4(),
      entity: suggestion.entity,
      entityType: suggestion.entity_type,
      averageScore: suggestion.average_score,
      totalOccurrences: suggestion.occurrences.length,
      readyOccurrences: readyOccurrences.length,
      occurrences: occurrences.sort((a, b) => a.start - b.start),
    });
  }

  suggestions.sort((a, b) => b.averageScore - a.averageScore);

  return suggestions;
}
