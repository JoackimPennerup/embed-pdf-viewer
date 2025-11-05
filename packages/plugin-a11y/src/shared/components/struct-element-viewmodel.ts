import type { StructElement, StructElementTextRun } from '@embedpdf/plugin-a11y';
import { getFontClassName, getLineHeightClass, translateFontFamily } from '../../lib/utils';
import { getBrowserMinFontSize, measureTextWidth } from './text-metrics';

export interface StructElementRunViewModel {
  text: string;
  className?: string;
  style: {
    left?: number;
    top?: number;
    transform?: string;
    transformOrigin?: string;
  };
  breakBefore?: boolean;
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
const SPACE_GAP_THRESHOLD = 0.8;
const LINE_BREAK_THRESHOLD = 1.5;

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
  debug: boolean = false,
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

  const attrs: Record<string, string> = { ...(element.attributes ?? {}) };

  // If we're in debug mode, add a attrbiute to see original struct type
  if (debug) {
    attrs['data-pdftag'] = element.tag;
  }

  // Forward language/attributes down the tree; the viewer uses this for
  // screen readers and inspectors.
  const ownLanguage = element.language;
  if (ownLanguage && ownLanguage !== parentLanguage) {
    attrs.lang = ownLanguage;
  }

  // Check if we have runs, and no children then role should be text
  if (element.textRuns.length > 0 && element.children.length === 0) {
    attrs.role = 'text';
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

  const textRuns: StructElementRunViewModel[] = [];
  let previousRun: StructElementTextRun | undefined;

  for (let index = 0; index < element.textRuns.length; index++) {
    const run = element.textRuns[index];
    const baselineDelta =
      previousRun !== undefined
        ? Math.abs(run.rect.origin.y - previousRun.rect.origin.y)
        : 0;
    const sameLine = previousRun === undefined || baselineDelta <= LINE_BREAK_THRESHOLD;
    const breakBefore = previousRun !== undefined && !sameLine;

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
    const rawText = run.text ?? '';

    if (rawText.length > 1 && fontHeight > PRECISION) {
      const measuredWidth = measureTextWidth(rawText, cssFontFamily, fontHeight * scale);
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
    const lineHeightClass = getLineHeightClass(lineHeight);
    const fontClass = getFontClassName(
      run.font?.family ?? element.font?.family,
      fontHeight > 0 ? fontHeight * minFontSize : undefined,
      run.font?.weight ?? element.font?.weight,
      run.font?.italic ?? element.font?.italic,
    );

    let displayText = rawText;
    if (displayText) {
      const prev = previousRun;
      if (
        prev &&
        sameLine &&
        !(prev.text ?? '').endsWith(' ') &&
        !displayText.startsWith(' ')
      ) {
        const prevRight = prev.rect.origin.x + prev.rect.size.width;
        const gap = run.rect.origin.x - prevRight;
        if (gap > SPACE_GAP_THRESHOLD) {
          displayText = ` ${displayText}`;
        }
      }
    }

    textRuns.push({
      text: displayText,
      className: [fontClass, lineHeightClass, 'textrun'].filter(Boolean).join(' '),
      style: {
        left: toOptionalNumber(relativeLeft),
        top: toOptionalNumber(relativeTop),
        ...(transform ? { transform } : {}),
      },
      ...(breakBefore ? { breakBefore: true } : {}),
    });

    previousRun = run;
  }

  return {
    tagName,
    attrs,
    elementStyle,
    textRuns,
    ownLanguage,
    nextParentLanguage: ownLanguage ?? parentLanguage,
  };
}
