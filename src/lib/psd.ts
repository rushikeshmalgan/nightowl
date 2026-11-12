import { readPsd } from 'ag-psd';
import type { Layer } from 'ag-psd';

export interface PsdPixels {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export interface PsdLayer {
  /** Position in the tree, e.g. `2.0`. Stable for the same file. */
  id: string;
  name: string;
  kind: 'layer' | 'group';
  visible: boolean;
  /** 0 to 100. */
  opacity: number;
  blendMode: string;
  left: number;
  top: number;
  width: number;
  height: number;
  imageData?: PsdPixels;
  /** Bottom-most first, the order they are painted. */
  children: PsdLayer[];
}

export interface ParsedPsd {
  width: number;
  height: number;
  layers: PsdLayer[];
}

export interface DrawItem {
  layer: PsdLayer;
  /** 0 to 1, already multiplied through every parent group. */
  opacity: number;
}

export type LayerOverrides = Record<string, { visible?: boolean; opacity?: number }>;

const MAX_SIDE = 16384;
/** About 1 GiB of RGBA once decoded. */
const MAX_LAYER_PIXELS = 2 ** 28;

/**
 * A PSD can declare enormous dimensions in a few bytes. Refuse those before
 * decoding any pixels, so a bad file fails with a message instead of a crash.
 */
export function checkPsdLimits(info: { width: number; height: number; layerPixels: number }): void {
  if (info.width > MAX_SIDE || info.height > MAX_SIDE) {
    throw new Error(`This PSD is too large to open in a browser (${info.width} × ${info.height} px).`);
  }
  if (info.layerPixels > MAX_LAYER_PIXELS) {
    throw new Error('This PSD has too much layer data to open in a browser.');
  }
}

function layerPixels(layers: Layer[] | undefined): number {
  let total = 0;
  for (const layer of layers ?? []) {
    if (layer.children) {
      total += layerPixels(layer.children);
    } else {
      const width = Math.max(0, (layer.right ?? 0) - (layer.left ?? 0));
      const height = Math.max(0, (layer.bottom ?? 0) - (layer.top ?? 0));
      total += width * height;
    }
  }
  return total;
}

function toLayer(layer: Layer, id: string): PsdLayer {
  const left = layer.left ?? 0;
  const top = layer.top ?? 0;
  const pixels = layer.imageData;
  return {
    id,
    name: layer.name?.trim() || 'Untitled layer',
    kind: layer.children ? 'group' : 'layer',
    visible: !layer.hidden,
    opacity: Math.round((layer.opacity ?? 1) * 100),
    blendMode: layer.blendMode ?? 'normal',
    left,
    top,
    width: Math.max(0, (layer.right ?? left) - left),
    height: Math.max(0, (layer.bottom ?? top) - top),
    imageData: pixels ? { width: pixels.width, height: pixels.height, data: pixels.data as Uint8ClampedArray } : undefined,
    children: (layer.children ?? []).map((child, index) => toLayer(child, `${id}.${index}`)),
  };
}

/** Reads a PSD into a layer tree. ag-psd keeps file order: the first child is the bottom layer. */
export function parsePsd(data: ArrayBuffer): ParsedPsd {
  // First pass: structure only, to check sizes before decoding any bitmap.
  const outline = readPsd(data, { skipLayerImageData: true, skipCompositeImageData: true, skipThumbnail: true });
  checkPsdLimits({ width: outline.width, height: outline.height, layerPixels: layerPixels(outline.children) });

  const psd = readPsd(data, { useImageData: true, skipCompositeImageData: true, skipThumbnail: true });
  return {
    width: psd.width,
    height: psd.height,
    layers: (psd.children ?? []).map((layer, index) => toLayer(layer, String(index))),
  };
}

/**
 * The layers to paint, bottom to top. Hidden layers are left out, and so is
 * everything inside a hidden group. `overrides` are the reader's changes to
 * visibility and opacity, keyed by layer id.
 */
export function compositeOrder(layers: PsdLayer[], overrides: LayerOverrides, parentOpacity = 1): DrawItem[] {
  const items: DrawItem[] = [];
  for (const layer of layers) {
    const override = overrides[layer.id];
    const visible = override?.visible ?? layer.visible;
    if (!visible) continue;
    const opacity = parentOpacity * ((override?.opacity ?? layer.opacity) / 100);
    if (layer.kind === 'group') {
      items.push(...compositeOrder(layer.children, overrides, opacity));
    } else {
      items.push({ layer, opacity });
    }
  }
  return items;
}

const BLEND_MODES: Record<string, GlobalCompositeOperation> = {
  multiply: 'multiply',
  screen: 'screen',
  overlay: 'overlay',
  darken: 'darken',
  lighten: 'lighten',
  'color dodge': 'color-dodge',
  'color burn': 'color-burn',
  'hard light': 'hard-light',
  'soft light': 'soft-light',
  difference: 'difference',
  exclusion: 'exclusion',
  hue: 'hue',
  saturation: 'saturation',
  color: 'color',
  luminosity: 'luminosity',
};

/** Photoshop blend mode to the nearest canvas operation; anything unmapped paints normally. */
export function canvasBlendMode(mode: string): GlobalCompositeOperation {
  return BLEND_MODES[mode] ?? 'source-over';
}
