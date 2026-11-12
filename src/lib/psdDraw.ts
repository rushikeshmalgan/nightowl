import { canvasBlendMode } from './psd';
import type { DrawItem, PsdLayer } from './psd';

/** One small canvas per layer, built once and reused across redraws. */
export type LayerBitmapCache = Map<string, HTMLCanvasElement>;

function layerBitmap(layer: PsdLayer, cache: LayerBitmapCache): HTMLCanvasElement | null {
  const cached = cache.get(layer.id);
  if (cached) return cached;
  const pixels = layer.imageData;
  if (!pixels || pixels.width === 0 || pixels.height === 0) return null;

  const bitmap = document.createElement('canvas');
  bitmap.width = pixels.width;
  bitmap.height = pixels.height;
  const context = bitmap.getContext('2d');
  if (!context) return null;
  const image = new ImageData(pixels.data as Uint8ClampedArray<ArrayBuffer>, pixels.width, pixels.height);
  context.putImageData(image, 0, 0);
  cache.set(layer.id, bitmap);
  return bitmap;
}

/**
 * Paints the given layers, bottom to top, onto `canvas`. Each layer goes
 * through its own bitmap so opacity and blend mode apply to the whole layer.
 */
export function drawComposite(
  canvas: HTMLCanvasElement,
  size: { width: number; height: number },
  items: DrawItem[],
  cache: LayerBitmapCache,
): void {
  if (canvas.width !== size.width) canvas.width = size.width;
  if (canvas.height !== size.height) canvas.height = size.height;
  const context = canvas.getContext('2d');
  if (!context) return;

  context.globalAlpha = 1;
  context.globalCompositeOperation = 'source-over';
  context.clearRect(0, 0, size.width, size.height);

  for (const { layer, opacity } of items) {
    const bitmap = layerBitmap(layer, cache);
    if (!bitmap) continue;
    context.globalAlpha = opacity;
    context.globalCompositeOperation = canvasBlendMode(layer.blendMode);
    context.drawImage(bitmap, layer.left, layer.top);
  }

  context.globalAlpha = 1;
  context.globalCompositeOperation = 'source-over';
}
