const DEFAULT_ASCENT_RATIO = 0.8;
const DEFAULT_FONT_FAMILY = 'sans-serif';
const DEFAULT_WIDTH_MULTIPLIER = 0.5;
const DEFAULT_FONT_SIZE = 30;

let cachedMinBrowserFontSize: number | null = null;

const ascentCache = new Map<string, number>();

type CanvasState = {
  ctx: CanvasRenderingContext2D;
  lastSize: number;
  lastFamily: string;
};

let cachedCanvas: CanvasState | null = null;

const isBrowser =
  typeof window !== 'undefined' &&
  typeof document !== 'undefined' &&
  typeof document.createElement === 'function';

function createMeasurementContext(): CanvasState | null {
  if (!isBrowser) return null;
  if (cachedCanvas) return cachedCanvas;

  const canvas = document.createElement('canvas');
  canvas.className = 'embedpdf-hidden-canvas';
  canvas.width = canvas.height = DEFAULT_FONT_SIZE;
  canvas.style.cssText = 'position:absolute;opacity:0;pointer-events:none;width:0;height:0;';

  // Some environments (e.g., tests) may not have document.body yet.
  if (document.body) {
    document.body.appendChild(canvas);
  }

  const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
  if (!ctx) {
    canvas.remove();
    return null;
  }

  cachedCanvas = { ctx, lastFamily: '', lastSize: 0 };
  return cachedCanvas;
}

function ensureContextFont(state: CanvasState, size: number, family: string) {
  if (state.lastSize === size && state.lastFamily === family) {
    return;
  }
  state.ctx.font = `${size}px ${family}`;
  state.lastSize = size;
  state.lastFamily = family;
}

export function getBrowserMinFontSize(): number {
  if (cachedMinBrowserFontSize !== null) {
    return cachedMinBrowserFontSize;
  }

  if (!isBrowser || !document.body) {
    cachedMinBrowserFontSize = 1;
    return cachedMinBrowserFontSize;
  }

  const probe = document.createElement('div');
  probe.style.cssText =
    'opacity:0;line-height:1;font-size:1px;position:absolute;pointer-events:none;';
  probe.textContent = 'X';
  document.body.appendChild(probe);
  const rect = probe.getBoundingClientRect();
  cachedMinBrowserFontSize = rect.height || 1;
  probe.remove();
  return cachedMinBrowserFontSize;
}

export function getFontAscentRatio(
  fontFamily: string | undefined,
  fallbackAscent?: number,
  fallbackDescent?: number,
): number {
  const family = fontFamily?.trim() || DEFAULT_FONT_FAMILY;
  if (ascentCache.has(family)) {
    return ascentCache.get(family)!;
  }

  const state = createMeasurementContext();
  if (!state) {
    return DEFAULT_ASCENT_RATIO;
  }

  state.ctx.canvas.width = state.ctx.canvas.height = DEFAULT_FONT_SIZE;
  ensureContextFont(state, DEFAULT_FONT_SIZE, family);
  const metrics = state.ctx.measureText('');

  const ascent =
    metrics.fontBoundingBoxAscent ||
    metrics.actualBoundingBoxAscent ||
    (fallbackAscent ?? 0);
  const descent =
    Math.abs(
      metrics.fontBoundingBoxDescent ||
        metrics.actualBoundingBoxDescent ||
        (fallbackDescent ?? 0),
    );

  state.ctx.canvas.width = state.ctx.canvas.height = 0;

  let ratio = DEFAULT_ASCENT_RATIO;
  const total = ascent + descent;
  if (total > 0) {
    ratio = ascent / total;
  } else if (ascent > 0) {
    ratio = ascent / (ascent + descent + 1);
  }

  ascentCache.set(family, ratio);
  return ratio;
}

export function measureTextWidth(
  text: string,
  fontFamily: string | undefined,
  fontSizePx: number,
): number {
  if (!text) return 0;
  const size = fontSizePx > 0 ? fontSizePx : 0;
  if (!isFinite(size) || size === 0) {
    return text.length * DEFAULT_WIDTH_MULTIPLIER;
  }

  const family = fontFamily?.trim() || DEFAULT_FONT_FAMILY;
  const state = createMeasurementContext();
  if (!state) {
    return text.length * size * DEFAULT_WIDTH_MULTIPLIER;
  }
  ensureContextFont(state, size, family);
  const metrics = state.ctx.measureText(text);
  return metrics.width;
}

export function resetMeasurementCaches() {
  cachedMinBrowserFontSize = null;
  ascentCache.clear();
  if (cachedCanvas) {
    cachedCanvas.ctx.canvas.remove();
    cachedCanvas = null;
  }
}
