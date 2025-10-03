import { PdfErrorCode, ignore } from '@embedpdf/models';
import type { Tile, TilingCapability } from '@embedpdf/plugin-tiling';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  HTMLAttributes,
  CSSProperties,
} from '@framework';

import { useTilingCapability, useTilingPlugin } from '../hooks/use-tiling';
import { CanvasTileSource, createCanvasTileSource, releaseCanvasTileSource } from '../utils/canvas';

type TilingCanvasLayerProps = Omit<HTMLAttributes<HTMLDivElement>, 'style'> & {
  pageIndex: number;
  scale: number;
  style?: CSSProperties;
};

const CANCEL_REASON = {
  code: PdfErrorCode.Cancelled,
  message: 'canceled render task',
} as const;

const getDevicePixelRatio = () => {
  if (typeof globalThis === 'undefined') return 1;

  const target = globalThis as Window & typeof globalThis;
  return typeof target.devicePixelRatio === 'number' && target.devicePixelRatio > 0
    ? target.devicePixelRatio
    : 1;
};

type TileTaskMap = Map<string, ReturnType<TilingCapability['renderTile']>>;

export function TilingCanvasLayer({ pageIndex, scale, style, ...props }: TilingCanvasLayerProps) {
  const { provides: tilingProvides } = useTilingCapability();
  const { plugin: tilingPlugin } = useTilingPlugin();

  const [tiles, setTiles] = useState<Tile[]>([]);
  const [refreshTick, setRefreshTick] = useState(0);
  const [drawTrigger, setDrawTrigger] = useState(0);
  const [devicePixelRatio, setDevicePixelRatio] = useState(getDevicePixelRatio);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const tileSourcesRef = useRef<Map<string, CanvasTileSource>>(new Map());
  const pendingTasksRef = useRef<TileTaskMap>(new Map());
  const isMountedRef = useRef(true);
  const tilesRef = useRef<Tile[]>([]);

  const requestDraw = useCallback(() => {
    if (!isMountedRef.current) return;
    setDrawTrigger((value) => value + 1);
  }, []);

  const clearAllTiles = useCallback(() => {
    pendingTasksRef.current.forEach((task) => {
      task.abort(CANCEL_REASON);
    });
    pendingTasksRef.current.clear();

    tileSourcesRef.current.forEach((source) => {
      releaseCanvasTileSource(source);
    });
    tileSourcesRef.current.clear();
  }, []);

  useEffect(() => {
    tilesRef.current = tiles;
  }, [tiles]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      clearAllTiles();
    };
  }, [clearAllTiles]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => {
      requestDraw();
    });

    observer.observe(canvas);
    return () => observer.disconnect();
  }, [requestDraw]);

  useEffect(() => {
    if (!tilingPlugin) return;
    return tilingPlugin.onRefreshPages((pages) => {
      if (pages.includes(pageIndex)) {
        setRefreshTick((tick) => tick + 1);
      }
    });
  }, [tilingPlugin, pageIndex]);

  useEffect(() => {
    if (typeof globalThis === 'undefined') return;

    const target = globalThis as Window & typeof globalThis;
    if (
      typeof target.addEventListener !== 'function' ||
      typeof target.removeEventListener !== 'function'
    ) {
      return;
    }

    const updateDevicePixelRatio = () => {
      setDevicePixelRatio(getDevicePixelRatio());
      requestDraw();
    };

    target.addEventListener('resize', updateDevicePixelRatio);
    return () => target.removeEventListener('resize', updateDevicePixelRatio);
  }, [requestDraw]);

  useEffect(() => {
    if (!isMountedRef.current) return;
    clearAllTiles();
    requestDraw();
  }, [devicePixelRatio, clearAllTiles, requestDraw]);

  useEffect(() => {
    if (!tilingProvides) return;
    return tilingProvides.onTileRendering((tilesByPage) => {
      setTiles(tilesByPage[pageIndex] ?? []);
    });
  }, [tilingProvides, pageIndex]);

  useEffect(() => {
    if (refreshTick === 0) return;
    clearAllTiles();
    requestDraw();
  }, [refreshTick, clearAllTiles, requestDraw]);

  useEffect(() => {
    if (!tilingProvides) return;

    const currentIds = new Set(tiles.map((tile) => tile.id));

    tileSourcesRef.current.forEach((source, id) => {
      if (!currentIds.has(id)) {
        releaseCanvasTileSource(source);
        tileSourcesRef.current.delete(id);
      }
    });

    pendingTasksRef.current.forEach((task, id) => {
      if (!currentIds.has(id)) {
        task.abort(CANCEL_REASON);
        pendingTasksRef.current.delete(id);
      }
    });

    for (const tile of tiles) {
      if (tileSourcesRef.current.has(tile.id) || pendingTasksRef.current.has(tile.id)) {
        continue;
      }

      const task = tilingProvides.renderTile({
        pageIndex,
        tile,
        dpr: devicePixelRatio,
      });

      pendingTasksRef.current.set(tile.id, task);

      task.wait(
        async (blob) => {
          pendingTasksRef.current.delete(tile.id);

          try {
            const source = await createCanvasTileSource(blob);
            if (!isMountedRef.current) {
              releaseCanvasTileSource(source);
              return;
            }

            const stillNeeded = tilesRef.current.some((t) => t.id === tile.id);
            if (!stillNeeded) {
              releaseCanvasTileSource(source);
              return;
            }

            const existing = tileSourcesRef.current.get(tile.id);
            if (existing) {
              releaseCanvasTileSource(existing);
            }

            tileSourcesRef.current.set(tile.id, source);
            requestDraw();
          } catch (error) {
            ignore(error);
          }
        },
        (error) => {
          pendingTasksRef.current.delete(tile.id);
          ignore(error);
        },
      );
    }

    requestDraw();
  }, [tiles, tilingProvides, pageIndex, devicePixelRatio, requestDraw, refreshTick]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const dpr = devicePixelRatio;
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);

    for (const tile of tiles) {
      const entry = tileSourcesRef.current.get(tile.id);
      if (!entry) continue;

      const relativeScale = scale / tile.srcScale;
      const x = tile.screenRect.origin.x * relativeScale * dpr;
      const y = tile.screenRect.origin.y * relativeScale * dpr;
      const w = tile.screenRect.size.width * relativeScale * dpr;
      const h = tile.screenRect.size.height * relativeScale * dpr;

      context.drawImage(entry.source, x, y, w, h);
    }
  }, [tiles, scale, drawTrigger, devicePixelRatio]);

  return (
    <div style={{ ...style }} {...props}>
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
        }}
      />
    </div>
  );
}

export const TilingLayer = TilingCanvasLayer;
