import { ignore, PdfErrorCode, PdfErrorReason, Task } from '@embedpdf/models';

import type { Tile, TilingCapability } from '../../lib/types';
import type { TilingPlugin } from '../../lib/tiling-plugin';

export interface TilingCanvasControllerDependencies {
  capability?: TilingCapability;
  plugin?: TilingPlugin;
}

export interface TilingCanvasController {
  setCanvas(canvas: HTMLCanvasElement | null): void;
  setScale(scale: number): void;
  setDependencies(deps: TilingCanvasControllerDependencies): void;
  destroy(): void;
}

type CanvasSource = Exclude<CanvasImageSource, string | SVGImageElement | OffscreenCanvas>;

interface TileRenderState {
  tile: Tile;
  task: Task<Blob, PdfErrorReason>;
  dpr: number;
  image?: CanvasSource;
  imageUrl?: string;
  canceled: boolean;
}

const getWindow = () => (typeof window === 'undefined' ? undefined : window);

function getDevicePixelRatio(): number {
  const win = getWindow();
  return win?.devicePixelRatio && Number.isFinite(win.devicePixelRatio) && win.devicePixelRatio > 0
    ? win.devicePixelRatio
    : 1;
}

function isImageBitmap(source: CanvasSource): source is ImageBitmap {
  return typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap;
}

async function createCanvasSource(blob: Blob): Promise<{ image: CanvasSource; url?: string }> {
  const win = getWindow();
  if (win && 'createImageBitmap' in win && typeof win.createImageBitmap === 'function') {
    const bitmap = await win.createImageBitmap(blob);
    return { image: bitmap };
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      resolve({ image: img, url });
    };
    img.onerror = (event) => {
      URL.revokeObjectURL(url);
      reject(event instanceof ErrorEvent ? event.error : new Error('Failed to load tile image.'));
    };
    img.src = url;
  });
}

function releaseStateResources(state: TileRenderState) {
  if (state.image) {
    if (isImageBitmap(state.image)) {
      state.image.close?.();
    }
    state.image = undefined;
  }

  if (state.imageUrl) {
    URL.revokeObjectURL(state.imageUrl);
    state.imageUrl = undefined;
  }
}

export function createTilingCanvasController({
  pageIndex,
}: {
  pageIndex: number;
}): TilingCanvasController {
  const win = getWindow();

  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let currentScale = 1;
  let currentDpr = getDevicePixelRatio();
  let capability: TilingCapability | undefined;
  let plugin: TilingPlugin | undefined;
  let unsubTileRendering: (() => void) | null = null;
  let unsubRefresh: (() => void) | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let rafHandle: number | null = null;
  let destroyed = false;

  let tiles: Tile[] = [];
  const renderStates = new Map<string, TileRenderState>();

  const handleTileRendering = (tilesMap: Record<number, Tile[]>) => {
    if (destroyed) return;
    tiles = tilesMap[pageIndex] ?? [];
    syncTileStates();
  };

  const handleRefreshPages = (pages: number[]) => {
    if (destroyed) return;
    if (pages.includes(pageIndex)) {
      restartTiles();
    }
  };

  const handleWindowResize = () => {
    if (destroyed) return;
    const nextDpr = getDevicePixelRatio();
    if (Math.abs(nextDpr - currentDpr) > 1e-3) {
      currentDpr = nextDpr;
      ensureCanvasSize();
      restartTiles();
      return;
    }
    ensureCanvasSize();
    requestRedraw();
  };

  const ensureCanvasSize = () => {
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    const logicalWidth = Math.max(1, Math.round(rect.width));
    const logicalHeight = Math.max(1, Math.round(rect.height));
    const pixelWidth = Math.max(1, Math.round(logicalWidth * currentDpr));
    const pixelHeight = Math.max(1, Math.round(logicalHeight * currentDpr));

    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }

    ctx.setTransform(currentDpr, 0, 0, currentDpr, 0, 0);
  };

  const clearCanvas = () => {
    if (!canvas || !ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  };

  const drawTiles = () => {
    if (!canvas || !ctx) return;
    ensureCanvasSize();
    clearCanvas();

    for (const tile of tiles) {
      const state = renderStates.get(tile.id);
      if (!state?.image) continue;

      const relativeScale = tile.srcScale === 0 ? 1 : currentScale / tile.srcScale;
      const destX = tile.screenRect.origin.x * relativeScale;
      const destY = tile.screenRect.origin.y * relativeScale;
      const destWidth = tile.screenRect.size.width * relativeScale;
      const destHeight = tile.screenRect.size.height * relativeScale;

      ctx.drawImage(state.image, destX, destY, destWidth, destHeight);
    }
  };

  const requestRedraw = () => {
    if (!canvas || !ctx || destroyed) return;
    if (!win) {
      drawTiles();
      return;
    }
    if (rafHandle != null) return;
    rafHandle = win.requestAnimationFrame(() => {
      rafHandle = null;
      drawTiles();
    });
  };

  const cancelRedraw = () => {
    if (rafHandle == null || !win) return;
    win.cancelAnimationFrame(rafHandle);
    rafHandle = null;
  };

  const cancelState = (state: TileRenderState) => {
    if (state.canceled) return;
    state.canceled = true;

    if (!state.image) {
      state.task.abort({
        code: PdfErrorCode.Cancelled,
        message: 'canceled tile render',
      });
    } else {
      releaseStateResources(state);
    }
  };

  const syncTileStates = () => {
    const targetIds = new Set(tiles.map((tile) => tile.id));

    for (const [id, state] of renderStates) {
      if (!targetIds.has(id)) {
        cancelState(state);
        renderStates.delete(id);
      }
    }

    if (!capability) {
      requestRedraw();
      return;
    }

    for (const tile of tiles) {
      const existing = renderStates.get(tile.id);
      if (existing) {
        existing.tile = tile;
        continue;
      }

      const task = capability.renderTile({ pageIndex, tile, dpr: currentDpr });
      const state: TileRenderState = { tile, task, dpr: currentDpr, canceled: false };
      renderStates.set(tile.id, state);

      task.wait(async (blob) => {
        if (state.canceled || destroyed) return;
        try {
          const { image, url } = await createCanvasSource(blob);
          if (state.canceled || destroyed) {
            if (isImageBitmap(image)) {
              image.close?.();
            } else if (url) {
              URL.revokeObjectURL(url);
            }
            return;
          }

          state.image = image;
          state.imageUrl = url;
          requestRedraw();
        } catch {
          // ignore failures, controller will re-render on next update
        }
      }, ignore);
    }

    requestRedraw();
  };

  const restartTiles = () => {
    const snapshot = tiles.slice();
    for (const state of renderStates.values()) {
      cancelState(state);
    }
    renderStates.clear();
    tiles = snapshot;
    syncTileStates();
  };

  const detachCanvas = () => {
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
    cancelRedraw();
    canvas = null;
    ctx = null;
  };

  if (win) {
    win.addEventListener('resize', handleWindowResize, { passive: true });
  }

  return {
    setCanvas(nextCanvas) {
      if (destroyed || canvas === nextCanvas) return;

      detachCanvas();

      canvas = nextCanvas;
      if (!canvas) return;

      ctx = canvas.getContext('2d');
      if (!ctx) {
        canvas = null;
        return;
      }

      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => {
          if (destroyed) return;
          ensureCanvasSize();
          requestRedraw();
        });
        resizeObserver.observe(canvas);
      }

      ensureCanvasSize();
      requestRedraw();
    },

    setScale(scale) {
      if (!Number.isFinite(scale)) return;
      if (Math.abs(scale - currentScale) < 1e-6) return;
      currentScale = scale;
      requestRedraw();
    },

    setDependencies(deps) {
      if (destroyed) return;

      if (capability !== deps.capability) {
        unsubTileRendering?.();
        unsubTileRendering = null;
        capability = deps.capability;
        if (capability) {
          unsubTileRendering = capability.onTileRendering(handleTileRendering);
          syncTileStates();
        } else {
          for (const state of renderStates.values()) {
            cancelState(state);
          }
          renderStates.clear();
          tiles = [];
          requestRedraw();
        }
      }

      if (plugin !== deps.plugin) {
        unsubRefresh?.();
        unsubRefresh = null;
        plugin = deps.plugin;
        if (plugin) {
          unsubRefresh = plugin.onRefreshPages(handleRefreshPages);
        }
      }
    },

    destroy() {
      if (destroyed) return;
      destroyed = true;

      unsubTileRendering?.();
      unsubTileRendering = null;
      unsubRefresh?.();
      unsubRefresh = null;

      detachCanvas();

      for (const state of renderStates.values()) {
        cancelState(state);
      }
      renderStates.clear();
      tiles = [];

      if (win) {
        win.removeEventListener('resize', handleWindowResize);
      }
    },
  };
}
