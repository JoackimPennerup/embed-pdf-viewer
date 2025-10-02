export interface CanvasTileSource {
  source: CanvasImageSource;
  cleanup: () => void;
}

export async function createCanvasTileSource(blob: Blob): Promise<CanvasTileSource> {
  const scope = getGlobalScope();

  if (scope && typeof scope.createImageBitmap === 'function') {
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

  const url = URL.createObjectURL(blob);
  try {
    const image = await loadImage(url);
    return {
      source: image,
      cleanup: () => {
        URL.revokeObjectURL(url);
      },
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const scope = getGlobalScope();
    const ImageCtor = scope?.Image;

    if (!ImageCtor) {
      reject(new Error('Image constructor is not available in this environment.'));
      return;
    }

    const image = new ImageCtor();
    image.src = url;
    image.onload = () => resolve(image);
    image.onerror = (event) => reject(event);
  });
}

export function releaseCanvasTileSource(source: CanvasTileSource | undefined): void {
  if (!source) return;
  source.cleanup();
}

function getGlobalScope(): (Window & typeof globalThis) | undefined {
  if (typeof globalThis === 'undefined') return undefined;
  return globalThis as Window & typeof globalThis;
}
