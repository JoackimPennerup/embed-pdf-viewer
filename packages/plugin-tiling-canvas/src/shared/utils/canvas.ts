export interface CanvasTileSource {
  source: CanvasImageSource;
  cleanup: () => void;
}

export async function createCanvasTileSource(blob: Blob): Promise<CanvasTileSource> {
  const scope = getGlobalScope();
  if (!scope?.createImageBitmap) {
    throw new Error('createImageBitmap is not available in this environment.');
  }

  const bitmap = await scope.createImageBitmap(blob);
  return {
    source: bitmap,
    cleanup: () => {
      if ('close' in bitmap) {
        (bitmap as ImageBitmap).close();
      }
    },
  };
}

export function releaseCanvasTileSource(source: CanvasTileSource | undefined): void {
  if (!source) return;
  source.cleanup();
}

function getGlobalScope(): (Window & typeof globalThis) | undefined {
  if (typeof globalThis === 'undefined') return undefined;
  return globalThis as Window & typeof globalThis;
}
