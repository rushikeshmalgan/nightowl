import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import * as pdf from './pdf';
import { PDF_PAGE_GAP, PdfViewer } from './PdfViewer';
import type { PdfViewerHandle } from './PdfViewer';

vi.mock('./pdf', () => ({ openPdf: vi.fn() }));

const openPdf = vi.mocked(pdf.openPdf);
const PAGE_HEIGHT = 800;
const STEP = PAGE_HEIGHT + PDF_PAGE_GAP;

function makeHandle(numPages = 5, size: (scale: number) => { width: number; height: number } = () => ({ width: 600, height: PAGE_HEIGHT })) {
  return {
    numPages,
    getPageSize: vi.fn(async (_n: number, scale: number) => size(scale)),
    renderPage: vi.fn(async () => {}),
    renderTextLayer: vi.fn(async () => {}),
    destroy: vi.fn(),
  };
}

const data = new ArrayBuffer(8);
let clientHeight: ReturnType<typeof vi.spyOn>;
let lastHandle: ReturnType<typeof makeHandle>;

/**
 * Waits until the pages are laid out and the viewer's post-layout effect has
 * run (it restores the scroll position, reports progress and starts drawing).
 */
async function pagesReady() {
  await screen.findAllByTestId('pdf-page');
  await waitFor(() => expect(lastHandle.renderPage).toHaveBeenCalled());
}

function setup(overrides: Partial<React.ComponentProps<typeof PdfViewer>> = {}, handle = makeHandle()) {
  lastHandle = handle;
  openPdf.mockResolvedValue(handle);
  const ref = createRef<PdfViewerHandle>();
  const onProgress = vi.fn();
  const props = {
    data,
    initialPage: 1,
    initialScrollTop: 0,
    zoom: 100,
    nightPages: false,
    onProgress,
    onError: vi.fn(),
    ...overrides,
  };
  const view = render(<PdfViewer ref={ref} {...props} />);
  return { handle, ref, props, onProgress, ...view };
}

const renderedPages = (handle: ReturnType<typeof makeHandle>) =>
  [...new Set(handle.renderPage.mock.calls.map((call) => (call as unknown as [number])[0]))].sort((a, b) => a - b);

beforeEach(() => {
  vi.clearAllMocks();
  // jsdom has no layout: give every element a 1000px-tall viewport.
  clientHeight = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(1000);
});

afterEach(() => {
  clientHeight.mockRestore();
  vi.useRealTimers();
});

describe('PdfViewer fit to width', () => {
  // A page that is 520px wide at 100% (400pt at the 1.3 base scale), so a 260px room must halve it.
  const natural = (scale: number) => ({ width: 400 * scale, height: 600 * scale });
  let clientWidth: ReturnType<typeof vi.spyOn>;
  let resizeCallbacks: Array<() => void>;

  beforeEach(() => {
    resizeCallbacks = [];
    clientWidth = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get');
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          resizeCallbacks.push(callback);
        }
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });

  afterEach(() => {
    clientWidth.mockRestore();
    vi.unstubAllGlobals();
  });

  const pageWidth = () => Number.parseFloat(screen.getAllByTestId('pdf-page')[0].style.width);
  const resizeTo = (px: number) => {
    clientWidth.mockReturnValue(px);
    act(() => resizeCallbacks.forEach((callback) => callback()));
  };

  it('shrinks pages that are wider than the room so a whole page fits', async () => {
    clientWidth.mockReturnValue(260);
    setup({}, makeHandle(5, natural));
    await pagesReady();
    expect(pageWidth()).toBeCloseTo(260, 3);
    const page = screen.getAllByTestId('pdf-page')[0];
    expect(Number.parseFloat(page.style.height) / pageWidth()).toBeCloseTo(600 / 400, 3);
  });

  it('leaves pages alone when they already fit', async () => {
    clientWidth.mockReturnValue(1000);
    setup({}, makeHandle(5, natural));
    await pagesReady();
    expect(pageWidth()).toBeCloseTo(520, 3);
  });

  it('draws at the fitted scale, not the full one', async () => {
    clientWidth.mockReturnValue(260);
    const { handle } = setup({}, makeHandle(5, natural));
    await pagesReady();
    const scales = handle.renderPage.mock.calls.map((call) => (call as unknown as [number, unknown, number])[2]);
    expect(scales.length).toBeGreaterThan(0);
    // 260px room over a 400px-wide page at scale 1.
    for (const scale of scales) expect(scale).toBeCloseTo(0.65, 6);
  });

  it('makes zoom relative to the fit: 200% is twice the fitted width', async () => {
    clientWidth.mockReturnValue(260);
    const { rerender, props, ref } = setup({}, makeHandle(5, natural));
    await pagesReady();
    expect(pageWidth()).toBeCloseTo(260, 3);
    rerender(<PdfViewer ref={ref} {...props} zoom={200} />);
    await waitFor(() => expect(pageWidth()).toBeCloseTo(520, 3));
  });

  it('refits when the window changes size, as when a phone is rotated', async () => {
    clientWidth.mockReturnValue(260);
    setup({}, makeHandle(5, natural));
    await pagesReady();
    expect(pageWidth()).toBeCloseTo(260, 3);
    resizeTo(700);
    await waitFor(() => expect(pageWidth()).toBeCloseTo(520, 3));
    resizeTo(300);
    await waitFor(() => expect(pageWidth()).toBeCloseTo(300, 3));
  });

  it('keeps the same page under the top edge when the zoom changes', async () => {
    // Unconstrained: 520x780 pages at 100%, 1040x1560 at 200%.
    const { rerender, props, ref } = setup({}, makeHandle(5, natural));
    await pagesReady();
    const scroller = screen.getByTestId('pdf-scroll');
    const step100 = 780 + PDF_PAGE_GAP;
    scroller.scrollTop = 2 * step100 + 0.25 * step100; // a quarter of the way into page 3
    fireEvent.scroll(scroller);
    rerender(<PdfViewer ref={ref} {...props} zoom={200} />);
    const step200 = 1560 + PDF_PAGE_GAP;
    await waitFor(() => expect(scroller.scrollTop).toBeCloseTo(2 * step200 + 0.25 * step200, 0));
  });

  it('keeps the place when a resize refits the pages', async () => {
    clientWidth.mockReturnValue(260);
    setup({}, makeHandle(5, natural));
    await pagesReady();
    const scroller = screen.getByTestId('pdf-scroll');
    const fitted = 390 + PDF_PAGE_GAP;
    scroller.scrollTop = 2 * fitted + 0.5 * fitted; // halfway into page 3
    fireEvent.scroll(scroller);
    resizeTo(700);
    const full = 780 + PDF_PAGE_GAP;
    await waitFor(() => expect(scroller.scrollTop).toBeCloseTo(2 * full + 0.5 * full, 0));
  });

  it('keeps the horizontal centre when zooming past the screen width', async () => {
    clientWidth.mockReturnValue(260);
    const { rerender, props, ref } = setup({}, makeHandle(5, natural));
    await pagesReady();
    const scroller = screen.getByTestId('pdf-scroll');
    expect(scroller.scrollLeft).toBe(0);
    rerender(<PdfViewer ref={ref} {...props} zoom={200} />);
    // The centre was at 130px of a 260px page; at twice the size it is at 260px, so 130px off the left edge.
    await waitFor(() => expect(scroller.scrollLeft).toBeCloseTo(130, 0));
  });

  it('does not re-measure or redraw when a resize leaves the fit unchanged', async () => {
    clientWidth.mockReturnValue(1000);
    const { handle } = setup({}, makeHandle(5, natural));
    await pagesReady();
    const measured = handle.getPageSize.mock.calls.length;
    const drawn = handle.renderPage.mock.calls.length;
    resizeTo(1100);
    await act(async () => {});
    expect(handle.getPageSize.mock.calls.length).toBe(measured);
    expect(handle.renderPage.mock.calls.length).toBe(drawn);
  });
});

describe('PdfViewer', () => {
  it('lays out a placeholder for every page at its real size', async () => {
    setup();
    const pages = await screen.findAllByTestId('pdf-page');
    expect(pages).toHaveLength(5);
    expect(pages[0].style.width).toBe('600px');
    expect(pages[0].style.height).toBe('800px');
  });

  it('renders only the pages near the viewport', async () => {
    const { handle } = setup();
    await pagesReady();
    expect(renderedPages(handle)).toEqual([1, 2, 3]);
    expect(handle.renderTextLayer).toHaveBeenCalledTimes(3);
  });

  it('renders later pages as the reader scrolls to them', async () => {
    const { handle } = setup();
    await pagesReady();
    const scroller = screen.getByTestId('pdf-scroll');
    scroller.scrollTop = STEP * 4;
    fireEvent.scroll(scroller);
    expect(renderedPages(handle)).toContain(5);
  });

  it('marks the scroll container for night pages', async () => {
    const { rerender, props, ref } = setup({ nightPages: true });
    await pagesReady();
    expect(screen.getByTestId('pdf-scroll')).toHaveAttribute('data-night-pages', 'true');
    rerender(<PdfViewer ref={ref} {...props} nightPages={false} />);
    expect(screen.getByTestId('pdf-scroll')).toHaveAttribute('data-night-pages', 'false');
  });

  it('jumps to a page', async () => {
    const { ref } = setup();
    await pagesReady();
    act(() => ref.current?.goToPage(3));
    expect(screen.getByTestId('pdf-scroll').scrollTop).toBe(STEP * 2);
  });

  it('clamps page jumps to the document', async () => {
    const { ref } = setup();
    await pagesReady();
    act(() => ref.current?.goToPage(99));
    expect(screen.getByTestId('pdf-scroll').scrollTop).toBe(STEP * 4);
    act(() => ref.current?.goToPage(0));
    expect(screen.getByTestId('pdf-scroll').scrollTop).toBe(0);
  });

  it('reports the page count once the document opens', async () => {
    const { props } = setup();
    await pagesReady();
    expect(props.onProgress).toHaveBeenCalledWith({ page: 1, numPages: 5, scrollTop: 0 });
  });

  it('reports progress at most once per 500 ms while scrolling', async () => {
    vi.useFakeTimers();
    const { props, onProgress } = setup();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    onProgress.mockClear();
    const scroller = screen.getByTestId('pdf-scroll');
    for (const top of [100, 900, STEP * 2 + 10]) {
      scroller.scrollTop = top;
      fireEvent.scroll(scroller);
    }
    expect(props.onProgress).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(props.onProgress).toHaveBeenCalledTimes(1);
    expect(props.onProgress).toHaveBeenCalledWith({ page: 3, numPages: 5, scrollTop: STEP * 2 + 10 });
  });

  it('restores a saved scroll position', async () => {
    setup({ initialPage: 2, initialScrollTop: 900 });
    await pagesReady();
    expect(screen.getByTestId('pdf-scroll').scrollTop).toBe(900);
  });

  it('opens at a saved page when there is no scroll position', async () => {
    setup({ initialPage: 3, initialScrollTop: 0 });
    await pagesReady();
    expect(screen.getByTestId('pdf-scroll').scrollTop).toBe(STEP * 2);
  });

  it('re-measures pages when the zoom changes', async () => {
    const { handle, rerender, props, ref } = setup();
    await pagesReady();
    const firstScale = (handle.getPageSize.mock.calls[0] as unknown as [number, number])[1];
    handle.getPageSize.mockClear();
    rerender(<PdfViewer ref={ref} {...props} zoom={200} />);
    await act(async () => {});
    const secondScale = (handle.getPageSize.mock.calls[0] as unknown as [number, number])[1];
    expect(secondScale).toBeCloseTo(firstScale * 2, 5);
  });

  it('explains why a PDF could not be opened', async () => {
    openPdf.mockRejectedValue({ name: 'PasswordException' });
    const onError = vi.fn();
    render(
      <PdfViewer data={data} initialPage={1} initialScrollTop={0} zoom={100} nightPages={false} onProgress={() => {}} onError={onError} />,
    );
    await act(async () => {});
    expect(onError).toHaveBeenCalledWith('This PDF is password-protected and cannot be opened.');
  });

  it('releases the document on unmount', async () => {
    const { handle, unmount } = setup();
    await pagesReady();
    unmount();
    expect(handle.destroy).toHaveBeenCalled();
  });
});
