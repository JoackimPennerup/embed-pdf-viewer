import { useEffect, useMemo, useRef, HTMLAttributes, CSSProperties } from '@framework';

import { createTilingCanvasController } from '../controllers/tiling-canvas';
import { useTilingCapability, useTilingPlugin } from '../hooks/use-tiling';

export type TilingCanvasLayerProps = Omit<HTMLAttributes<HTMLDivElement>, 'style'> & {
  pageIndex: number;
  scale: number;
  style?: CSSProperties;
};

export function TilingCanvasLayer({ pageIndex, scale, style, ...props }: TilingCanvasLayerProps) {
  const { provides: tilingCapability } = useTilingCapability();
  const { plugin: tilingPlugin } = useTilingPlugin();

  const controller = useMemo(
    () => createTilingCanvasController({ pageIndex }),
    [pageIndex],
  );
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    controller.setDependencies({
      capability: tilingCapability,
      plugin: tilingPlugin,
    });
  }, [controller, tilingCapability, tilingPlugin]);

  useEffect(() => {
    controller.setScale(scale);
  }, [controller, scale]);

  useEffect(() => {
    controller.setCanvas(canvasRef.current ?? null);
    return () => {
      controller.setCanvas(null);
    };
  }, [controller]);

  useEffect(() => () => controller.destroy(), [controller]);

  return (
    <div
      style={{
        position: 'relative',
        ...style,
      }}
      {...props}
    >
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          display: 'block',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
