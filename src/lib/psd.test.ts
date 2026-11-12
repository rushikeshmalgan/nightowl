// @vitest-environment node
import { installNodeImageData, makePsdBuffer } from '../test/makePsd';
import { canvasBlendMode, checkPsdLimits, compositeOrder, parsePsd } from './psd';
import type { PsdLayer } from './psd';

beforeAll(() => {
  installNodeImageData();
});

const names = (layers: PsdLayer[]) => layers.map((layer) => layer.name);
const byName = (layers: PsdLayer[], name: string): PsdLayer => {
  for (const layer of layers) {
    if (layer.name === name) return layer;
    const found = layer.children.length > 0 ? byNameOrNull(layer.children, name) : null;
    if (found) return found;
  }
  throw new Error(`No layer named ${name}`);
};
function byNameOrNull(layers: PsdLayer[], name: string): PsdLayer | null {
  try {
    return byName(layers, name);
  } catch {
    return null;
  }
}

describe('parsePsd', () => {
  it('reads the document size and the layer tree, bottom layer first', () => {
    const psd = parsePsd(makePsdBuffer());
    expect(psd.width).toBe(4);
    expect(psd.height).toBe(4);
    expect(names(psd.layers)).toEqual(['bg', 'fg', 'grp']);
  });

  it('reads groups and their children', () => {
    const { layers } = parsePsd(makePsdBuffer());
    const group = byName(layers, 'grp');
    expect(group.kind).toBe('group');
    expect(group.children[0].name).toBe('inner');
    expect(group.children[0].kind).toBe('layer');
  });

  it('reads position, size, opacity, blend mode and pixels', () => {
    const { layers } = parsePsd(makePsdBuffer());
    const fg = byName(layers, 'fg');
    expect(fg).toMatchObject({ left: 1, top: 1, width: 2, height: 2, opacity: 80, blendMode: 'multiply', visible: true });
    expect(fg.imageData?.width).toBe(2);
    expect(Array.from(fg.imageData?.data.slice(0, 4) ?? [])).toEqual([200, 0, 0, 255]);
  });

  it('gives every layer a distinct, stable id', () => {
    const first = parsePsd(makePsdBuffer());
    const second = parsePsd(makePsdBuffer());
    const ids = (layers: PsdLayer[]): string[] => layers.flatMap((layer) => [layer.id, ...ids(layer.children)]);
    expect(new Set(ids(first.layers)).size).toBe(4);
    expect(ids(first.layers)).toEqual(ids(second.layers));
  });

  it('reads hidden layers as not visible', () => {
    const { layers } = parsePsd(makePsdBuffer({ hideGroup: true }));
    expect(byName(layers, 'grp').visible).toBe(false);
  });

  it('rejects bytes that are not a PSD', () => {
    expect(() => parsePsd(new TextEncoder().encode('not a psd at all').buffer as ArrayBuffer)).toThrow();
  });
});

describe('compositeOrder', () => {
  it('lists drawable layers from the bottom up, descending into groups', () => {
    const { layers } = parsePsd(makePsdBuffer());
    expect(compositeOrder(layers, {}).map((item) => item.layer.name)).toEqual(['bg', 'fg', 'inner']);
  });

  it('uses each layer opacity as a 0 to 1 factor', () => {
    const { layers } = parsePsd(makePsdBuffer());
    const fg = compositeOrder(layers, {}).find((item) => item.layer.name === 'fg');
    expect(fg?.opacity).toBeCloseTo(0.8, 5);
  });

  it('drops every child of a hidden group', () => {
    const { layers } = parsePsd(makePsdBuffer());
    const group = byName(layers, 'grp');
    const order = compositeOrder(layers, { [group.id]: { visible: false } });
    expect(order.map((item) => item.layer.name)).toEqual(['bg', 'fg']);
  });

  it('respects a group hidden in the file until it is overridden', () => {
    const { layers } = parsePsd(makePsdBuffer({ hideGroup: true }));
    const group = byName(layers, 'grp');
    expect(compositeOrder(layers, {}).map((item) => item.layer.name)).toEqual(['bg', 'fg']);
    expect(compositeOrder(layers, { [group.id]: { visible: true } }).map((item) => item.layer.name)).toEqual([
      'bg',
      'fg',
      'inner',
    ]);
  });

  it('applies an opacity override', () => {
    const { layers } = parsePsd(makePsdBuffer());
    const fg = byName(layers, 'fg');
    const order = compositeOrder(layers, { [fg.id]: { opacity: 50 } });
    expect(order.find((item) => item.layer.name === 'fg')?.opacity).toBeCloseTo(0.5, 5);
  });

  it('multiplies opacity through parent groups', () => {
    const { layers } = parsePsd(makePsdBuffer());
    const group = byName(layers, 'grp');
    const inner = byName(layers, 'inner');
    const order = compositeOrder(layers, { [group.id]: { opacity: 50 }, [inner.id]: { opacity: 50 } });
    expect(order.find((item) => item.layer.name === 'inner')?.opacity).toBeCloseTo(0.25, 5);
  });

  it('hides a single layer', () => {
    const { layers } = parsePsd(makePsdBuffer());
    const bg = byName(layers, 'bg');
    expect(compositeOrder(layers, { [bg.id]: { visible: false } }).map((item) => item.layer.name)).toEqual(['fg', 'inner']);
  });
});

describe('canvasBlendMode', () => {
  it('maps Photoshop blend modes to canvas operations', () => {
    expect(canvasBlendMode('multiply')).toBe('multiply');
    expect(canvasBlendMode('color dodge')).toBe('color-dodge');
    expect(canvasBlendMode('color burn')).toBe('color-burn');
    expect(canvasBlendMode('hard light')).toBe('hard-light');
    expect(canvasBlendMode('soft light')).toBe('soft-light');
    expect(canvasBlendMode('luminosity')).toBe('luminosity');
  });

  it('draws normal, pass-through and unknown modes normally', () => {
    expect(canvasBlendMode('normal')).toBe('source-over');
    expect(canvasBlendMode('pass through')).toBe('source-over');
    expect(canvasBlendMode('made-up')).toBe('source-over');
  });
});

describe('checkPsdLimits', () => {
  it('accepts an ordinary document', () => {
    expect(() => checkPsdLimits({ width: 4000, height: 3000, layerPixels: 4000 * 3000 * 10 })).not.toThrow();
  });

  it('refuses a canvas with a side over 16384 pixels', () => {
    expect(() => checkPsdLimits({ width: 30000, height: 100, layerPixels: 0 })).toThrow(
      'This PSD is too large to open in a browser (30000 × 100 px).',
    );
  });

  it('refuses a file whose layers would need too much memory', () => {
    expect(() => checkPsdLimits({ width: 8000, height: 8000, layerPixels: 300_000_000 })).toThrow(
      'This PSD has too much layer data to open in a browser.',
    );
  });
});
