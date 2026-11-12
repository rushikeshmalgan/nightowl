/** Builds small real PSD files in memory for tests, with no canvas needed. */
import { initializeCanvas, writePsd } from 'ag-psd';
import type { Psd } from 'ag-psd';

type Rgba = [number, number, number, number];

/**
 * ag-psd normally creates pixel buffers through a canvas. In the node test
 * environment there is none, so give it a plain ImageData-shaped factory.
 */
export function installNodeImageData(): void {
  initializeCanvas(
    () => {
      throw new Error('No canvas in the test environment');
    },
    (width, height) =>
      ({ width, height, data: new Uint8ClampedArray(width * height * 4), colorSpace: 'srgb' }) as unknown as ImageData,
  );
}

function solid(width: number, height: number, [r, g, b, a]: Rgba): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = a;
  }
  return { width, height, data, colorSpace: 'srgb' } as unknown as ImageData;
}

/**
 * A 4x4 document. From the bottom up: `bg` (full size), `fg` (2x2, multiply,
 * 80% opacity), then a group `grp` holding one 1x1 layer `inner`.
 */
export function makePsdBuffer(overrides: { hideGroup?: boolean } = {}): ArrayBuffer {
  const psd: Psd = {
    width: 4,
    height: 4,
    imageData: solid(4, 4, [0, 0, 0, 255]),
    children: [
      { name: 'bg', left: 0, top: 0, right: 4, bottom: 4, imageData: solid(4, 4, [10, 20, 30, 255]) },
      {
        name: 'fg',
        left: 1,
        top: 1,
        right: 3,
        bottom: 3,
        opacity: 0.8,
        blendMode: 'multiply',
        imageData: solid(2, 2, [200, 0, 0, 255]),
      },
      {
        name: 'grp',
        opened: true,
        hidden: overrides.hideGroup ?? false,
        children: [{ name: 'inner', left: 0, top: 0, right: 1, bottom: 1, imageData: solid(1, 1, [0, 255, 0, 255]) }],
      },
    ],
  };
  return writePsd(psd, { generateThumbnail: false, noBackground: true });
}
