import { act, fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import * as pdf from '../lib/pdf';
import { PDF_PAGE_GAP, PdfViewer } from './PdfViewer';
import type { PdfViewerHandle } from './PdfViewer';

vi.mock('../lib/pdf', () => ({ openPdf: vi.fn() }));

const openPdf = vi.mocked(pdf.openPdf);
const PAGE_HEIGHT = 800;
const STEP = PAGE_HEIGHT + PDF_PAGE_GAP;

function makeHandle(numPages = 5) {
  return {
    numPages,
    getPageSize: vi.fn(async () => ({ width: 600, height: PAGE_HEIGHT })),
    renderPage: vi.fn(async () => {}),
    renderTextLayer: vi.fn(async () => {}),
    destroy: vi.fn(),
  };
}

const data = new ArrayBuffer(8);
let clientHeight: ReturnType<typeof vi.spyOn>;

function setup(overrides: Partial<React.ComponentProps<typeof PdfViewer>> = {}) {
  const handle = makeHandle();
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
    await screen.findAllByTestId('pdf-page');
    expect(renderedPages(handle)).toEqual([1, 2, 3]);
    expect(handle.renderTextLayer).toHaveBeenCalledTimes(3);
  });

  it('renders later pages as the reader scrolls to them', async () => {
    const { handle } = setup();
    await screen.findAllByTestId('pdf-page');
    const scroller = screen.getByTestId('pdf-scroll');
    scroller.scrollTop = STEP * 4;
    fireEvent.scroll(scroller);
    expect(renderedPages(handle)).toContain(5);
  });

  it('marks the scroll container for night pages', async () => {
    const { rerender, props, ref } = setup({ nightPages: true });
    await screen.findAllByTestId('pdf-page');
    expect(screen.getByTestId('pdf-scroll')).toHaveAttribute('data-night-pages', 'true');
    rerender(<PdfViewer ref={ref} {...props} nightPages={false} />);
    expect(screen.getByTestId('pdf-scroll')).toHaveAttribute('data-night-pages', 'false');
  });

  it('jumps to a page', async () => {
    const { ref } = setup();
    await screen.findAllByTestId('pdf-page');
    act(() => ref.current?.goToPage(3));
    expect(screen.getByTestId('pdf-scroll').scrollTop).toBe(STEP * 2);
  });

  it('clamps page jumps to the document', async () => {
    const { ref } = setup();
    await screen.findAllByTestId('pdf-page');
    act(() => ref.current?.goToPage(99));
    expect(screen.getByTestId('pdf-scroll').scrollTop).toBe(STEP * 4);
    act(() => ref.current?.goToPage(0));
    expect(screen.getByTestId('pdf-scroll').scrollTop).toBe(0);
  });

  it('reports the page count once the document opens', async () => {
    const { props } = setup();
    await screen.findAllByTestId('pdf-page');
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
    await screen.findAllByTestId('pdf-page');
    expect(screen.getByTestId('pdf-scroll').scrollTop).toBe(900);
  });

  it('opens at a saved page when there is no scroll position', async () => {
    setup({ initialPage: 3, initialScrollTop: 0 });
    await screen.findAllByTestId('pdf-page');
    expect(screen.getByTestId('pdf-scroll').scrollTop).toBe(STEP * 2);
  });

  it('re-measures pages when the zoom changes', async () => {
    const { handle, rerender, props, ref } = setup();
    await screen.findAllByTestId('pdf-page');
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
    await screen.findAllByTestId('pdf-page');
    unmount();
    expect(handle.destroy).toHaveBeenCalled();
  });
});
