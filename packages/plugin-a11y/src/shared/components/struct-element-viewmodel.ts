import type { StructElement, StructElementTextRun } from '@embedpdf/plugin-a11y';
import { translateFontFamily } from '../../lib/utils';
import { getBrowserMinFontSize, measureTextWidth } from './text-metrics';

export interface StructElementRunViewModel {
  text: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  fontItalic?: boolean;
  style: {
    left?: number;
    top?: number;
    lineHeight?: string;
    transform?: string;
    transformOrigin?: string;
  };
}

export interface StructElementViewModel {
  tagName: string;
  attrs: Record<string, string>;
  elementStyle: {
    left?: number;
    top?: number;
    width?: number;
    height?: number;
  };
  textRuns: StructElementRunViewModel[];
  ownLanguage?: string;
  nextParentLanguage?: string;
}

const PRECISION = 0.01;
const MAX_REASONABLE_FONT = 1e4;

const roundTo = (value: number, step: number = PRECISION) =>
  Math.round(value / step) * step;

const toOptionalNumber = (value: number | undefined): number | undefined =>
  !value || !Number.isFinite(value) ? undefined : value;

const multiplySafe = (value: number, factor: number): number | undefined => {
  const result = value * factor;
  return Number.isFinite(result) ? result : undefined;
};

const pickValid = (...values: Array<number | undefined>): number | undefined => {
  for (const value of values) {
    if (value !== undefined && Number.isFinite(value) && value > PRECISION && value < MAX_REASONABLE_FONT) {
      return value;
    }
  }
  return undefined;
};

const computeFontHeight = (
  run: StructElementTextRun,
  element: StructElement,
  avgHeight: number,
): number => {
  

  const fontSize = pickValid(run.font?.size ?? 0, element.font?.size ?? 0);

  if (run.matrix) {
    const matrixHeight = pickValid(
      Math.hypot(run.matrix.b ?? 0, run.matrix.d ?? 0),
      Math.hypot(run.matrix.a ?? 0, run.matrix.c ?? 0),
    );
    if (matrixHeight !== undefined) {
      const sizeMultiplier = fontSize ?? 1;
      const combined = matrixHeight * sizeMultiplier;
      const scaled = pickValid(combined);
      return scaled ?? matrixHeight;
    }
  }

  if (fontSize !== undefined) {
    return fontSize;
  }

  const runHeight = pickValid(Math.abs(run.rect.size.height || 0));
  if (runHeight !== undefined) return runHeight;

  const avg = pickValid(avgHeight);
  if (avg !== undefined) return avg;

  const widthPerChar =
    run.text.length > 0 ? Math.abs(run.rect.size.width || 0) / run.text.length : 0;
  return pickValid(widthPerChar) ?? 0;
};

export function computeStructElementViewModel(
  element: StructElement,
  scale: number,
  parentLanguage?: string,
): StructElementViewModel {
  // All geometry in the struct tree is in page-user units (points) where the
  // origin sits at the top/left of the page. Every time we project something
  // into CSS we convert by the current page scale (`scale`) that the viewer
  // passes in.
  const minFontSize = Math.max(1, getBrowserMinFontSize());
  const tagName = element.htmlTag || 'span';

  // The element container is positioned relative to the page so we apply the
  // same scaling the rendering engine uses.
  const elementStyle = {
    left: toOptionalNumber(multiplySafe(element.rect.origin.x, scale)),
    top: toOptionalNumber(multiplySafe(element.rect.origin.y, scale)),
    width: toOptionalNumber(multiplySafe(element.rect.size.width, scale)),
    height: toOptionalNumber(multiplySafe(element.rect.size.height, scale)),
  };

  // Forward language/attributes down the tree; the viewer uses this for
  // screen readers and inspectors.
  const attrs: Record<string, string> = { ...(element.attributes ?? {}) };
  const ownLanguage = element.language;
  if (ownLanguage && ownLanguage !== parentLanguage) {
    attrs.lang = ownLanguage;
  }

  // We keep an average height around as a heuristic fallback for runs that
  // have zero-sized rects. This is still in page-user units.
  const avgTextHeightRaw =
    element.textRuns.length > 0
      ? element.textRuns.reduce(
          (acc, run) => acc + Math.abs(run.rect.size.height || 0),
          0,
        ) / element.textRuns.length
      : 0;
  const avgTextHeight = avgTextHeightRaw > 0 ? roundTo(avgTextHeightRaw) : 0;

  const textRuns = element.textRuns.map((run): StructElementRunViewModel => {
    // `fontHeight` is always the rendered height in page-user units. It
    // prefers the text matrix (if available), multiplied by the declared
    // font size (`Tf`), so it stays in sync with the canvas output.
    const fontHeight = computeFontHeight(run, element, avgTextHeight);

    const cssFontFamily = translateFontFamily(run.font?.family ?? element.font?.family);
    const topY = run.rect.origin.y;
    // Position is relative to the parent element's origin and scaled into CSS
    // pixels so the overlay tracks page zoom.
    const relativeLeft = multiplySafe(run.rect.origin.x - element.rect.origin.x, scale);
    const relativeTop = multiplySafe(topY - element.rect.origin.y, scale);
    const transforms: string[] = [];
    if (minFontSize > 1) {
      transforms.push(`scale(${1 / minFontSize})`);
    }

    // Width correction is handled via the hidden canvas measurement. We only
    // do this for multi-character runs because single glyphs rarely benefit
    // and the extra transform can introduce rounding noise.
    if (run.text.length > 1 && fontHeight > PRECISION) {
      const measuredWidth = measureTextWidth(run.text, cssFontFamily, fontHeight * scale);
      if (measuredWidth > PRECISION) {
        const desiredWidth = (run.rect.size.width || 0) * scale;
        const scaleX = desiredWidth / measuredWidth;
        if (Number.isFinite(scaleX) && Math.abs(scaleX - 1) > 0.01) {
          transforms.unshift(`scaleX(${scaleX})`);
        }
      }
    }

    const transform = transforms.length ? transforms.join(' ') : undefined;
    const lineHeight = toOptionalNumber(multiplySafe(run.rect.size.height, scale));

    return {
      text: run.text,
      fontFamily: run.font?.family || undefined,
      // The CSS class will multiply by `var(--scale)` so we store the
      // unscaled page-space height here.
      fontSize: fontHeight > 0 ? fontHeight * minFontSize : undefined,
      fontWeight: run.font?.weight ?? element.font?.weight ?? undefined,
      fontItalic: run.font?.italic ?? element.font?.italic ?? undefined,
      style: {
        left: toOptionalNumber(relativeLeft),
        top: toOptionalNumber(relativeTop),
        ...(lineHeight !== undefined ? { lineHeight: `${lineHeight}px` } : {}),
        ...(transform ? { transform, transformOrigin: 'top left' } : {}),
      },
    };
  });

  return {
    tagName,
    attrs,
    elementStyle,
    textRuns,
    ownLanguage,
    nextParentLanguage: ownLanguage ?? parentLanguage,
  };
}
