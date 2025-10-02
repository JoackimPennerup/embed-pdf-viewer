<script setup lang="ts">
import type { StyleValue } from 'vue';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { PdfErrorCode, ignore } from '@embedpdf/models';
import type { Tile, TilingCapability } from '@embedpdf/plugin-tiling';

import { useTilingCapability, useTilingPlugin } from '../hooks';
import { createCanvasTileSource, releaseCanvasTileSource, type CanvasTileSource } from '../../shared/utils/canvas';

interface Props {
  pageIndex: number;
  scale: number;
  style?: StyleValue;
}

const props = defineProps<Props>();

const canvas = ref<HTMLCanvasElement | null>(null);
const tiles = ref<Tile[]>([]);
const refreshTick = ref(0);
const drawTrigger = ref(0);

const tilingCapability = useTilingCapability();
const tilingPlugin = useTilingPlugin();

const isMounted = ref(false);
const getDevicePixelRatio = () => {
  if (typeof globalThis === 'undefined') return 1;

  const target = globalThis as Window & typeof globalThis;
  return typeof target.devicePixelRatio === 'number' && target.devicePixelRatio > 0
    ? target.devicePixelRatio
    : 1;
};

const devicePixelRatio = ref(getDevicePixelRatio());

const tileSources = new Map<string, CanvasTileSource>();
const pendingTasks = new Map<string, ReturnType<TilingCapability['renderTile']>>();
let resizeObserver: ResizeObserver | undefined;
let removeResizeListener: (() => void) | undefined;

const CANCEL_REASON = {
  code: PdfErrorCode.Cancelled,
  message: 'canceled render task',
} as const;

const requestDraw = () => {
  if (!isMounted.value) return;
  drawTrigger.value += 1;
};

const clearAllTiles = (abortPending = true) => {
  if (abortPending) {
    pendingTasks.forEach((task) => task.abort(CANCEL_REASON));
    pendingTasks.clear();
  }

  tileSources.forEach((source) => releaseCanvasTileSource(source));
  tileSources.clear();
};

onMounted(() => {
  isMounted.value = true;

  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      requestDraw();
    });

    if (canvas.value) {
      resizeObserver.observe(canvas.value);
    }
  }

  if (typeof globalThis !== 'undefined') {
    const target = globalThis as Window & typeof globalThis;
    if (typeof target.addEventListener === 'function' && typeof target.removeEventListener === 'function') {
      const updateDevicePixelRatio = () => {
        devicePixelRatio.value = getDevicePixelRatio();
        requestDraw();
      };

      target.addEventListener('resize', updateDevicePixelRatio);
      removeResizeListener = () => target.removeEventListener('resize', updateDevicePixelRatio);
    }
  }
});

watch(
  () => canvas.value,
  (element, previous) => {
    if (!resizeObserver) return;
    if (previous) {
      resizeObserver.unobserve(previous);
    }
    if (element) {
      resizeObserver.observe(element);
    }
  },
);

onBeforeUnmount(() => {
  isMounted.value = false;
  clearAllTiles();
  unsubscribeTiles?.();
  unsubscribeRefresh?.();
  resizeObserver?.disconnect();
  removeResizeListener?.();
});

let unsubscribeTiles: (() => void) | undefined;
let unsubscribeRefresh: (() => void) | undefined;

watch(
  [tilingCapability, () => props.pageIndex],
  ([capability]) => {
    unsubscribeTiles?.();

    if (capability) {
      unsubscribeTiles = capability.onTileRendering((tilesMap) => {
        tiles.value = tilesMap[props.pageIndex] ?? [];
      });
    } else {
      tiles.value = [];
    }
  },
  { immediate: true },
);

watch(
  [tilingPlugin, () => props.pageIndex],
  ([plugin]) => {
    unsubscribeRefresh?.();

    if (plugin) {
      unsubscribeRefresh = plugin.onRefreshPages((pages) => {
        if (pages.includes(props.pageIndex)) {
          refreshTick.value += 1;
        }
      });
    }
  },
  { immediate: true },
);

watch(
  () => props.pageIndex,
  () => {
    clearAllTiles();
    requestDraw();
  },
);

watch(
  () => refreshTick.value,
  (value) => {
    if (value === 0) return;
    clearAllTiles();
    requestDraw();
  },
);

watch(
  () => devicePixelRatio.value,
  () => {
    if (!isMounted.value) return;
    clearAllTiles();
    requestDraw();
  },
);

watch(
  [tiles, () => refreshTick.value, () => tilingCapability.value, () => devicePixelRatio.value],
  ([tileList]) => {
    const capability = tilingCapability.value;
    if (!capability) return;

    const currentIds = new Set(tileList.map((tile) => tile.id));

    tileSources.forEach((source, id) => {
      if (!currentIds.has(id)) {
        releaseCanvasTileSource(source);
        tileSources.delete(id);
      }
    });

    pendingTasks.forEach((task, id) => {
      if (!currentIds.has(id)) {
        task.abort(CANCEL_REASON);
        pendingTasks.delete(id);
      }
    });

    for (const tile of tileList) {
      if (tileSources.has(tile.id) || pendingTasks.has(tile.id)) continue;

      const task = capability.renderTile({
        pageIndex: props.pageIndex,
        tile,
        dpr: devicePixelRatio.value,
      });

      pendingTasks.set(tile.id, task);

      task.wait(
        async (blob) => {
          pendingTasks.delete(tile.id);

          try {
            const source = await createCanvasTileSource(blob);
            if (!isMounted.value) {
              releaseCanvasTileSource(source);
              return;
            }

            const stillNeeded = tiles.value.some((t) => t.id === tile.id);
            if (!stillNeeded) {
              releaseCanvasTileSource(source);
              return;
            }

            const existing = tileSources.get(tile.id);
            if (existing) {
              releaseCanvasTileSource(existing);
            }

            tileSources.set(tile.id, source);
            requestDraw();
          } catch (error) {
            ignore(error);
          }
        },
        (error) => {
          pendingTasks.delete(tile.id);
          ignore(error);
        },
      );
    }

    requestDraw();
  },
  { immediate: true, deep: false },
);

watch(
  [() => props.scale, tiles, () => drawTrigger.value, () => devicePixelRatio.value],
  () => {
    const canvasEl = canvas.value;
    if (!canvasEl) return;

    const context = canvasEl.getContext('2d');
    if (!context) return;

    const rect = canvasEl.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const dpr = devicePixelRatio.value;
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));

    if (canvasEl.width !== width || canvasEl.height !== height) {
      canvasEl.width = width;
      canvasEl.height = height;
    }

    context.clearRect(0, 0, canvasEl.width, canvasEl.height);

    for (const tile of tiles.value) {
      const source = tileSources.get(tile.id);
      if (!source) continue;

      const relativeScale = props.scale / tile.srcScale;
      const x = tile.screenRect.origin.x * relativeScale * dpr;
      const y = tile.screenRect.origin.y * relativeScale * dpr;
      const w = tile.screenRect.size.width * relativeScale * dpr;
      const h = tile.screenRect.size.height * relativeScale * dpr;

      context.drawImage(source.source, x, y, w, h);
    }
  },
  { immediate: true },
);
</script>

<template>
  <div :style="style" v-bind="$attrs">
    <canvas ref="canvas" style="display: block; width: 100%; height: 100%" />
  </div>
</template>
