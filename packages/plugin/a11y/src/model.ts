import { applyPoint, pageGeometry, type PointIn } from '@embedpdf/core-geometry';
import {
  sliceTextByChars,
  type PageGeometrySnapshot,
  type PageTextSnapshot,
  type PdfRect,
} from '@embedpdf/engine-core/runtime';

import type {
  A11yConfig,
  A11yHtmlNode,
  A11yHtmlTextLine,
  A11yHtmlTextRun,
  A11yRect,
  StructElement,
  StructElementFont,
  StructElementTextRun,
} from './contract';
import { headingLevelFromTag, mapPdfTagToRole, shouldPresentPdfTag } from './semantics';

const EMPTY_RECT = (): A11yRect => ({ origin: { x: 0, y: 0 }, size: { width: 0, height: 0 } });

export function normalizeFontFamily(family?: string): string | undefined {
  if (!family) return undefined;
  return (
    family
      .replace(/^[A-Z]{6}\+/, '')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/[,_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || undefined
  );
}

function unionRects(rects: readonly A11yRect[]): A11yRect {
  if (!rects.length) return EMPTY_RECT();
  const x = Math.min(...rects.map((rect) => rect.origin.x));
  const y = Math.min(...rects.map((rect) => rect.origin.y));
  return {
    origin: { x, y },
    size: {
      width: Math.max(...rects.map((rect) => rect.origin.x + rect.size.width)) - x,
      height: Math.max(...rects.map((rect) => rect.origin.y + rect.size.height)) - y,
    },
  };
}

function sameLine(a: StructElementTextRun, b: StructElementTextRun, tolerance: number): boolean {
  const baseline = (run: StructElementTextRun) =>
    run.rect.origin.y + Math.max(run.rect.size.height, run.font?.size ?? 0) * 0.8;
  return (
    Math.abs(baseline(a) - baseline(b)) <=
    Math.max(tolerance, Math.max(a.rect.size.height, b.rect.size.height) * 0.35)
  );
}

function sameFont(a?: StructElementFont, b?: StructElementFont): boolean {
  return (
    normalizeFontFamily(a?.family) === normalizeFontFamily(b?.family) &&
    Math.abs((a?.size ?? 0) - (b?.size ?? 0)) <= 0.1 &&
    (a?.weight ?? 400) === (b?.weight ?? 400) &&
    Boolean(a?.italic) === Boolean(b?.italic)
  );
}

function inlineText(runs: readonly StructElementTextRun[]): string {
  return runs.map((run) => run.text).join('');
}

export function mergeStructTextRuns(
  runs: readonly StructElementTextRun[],
  options: A11yConfig = {},
): StructElementTextRun[] {
  const merged: StructElementTextRun[] = [];
  for (const run of runs) {
    const last = merged[merged.length - 1];
    const gap = last ? run.rect.origin.x - last.rect.origin.x - last.rect.size.width : 0;
    const height = Math.max(run.rect.size.height, last?.rect.size.height ?? 0);
    const boundary = Boolean(last && (/\s$/.test(last.text) || /^\s/.test(run.text)));
    if (
      last &&
      (boundary || sameFont(last.font, run.font)) &&
      Math.abs((last.rotation ?? 0) - (run.rotation ?? 0)) < 1 &&
      sameLine(last, run, options.lineTolerance ?? 3) &&
      gap >= -1 &&
      gap <= Math.max(options.mergeGapTolerance ?? 6, height * 0.6)
    ) {
      last.text += run.text;
      last.rect = unionRects([last.rect, run.rect]);
    } else {
      merged.push({ ...run, rect: { origin: { ...run.rect.origin }, size: { ...run.rect.size } } });
    }
  }
  return merged;
}

function fragment(run: StructElementTextRun, markedContentId?: string): A11yHtmlTextRun {
  const { rect } = run;
  const rotation = run.rotation ?? 0;
  let left = rect.origin.x;
  let top = rect.origin.y;
  let width = Math.max(rect.size.width, 1);
  let fontHeight = Math.max(rect.size.height, 1);
  if (Math.abs(rotation) > 0.1 && rect.size.width > 0 && rect.size.height > 0) {
    const angle = (rotation * Math.PI) / 180;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const c = Math.abs(cosine);
    const s = Math.abs(sine);
    const determinant = c * c - s * s;
    let solved = false;
    if (Math.abs(determinant) > 0.08) {
      const advance = (c * rect.size.width - s * rect.size.height) / determinant;
      const height = (c * rect.size.height - s * rect.size.width) / determinant;
      if (advance > 0 && height > 0) {
        width = advance;
        fontHeight = height;
        solved = true;
      }
    }
    if (!solved) {
      // Near 45 degrees the two AABB equations are degenerate; use the font
      // size as the height estimate and solve along the dominant text axis.
      const maxHeight = Math.min(
        s > 0.001 ? rect.size.width / s : Infinity,
        c > 0.001 ? rect.size.height / c : Infinity,
      );
      fontHeight = Math.max(
        Math.min(run.font?.size ?? Math.min(rect.size.width, rect.size.height), maxHeight),
        0.5,
      );
      width = Math.max(
        c >= s ? (rect.size.width - s * fontHeight) / c : (rect.size.height - c * fontHeight) / s,
        1,
      );
    }
    const minX = Math.min(
      0,
      width * cosine,
      -fontHeight * sine,
      width * cosine - fontHeight * sine,
    );
    const minY = Math.min(0, width * sine, fontHeight * cosine, width * sine + fontHeight * cosine);
    left -= minX;
    top -= minY;
  }
  return {
    text: run.text,
    rect,
    left,
    top,
    width,
    fontHeight,
    dir: 'ltr',
    markedContentId,
    font: run.font && { ...run.font, family: normalizeFontFamily(run.font.family) },
    rotation,
  };
}

function textLines(
  runs: readonly StructElementTextRun[],
  id: string,
  options: A11yConfig,
): A11yHtmlTextLine[] {
  if (!runs.length || runs.some((run) => Math.abs(run.rotation ?? 0) > 0.1)) return [];
  const lines: StructElementTextRun[][] = [];
  for (const run of runs) {
    const last = lines[lines.length - 1];
    if (last?.length && sameLine(last[last.length - 1], run, options.lineTolerance ?? 3))
      last.push(run);
    else lines.push([run]);
  }
  return lines
    .map((line) => ({
      ...fragment(
        { ...line[0], text: inlineText(line), rect: unionRects(line.map((r) => r.rect)) },
        id,
      ),
    }))
    .filter((line) => Boolean(line.text));
}

function makeNode(
  element: StructElement,
  options: A11yConfig,
  path: string,
  inheritedLanguage?: string,
): A11yHtmlNode {
  const id = `mc-${path}`;
  // A structure /K sequence addresses individual runs. Merging across a
  // child would erase the place where that child belongs in reading order.
  const merged = element.content
    ? element.textRuns
    : mergeStructTextRuns(element.textRuns, options);
  const language = element.language || inheritedLanguage;
  const children = element.children.map((child, index) =>
    makeNode(child, options, `${path}-${index}`, language),
  );
  const role = mapPdfTagToRole(element.tag);
  const presentation = shouldPresentPdfTag(element.tag);
  const ownText = inlineText(merged);
  const childText = children.map((child) => child.text).join('');
  const orderedText = element.content
    ?.map((item) =>
      item.kind === 'text'
        ? (element.textRuns[item.runIndex]?.text ?? '')
        : (children[item.childIndex]?.text ?? ''),
    )
    .join('');
  const text =
    element.tag === 'Figure'
      ? element.altText || element.actualText || element.text || ownText || childText
      : (orderedText ?? (ownText || childText || element.text));
  const grouped =
    !presentation &&
    element.tag !== 'Link' &&
    element.tag !== 'Figure' &&
    (role === 'heading' || role === 'paragraph' || ['Caption', 'TH', 'TD'].includes(element.tag));
  return {
    markedContentId: id,
    tag: element.tag,
    semanticRole: role,
    headingLevel: headingLevelFromTag(element.tag),
    text,
    altText: element.altText?.trim() || undefined,
    actualText: element.actualText?.trim() || undefined,
    rect: element.rect,
    language,
    attributes: { ...element.attributes },
    textRuns: merged.map((run) => fragment(run, id)),
    textLines: grouped && !element.content ? textLines(merged, id, options) : [],
    content: element.content?.map((item) => ({ ...item })),
    children,
    presentation,
  };
}

/** PDF tag sequence is authoritative: never visually sort tagged children. */
export function buildHtmlNodesFromStructElements(
  elements: readonly StructElement[],
  options: A11yConfig = {},
  inheritedLanguage?: string,
): A11yHtmlNode[] {
  return elements.flatMap((element, index) => {
    if (element.tag !== 'Document') {
      return [makeNode(element, options, String(index), inheritedLanguage)];
    }
    const language = element.language || inheritedLanguage;
    const content = element.content ?? [
      ...element.textRuns.map((_, runIndex) => ({ kind: 'text' as const, runIndex })),
      ...element.children.map((_, childIndex) => ({ kind: 'child' as const, childIndex })),
    ];
    return content.flatMap((item, position) => {
      if (item.kind === 'child') {
        const child = element.children[item.childIndex];
        return child ? [makeNode(child, options, String(position), language)] : [];
      }
      const run = element.textRuns[item.runIndex];
      return run
        ? [
            makeNode(
              {
                tag: 'Span',
                text: run.text,
                rect: run.rect,
                children: [],
                textRuns: [run],
                mcids: run.mcid === undefined ? [] : [run.mcid],
              },
              options,
              String(position),
              language,
            ),
          ]
        : [];
    });
  });
}

/** Convert raw PDF y-up edges through the same geometry seam as selection. */
export function rectToContent(rect: PdfRect, crop: PdfRect): A11yRect {
  const matrix = pageGeometry({ crop, rotation: 0, userUnit: 1 }, 1).pdfToContent;
  const a = applyPoint(matrix, { x: rect.left, y: rect.top } as PointIn<'pdf'>);
  const b = applyPoint(matrix, { x: rect.right, y: rect.bottom } as PointIn<'pdf'>);
  return {
    origin: { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y) },
    size: { width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y) },
  };
}

/** Fallback traverses PDFium's character order, not visual x/y sorting. */
export function buildFallbackNodes(
  text: PageTextSnapshot,
  geometry: PageGeometrySnapshot,
  crop: PdfRect,
  options: A11yConfig = {},
): A11yHtmlNode[] {
  const runs: StructElementTextRun[] = geometry.runs
    .slice()
    .sort((a, b) => a.charStart - b.charStart)
    .map((run) => ({
      text: sliceTextByChars(text, run.charStart, run.charStart + run.glyphs.length),
      rect: rectToContent(run.rect, crop),
      font: run.fontSize ? { size: run.fontSize } : undefined,
      rotation: 'rotation' in run ? (-run.rotation * 180) / Math.PI : 0,
    }))
    .filter((run) => Boolean(run.text.trim()));
  const lines: StructElementTextRun[][] = [];
  for (const run of runs) {
    const line = lines[lines.length - 1];
    const prev = line?.[line.length - 1];
    const gap = prev ? run.rect.origin.x - prev.rect.origin.x - prev.rect.size.width : 0;
    if (
      prev &&
      sameLine(prev, run, options.lineTolerance ?? 3) &&
      gap >= -1 &&
      gap <= Math.max((options.mergeGapTolerance ?? 6) * 4, run.rect.size.height * 0.6)
    ) {
      line.push(run);
    } else lines.push([run]);
  }
  return lines.map((line, index) => {
    const id = `mc-fallback-${index}`;
    const merged = mergeStructTextRuns(line, options);
    return {
      markedContentId: id,
      tag: 'Span',
      text: inlineText(merged),
      rect: unionRects(merged.map((run) => run.rect)),
      attributes: {},
      textRuns: merged.map((run) => fragment(run, id)),
      textLines: textLines(merged, id, options),
      children: [],
      presentation: true,
    };
  });
}

/** Screen-reader text when copy is allowed but spatial selection geometry is not. */
export function buildTextOnlyNodes(text: string, pageWidth: number): A11yHtmlNode[] {
  if (!text.trim()) return [];
  const rect: A11yRect = { origin: { x: 0, y: 0 }, size: { width: pageWidth, height: 0 } };
  return [
    {
      markedContentId: 'mc-text-only',
      tag: 'P',
      semanticRole: 'paragraph',
      text,
      rect,
      attributes: {},
      textLines: [],
      children: [],
      textRuns: [
        {
          text,
          rect,
          left: 0,
          top: 0,
          width: pageWidth,
          fontHeight: 1,
          dir: 'auto',
          markedContentId: 'mc-text-only',
        },
      ],
    },
  ];
}
