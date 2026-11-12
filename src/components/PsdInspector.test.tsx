import { act, fireEvent, render, screen, within } from '@testing-library/react';
import * as psd from '../lib/psd';
import type { PsdLayer } from '../lib/psd';
import * as psdDraw from '../lib/psdDraw';
import { PSD_WARN_BYTES, PsdInspector } from './PsdInspector';

vi.mock('../lib/psd', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/psd')>()),
  parsePsd: vi.fn(),
  compositeOrder: vi.fn(() => []),
}));
vi.mock('../lib/psdDraw', () => ({ drawComposite: vi.fn() }));

const parsePsd = vi.mocked(psd.parsePsd);
const compositeOrder = vi.mocked(psd.compositeOrder);
const drawComposite = vi.mocked(psdDraw.drawComposite);

const layer = (id: string, name: string, extra: Partial<PsdLayer> = {}): PsdLayer => ({
  id,
  name,
  kind: 'layer',
  visible: true,
  opacity: 100,
  blendMode: 'normal',
  left: 0,
  top: 0,
  width: 4,
  height: 4,
  children: [],
  ...extra,
});

const layers: PsdLayer[] = [
  layer('0', 'bg'),
  layer('1', 'fg', { opacity: 80, blendMode: 'multiply' }),
  layer('2', 'grp', { kind: 'group', children: [layer('2.0', 'inner')] }),
];

const data = new ArrayBuffer(16);

async function renderParsed(onError = vi.fn()) {
  render(<PsdInspector data={data} onError={onError} />);
  const tree = await screen.findByRole('tree');
  return { tree, onError };
}

beforeEach(() => {
  vi.clearAllMocks();
  parsePsd.mockReturnValue({ width: 4, height: 4, layers });
  compositeOrder.mockReturnValue([]);
});

describe('PsdInspector', () => {
  it('shows a parsing message, then the layer tree', async () => {
    render(<PsdInspector data={data} onError={() => {}} />);
    expect(screen.getByText('Parsing…')).toBeInTheDocument();
    expect(await screen.findByRole('tree')).toBeInTheDocument();
    expect(screen.queryByText('Parsing…')).not.toBeInTheDocument();
  });

  it('lists layers top-most first, with groups indented', async () => {
    const { tree } = await renderParsed();
    const items = within(tree).getAllByRole('treeitem');
    expect(items.map((item) => item.getAttribute('data-layer-name'))).toEqual(['grp', 'inner', 'fg', 'bg']);
    expect(items[0]).toHaveAttribute('aria-level', '1');
    expect(items[1]).toHaveAttribute('aria-level', '2');
  });

  it('shows the document size and layer count', async () => {
    await renderParsed();
    expect(screen.getByText('4 × 4 px')).toBeInTheDocument();
    expect(screen.getByText('4 layers')).toBeInTheDocument();
  });

  it('draws the composite from the visible layers', async () => {
    await renderParsed();
    expect(compositeOrder).toHaveBeenLastCalledWith(layers, {});
    expect(drawComposite).toHaveBeenCalled();
    const [canvas, size] = drawComposite.mock.calls[drawComposite.mock.calls.length - 1];
    expect(canvas).toBeInstanceOf(HTMLCanvasElement);
    expect(size).toEqual({ width: 4, height: 4 });
  });

  it('hides a layer with its eye button and recomposites', async () => {
    await renderParsed();
    const eye = screen.getByRole('button', { name: 'Toggle fg' });
    expect(eye).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(eye);
    expect(eye).toHaveAttribute('aria-pressed', 'false');
    expect(compositeOrder).toHaveBeenLastCalledWith(layers, { '1': { visible: false } });
    fireEvent.click(eye);
    expect(compositeOrder).toHaveBeenLastCalledWith(layers, { '1': { visible: true } });
  });

  it('changes a layer opacity with the scrubber and recomposites', async () => {
    await renderParsed();
    fireEvent.click(screen.getByRole('button', { name: 'Select fg' }));
    const slider = screen.getByRole('slider', { name: 'Opacity of fg' });
    expect(slider).toHaveAttribute('aria-valuenow', '80');
    fireEvent.keyDown(slider, { key: 'Home' });
    expect(compositeOrder).toHaveBeenLastCalledWith(layers, { '1': { opacity: 0 } });
  });

  it('names the blend mode of a layer that is not normal', async () => {
    const { tree } = await renderParsed();
    expect(within(tree).getByText('multiply')).toBeInTheDocument();
  });

  it('warns before parsing a very large file', async () => {
    const huge = { byteLength: PSD_WARN_BYTES + 1 } as ArrayBuffer;
    render(<PsdInspector data={huge} onError={() => {}} />);
    expect(screen.getByText(/This PSD is 100\.0 MB\. Parsing may be slow\./)).toBeInTheDocument();
    await act(async () => {});
    expect(parsePsd).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Open anyway' }));
    expect(await screen.findByRole('tree')).toBeInTheDocument();
    expect(parsePsd).toHaveBeenCalledTimes(1);
  });

  it('reports a file that cannot be read', async () => {
    parsePsd.mockImplementation(() => {
      throw new Error('Invalid signature');
    });
    const onError = vi.fn();
    render(<PsdInspector data={data} onError={onError} />);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(onError).toHaveBeenCalledWith('This PSD could not be read.');
  });

  it('passes on the reason when a file is too large to open', async () => {
    parsePsd.mockImplementation(() => {
      throw new Error('This PSD is too large to open in a browser (30000 × 100 px).');
    });
    const onError = vi.fn();
    render(<PsdInspector data={data} onError={onError} />);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(onError).toHaveBeenCalledWith('This PSD is too large to open in a browser (30000 × 100 px).');
  });
});
